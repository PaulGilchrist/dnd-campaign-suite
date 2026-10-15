// @maintained-by-ai: 2026-10-14
// SP-075: gateMagicMissile read only spell.level, so an upcast selection carried on
// spell.upcastLevel (SpellDetailPopup onCast) still armed a 3-dart Distribute popup
// while the popup promised a higher-level cast. Pins the effective-level dart total
// (CLA-312 convention: slotLevel = upcastLevel || level || 1), the auto-hit dart
// contract from the real spells.json rows (5e + 2024: 1d4+1 Force, no save), and the
// empty-combat fallthrough. Distribution/confirm/execute lanes are pinned downstream
// (useSpellMetamagicFlow.sp075-magicMissile-upcast, spellCastService.missile).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import spells5e from '../../../public/data/spells.json';
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

// Data authority: Magic Missile exists in both ruleset datasets; the gate is
// ruleset-agnostic for it, so 5e is the primary row and 2024 is a parity pin.
const MM = spells5e.find(s => s.name === 'Magic Missile');
const MM2024 = spells2024.find(s => s.name === 'Magic Missile');

function gate(spell) {
  const cfSetPending = vi.fn();
  const handled = tryGateSpell('Magic Missile', CAMPAIGN, cfSetPending, { spell });
  return { handled, pending: cfSetPending.mock.calls.find(c => c[0] === 'magicMissile')?.[1] };
}

describe('SP-075 gateMagicMissile — dart total at the effective slot level', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'DivinationWizard', type: 'player' },
        { name: 'Goblin A', type: 'monster' },
        { name: 'Goblin B', type: 'monster' },
      ],
    });
  });

  it('lv1 baseline: 3 darts of 1d4+1, every cs creature offered, spell threaded', () => {
    const { handled, pending } = gate({ ...MM });

    expect(handled).toBe(true);
    expect(pending.totalMissiles).toBe(3);
    expect(pending.missileDamage).toBe(MM.damage.damage_at_slot_level['1']);
    expect(pending.creatureTargets).toEqual(['DivinationWizard', 'Goblin A', 'Goblin B']);
    expect(pending.spell).toEqual(MM);
    // Auto-hit model: no save is armed on the pending state.
    expect(pending.spellSaveDc).toBeUndefined();
  });

  it.each([2, 3, 4, 5, 6, 7, 8, 9])('upcastLevel %i (spell.level stays 1): totalMissiles %i', (level) => {
    const { handled, pending } = gate({ ...MM, isUpcast: true, upcastLevel: level });

    expect(handled).toBe(true);
    expect(pending.totalMissiles).toBe(2 + level);
    expect(pending.spell.upcastLevel).toBe(level);
  });

  it('2024 row parity: same 3-dart auto-hit contract', () => {
    const { handled, pending } = gate({ ...MM2024 });

    expect(handled).toBe(true);
    expect(pending.totalMissiles).toBe(3);
    expect(pending.missileDamage).toBe(MM2024.damage.damage_at_slot_level['1']);
    expect(pending.spellSaveDc).toBeUndefined();
  });

  it('effective level on spell.level without upcastLevel: byte-compatible legacy path', () => {
    const { handled, pending } = gate({ ...MM, level: 3 });

    expect(handled).toBe(true);
    expect(pending.totalMissiles).toBe(5);
  });

  it('no combat targets: gate returns false with no pending (generic-path fallthrough)', () => {
    getCombatSummary.mockReturnValue({ creatures: [] });

    const { handled, pending } = gate({ ...MM });

    expect(handled).toBe(false);
    expect(pending).toBeUndefined();
  });
});
