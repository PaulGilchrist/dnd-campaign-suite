// @maintained-by-ai: 2026-10-14
// CLA-107: gateHex must thread the HexAbilityModal chooser selection
// (metaCtx.hexAbility) onto the pending target-picker state so the chosen
// ability survives confirm → runHex → executeSpellCast (previously dropped,
// pinning STR at spellCastService/execution/index.js).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import spells2024 from '../../../public/data/2024/spells.json';

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('../../services/combat/conditions/deathSaveRules.js', () => ({
  isStable: vi.fn(() => false),
}));

import { tryGateSpell } from './spellGates.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';

const CAMPAIGN = 'test-campaign';

// Data authority: 2024 Essentials row (Hex exists only in /data/2024/).
const HEX = spells2024.find(s => s.name === 'Hex');

function makeCs() {
  return {
    creatures: [
      { name: 'HexWarlock', type: 'player' },
      { name: 'Bandit 1', type: 'npc' },
      { name: 'Bandit 2', type: 'npc' },
    ],
  };
}

function gate(metaCtx) {
  const cfSetPending = vi.fn();
  const handled = tryGateSpell('hex', CAMPAIGN, cfSetPending, {
    spell: { ...HEX },
    metaCtx,
    playerStats: { name: 'HexWarlock' },
    characters: [],
    isSorcerer: false,
    setPopupHtml: vi.fn(),
  });
  return { handled, pending: cfSetPending.mock.calls[0]?.[1] };
}

describe('CLA-107 gateHex — single-target concentration curse gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue(makeCs());
  });

  it('opens a max-1 picker over every non-caster at 90 ft, concentration spell threaded', () => {
    const { handled, pending } = gate({ hexAbility: 'DEX' });

    expect(handled).toBe(true);
    expect(pending.spellName).toBe('Hex');
    expect(pending.spellLevel).toBe(1);
    expect(pending.castingTime).toBe('Bonus Action');
    expect(pending.spell.concentration).toBe(true);
    expect(pending.range).toBe('90 feet');
    expect(pending.maxTargets).toBe(1);
    expect(pending.creatureTargets).toEqual(['Bandit 1', 'Bandit 2']);
  });

  it.each(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'])('threads chosen hexAbility %s verbatim (no STR coercion)', (ability) => {
    expect(gate({ hexAbility: ability }).pending.hexAbility).toBe(ability);
  });

  it('stamps null when no chooser selection (no silent STR default)', () => {
    const { handled, pending } = gate({});

    expect(handled).toBe(true);
    expect(pending.hexAbility).toBeNull();
  });

  it('returns false when no creatures are in combat (cast falls through to generic path)', () => {
    getCombatSummary.mockReturnValue({ creatures: [] });

    const { handled, pending } = gate({ hexAbility: 'DEX' });

    expect(handled).toBe(false);
    expect(pending).toBeUndefined();
  });
});
