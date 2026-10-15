// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach } from 'vitest';
import spells2024 from '../../../public/data/2024/spells.json';
import spells5e from '../../../public/data/spells.json';

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

import { tryGateSpell } from './spellGates.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';

const CAMPAIGN = 'test-campaign';

// Data authority: 2024 Essentials row (the only spells.json carrying the
// upcast_at_slot_level ladder for Bane; the 5e row has none — covered by
// the missing-data fallback test below).
const BANE = spells2024.find(s => s.name === 'Bane');
const BANE_5E = spells5e.find(s => s.name === 'Bane');

function makeCs() {
  return {
    creatures: [
      { name: 'Divine_Cleric', type: 'player' },
      { name: 'Bandit 1', type: 'npc' },
      { name: 'Bandit 2', type: 'npc' },
      { name: 'Bandit 3', type: 'npc' },
    ],
  };
}

function gate(spell) {
  const cfSetPending = vi.fn();
  const handled = tryGateSpell('bane', CAMPAIGN, cfSetPending, {
    spell,
    metaCtx: {},
    playerStats: { name: 'Divine_Cleric' },
    characters: [],
    isSorcerer: false,
    setPopupHtml: vi.fn(),
  });
  return { handled, pending: cfSetPending.mock.calls[0]?.[1] };
}

describe('SP-011 gateBane — upcast-aware target cap (concentration debuff gate)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue(makeCs());
  });

  it('opens the picker over every combatant at 30 ft, capped at 3 (RAW "Up to three creatures")', () => {
    const { handled, pending } = gate({ ...BANE });

    expect(handled).toBe(true);
    expect(pending.creatureTargets).toEqual(['Divine_Cleric', 'Bandit 1', 'Bandit 2', 'Bandit 3']);
    expect(pending.maxTargets).toBe(3);
    expect(pending.range).toBe('30 feet');
  });

  it.each([[2, 4], [3, 5], [9, 11]])('lv%d upcast threads the RAW +1/slot ladder (extractMaxTargets)', (lv, cap) => {
    const { handled, pending } = gate({ ...BANE, isUpcast: true, upcastLevel: lv });

    expect(handled).toBe(true);
    expect(pending.maxTargets).toBe(cap);
  });

  it('falls back to lv1 cap 3 on the 5e data row (no upcast ladder)', () => {
    const { pending } = gate({ ...BANE_5E });

    expect(pending.maxTargets).toBe(3);
  });

  it('returns false when no creatures are in combat (cast falls through to generic path)', () => {
    getCombatSummary.mockReturnValue({ creatures: [] });

    const { handled, pending } = gate({ ...BANE });

    expect(handled).toBe(false);
    expect(pending).toBeUndefined();
  });
});
