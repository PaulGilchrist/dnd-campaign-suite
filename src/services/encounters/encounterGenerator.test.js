// @maintained-by-ai
import { describe, it, expect, afterEach } from 'vitest';
import {
  generateEncounterSuggestions,
  calculateXPThreshold,
  calculateDifficultyMultiplier,
  getDifficultyLabel,
} from './encounterGenerator.js';

// LANE: GENERATION — picks anchor monsters + quantities from a pool by CR band and XP budget.
// Other lanes live elsewhere and are NOT re-tested here:
//   autoEncounterService.test.js  → #1073 trigger lane        | encountersService.test.js → CRUD lane
//   monsterSummon/monsterRecharge → spawn-time bytes          | EncounterGeneratorModal/EncounterBuilder → UI wiring (generator mocked there)
//   encounterConfig.test.js       → config table contract only (it defers behavior to this file)
// RNG SEAM (#1072 discipline): the generator consumes Math.random directly (never diceRoller — no
// stub fidelity duty). Every generation pins an exact hand-derived sequence and consumed count;
// over-consumption throws. Output bytes are hand-derived once and never re-run as oracle (#815/#710).
// Fixtures are verbatim-trimmed public/data/monsters.json rows (#993/#967): names, CR strings,
// XP, environments and ally lists match the real bestiary data.
//
// old → new map (25 → 8 definitions):
//   4× calculateXPThreshold its          → it.each boundary table (exact near-miss at level 21, #943)
//   8× calculateDifficultyMultiplier its → it.each ratio boundary census incl. zero-party guards (#936/#943)
//   5× getDifficultyLabel its            → it.each ratio boundary census incl. multiplier-fold rows (#936)
//   empty pool + env-mismatch + weak isArray edges → honest-empty it.each with zero-RNG-consumed proof (#945)
//   suggestion-structure loop checks + high-level/uneven-party isArray checks → byte-exact flagship + fallback tests
//   count/env-filter/allies/difficulty-rank its   → byte-exact flagship, allies, and truncate tests

// Verbatim-trimmed rows from public/data/monsters.json (fields the generator consumes).
const goblin = {
  index: 'goblin', name: 'Goblin', challenge_rating: '0.25', xp: 50,
  environments: ['forest', 'grassland', 'hill', 'underdark'],
  allies: ['bugbear', 'dire wolf', 'giant rat', 'hobgoblin', 'rat'],
};
const orc = {
  index: 'orc', name: 'Orc', challenge_rating: '0.5', xp: 100,
  environments: ['arctic', 'forest', 'grassland', 'hill'],
  allies: [],
};
const bugbear = {
  index: 'bugbear', name: 'Bugbear', challenge_rating: '1', xp: 200,
  environments: ['forest', 'grassland', 'underdark'],
  allies: [],
};
const ogre = {
  index: 'ogre', name: 'Ogre', challenge_rating: '2', xp: 450,
  environments: ['mountain'],
  allies: [],
};
const troll = {
  index: 'troll', name: 'Troll', challenge_rating: '5', xp: 1800,
  environments: ['mountain'],
  allies: [],
};

const realRandom = Math.random;

// #1072: hand-derived exact sequence, consumed-count pin, throw on over-consume.
function controlRandom(sequence) {
  const seq = [...sequence];
  const rng = { consumed: 0 };
  Math.random = () => {
    rng.consumed += 1;
    if (seq.length === 0) {
      throw new Error(`encounterGenerator over-consumed Math.random (call #${rng.consumed}); sequence exhausted`);
    }
    return seq.shift();
  };
  return rng;
}

afterEach(() => {
  Math.random = realRandom;
});

describe('calculateXPThreshold', () => {
  it.each([
    [[1, 2], 1, 150],   // level 1 (50) + level 2 (100), Medium column
    [[], 1, 0],        // empty party → zero budget
    [[5, 'bad'], 0, 250], // 'bad' skipped; level 5 Easy = 250
    [[0], 1, 25],      // level 0 lower table bound, inclusive
    [[20], 1, 5700],   // level 20 upper table bound, inclusive
    [[21], 2, 0],      // exact near-miss just above the table → contributes 0
  ])('levels %j at difficulty %i budget %i XP', (levels, difficulty, expected) => {
    expect(calculateXPThreshold(levels, difficulty)).toBe(expected);
  });
});

