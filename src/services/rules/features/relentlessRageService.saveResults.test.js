// @maintained-by-ai
//
// SAVE-RESULTS lane: pins ONLY the save-result resolution seam of
// handleSaveResult (relentlessRageService.js:92-196) — the latch WRITER
// face delegated here by check lane #1399 (header :13-14 cites this file's
// test NAME 'increments uses after save') and by deathSaves lane #1400
// (header :24 cites this file's former :159-167 uses-bump; :7 cites former
// :169 HP=0-spawn — new ranges reported in the maintenance summary).
//
// WRITER RECONCILIATION (#1399 ':159-167' vs #1400 ':194'): relentlessrageUses
// has EXACTLY ONE writer line in this module — :194, inside handleSaveResult
// AFTER the if/else, so it consumes on BOTH branches (this lane pins the
// bump-on-success half; consume-even-on-fail is pinned by every deathSaves
// row via triggerFailingSave). ':159-167' is a range in THIS TEST FILE (the
// pinning test); ':194' is the SOURCE line — same single writer, cited from
// two faces. The slot machine (:151-188) never writes the latch — it writes
// only currentHitPoints/deathSaves/deathFailures there.
//
// DEAD-KEY FIX EXECUTED HERE: the old file seeded 'hitPoints' (old :81) —
// a key the service NEVER reads (grep of relentlessRageService.js for
// standalone 'hitPoints': zero hits; canonical is 'currentHitPoints' at
// :101/:143, #1367 census). The strict argument-keyed store fake below
// THROWS on any unknown owner/key/campaign/arity (#1372), so 'hitPoints'
// has no route back in, and a 5th skipSync arg on any write THROWS (#1341
// position audit: no skipSync exists anywhere on this lane's six writes).
//
// LANE BOUNDARIES vs siblings (cited, never re-pinned): addEntry rejections,
// never-settling stalls, stranded-listener truncation, and the :110
// activeConditions silent-null (null-seed) guard are the errors lane's face
// (#1401 — its rows 3/4 are the log-REJECTION HP-gate twins; this lane pins
// the settled-log normal pair only, console census asserted EMPTY). The
// pre-prompt predicate, reader latch (arity-2 quirk :71) and DC escalation at
// prompt creation belong to check (#1399); the death-save slot machine to
// deathSaves (#1400); heal-expression evaluation in isolation to helpers
// (#1402). This lane owns what only the save seam produces: success
// write-budget VALUES driven through :95's composition (distinguishable
// #1348: Barbarian lv13 behind a lying bare level:3 → 26, never the
// canonical 22 literal #1296, never the bare-level 3), the unknown-field
// literal ZERO CLAMPED at the write (#1403: evaluator owns the 0, the WRITE
// floors it at 1 and the log mirrors the clamped value), promptId-guard :93,
// eager one-shot removal at the match (errors lane owns the stall/reject
// halves), and the exact success/failure ability_use log bytes.
// HP-key census (#1403 FIXED 2026-10-22): the heal write is now a CLAMPED
// overwrite — Math.max(1, evaluated): the raw overwrite previously propagated
// the evaluator's 0 straight into currentHitPoints while death saves sat
// cleared — the illegal alive-at-0 state. Positive values ride through
// byte-faithful (26 stays 26); 0 and negatives floor at 1, and the
// hpGained/description log bytes mirror the CLAMPED committed value, never
// the pre-clamp evaluation. NO maxHp read anywhere in the module stays true
// (grep 'maxHp|max_hp': zero) — the caster-maxHp leak class (#1393/94)
// remains structurally absent.
//
// QUIRK SCAN (#1401 UPDATED): handleSaveResult is now GUARDED — eager
// removeEventListener AT the promptId match (same id variable as the guard,
// fix#42 family) + try/catch console.error; the stall/reject halves live in
// the errors lane. Rows here use settled collaborators only. Never-executed
// guards hunted in this lane's span: ZERO found — every branch
// (guard :93, success/failure, HP-gate, filter) has a row.
// clearDeathSavePrompt was a DEAD mock in the old file (the service
// imports only sendDeathSavePrompt, :3 — live-vs-dead verdict: dead) and the
// dead 'hitPoints' seed is deleted, both per #1370 caller evidence.
// NO-CLOCK: clean — relentlessRageService.js:1-206 contains zero
// Date.now/setTimeout/setInterval (grep); saves resolve ONLY at the prompt
// seam; no expiry is stamped on this lane.
// DICE: zero dice — every roll is a fixed detail byte, suite-distinguishable
// (success 17/8/25, failure 6/8/14; errors uses 15/23 and 5/13, deathSaves
// uses 3/15/1/20 — no row in this family shares a die face with another).
// DETERMINISM #1312: vi.clearAllMocks RETAINS factory implementations but
// every load-bearing impl (save-prompt ids, addEntry resolves, store fakes)
// is EXPLICITLY re-seeded per row (#1401 rejection-retention census — no
// rejecting stub is ever installed here); utils.guid comes from a monotonic
// hoisted counter so stranded unconsumed ds-listeners are permanently inert
// and exact censuses cannot cross-contaminate. No vi.waitFor: dispatchEvent
// is synchronous up to :101's first await; a fixed 20-tick microtask drain
// (flush) is the complete bounded flush.
// PRESERVED-CITED-BY: check lane :14 NAME-pin 'increments uses after save'
// retained verbatim at :350-384; deathSaves :24 (uses-bump, formerly
// :159-167) now lands at NEW RANGE :350-384; deathSaves :7 (HP=0 spawn,
// formerly :169) now lands at NEW lines :411-417 in the settled-pair row.

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

