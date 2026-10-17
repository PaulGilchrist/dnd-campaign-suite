// @maintained-by-ai
// featBuffService.computeAllFeatBuffs.edge-cases.test.js — LANE #5/9 of the featBuffService
// nine-lane cluster (queue #2016-2024). Subject: src/services/character/featBuffService.js
// computeAllFeatBuffs (L583-633) NULL/UNDEFINED-TOLERANCE SEAMS. Canonical seam map lives in
// the lane #1 header (featBuffService.applyFeatBuffsToFormData.test.js) — READ FIRST.
// The twins #2018/#2019 explicitly SHED "empty-formData envelope + not-found/null tolerance"
// HERE; they keep disk-verbatim aggregation content, this lane keeps the null/empty seams.
//
// THIS LANE CONTRACT (#2020) — honest as-is tolerance map (verified against source L583-633):
//   - THROWS TypeError: formData null/undefined (L584 `formData.rules` is un-guarded).
//     applyFeatBuffsToFormData (#2016) calls computeAllFeatBuffs FIRST and is NOT guarded
//     either — the throw is inherited there unchanged (cross-ref #2016, pinned only here).
//   - THROWS TypeError: formData.feats non-array-but-truthy (L585 `|| []` guards only
//     falsy; L594 forEach has no Array.isArray guard) and allFeats null/undefined or
//     non-array (findFeat dereferences `allFeats.find` un-guarded at featFinder.js:4 —
//     featFinder.test.js pins miss/empty-array lookups but has no null-allFeats guard,
//     so the aggregate-level inheritance is pinned below, unsanitized).
//   - TOLERATED (empty four-category envelope): formData {} , missing/empty feats,
//     missing rules (defaults to the 5e branch at L584).
//   - TOLERATED (skip): feats absent from the passed allFeats — real findFeat returns
//     null and logs NOT FOUND (console.error bounded exactly one-per-miss below); the
//     aggregate skips and NEVER fabricates featName from the miss's selection string.
//
// findFeat is intentionally NOT mocked (per twin canon): featFinder.js is a pure lookup over
// the passed allFeats — no internal disk cache. The old findFeat-mocked body was this
// cluster's fabricated-fixture file; mandatory cleanup done: 'ASI Feat'/'Prof Feat'/
// fake-2024-'Tough'/5e 'Tough'+'Alert' mock aggregate/'Custom Feat'/Feat A-B all TRIMMED
// as redundant clones — aggregation envelopes + featName/featDescription stamping are #2018
// (2024) / #2019 (5e) disk-verbatim canon, per-benefit parsing is #2022/#2023. NOTE the old
// "allFeats null returns empty" and "featDescription: undefined" pins were mock artifacts of
// that mocked input seam: real findFeat throws on null allFeats (pinned honestly above) and
// disk rows stamp a description ARRAY (see #2019 header). Missing-content here is deliberate.
//
// NOT this lane (do not re-add): saveType resolution + SPA-cache mutation quirk
// (featBuffService.js:626-627) → #2021 resilient. Non-empty aggregation → #2018/#2019.
// Single-feat null/benefit-less feats → #2022/#2023 (their null lanes). No timers.

import { describe, it, expect, vi, afterEach } from 'vitest';

import feats5e from '../../../public/data/feats.json' with { type: 'json' };

import { computeAllFeatBuffs } from './featBuffService.js';

afterEach(() => {
  // Mandatory: re-spying console.error in a later test without restoring REUSES the same
  // spy state (tinyspy), silently accumulating prior tests' miss counts (observed 2+1=3).
  vi.restoreAllMocks();
});

// Exact-shape empty envelope — the four-category {} every tolerance leg must return.
const EMPTY_ENVELOPE = {
  abilityScoreIncreases: [],
  proficiencies: [],
  resistances: [],
  features: [],
};

