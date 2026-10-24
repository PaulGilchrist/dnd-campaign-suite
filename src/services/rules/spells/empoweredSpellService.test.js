// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cloneDeep } from 'lodash';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Mocks (every live-graph import of the unit; real contracts honored) ───

vi.mock('../../../hooks/combat/useMetamagic.js', () => ({
  getMaxSorceryPoints: vi.fn(),
  getCurrentSorceryPoints: vi.fn(),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../automation/common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
}));

vi.mock('./metamagicRules.js', () => ({
  getChaModifier: vi.fn(),
}));

vi.mock('../../dice/diceRoller.js', () => ({
  parseExpression: vi.fn(),
}));

vi.mock('../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

// REAL applyDamageToTarget is async (applyDamage.js:1008) resolving
// { finalDamage, oldHp, newHp, ... } — lane stubs a resolved Promise
// faithfully; source AWAITs it at empoweredSpellService.js:159 (fix#1443).
vi.mock('../combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

// fix#345: LOWER-reroll refunds route through the canonical heal choke point
// (applyHealing.js:8). REAL applyHealingToTarget is SYNCHRONOUS, resolving
// { actualHeal, oldHp, newHp, maxHp } (hpModifier.js:52) — lane stubs it faithfully.
vi.mock('../combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────

import {
  buildEmpoweredSpellState,
  executeEmpoweredReroll,
  hasEmpoweredSpell,
  getEmpoweredSpellDescription,
} from './empoweredSpellService.js';

import {
  getMaxSorceryPoints,
  getCurrentSorceryPoints,
  spendSorceryPoints,
  logMetamagicUse,
} from '../../../hooks/combat/useMetamagic.js';
import { findLastAttack } from '../../automation/common/damageRollback.js';
import { getChaModifier } from './metamagicRules.js';
import { parseExpression } from '../../dice/diceRoller.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { applyDamageToTarget } from '../combat/applyDamage.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { endInvisibilityOnHostileAction } from '../features/invisibilityService.js';

// ── REAL disk metamagic rows (public/data[.2024]/classes.json, Sorcerer) ──

const disk5e = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/classes.json'), 'utf8'));
const disk2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/classes.json'), 'utf8'));
const diskMeta5e = disk5e[9].class_levels[2].features[0];
const diskMeta2024 = disk2024[9].class_levels[1].features[1];

// ── Helpers ─────────────────────────────────────────────────────

const CAMPAIGN = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Xander',
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeEvent(overrides = {}) {
  return {
    damageFormula: '3d6+2',
    rolls: [4, 6, 3],
    rawDamage: 15,
    spellName: 'Burning Hands',
    targetName: 'Goblin',
    damageTypes: ['Fire'],
    ...overrides,
  };
}

// Fixed-stub dice queue: each queue entry is the exact natural rolled for
// one reroll, consumed in index order. Over-draw throws — pinning reroll
// count and WHICH indices reroll (die value = floor(rand*sides)+1).
function stubDice(naturals, sides = 6) {
  let i = 0;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    if (i >= naturals.length) {
      throw new Error(`Math.random overdraw: ${naturals.length} reroll(s) stubbed, request #${i + 1} exceeds them`);
    }
    return (naturals[i++] - 1) / sides;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  stubDice([]); // any unstubbed reroll draw is a loud failure
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── buildEmpoweredSpellState ────────────────────────────────────

describe('buildEmpoweredSpellState — refusal/error state shapes', () => {
  it.each([
    ['no recent attack', null, 'No recent damage event found. Cast a spell that deals damage first.', false],
    ['event without damageFormula', makeEvent({ damageFormula: undefined }), 'No dice roll data available', false],
    ['event with empty damageTypes', makeEvent({ damageTypes: [] }), 'No dice roll data available', false],
    ['unparseable formula', makeEvent({ damageFormula: 'invalid' }), 'Could not parse damage formula', true],
  ])('%s: full error state, formulaParsed absent', async (_label, attackEvent, error, parseCalled) => {
    const playerStats = makePlayerStats();
    getMaxSorceryPoints.mockReturnValue(5);
    getCurrentSorceryPoints.mockReturnValue(3);
    getChaModifier.mockReturnValue(2);
    findLastAttack.mockResolvedValue({ attackEvent });
    parseExpression.mockReturnValue(null);

    const result = await buildEmpoweredSpellState(playerStats);

    expect(result).toEqual({
      type: 'empowered_spell',
      name: 'Metamagic - Empowered Spell',
      currentSP: 3,
      maxSP: 5,
      chaMod: 2,
      lastEvent: null,
      error,
    });
    expect(parseExpression).toHaveBeenCalledTimes(parseCalled ? 1 : 0);
  });

  it('finds the event via campaign-scoped lastAttack store with zero explicit args (arity quirk: findLastAttack(campaignName) real arity 1)', async () => {
    getMaxSorceryPoints.mockReturnValue(5);
    getCurrentSorceryPoints.mockReturnValue(3);
    getChaModifier.mockReturnValue(2);
    findLastAttack.mockResolvedValue({ attackEvent: null });

    await buildEmpoweredSpellState(makePlayerStats());

    expect(findLastAttack).toHaveBeenCalledWith();
    expect(getCurrentSorceryPoints).toHaveBeenCalledWith('Xander', 5);
  });
});

describe('buildEmpoweredSpellState — ready states per ruleset (CLA-122 split)', () => {
  it('5e: caps advertised chaMod at parsed dice count and passes event by identity', async () => {
    const lastEvent = makeEvent({ damageFormula: '3d6+2', rolls: [4, 6, 3] });
    const parsed = { count: 3, sides: 6, modifier: 2 };
    getMaxSorceryPoints.mockReturnValue(4);
    getCurrentSorceryPoints.mockReturnValue(2);
    getChaModifier.mockReturnValue(5);
    findLastAttack.mockResolvedValue({ attackEvent: lastEvent });
    parseExpression.mockReturnValue(parsed);

    const result = await buildEmpoweredSpellState(makePlayerStats());

    expect(result).toEqual({
      type: 'empowered_spell',
      name: 'Metamagic - Empowered Spell',
      currentSP: 2,
      maxSP: 4,
      chaMod: 3, // min(5 chaMod, 3 dice)
      lastEvent,
      formulaParsed: parsed,
    });
    expect(result.lastEvent).toBe(lastEvent);
  });

  it('2024: exposes uncapped 1-or-2 eligible count via maxReroll, chaMod untouched, no chaMod cap applied', async () => {
    const lastEvent = makeEvent({ damageFormula: '4d6', rolls: [1, 2, 3, 5], rawDamage: 11 });
    const parsed = { count: 4, sides: 6, modifier: 0 };
    getMaxSorceryPoints.mockReturnValue(20);
    getCurrentSorceryPoints.mockReturnValue(10);
    getChaModifier.mockReturnValue(5);
    findLastAttack.mockResolvedValue({ attackEvent: lastEvent });
    parseExpression.mockReturnValue(parsed);

    const result = await buildEmpoweredSpellState(makePlayerStats({ rules: '2024' }));

    // threshold exactness: only the 1 and the 2 qualify (3 must not)
    expect(result).toEqual({
      type: 'empowered_spell',
      name: 'Metamagic - Empowered Spell',
      currentSP: 10,
      maxSP: 20,
      chaMod: 5, // uncapped — mutant applying Math.min would yield 4
      lastEvent,
      maxReroll: 2,
      formulaParsed: parsed,
    });
  });
});

// ── executeEmpoweredReroll — refusal lanes (no phantom spend) ─────

describe('executeEmpoweredReroll refusals never spend sorcery points', () => {
  it('returns bare null when the formula cannot be parse, before touching the SP store', async () => {
    parseExpression.mockReturnValue(null);

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent: makeEvent({ damageFormula: 'invalid' }),
      chaMod: 3,
    });

    expect(result).toBeNull();
    expect(getCurrentSorceryPoints).not.toHaveBeenCalled();
    expect(spendSorceryPoints).not.toHaveBeenCalled();
    expect(Math.random).not.toHaveBeenCalled();
  });

  it('at 0 SP: exact cost-error popup, no spend, no log, no dice rolled', async () => {
    const lastEvent = makeEvent();
    parseExpression.mockReturnValue({ count: 3, sides: 6, modifier: 2 });
    getMaxSorceryPoints.mockReturnValue(5);
    getCurrentSorceryPoints.mockReturnValue(0);

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 3,
    });

    expect(result.popupState).toEqual({
      type: 'empowered_spell',
      name: 'Metamagic - Empowered Spell',
      currentSP: 0,
      maxSP: 5,
      lastEvent,
      chaMod: 3,
      error: 'Not enough sorcery points. Empowered Spell costs 1 SP.',
    });
    expect(result.logEntries).toBeUndefined();
    expect(spendSorceryPoints).not.toHaveBeenCalled();
    expect(logMetamagicUse).not.toHaveBeenCalled();
    expect(Math.random).not.toHaveBeenCalled();
  });

  it.each([
    ['combat context resolves null', makeEvent(), null],
    ['event carries no targetName', makeEvent({ targetName: undefined }), { round: 1, creatures: [] }],
  ])('%s: reroll happens but SP is refunded by omission — guard sits before the spend', async (_label, lastEvent, summary) => {
    parseExpression.mockReturnValue({ count: 3, sides: 6, modifier: 2 });
    getMaxSorceryPoints.mockReturnValue(5);
    getCurrentSorceryPoints.mockReturnValue(3);
    getCombatContext.mockResolvedValue(summary);
    stubDice([5, 5, 5]);

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 3,
    });

    expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
    expect(result.popupState).toEqual({
      type: 'empowered_spell',
      name: 'Metamagic - Empowered Spell',
      currentSP: 3,
      maxSP: 5,
      lastEvent,
      chaMod: 3,
      error: 'No combat summary found. Cannot reapply damage.',
    });
    expect(spendSorceryPoints).not.toHaveBeenCalled();
    expect(logMetamagicUse).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });

  it('2024: refuses with no spend when no die shows 1 or 2 (a 3 is not eligible)', async () => {
    const lastEvent = makeEvent({ damageFormula: '3d6', rolls: [3, 4, 6], rawDamage: 13 });
    parseExpression.mockReturnValue({ count: 3, sides: 6, modifier: 0 });
    getMaxSorceryPoints.mockReturnValue(5);
    getCurrentSorceryPoints.mockReturnValue(3);

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats({ rules: '2024' }),
      lastEvent,
      chaMod: 5,
    });

    expect(result.popupState).toEqual({
      type: 'empowered_spell',
      name: 'Metamagic - Empowered Spell',
      currentSP: 3,
      maxSP: 5,
      lastEvent,
      chaMod: 5,
      error: 'No damage dice showing 1 or 2 to reroll.',
    });
    expect(result.popupState.completed).toBeUndefined();
    expect(spendSorceryPoints).not.toHaveBeenCalled();
    expect(Math.random).not.toHaveBeenCalled();
  });
});