// sendDeathSavePrompt ONLY — the service imports nothing else from this
// module (:3); clearDeathSavePrompt was a dead mock in the old file (#1370).
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

// Complete bounded flush: the success chain awaits :101/:105/:106/:107/:112/
// :194 — 20 fixed ticks comfortably exceeds it (no timers exist anywhere).
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

let saveSeq = 0;
const savePromptId = () => `save-prompt-${++saveSeq}`;
const lastPromptId = () => createSaveListener.mock.results.at(-1).value.promptId;

// Fixed detail bytes (zero dice — every roll authored here).
const SUCCESS_DETAIL = (promptId) => ({ promptId, success: true, roll: 17, saveBonus: 8, total: 25 });
const FAIL_DETAIL = (promptId) => ({ promptId, success: false, roll: 6, saveBonus: 8, total: 14 });

const TRIGGER_LOG = (promptId, dc) => ({
  type: 'ability_use',
  characterName: NAME,
  abilityName: 'Relentless Rage',
  description: `Relentless Rage triggered — ${NAME} must make CON save (DC ${dc})`,
  source: 'Relentless Rage',
  promptId,
});
const SUCCESS_LOG = (heal, dc) => ({
  type: 'ability_use',
  characterName: NAME,
  abilityName: 'Relentless Rage',
  description: `${NAME} succeeded on CON save. Relentless Rage sets Hit Points to ${heal}.`,
  saveRoll: 17,
  saveBonus: 8,
  saveTotal: 25,
  saveDc: dc,
  saveSuccess: true,
  hpGained: heal,
  source: 'Relentless Rage',
});
const FAIL_LOG = (dc) => ({
  type: 'ability_use',
  characterName: NAME,
  abilityName: 'Relentless Rage',
  description: `${NAME} failed CON save. Relentless Rage did not activate.`,
  saveRoll: 6,
  saveBonus: 8,
  saveTotal: 14,
  saveDc: dc,
  saveSuccess: false,
  source: 'Relentless Rage',
});

function makeCreature() {
  return { name: NAME, type: 'player', currentHp: 0 };
}

