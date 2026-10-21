// @maintained-by-ai
//
// ERRORS lane: pins ONLY the failure faces of checkRelentlessRage's four
// addEntry call sites — :90 trigger, :126 success, :141 failure, :187
// death-save log — each fire-and-forget with an explicit `.catch(e =>
// console.error('[relentlessRage] Error:', e))`. This is the addEntry-rejection
// .catch resilience delegated here by the deathSaves lane (#1400 header:
// 'errors owns addEntry-rejection .catch'). Gate/predicate bytes belong to
// the check lane (#1399); heal-write VALUES and the slot machine belong to
// saveResults/deathSaves — rows here are rejection-shaped scaffolding only.
//
// Collaborator-failure ownership map (what fails -> what is still observable):
// - addEntry rejects (all four sites): console.error fires with the EXACT
//   prefix '[relentlessRage] Error:' and the SAME Error instance (identity-
//   discriminated #1385); zero unhandled rejections escape (every row flushes
//   microtasks and asserts the full console census).
// - Falsifying pairs #1297: log-fails-still-writes (success row: heal/uses
//   writes and combat-summary land while the success log rejects) and
//   store-write-fails-still-logs (uses-bump row: the failure log has already
//   landed when :194 stalls).
// - HP-gate asymmetry under log failure: HP>0 suppresses the death prompt
//   (PRESERVED-CITED-BY: relentlessRageService.deathSaves.test.js:7-8 cites
//   this row, formerly :116 — HP>0 no-spawn); HP<=0 spawns it.
// - Unguarded awaited store writes (the silent-hole census): :101 and :194
//   sit OUTSIDE any try/catch — a never-settling write (stalled POST, the
//   production shape) truncates handleSaveResult there, skips everything
//   downstream, and NEVER reaches console (golden bytes: console census stays
//   empty #1360/86 form). :195 removeEventListener then never runs; the
//   stranded-listener replay rows prove the leak. A genuine REJECTION would
//   additionally leak an unhandled rejection of the listener Promise (vitest
//   fails the file on those) — reported as a source hole, pinned as stall.
//
// :0-swallow census: addEntry sites all carry .catch (zero bare swallows);
// setRuntimeValue death-save writes :165/:177/:178 are fire-and-forget with
// NO catch — reported as a source hole (never exercised with a rejection
// here, to keep the suite rejection-free; the synchronous writes land before
// the death log is even attempted, pinned by the sync census below).
//
// Determinism #1312/#1366: vitest-4 clearAllMocks RETAINS implementations —
// save-prompt ids and death-guids come from monotonic module-level counters
// re-seeded explicitly in beforeEach, so stranded listeners from unconsumed
// rows are permanently inert and exact write censuses cannot cross-
// contaminate. No vi.waitFor anywhere: the save-result path suspends at its
// first await, so a fixed 20-tick microtask drain (flush()) is the complete,
// bounded flush; pre-flush synchronous censuses pin call order.
//
// Quirks pinned: :71 uses-read omits the campaign arg (arity-2, strict fake
// co-pins); :110 activeConditions silent-null guard fires (null seed writes
// []); :103 mutates the caller's creature.currentHp while playerComputed
// stays byte-identical (input purity #1395); HP key is 'currentHitPoints'
// canonical — the strict fake THROWS on 'hitPoints'.
// DICE: zero dice in this module — every roll is a fixed detail byte.
// NO-CLOCK: relentlessRageService.js contains zero setTimeout/setInterval/
// Date.now; error paths schedule no retries — verified by this lane's
// flush-based assertions failing loudly if a retry timer ever appears.
// PRESERVED-CITED-BY: deathSaves lane :7-8 ('errors lane :116 pins HP>0
// no-spawn') — face retained below; it now lands at a new line number
// (reported in the maintenance summary).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

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
import { sendDeathSavePrompt } from '../../combat/conditions/savePromptService.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';

const CAMPAIGN = 'test-campaign';
const NAME = 'TestBarbarian';
const PREFIX = '[relentlessRage] Error:';

