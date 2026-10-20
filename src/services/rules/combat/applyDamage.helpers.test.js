// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001') } }));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn(),
  handle: vi.fn(),
}));

vi.mock('./rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 30),
}));

// ── Imports ─────────────────────────────────────────────────────

import {
  computeDamageAfterResistances,
  computeDamageAfterSave,
  hasEvasionForSave,
  computeDamageAfterEvasion,
  rollSaveForCreature,
} from './applyDamage.js';

import { rollD20 } from '../../dice/diceRoller.js';

// ── Tests ───────────────────────────────────────────────────────

describe('computeDamageAfterResistances', () => {
  it('throws when damageTypes is null, undefined, empty, or contains null/empty entries', () => {
    expect(() => computeDamageAfterResistances(10, null)).toThrow();
    expect(() => computeDamageAfterResistances(10, undefined)).toThrow();
    expect(() => computeDamageAfterResistances(10, [])).toThrow();
    expect(() => computeDamageAfterResistances(10, [null])).toThrow();
    expect(() => computeDamageAfterResistances(10, [''])).toThrow();
  });

  it('returns raw damage when no resistances or immunities match', () => {
    expect(computeDamageAfterResistances(10, ['Fire'], [], [])).toBe(10);
    expect(computeDamageAfterResistances(15, ['Fire', 'Cold'], ['poison'], [])).toBe(15);
  });

  it('applies immunity — returns 0 (case-insensitive on both sides)', () => {
    expect(computeDamageAfterResistances(10, ['Fire'], [], ['fire'])).toBe(0);
    expect(computeDamageAfterResistances(10, ['FIRE'], [], ['Fire'])).toBe(0);
  });

  it('applies resistance — halves damage with Math.floor; ignoreResistance bypasses it', () => {
    expect(computeDamageAfterResistances(9, ['Fire'], ['fire'], [])).toBe(4);
    expect(computeDamageAfterResistances(10, ['fire'], ['Fire'], [])).toBe(5);
    expect(computeDamageAfterResistances(9, ['Fire'], ['fire'], [], true)).toBe(9);
  });

  it('immunity takes priority over resistance for the same type', () => {
    expect(computeDamageAfterResistances(10, ['Fire'], ['fire'], ['fire'])).toBe(0);
  });

  it('checks all damage types in array — halved on first resistance match, zero on immunity', () => {
    expect(computeDamageAfterResistances(10, ['Fire', 'Cold'], ['cold'], [])).toBe(5);
    expect(computeDamageAfterResistances(20, ['Fire', 'Cold'], [], ['cold'])).toBe(0);
  });
});

describe('computeDamageAfterSave', () => {
  // dcSuccess 'full' (MA-0367) is owned by applyDamage.save-full.test.js.
  it('returns raw damage when save fails, whatever dcSuccess is', () => {
    expect(computeDamageAfterSave(10, false, 'half')).toBe(10);
    expect(computeDamageAfterSave(10, false, 'none')).toBe(10);
  });

  it('halves on success with dcSuccess "half" (Math.floor; 0 stays 0)', () => {
    expect(computeDamageAfterSave(9, true, 'half')).toBe(4);
    expect(computeDamageAfterSave(10, true, 'half')).toBe(5);
    expect(computeDamageAfterSave(0, true, 'half')).toBe(0);
  });

  it('returns 0 on success when dcSuccess is "none"', () => {
    expect(computeDamageAfterSave(10, true, 'none')).toBe(0);
  });
});

describe('rollSaveForCreature', () => {
  beforeEach(() => vi.clearAllMocks());

  it('CLA-303: resolves bonus for uppercase saveType against lowercase saveBonuses keys', () => {
    rollD20.mockReturnValueOnce(10);
    const creature = { saveBonuses: { wis: -2 } };
    const result = rollSaveForCreature(creature, 'WIS', 17);
    expect(result.bonus).toBe(-2);
    expect(result.total).toBe(8);
    expect(result.success).toBe(false);
  });

  it('returns correct shape with single roll duplicated into rawRolls', () => {
    rollD20.mockReturnValueOnce(15);
    const creature = { saveBonuses: { dex: 3 } };
    const result = rollSaveForCreature(creature, 'dex', 18);
    expect(result).toEqual({
      roll: 15,
      total: 18,
      bonus: 3,
      success: true,
      rawRolls: [15, 15],
    });
  });

  it('takes minimum of two rolls on disadvantage', () => {
    rollD20.mockReturnValueOnce(17).mockReturnValueOnce(5);
    const creature = { saveBonuses: { con: 2 } };
    const result = rollSaveForCreature(creature, 'con', 18, true);
    expect(result.roll).toBe(5);
    expect(result.total).toBe(7);
    expect(result.success).toBe(false);
    expect(result.rawRolls).toEqual([17, 5]);
  });

  it('takes maximum of two rolls on advantage', () => {
    rollD20.mockReturnValueOnce(5).mockReturnValueOnce(17);
    const creature = { saveBonuses: { con: 2 } };
    const result = rollSaveForCreature(creature, 'con', 18, false, true);
    expect(result.roll).toBe(17);
    expect(result.total).toBe(19);
    expect(result.success).toBe(true);
    expect(result.rawRolls).toEqual([5, 17]);
  });

  it('defaults bonus to 0 for null creature, applies negative bonuses, treats a tie as success', () => {
    rollD20.mockReturnValueOnce(8);
    const nullResult = rollSaveForCreature(null, 'wis', 15);
    expect(nullResult.bonus).toBe(0);
    expect(nullResult.success).toBe(false);

    rollD20.mockReturnValueOnce(15);
    const negResult = rollSaveForCreature({ saveBonuses: { dex: -3 } }, 'dex', 18);
    expect(negResult.total).toBe(12);
    expect(negResult.success).toBe(false);

    rollD20.mockReturnValueOnce(10);
    const tieResult = rollSaveForCreature({ saveBonuses: { con: 5 } }, 'con', 15);
    expect(tieResult.success).toBe(true);
  });
});

describe('hasEvasionForSave', () => {
  it('returns false when evasionEffects is null, undefined, or empty', () => {
    expect(hasEvasionForSave(null, 'dex')).toBe(false);
    expect(hasEvasionForSave(undefined, 'dex')).toBe(false);
    expect(hasEvasionForSave([], 'dex')).toBe(false);
  });

  it('matches production effect saveType "DEX" against lowercase, mixed, and full ability names', () => {
    const effects = [{ saveType: 'DEX' }, { saveType: 'CON' }];
    expect(hasEvasionForSave(effects, 'dex')).toBe(true);
    expect(hasEvasionForSave(effects, 'Dex')).toBe(true);
    expect(hasEvasionForSave(effects, 'Dexterity')).toBe(true);
    expect(hasEvasionForSave(effects, 'wis')).toBe(false);
  });
});

describe('computeDamageAfterEvasion', () => {
  it('active evasion on dcSuccess "half": success → 0, fail → Math.floor half', () => {
    expect(computeDamageAfterEvasion(10, true, 'half', true)).toBe(0);
    expect(computeDamageAfterEvasion(10, false, 'half', true)).toBe(5);
    expect(computeDamageAfterEvasion(9, false, 'half', true)).toBe(4);
  });

  it('falls through to computeDamageAfterSave when evasion is inactive or dcSuccess is not "half"', () => {
    expect(computeDamageAfterEvasion(10, true, 'half', false)).toBe(5);
    expect(computeDamageAfterEvasion(10, true, 'none', true)).toBe(0);
    expect(computeDamageAfterEvasion(10, false, 'other', true)).toBe(10);
  });
});