// ── executeEmpoweredReroll — reroll arbitration + settlement ─────

describe('executeEmpoweredReroll — 5e arbitration', () => {
  it('rerolls the chaMod lowest dice, new rolls always win, exact spend/log/reapply tuples, inputs unmutated', async () => {
    const parsed = { count: 4, sides: 6, modifier: 1 };
    const lastEvent = makeEvent({ damageFormula: '4d6+1', rolls: [5, 2, 4, 1], rawDamage: 12 });
    const characters = [{ name: 'Xander' }];
    const summary = { round: 1, creatures: [{ name: 'Goblin' }] };
    parseExpression.mockReturnValue(parsed);
    getMaxSorceryPoints.mockReturnValue(5);
    getCurrentSorceryPoints.mockReturnValue(2);
    getCombatContext.mockResolvedValue(summary);
    applyDamageToTarget.mockResolvedValue({ finalDamage: 7, newHp: 5 });
    stubDice([6, 3]); // naturals for indices 1 and 3 in order — over-draw throws

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 2,
      characters,
    });

    // 5e picks the 2 LOWEST by ascending stable sort: values 1@3, 2@1
    const { lastEvent: ev, ...popupRest } = result.popupState;
    const { timestamp, ...evRest } = ev;
    expect(popupRest).toStrictEqual({
      type: 'empowered_spell',
      name: 'Metamagic - Empowered Spell',
      currentSP: 1,
      maxSP: 5,
      chaMod: 2,
      completed: true,
      result: {
        oldTotal: 12,
        newTotal: 19, // 5+6+4+3 + 1 mod
        damageDifference: 7,
        rerollCount: 2,
        rerolledDice: new Set([1, 3]),
        originalDice: [5, 2, 4, 1],
        newDice: [5, 6, 4, 3],
        targetCurrentHp: 5, // awaited applyResult.newHp (was undefined while :159 floated un-awaited)
      },
    });
    expect(evRest).toEqual({ ...lastEvent, rawDamage: 19, rolls: [5, 6, 4, 3] });
    expect(typeof timestamp).toBe('number'); // wall-clock stamp is metadata only — no game-state clock

    expect(result.logEntries).toEqual([{
      type: 'metamagic',
      characterName: 'Xander',
      rollType: 'empowered-spell',
      spellName: 'Burning Hands',
      originalDamage: 12,
      newTotal: 19,
      damageDifference: 7,
      targetName: 'Goblin',
      rerolledDiceCount: 2,
      originalDice: [5, 2, 4, 1],
      newDice: [5, 6, 4, 3],
    }]);

    expect(getCurrentSorceryPoints).toHaveBeenCalledWith('Xander', 5);
    expect(spendSorceryPoints).toHaveBeenCalledWith('Xander', 1, CAMPAIGN, 5);
    expect(logMetamagicUse).toHaveBeenCalledWith(CAMPAIGN, 'Xander', 'Burning Hands', ['Empowered Spell'], 1);
    expect(applyDamageToTarget).toHaveBeenCalledWith(summary, 'Goblin', 7, ['Fire'], {
      campaignName: CAMPAIGN,
      characters,
      ignoreResistance: false,
      attackerName: 'Xander',
    });
    // fix#1443: :159 awaits applyDamageToTarget, so the :161 guard reads the
    // RESOLVED finalDamage (7 > 0) and the invisibility-break fires — strictly
    // after damage lands (order ledger pin below).
    expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('Xander', CAMPAIGN);
    expect(applyDamageToTarget.mock.invocationCallOrder[0])
      .toBeLessThan(endInvisibilityOnHostileAction.mock.invocationCallOrder[0]);
    expect(lastEvent.rolls).toEqual([5, 2, 4, 1]); // input purity
    expect(cloneDeep(lastEvent).rawDamage).toBe(12);
  });

  it('fix#345 FLIP (was: "negative delta is reapplied"): WORSE reroll refunds |delta| through the HEAL lane — the damage lane never sees a negative (applyDamage.js:985 fix#143 loud-refuse meant the reduction vanished); SP still spent at SP=1 boundary, lowest-of-ties picks first index', async () => {
    const parsed = { count: 3, sides: 6, modifier: 0 };
    const lastEvent = makeEvent({ damageFormula: '3d6', rolls: [6, 5, 5], rawDamage: 16 });
    parseExpression.mockReturnValue(parsed);
    getMaxSorceryPoints.mockReturnValue(5);
    getCurrentSorceryPoints.mockReturnValue(1);
    getCombatContext.mockResolvedValue({ round: 2, creatures: [{ name: 'Goblin' }] });
    applyHealingToTarget.mockReturnValue({ actualHeal: 4, oldHp: 16, newHp: 20, maxHp: 30 });
    stubDice([1]); // chaMod=1 rerolls only ONE of the two 5s — tie goes to earlier index

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 1,
    });

    expect(result.popupState.result.newDice).toEqual([6, 1, 5]);
    expect(result.popupState.result.oldTotal).toBe(16);
    expect(result.popupState.result.newTotal).toBe(12);
    expect(result.popupState.result.damageDifference).toBe(-4);
    expect(result.popupState.currentSP).toBe(0); // boundary: 1 -> 0, spent honestly
    expect(spendSorceryPoints).toHaveBeenCalledWith('Xander', 1, CAMPAIGN, 5);
    // NEGATIVE never enters the damage lane (pre-fix dispatched -4 here):
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    // refund lands once, positive, through the canonical heal choke point
    // (damageRollback.js:76 rollbackDamage idiom):
    expect(applyHealingToTarget).toHaveBeenCalledTimes(1);
    expect(applyHealingToTarget).toHaveBeenCalledWith(
      { round: 2, creatures: [{ name: 'Goblin' }] },
      'Goblin', 4, CAMPAIGN,
    );
    // popup consumes the heal channel's newHp
    expect(result.popupState.result.targetCurrentHp).toBe(20);
    // a refund is not a hostile action — invisibility stays intact
    expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
  });

  it('chaMod=0 quirk: spends 1 SP rerolling ZERO dice — diverges from disk RAW minimum-of-one (classes.json:10280), pinned as-is', async () => {
    const parsed = { count: 3, sides: 6, modifier: 0 };
    const lastEvent = makeEvent({ damageFormula: '3d6', rolls: [2, 4, 6], rawDamage: 12 });
    parseExpression.mockReturnValue(parsed);
    getMaxSorceryPoints.mockReturnValue(5);
    getCurrentSorceryPoints.mockReturnValue(1);
    stubDice([]); // zero dice rerolled — any draw throws

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 0,
    });

    const { lastEvent: ev, ...popupRest } = result.popupState;
    const { timestamp, ...evRest } = ev;
    expect(popupRest).toStrictEqual({
      type: 'empowered_spell',
      name: 'Metamagic - Empowered Spell',
      currentSP: 0,
      maxSP: 5,
      chaMod: 0,
      completed: true,
      result: {
        oldTotal: 12,
        newTotal: 12,
        damageDifference: 0,
        rerollCount: 0,
        message: 'Reroll did not change the damage total.',
      },
    });
    expect(evRest).toEqual({ ...lastEvent, rawDamage: 12, rolls: [2, 4, 6] });
    expect(typeof timestamp).toBe('number');
    expect(Math.random).not.toHaveBeenCalled();
    expect(spendSorceryPoints).toHaveBeenCalledTimes(1); // phantom-spend quirk (RAW: min one die)
    expect(applyDamageToTarget).not.toHaveBeenCalled(); // 0-delta skips reapply entirely
    expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
  });
});

