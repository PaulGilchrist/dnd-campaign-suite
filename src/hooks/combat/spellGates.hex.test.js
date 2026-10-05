// CLA-107: gateHex must thread the HexAbilityModal chooser selection
// (metaCtx.hexAbility) onto the pending target-picker state so the chosen
// ability survives confirm → runHex → executeSpellCast (previously dropped,
// pinning STR at spellCastService/execution/index.js).
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const HEX = { name: 'Hex', level: 1, casting_time: '1 bonus action', range: '90 feet', school: 'Enchantment' };

function makeCs() {
  return {
    creatures: [
      { name: 'HexWarlock', type: 'player' },
      { name: 'Bandit 1', type: 'npc' },
    ],
  };
}

function gate(metaCtx) {
  const cfSetPending = vi.fn();
  const handled = tryGateSpell('hex', CAMPAIGN, cfSetPending, {
    spell: HEX,
    metaCtx,
    playerStats: { name: 'HexWarlock' },
    characters: [],
    isSorcerer: false,
    setPopupHtml: vi.fn(),
  });
  return { handled, pending: cfSetPending.mock.calls[0]?.[1] };
}

describe('CLA-107 gateHex — chooser threading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue(makeCs());
  });

  it('persists the chosen hexAbility onto pending', () => {
    const { handled, pending } = gate({ hexAbility: 'DEX' });
    expect(handled).toBe(true);
    expect(pending.hexAbility).toBe('DEX');
    expect(pending.spellName).toBe('Hex');
    expect(pending.creatureTargets).toContain('Bandit 1');
  });

  it('each ability choice survives verbatim (no STR coercion)', () => {
    for (const ability of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']) {
      expect(gate({ hexAbility: ability }).pending.hexAbility).toBe(ability);
    }
  });

  it('missing chooser selection stamps null (no silent STR default)', () => {
    const { handled, pending } = gate({});
    expect(handled).toBe(true);
    expect(pending.hexAbility).toBeNull();
  });
});