describe('calculateDifficultyMultiplier', () => {
  it.each([
    // exact ratio boundary and just-above near-miss for every config band (#943)
    [2, 4, 1],    // ratio 0.5 exact → ×1
    [3, 4, 1.5],  // 0.75 just over 0.5 → ×1.5
    [1, 1, 1.5],  // ratio 1 exact → ×1.5
    [4, 3, 2],    // 1.33 just over 1 → ×2
    [2, 1, 2],    // ratio 2 exact → ×2
    [7, 3, 2.5],  // 2.33 just over 2 → ×2.5
    [3, 1, 2.5],  // ratio 3 exact → ×2.5
    [10, 3, 3],   // 3.33 just over 3 → ×3
    [4, 1, 3],    // ratio 4 exact → ×3
    [20, 3, 4],   // swarm, past the last finite band → ×4 cap
    [2, 0, 2],    // zero party size treated as 1 (ratio 2 → ×2)
    [0, 0, 1],    // zero monsters over zero party → ratio 0 → ×1
  ])('%i monsters vs party of %i → ×%i', (monsterCount, partySize, expected) => {
    expect(calculateDifficultyMultiplier(monsterCount, partySize)).toBe(expected);
  });
});

describe('getDifficultyLabel', () => {
  it.each([
    // effective XP = totalXP × multiplier; thresholds are ratio boundaries (#943)
    [49, 1, 100, 4, 'Easy'],   // ×1, ratio 0.49 just under easyMax
    [50, 1, 100, 4, 'Medium'], // ratio 0.5 exact → Medium
    [100, 1, 100, 4, 'Hard'],  // ratio 1.0 exact → Hard
    [150, 1, 100, 4, 'Deadly'], // ratio 1.5 exact → Deadly
    [99, 3, 100, 4, 'Hard'],   // ×1.5 → eff 148.5, near-miss below Deadly
    [60, 4, 100, 2, 'Hard'],   // raw 0.6 would be Medium; ×2 multiplier lifts to Hard
  ])('totalXP %i / %i monsters vs threshold %i (party %i) → %s', (totalXP, monsterCount, threshold, partySize, expected) => {
    expect(getDifficultyLabel(totalXP, monsterCount, threshold, partySize)).toBe(expected);
  });
});

