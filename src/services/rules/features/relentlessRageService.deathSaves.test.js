// @maintained-by-ai
//
// DEATH-SAVES lane (#1399: "deathSaves owns the downstream slot machine").
// Pins ONLY handleDeathSaveResult (relentlessRageService.js:151-188), the
// listener registered INSIDE the save-failure branch AFTER sendDeathSavePrompt
// (:146). Its HP-gate (:143-144 Number(currentHp) <= 0) and prompt dispatch is
// the saveResults lane (:169 pins HP=0 spawn; errors lane :116 pins HP>0
// no-spawn) — old standalone gate rows here were dups and are folded into the
// trigger fixture's exact-envelope assertion below.
//
// STATE KEYS OWNED HERE (exact): READ deathSaves :156 and deathFailures :157
// (campaign always passed; strict arg-keyed store fake THROWS on any other
// owner/key/arity, so the read-order census [['deathSaves'],['deathFailures']]
// per event and the absent 'activeConditions' key are structural). WRITE
// deathSaves :177 and deathFailures :178 UNCONDITIONALLY (full-set rewrite
// every resolution, even when no slot is empty — no-op rows pin the budget);
// currentHitPoints :165 canonical HP key (#1367), value exactly 1, no clamp
// arithmetic, nat20 only. 'isDead' is ABSENT from the write allowlist: this
// lane never marks death (modal :103-105 / saveResults :107 own that byte).
//
// LATCH PAIR (#1358/#1399): relentlessRageActive does not exist as a store key
// in this module — the latch pair is relentlessrageUses: READER :71 (arity-2
// quirk, campaign arg omitted — pinned by check lane #1399), WRITER :194
// (saveResults lane :159-167 pins the bump on success; every row here pins
// consume-even-on-fail: each failing trigger bumps uses BEFORE any
// death-save-result can land, :194 runs synchronously in the failure branch).
// THIRD FACE verdict: no third writer/reader of the uses latch in this module.
// There IS a third FACE on the death keys: DeathSavePromptModal.jsx:101-102
// inline-writes deathSaves/deathFailures from detail.newSaves/newFailures on
// the SAME 'death-save-result' event this listener consumes (inline-dup at the
// chokepoint). Our lane must ignore the detail arrays — the poison row pins
// that :156-157 recompute-from-store wins over lying detail bytes.
//
// Quirks pinned/hunted:
// - one-shot listener: removeEventListener :153 fires BEFORE processing, so a
//   replay of the same promptId is inert (mismatch/replay row; :152 guard runs
//   on mismatch too).
// - never-executed-guard fired honestly: log success fallback :186
//   (result === 'stable'/'nat20') is unreachable with modal payloads because
//   isSuccessResult already maps both to success:true (:10-11) — the malformed
//   row feeds success:false + result:'stable' and pins the DIVERGENCE: the
//   slot machine fails (:166 reads dsResult.success) while the log claims
//   success. Real quirk, reported.
// - declared-not-executed: :156-157 '||' guards falsy only; a truthy
//   NON-ARRAY store value makes [...currentSaves] (:159) throw TypeError
//   inside the jsdom listener (unguarded, :1360 class) — jsdom swallows
//   listener exceptions so console discrimination is unreliable here; reported
//   as a source hole instead.
// - NO-CLOCK: clean census — relentlessRageService.js:1-206 contains zero
//   Date.now/setTimeout/setInterval; all advancement is event-seam driven
//   (save-result -> prompt -> one death-save-result). Assertions here are
//   fully synchronous because dispatchEvent is sync and every slot-machine
//   write is a fire-and-forget (not awaited) 4-arg call — the strict fake
//   records synchronously and any 5th skipSync arg would THROW (#1341
//   position audit: no skipSync exists anywhere on this lane's writes).
//
// DICE: rolls never come from real dice — every d20 outcome is a fixed detail
// byte per row, discriminable across the suite (nat20=20, success=15/10,
// fail=5/3, nat1=1). vi.clearAllMocks RETAINS the guid/savePrompt
// implementations (#1312 — load-bearing: monotonically-unique prompt ids make
// stale listeners from unconsumed rows permanently inert, so row residue
// cannot cross-contaminate the exact write censuses); store fakes are
// explicitly re-seeded per row via makeStore (#1307/#1319 compose).
//
// PRESERVED-CITED-BY: none — grep found no file citing this lane's ranges.
// Old rows folded here: nat20/success/fail/nat1/null-array/partial-array/
// all-filled cases now ride exact per-round envelopes in the chains.

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  addEntry: vi.fn().mockResolvedValue({}),
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

