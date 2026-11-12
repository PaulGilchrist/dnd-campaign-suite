// seedInput.test.js — shared seed-field parsing for the twin map generate
// modals (SD backlog 2026-11-12): a typed seed must be a real whole number;
// NaN from a bad parseInt used to flow into the generators and silently
// produce seed-0 maps stamped with seed:null on disk.

import { describe, it, expect } from 'vitest';
import { parseSeedInput, SEED_ERROR } from './seedInput.js';

describe('parseSeedInput', () => {
  it('empty/whitespace/missing input means random (seed: null, no error)', () => {
    for (const raw of ['', '   ', null, undefined]) {
      expect(parseSeedInput(raw)).toEqual({ seed: null });
    }
  });

  it.each([
    ['42', 42],
    ['0', 0],       // falsy string must NOT be dropped to random
    [' 7 ', 7],     // surrounding whitespace tolerated
    ['-5', -5],     // negative whole numbers drive mulberry32 deterministically
    ['1e3', 1000],
  ])('accepts "%s" as the whole number %i', (raw, expected) => {
    expect(parseSeedInput(raw)).toEqual({ seed: expected });
  });

  it.each(['abc', '4.5', '12abc', '1,000', 'Infinity', 'NaN', '-', '0xZZ'])(
    'rejects "%s" with the blocking inline error', (raw) => {
      expect(parseSeedInput(raw)).toEqual({ error: SEED_ERROR });
    }
  );

  it('uses plain-English copy consistent with the other modal gates', () => {
    expect(SEED_ERROR).toBe('Seed must be a whole number');
  });
});