describe('executeEmpoweredReroll — 2024 arbitration (CLA-122)', () => {
  it('rerolls EVERY die showing 1 or 2 even beyond the chaMod cap; a 3 stays', async () => {
    const parsed = { count: 4, sides: 6, modifier: 0 };
    const lastEvent = makeEvent({ damageFormula: '4d6', rolls: [1, 2, 3, 5], rawDamage: 11, spellName: 'Fire Bolt' });
    parseExpression.mockReturnValue(parsed);
    getMaxSorceryPoints.mockReturnValue(5);
    getCurrentSorceryPoints.mockReturnValue(2);
    getCombatContext.mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin' }] });
    applyDamageToTarget.mockResolvedValue({ finalDamage: 7, newHp: 3 });
    stubDice([4, 6]); // indices 0 and 1 only — over/under-draw throws

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats({ rules: '2024' }),
      lastEvent,
      chaMod: 1,
    });

    expect(result.popupState.result).toStrictEqual({
      oldTotal: 11,
      newTotal: 18, // 4+6+3+5
      damageDifference: 7,
      rerollCount: 2,
      rerolledDice: new Set([0, 1]),
      originalDice: [1, 2, 3, 5],
      newDice: [4, 6, 3, 5],
      targetCurrentHp: 3, // awaited applyResult.newHp (mockResolvedValue({ finalDamage: 7, newHp: 3 }))
    });
    expect(result.popupState.currentSP).toBe(1);
    expect(result.logEntries).toEqual([{
      type: 'metamagic',
      characterName: 'Xander',
      rollType: 'empowered-spell',
      spellName: 'Fire Bolt',
      originalDamage: 11,
      newTotal: 18,
      damageDifference: 7,
      targetName: 'Goblin',
      rerolledDiceCount: 2,
      originalDice: [1, 2, 3, 5],
      newDice: [4, 6, 3, 5],
    }]);
    expect(spendSorceryPoints).toHaveBeenCalledWith('Xander', 1, CAMPAIGN, 5);
    expect(logMetamagicUse).toHaveBeenCalledWith(CAMPAIGN, 'Xander', 'Fire Bolt', ['Empowered Spell'], 1);
    expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('Xander', CAMPAIGN);
    expect(applyDamageToTarget.mock.invocationCallOrder[0])
      .toBeLessThan(endInvisibilityOnHostileAction.mock.invocationCallOrder[0]);
  });

  it('5e with the same rolls rerolls only the chaMod-lowest single die (ruleset branch byte)', async () => {
    const parsed = { count: 4, sides: 6, modifier: 0 };
    const lastEvent = makeEvent({ damageFormula: '4d6', rolls: [1, 2, 1, 5], rawDamage: 9, spellName: 'Fire Bolt' });
    parseExpression.mockReturnValue(parsed);
    getMaxSorceryPoints.mockReturnValue(5);
    getCurrentSorceryPoints.mockReturnValue(2);
    getCombatContext.mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin' }] });
    applyDamageToTarget.mockResolvedValue({ finalDamage: 3, newHp: 7 });
    stubDice([6]); // exactly one die — chaMod=1 cap kills the 2024-no-cap mutant

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats({ rules: '5e' }),
      lastEvent,
      chaMod: 1,
    });

    expect(result.popupState.result.rerolledDice).toEqual(new Set([0])); // tie: first 1 wins
    expect(result.popupState.result.newDice).toEqual([6, 2, 1, 5]);
    expect(result.popupState.result.newTotal).toBe(14);
  });
});