// lv13 Barbarian behind a LYING bare level:3 — the heal 26 distinguishes
// expression-driven composition (:95 → getBarbarianLevel class chain) from
// any literal-22, bare-level-3, or level-fallback mutation (#1296/#1348).
// Only checkRelentlessRage is a production consumer of this module
// (applyDamage.js:24, helpers lane census) — entered via the full seam.
function makeComputed(barbarianLevel = 13, healExpression = '2 * barbarian_level') {
  return {
    name: NAME,
    level: 3,
    allFeatures: [
      {
        name: 'Relentless Rage',
        automation: {
          type: 'reaction_save_heal',
          saveType: 'CON',
          saveDc: 10,
          dcScaling: 5,
          healExpression,
        },
      },
    ],
    class: { class_levels: [{ name: 'Barbarian', level: barbarianLevel }] },
  };
}

// ── Strict argument-keyed store fake (#1372/#1393/#1399) ─────
// Throws on unknown owner/key/campaign/arity: retired 'hitPoints' reads are
// structurally impossible (dead-seed regression guard), 5-arg skipSync writes
// THROW (#1341). deathSaves/deathFailures are READ-forbidden here — only
// the slot machine (:156-157) reads them and this lane never feeds it an
// event (the ds listener spawned by the failure row stays unconsumed; the
// monotonic guid keeps it permanently inert).
const READ_SPEC = {
  activeBuffs: 3,
  relentlessrageUses: 2, // quirk :71 — campaign arg omitted (check lane co-pin)
  currentHitPoints: 3, // failure-branch gate :143 only — success never reads HP
  activeConditions: 3, // success-branch :109 only
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
  const state = { ...seed };
  const reads = [];
  const writes = [];
  runtimeState.getRuntimeValue.mockImplementation((name, key, ...rest) => {
    if (name !== NAME) throw new Error(`saveResults lane: unexpected get owner '${name}'`);
    const arity = READ_SPEC[key];
    if (arity === undefined) throw new Error(`saveResults lane: unexpected get key '${key}'`);
    if (arity !== rest.length + 2) throw new Error(`saveResults lane: unexpected get arity ${rest.length + 2} for '${key}'`);
    if (arity === 3 && rest[0] !== CAMPAIGN) throw new Error(`saveResults lane: unexpected get campaign '${rest[0]}'`);
    reads.push(key);
    return state[key];
  });
  runtimeState.setRuntimeValue.mockImplementation((name, key, value, ...rest) => {
    if (name !== NAME) throw new Error(`saveResults lane: unexpected set owner '${name}'`);
    if (!WRITE_KEYS.has(key)) throw new Error(`saveResults lane: unexpected set key '${key}'`);
    if (rest.length !== 1 || rest[0] !== CAMPAIGN) throw new Error(`saveResults lane: unexpected set campaign/arity ${JSON.stringify(rest)} for '${key}'`);
    const stored = Array.isArray(value) ? [...value] : value;
    writes.push([key, stored]);
    state[key] = stored;
    return Promise.resolve();
  });
  return { state, reads, writes };
}

// ── Tests ──────────────────────────────────────────────────────

