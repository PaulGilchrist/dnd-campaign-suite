// Encounter Builder Configuration
// Adjust these values to tune encounter difficulty calculations.
// See https://paulgilchrist.github.io/dnd-tools for reference tables.

export const ENCOUNTER_CONFIG = {

   // ---------------------------------------------------------------------------
   //  XP Thresholds
   //  The base XP budget for a party at each level, indexed by [level][difficulty].
   //  Difficulty index: 0=Easy, 1=Medium, 2=Hard, 3=Deadly.
   //  Higher values make encounters harder; lower values make them easier.
   //  These are lookups before applying the monster-count multiplier below.
   // ---------------------------------------------------------------------------
  xpThresholds: [
     [15, 25, 40, 50],   [25, 50, 75, 100],    [50, 100, 150, 200],
     [75, 150, 225, 400],[125, 250, 375, 500], [250, 500, 750, 1100],
     [300, 600, 900, 1400],[350, 750, 1100, 1700],[450, 900, 1400, 2100],
     [550, 1100, 1600, 2400],[600, 1200, 1900, 2800],[800, 1600, 2400, 3600],
     [1000, 2000, 3000, 4500],[1100, 2200, 3400, 5100],[1250, 2500, 3800, 5700],
     [1400, 2800, 4300, 6400],[1600, 3200, 4800, 7200],[2000, 3900, 5900, 8800],
     [2100, 4200, 6300, 9500],[2400, 4900, 7300, 10900],[2800, 5700, 8500, 12700],
   ],

   // ---------------------------------------------------------------------------
   //  Default Difficulty
   //  The difficulty index (0=Easy, 1=Medium, 2=Hard, 3=Deadly) used when the
   //  user does not specify one. Higher = more challenging encounters by default.
   // ---------------------------------------------------------------------------
  defaultDifficulty: 1,

    // ---------------------------------------------------------------------------
    //  Difficulty Multiplier (Ratio-Based)
    //  Instead of raw monster count, the multiplier is based on the ratio of
    //  monsters to party members (monsterCount / partySize). This scales fairly
    //  regardless of party size — a fight that's "2 monsters per adventurer" is
    //  equally punishing for a party of 4 or 6.
    //
    //  Effective XP = totalMonsterXP / multiplier. If effectiveXP >= the threshold,
    //  the encounter meets that difficulty. See DMG p.82 for the raw-count table.
    //
    //  Common ratios:
    //    ≤0.5  — Few monsters, party can focus-fire easily             ×1
    //    0.5-1   — Approaching one-per-adventurer                      ×1.5
    //    1-2     — One to two monsters per adventurer, solid challenge ×2
    //    2-3     — Two+ monsters per adventurer, significant threat    ×2.5
    //    3-4     — Three+ per adventurer, major engagement             ×3
    //    4+      — Swarm conditions                                  ×4
    //
    //  To make multi-monster fights less punishing, reduce the higher-range
    //  multipliers. To penalize parties for facing swarms more harshly,
    //  raise the ceiling multiplier above 4.
    // ---------------------------------------------------------------------------
  difficultyMultipliers: [
      { ratioMax: 0.5, multiplier: 1 },         // Few monsters relative to party
      { ratioMax: 1, multiplier: 1.5 },        // Approaching even odds
      { ratioMax: 2, multiplier: 2 },          // Up to 2× as many monsters as adventurers
      { ratioMax: 3, multiplier: 2.5 },        // Significant numerical advantage for enemies
      { ratioMax: 4, multiplier: 3 },          // Major enemy advantage
      { ratioMax: Infinity, multiplier: 4 }    // Swarm — maximum adjustment
    ],

   // ---------------------------------------------------------------------------
   //  CR Range
   //  When selecting candidate monsters, their challenge rating must fall within
   //  this range relative to the average party level:
   //    minCR = avgLevel * minMultiplier  (default 0.125 → CR 1/8 for level 1)
   //    maxCR = avgLevel                  (or minCR + minGap, whichever is greater)
   //
   //  Widening the range includes more monster options but may produce less precise
   //  encounters. Narrowing it tightens suggestions but risks running out of options.
   // ---------------------------------------------------------------------------
  crRange: {
    minMultiplier: 0.125,
    minGap: 0.25,
   },

   // ---------------------------------------------------------------------------
   //  Budget Tolerance
   //  When building a suggestion, the total XP can exceed the target by this factor
   //  (times targetRawXP) before monsters are removed. A value of 1.1 allows
   //  up to 10% over budget. Lower = tighter fits; higher = more forgiving trims.
   // ---------------------------------------------------------------------------
  budgetTolerance: 1.1,

   // ---------------------------------------------------------------------------
   //  Deadly Safety Cap
   //  During iterative quantity increases, a suggestion is abandoned if its
   //  effective XP exceeds deadlyThreshold * deadlyMultiplier. This prevents
   //  suggestions from becoming absurdly lethal. Raising this allows more
   //  over-level encounters; lowering it keeps suggestions conservative.
   // ---------------------------------------------------------------------------
  deadlyMultiplier: 1.5,

   // ---------------------------------------------------------------------------
   //  Difficulty Ratios
   //  After dividing totalMonsterXP by the multiplier, the label is determined by
   //  the ratio of effectiveXP to the medium threshold for the party's levels.
   //
   //    Easy:    ratio < easyMax       (default < 0.5)
   //    Medium:  easyMax <= ratio < mediumMax  (0.5 - 0.99)
   //    Hard:    mediumMax <= ratio < hardMax  (1.0 - 1.49)
   //    Deadly:  ratio >= hardMax              (>= 1.5)
   //
   //  Shifting these boundaries changes when an encounter transitions between labels,
   //  without affecting the raw XP math. Wider gaps = more encounters fall in one band.
   // ---------------------------------------------------------------------------
  difficultyRatios: {
    easyMax: 0.5,
    mediumMax: 1,
    hardMax: 1.5,
   },

   // ---------------------------------------------------------------------------
   //  Suggestion Count
   //  Number of encounter suggestions returned to the user. The engine builds up
   //  to suggestionCount * suggestionOvergenerate candidates, ranks them by how
   //  closely they match the target difficulty, then returns the top N results.
   //  Increasing overgenerate improves quality at the cost of CPU time.
   // ---------------------------------------------------------------------------
  defaultSuggestionCount: 3,
  suggestionOvergenerate: 2,
};
