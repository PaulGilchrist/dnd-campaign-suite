// @maintained-by-ai
//
// HELPERS lane: pins ONLY the two pure functions exported at
// relentlessRageService.js:206 — evaluateHealExpression (:28-41) and
// getRuntimeUsesKey (:7-9). Delegation VERBATIM from the check lane header
// (#1399): "Save-result resolution, death-save slot machine, heal-expression
// evaluation, and addEntry-rejection resilience belong to the sibling
// deathSaves / saveResults / errors / helpers lanes — not duplicated here."
// Assignment verified against source: checkRelentlessRage consumes both
// helpers internally (:33 eval at :95, key builder at :70/:194). Store
// traffic around those call sites belongs to the check/saveResults lanes —
// this lane pins the evaluator/key-builder IN ISOLATION, never the stores.
//
// Purity census: both helpers are PURE — zero store reads/writes, zero DOM,
// zero dice, zero timers (:7-9, :28-41 contain no getRuntimeValue/Date.now/
// setTimeout; module-wide NO-CLOCK re-verified by the errors lane). The five
// vi.mock blocks are LOAD-ISOLATION ONLY for the service's top-level imports
// (:1-5); none are asserted — no call counts, no resetAllMocks boilerplate
// (#1320 lesson: dead mock scaffolding from the previous version of this
// file deleted: unused guid fixture 'test-guid-123', unused addEntry/
// setRuntimeValue resolved-value seeds, unused clearDeathSavePrompt).
//
// #1278 clone-or-same verdict: DIFFERENT SCOPE, not a clone.
// spellDamageUtils.resolveHealExpression(spell, playerLevel, spellCastingMod)
// (src/services/rules/core/spellDamageUtils.js:145) selects a cantrip/slot
// STRING template out of spell.heal_at_slot_level and returns a dice-string;
// ours takes (expression, playerComputed) and returns a NUMBER via multiplier
// arithmetic. No re-export, no shared math to fold — full expression-math
// ownership stays here. Family note (#1344 pattern, report-only):
// reactionSaveHealHandler.js:18 keep a near-CLONE of ours (same unanchored
// /2\s*\*\s*barbarian_level/i, same anchored ^(\d+)\s*\*\s*(\w+)$, same
// unknown-field->0); it diverges by reading playerStats.barbarianLevel first
// on falsy input (its :19) and dereferencing playerStats non-optionally
// (ours :30 returns 1 where the clone would TypeError). Its rows belong to
// that handler's lane, not here.
//
// DATA BUG surfaced producer-side (#1399 red flag), pinned honestly:
// BOTH rulesets' disk Relentless Rage automation carries
// healExpression: '2 * barbarian_level', but the 5e classes.json feature
// TEXT says "you drop to 1 hit point instead". This evaluator turns that
// disk literal into 22 (lv11) / 40 (lv20) — NOT 1. Rows below pin the
// evaluated numbers; the text-vs-automation contradiction is reported, the
// disk bytes stay untouched (byte verification of the automation object is
// check lane :246-252's face — only the literal extraction happens here).
//
// Quirk census (byte evidence):
// - :0-swallow spectrum: unknown-field ternary (:25 `resolve ? resolve(...)
//   : 0`) evaluates '5 * charisma' to LITERAL 0 with a live level nearby —
//   no fallback; '0 * level' returns 0 (multiplier passthrough). Counter-
//   face: numeric input 0 (:29 typeof arm) returns 0 verbatim, proving the
//   branch order :29-before-:30 (swapping them would swallow 0 to level).
//   The level chain never yields 0: every level/falsy arm clamps ||1
//   (:14/:19/:30/:40) — pinned with level:0 rows producing 2/1, never 0.
// - unanchored-regex swallow (:33 hardcoded '2 * barbarian_level' .test):
//   '12 * barbarian_level' returns 22 NOT 132 (parsed 12 discarded) and
//   '2 * barbarian_level + 5' returns 22 (+5 discarded). These are the
//   near-miss bait rows killing any anchoring/"fix" mutation; the anchored
//   branch-4 near-misses ('7 * level ', '3 * level + 1) fall through to
//   the :40 level fallback instead — mutually distinguishable outcomes.
// - golden unguarded-deref (#1360 class): inside evaluateHealExpression the
//   helper span is CLEAN — every context deref is optional-chained
//   (:12-14/:19/:30/:40) and (expr, undefined) rows pass without TypeError,
//   declared clean WITH evidence. getRuntimeUsesKey (:8) derefs
//   featureName.toLowerCase NON-optionally: null/undefined throw TypeError
//   — pinned honestly, silent-null guard absent.
// - never-executed guards: hunted — ZERO found. Every arm has a row:
//   :29 numeric, :30 falsy triple, :33 hardcoded-regex (incl. substring
//   fires), :37-38 anchored-generic (both resolvers + unknown-field),
//   :40 text fallback, :12-14 class-level chain (hit/miss/no-chain),
//   :19 level resolver both clamps.
// - dead-export hunt (#1370/82/91/96 method): callers of
//   './relentlessRageService.js' in production = exactly ONE, applyDamage.js:24,
//   importing ONLY checkRelentlessRage. evaluateHealExpression and
//   getRuntimeUsesKey have ZERO non-test consumers (grep census, both
//   tokens, src/**/*.js|jsx). Both are exported-but-internal-only:
//   RECOMMEND dropping the export keyword at :206 (report-only, source
//   never edited here); until then this file is their sole public contract.
// - latch key: getRuntimeUsesKey('Relentless Rage') === 'relentlessrageUses'
//   is the shared byte of the reader :71 (arity-2 quirk, check lane) and
//   the writer :194 (saveResults lane) — pinned here at the builder.
// - input purity (#1395): playerComputed snapshots deep-equal after every
//   row loop — helpers never mutate their argument.
// DICE: zero dice reachable in either helper — no fixed stubs needed.
// PRESERVED-CITED-BY: none incoming (grep for this filename's cites found
// zero; check lane :21 lists 'helpers' only as a family name, no line
// range). Cross-file removals: none performed.

