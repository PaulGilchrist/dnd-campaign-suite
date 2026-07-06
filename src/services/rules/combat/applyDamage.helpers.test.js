// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi } from 'vitest';

import {
  computeDamageAfterResistancesWithDetails,
  clearReTriggeredSequence,
} from './applyDamage.js';

// ── Globals ─────────────────────────────────────────────────────

global.fetch = vi.fn(() => new Promise(() => {}));

// ── Tests ───────────────────────────────────────────────────────

describe('computeDamageAfterResistancesWithDetails', () => {
  it('throws when damageTypes is null, undefined, or empty', () => {
    expect(() => computeDamageAfterResistancesWithDetails(10, null)).toThrow();
    expect(() => computeDamageAfterResistancesWithDetails(10, undefined)).toThrow();
    expect(() => computeDamageAfterResistancesWithDetails(10, [])).toThrow();
  });

  it('skips null/empty damage type entries without throwing', () => {
    let result = computeDamageAfterResistancesWithDetails(10, [null, 'Fire'], [], []);
    expect(result.finalDamage).toBe(10);

    result = computeDamageAfterResistancesWithDetails(10, ['', 'Fire'], [], []);
    expect(result.finalDamage).toBe(10);
  });

  it('returns raw damage with empty typeDetails when no resistances/immunities', () => {
    const result = computeDamageAfterResistancesWithDetails(10, ['Fire'], [], []);
    expect(result.finalDamage).toBe(10);
    expect(result.typeDetails).toEqual([]);
  });

  it('returns 0 damage with immune status when immunity matches, halved with resistant status', () => {
    let result = computeDamageAfterResistancesWithDetails(10, ['Fire'], [], ['fire']);
    expect(result.finalDamage).toBe(0);
    expect(result.typeDetails).toEqual([{ damageType: 'Fire', status: 'immune' }]);

    result = computeDamageAfterResistancesWithDetails(9, ['Fire'], ['fire'], []);
    expect(result.finalDamage).toBe(4);
    expect(result.typeDetails).toEqual([{ damageType: 'Fire', status: 'resistant' }]);
  });

  it('immunity takes priority over resistance, checks all damage types, stops at first immunity', () => {
    let result = computeDamageAfterResistancesWithDetails(10, ['Fire'], ['fire'], ['fire']);
    expect(result.finalDamage).toBe(0);
    expect(result.typeDetails).toEqual([{ damageType: 'Fire', status: 'immune' }]);

    result = computeDamageAfterResistancesWithDetails(10, ['Fire', 'Cold'], ['cold'], []);
    expect(result.finalDamage).toBe(5);
    expect(result.typeDetails).toEqual([{ damageType: 'Cold', status: 'resistant' }]);

    result = computeDamageAfterResistancesWithDetails(20, ['Fire', 'Cold'], [], ['cold']);
    expect(result.finalDamage).toBe(0);
    expect(result.typeDetails).toEqual([{ damageType: 'Cold', status: 'immune' }]);

    result = computeDamageAfterResistancesWithDetails(10, ['Fire', 'Cold', 'Acid'], ['cold'], ['fire']);
    expect(result.finalDamage).toBe(0);
    expect(result.typeDetails).toHaveLength(1);
    expect(result.typeDetails[0].damageType).toBe('Fire');
  });

  it('returns raw damage when no damage types match, handles multiple resistance matches', () => {
    let result = computeDamageAfterResistancesWithDetails(15, ['Fire', 'Cold'], ['poison'], []);
    expect(result.finalDamage).toBe(15);
    expect(result.typeDetails).toEqual([]);

    result = computeDamageAfterResistancesWithDetails(10, ['Fire', 'Cold', 'Acid'], ['fire', 'cold'], []);
    expect(result.finalDamage).toBe(5);
    expect(result.typeDetails).toHaveLength(2);
    expect(result.typeDetails[0].status).toBe('resistant');
    expect(result.typeDetails[1].status).toBe('resistant');
  });

  it('ignores resistance when ignoreResistance is true, still reports immunity', () => {
    let result = computeDamageAfterResistancesWithDetails(10, ['Fire'], ['fire'], [], true);
    expect(result.finalDamage).toBe(10);
    expect(result.typeDetails).toEqual([]);

    result = computeDamageAfterResistancesWithDetails(10, ['Fire'], ['fire'], ['fire'], true);
    expect(result.finalDamage).toBe(0);
    expect(result.typeDetails).toEqual([{ damageType: 'Fire', status: 'immune' }]);
  });

  it('preserves casing, handles case-insensitive matching, and undefined resistances/immunities', () => {
    let result = computeDamageAfterResistancesWithDetails(10, ['FIRE'], ['fire'], []);
    expect(result.typeDetails[0].damageType).toBe('FIRE');

    result = computeDamageAfterResistancesWithDetails(10, ['fire'], ['FIRE'], []);
    expect(result.finalDamage).toBe(5);

    result = computeDamageAfterResistancesWithDetails(10, ['fire'], [], ['FIRE']);
    expect(result.finalDamage).toBe(0);

    result = computeDamageAfterResistancesWithDetails(10, ['Fire'], undefined, undefined);
    expect(result.finalDamage).toBe(10);
    expect(result.typeDetails).toEqual([]);
  });
});

describe('clearReTriggeredSequence', () => {
  it('removes a sequence ID from the internal set without throwing', () => {
    clearReTriggeredSequence('test-seq-1');
    clearReTriggeredSequence('test-seq-2');
    clearReTriggeredSequence('');
    clearReTriggeredSequence(null);
    clearReTriggeredSequence(undefined);
  });
});