// ── fix#1443 MISSING-AWAIT ledger — damage-before-invisibility ordering ───

describe('executeEmpoweredReroll — awaited damage seam (fix#1443)', () => {
  function setupSeam(applyImpl) {
    const parsed = { count: 3, sides: 6, modifier: 0 };
    const lastEvent = makeEvent({ damageFormula: '3d6', rolls: [1, 4, 6], rawDamage: 11 });
    parseExpression.mockReturnValue(parsed);
    getMaxSorceryPoints.mockReturnValue(5);
    getCurrentSorceryPoints.mockReturnValue(3);
    getCombatContext.mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin' }] });
    applyImpl(applyDamageToTarget);
    stubDice([3]); // index 0 (the 1) rerolled to 3 → newTotal 13, delta +2
    return lastEvent;
  }

  const invoke = (lastEvent) => executeEmpoweredReroll({
    campaignName: CAMPAIGN,
    playerStats: makePlayerStats(),
    lastEvent,
    chaMod: 1,
  });

  it('order ledger: applyDamageToTarget resolves BEFORE endInvisibilityOnHostileAction fires', async () => {
    const lastEvent = setupSeam((mock) => mock.mockResolvedValue({ finalDamage: 4, newHp: 0 }));

    const result = await invoke(lastEvent);

    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(result.popupState.result.targetCurrentHp).toBe(0); // resolved newHp consumed
    expect(endInvisibilityOnHostileAction).toHaveBeenCalledTimes(1);
    expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('Xander', CAMPAIGN);
    // invocationCallOrder ledger pin — stealth-break follows the hit, never leads it
    expect(applyDamageToTarget.mock.invocationCallOrder[0])
      .toBeLessThan(endInvisibilityOnHostileAction.mock.invocationCallOrder[0]);
  });

  it('rejection of the async callee propagates to the awaiting caller (no unhandled floating Promise)', async () => {
    const lastEvent = setupSeam((mock) => mock.mockRejectedValue(new Error('damage seam boom')));

    await expect(invoke(lastEvent)).rejects.toThrow('damage seam boom');
    // the :161 guard never sees a resolved result — invisibility must not break
    expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
  });
});