// Drain every queued microtask — the complete flush for this module (no
// timers involved anywhere on these paths; eslint blocks setImmediate in
// this browser-globals config). 20 fixed ticks comfortably exceeds the
// longest awaited chain (:101/:105/:106/:107/:112/:194 + .catch hops).
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

let saveSeq = 0;
const savePromptId = () => `save-prompt-${++saveSeq}`;

function makeCreature() {
  return { name: NAME, type: 'player', currentHp: 0 };
}

function makePlayerComputed() {
  return {
    name: NAME,
    level: 11,
    allFeatures: [
      {
        name: 'Relentless Rage',
        automation: {
          type: 'reaction_save_heal',
          saveType: 'CON',
          saveDc: 10,
          dcScaling: 5,
          healExpression: '2 * barbarian_level',
        },
      },
    ],
    class: { class_levels: [{ name: 'Barbarian', level: 11 }] },
  };
}

const TRIGGER_LOG = (promptId) => ({
  type: 'ability_use',
  characterName: NAME,
  abilityName: 'Relentless Rage',
  description: `Relentless Rage triggered — ${NAME} must make CON save (DC 10)`,
  source: 'Relentless Rage',
  promptId,
});
const FAIL_LOG = {
  type: 'ability_use',
  characterName: NAME,
  abilityName: 'Relentless Rage',
  description: `${NAME} failed CON save. Relentless Rage did not activate.`,
  saveRoll: 5,
  saveBonus: 8,
  saveTotal: 13,
  saveDc: 10,
  saveSuccess: false,
  source: 'Relentless Rage',
};

// ── Strict argument-keyed store fake (#1372/#1393/#1399) ─────
// Throws on unknown owner/key/campaign/arity. A 5th skipSync arg on any
// write THROWS (#1341 position audit at these call sites). writeOverrides
// inject per-key stall behavior: () => never-settling Promise.

const READ_SPEC = {
  activeBuffs: 3,
  relentlessrageUses: 2, // quirk :71 — campaign arg omitted
  currentHitPoints: 3,
  activeConditions: 3,
  deathSaves: 3,
  deathFailures: 3,
};
const WRITE_KEYS = new Set([
  'currentHitPoints',
  'deathSaves',
  'deathFailures',
  'isDead',
  'activeConditions',
  'relentlessrageUses',
]);

function makeStore(seed, writeOverrides = {}) {
  const state = { ...seed };
  const reads = [];
  const writes = [];
  runtimeState.getRuntimeValue.mockImplementation((name, key, ...rest) => {
    if (name !== NAME) throw new Error(`errors lane: unexpected get owner '${name}'`);
    const arity = READ_SPEC[key];
    if (arity === undefined) throw new Error(`errors lane: unexpected get key '${key}'`);
    if (arity !== rest.length + 2) throw new Error(`errors lane: unexpected get arity ${rest.length + 2} for '${key}'`);
    if (arity === 3 && rest[0] !== CAMPAIGN) throw new Error(`errors lane: unexpected get campaign '${rest[0]}'`);
    reads.push(key);
    return state[key];
  });
  runtimeState.setRuntimeValue.mockImplementation((name, key, value, ...rest) => {
    if (name !== NAME) throw new Error(`errors lane: unexpected set owner '${name}'`);
    if (!WRITE_KEYS.has(key)) throw new Error(`errors lane: unexpected set key '${key}'`);
    if (rest.length !== 1 || rest[0] !== CAMPAIGN) throw new Error(`errors lane: unexpected set campaign/arity ${JSON.stringify(rest)} for '${key}'`);
    const stored = Array.isArray(value) ? [...value] : value;
    writes.push([key, stored]);
    const override = writeOverrides[key];
    if (override) return override();
    state[key] = stored;
    return Promise.resolve();
  });
  return { state, reads, writes };
}

