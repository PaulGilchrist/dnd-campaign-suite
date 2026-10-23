// @maintained-by-ai
//
// HELPERS lane — #1402 DEAD-EXPORT CENSUS BATCH (2026-10-23): the pure-function
// exports evaluateHealExpression and getRuntimeUsesKey were DEMOTED to module
// private (export line deleted at the file tail; #1371/#1381 drop-export-class,
// fix#297 inspireSmite twin). Fresh census that authorized the demotion:
// production importers of relentlessRageService.js = exactly ONE, applyDamage.js,
// importing ONLY checkRelentlessRage; 'evaluateHealExpression' and
// 'getRuntimeUsesKey' had ZERO non-test consumers (grep census, both tokens,
// src/**/*.js|jsx). Internally they stay LIVE: getRuntimeUsesKey is the latch
// key builder at checkRelentlessRage :152 (reader, arity-2 quirk) and :242
// (the writer shares the byte); evaluateHealExpression is the success-leg heal
// evaluator at :183. Per the convert-private-imports-to-behavior-via-public-
// surface law, this lane now drives ONLY checkRelentlessRage through the
// save-result seam and pins evaluator outcomes by the committed currentHp
// write — the old pure-call pins are retired, not silently dropped.
//
// RETIRED ARMS (honest coverage delta, each with the reason):
//  - numeric-input-0 vs literal-'1' vs unknown-field-'5 * charisma'→0: the
//    fix#1403 Math.max(1, heal) clamp at :192 collapses every ≤0 evaluation
//    to the SAME HP=1 write — surface-indistinguishable by construction. The
//    zero-clamp face (evaluator 0 → write 1 → log mirrors 1) is OWNED by the
//    saveResults lane (#1403 "evaluator owns the 0, the WRITE floors it at 1")
//    and every deathSaves failing row. Not duplicated here; not lost.
//  - getRuntimeUsesKey(null/undefined) TypeError throw: the only production
//    call site passes the literal 'Relentless Rage' (:152) — nullish faces
//    are unreachable via the public surface, so the throw pin retired with
//    the pure lane (the key-space rows below: multi-space, case, trim — all
//    collapse onto the same shared byte and ride the latch pins in one).
//  - disk-row reads (classes.json lv11 Relentless Rage automation): still
//    consumed here as REAL inputs — invented nothing (#1362).
//
// PRESERVED-CITED-BY: none incoming. Cross-file removals: none performed.
// DICE: zero dice — every roll is a fixed detail byte authored here.
// NO-CLOCK: checkRelentlessRage resolves ONLY at the save-result prompt seam;
// the flush is a bounded fixed-tick microtask drain (no timers exist).

import { describe, it, expect, vi } from 'vitest';

// ── Load-isolation + seam mocks ──────────────────────────────

const { nextGuid } = vi.hoisted(() => {
  let seq = 0;
  return { nextGuid: () => `test-guid-${++seq}` };
});

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
  default: { guid: vi.fn(() => nextGuid()) },
}));

// ── Imports ────────────────────────────────────────────────────

import { checkRelentlessRage } from './relentlessRageService.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../ui/logService.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import classes5e from '../../../../public/data/classes.json';
import classes2024 from '../../../../public/data/2024/classes.json';

const CAMPAIGN = 'test-campaign';
const NAME = 'TestBarbarian';

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

let saveSeq = 0;
const savePromptId = () => `save-prompt-${++saveSeq}`;

// Strict argument-keyed store fake (#1372): unknown owner/key/arity THROWS.
const READ_SPEC = {
  activeBuffs: 3,
  relentlessrageUses: 2, // arity-2 quirk :153 — the getRuntimeUsesKey output byte
  activeConditions: 3, // success leg :202 only
};
const WRITE_KEYS = new Set([
  'currentHitPoints',
  'deathSaves',
  'deathFailures',
  'isDead',
  'activeConditions',
  'relentlessrageUses',
]);

