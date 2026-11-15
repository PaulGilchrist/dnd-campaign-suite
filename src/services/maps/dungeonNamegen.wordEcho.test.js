// @maintained-by-ai
// dungeonNamegen.wordEcho.test.js — dedupe pass for prefix/suffix word echoes.
//
// Premise (QA backlog 2026-11-03 CK): the pools overlap on whole words —
// prefix "Shadow" vs suffix "of Shadows", "Ancient" vs "of the Ancients",
// "Forgotten" vs "of the Forgotten King", "Dark" vs "of the Dark Lord" —
// so a raw draw could emit "The Shadow Temple of Shadows".
//
// Contract pinned here:
//  1. generateName never repeats the prefix word in the suffix slot
//     (case-insensitive, singular/plural-insensitive stem) — for historical
//     collision seeds AND across a 400-seed sweep.
//  2. Non-colliding seeds stay byte-identical to the pre-dedupe generator
//     (suffix drawn exactly once; no gratuitous reshuffle).
//  3. Determinism WITH dedupe: a collision re-rolls the suffix, and each
//     re-roll consumes exactly one extra draw from the same stream, so
//     seeded runs reproduce (proven by the scripted draw-count test).
//  4. Even under an adversarial rng that re-draws the echo forever, the
//     bounded re-roll loop falls through to the '' escape hatch — no echo
//     leaks, no unbounded draws.

import { describe, it, expect } from 'vitest';
import { mulberry32 } from './rng.js';
import { generateName } from './dungeonNamegen.js';

// Pool words duplicated verbatim here on purpose: this test is the tripwire
// against the pools drifting back into collision without a pinned seed
// noticing. wordStem mirrors the private helper in dungeonNamegen.js.
const PREFIXES = [
  'Ancient', 'Forgotten', 'Cursed', 'Haunted', 'Lost', 'Hidden',
  'Sunken', 'Crimson', 'Shadow', 'Iron', 'Crystal', 'Dark',
];
const TYPES = [
  'Dungeon', 'Crypt', 'Tomb', 'Catacombs', 'Keep', 'Tower',
  'Mines', 'Temple', 'Sanctum', 'Vault', 'Caverns', 'Hall',
];

const wordStem = (w) => w.toLowerCase().replace(/s$/, '');

// Parse "The <prefix> <type>[ <suffix>]" back into its slots. Prefix and type
// are single pool words, so they are matched against the known pools rather
// than guessed positionally. Returns { prefix, type, suffix }.
const splitName = (name) => {
  expect(name.startsWith('The ')).toBe(true);
  const rest = name.slice(4);
  const prefix = PREFIXES.find((p) => rest.startsWith(p + ' '));
  expect(prefix, `unknown prefix in "${name}"`).toBeTruthy();
  const afterPrefix = rest.slice(prefix.length + 1);
  const type = TYPES.find((t) => afterPrefix === t || afterPrefix.startsWith(t + ' '));
  expect(type, `unknown type in "${name}"`).toBeTruthy();
  return { prefix, type, suffix: afterPrefix.slice(type.length).trim() };
};

// True when any word of the suffix echoes the prefix by stem
// ("Shadow" vs "Shadows", "Ancient" vs "Ancients").
const echoesPrefix = (name) => {
  const { prefix, suffix } = splitName(name);
  const stem = wordStem(prefix);
  return suffix.split(' ').some((w) => wordStem(w) === stem);
};

// Scripted rng: values consumed one per draw; overrunning the script means
// the generator drew more than expected (proves bounded, exact draw counts).
const scripted = (values) => {
  const state = { i: 0 };
  state.rng = () => {
    const v = values[state.i];
    if (v === undefined) throw new Error(`extra RNG draw #${state.i + 1}`);
    state.i++;
    return v;
  };
  return state;
};

describe('dungeonNamegen — prefix/suffix word-echo dedupe', () => {
  it('forces the historical "Shadow…Shadows" echo: seed 57 re-rolls the suffix, prefix+type untouched', () => {
    // Pre-fix, mulberry32(57) emitted "The Shadow Tomb of Shadows".
    const name = generateName(mulberry32(57));
    expect(name).not.toBe('The Shadow Tomb of Shadows');
    const { prefix, type } = splitName(name);
    expect(prefix).toBe('Shadow'); // only the colliding suffix got re-rolled
    expect(type).toBe('Tomb');
    expect(echoesPrefix(name)).toBe(false);
  });

  it('non-colliding seeds keep their exact pre-dedupe bytes (one suffix draw, no reshuffle)', () => {
    // Byte-identical snapshots taken from the pre-fix generator.
    expect(generateName(mulberry32(42))).toBe('The Crimson Tower of Eternal Night');
    expect(generateName(mulberry32(0))).toBe('The Haunted Dungeon of the Dead');
    expect(generateName(mulberry32(1))).toBe('The Crimson Dungeon of Whispers');
    expect(generateName(mulberry32(7))).toBe('The Ancient Dungeon'); // '' suffix leg
    expect(generateName(mulberry32(100))).toBe('The Cursed Catacombs of Whispers');
    expect(generateName(mulberry32(123))).toBe('The Iron Tomb of the Ancients');
  });

  it('re-roll consumes exactly the next draw, and endless collisions fall through to the escape hatch', () => {
    // pick(arr, rng) = arr[floor(rng()*len)]. Scripted values force the exact
    // old echo path: 'Shadow' (idx 8/12) + 'Temple' (idx 7/12) + 'of Shadows'
    // (idx 1/10) — the pre-fix "The Shadow Temple of Shadows".
    // Re-roll draw lands on 'of Doom' (idx 0/10): 4 draws total, no echo.
    let s = scripted([0.7, 0.625, 0.15, 0.05]);
    expect(generateName(s.rng)).toBe('The Shadow Temple of Doom');
    expect(s.i).toBe(4); // exactly one extra draw consumed by the re-roll
    // Re-roll draw lands on '' (idx 9/10): bare "The Shadow Temple".
    s = scripted([0.7, 0.625, 0.15, 0.95]);
    expect(generateName(s.rng)).toBe('The Shadow Temple');
    expect(s.i).toBe(4);
    // Non-colliding suffix: still exactly 3 draws (pre-dedupe plumbing intact).
    s = scripted([0.7, 0.625, 0.05]);
    expect(generateName(s.rng)).toBe('The Shadow Temple of Doom');
    expect(s.i).toBe(3);
    // Adversarial rng: every suffix draw re-lands on 'of Shadows' (idx 1/10).
    // The loop is bounded at 1 initial + 10 re-rolls, then the '' escape
    // hatch fires — 13 draws total, no echo, no infinite stream.
    s = scripted([0.7, 0.625, ...Array(11).fill(0.15)]);
    expect(generateName(s.rng)).toBe('The Shadow Temple');
    expect(s.i).toBe(13);
  });

  it('sweep: 400 seeds (superset of the historical collision seeds 19/23/57/62/65/87/104/144/218/220/268) produce zero word-echo names, all parsing into known prefix+type slots', () => {
    for (let seed = 0; seed < 400; seed++) {
      const name = generateName(mulberry32(seed));
      // splitName inside echoesPrefix also pins the "The <prefix> <type>" shape.
      expect(echoesPrefix(name), `seed ${seed} -> "${name}"`).toBe(false);
    }
  });
});
