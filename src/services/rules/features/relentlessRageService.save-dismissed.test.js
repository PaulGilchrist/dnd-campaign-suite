// @maintained-by-ai 2026-11-16
//
// SAVE-DISMISSED lane (2026-11-16 TA): RR is a fire-and-forget
// createSaveListener producer — before the logSaveDismissed opt-in, a GM
// Dismiss on the un-rolled Relentless Rage prompt detached savePrompt.js's
// own companion but left THIS module's raw `save-result` listener armed
// forever and the ledger holding a `Relentless Rage triggered` row with no
// resolution (creature parked at 0 HP). Rows here pin the opt-in shape
// mirrored from saveOnlyHandler / the save-dismissed sweep family:
//
//  • matching save-dismissed detaches BOTH producer listeners and logs
//    exactly one refusal via the shared logSaveDismissed seam (the row SHAPE
//    itself is pinned by savePrompt.log-save-dismissed.test.js — this lane
//    pins the CALL arguments naming 'Relentless Rage');
//  • ZERO state writes on dismissal: no relentlessRageUses bump, no HP
//    write, no death-save FSM spawn;
//  • the answered-Roll path stays byte-identical (no extra/duplicate rows)
//    and detaches the dismissed companion — a trailing save-dismissed cannot
//    log a phantom refusal;
//  • dismissal detaches the result listener too — a late save-result echo is
//    inert;
//  • foreign promptIds stay inert for both events (mismatch guards).
//
// Collaborator mocks mirror the saveResults lane; the store fake records
// every read/write so the zero-write budget is census-enforced.
// NO-CLOCK / DICE: clean — fixed detail bytes, no timers.

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
  logSaveDismissed: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({
  default: { guid: vi.fn(() => nextGuid()) },
}));

// ── Imports ────────────────────────────────────────────────────

import { checkRelentlessRage } from './relentlessRageService.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../ui/logService.js';
import { sendDeathSavePrompt } from '../../combat/conditions/savePromptService.js';
import { createSaveListener, logSaveDismissed } from '../../automation/common/savePrompt.js';

const CAMPAIGN = 'test-campaign';
const NAME = 'TestBarbarian';

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

let saveSeq = 0;
const savePromptId = () => `save-prompt-${++saveSeq}`;
const lastPromptId = () => createSaveListener.mock.results.at(-1).value.promptId;

const dispatch = (type, detail) =>
  window.dispatchEvent(new CustomEvent(type, { detail }));

// Suite-distinguishable die faces (saveResults uses 17/8/25 + 6/8/14).
const SUCCESS_DETAIL = (promptId) => ({ promptId, success: true, roll: 19, saveBonus: 3, total: 22 });

function makeCreature() {
  return { name: NAME, type: 'player', currentHp: 0 };
}

function makeComputed(barbarianLevel = 11) {
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
          healExpression: '2 * barbarian_level',
        },
      },
    ],
    class: { class_levels: [{ name: 'Barbarian', level: barbarianLevel }] },
  };
}

// Recording store fake: every read/write is censused; the dismiss rows
// require the read budget to stop at the two trigger reads and the write
// budget to stay EMPTY.
function makeStore(seed) {
  const state = { ...seed };
  const reads = [];
  const writes = [];
  runtimeState.getRuntimeValue.mockImplementation((owner, key, ...rest) => {
    reads.push([owner, key, rest.length + 2]);
    return state[key];
  });
  runtimeState.setRuntimeValue.mockImplementation((owner, key, value, ...rest) => {
    writes.push([owner, key, value, rest]);
    state[key] = value;
    return Promise.resolve();
  });
  return { state, reads, writes };
}

const TRIGGER_READ_BUDGET = [
  [NAME, 'activeBuffs', 3],
  // arity-2 quirk (saveResults header :33): the uses read omits the campaign arg.
  [NAME, 'relentlessRageUses', 2],
];

const TRIGGER_LOG = (promptId, dc) => ({
  type: 'ability_use',
  characterName: NAME,
  abilityName: 'Relentless Rage',
  description: `Relentless Rage triggered — ${NAME} must make CON save (DC ${dc})`,
  source: 'Relentless Rage',
  promptId,
});