function makeStore(seed) {
  const state = { relentlessrageUses: 0, ...seed };
  const reads = [];
  const writes = [];
  runtimeState.getRuntimeValue.mockImplementation((name, key, ...rest) => {
    if (name !== NAME) throw new Error(`helpers lane: unexpected get owner '${name}'`);
    const arity = READ_SPEC[key];
    if (arity === undefined) throw new Error(`helpers lane: unexpected get key '${key}'`);
    if (arity !== rest.length + 2) throw new Error(`helpers lane: unexpected get arity ${rest.length + 2} for '${key}'`);
    if (arity === 3 && rest[0] !== CAMPAIGN) throw new Error(`helpers lane: unexpected get campaign '${rest[0]}'`);
    reads.push(key);
    return state[key];
  });
  runtimeState.setRuntimeValue.mockImplementation((name, key, value, ...rest) => {
    if (name !== NAME) throw new Error(`helpers lane: unexpected set owner '${name}'`);
    if (!WRITE_KEYS.has(key)) throw new Error(`helpers lane: unexpected set key '${key}'`);
    if (rest.length !== 1 || rest[0] !== CAMPAIGN) throw new Error(`helpers lane: unexpected set campaign/arity ${JSON.stringify(rest)} for '${key}'`);
    const stored = Array.isArray(value) ? [...value] : value;
    writes.push([key, stored]);
    state[key] = stored;
    return Promise.resolve();
  });
  return { state, reads, writes };
}

// REAL disk rows (both rulesets): lv11 Barbarian's Relentless Rage automation —
// the evaluator's lawful inputs, programmatic not invented (#1362/#1399).
const diskRows = [classes5e, classes2024].map(data =>
  data.find(c => c.name === 'Barbarian').class_levels[10].features
    .find(f => f.name === 'Relentless Rage')
);

function computed(healExpression, { level = 7, classLevels } = {}) {
  return {
    name: NAME,
    level,
    allFeatures: [
      {
        name: 'Relentless Rage',
        automation: {
          type: 'reaction_save_heal',
          saveType: 'CON',
          saveDc: 10,
          dcScaling: 0,
          healExpression,
        },
      },
    ],
    ...(classLevels ? { class: { class_levels: classLevels } } : {}),
  };
}

// Drive the public seam: check → save-result success → committed HP write.
// Returns the hpGained the surface actually committed (evaluator + #1403 clamp).
async function healCommitted(comp) {
  const store = makeStore({ activeBuffs: [{ name: 'Rage', effect: 'stance' }] });
  const creature = { name: NAME, type: 'player', currentHp: 0 };
  createSaveListener.mockImplementation(() => ({ promptId: savePromptId() }));
  logService.addEntry.mockResolvedValue({});

  const intercept = checkRelentlessRage(creature, comp, CAMPAIGN);
  expect(intercept).toEqual({ intercepted: true, awaitingSave: true });
  const promptId = createSaveListener.mock.results.at(-1).value.promptId;
  window.dispatchEvent(new CustomEvent('save-result', {
    detail: { promptId, success: true, roll: 17, saveBonus: 8, total: 25 },
  }));
  await flush();

  const hpWrite = store.writes.find(([key]) => key === 'currentHitPoints');
  expect(hpWrite, 'success leg must commit a currentHitPoints write').toBeDefined();
  const snap = JSON.parse(JSON.stringify(comp)); // input purity census (#1395)
  expect(comp).toEqual(snap);
  return { hp: hpWrite[1], store };
}

// ── Tests ──────────────────────────────────────────────────────

describe('getRuntimeUsesKey (demoted #1402 — rides the public latch byte)', () => {
  it('the shared latch key of reader :152 and writer :242 is exactly relentlessrageUses — built from the literal "Relentless Rage" (multi-space/case/trim variants of that literal are internal-only; the ONE production call site passes the fixed literal)', async () => {
    const { hp, store } = await healCommitted(computed(1, { level: 11 }));
    expect(hp).toBe(1);
    expect(store.reads).toContain('relentlessrageUses'); // reader key byte
    const bump = store.writes.find(([key]) => key === 'relentlessrageUses');
    expect(bump).toBeDefined();
    expect(bump[1]).toBe(1); // same builder byte feeds the writer (:242)
    expect(store.reads.filter(k => k === 'relentlessrageUses')).toHaveLength(1);
  });
});

