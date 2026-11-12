// gridInput.test.js — shared grid-size-field validation for the twin map
// generate modals (TE backlog 2026-11-12): the Terrain twin's silent clamp is
// retired in favour of the dungeon modal's block-with-inline-error law, with
// each modal keeping its own bounds (dungeon 7–100, terrain 30–100).

import { describe, it, expect } from 'vitest';
import { parseGridInput } from './gridInput.js';

const DUNGEON = [7, 100];
const TERRAIN = [30, 100];

describe('parseGridInput', () => {
  it.each([
    ['dungeon', ...DUNGEON],
    ['terrain', ...TERRAIN],
  ])('accepts integers inside the %s bounds (%i–%i) unclamped', (_label, min, max) => {
    for (const value of [min, max, Math.round((min + max) / 2)]) {
      expect(parseGridInput(value, min, max)).toEqual({ gridSize: value });
    }
  });

  it.each([
    ['below minimum', 6, ...DUNGEON],
    ['above maximum', 101, ...DUNGEON],
    ['cleared field reads 0', 0, ...DUNGEON],
    ['non-integer', 45.5, ...TERRAIN],
    ['below minimum', 29, ...TERRAIN],
    ['below minimum', 30 - 10, ...TERRAIN],
    ['above maximum', 101, ...TERRAIN],
    ['cleared field reads 0', 0, ...TERRAIN],
    ['NaN', Number.NaN, ...TERRAIN],
  ])('rejects %s (%s) for the [%i, %i] gate', (_label, value, min, max) => {
    expect(parseGridInput(value, min, max)).toEqual({
      error: `Grid size must be between ${min} and ${max}`,
    });
  });

  it('names the real bounds in the copy (dungeon never claims terrain\'s 30)', () => {
    expect(parseGridInput(5, ...DUNGEON).error).toBe('Grid size must be between 7 and 100');
    expect(parseGridInput(20, ...TERRAIN).error).toBe('Grid size must be between 30 and 100');
  });

  it('treats a numeric string like the number it parses to', () => {
    expect(parseGridInput('40', ...TERRAIN)).toEqual({ gridSize: 40 });
    expect(parseGridInput('20', ...TERRAIN)).toEqual({ error: 'Grid size must be between 30 and 100' });
  });
});