// Retained across clearAllMocks (#1312): unique save-prompt ids per trigger.
let saveSeq = 0;
createSaveListener.mockImplementation(() => ({ promptId: `save-prompt-${++saveSeq}` }));

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
    class: {
      class_levels: [{ name: 'Barbarian', level: 11 }],
    },
  };
}

// ── Strict argument-keyed store fake (#1372/#1393/#1399) ─────
// Throws on unknown owner/key/campaign/arity. activeConditions and isDead are
// deliberately absent: any read/write of them on this lane THROWS, proving the
// heal path never runs and death is never marked here.

const READ_SPEC = {
  activeBuffs: 3,
  relentlessrageUses: 2, // quirk byte :71 — campaign arg omitted (check lane co-pins)
  currentHitPoints: 3,
  deathSaves: 3,
  deathFailures: 3,
};
const WRITE_KEYS = new Set(['relentlessrageUses', 'deathSaves', 'deathFailures', 'currentHitPoints']);

function makeStore(seed) {
  const state = { ...seed };
  const reads = [];
  const writes = [];
  const store = {
    state,
    reads,
    writes,
    get(name, key, ...rest) {
      if (name !== NAME) throw new Error(`deathSaves lane: unexpected get owner '${name}'`);
      const arity = READ_SPEC[key];
      if (arity === undefined) throw new Error(`deathSaves lane: unexpected get key '${key}'`);
      if (arity !== rest.length + 2) throw new Error(`deathSaves lane: unexpected get arity ${rest.length + 2} for '${key}'`);
      if (arity === 3 && rest[0] !== CAMPAIGN) throw new Error(`deathSaves lane: unexpected get campaign '${rest[0]}'`);
      reads.push([key, ...rest]);
      return state[key];
    },
    set(name, key, value, ...rest) {
      if (name !== NAME) throw new Error(`deathSaves lane: unexpected set owner '${name}'`);
      if (!WRITE_KEYS.has(key)) throw new Error(`deathSaves lane: unexpected set key '${key}'`);
      if (rest.length !== 1 || rest[0] !== CAMPAIGN) throw new Error(`deathSaves lane: unexpected set campaign/arity ${JSON.stringify(rest)} for '${key}'`);
      const stored = Array.isArray(value) ? [...value] : value;
      writes.push([key, stored]);
      state[key] = stored;
      return Promise.resolve();
    },
  };
  runtimeState.getRuntimeValue.mockImplementation(store.get);
  runtimeState.setRuntimeValue.mockImplementation(store.set);
  return store;
}

