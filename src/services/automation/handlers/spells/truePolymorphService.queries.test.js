// @maintained-by-ai
// truePolymorph HEXAD lane #1984 — .queries (FIFTH lane). Subject: truePolymorphService.js.
// Seam map: truePolymorphHandleModes.test.js header (#1980–#1986).
// Siblings closed: #1980 handleModes 5, #1981 handler 29, #1982 resolveMaxCR 33
// (canonical), #1983 apply 17 (merge/clobber flags carried there). #1985
// .summon-revert and #1986 .transforms queue after — this lane absorbs
// neither summon/revert nor transform-write content.
//
// DEAD-EXPORT VERIFICATION (repo-wide grep incl. dynamic dispatch, bracket-string
// access, barrel/index re-exports and JSX imports — verified 2026-10-16, CONFIRMS
// the hexad map's dead-export pre-flag):
//   · getActiveTruePolymorphs / getActiveObjectTransforms / getTruePolymorphCaster /
//     getObjectTransformCaster (service :14/:19/:24/:33) — DEAD EXPORTS.
//     Zero production callers. No barrel: spells/ has no index.js and automation/
//     index.js never imports truePolymorphService.js at all — its only truePolymorph
//     dispatch is `true_polymorph: handleTruePolymorph` (index.js:212/:539) against
//     truePolymorphHandler.js. Grep of all four identifiers: hits ONLY in this
//     module's definitions and test files. Zero `import(...)` of the service outside
//     tests; zero bracket-string access to these names in any file.
//   · Runtime-key pattern matches regenerate #1946 precedent: every LIVE consumer of
//     the campaign targetEffects 'true_polymorph'/'object_transform' keys reads them
//     DIRECTLY with inline filters, never via these query predicates:
//     truePolymorphService.js :126/:244/:404 (te removal filters), truePolymorphHandler.js
//     :81 (already-transformed gate), shapechangeService.js :108 + shapechangeHandler.js
//     :79 (polymorph-block gates), clearAllExpirationEffects.js :197 (object_transform
//     rest cleanup), concentrationService.js :187 (concentration object_transform reads).
//   · LIVE export surface (load-guard pins below): applyTruePolymorph —
//     useSpellMetamagicFlow/useComplexSpellHandlers.js:14; confirmTruePolymorphTransform
//     + applyObjectTransform — CharSheet.jsx:25; revertTruePolymorph —
//     clearExpirationEffects.js:8 + concentrationService.js:15. NOTE: the service
//     does NOT re-export handle — index.js:212 imports handle directly from
//     truePolymorphHandler.js (registry dispatch true_polymorph, :539).
//     summonCreatureFromObject (:274) — exported but only consumed in-module (:142);
//     its contract is owned by #1985 .summon-revert — NOT pinned or flagged dead here.
//   · Polymorph twins getActivePolymorphs/getPolymorphCaster (polymorphService.js
//     :11/:16) verified same dead pattern (test-only consumers) — final-report
//     consolidation: delete all six predicates in one commit, retire their test
//     describes together.
//
// Per #1916 precedent the four dead-export describes are REMOVED here. The load
// guard below fails loudly if the module's getRuntimeValue import is orphaned when
// the four predicates are deleted from truePolymorphService.js.
// Contract retained as a flag comment so the inline live filters above can never
// silently diverge from the authored effect keys without this note going stale:
//   'true_polymorph' / 'object_transform' are the canonical exact te.effect keys;
//   caster lookup normalizes array targets via first element (te.target[0]).
//
// Arity note (#1980 map): real getRuntimeValue is 2-arg (characterKey, propertyName)
// — useRuntimeState.js:63; the queries pass a 3rd campaignName arg that is silently
// ignored. Mocks here must NOT depend on arg 3.
// Turn-based only: no timers in this lane or the source lanes — 'concentration'
// duration + Infinity expiryRounds are combat-scoped, cleared at seams (no-timers
// policy).
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { get: vi.fn(), set: vi.fn(() => Promise.resolve()) },
}));

vi.mock('./truePolymorphHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('./polymorphService.js', () => ({
  revertPolymorph: vi.fn(),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
  loadMonsters: vi.fn(),
}));

import {
  applyTruePolymorph,
  confirmTruePolymorphTransform,
  applyObjectTransform,
  revertTruePolymorph,
} from './truePolymorphService.js';

describe('truePolymorphService queries lane (#1984)', () => {
  // getActiveTruePolymorphs / getActiveObjectTransforms / getTruePolymorphCaster /
  // getObjectTransformCaster describes REMOVED — dead exports, zero prod consumers
  // (see header greps). Recommend deleting the four predicates from
  // truePolymorphService.js alongside the polymorph twins (polymorphService.js:11/:16).

  it('load guard: module imports cleanly with mocked seams and exposes its LIVE export surface', () => {
    expect(typeof applyTruePolymorph).toBe('function');       // useComplexSpellHandlers.js:14
    expect(typeof confirmTruePolymorphTransform).toBe('function'); // CharSheet.jsx:25
    expect(typeof applyObjectTransform).toBe('function');      // CharSheet.jsx:25
    expect(typeof revertTruePolymorph).toBe('function');       // clearExpirationEffects.js:8, concentrationService.js:15
  });
});
