// @maintained-by-ai
// featBuffService.applyFeatBuffsToFormData.test.js — LANE #1/9 of the featBuffService
// nine-lane cluster (queue #2016-2024). Subject: src/services/character/featBuffService.js (662 l).
//
// NINE-LANE SEAM MAP — canonical homes per export (featBuffService.js):
//   #2016 applyFeatBuffsToFormData (THIS LANE)        — form-data WRITER: computes via
//         computeAllFeatBuffs, then MUTATES formData in place (adds to
//         abilities[].featIncrease; mergeDeduplicated-append onto formData.resistances;
//         NOTHING else is written) and RETURNS the raw buffs object (not formData).
//         Non-idempotent: apply twice doubles featIncrease; clearAppliedFeatBuffs resets.
//   #2017 clearAppliedFeatBuffs                         — form-data RESET: featIncrease=0 on
//         every ability. The sole undo-seam for this lane's additive writes.
//   #2018 computeAllFeatBuffs.2024                     — aggregate (pure), 2024 structured path
//   #2019 computeAllFeatBuffs.5e                       — aggregate (pure), 5e text path
//   #2020 computeAllFeatBuffs.edge-cases             — aggregate null/undefined tolerance
//   #2021 computeAllFeatBuffs.resilient              — aggregate saveType resolution via
//         resolveFeatChosenAbility (NOTE: mutates SPA-cached feats.json rows in place,
//         L626-627 — see test-setup-playbook.md:357)
//   #2022 computeFeatBuffs.2024                        — single-feat parser, structured benefits
//   #2023 computeFeatBuffs.5e                          — single-feat parser, first-match-wins
//         text rules (BENEFIT_TEXT_RULES_5E, L95-109) with 'Passive Benefit' fallback
//   #2024 ritualMaster                                 — specific feat: ritual_spells automation
//         threading (+ rules.js collect into ritualSpells bucket)
//
// THIS LANE CONTRACT (pinned below):
//   - formData = wizard character-creation/edit form state (caller-owned React state,
//     e.g. useWizardFeatBuffs / WizardStepAbilities). NOT the runtime store. The
//     localStorage ban in AGENTS.md targets GAME state (HP, conditions, buffs, pipeline);
//     verified: featBuffService touches NO storage at all — the only wizard localStorage
//     use is the `_background_abilities_<bg>` creation-draft key (useWizardBackgroundAbility.js),
//     a pre-persistence form draft, not final character data.
//   - Merge-vs-replace: resistances APPEND-merge case-insensitively via the REAL
//     buffApplier.mergeDeduplicated (unit-canonical-home: buffApplier.test.js; here we
//     pin actual post-state through the apply wrapper, not delegation to a mock).
//   - feats are resolved through findFeat (mocked input seam) — no claims about disk
//     public/data/feats.json rows here; disk-verbatim rows live in the compute lanes.
//
// LIVENESS FLAG (verified by repo-wide grep, 2026-10-16): applyFeatBuffsToFormData has
// ZERO production callers — live wizard lanes are computeAllFeatBuffs + useWizardFeatBuffs'
// own clearBuffs/applyBuffs (useWizardFeatBuffs.js:83-87) and rules.js:255. Same for
// clearAppliedFeatBuffs (#2017) and shared applyAbilityScoreIncreases. This lane pins the
// legacy writer contract for whatever caller revives it; flagged to parent for trim decision.
//
// Anti-pattern hygiene: exact assertions only (no toBeDefined), no timers, no vacuous
// loops, no fabricated disk rows (findFeat fully mocked).

import { describe, it, expect, vi, afterEach } from 'vitest';

import { findFeat } from '../shared/featFinder.js';
import { applyFeatBuffsToFormData } from './featBuffService.js';

vi.mock('../shared/featFinder.js', () => ({
  findFeat: vi.fn(),
}));
// buffApplier is intentionally NOT mocked: mergeDeduplicated is exercised for real so
// resistance semantics are actual post-states (merge-append + case-insensitive dedup),
// not mock-call echoes. Its unit canon lives in shared/buffApplier.test.js.

afterEach(() => {
  vi.clearAllMocks();
});

