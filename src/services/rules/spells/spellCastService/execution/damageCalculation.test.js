// @improved-by-ai
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn().mockReturnValue([]),
  getEmpoweredEvocationIntModifier: vi.fn().mockReturnValue(0),
}));

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
}));

import { computeRange } from './damageCalculation.js';

const ATTACKER = { gridX: 0, gridY: 0 };
// (0,25) -> 25 cells * 5 ft = 125 ft

function posAtCells(cellsY) {
  return { gridX: 0, gridY: cellsY };
}

describe('computeRange — Spell Sniper spellRangeBonus (FT-087)', () => {
  it('adds spellRangeBonus for attack-roll spells with range >= 10 ft (holder hits beyond base band)', () => {
    const spell = { name: 'Poison Spray', level: 0, range: '30 feet', attack_type: 'ranged', school: 'Necromancy' };
    const featEffects = { spellRangeBonus: 60 };
    const result = computeRange(spell, {}, ATTACKER, posAtCells(25), featEffects);
    expect(result).toEqual({});
  });

  it('without the feat, auto-misses beyond double the base range (control unchanged)', () => {
    const spell = { name: 'Poison Spray', level: 0, range: '30 feet', attack_type: 'ranged', school: 'Necromancy' };
    const result = computeRange(spell, {}, ATTACKER, posAtCells(25), {});
    expect(result.isAutoMiss).toBe(true);
    expect(result.rangeReason).toContain('Out of range');
  });

  it('does not add spellRangeBonus to saving-throw spells (dc present)', () => {
    const spell = { name: 'Sacred Flame', level: 0, range: '60 feet', attack_type: 'ranged', school: 'Evocation', dc: { dc_type: 'DEX' } };
    const result = computeRange(spell, {}, ATTACKER, posAtCells(26), { spellRangeBonus: 60 });
    expect(result.isAutoMiss).toBe(true);
  });

  it('does not add spellRangeBonus for spells with base range under 10 ft', () => {
    const spell = { name: 'Touch Attack', level: 1, range: '5 feet', attack_type: 'melee', school: 'Evocation' };
    const result = computeRange(spell, {}, ATTACKER, posAtCells(2), { spellRangeBonus: 60 });
    expect(result.isAutoMiss).toBe(true);
  });

  it('stacks with Distant Metamagic (double first, then + spellRangeBonus)', () => {
    const spell = { name: 'Poison Spray', level: 0, range: '30 feet', attack_type: 'ranged', school: 'Necromancy' };
    const withBoth = computeRange(spell, { metamagicDistant: true }, ATTACKER, posAtCells(25), { spellRangeBonus: 60 });
    expect(withBoth).toEqual({});
    const distantOnly = computeRange(spell, { metamagicDistant: true }, ATTACKER, posAtCells(25), {});
    expect(distantOnly.isAutoMiss).toBe(true);
  });

  it('keeps cantripRangeBonus behavior unchanged when spellRangeBonus absent', () => {
    const spell = { name: 'Toll the Dead', level: 0, range: '60 feet', attack_type: 'ranged', school: 'Necromancy', dc: { dc_type: 'WIS' } };
    const result = computeRange(spell, {}, ATTACKER, posAtCells(25), { cantripRangeBonus: 120 });
    expect(result).toEqual({});
  });
});