describe('computeAllFeatBuffs — edge cases (null/undefined tolerance seams)', () => {
  describe('throws (NOT tolerated — honest as-is)', () => {
    it('throws TypeError when formData is null or undefined (#2016 apply inherits this un-guarded)', () => {
      // L584 `formData.rules` dereferences before any guard — applyFeatBuffsToFormData
      // (#2016 writer) calls through here unchanged with null formData.
      expect(() => computeAllFeatBuffs(null, [])).toThrow(TypeError);
      expect(() => computeAllFeatBuffs(undefined, [])).toThrow(TypeError);
    });

    it('throws TypeError when formData.feats is truthy but not an array', () => {
      // L585 `formData.feats || []` guards only FALSY values; a truthy non-array reaches
      // forEach (L594) — no Array.isArray guard.
      expect(() => computeAllFeatBuffs({ rules: '5e', feats: 'Tough' }, feats5e)).toThrow(TypeError);
      expect(() => computeAllFeatBuffs({ rules: '5e', feats: {} }, feats5e)).toThrow(TypeError);
    });

    it('throws TypeError when allFeats is null or undefined while a feat is selected (real findFeat, un-guarded)', () => {
      // findFeat dereferences allFeats.find un-guarded (featFinder.js:4); the aggregate
      // forwards allFeats verbatim (L595) so the throw surfaces through computeAllFeatBuffs.
      // Pinned unsanitized — featFinder.test.js has no null guard either: no tolerance exists.
      expect(() => computeAllFeatBuffs({ rules: '5e', feats: ['Tough'] }, null)).toThrow(TypeError);
      expect(() => computeAllFeatBuffs({ rules: '5e', feats: ['Tough'] }, undefined)).toThrow(TypeError);
      expect(() => computeAllFeatBuffs({ rules: '5e', feats: ['Tough'] }, {})).toThrow(TypeError);
    });
  });

  describe('missing-keys / empty shapes (tolerated: exact empty envelope)', () => {
    it('returns the exact empty four-category envelope for completely empty formData', () => {
      // rules defaults to '5e' (L584), feats defaults to [] (L585) — zero findFeat calls,
      // pure fresh envelope. Twin rule-default-with-content pin (byte-identical text branch)
      // is #2019 disk territory; this leg is the keys-absent shape seam.
      expect(computeAllFeatBuffs({}, [])).toEqual(EMPTY_ENVELOPE);
    });

    it('returns the exact empty envelope when feats is an empty array and allFeats is empty or omitted', () => {
      expect(computeAllFeatBuffs({ rules: '5e', feats: [] }, [])).toEqual(EMPTY_ENVELOPE);
      expect(computeAllFeatBuffs({ rules: '5e', feats: [] })).toEqual(EMPTY_ENVELOPE);
    });

    it('returns the exact empty envelope when formData has no feats key at all', () => {
      // Even with a fully-populated allFeats available, a missing selection iterates nothing.
      expect(computeAllFeatBuffs({ rules: '5e' }, feats5e)).toEqual(EMPTY_ENVELOPE);
    });
  });

  describe('not-found skip (real findFeat miss path, console.error bounded)', () => {
    it('skips every unresolvable selection with an exact empty envelope and one console.error per miss', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Nonexistent1', 'Nonexistent2'] },
        feats5e
      );

      expect(result).toEqual(EMPTY_ENVELOPE);
      // Real findFeat miss path (featFinder.js:10): exactly one NOT FOUND log per miss.
      expect(errSpy).toHaveBeenCalledTimes(2);
      expect(errSpy).toHaveBeenNthCalledWith(
        1,
        '[findFeat] NOT FOUND:',
        'Nonexistent1',
        'allFeats sample:',
        feats5e.slice(0, 5).map(f => f.name)
      );
    });

    it('skips an unresolvable selection but never fabricates featName for it — disk feat contributes alone', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      if (!feats5e.some(f => f.name === 'Alert')) {
        throw new Error(`public/data/feats.json no longer contains 'Alert' — re-anchor this lane`);
      }

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Nonexistent', 'Alert'] },
        feats5e
      );

      // Miss contributes NOTHING (no phantom featName 'Nonexistent' anywhere); the surviving
      // disk feat's contributions all carry its real featName. #2019 pins the full Alert
      // envelope verbatim — 6 features here = 3 text-derived + 3 threaded from the row's
      // automation ARRAY (featBuffService.js:563-573); count-only sanity, no rule-table re-run.
      expect(result.abilityScoreIncreases).toEqual([]);
      expect(result.resistances).toEqual([]);
      const allStamps = [...result.abilityScoreIncreases, ...result.features].map(x => x.featName);
      expect(allStamps.every(n => n === 'Alert')).toBe(true);
      expect(result.features.map(f => f.featName)).toEqual(Array(6).fill('Alert'));
      expect(errSpy).toHaveBeenCalledTimes(1);
    });
  });
});