// ── hasEmpoweredSpell (live: handlePlainDamage:329, useLoggedDiceRollAttack:278) ──

describe('hasEmpoweredSpell — capability flag from actions shape', () => {
  it.each([
    ['no stats', undefined],
    ['no actions array', makePlayerStats()],
    ['action named other than Metamagic', makePlayerStats({ actions: [{ name: 'Metamagics', automation: { type: 'spell_modifier', options: [{ effect: 'reroll_damage_dice' }] } }] })],
    ['Metamagic but automation.type is not spell_modifier', makePlayerStats({ actions: [{ name: 'Metamagic', automation: { type: 'action_modifier', options: [{ effect: 'reroll_damage_dice' }] } }] })],
    ['spell_modifier with sibling metamagic only (Quicken near-miss)', makePlayerStats({ actions: [{ name: 'Metamagic', automation: { type: 'spell_modifier', options: [{ name: 'Quickened Spell', cost: 2, effect: 'cast_spell_as_bonus_action' }] } }] })],
    ['spell_modifier with no options key at all', makePlayerStats({ actions: [{ name: 'Metamagic', automation: { type: 'spell_modifier' } }] })],
  ])('%s resolves false', (_label, stats) => {
    expect(hasEmpoweredSpell(stats)).toBe(false);
  });

  it('true for REAL disk Sorcerer metamagic features (both catalogs carry reroll_damage_dice at cost 1)', () => {
    expect(diskMeta5e.name).toBe('Metamagic');
    expect(diskMeta2024.name).toBe('Metamagic');
    expect(hasEmpoweredSpell(makePlayerStats({ actions: [diskMeta5e] }))).toBe(true);
    expect(hasEmpoweredSpell(makePlayerStats({ actions: [diskMeta2024] }))).toBe(true);
    // same-name near-miss straight off disk: strip the empowered option, flag flips false
    const stripped = { ...diskMeta5e, automation: { ...diskMeta5e.automation, options: diskMeta5e.automation.options.filter(o => o.name !== 'Empowered Spell') } };
    expect(hasEmpoweredSpell(makePlayerStats({ actions: [stripped] }))).toBe(false);
  });
});

