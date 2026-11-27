// @maintained-by-ai 2026-11-27
//
// ── revivificationHandler.js — rage-spended revival reaction lane ────────
// SUBJECT: handle() (dispatch key `revivification`, automation/index.js:358):
// pre-payment refusals with zero-spend censuses, the death→life commit per
// target kind (player merged death-state batch / monster summary-row lane),
// the crossing unconscious-strip fold, the hp_change log-family row and the
// addEntry-rejection survivor.
//
// Lane map (NOT duplicated here): the HP-truth verdict table and strip
// filter/case-fold internals belong to src/services/shared/reviveTargetHp
// .test.js; HP chokepoint batch-write laws belong to the applyHealing owner;
// rest-recharge of rage defers to the rage owner. What reviveTargetHp.js
// explicitly LEAVES to each lane — "Refusal COPY, payload shape ... and the
// surrounding read ORDER" — is exactly what the exact getRuntimeValue
// .mock.calls censuses below pin.
//
// Fixture honesty (run2#1828/1829/1830 lesson): resolveReviveTargetHp,
// reviveTargetIsLiving and stripUnconsciousOnRevive run REAL — the runtime
// router only feeds buckets, so batch content, deltas and maxHp compute per
// fixture. Player maxHp pins the runtime-bucket half of the source's `??`
// (seeded 55 outranks the row-less target); monster maxHp pins the row half
// (9). No mirrored helper returns anywhere.
//
// Deterministic: module seams mocked, Date.now frozen and window.dispatchEvent
// spied in a beforeEach that RE-SEEDS every default (no clearAllMocks impl
// residue), rejecting mocks re-installed by that seed, no *Once chains.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeBatch: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './revivificationHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logPoster from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const playerName = 'TestHero';
const FROZEN_NOW = 1731500000000;

// Realistic reaction automation (CharReactions.jsx shape): every refusal and
// success payload must echo it untouched — pinned by full-shape toEqual.
const AUTOMATION = { type: 'revivification', reactionSave: { dc: 15, type: 'CON' } };

function makeAction() {
  return { name: 'Revivification', automation: AUTOMATION };
}

function makePlayerStats(overrides = {}) {
  return { name: playerName, level: 5, ...overrides };
}

// The handler's one popup envelope, full shape.
function infoPopup(description) {
  return {
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: 'Revivification',
      description,
      automation: AUTOMATION,
    },
  };
}

// Feeds the runtime buckets the REAL shared helpers read: rage gate,
// player-HP truth, condition strip source and player maxHp.
function seedRuntime({ rage, targetHp = 0, conditions = null, hitPoints = null }) {
  useRuntimeState.getRuntimeValue.mockImplementation((_target, key) => {
    if (key === 'ragePoints') return rage;
    if (key === 'currentHitPoints') return targetHp;
    if (key === 'activeConditions') return conditions;
    if (key === 'hitPoints') return hitPoints;
    return null;
  });
}

// Refusal census: NOTHING moved — no victim write, no rage spend, no summary
// persist, no log row, no SSE broadcast. Full-array, never key-filtered.
function expectZeroSpend() {
  expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([]);
  expect(useRuntimeState.setRuntimeBatch.mock.calls).toEqual([]);
  expect(storage.set.mock.calls).toEqual([]);
  expect(logPoster.addEntry.mock.calls).toEqual([]);
  expect(dispatchSpy.mock.calls).toEqual([]);
}

// ── Tests ──────────────────────────────────────────────────────

let dispatchSpy;

