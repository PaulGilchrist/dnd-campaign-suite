// CLA-050 regression: Circle of the Land granted spells are cast at their FIXED
// classes.json level — the upcast ladder must offer exactly that one level (no
// free lv1→9 range) for rows stamped _circleOfTheLandFixedLevel. Untouched rows
// keep the canonical full damage/heal ladder.
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSpellUpcastFlow } from './useSpellUpcastFlow.js';

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useSpellUpcastFlow — CLA-050 fixed-level clamp', () => {
  it('clamps a fixed-level Burning Hands row (level 3) to a single offered level', () => {
    const { result } = renderHook(() => useSpellUpcastFlow(makeDruidStats(), 'test-campaign'));
    const spell = {
      name: 'Burning Hands',
      level: 3,
      _circleOfTheLandFixedLevel: 3,
      damage: {
        damage_type: 'Fire',
        damage_at_slot_level: { 1: '3d8', 2: '4d8', 3: '5d8', 4: '6d8', 5: '6d8' },
      },
    };
    const levels = result.current.buildUpcastLevels(spell);
    expect(levels).toEqual([{ level: 3, formula: '5d8', availableSlots: 3 }]);
  });

  it('clamps a fixed-level Fireball row to level 5 with the level-5 formula', () => {
    const { result } = renderHook(() => useSpellUpcastFlow(makeDruidStats(), 'test-campaign'));
    const spell = {
      name: 'Fireball',
      level: 5,
      _circleOfTheLandFixedLevel: 5,
      damage: {
        damage_type: 'Fire',
        damage_at_slot_level: { 3: '8d6', 4: '9d6', 5: '10d6' },
      },
    };
    const levels = result.current.buildUpcastLevels(spell);
    expect(levels).toEqual([{ level: 5, formula: '10d6', availableSlots: 3 }]);
  });

  it('returns one clamped level even for a spell with no slot ladder (Fire Bolt tiers)', () => {
    const { result } = renderHook(() => useSpellUpcastFlow(makeDruidStats(), 'test-campaign'));
    const spell = {
      name: 'Fire Bolt',
      level: 3,
      _circleOfTheLandFixedLevel: 3,
      damage: { damage_type: 'Fire', damage_at_slot_level: { 0: '1d10', 5: '2d10' } },
    };
    const levels = result.current.buildUpcastLevels(spell);
    expect(levels).toEqual([{ level: 3, formula: '', availableSlots: 3 }]);
  });

  it('leaves unstamped rows on the full canonical ladder', () => {
    const { result } = renderHook(() => useSpellUpcastFlow(makeDruidStats(), 'test-campaign'));
    const spell = {
      name: 'Fireball',
      level: 3,
      damage: {
        damage_type: 'Fire',
        damage_at_slot_level: { 3: '8d6', 4: '9d6', 5: '10d6' },
      },
    };
    const levels = result.current.buildUpcastLevels(spell);
    expect(levels.map(l => l.level)).toEqual([3, 4, 5]);
  });
});
