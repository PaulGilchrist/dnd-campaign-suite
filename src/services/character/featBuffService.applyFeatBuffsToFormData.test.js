// @maintained-by-ai 2026-11-27
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
//   #2020 computeAllFeatBuffs.edge-cases             — aggregate null/undefined tolerance +
//         not-found skip (canonical home for throw-inheritance and findFeat-null legs)
//   #2021 computeAllFeatBuffs.resilient              — aggregate saveType resolution via
//         resolveFeatChosenAbility (NOTE: mutates SPA-cached feats.json rows in place,
//         L626-627 — see test-setup-playbook.md §13 "Feats/ASI mechanics")
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
//   - Application faces ONLY: named-increase targeting (case-insensitive), the 'or'-pair
//     both-sides quirk (pushAbilityOrIncrease, L43-50 → apply filter excludes only name
//     === 'any'), the 'any'-sentinel skip, merge-append, the missing-abilities guard,
//     write-scope boundary and the returned-envelope identity. Parsing/derivation of the
//     envelope is #2022/#2023; empty-envelope + findFeat-null tolerance is #2020 (its
//     header explicitly owns "not-found skip"; the former duplicate here was REMOVED —
//     this lane keeps only the application-side no-op witness for empty buffs).
//   - feats are resolved through findFeat (mocked input seam) — no claims about disk
//     public/data/feats.json rows here; disk-verbatim rows live in the compute lanes.
//
// LIVENESS FLAG (re-verified by repo-wide grep, 2026-11-27): applyFeatBuffsToFormData has
// ZERO production callers — live wizard lanes are computeAllFeatBuffs + useWizardFeatBuffs'
// own clearBuffs/applyBuffs (useWizardFeatBuffs.js:83-87) and rules.js:253 (applyFeatBuffs;
// header previously cited :255 — drifted 2 lines). Same for
// clearAppliedFeatBuffs (#2017). #1534 RESOLVED: the writer lane no longer carries an inline
// twin of applyAbilityScoreIncreases — it calls the shared buffApplier export (single source).
// This lane pins the legacy writer contract for whatever caller revives it; flagged to parent
// for trim decision.
//
// 2026-11-27 IMPROVE-AND-TRIM (10→8 tests):
//   - multi-feat accumulation leg REMOVED: same additive line
//     (buffApplier.js:12 `featIncrease = (featIncrease||0)+amount`) as the re-apply leg —
//     same-branch collapse; the re-apply leg accumulates findFeat twice anyway.
//   - findFeat-null leg REMOVED: #2020 edge-cases pins the not-found skip for the shared
//     compute; kept here only as the application-side "empty buffs write nothing" leg.
//   - case-insensitive-match leg FOLDED into the named-increase leg (mixed-case fixtures).
//   - "writes only featIncrease/resistances" FOLDED into the return-structure leg; both now
//     use full-shape toEqual of the returned envelope AND of post-state formData (#1947:
//     extra/missing/renamed keys fail; every buff byte-distinct from the 0-defaults).
//   - negative legs upgraded to full "unchanged input" deep-equal witnesses, and the
//     missing-abilities leg now ALSO feeds a resistance to prove the guard does not
//     short-circuit the second write.
//   - *Once mock chain dropped (hygiene); mockReset re-baseline in beforeEach
//     (clearAllMocks keeps mockReturnValue).
//
// Anti-pattern hygiene: exact assertions only (no toBeDefined), no timers, no vacuous
// loops, no fabricated disk rows (findFeat fully mocked), no mock-call echoes.

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { findFeat } from '../shared/featFinder.js';
import { applyFeatBuffsToFormData } from './featBuffService.js';

vi.mock('../shared/featFinder.js', () => ({
  findFeat: vi.fn(),
}));
// buffApplier is intentionally NOT mocked: mergeDeduplicated is exercised for real so
// resistance semantics are actual post-states (merge-append + case-insensitive dedup),
// not mock-call echoes. Its unit canon lives in shared/buffApplier.test.js.

beforeEach(() => {
  findFeat.mockReset();
});