describe('applyFeatBuffsToFormData', () => {
  const makeFormData = (overrides = {}) => ({
    rules: '5e',
    feats: ['Tough'],
    abilities: [
      { name: 'Strength', featIncrease: 0 },
      { name: 'Dexterity', featIncrease: 0 },
      { name: 'Constitution', featIncrease: 0 },
    ],
    ...overrides,
  });

  describe('side effects on formData (mutated in place)', () => {
    it('applies non-choice ability score increases to matching abilities in formData', () => {

      const formData = makeFormData();

      findFeat.mockReturnValue({
        name: 'Test feat',
        benefits: ['Increase your Strength score by 2'],
      });

      applyFeatBuffsToFormData(formData, []);

      expect(formData.abilities[0].featIncrease).toBe(2);
      expect(formData.abilities[1].featIncrease).toBe(0);
      expect(formData.abilities[2].featIncrease).toBe(0);
    });

    it('accumulates ability score increases when multiple feats affect the same ability', () => {

      const formData = makeFormData({
        feats: ['Feat A', 'Feat B'],
      });

      findFeat
        .mockReturnValueOnce({
          name: 'Feat A',
          benefits: ['Increase your Strength score by 2'],
        })
        .mockReturnValueOnce({
          name: 'Feat B',
          benefits: ['Increase your Strength score by 1'],
        });

      applyFeatBuffsToFormData(formData, []);

      expect(formData.abilities[0].featIncrease).toBe(3);
    });

    it('matches ability names case-insensitively', () => {

      const formData = makeFormData({
        abilities: [{ name: 'strength', featIncrease: 0 }],
      });

      findFeat.mockReturnValue({
        name: 'Test feat',
        benefits: ['Increase your Strength score by 2'],
      });

      applyFeatBuffsToFormData(formData, []);

      expect(formData.abilities[0].featIncrease).toBe(2);
    });

    it('applies BOTH sides of an "or" increase pair — apply filter excludes only name "any"', () => {

      // 'or'-text parses to TWO named increases (pushAbilityOrIncrease, featBuffService.js:43);
      // the apply filter excludes only name === 'any', so BOTH abilities receive the bump.
      // Pinned as--is: if choice handling is added, this must change with it.
      const formData = makeFormData();

      findFeat.mockReturnValue({
        name: 'Modifier feat',
        benefits: ['Increase your Strength or Dexterity score by 1'],
      });

      applyFeatBuffsToFormData(formData, []);

      expect(formData.abilities[0].featIncrease).toBe(1);
      expect(formData.abilities[1].featIncrease).toBe(1);
      expect(formData.abilities[2].featIncrease).toBe(0);
    });

    it('appends parsed resistances onto existing ones without replacing (real mergeDeduplicated)', () => {

      const formData = makeFormData({ resistances: ['cold', 'FIRE'] });

      findFeat.mockReturnValue({
        name: 'Elemental feat',
        benefits: [
          'You have resistance to fire',
          'You have resistance to Cold',
          'You have resistance to poison',
        ],
      });

      applyFeatBuffsToFormData(formData, []);

      // 'fire'/'Cold' dedup case-insensitively against existing entries (first-occurrence
      // casing preserved); 'poison' appends. Merge-append, never replace.
      expect(formData.resistances).toEqual(['cold', 'FIRE', 'poison']);
    });

    it('does not crash when formData has no abilities array', () => {

      const formData = {
        rules: '5e',
        feats: ['Tough'],
      };

      findFeat.mockReturnValue({
        name: 'Test feat',
        benefits: ['Increase your Strength score by 2'],
      });

      expect(() => applyFeatBuffsToFormData(formData, [])).not.toThrow();
      expect(formData.abilities).toBeUndefined();
    });

    it('skips choice/any ability score increases when applying side effects to formData', () => {

      const formData = makeFormData();

      findFeat.mockReturnValue({
        name: 'Skill feat',
        benefits: ['Choose one ability score. Increase the chosen ability score by 2'],
      });

      applyFeatBuffsToFormData(formData, []);

      expect(formData.abilities.every(a => a.featIncrease === 0)).toBe(true);
    });

    it('writes only abilities[].featIncrease and resistances — never proficiencies/features keys', () => {

      const formData = makeFormData();

      findFeat.mockReturnValue({
        name: 'Mixed feat',
        benefits: [
          'Increase your Strength score by 2',
          'You gain proficiency with heavy armor',
          'You have resistance to fire',
          'Your speed increases by 10 feet',
        ],
      });

      applyFeatBuffsToFormData(formData, []);

      expect(formData.abilities[0].featIncrease).toBe(2);
      expect(formData.resistances).toEqual(['fire']);
      expect(formData).not.toHaveProperty('proficiencies');
      expect(formData).not.toHaveProperty('features');
    });
  });

  describe('idempotency (as-is: NON-idempotent on featIncrease, stable on resistances)', () => {
    it('re-applying doubles featIncrease (additive) while resistances stay deduplicated', () => {

      const formData = makeFormData();

      findFeat.mockReturnValue({
        name: 'Tough',
        benefits: ['Increase your Strength score by 2', 'You have resistance to fire'],
      });

      applyFeatBuffsToFormData(formData, []);
      applyFeatBuffsToFormData(formData, []);

      // Actual behavior pinned: no internal reset guard — the undo seam is
      // clearAppliedFeatBuffs (lane #2017), which zeroes featIncrease.
      expect(formData.abilities[0].featIncrease).toBe(4);
      expect(formData.resistances).toEqual(['fire']);
    });
  });

  describe('return value structure', () => {
    it('returns the four-category buffs object itself, not the mutated formData', () => {

      const formData = makeFormData();

      findFeat.mockReturnValue({
        name: 'Mixed feat',
        benefits: [
          'Increase your Strength score by 2',
          'You gain proficiency with heavy armor',
          'You have resistance to fire',
          'Your speed increases by 10 feet',
        ],
      });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result).not.toBe(formData);
      expect(Object.keys(result).sort()).toEqual([
        'abilityScoreIncreases',
        'features',
        'proficiencies',
        'resistances',
      ]);
      expect(result.abilityScoreIncreases).toHaveLength(1);
      expect(result.abilityScoreIncreases[0]).toMatchObject({ name: 'Strength', amount: 2 });
      expect(result.proficiencies).toHaveLength(1);
      expect(result.resistances).toEqual(['fire']);
      expect(result.features).toHaveLength(1);
      expect(result.features[0]).toMatchObject({ name: 'Speed Bonus', type: 'speed', value: 10 });
    });

    it('returns empty arrays for all categories when no feats are selected', () => {

      const formData = makeFormData({ feats: [] });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.abilityScoreIncreases).toEqual([]);
      expect(result.proficiencies).toEqual([]);
      expect(result.resistances).toEqual([]);
      expect(result.features).toEqual([]);
    });

    it('skips feats that are not found (findFeat returns null) without touching formData', () => {

      findFeat.mockReturnValue(null);

      const formData = makeFormData({ feats: ['Nonexistent'], resistances: ['cold'] });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.abilityScoreIncreases).toEqual([]);
      expect(result.proficiencies).toEqual([]);
      expect(result.resistances).toEqual([]);
      expect(result.features).toEqual([]);
      expect(formData.abilities.every(a => a.featIncrease === 0)).toBe(true);
      expect(formData.resistances).toEqual(['cold']);
    });
  });
});