describe('relentlessRageService - save-dismissed opt-in', () => {
  let combatSpy;
  let consoleError;

  beforeEach(() => {
    vi.clearAllMocks(); // RETAINS guid factory impl (#1312 doctrine) — re-seed the rest
    createSaveListener.mockImplementation(() => ({ promptId: savePromptId() }));
    logService.addEntry.mockResolvedValue({});
    logSaveDismissed.mockResolvedValue({});
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    combatSpy = vi.fn();
    window.addEventListener('combat-summary-updated', combatSpy);
  });

  afterEach(() => {
    consoleError.mockRestore();
    window.removeEventListener('combat-summary-updated', combatSpy);
  });

  it('registers exactly one save-result + one save-dismissed producer listener', () => {
    // Sole observable of "no leak": after trigger + matching dismissal, a
    // late echo of either event is fully inert (rows below). A double
    // registration would surface as a double refusal log there.
    const store = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessRageUses: 0,
    });
    checkRelentlessRage(makeCreature(), makeComputed(), CAMPAIGN);
    const promptId = lastPromptId();
    dispatch('save-dismissed', { promptId, targetName: NAME });
    expect(logSaveDismissed).toHaveBeenCalledTimes(1);
    expect(store.writes).toEqual([]);
  });

  it('matching save-dismissed logs one save_dismissed refusal naming the feature, with zero state writes', async () => {
    const store = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessRageUses: 2, // non-zero seed: a bump would write 3 — census catches it
      currentHitPoints: 0,
    });
    const creature = makeCreature();

    checkRelentlessRage(creature, makeComputed(), CAMPAIGN);
    const promptId = lastPromptId();

    dispatch('save-dismissed', { promptId, targetName: NAME });
    await flush();

    // The shared seam is the ONLY log route for the refusal: caster ==
    // target == the creature, feature name in the row, prompt's CON/DC
    // (uses seed 2 × dcScaling 5 escalates the DC to 20).
    expect(logSaveDismissed).toHaveBeenCalledTimes(1);
    expect(logSaveDismissed).toHaveBeenCalledWith(CAMPAIGN, {
      casterName: NAME,
      abilityName: 'Relentless Rage',
      targetName: NAME,
      saveDc: 20,
      saveType: 'CON',
      logPrefix: '[relentlessRage]',
    });

    // Ledger gap closed with EXACTLY one appended row: the refusal rides
    // logSaveDismissed, so addEntry stays at the trigger row alone — no
    // success/failure ability_use row, no death_save row.
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, TRIGGER_LOG(promptId, 20)],
    ]);

    // Zero-write budget: no relentlessRageUses bump, no HP/heal write, no
    // death-save FSM, no clears. HP and the latch are untouched.
    expect(store.writes).toEqual([]);
    expect(store.state.relentlessRageUses).toBe(2);
    expect(store.state.currentHitPoints).toBe(0);
    expect(creature.currentHp).toBe(0);
    expect(sendDeathSavePrompt).not.toHaveBeenCalled();
    expect(combatSpy).not.toHaveBeenCalled();

    // Read budget stops at the two trigger reads — the dismiss path never
    // reaches the heal/failure branches.
    expect(store.reads).toEqual(TRIGGER_READ_BUDGET);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('save-dismissed for a different promptId stays inert (mismatch guard)', () => {
    const store = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessRageUses: 0,
    });
    checkRelentlessRage(makeCreature(), makeComputed(), CAMPAIGN);

    dispatch('save-dismissed', { promptId: 'someone-else', targetName: 'Goblin' });

    expect(logSaveDismissed).not.toHaveBeenCalled();
    expect(store.writes).toEqual([]);
    expect(store.reads).toEqual(TRIGGER_READ_BUDGET);

    // Falsifier: the guard FILTERED — the companion is still armed and the
    // matching id does produce the refusal row.
    dispatch('save-dismissed', { promptId: lastPromptId(), targetName: NAME });
    expect(logSaveDismissed).toHaveBeenCalledTimes(1);
  });

  it('answered-Roll path logs exactly as before and detaches the companion: a trailing save-dismissed cannot log a phantom refusal', async () => {
    const store = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessRageUses: 0,
      activeConditions: ['unconscious'],
    });
    const creature = makeCreature();

    checkRelentlessRage(creature, makeComputed(), CAMPAIGN);
    const promptId = lastPromptId();

    dispatch('save-result', SUCCESS_DETAIL(promptId));
    await flush();

    // Byte-identical resolution pair — no extra dismiss row anywhere.
    expect(logSaveDismissed).not.toHaveBeenCalled();
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, TRIGGER_LOG(promptId, 10)],
      [CAMPAIGN, {
        type: 'ability_use',
        characterName: NAME,
        abilityName: 'Relentless Rage',
        description: `${NAME} succeeded on CON save. Relentless Rage sets Hit Points to 22.`,
        saveRoll: 19,
        saveBonus: 3,
        saveTotal: 22,
        saveDc: 10,
        saveSuccess: true,
        hpGained: 22,
        source: 'Relentless Rage',
      }],
    ]);
    expect(store.writes.map(([, key]) => key)).toEqual([
      'currentHitPoints', 'deathSaves', 'deathFailures', 'isDead',
      'activeConditions', 'relentlessRageUses',
    ]);

    // Trailing dismissal of the RESOLVED prompt: the companion already
    // self-removed at the save-result match — zero refusal rows.
    dispatch('save-dismissed', { promptId, targetName: NAME });
    await flush();
    expect(logSaveDismissed).not.toHaveBeenCalled();
    expect(logService.addEntry.mock.calls.length).toBe(2);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('dismissed prompt detaches the result listener: a late save-result echo never heals or bumps uses', async () => {
    const store = makeStore({
      activeBuffs: [{ name: 'Rage', effect: 'stance' }],
      relentlessRageUses: 1,
      currentHitPoints: 0,
    });
    const creature = makeCreature();

    checkRelentlessRage(creature, makeComputed(), CAMPAIGN);
    const promptId = lastPromptId();

    dispatch('save-dismissed', { promptId, targetName: NAME });
    expect(logSaveDismissed).toHaveBeenCalledTimes(1);

    // A stray save-result for the swept promptId must NOT resurrect a
    // phantom resolution (detach family, savePrompt.js:161-172 doctrine).
    dispatch('save-result', SUCCESS_DETAIL(promptId));
    await flush();

    expect(store.writes).toEqual([]);
    expect(store.state.relentlessRageUses).toBe(1);
    expect(store.state.currentHitPoints).toBe(0);
    expect(creature.currentHp).toBe(0);
    expect(logService.addEntry.mock.calls.length).toBe(1); // trigger only
    expect(logSaveDismissed).toHaveBeenCalledTimes(1); // companion single-fire
    expect(sendDeathSavePrompt).not.toHaveBeenCalled();
    expect(combatSpy).not.toHaveBeenCalled();
  });
});
