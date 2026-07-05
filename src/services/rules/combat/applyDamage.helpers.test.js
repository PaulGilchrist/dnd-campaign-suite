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

  it('skips null damage type entries without throwing', () => {
    const result = computeDamageAfterResistancesWithDetails(10, [null, 'Fire'], [], []);
    expect(result.finalDamage).toBe(10);
  });

  it('skips empty string damage type entries without throwing', () => {
    const result = computeDamageAfterResistancesWithDetails(10, ['', 'Fire'], [], []);
    expect(result.finalDamage).toBe(10);
  });

  it('returns raw damage with empty typeDetails when no resistances/immunities', () => {
    const result = computeDamageAfterResistancesWithDetails(10, ['Fire'], [], []);
    expect(result.finalDamage).toBe(10);
    expect(result.typeDetails).toEqual([]);
  });

  it('returns 0 damage with immune status when immunity matches', () => {
    const result = computeDamageAfterResistancesWithDetails(10, ['Fire'], [], ['fire']);
    expect(result.finalDamage).toBe(0);
    expect(result.typeDetails).toEqual([{ damageType: 'Fire', status: 'immune' }]);
  });

  it('returns halved damage with resistant status when resistance matches', () => {
    const result = computeDamageAfterResistancesWithDetails(9, ['Fire'], ['fire'], []);
    expect(result.finalDamage).toBe(4);
    expect(result.typeDetails).toEqual([{ damageType: 'Fire', status: 'resistant' }]);
  });

  it('immunity takes priority over resistance for the same type', () => {
    const result = computeDamageAfterResistancesWithDetails(10, ['Fire'], ['fire'], ['fire']);
    expect(result.finalDamage).toBe(0);
    expect(result.typeDetails).toEqual([{ damageType: 'Fire', status: 'immune' }]);
  });

  it('checks all damage types and returns halved on first resistance match', () => {
    const result = computeDamageAfterResistancesWithDetails(10, ['Fire', 'Cold'], ['cold'], []);
    expect(result.finalDamage).toBe(5);
    expect(result.typeDetails).toEqual([{ damageType: 'Cold', status: 'resistant' }]);
  });

  it('returns 0 when immunity matches second damage type', () => {
    const result = computeDamageAfterResistancesWithDetails(20, ['Fire', 'Cold'], [], ['cold']);
    expect(result.finalDamage).toBe(0);
    expect(result.typeDetails).toEqual([{ damageType: 'Cold', status: 'immune' }]);
  });

  it('returns raw damage when no damage types match', () => {
    const result = computeDamageAfterResistancesWithDetails(15, ['Fire', 'Cold'], ['poison'], []);
    expect(result.finalDamage).toBe(15);
    expect(result.typeDetails).toEqual([]);
  });

  it('ignores resistance when ignoreResistance is true', () => {
    const result = computeDamageAfterResistancesWithDetails(10, ['Fire'], ['fire'], [], true);
    expect(result.finalDamage).toBe(10);
    expect(result.typeDetails).toEqual([]);
  });

  it('still reports immunity even when ignoreResistance is true', () => {
    const result = computeDamageAfterResistancesWithDetails(10, ['Fire'], ['fire'], ['fire'], true);
    expect(result.finalDamage).toBe(0);
    expect(result.typeDetails).toEqual([{ damageType: 'Fire', status: 'immune' }]);
  });

  it('handles multiple damage types with multiple resistance matches', () => {
    const result = computeDamageAfterResistancesWithDetails(10, ['Fire', 'Cold', 'Acid'], ['fire', 'cold'], []);
    expect(result.finalDamage).toBe(5);
    expect(result.typeDetails).toHaveLength(2);
    expect(result.typeDetails[0].status).toBe('resistant');
    expect(result.typeDetails[1].status).toBe('resistant');
  });

  it('stops checking after first immunity match', () => {
    const result = computeDamageAfterResistancesWithDetails(10, ['Fire', 'Cold', 'Acid'], ['cold'], ['fire']);
    expect(result.finalDamage).toBe(0);
    expect(result.typeDetails).toHaveLength(1);
    expect(result.typeDetails[0].damageType).toBe('Fire');
  });

  it('preserves original damage type casing in typeDetails', () => {
    const result = computeDamageAfterResistancesWithDetails(10, ['FIRE'], ['fire'], []);
    expect(result.typeDetails[0].damageType).toBe('FIRE');
  });

  it('handles case-insensitive matching for both resistances and immunities', () => {
    const result = computeDamageAfterResistancesWithDetails(10, ['fire'], ['FIRE'], []);
    expect(result.finalDamage).toBe(5);
    const result2 = computeDamageAfterResistancesWithDetails(10, ['fire'], [], ['FIRE']);
    expect(result2.finalDamage).toBe(0);
  });

  it('handles undefined resistances and immunities gracefully', () => {
    const result = computeDamageAfterResistancesWithDetails(10, ['Fire'], undefined, undefined);
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
