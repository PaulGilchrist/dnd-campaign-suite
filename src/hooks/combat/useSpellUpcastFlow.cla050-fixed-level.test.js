// @maintained-by-ai: 2026-10-19
// CLA-050 lane — the fixed-level clamp in buildUpcastLevels ONLY: rows stamped
// _circleOfTheLandFixedLevel offer exactly ONE picker row at the stamped level
// (no free ladder), formula resolved at the fixed level with precedence
// damage → heal → upcast_at_slot_level → '', and availableSlots read AT the fixed
// level (runtime store preferred over class cap). Paired control: the same row
// minus the stamp keeps the full ladder — proves the flag, not level or shape,
// drives the clamp.
// Owned elsewhere — do NOT duplicate here: canonical upcast state machine and full
// ladder building (useSpellUpcastFlow.test.js), stamp creation + cast-level pin
// copy.level = fixed (spellCalc2024-circle-of-land.test.js), damage resolution in
// the rules engine (spellDamageUtils.test.js), picker display bytes
// (CharSpells.Rendering.test.jsx).
// Old -> new: Burning Hands clamp -> table row 1; Fireball lv5 clamp -> table row
// 2; Fire Bolt no-rung => formula '' -> table row 6; unstamped full-ladder
// control -> paired control test.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSpellUpcastFlow } from './useSpellUpcastFlow.js';

// Runtime seam: explicit default of null (no runtime override) so every
// availableSlots byte falls through to the class cap unless a case overrides it.
const mockGetRuntimeValue = vi.fn(() => null);

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (...args) => mockGetRuntimeValue(...args),
  setRuntimeValue: vi.fn(),
}));

// lv17 full-caster caps (4/3/3/3/3/2/2/1/1): lv1 has 4, lv2-5 have 3 — so a
// clamped lv3 row with availableSlots 3 and no lv4/lv5 rows is falsifiable.
function makeDruidStats() {
  return {
    name: 'Wild_Sage_Druid',
    level: 20,
    spellAbilities: {
      spell_slots_level_1: 4,
      spell_slots_level_2: 3,
      spell_slots_level_3: 3,
      spell_slots_level_4: 3,
      spell_slots_level_5: 3,
      spell_slots_level_6: 2,
      spell_slots_level_7: 2,
      spell_slots_level_8: 1,
      spell_slots_level_9: 1,
    },
  };
}

function renderFlow(runtimeSlots = {}, stats = makeDruidStats()) {
  mockGetRuntimeValue.mockImplementation((_name, key) => {
    const m = /^spell_slots_level_(\d+)$/.exec(key || '');
    return m && runtimeSlots[m[1]] != null ? runtimeSlots[m[1]] : null;
  });
  return renderHook(() => useSpellUpcastFlow(stats, 'test-campaign'));
}

// Circle of the Land row: 5e Burning Hands ladder (3d6 +1d6/slot) with unused
// lv4/lv5 slots available — the clamp must still offer lv3 only.
const cotlBurningHands = (overrides = {}) => ({
  name: 'Burning Hands',
  level: 3,
  _circleOfTheLandFixedLevel: 3,
  damage: {
    damage_type: 'Fire',
    damage_at_slot_level: { 1: '3d6', 2: '4d6', 3: '5d6', 4: '6d6', 5: '7d6' },
  },
  ...overrides,
});

describe('CLA-050 fixed-level clamp — buildUpcastLevels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['damage ladder clamps to stamped lv3 with the lv3 formula',
      cotlBurningHands(), {},
      [{ level: 3, formula: '5d6', availableSlots: 3 }]],
    ['Fireball stamped lv5 clamps to lv5 with the lv5 formula',
      { name: 'Fireball', level: 5, _circleOfTheLandFixedLevel: 5,
        damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '8d6', 4: '9d6', 5: '10d6' } } }, {},
      [{ level: 5, formula: '10d6', availableSlots: 3 }]],
    ['availableSlots is read AT the fixed level, runtime store preferred over cap',
      cotlBurningHands(), { 3: 1, 4: 0, 5: 0 },
      [{ level: 3, formula: '5d6', availableSlots: 1 }]],
    ['no damage rung at fixed level falls back to heal_at_slot_level[fixed]',
      { name: 'Heal Row', level: 2, _circleOfTheLandFixedLevel: 2,
        damage: { damage_at_slot_level: { 3: '5d6' } },
        heal_at_slot_level: { 2: '2d8 + MOD', 3: '3d8 + MOD' } }, {},
      [{ level: 2, formula: '2d8 + MOD', availableSlots: 3 }]],
    ['no damage or heal falls back to upcast_at_slot_level[fixed]',
      { name: 'Charm Monster', level: 4, _circleOfTheLandFixedLevel: 4,
        upcast_at_slot_level: { 4: '1 target', 5: '2 targets' } }, {},
      [{ level: 4, formula: '1 target', availableSlots: 3 }]],
    ['ladder with no rung at the fixed level yields exactly one empty-formula row',
      { name: 'Fire Bolt', level: 3, _circleOfTheLandFixedLevel: 3,
        damage: { damage_type: 'Fire', damage_at_slot_level: { 0: '1d10', 5: '2d10' } } }, {},
      [{ level: 3, formula: '', availableSlots: 3 }]],
  ])('%s', (_label, spell, runtimeSlots, expected) => {
    const { result } = renderFlow(runtimeSlots);
    expect(result.current.buildUpcastLevels(spell)).toEqual(expected);
  });

  it('same row minus the stamp keeps the full lv1-5 ladder (flag drives the clamp)', () => {
    const { result } = renderFlow();
    const unflagged = cotlBurningHands();
    delete unflagged._circleOfTheLandFixedLevel;
    expect(result.current.buildUpcastLevels(unflagged)).toEqual([
      { level: 1, formula: '3d6', availableSlots: 4 },
      { level: 2, formula: '4d6', availableSlots: 3 },
      { level: 3, formula: '5d6', availableSlots: 3 },
      { level: 4, formula: '6d6', availableSlots: 3 },
      { level: 5, formula: '7d6', availableSlots: 3 },
    ]);
  });
});