// addEntry that rejects ONLY type-keyed entries (#1385): each rejection gets
// a distinct Error instance so console censuses identify WHICH catch fired.
function rejectLogsWhen(predicate, message) {
  const rejected = [];
  logService.addEntry.mockImplementation((campaign, entry) => {
    if (predicate(entry)) {
      const err = new Error(message);
      rejected.push(err);
      return Promise.reject(err);
    }
    return Promise.resolve({});
  });
  return rejected;
}

const dispatchSaveResult = (promptId, success) =>
  window.dispatchEvent(new CustomEvent('save-result', {
    detail: success
      ? { promptId, success: true, roll: 15, saveBonus: 8, total: 23 }
      : { promptId, success: false, roll: 5, saveBonus: 8, total: 13 },
  }));

const lastPromptId = () => createSaveListener.mock.results.at(-1).value.promptId;

// ── Tests ──────────────────────────────────────────────────────

describe('relentlessRageService - error paths', () => {
  let consoleError;
  let combatSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    // Explicit re-seed every row (#1312/#1366: never rely on retention).
    createSaveListener.mockImplementation(() => ({ promptId: savePromptId() }));
    logService.addEntry.mockResolvedValue({});
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    combatSpy = vi.fn();
    window.addEventListener('combat-summary-updated', combatSpy);
  });

  afterEach(() => {
    consoleError.mockRestore();
    window.removeEventListener('combat-summary-updated', combatSpy);
  });

  it('trigger-log rejection is caught: exact prefix, same Error, interception stands', async () => {
    const store = makeStore({ activeBuffs: [{ name: 'Rage', effect: 'stance' }], relentlessrageUses: 0 });
    const rejected = rejectLogsWhen(() => true, 'trigger-log-down');

    const ret = checkRelentlessRage(makeCreature(), makePlayerComputed(), CAMPAIGN);
    // The prompt is created BEFORE the log — a log failure cannot undo the
    // interception contract.
    expect(ret).toEqual({ intercepted: true, awaitingSave: true });
    expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, { targetName: NAME, saveType: 'CON', saveDc: 10 });
    expect(logService.addEntry.mock.calls).toEqual([[CAMPAIGN, TRIGGER_LOG(lastPromptId())]]);
    expect(store.writes).toEqual([]);

    await flush();
    expect(consoleError.mock.calls.length).toBe(1);
    expect(consoleError.mock.calls[0][0]).toBe(PREFIX);
    expect(consoleError.mock.calls[0][1]).toBe(rejected[0]);
  });

  it('success-path log rejection still commits every heal write and the summary event', async () => {
    const store = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessrageUses: 0,
      activeConditions: null, // :110 silent-null guard fires -> [] written
    });
    const rejected = rejectLogsWhen((e) => e.saveSuccess === true, 'success-log-down');
    const creature = makeCreature();
    const computed = makePlayerComputed();
    const puritySnapshot = JSON.parse(JSON.stringify(computed));

    checkRelentlessRage(creature, computed, CAMPAIGN);
    dispatchSaveResult(lastPromptId(), true);
    // Sync census: the heal write (:101) has been ATTEMPTED (recorded before
    // its await suspends) and nothing downstream has landed yet — the
    // success branch runs strictly in source order.
    expect(store.writes).toEqual([['currentHitPoints', 22]]);

    await flush();
    // log-fails-still-writes: exact full write budget, exact order, all
    // 4-arg (no skipSync), canonical 'currentHitPoints' key.
    expect(store.writes).toEqual([
      ['currentHitPoints', 22],
      ['deathSaves', [false, false, false]],
      ['deathFailures', [false, false, false]],
      ['isDead', 0],
      ['activeConditions', []],
      ['relentlessrageUses', 1],
    ]);
    expect(store.reads).toEqual(['activeBuffs', 'relentlessrageUses', 'activeConditions']);
    expect(combatSpy.mock.calls.length).toBe(1);
    // Both log calls attempted; only the success one rejected (#1385).
    expect(logService.addEntry.mock.calls.length).toBe(2);
    expect(consoleError.mock.calls.length).toBe(1);
    expect(consoleError.mock.calls[0][1]).toBe(rejected[0]);
    // Input purity: creature is mutated by design (:103), playerComputed is not.
    expect(creature.currentHp).toBe(22);
    expect(JSON.parse(JSON.stringify(computed))).toEqual(puritySnapshot);
  });

  it('failed save with HP>0 never spawns a death prompt even when its log rejects', async () => {
    const store = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessrageUses: 0,
      currentHitPoints: 5,
    });
    const rejected = rejectLogsWhen((e) => e.saveSuccess === false, 'fail-log-down');

    checkRelentlessRage(makeCreature(), makePlayerComputed(), CAMPAIGN);
    dispatchSaveResult(lastPromptId(), false);
    // Failure branch is synchronous up to :194's await: reads and the HP-gate
    // verdict are already settled before any microtask runs.
    expect(store.reads).toEqual(['activeBuffs', 'relentlessrageUses', 'currentHitPoints']);
    expect(sendDeathSavePrompt).not.toHaveBeenCalled();
    expect(store.writes).toEqual([['relentlessrageUses', 1]]); // consume-even-on-fail co-pin

    await flush();
    expect(sendDeathSavePrompt).not.toHaveBeenCalled();
    expect(combatSpy).not.toHaveBeenCalled();
    expect(consoleError.mock.calls.length).toBe(1);
    expect(consoleError.mock.calls[0][1]).toBe(rejected[0]);
  });

  it('failed save at HP<=0 still spawns the death prompt when its log rejects', () => {
    const store = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessrageUses: 0,
      currentHitPoints: 0,
    });
    rejectLogsWhen((e) => e.saveSuccess === false, 'fail-log-down');

    checkRelentlessRage(makeCreature(), makePlayerComputed(), CAMPAIGN);
    dispatchSaveResult(lastPromptId(), false);

    // Falsifying twin of the row above: identical log failure, HP<=0 flips
    // the gate — prompt dispatch (:146) sits AFTER the rejecting log (:130)
    // and still runs; no flush needed, the failure branch is synchronous.
    // The ds-listener this spawns stays unconsumed and inert (unique guid).
    expect(sendDeathSavePrompt).toHaveBeenCalledTimes(1);
    expect(sendDeathSavePrompt).toHaveBeenCalledWith(CAMPAIGN, {
      promptId: expect.stringMatching(/^test-guid-\d+$/), // monotonic fake guid (#1312)
      targetName: NAME,
    });
    expect(store.writes).toEqual([['relentlessrageUses', 1]]);
    expect(store.reads).toEqual(['activeBuffs', 'relentlessrageUses', 'currentHitPoints']);
  });

  it('death-save log rejection lands writes first, logs the error late (:187)', async () => {
    const store = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessrageUses: 0,
      currentHitPoints: 0,
      deathSaves: [false, false, false],
      deathFailures: [false, false, false],
    });
    // Only the death_save entry rejects; ability_use logs resolve (#1385).
    const rejected = rejectLogsWhen((e) => e.type === 'death_save', 'death-log-down');

    checkRelentlessRage(makeCreature(), makePlayerComputed(), CAMPAIGN);
    dispatchSaveResult(lastPromptId(), false);
    const dsPromptId = sendDeathSavePrompt.mock.calls.at(-1)[1].promptId;

    window.dispatchEvent(new CustomEvent('death-save-result', {
      // Modal-shaped detail (DeathSavePromptModal supplies all four keys).
      detail: { promptId: dsPromptId, success: false, roll: 3, isNat20: false, isNat1: false },
    }));
    // Synchronous census: :177/:178 writes are fire-and-forget and land
    // BEFORE the rejecting :180 log call is even made (uses bump :194 from
    // the earlier save-result already sits at the head).
    expect(store.reads).toEqual(['activeBuffs', 'relentlessrageUses', 'currentHitPoints', 'deathSaves', 'deathFailures']);
    expect(store.writes).toEqual([
      ['relentlessrageUses', 1],
      ['deathSaves', [false, false, false]],
      ['deathFailures', [true, false, false]],
    ]);
    expect(logService.addEntry.mock.calls.length).toBe(3); // trigger, save-fail, death
    const deathLog = logService.addEntry.mock.calls.at(-1)[1];
    expect(deathLog).toEqual({
      type: 'death_save',
      characterName: NAME,
      roll: 3,
      isNatural20: false,
      isNatural1: false,
      success: false,
    });

    await flush();
    // The :187 .catch lands only at the microtask drain: exactly one
    // console.error, exact prefix, same Error instance.
    expect(consoleError.mock.calls.length).toBe(1);
    expect(consoleError.mock.calls[0][0]).toBe(PREFIX);
    expect(consoleError.mock.calls[0][1]).toBe(rejected[0]);
  });

  it('heal-write that never settles truncates the success path silently and strands the listener (:101 unguarded)', async () => {
    // Never-settling write (a stalled network POST is the production shape
    // of this unguarded await). A genuine REJECTION here would surface as an
    // unhandled rejection of handleSaveResult — pinned as a source hole in
    // the header, not exercised, so the suite stays rejection-free.
    const HANG = () => new Promise(() => { });
    const store = makeStore(
      { activeBuffs: [{ name: 'Rage', effect: 'stance' }], relentlessrageUses: 0, activeConditions: ['unconscious'] },
      { currentHitPoints: HANG },
    );

    checkRelentlessRage(makeCreature(), makePlayerComputed(), CAMPAIGN);
    const promptId = lastPromptId();
    dispatchSaveResult(promptId, true);
    await flush();

    // Truncation: only the stalled heal attempt exists — no clears, no uses
    // bump, no success log (:114 never reached), no summary event.
    expect(store.writes).toEqual([['currentHitPoints', 22]]);
    expect(store.reads).toEqual(['activeBuffs', 'relentlessrageUses']);
    expect(logService.addEntry.mock.calls).toEqual([[CAMPAIGN, TRIGGER_LOG(promptId)]]);
    expect(combatSpy).not.toHaveBeenCalled();
    // Golden silent-hole bytes #1360/86: awaited store writes have NO catch —
    // console.error must stay byte-empty, unlike every addEntry row above.
    expect(consoleError).not.toHaveBeenCalled();

    // Stranded listener (:195 removeEventListener never ran): replaying the
    // SAME promptId is re-processed, doubling the heal-write attempts.
    dispatchSaveResult(promptId, true);
    await flush();
    expect(store.writes).toEqual([
      ['currentHitPoints', 22],
      ['currentHitPoints', 22],
    ]);
    expect(logService.addEntry.mock.calls.length).toBe(1);
  });

  it('uses-bump stall on the failure path truncates AFTER the log has landed (:194 unguarded)', async () => {
    const HANG = () => new Promise(() => { });
    const store = makeStore(
      { activeBuffs: [{ name: 'Rage', effect: 'stance' }], relentlessrageUses: 0, currentHitPoints: 5 },
      { relentlessrageUses: HANG },
    );

    checkRelentlessRage(makeCreature(), makePlayerComputed(), CAMPAIGN);
    const promptId = lastPromptId();
    dispatchSaveResult(promptId, false);
    await flush();

    // store-write-fails-still-logs (falsifying half vs row above): the
    // failure log (:130) precedes the uses bump (:194) and is already in
    // the log census when the latch write stalls; it never lands for real.
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, TRIGGER_LOG(promptId)],
      [CAMPAIGN, FAIL_LOG],
    ]);
    expect(store.writes).toEqual([['relentlessrageUses', 1]]);
    expect(sendDeathSavePrompt).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled(); // silent hole — no retry, no report

    // Listener stranded again (:195 skipped): replay doubles the log and the
    // failed latch attempt.
    dispatchSaveResult(promptId, false);
    await flush();
    expect(logService.addEntry.mock.calls.length).toBe(3);
    expect(store.writes).toEqual([
      ['relentlessrageUses', 1],
      ['relentlessrageUses', 1],
    ]);
  });
});