// Trigger: full check + failing CON save. Returns the captured death prompt.
// Every failing trigger synchronously bumps the uses latch (:194) — the
// consume-even-on-fail half of the latch pair — and dispatches the prompt
// (:146) with an exact envelope captured from the mock.
function triggerFailingSave(store, saveRoll) {
  const creature = { name: NAME, type: 'player', currentHp: 0 };
  const usesAtTrigger = store.state.relentlessrageUses;
  const wBefore = store.writes.length;
  const rBefore = store.reads.length;

  const ret = checkRelentlessRage(creature, makePlayerComputed(), CAMPAIGN);
  expect(ret).toEqual({ intercepted: true, awaitingSave: true });

  window.dispatchEvent(new CustomEvent('save-result', {
    detail: {
      promptId: createSaveListener.mock.results.at(-1).value.promptId,
      success: false,
      roll: saveRoll,
      saveBonus: 8,
      total: saveRoll + 8,
    },
  }));

  expect(store.writes.slice(wBefore)).toEqual([['relentlessrageUses', usesAtTrigger + 1]]);
  expect(store.reads.slice(rBefore)).toEqual([
    ['activeBuffs', CAMPAIGN],
    ['relentlessrageUses'],
    ['currentHitPoints', CAMPAIGN],
  ]);

  const promptCall = sendDeathSavePrompt.mock.calls.at(-1);
  expect(promptCall[0]).toBe(CAMPAIGN);
  expect(promptCall[1]).toEqual({ promptId: promptCall[1].promptId, targetName: NAME });
  return { creature, deathPromptId: promptCall[1].promptId };
}

// One death-save-result dispatch: fixed detail bytes, synchronous effect.
// Returns the exact write+read envelopes this event produced.
function dispatchDeath(store, deathPromptId, detail) {
  const wBefore = store.writes.length;
  const rBefore = store.reads.length;
  window.dispatchEvent(new CustomEvent('death-save-result', {
    detail: { promptId: deathPromptId, ...detail },
  }));
  return { writes: store.writes.slice(wBefore), reads: store.reads.slice(rBefore) };
}

function deathLogs() {
  return logService.addEntry.mock.calls
    .filter((call) => call[0] === CAMPAIGN && call[1]?.type === 'death_save')
    .map((call) => call[1]);
}

// ── Tests ──────────────────────────────────────────────────────

