// @maintained-by-ai 2026-11-19
// Shared bestiary search/filter/cap helpers (moved verbatim out of
// EncounterBuilder.jsx by the quick-monster-spawn feature). These are the ONE
// narrowing lane both the Encounter Builder table and the tracker's
// "+ Monster" picker run through — pinned directly here (the EB's
// helpers.test.jsx keeps driving them through the real builder UI; this file
// owns the pure-unit behavior the picker depends on).
import { describe, it, expect } from 'vitest';

import {
  BESTIARY_RENDER_CAP,
  compareMonsters,
  filterMonsters,
  isBestiaryNarrowed,
  capBestiaryRows,
} from './monsterBestiarySearch.js';

const MONSTERS = [
  { index: 'cloud', name: 'Cloud', xp: 0, type: 'elemental', challenge_rating: 'None', environments: ['sky'] },
  { index: 'goblin', name: 'Goblin', xp: 50, type: 'humanoid', subtype: 'tribe', challenge_rating: 0.25, environments: ['forest'] },
  { index: 'kobold', name: 'Kobold', xp: 250, type: 'humanoid', challenge_rating: 0.25, environments: ['underdark'] },
  { index: 'orc', name: 'Orc', xp: 100, type: 'humanoid', challenge_rating: 0.5, environments: ['hill'] },
  { index: 'rat', name: 'Rat', xp: 25, type: 'beast', challenge_rating: '1/8', environments: ['forest'] },
];

describe('filterMonsters', () => {
  it('matches name, type AND subtype case-insensitively from one query', () => {
    expect(filterMonsters(MONSTERS, { searchQuery: 'GOB' }).map(m => m.index)).toEqual(['goblin']);
    expect(filterMonsters(MONSTERS, { searchQuery: 'elemental' }).map(m => m.index)).toEqual(['cloud']);
    expect(filterMonsters(MONSTERS, { searchQuery: 'TRIB' }).map(m => m.index)).toEqual(['goblin']);
  });

  it('filters environment, type and size independently', () => {
    expect(filterMonsters(MONSTERS, { environmentFilter: 'underdark' }).map(m => m.index)).toEqual(['kobold']);
    expect(filterMonsters(MONSTERS, { typeFilter: 'Humanoid' }).map(m => m.index)).toEqual(['goblin', 'kobold', 'orc']);
    // Rows without an authored `size` are never excluded by the size filter
    // (data-side guard mirrored from the EB original).
    expect(filterMonsters(MONSTERS, { sizeFilter: 'small' }).map(m => m.index)).toEqual(MONSTERS.map(m => m.index));
  });

  it('parses fractional CR values on the DATA side and keeps bounds inclusive', () => {
    // Rat's challenge_rating is the string '1/8' → 0.125 for range math.
    expect(filterMonsters(MONSTERS, { crMin: '0.125', crMax: '0.125' }).map(m => m.index)).toEqual(['rat']);
    expect(filterMonsters(MONSTERS, { crMin: '0.25', crMax: 0.25 }).map(m => m.index)).toEqual(['goblin', 'kobold']);
  });

  it('excludes CR "None" rows from any CR-bounded query but keeps them unfiltered', () => {
    expect(filterMonsters(MONSTERS, { crMin: '0' }).map(m => m.index)).toEqual(['goblin', 'kobold', 'orc', 'rat']);
    expect(filterMonsters(MONSTERS, {}).map(m => m.index)).toContain('cloud');
  });

  it('returns [] for a missing bestiary (data still loading)', () => {
    expect(filterMonsters(null, { searchQuery: 'goblin' })).toEqual([]);
  });
});

describe('isBestiaryNarrowed', () => {
  it('whitespace-only search does not count as narrowed', () => {
    expect(isBestiaryNarrowed({ searchQuery: '   ' })).toBe(false);
    expect(isBestiaryNarrowed({ searchQuery: 'goblin' })).toBe(true);
  });

  it('any active filter narrows, including numeric-zero CR bounds', () => {
    expect(isBestiaryNarrowed({ type: 'beast' })).toBe(true);
    expect(isBestiaryNarrowed({ crMin: 0 })).toBe(true);
    expect(isBestiaryNarrowed({ crMin: '', crMax: '' })).toBe(false);
  });
});

describe('capBestiaryRows', () => {
  const many = Array.from({ length: BESTIARY_RENDER_CAP + 10 }, (_, i) => ({
    index: `m${i}`, name: `Monster ${i}`,
  }));

  it('un-narrowed oversized sets keep exactly the cap in sort order', () => {
    const kept = capBestiaryRows(many, [], false);
    expect(kept).toHaveLength(BESTIARY_RENDER_CAP);
    expect(kept.map(m => m.index)).toEqual(many.slice(0, BESTIARY_RENDER_CAP).map(m => m.index));
  });

  it('keeps every selected row visible beyond the cap (selection is never hidden)', () => {
    const tail = many[BESTIARY_RENDER_CAP + 5];
    const kept = capBestiaryRows(many, [tail], false);
    expect(kept).toHaveLength(BESTIARY_RENDER_CAP + 1);
    expect(kept).toContain(tail);
  });

  it('narrowed or short result sets pass through untouched', () => {
    expect(capBestiaryRows(many, [], true)).toBe(many);
    const short = many.slice(0, 5);
    expect(capBestiaryRows(short, [], false)).toBe(short);
  });
});

describe('compareMonsters', () => {
  it('sorts by name case-insensitively and honors direction', () => {
    const sorted = [...MONSTERS].sort((a, b) => compareMonsters(a, b, 'name', 'asc', []));
    expect(sorted.map(m => m.name)).toEqual(['Cloud', 'Goblin', 'Kobold', 'Orc', 'Rat']);
    const desc = [...MONSTERS].sort((a, b) => compareMonsters(a, b, 'name', 'desc', []));
    expect(desc[0].name).toBe('Rat');
  });

  it('the "sel" field floats selected rows to the front', () => {
    const sorted = [...MONSTERS].sort((a, b) => compareMonsters(a, b, 'sel', 'asc', [MONSTERS[4]]));
    expect(sorted[0].index).toBe('rat');
  });
});