describe('generateEncounterSuggestions', () => {
  it.each([
    ['an empty monster pool', { monsters: [], playerLevels: [1, 1, 1, 1], difficulty: 1, environments: ['forest'] }],
    ['no monster in the requested environment', { monsters: [goblin], playerLevels: [1, 1, 1, 1], difficulty: 1, environments: ['desert'] }],
    ['an empty party', { monsters: [goblin], playerLevels: [], difficulty: 1, environments: ['forest'] }],
  ])('returns exactly [] with zero RNG consumed for %s (#945)', (_label, params) => {
    const rng = controlRandom([]); // any RNG call throws
    expect(generateEncounterSuggestions(params)).toEqual([]);
    expect(rng.consumed).toBe(0);
  });

  it('builds byte-exact suggestions for a 2-monster forest party of 4 at Hard target, reproducible on the same RNG sequence', () => {
    // Hand-derived once (#815): party of 4 level 1 → Hard threshold 300, deadly safety cap 400×1.5=600.
    // Goblin (CR 0.25, 50 XP) fills qty 4 → eff 200×1.5=300 → Hard.
    // Orc (CR 0.5, 100 XP) fills qty 4 → eff 400×1.5=600 → Deadly.
    // RNG: 1 call shuffling candidates (0.4 → j=0 swaps [goblin,orc] → [orc,goblin]) + Goblin's
    // verbatim 5-ally shuffle (4 calls; none resolve — the pool has only goblin+orc, all skipped);
    // sort resolves on distance-to-target (Hard 0 < Deadly 1) without consuming RNG. Total 5.
    const params = { monsters: [goblin, orc], playerLevels: [1, 1, 1, 1], difficulty: 2, environments: ['forest'] };
    const expected = [
      { monsters: [{ ...goblin, qty: 4 }], totalXP: 200, monsterCount: 4, difficultyLabel: 'Hard', anchorIndex: 'goblin' },
      { monsters: [{ ...orc, qty: 4 }], totalXP: 400, monsterCount: 4, difficultyLabel: 'Deadly', anchorIndex: 'orc' },
    ];

    const first = controlRandom([0.4, 0.05, 0.3, 0.9, 0.1]);
    const run1 = generateEncounterSuggestions(params); // default count 3 → both anchors
    expect(run1).toEqual(expected);
    expect(first.consumed).toBe(5);

    const second = controlRandom([0.4, 0.05, 0.3, 0.9, 0.1]);
    expect(generateEncounterSuggestions(params)).toEqual(run1); // same sequence → same bytes (#1057)
    expect(second.consumed).toBe(5);
  });

  it('attaches only pool-resolvable allies and trims/quantities to budget, byte-exact over a fixed 5-call sequence', () => {
    // Party of 4 level 1, difficulty Hard (threshold 300, safety cap 600), count 2.
    // Goblin's verbatim ally list: bugbear resolves (in pool); dire wolf/giant rat/hobgoblin/rat
    // are absent from the pool and skipped — allies outside eligible never appear.
    // RNG: 1 candidate shuffle + 4 ally-shuffle calls (5 of length 5) = 5; sort never reaches RNG
    // (Bugbear Hard, dist 0 vs Goblin Deadly, dist 1).
    const params = { monsters: [goblin, bugbear], playerLevels: [1, 1, 1, 1], difficulty: 2, environments: ['forest'], count: 2 };
    const rng = controlRandom([0.2, 0.05, 0.3, 0.9, 0.1]);
    const result = generateEncounterSuggestions(params);

    // Anchors processed shuffled order [bugbear, goblin] (0.2 → j=0 swaps the pair); goblin keeps qty 3
    // + bugbear qty 1 (350 XP; a 2nd bugbear would push eff 525→750 past the 600 cap; qty 3 lands eff 525 ≤ 600).
    // Bugbear anchor inflates alone to qty 2 → eff 400 → Hard, and sorts first (exact target match).
    expect(result).toEqual([
      { monsters: [{ ...bugbear, qty: 2 }], totalXP: 400, monsterCount: 2, difficultyLabel: 'Hard', anchorIndex: 'bugbear' },
      { monsters: [{ ...goblin, qty: 3 }, { ...bugbear, qty: 1 }], totalXP: 350, monsterCount: 4, difficultyLabel: 'Deadly', anchorIndex: 'goblin' },
    ]);
    expect(rng.consumed).toBe(5);
  });

  it('truncates to count 1 and ranks the suggestion closest to the target difficulty, byte-exact', () => {
    // Same pool/sequence as the flagship: candidates shuffle + Goblin's unresolvable ally shuffle
    // consume 5 calls; both anchors build, but only the Hard goblin suggestion
    // (dist 0 to target) survives slice(0, 1).
    const rng = controlRandom([0.4, 0.05, 0.3, 0.9, 0.1]);
    const result = generateEncounterSuggestions({
      monsters: [goblin, orc],
      playerLevels: [1, 1, 1, 1],
      difficulty: 2,
      environments: ['forest'],
      count: 1,
    });
    expect(result).toEqual([
      { monsters: [{ ...goblin, qty: 4 }], totalXP: 200, monsterCount: 4, difficultyLabel: 'Hard', anchorIndex: 'goblin' },
    ]);
    expect(rng.consumed).toBe(5);
  });

  it('falls back to the lowest-CR eligible monsters when the CR band is empty and stays safely over-budget with zero RNG consumed', () => {
    // Party of 2 level 1 → CR band [0.125, 1] excludes Ogre (2) and Troll (5).
    // Fallback keeps CR ≤ lowest+1 → Ogre only. Safety cap (200×1.5=300) blocks any quantity
    // increase, so the suggestion honestly returns the 450-XP single ogre (Deadly, over threshold 100).
    // Zero-length candidates-1 shuffle and 1-element sort consume no RNG.
    const rng = controlRandom([]); // any RNG call throws
    const result = generateEncounterSuggestions({
      monsters: [ogre, troll],
      playerLevels: [1, 1],
      difficulty: 1,
      environments: ['mountain'],
    });
    expect(result).toEqual([
      { monsters: [{ ...ogre, qty: 1 }], totalXP: 450, monsterCount: 1, difficultyLabel: 'Deadly', anchorIndex: 'ogre' },
    ]);
    expect(rng.consumed).toBe(0);
  });
});
