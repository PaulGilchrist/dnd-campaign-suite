// SP-075: gateMagicMissile read only spell.level, so an upcast selection carried on
// spell.upcastLevel (SpellDetailPopup onCast) still armed a 3-dart Distribute popup
// while the popup promised a higher-level cast. Pins the effective-level dart total
// (CLA-312 convention) and the byte-compatible lv1 baseline.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(async () => null),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn(async () => []),
}));

import { tryGateSpell } from './spellGates.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';

const CAMPAIGN = 'test-campaign';

function makeCs() {
  return {
    creatures: [
      { name: 'DivinationWizard', type: 'player' },
      { name: 'Goblin A', type: 'monster' },
      { name: 'Goblin B', type: 'monster' },
    ],
  };
}

function gate(spell) {
  const cfSetPending = vi.fn();
  const extra = { spell, metaCtx: {}, playerStats: { name: 'DivinationWizard' }, characters: [], isSorcerer: false, setPopupHtml: vi.fn() };
  const handled = tryGateSpell('Magic Missile', CAMPAIGN, cfSetPending, extra);
  return { handled, cfSetPending };
}

function pendingOf(cfSetPending) {
  const call = cfSetPending.mock.calls.find(c => c[0] === 'magicMissile');
  return call ? call[1] : null;
}

describe('SP-075 gateMagicMissile — dart total at the effective slot level', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue(makeCs());
  });

  const baseSpell = { name: 'Magic Missile', level: 1, casting_time: 'Action', range: '120 feet' };

  it('lv1 baseline: totalMissiles 3 — byte-identical legacy', () => {
    const { handled, cfSetPending } = gate({ ...baseSpell });
    expect(handled).toBe(true);
    const pending = pendingOf(cfSetPending);
    expect(pending.totalMissiles).toBe(3);
    expect(pending.missileDamage).toBe('1d4 + 1');
  });

  it('lv2 upcast (upcastLevel 2, spell.level stays 1): totalMissiles 4', () => {
    const { handled, cfSetPending } = gate({ ...baseSpell, isUpcast: true, upcastLevel: 2 });
    expect(handled).toBe(true);
    expect(pendingOf(cfSetPending).totalMissiles).toBe(4);
  });

  it('lv4 upcast: totalMissiles 6', () => {
    const { handled, cfSetPending } = gate({ ...baseSpell, isUpcast: true, upcastLevel: 4 });
    expect(handled).toBe(true);
    expect(pendingOf(cfSetPending).totalMissiles).toBe(6);
  });

  it('no combat targets: gate returns false (generic-path fallthrough)', () => {
    getCombatSummary.mockReturnValue({ creatures: [] });
    const { handled } = gate({ ...baseSpell });
    expect(handled).toBe(false);
  });
});