describe('evaluateHealExpression (demoted #1402 — rides the clamped HP write)', () => {
  it('#1399 disk law, both rulesets: numeric literal 1 (5e "drop to 1") and the 2024 "2 * barbarian_level" land exactly — lying bare levels cannot fake the result', async () => {
    expect(diskRows[0].automation.healExpression).toBe(1); // 5e row: NUMBER literal
    expect(diskRows[1].automation.healExpression).toBe('2 * barbarian_level'); // 2024 row

    // 5e: literal 1 beats a lying bare level 11 (typeof arm first, no level chain)
    expect((await healCommitted(computed(1, { level: 11 }))).hp).toBe(1);
    // STRING-shaped '1' via the #1399 numeric-literal arm — 1, NOT the level 11
    expect((await healCommitted(computed('1', { level: 11 }))).hp).toBe(1);
    // 2024: class chain 20 behind lying bare level 3 → 40, never 6, never 20
    expect((await healCommitted(computed('2 * barbarian_level', { level: 3, classLevels: [{ name: 'Barbarian', level: 20 }] }))).hp).toBe(40);
  });

  it('unanchored-hardcoded-regex baits return 2*level NOT the parsed multiplier nor the tail: 12*barbarian_level->22, +5 discarded->22, case-folded fires too', async () => {
    const lv11 = { level: 11 };
    expect((await healCommitted(computed('12 * barbarian_level', lv11))).hp).toBe(22); // parsed 12 discarded
    expect((await healCommitted(computed('2 * barbarian_level + 5', lv11))).hp).toBe(22); // +5 discarded
    expect((await healCommitted(computed('2 * BARBARIAN_LEVEL', lv11))).hp).toBe(22); // /i flag
  });

  it('anchored-generic arm resolves BOTH fields, unknown fields zero out, and the level chain clamps through getBarbarianLevel miss', async () => {
    expect((await healCommitted(computed('3 * level', { level: 7 }))).hp).toBe(21);
    // Barbarian-chain miss: class chain holds only Fighter lv20 → getBarbarianLevel
    // falls to playerComputed.level 5 → 2*5=10, never 40 (Fighter level).
    expect((await healCommitted(computed('2 * barbarian_level', { level: 5, classLevels: [{ name: 'Fighter', level: 20 }] }))).hp).toBe(10);
  });

  it('fallback-arm pair are MUTUALLY DISTINGUISHABLE from the anchored arm: trailing-space and dice-text rows never parse, landing on the bare level — 7, not 49 nor a fabricated die', async () => {
    expect((await healCommitted(computed('7 * level ', { level: 7 }))).hp).toBe(7); // anchored ^...$ fails trailing space → :53 level fallback
    expect((await healCommitted(computed('1d8+CON', { level: 7 }))).hp).toBe(7); // unparseable → level fallback
    expect((await healCommitted(computed(undefined, { level: 7 }))).hp).toBe(7); // falsy → :39 level fallback
    const noLevel = computed(undefined, { level: 7 }); // falsy + NO level key at all →
    delete noLevel.level; // the ||1 clamp chain lands the write at 1
    expect((await healCommitted(noLevel)).hp).toBe(1);
  });

  it('input purity (#1395): the playerComputed passed through five evaluations is never mutated, class chain included', async () => {
    const comp = computed('2 * barbarian_level', { level: 3, classLevels: [{ name: 'Barbarian', level: 20 }] });
    const before = JSON.parse(JSON.stringify(comp));
    await healCommitted(comp);
    expect(comp).toEqual(before);
  });
});