describe('relentlessRageService - save result handling', () => {
  let combatSpy;
  let consoleError;

  beforeEach(() => {
    vi.clearAllMocks(); // RETAINS guid factory impl (#1312) — everything else re-seeded
    createSaveListener.mockImplementation(() => ({ promptId: savePromptId() }));
    logService.addEntry.mockResolvedValue({}); // settled logs ONLY — rejections are errors lane
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    combatSpy = vi.fn();
    window.addEventListener('combat-summary-updated', combatSpy);
  });

  afterEach(() => {
    consoleError.mockRestore();
    window.removeEventListener('combat-summary-updated', combatSpy);
  });

  it('success writes the full heal/clear/bump budget once with expression-driven HP and exact log bytes', async () => {
    const store = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessrageUses: 0,
      activeConditions: ['Unconscious', 'blinded'], // case bait :111 — lowercased match filters only unconscious
    });
    const creature = makeCreature();
    const computed = makeComputed(); // lv13 Barbarian, lying level:3 → heal 26

    checkRelentlessRage(creature, computed, CAMPAIGN);
    const promptId = lastPromptId();
    window.dispatchEvent(new CustomEvent('save-result', { detail: SUCCESS_DETAIL(promptId) }));
    // Synchronous census: the :101 heal write is ATTEMPTED (recorded before
    // its await suspends) and nothing downstream has run — source order.
    expect(store.writes).toEqual([['currentHitPoints', 26]]);

    await flush();

    // Exact six-write budget, exact order, every write 4-arg (a 5th
    // skipSync arg THROWS #1341). currentHitPoints is a RAW overwrite —
    // no clamp, no maxHp read anywhere in this module (#1393/94 class:
    // structurally absent, verified by grep).
    expect(store.writes).toEqual([
      ['currentHitPoints', 26],
      ['deathSaves', [false, false, false]],
      ['deathFailures', [false, false, false]],
      ['isDead', 0],
      ['activeConditions', ['blinded']],
      ['relentlessrageUses', 1],
    ]);
    expect(store.reads).toEqual(['activeBuffs', 'relentlessrageUses', 'activeConditions']);
    expect(store.state.currentHitPoints).toBe(26);
    expect(creature.currentHp).toBe(26); // :103 mutates the caller's creature by design
    // Exact log census — trigger + success entries, byte-identical, em-dash
    // included; the survivor 'blinded' is never logged and no failure/death
    // entry exists.
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, TRIGGER_LOG(promptId, 10)],
      [CAMPAIGN, SUCCESS_LOG(26, 10)],
    ]);
    expect(Object.keys(logService.addEntry.mock.calls[1][1])).toEqual([
      'type', 'characterName', 'abilityName', 'description', 'saveRoll', 'saveBonus',
      'saveTotal', 'saveDc', 'saveSuccess', 'hpGained', 'source',
    ]);
    expect(combatSpy.mock.calls.length).toBe(1);
    expect(consoleError).not.toHaveBeenCalled(); // settled path — silent stays silent

    // One-shot :195: replaying the RESOLVED promptId is inert (the errors
    // lane pins the opposite half — a STALLED :101 strands the listener).
    window.dispatchEvent(new CustomEvent('save-result', { detail: SUCCESS_DETAIL(promptId) }));
    await flush();
    expect(store.writes.length).toBe(6);
    expect(logService.addEntry.mock.calls.length).toBe(2);
    expect(combatSpy.mock.calls.length).toBe(1);

    // #1403 clamp falsifier at the caller: helpers turn '5 * charisma' into
    // literal 0 (and 0 * level into 0); the WRITE of that 0 is owned here and
    // floors it at 1 — relentless rage never lands its creature alive-at-0
    // with cleared death saves. Log bytes mirror the CLAMPED committed value.
    const zeroStore = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessrageUses: 0,
      activeConditions: ['stunned'], // filter targets ONLY unconscious — survivor unchanged
    });
    const zeroCreature = makeCreature();
    checkRelentlessRage(zeroCreature, makeComputed(13, '5 * charisma'), CAMPAIGN);
    const zeroPromptId = lastPromptId();
    window.dispatchEvent(new CustomEvent('save-result', { detail: SUCCESS_DETAIL(zeroPromptId) }));
    await flush();
    expect(zeroStore.writes).toEqual([
      ['currentHitPoints', 1],
      ['deathSaves', [false, false, false]],
      ['deathFailures', [false, false, false]],
      ['isDead', 0],
      ['activeConditions', ['stunned']],
      ['relentlessrageUses', 1],
    ]);
    expect(zeroCreature.currentHp).toBe(1);
    expect(logService.addEntry.mock.calls.slice(2)).toEqual([
      [CAMPAIGN, TRIGGER_LOG(zeroPromptId, 10)],
      [CAMPAIGN, SUCCESS_LOG(1, 10)],
    ]);
    expect(zeroStore.reads).toEqual(['activeBuffs', 'relentlessrageUses', 'activeConditions']);
    expect(consoleError).not.toHaveBeenCalled();

    // #1348 clamp arm: negative evaluation floors at 1 too (distinguishable
    // from the 0 arm only via the store — both commit the identical lawful 1).
    const negStore = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessrageUses: 0,
      activeConditions: [],
    });
    const negCreature = makeCreature();
    checkRelentlessRage(negCreature, makeComputed(13, -5), CAMPAIGN);
    const negPromptId = lastPromptId();
    window.dispatchEvent(new CustomEvent('save-result', { detail: SUCCESS_DETAIL(negPromptId) }));
    await flush();
    expect(negStore.writes[0]).toEqual(['currentHitPoints', 1]);
    expect(negCreature.currentHp).toBe(1);
    expect(logService.addEntry.mock.calls.at(-1)).toEqual([CAMPAIGN, SUCCESS_LOG(1, 10)]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  // Name retained VERBATIM — cited by check lane header :14 (#1399).
  it('increments uses after save', async () => {
    const store = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessrageUses: 0,
      activeConditions: [],
    });
    const computed = makeComputed();

    // First success: the single writer :194 bumps 0 -> 1 exactly once,
    // AFTER the branch (full-set tail of the row above co-pins position).
    checkRelentlessRage(makeCreature(), computed, CAMPAIGN);
    window.dispatchEvent(new CustomEvent('save-result', { detail: SUCCESS_DETAIL(lastPromptId()) }));
    await flush();
    expect(store.writes.filter((w) => w[0] === 'relentlessrageUses')).toEqual([['relentlessrageUses', 1]]);
    expect(store.state.relentlessrageUses).toBe(1);

    // Second fresh trigger after consume (#1307 stateful compose): the
    // reader :71 now sees 1, so DC 15 mirrors into THIS lane's log byte
    // (check lane pins DC only at prompt creation / trigger log). Heal
    // re-evaluates 26, latch lands exactly once more: 1 -> 2, never 3.
    checkRelentlessRage(makeCreature(), computed, CAMPAIGN);
    const p2 = lastPromptId();
    window.dispatchEvent(new CustomEvent('save-result', { detail: SUCCESS_DETAIL(p2) }));
    await flush();
    expect(store.writes.filter((w) => w[0] === 'relentlessrageUses')).toEqual([
      ['relentlessrageUses', 1],
      ['relentlessrageUses', 2],
    ]);
    expect(store.state.relentlessrageUses).toBe(2);
    expect(logService.addEntry.mock.calls.filter(([, e]) => e?.saveSuccess === true).map(([, e]) => e)).toEqual([
      SUCCESS_LOG(26, 10),
      SUCCESS_LOG(26, 15),
    ]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('failed save pair: HP>0 spawns nothing, HP<=0 spawns the death prompt once, logs settled', async () => {
    const store = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessrageUses: 0,
      currentHitPoints: 7, // >0 half; errors lane owns the rejection twins at 5/0 (#1401)
    });
    const computed = makeComputed();

    checkRelentlessRage(makeCreature(), computed, CAMPAIGN);
    const p1 = lastPromptId();
    window.dispatchEvent(new CustomEvent('save-result', { detail: FAIL_DETAIL(p1) }));
    // Failure branch is synchronous up to :194's await: gate read and
    // consume-even-on-fail write are settled before any microtask runs.
    expect(store.reads).toEqual(['activeBuffs', 'relentlessrageUses', 'currentHitPoints']);
    expect(store.writes).toEqual([['relentlessrageUses', 1]]); // no heal, no clears, no isDead
    expect(sendDeathSavePrompt).not.toHaveBeenCalled();

    await flush();
    expect(sendDeathSavePrompt).not.toHaveBeenCalled();
    expect(combatSpy).not.toHaveBeenCalled();

    // HP<=0 flip of the same gate (:144) with the log RESOLVING (errors
    // lane's :333 row is the rejecting twin): spawns exactly one prompt
    // (negative byte — distinct from errors' 0 seed). The ds listener it
    // registers is never fed an event here — slot machine is deathSaves.
    store.state.currentHitPoints = -2;
    checkRelentlessRage(makeCreature(), computed, CAMPAIGN);
    const p2 = lastPromptId();
    window.dispatchEvent(new CustomEvent('save-result', { detail: FAIL_DETAIL(p2) }));
    expect(sendDeathSavePrompt).toHaveBeenCalledTimes(1);
    const dsCall = sendDeathSavePrompt.mock.calls[0];
    expect(dsCall[0]).toBe(CAMPAIGN);
    expect(dsCall[1]).toEqual({ promptId: dsCall[1].promptId, targetName: NAME }); // exact key set

    await flush();
    expect(store.writes).toEqual([['relentlessrageUses', 1], ['relentlessrageUses', 2]]);
    expect(store.reads).toEqual([
      'activeBuffs', 'relentlessrageUses', 'currentHitPoints',
      'activeBuffs', 'relentlessrageUses', 'currentHitPoints',
    ]);
    // p2 rides uses=1: DC escalates to 15 and mirrors through BOTH failure
    // log bytes (check lane pins DC only on the trigger path pre-resolution).
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, TRIGGER_LOG(p1, 10)],
      [CAMPAIGN, FAIL_LOG(10)],
      [CAMPAIGN, TRIGGER_LOG(p2, 15)],
      [CAMPAIGN, FAIL_LOG(15)],
    ]);
    expect(consoleError).not.toHaveBeenCalled(); // settled pair — zero console traffic
  });

  it('foreign promptIds are ignored by the guard :93 and the matching id still commits', async () => {
    const store = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessrageUses: 0,
      activeConditions: ['unconscious'],
    });

    checkRelentlessRage(makeCreature(), makeComputed(), CAMPAIGN);
    const promptId = lastPromptId();

    // Guard returns synchronously, BEFORE heal evaluation: zero store
    // traffic beyond the two trigger reads, no second log, no prompt.
    window.dispatchEvent(new CustomEvent('save-result', { detail: SUCCESS_DETAIL('not-my-prompt') }));
    expect(store.writes).toEqual([]);
    expect(store.reads).toEqual(['activeBuffs', 'relentlessrageUses']);
    expect(logService.addEntry.mock.calls.length).toBe(1);
    expect(sendDeathSavePrompt).not.toHaveBeenCalled();
    expect(combatSpy).not.toHaveBeenCalled();

    // Falsifying half: the guard FILTERED — the listener is alive.
    window.dispatchEvent(new CustomEvent('save-result', { detail: SUCCESS_DETAIL(promptId) }));
    await flush();
    expect(store.writes).toEqual([
      ['currentHitPoints', 26],
      ['deathSaves', [false, false, false]],
      ['deathFailures', [false, false, false]],
      ['isDead', 0],
      ['activeConditions', []],
      ['relentlessrageUses', 1],
    ]);
    expect(store.state.currentHitPoints).toBe(26);

    // Resolved once -> self-removed :195: neither id does anything more.
    window.dispatchEvent(new CustomEvent('save-result', { detail: SUCCESS_DETAIL(promptId) }));
    window.dispatchEvent(new CustomEvent('save-result', { detail: SUCCESS_DETAIL('not-my-prompt') }));
    await flush();
    expect(store.writes.length).toBe(6);
    expect(logService.addEntry.mock.calls.length).toBe(2);
    expect(combatSpy.mock.calls.length).toBe(1);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
