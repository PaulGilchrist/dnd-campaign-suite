// @improved-by-ai
// MA-0038 unit tests — resolveConcentrationRoll: te-driven concentration
// disadvantage (Adult Black Dragon's Cloud of Insects failed-save clause).
//
// Mock boundaries (true seams only, mirroring ConcentrationPromptModal.test.jsx):
// - dice: deterministic queued values via rollD20; the queue throws if the
//   function reaches for a die the test never staged, so the exact die count
//   is pinned (alongside each test's rawRolls assertion), never NaN-silent.
// - runtime store: getRuntimeValue; its targetEffects array is the only
//   source of te data. The REAL selectors — getActiveTargetEffect,
//   getHolyAuraSaveAdvantage, hasSaveModifier, getAbilitySaveBonus — run
//   against realistic character shapes: te target-matching and save-bonus
//   arithmetic are production behavior, never encoded into stubs.
//
// Covered elsewhere, not repeated here:
// - Modal queue / dismissal / submission contract: ConcentrationPromptModal.test.jsx
// - Holy Aura advantage end-to-end and advantage-vs-breaker offsets:
//   ConcentrationPromptModal.holy-aura.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Te data lives in the campaign runtime store — the single source of truth
// the real getActiveTargetEffect / getHolyAuraSaveAdvantage read through.
let targetEffects = [];
let diceQueue = [];

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (_key, propertyName) => (propertyName === 'targetEffects' ? targetEffects : null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: () => {
    if (diceQueue.length === 0) {
      throw new Error('rollD20 called with an empty dice queue — test staged too few dice');
    }
    return diceQueue.shift();
  },
}));

import { resolveConcentrationRoll } from './concentrationPromptRoll.js';

const CAMPAIGN = 'test-campaign';
const TARGET = 'AberrantSorcerer';
const BREAKER = 'Adult Black Dragon 1';

// Prompt: Haste concentration save, DC 13, forced by the dragon.
const current = { targetName: TARGET, spellName: 'Haste', dc: 13, attackerName: BREAKER };

// Real getAbilitySaveBonus shape: save (+3) must win over raw bonus (+2),
// proving totals here flow through the real selector, not a pinned number.
const roller = {
  name: TARGET,
  computedStats: { abilities: [{ name: 'Constitution', bonus: 2, save: 3 }] },
};

function runRoll(characters = [roller], auraBonus = 0) {
  return resolveConcentrationRoll({ current, characters, campaignName: CAMPAIGN, auraBonus, auraSourceName: undefined });
}

beforeEach(() => {
  targetEffects = [];
  diceQueue = [];
});

describe('resolveConcentrationRoll — concentration_disadvantage te (MA-0038)', () => {
  it('rolls 2d20 keep-low attributed to the te action and breaks the save below DC', () => {
    targetEffects = [{ target: TARGET, effect: 'concentration_disadvantage', source: BREAKER, actionName: 'Cloud of Insects' }];
    diceQueue = [17, 4];

    const r = runRoll();

    expect(r.rawRolls).toEqual([17, 4]);
    expect(r.roll).toBe(4);
    expect(r.saveBonus).toBe(3);
    expect(r.total).toBe(7); // 4 + CON save +3
    expect(r.success).toBe(false); // 7 < DC 13 — the clause is what makes this fail
    expect(r.mode).toBe('disadvantage');
    expect(r.disadvantageSource).toBe('Cloud of Insects');
    expect(r.advantageSources).toEqual([]);
  });

  it('attributes to te.source when the te records no actionName, succeeding exactly at the DC boundary', () => {
    targetEffects = [{ target: TARGET, effect: 'concentration_disadvantage', source: BREAKER }];
    diceQueue = [17, 10];

    const r = runRoll();

    expect(r.roll).toBe(10); // keep-low
    expect(r.total).toBe(13);
    expect(r.success).toBe(true); // boundary is inclusive: 13 vs DC 13
    expect(r.mode).toBe('disadvantage');
    expect(r.disadvantageSource).toBe(BREAKER);
  });

  it('offsets into a single plain d20 when the roller carries holy_aura advantage and the te (RAW)', () => {
    targetEffects = [
      { target: TARGET, effect: 'concentration_disadvantage', source: BREAKER, actionName: 'Cloud of Insects' },
      { target: TARGET, effect: 'holy_aura', source: 'Cleric 1' },
    ];
    diceQueue = [7];

    const r = runRoll();

    expect(r.rawRolls).toEqual([7]);
    expect(r.roll).toBe(7);
    expect(r.mode).toBe('normal');
    expect(r.advantageSources).toEqual(['Holy Aura']);
    // Attribution survives the RAW offset so downstream logs can still name
    // the clause — the mode, not the source field, is what changes.
    expect(r.disadvantageSource).toBe('Cloud of Insects');
  });

  it('ignores a concentration_disadvantage te carried by a different creature', () => {
    targetEffects = [{ target: 'Goblin 1', effect: 'concentration_disadvantage', source: BREAKER, actionName: 'Cloud of Insects' }];
    diceQueue = [15];

    const r = runRoll();

    expect(r.rawRolls).toEqual([15]);
    expect(r.mode).toBe('normal');
    expect(r.disadvantageSource).toBeNull();
    expect(r.total).toBe(18);
    expect(r.success).toBe(true);
  });

  it('leaves a plain single d20 when the store holds no te at all', () => {
    diceQueue = [11];

    const r = runRoll();

    expect(r.rawRolls).toEqual([11]);
    expect(r.roll).toBe(11);
    expect(r.total).toBe(14);
    expect(r.success).toBe(true);
    expect(r.mode).toBe('normal');
    expect(r.advantageSources).toEqual([]);
    expect(r.disadvantageSource).toBeNull();
    expect(r.bonusDetail).toBeUndefined();
  });

  it('floors the te keep-low die to 10 under Starry Form (Dragon)', () => {
    targetEffects = [{ target: TARGET, effect: 'concentration_disadvantage', source: BREAKER, actionName: 'Cloud of Insects' }];
    diceQueue = [17, 4];
    const starryRoller = {
      ...roller,
      saveModifiers: [{ source: 'Starry Form', target: 'ability_check', effect: 'bonus', abilities: ['Constitution'] }],
      activeBuffs: [{ name: 'Starry Form', constellation: 'Dragon' }],
    };

    const r = runRoll([starryRoller]);

    expect(r.rawRolls).toEqual([17, 4]); // pre-floor dice still reported
    expect(r.roll).toBe(10); // floor applies after keep-low
    expect(r.total).toBe(13); // 10 + CON save +3 — exactly meets DC
    expect(r.success).toBe(true);
    expect(r.mode).toBe('disadvantage');
    expect(r.disadvantageSource).toBe('Cloud of Insects');
  });
});