// ── getEmpoweredSpellDescription (live: CharActions.jsx:100) ─────

describe('getEmpoweredSpellDescription', () => {
  const FALLBACK_5E = 'When you roll damage for a spell, you can spend 1 sorcery point to reroll a number of the damage dice up to your Charisma modifier (minimum of one). You must use the new rolls.';
  const FALLBACK_2024 = 'When you roll damage for a spell, you can spend 1 sorcery point to reroll any number of those dice that rolled a 1 or a 2. You must use the new rolls.';
  // Exact bytes from public/data/classes.json Sorcerer Metamagic <li> content
  const DISK_5E_EXTRACT = 'When you roll damage for a spell, you can spend 1 sorcery point to reroll a number of the damage dice up to your Charisma modifier (minimum of one). You must use the new rolls. You can use Empowered Spell even if you have already used a different Metamagic option during the casting of the spell.';

  it.each([
    ['empty action', {}, undefined],
    ['details null', { details: null }, undefined],
    ['details empty string', { details: '' }, undefined],
    ['Quickened li near-miss', { details: '<li><b>Quickened Spell</b> Cast as bonus action.</li>' }, undefined],
    ['Empowered bytes outside li', { details: '<p><b>Empowered Spell</b> Not in li tag.</p>' }, undefined],
    ['twinned li', { details: '<li><b>Twinned Spell</b> Target two creatures.</li>' }, '5e'],
  ])('%s falls back to 2014 RAW text', (_label, action, rules) => {
    const out = getEmpoweredSpellDescription(action, rules);
    expect(out).toBe(FALLBACK_5E);
    // fallback is a byte-prefix of the real disk feature text — no drift
    expect(diskMeta5e.details).toContain(FALLBACK_5E);
  });

  it('extracts the full <li> body from REAL disk details and matches it byte-exact (case-insensitive gate too)', () => {
    expect(getEmpoweredSpellDescription({ details: diskMeta5e.details })).toBe(DISK_5E_EXTRACT);
    expect(getEmpoweredSpellDescription({ details: '<li><b>empowered spell</b>. Lowercase gate match.</li>' })).toBe('Lowercase gate match.');
    expect(getEmpoweredSpellDescription({ details: '<li><b>Empowered Spell</b> new\n  lines kept</li>' })).toBe('new\n  lines kept');
  });

  it('2024 rules fall back to the 1-or-2 wording, and REAL 2024 disk feature (no details field) routes through it', () => {
    expect(diskMeta2024.details).toBeUndefined();
    expect(getEmpoweredSpellDescription({}, '2024')).toBe(FALLBACK_2024);
    expect(getEmpoweredSpellDescription(diskMeta2024, '2024')).toBe(FALLBACK_2024);
  });
});