import { describe, it, expect, vi } from 'vitest';

// ── Load-isolation mocks ONLY (never asserted) ───────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({
  default: {},
}));

// ── Imports ────────────────────────────────────────────────────

import { evaluateHealExpression, getRuntimeUsesKey } from './relentlessRageService.js';
import classes5e from '../../../../public/data/classes.json';
import classes2024 from '../../../../public/data/2024/classes.json';

function barbarian(level) {
  return { level, class: { class_levels: [{ name: 'Barbarian', level }] } };
}

const diskRows = [classes5e, classes2024].map(data =>
  data.find(c => c.name === 'Barbarian').class_levels[10].features
    .find(f => f.name === 'Relentless Rage')
);

// ── Tests ──────────────────────────────────────────────────────

describe('evaluateHealExpression (relentlessRageService.js:28-41, pure)', () => {

  it('returns numeric input verbatim via the :29 typeof arm, including 0 and negatives', () => {
    // 0 passing (not clamped to level) pins branch ORDER :29-before-:30.
    for (const n of [10, 0, -3]) {
      expect(evaluateHealExpression(n, { level: 7 })).toBe(n);
    }
  });

  it('falsy expressions (undefined/null/empty-string triple) fall back to level, then 1 (:30)', () => {
    for (const falsy of [undefined, null, '']) {
      expect(evaluateHealExpression(falsy, { level: 7 })).toBe(7);
      expect(evaluateHealExpression(falsy, {})).toBe(1);
      // CLEAN census: optional chain at :30 — absent context never throws.
      expect(evaluateHealExpression(falsy, undefined)).toBe(1);
    }
  });

  it("disk-canon literal evaluates to 2 x Barbarian class level, NOT 1 (5e text contradiction, reported)", () => {
    const literals = diskRows.map(f => f.automation.healExpression);
    expect(literals).toEqual(['2 * barbarian_level', '2 * barbarian_level']);
    // Producer-side value of the disputed literal: lv11 -> 22, lv20 -> 40
    // (mutually distinguishable; 40 also kills any constant-22 mutation).
    expect(evaluateHealExpression(literals[0], barbarian(11))).toBe(22);
    expect(evaluateHealExpression(literals[1], barbarian(20))).toBe(40);
    // Class level beats character level (:12-14 find wins over :14 ||level).
    expect(evaluateHealExpression('2 * barbarian_level',
      { level: 3, class: { class_levels: [{ name: 'Barbarian', level: 11 }] } })).toBe(22);
    // Case/whitespace tolerance of the hardcoded regex (:33 /i and \s*).
    expect(evaluateHealExpression('2*BARBARIAN_LEVEL', barbarian(11))).toBe(22);
    expect(evaluateHealExpression('2 \t *   barbarian_level', barbarian(11))).toBe(22);
  });

  it('UNANCHORED :33 regex swallows surrounding text: multiplier and suffix are discarded', () => {
    // Near-miss bait rows: an anchoring "fix" would yield 132 / 27 here.
    expect(evaluateHealExpression('12 * barbarian_level', barbarian(11))).toBe(22);
    expect(evaluateHealExpression('2 * barbarian_level + 5', barbarian(11))).toBe(22);
    // Contrast: anchored branch-4 near-misses do NOT match and fall through
    // to the :40 level fallback — distinguishable outcomes per shape.
    expect(evaluateHealExpression('7 * level ', { level: 7 })).toBe(7);
    expect(evaluateHealExpression('3 * level + 1', { level: 7 })).toBe(7);
  });

  it('anchored generic branch (:37-38) parses the multiplier and maps fields exactly', () => {
    // Barbarian 11 nearby: 33 (not 22) proves branch 4 does not reuse the
    // hardcoded 2, and 36 (not 44) proves "level" maps to .level only.
    const ctx = { level: 9, class: { class_levels: [{ name: 'Barbarian', level: 11 }] } };
    expect(evaluateHealExpression('3 * barbarian_level', ctx)).toBe(33);
    expect(evaluateHealExpression('4 * level', ctx)).toBe(36);
    // :24 toLowerCase arm: killing it would hit the unknown-field 0 arm.
    expect(evaluateHealExpression('4 * LEVEL', ctx)).toBe(36);
    // Multiplier passthrough: 0 is not defaulted ("multiplier ||" mutation).
    expect(evaluateHealExpression('0 * level', ctx)).toBe(0);
  });

  it('unknown field evaluates to LITERAL 0 (:25 ternary) even with live level nearby', () => {
    const ctx = { level: 7, class: { class_levels: [{ name: 'Barbarian', level: 11 }] } };
    expect(evaluateHealExpression('5 * charisma', ctx)).toBe(0);
    expect(evaluateHealExpression('2 * con', ctx)).toBe(0);
  });

  it('Barbarian-level fallback chain (:12-14): find-miss, missing class_levels, missing class all clamp to ||level, then ||1', () => {
    expect(evaluateHealExpression('2 * barbarian_level',
      { level: 8, class: { class_levels: [{ name: 'Fighter', level: 8 }] } })).toBe(16);
    expect(evaluateHealExpression('2 * barbarian_level', { level: 5, class: {} })).toBe(10);
    expect(evaluateHealExpression('2 * barbarian_level', { level: 5 })).toBe(10);
    // Level-chain clamps: 0 and absent both resolve inside-1 -> 2, never 0.
    expect(evaluateHealExpression('2 * barbarian_level', {})).toBe(2);
    expect(evaluateHealExpression('2 * level', { level: 0 })).toBe(2);
    expect(evaluateHealExpression('2 * level', {})).toBe(2);
  });

  it('unrecognizable text falls through to level || 1 (:40) — no general math is evaluated', () => {
    expect(evaluateHealExpression('1d8+CON', { level: 7 })).toBe(7);
    expect(evaluateHealExpression('2 + 3', { level: 7 })).toBe(7);
    expect(evaluateHealExpression('level', { level: 7 })).toBe(7);
    expect(evaluateHealExpression('1d8+CON', {})).toBe(1);
  });

  it('does not mutate its playerComputed argument (#1395 input purity)', () => {
    const computed = {
      level: 11,
      class: { class_levels: [{ name: 'Barbarian', level: 11 }] },
      allFeatures: [],
    };
    const snapshot = JSON.stringify(computed);
    evaluateHealExpression('2 * barbarian_level', computed);
    evaluateHealExpression('1d8+CON', computed);
    evaluateHealExpression(undefined, computed);
    expect(JSON.stringify(computed)).toBe(snapshot);
  });
});

describe('getRuntimeUsesKey (relentlessRageService.js:7-9, pure)', () => {

  it('lowercases, deletes ALL whitespace runs, appends "Uses" — exact latch bytes', () => {
    // The 'Relentless Rage' row is the shared key byte of :71 reader and
    // :194 writer (pinned there by check/saveResults lanes).
    expect(getRuntimeUsesKey('Relentless Rage')).toBe('relentlessrageUses');
    expect(getRuntimeUsesKey('Frenzy')).toBe('frenzyUses');
    expect(getRuntimeUsesKey('Relentless  Rage')).toBe('relentlessrageUses');
    expect(getRuntimeUsesKey('RELentless RAGE')).toBe('relentlessrageUses');
    expect(getRuntimeUsesKey('Relentless\tRage')).toBe('relentlessrageUses');
    expect(getRuntimeUsesKey(' Relentless Rage ')).toBe('relentlessrageUses');
  });

  it('throws TypeError on non-string input (:8 golden deref, no silent-null guard)', () => {
    expect(() => getRuntimeUsesKey(null)).toThrow(TypeError);
    expect(() => getRuntimeUsesKey(undefined)).toThrow(TypeError);
  });
});
