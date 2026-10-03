import { describe, it, expect, vi, beforeEach } from 'vitest';
import banesRow from '../../../public/data/2024/spells.json';

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

const CAMPAIGN = 'TestCampaign';

const BANE = banesRow.find(s => s.name === 'Bane');

function makeCs(count) {
  return {
    creatures: [
      { name: 'Divine_Cleric', type: 'player' },
      ...Array.from({ length: count }, (_, i) => ({ name: `Bandit ${i + 1}`, type: 'npc' })),
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
  return { handled, cfSetPending };
}

describe('SP-011 gateBane — upcast-aware target cap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue(makeCs(4));
  });

  it('lv1 cap is 3 (RAW "Up to three creatures")', () => {
    const { handled, cfSetPending } = gate({ ...BANE });
    expect(handled).toBe(true);
    expect(cfSetPending.mock.calls[0][1].maxTargets).toBe(3);
  });

  it('lv2 upcast cap is 4 — picker can select a 4th target', () => {
    const { handled, cfSetPending } = gate({ ...BANE, isUpcast: true, upcastLevel: 2 });
    expect(handled).toBe(true);
    expect(cfSetPending.mock.calls[0][1].maxTargets).toBe(4);
  });

  it('lv3 upcast cap is 5', () => {
    const { cfSetPending } = gate({ ...BANE, isUpcast: true, upcastLevel: 3 });
    expect(cfSetPending.mock.calls[0][1].maxTargets).toBe(5);
  });

  it('falls back to lv1 cap 3 when spell carries no upcast data', () => {
    const { cfSetPending } = gate({ name: 'Bane', level: 1, range: '30 feet' });
    expect(cfSetPending.mock.calls[0][1].maxTargets).toBe(3);
  });

  it('DATA: bane upcast strings parse RAW "up to N targets" ladder', () => {
    expect(BANE.upcast_at_slot_level['1']).toBe('up to 3 targets');
    expect(BANE.upcast_at_slot_level['2']).toBe('up to 4 targets');
    expect(BANE.upcast_at_slot_level['9']).toBe('up to 11 targets');
  });
});