describe('applyFeatBuffsToFormData', () => {
  const makeFormData = (overrides = {}) => ({
    rules: '5e',
    feats: ['Tough'],
    abilities: [
      { name: 'strength', featIncrease: 0 },
      { name: 'Dexterity', featIncrease: 0 },
      { name: 'CONSTITUTION', featIncrease: 0 },
    ],
    ...overrides,
  });

  describe('side effects on formData (mutated in place)', () => {
    it('adds a named increase to the exactly-matching ability only, case-insensitively, touching nothing else', () => {
      // Parser derives name 'Strength' from benefit text; formData entries carry mixed
      // casing — the apply lookup lowercases both sides (buffApplier.js:8-9). Full-shape
      // post-state: amount 2 is byte-distinct from the 0 defaults, and no resistances
      // key may materialize (empty parsed resistances → mergeDeduplicated early-return).
      const formData = makeFormData();

      findFeat.mockReturnValue({
        name: 'Test feat',
        benefits: ['Increase your Strength score by 2'],
      });

      applyFeatBuffsToFormData(formData, []);

      expect(formData).toEqual({
        rules: '5e',
        feats: ['Tough'],
        abilities: [
          { name: 'strength', featIncrease: 2 },
          { name: 'Dexterity', featIncrease: 0 },
          { name: 'CONSTITUTION', featIncrease: 0 },
        ],
      });
    });

    it('applies BOTH sides of an "or" increase pair — apply filter excludes only name "any"', () => {
      // 'or'-text parses to TWO named increases (pushAbilityOrIncrease, featBuffService.js:43);
      // the apply filter excludes only name === 'any', so BOTH abilities receive the bump.
      // Pinned as-is: if choice handling is added, this must change with it.
      const formData = makeFormData();

      findFeat.mockReturnValue({
        name: 'Modifier feat',
        benefits: ['Increase your Strength or Dexterity score by 1'],
      });

      applyFeatBuffsToFormData(formData, []);

      expect(formData.abilities.map(a => a.featIncrease)).toEqual([1, 1, 0]);
      expect(formData).not.toHaveProperty('resistances');
    });

    it('skips choice/"any" increases on formData while still reporting them in the returned buffs', () => {
      // The skip is an APPLY-side filter, not a parse loss: the envelope witness below
      // proves the increase was derived (name 'any') and simply never written.
      const formData = makeFormData();

      findFeat.mockReturnValue({
        name: 'Skill feat',
        benefits: ['Choose one ability score. Increase the chosen ability score by 2'],
      });

      const buffs = applyFeatBuffsToFormData(formData, []);

      expect(buffs.abilityScoreIncreases).toEqual([
        {
          name: 'any',
          amount: 2,
          isChoice: true,
          description: 'Choose one ability score. Increase the chosen ability score by 2',
          max_value: 20,
          featName: 'Skill feat',
          featDescription: undefined,
        },
      ]);
      expect(formData).toEqual({
        rules: '5e',
        feats: ['Tough'],
        abilities: [
          { name: 'strength', featIncrease: 0 },
          { name: 'Dexterity', featIncrease: 0 },
          { name: 'CONSTITUTION', featIncrease: 0 },
        ],
      });
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

    it('with no abilities array still writes resistances and never invents the abilities key', () => {
      // The ability guard (buffApplier.js:5) must not short-circuit the resistance
      // merge — the fixture pairs an unappliable increase with a resistance so a
      // whole-apply early-return mutant fails here.
      const formData = { rules: '5e', feats: ['Tough'] };

      findFeat.mockReturnValue({
        name: 'Test feat',
        benefits: [
          'Increase your Strength score by 2',
          'You have resistance to fire',
        ],
      });

      expect(() => applyFeatBuffsToFormData(formData, [])).not.toThrow();
      expect(formData).toEqual({
        rules: '5e',
        feats: ['Tough'],
        resistances: ['fire'],
      });
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
      // clearAppliedFeatBuffs (lane #2017), which zeroes featIncrease. This same
      // additive line is what multi-feat accumulation walked (folded leg).
      expect(formData).toEqual({
        rules: '5e',
        feats: ['Tough'],
        abilities: [
          { name: 'strength', featIncrease: 4 },
          { name: 'Dexterity', featIncrease: 0 },
          { name: 'CONSTITUTION', featIncrease: 0 },
        ],
        resistances: ['fire'],
      });
    });
  });

  describe('return value and write-scope boundary', () => {
    it('returns the full four-category buffs envelope (not formData) while writing ONLY featIncrease and resistances', () => {
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
      expect(result).toEqual({
        abilityScoreIncreases: [
          {
            name: 'Strength',
            amount: 2,
            isChoice: false,
            max_value: 20,
            featName: 'Mixed feat',
            featDescription: undefined,
          },
        ],
        proficiencies: [{ name: 'Heavy Armor', type: 'proficiency' }],
        resistances: ['fire'],
        features: [
          {
            name: 'Speed Bonus',
            description: 'Your speed increases by 10 feet',
            type: 'speed',
            value: 10,
            featName: 'Mixed feat',
          },
        ],
      });

      // Write-scope boundary: proficiencies/features exist in the RETURNED envelope
      // only — a full-shape formData toEqual fails on any extra written key.
      expect(formData).toEqual({
        rules: '5e',
        feats: ['Tough'],
        abilities: [
          { name: 'strength', featIncrease: 2 },
          { name: 'Dexterity', featIncrease: 0 },
          { name: 'CONSTITUTION', featIncrease: 0 },
        ],
        resistances: ['fire'],
      });
    });

    it('with no feats selected returns the empty four-category envelope and leaves formData byte-for-byte untouched', () => {
      const formData = makeFormData({ feats: [] });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [],
      });
      // Empty resistance list must NOT materialize the key (mergeDeduplicated
      // early-return). findFeat-null skip is #2020 canon.
      expect(formData).toEqual({
        rules: '5e',
        feats: [],
        abilities: [
          { name: 'strength', featIncrease: 0 },
          { name: 'Dexterity', featIncrease: 0 },
          { name: 'CONSTITUTION', featIncrease: 0 },
        ],
      });
    });
  });
});
