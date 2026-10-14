import { describe, it, expect } from 'vitest';
import { resolveCreatureType } from './creatureTypeResolver.js';

describe('resolveCreatureType (SP-094)', () => {
  it('returns the real monsterType for EB combatSummary monsters (type npc)', () => {
    expect(resolveCreatureType({ type: 'npc', monsterType: 'Undead' })).toBe('Undead');
    expect(resolveCreatureType({ type: 'npc', monsterType: 'Aberration' })).toBe('Aberration');
  });

  it('falls through to type for PCs (no monsterType)', () => {
    expect(resolveCreatureType({ type: 'pc' })).toBe('pc');
  });

  it('returns undefined when no creature', () => {
    expect(resolveCreatureType(undefined)).toBeUndefined();
    expect(resolveCreatureType(null)).toBeUndefined();
  });
});