describe('revivificationHandler', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
    dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    useRuntimeState.getRuntimeValue.mockReset().mockReturnValue(null);
    useRuntimeState.setRuntimeValue.mockReset().mockResolvedValue(undefined);
    useRuntimeState.setRuntimeBatch.mockReset();
    damageUtils.getCombatContext.mockReset().mockResolvedValue({});
    damageUtils.getTargetFromAttacker.mockReset().mockReturnValue(null);
    logPoster.addEntry.mockReset().mockResolvedValue(undefined);
    storage.set.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Pre-payment refusals ───────────────────────────────────

  it.each([
    ['absent (null)', null],
    ['unset (undefined)', undefined],
    ['zero', 0],
    ['negative (corrupt store)', -1],
  ])('refuses before combat is even consulted when rage is %s, paying nothing', async (_label, rage) => {
    seedRuntime({ rage });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result).toEqual(infoPopup('No Rage remaining to power Revivification.'));
    expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    expectZeroSpend();
  });

  it('refuses with "No combat active." before target resolution, paying nothing', async () => {
    seedRuntime({ rage: 1 });
    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result).toEqual(infoPopup('No combat active.'));
    expect(damageUtils.getTargetFromAttacker).not.toHaveBeenCalled();
    expectZeroSpend();
  });

  it('refuses with the tracker-select message when no target is picked, paying nothing', async () => {
    seedRuntime({ rage: 1 });
    damageUtils.getTargetFromAttacker.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result).toEqual(infoPopup('Select a target in the combat tracker first.'));
    expectZeroSpend();
  });

  it.each([
    {
      label: 'player whose living runtime bucket outranks a corpse-row trap',
      target: { name: 'Ally', type: 'player', currentHp: 0 },
      seed: { rage: 1, targetHp: 5, conditions: ['unconscious'], hitPoints: 55 },
      expectedReads: [
        [playerName, 'ragePoints', campaignName],
        ['Ally', 'currentHitPoints'],
      ],
    },
    {
      label: 'monster whose living summary row outranks a corpse-bucket trap',
      target: { name: 'Goblin', type: 'npc', currentHp: 7, maxHp: 9 },
      seed: { rage: 1, targetHp: 0, conditions: ['unconscious'] },
      expectedReads: [[playerName, 'ragePoints', campaignName]],
    },
  ])('refuses a living $label before payment: HP truth read once, condition bucket NEVER read', async ({ target, seed, expectedReads }) => {
    seedRuntime(seed);
    damageUtils.getTargetFromAttacker.mockReturnValue(target);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result).toEqual(infoPopup(`${target.name} is not at 0 Hit Points.`));
    // Exact reads census: rage gate → resolveReviveTargetHp (player bucket /
    // monster row, once). No activeConditions read off-crossing — the strip
    // must never run on a refusal — and no maxHp read after an unpaid gate.
    expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual(expectedReads);
    expectZeroSpend();
  });

  // ── Death→life commit census ───────────────────────────────

  it('player corpse commit: one merged death-state batch, sole single-key write is the rage spend, full popup + hp_change row + broadcast', async () => {
    seedRuntime({ rage: 3, targetHp: 0, conditions: ['prone'], hitPoints: 55 });
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Ally', type: 'player' });

    const result = await handle(makeAction(), makePlayerStats({ level: 5 }), campaignName, null);

    // Regression bug-revivification-handler-leaves-isdead-stuck: the old
    // currentHitPoints-only write left isDead:1 on a living ally so every
    // downstream death gate (isCreatureDead, the Revivify corpse census)
    // still read them as a corpse. The CLA-092 death-state reset now rides
    // ONE merged POST, the same idiom as the HoUoM twin and sheet-revive.
    // Exact strict-shape batch: the prone-carrying bucket sheds nothing, so
    // the key set stays the four death-state keys — an absent/prone-only
    // bucket is never materialised as activeConditions.
    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledTimes(1);
    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
      'Ally',
      {
        currentHitPoints: 5,
        deathSaves: [false, false, false],
        deathFailures: [false, false, false],
        isDead: 0,
      },
      campaignName,
    );
    // Write census: the ONLY single-key write is the rage spend (3→2) on the
    // ACTOR — HP never rides a second victim write (the leak face).
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
      [playerName, 'ragePoints', 2, campaignName],
    ]);
    // Exact reads census (lane-owned read order): rage → HP truth → strip
    // bucket → maxHp bucket. The row-less target's maxHp comes from the
    // runtime hitPoints bucket (55), outranking any row fallback.
    expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([
      [playerName, 'ragePoints', campaignName],
      ['Ally', 'currentHitPoints'],
      ['Ally', 'activeConditions', campaignName],
      ['Ally', 'hitPoints', campaignName],
    ]);
    expect(storage.set.mock.calls).toEqual([]); // players never ride the summary-persist lane
    expect(result).toEqual(infoPopup(
      'TestHero uses Revivification to save Ally, setting their Hit Points to 5 and expending 1 Rage.',
    ));
    expect(dispatchSpy.mock.calls.map(([ev]) => ev.type)).toEqual(['combat-summary-updated']);
    // hp_change family parity (2026-11-14 resurrection log-family split): the
    // old unregistered type:'heal' row escaped every hp_change-keyed audit.
    expect(logPoster.addEntry.mock.calls).toEqual([[campaignName, {
      type: 'hp_change',
      characterName: playerName,
      targetName: 'Ally',
      delta: 5,
      currentHp: 5,
      maxHp: 55,
      isHealing: true,
      sourceName: playerName,
      note: 'Revivification',
      timestamp: FROZEN_NOW,
    }]]);
  });

  it('player crossing sheds unconscious into the merged batch (prone rides through), still one batch + one rage spend', async () => {
    seedRuntime({ rage: 1, conditions: ['unconscious', 'prone'] });
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Ally', type: 'player' });

    await handle(makeAction(), makePlayerStats({ level: 18 }), campaignName, null);

    // The strip FILTER law (case-folded, exact-member) belongs to
    // reviveTargetHp.test.js; this lane owns the fold: the shed array rides
    // the ONE victim POST, never a second write.
    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledTimes(1);
    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
      'Ally',
      {
        currentHitPoints: 18,
        deathSaves: [false, false, false],
        deathFailures: [false, false, false],
        isDead: 0,
        activeConditions: ['prone'],
      },
      campaignName,
    );
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
      [playerName, 'ragePoints', 0, campaignName],
    ]);
  });

  it('monster commit: row mutated + summary persisted, no batch or bucket write, hp_change row takes maxHp from the row', async () => {
    const combatCtx = { creatures: [] };
    damageUtils.getCombatContext.mockResolvedValue(combatCtx);
    seedRuntime({ rage: 3, conditions: null });
    const goblin = { name: 'Goblin', type: 'npc', currentHp: 0, maxHp: 9 };
    damageUtils.getTargetFromAttacker.mockReturnValue(goblin);

    const result = await handle(makeAction(), makePlayerStats({ level: 5 }), campaignName, null);

    expect(goblin.currentHp).toBe(5);
    expect(storage.set).toHaveBeenCalledTimes(1);
    expect(storage.set).toHaveBeenCalledWith('combatSummary', combatCtx, campaignName);
    expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
    // Nothing shed → NO bucket write: the rage spend is the only single-key
    // write on the plain monster crossing.
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
      [playerName, 'ragePoints', 2, campaignName],
    ]);
    expect(result).toEqual(infoPopup(
      'TestHero uses Revivification to save Goblin, setting their Hit Points to 5 and expending 1 Rage.',
    ));
    expect(dispatchSpy.mock.calls.map(([ev]) => ev.type)).toEqual(['combat-summary-updated']);
    expect(logPoster.addEntry.mock.calls).toEqual([[campaignName, {
      type: 'hp_change',
      characterName: playerName,
      targetName: 'Goblin',
      delta: 5,
      currentHp: 5,
      maxHp: 9,
      isHealing: true,
      sourceName: playerName,
      note: 'Revivification',
      timestamp: FROZEN_NOW,
    }]]);
  });

  it('monster crossing sheds unconscious through its own bucket write, ordered after the rage spend', async () => {
    const combatCtx = { creatures: [] };
    damageUtils.getCombatContext.mockResolvedValue(combatCtx);
    seedRuntime({ rage: 1, conditions: ['unconscious'] });
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin', type: 'npc', currentHp: 0 });

    await handle(makeAction(), makePlayerStats({ level: 5 }), campaignName, null);

    expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
    // Exact ORDERED write census: rage spend precedes the shed bucket — the
    // bucket is a separate channel from the summary row (monster leg only
    // writes it when something shed).
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
      [playerName, 'ragePoints', 0, campaignName],
      ['Goblin', 'activeConditions', [], campaignName],
    ]);
    expect(storage.set).toHaveBeenCalledWith('combatSummary', combatCtx, campaignName);
  });

  // ── Logging resilience ─────────────────────────────────────

  it('survives addEntry rejection: logs the failure and still returns the success popup', async () => {
    seedRuntime({ rage: 1 });
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Ally', type: 'player' });
    const logError = new Error('Log service unavailable');
    logPoster.addEntry.mockRejectedValue(logError);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    // The commit is not held hostage by the log write.
    expect(result).toEqual(infoPopup(
      'TestHero uses Revivification to save Ally, setting their Hit Points to 5 and expending 1 Rage.',
    ));
    await expect.poll(() => consoleErrorSpy.mock.calls).toEqual([
      ['[revivification] Error:', logError],
    ]);
  });
});