describe('relentlessRageService - death save slot machine', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // RETAINS nextGuid/saveSeq impls (#1312) — re-seed below
  });

  it('composes a four-trigger chain from null seeds: accumulate, nat1 double-clamp, nat20 resurrect at canonical HP key 1', () => {
    const store = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessrageUses: 0,
      currentHitPoints: '-5', // string byte — pins Number() coercion at gate :144
      deathSaves: null,       // :156 default applies
      deathFailures: null,    // :157 default applies
    });

    const r1 = triggerFailingSave(store, 5);
    // death slots are NOT read before the first death-save-result
    expect(store.reads).toEqual([
      ['activeBuffs', CAMPAIGN],
      ['relentlessrageUses'],
      ['currentHitPoints', CAMPAIGN],
    ]);

    // round 1 — plain fail roll 3: null defaults, first fail at index 0
    const d1 = dispatchDeath(store, r1.deathPromptId, { roll: 3, isNat20: false, isNat1: false, success: false, result: 'failure' });
    expect(d1.reads).toEqual([['deathSaves', CAMPAIGN], ['deathFailures', CAMPAIGN]]);
    expect(d1.writes).toEqual([
      ['deathSaves', [false, false, false]],
      ['deathFailures', [true, false, false]],
    ]);

    // round 2 — success roll 15: save slot fills, failures rewritten unchanged
    const r2 = triggerFailingSave(store, 5);
    const d2 = dispatchDeath(store, r2.deathPromptId, { roll: 15, isNat20: false, isNat1: false, success: true, result: 'success' });
    expect(d2.writes).toEqual([
      ['deathSaves', [true, false, false]],
      ['deathFailures', [true, false, false]],
    ]);

    // round 3 — nat1 double fail roll 1: fills BOTH remaining slots
    const r3 = triggerFailingSave(store, 5);
    const d3 = dispatchDeath(store, r3.deathPromptId, { roll: 1, isNat20: false, isNat1: true, success: false, result: 'failure' });
    expect(d3.writes).toEqual([
      ['deathSaves', [true, false, false]],
      ['deathFailures', [true, true, true]],
    ]);

    // round 4 — nat20 roll 20: HP=1 first (:165), then both clears (:177-178), exact order
    const r4 = triggerFailingSave(store, 5);
    const d4 = dispatchDeath(store, r4.deathPromptId, { roll: 20, isNat20: true, isNat1: false, success: true, result: 'nat20' });
    expect(d4.writes).toEqual([
      ['currentHitPoints', 1],
      ['deathSaves', [false, false, false]],
      ['deathFailures', [false, false, false]],
    ]);
    expect(store.state.currentHitPoints).toBe(1);
    // quirk purity: the creature input object is NEVER healed here (:103 is the
    // saveResults success branch only) — store says 1 HP, creature still says 0
    expect(r4.creature).toEqual({ name: NAME, type: 'player', currentHp: 0 });

    // four triggers, four consumed uses; four distinct prompt ids
    expect(store.state.relentlessrageUses).toBe(4);
    expect(new Set([r1.deathPromptId, r2.deathPromptId, r3.deathPromptId, r4.deathPromptId]).size).toBe(4);

    // exact death_save log bytes, one per event, in order
    expect(deathLogs()).toEqual([
      { type: 'death_save', characterName: NAME, roll: 3, isNatural20: false, isNatural1: false, success: false },
      { type: 'death_save', characterName: NAME, roll: 15, isNatural20: false, isNatural1: false, success: true },
      { type: 'death_save', characterName: NAME, roll: 1, isNatural20: false, isNatural1: true, success: false },
      { type: 'death_save', characterName: NAME, roll: 20, isNatural20: true, isNatural1: false, success: true },
    ]);
    expect(Object.keys(deathLogs()[0])).toEqual(['type', 'characterName', 'roll', 'isNatural20', 'isNatural1', 'success']);
  });

  it('holds the third-success stabilization boundary open and keeps re-writing the full set when no slot is empty', () => {
    const store = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessrageUses: 0,
      currentHitPoints: -1,
      deathSaves: [false, false, false],
      deathFailures: [false, false, false],
    });

    const rolls = [10, 15, 15, 15];
    const expectedSaves = [
      [true, false, false],
      [true, true, false],
      [true, true, true],  // third success: boundary crossed, exactly three trues
      [true, true, true],  // all filled: still an unconditional full-set rewrite
    ];
    for (let round = 0; round < 4; round++) {
      const r = triggerFailingSave(store, 5);
      const d = dispatchDeath(store, r.deathPromptId, { roll: rolls[round], isNat20: false, isNat1: false, success: true, result: 'success' });
      expect(d.writes).toEqual([
        ['deathSaves', expectedSaves[round]],
        ['deathFailures', [false, false, false]],
      ]);
    }

    // stable does NOT heal and does NOT mark death on this lane — exact key-set
    expect([...new Set(store.writes.map((w) => w[0]))]).toEqual(['relentlessrageUses', 'deathSaves', 'deathFailures']);
    expect(store.state.currentHitPoints).toBe(-1);
  });

  it('scans fail slots lowest-index-first, double-fills a nat1, clamps at the third failure, and re-writes when full', () => {
    const store = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessrageUses: 0,
      currentHitPoints: -1,
      deathSaves: [true, false, false],   // truthy existing arrays are consumed as-is
      deathFailures: [false, true, false],
    });

    // plain fail from [F,T,F] fills index 0 even though index 1 is occupied —
    // pins the forward firstEmpty scan (:172), producing [T,T,F]
    const r1 = triggerFailingSave(store, 5);
    const d1 = dispatchDeath(store, r1.deathPromptId, { roll: 5, isNat20: false, isNat1: false, success: false, result: 'failure' });
    expect(d1.writes).toEqual([
      ['deathSaves', [true, false, false]],
      ['deathFailures', [true, true, false]],
    ]);

    // nat1 double fail from [T,T,F]: fills idx 2, second iteration clamps (indexOf -1, :173)
    const r2 = triggerFailingSave(store, 5);
    const d2 = dispatchDeath(store, r2.deathPromptId, { roll: 1, isNat20: false, isNat1: true, success: false, result: 'failure' });
    expect(d2.writes).toEqual([
      ['deathSaves', [true, false, false]],
      ['deathFailures', [true, true, true]],
    ]);

    // failure on an all-filled board: no-op, but the full-set rewrite still lands
    const r3 = triggerFailingSave(store, 5);
    const d3 = dispatchDeath(store, r3.deathPromptId, { roll: 5, isNat20: false, isNat1: false, success: false, result: 'failure' });
    expect(d3.writes).toEqual([
      ['deathSaves', [true, false, false]],
      ['deathFailures', [true, true, true]],
    ]);
    // third failure never writes isDead here (the strict fake would have thrown)
    expect(store.state.currentHitPoints).toBe(-1);
  });

  it('ignores lying modal detail arrays — recompute from store wins (chokepoint inline-dup: DeathSavePromptModal.jsx:101-102)', () => {
    const store = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessrageUses: 0,
      currentHitPoints: -1,
      deathSaves: [false, false, false],
      deathFailures: [false, false, false],
    });

    const r = triggerFailingSave(store, 5);
    // production modal payload shape (DeathSavePromptModal.jsx:14-25) with POISON arrays
    const d = dispatchDeath(store, r.deathPromptId, {
      roll: 15, isNat20: false, isNat1: false, success: true, result: 'success',
      newSaves: [true, true, true], newFailures: [true, true, true], restoredToHp: 5,
      targetName: NAME,
    });
    expect(d.writes).toEqual([
      ['deathSaves', [true, false, false]],  // computed, not the poisoned [T,T,T]
      ['deathFailures', [false, false, false]],
    ]);
    // restoredToHp:5 on the detail is ignored — HP untouched outside nat20
    expect(store.state.currentHitPoints).toBe(-1);
  });

  it('quirk pin: success:false + result:"stable" fails the slot machine while the log fallback :186 claims success', () => {
    const store = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessrageUses: 0,
      currentHitPoints: -1,
      deathSaves: [false, false, false],
      deathFailures: [false, false, false],
    });

    const r = triggerFailingSave(store, 5);
    const d = dispatchDeath(store, r.deathPromptId, { roll: 10, isNat20: false, isNat1: false, success: false, result: 'stable' });
    // branch :166 reads dsResult.success -> else path advances a FAILURE
    expect(d.writes).toEqual([
      ['deathSaves', [false, false, false]],
      ['deathFailures', [true, false, false]],
    ]);
    // log :186 fallback fires -> success:true (divergence; unreachable for modal producers)
    expect(deathLogs()).toEqual([
      { type: 'death_save', characterName: NAME, roll: 10, isNatural20: false, isNatural1: false, success: true },
    ]);
  });

  it('guards the prompt seam: mismatched promptId does nothing, the matching event consumes once, replay is inert', () => {
    const store = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessrageUses: 0,
      currentHitPoints: -1,
      deathSaves: [false, false, false],
      deathFailures: [false, false, false],
    });

    const r = triggerFailingSave(store, 5);

    // stranger event: guard :152 returns WITHOUT deregistering; zero writes/logs
    const wrong = dispatchDeath(store, 'wrong-prompt-id', { roll: 20, isNat20: true, isNat1: false, success: true, result: 'nat20' });
    expect(wrong.writes).toEqual([]);
    expect(deathLogs()).toEqual([]);

    // matching event: consumes exactly once
    const ok = dispatchDeath(store, r.deathPromptId, { roll: 15, isNat20: false, isNat1: false, success: true, result: 'success' });
    expect(ok.writes).toEqual([
      ['deathSaves', [true, false, false]],
      ['deathFailures', [false, false, false]],
    ]);
    expect(deathLogs()).toHaveLength(1);

    // replay of the SAME promptId: listener self-removed at :153 before processing
    const replay = dispatchDeath(store, r.deathPromptId, { roll: 20, isNat20: true, isNat1: false, success: true, result: 'nat20' });
    expect(replay.writes).toEqual([]);
    expect(deathLogs()).toHaveLength(1);
  });
});
