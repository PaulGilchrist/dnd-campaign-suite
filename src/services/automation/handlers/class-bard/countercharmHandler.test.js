// @maintained-by-ai 2026-11-26
// CLA-064: Countercharm — trigger gate (failed save vs charmed/frightened),
// uses:1 numeric pool + long_rest re-arm, campaignName on the remove seam,
// machine-truth roll log rolls:[a,b] mode:"advantage".
// Refusals share one expectRefusal census: full-shape popup + refusal log
// toEqual pins (frozen Date.now) and zero writes on every side lane.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { handle } from './countercharmHandler.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { removeCondition } from '../../../combat/conditions/conditionSaveService.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import { logConditionEvent } from '../../../encounters/combatLoggingService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getLongRestResources } from '../../../rules/effects/restRules-constants.js';
import * as diceRoller from '../../../dice/diceRoller.js';

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../combat/conditions/conditionSaveService.js', () => ({
  removeCondition: vi.fn(),
}));

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
}));

vi.mock('../../../encounters/combatLoggingService.js', () => ({
  logConditionEvent: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

vi.mock('../../common/infoPopup.js', () => ({
  infoPopup: vi.fn((name, desc, auto) => ({
    type: 'popup',
    payload: { type: 'automation_info', name, description: desc, automation: auto },
  })),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

// Canonical dice lane mock (fix#169 recipe): the advantage reroll d20 arrives
// via diceRoller.rollD20 — mockRandomDie is now an exact-face seed pin, no
// longer a raw-Math.random floor-algebra rig.
vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const mapName = 'tavern-map';
const NOW = 1700000000000;

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 7,
    proficiency: 3,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Countercharm',
    automation: {
      type: 'countercharm',
      trigger: 'failed_save_charmed_or_frightened',
      range: '30 ft',
      conditions: ['charmed', 'frightened'],
      effect: 'reroll_with_advantage',
      uses: 1,
      recharge: 'long_rest',
      casting_time: '1 reaction',
      ...automation,
    },
  };
}

function makeAttackResult(overrides = {}) {
  return {
    attackEvent: null,
    attackerName: null,
    targetName: null,
    primaryDamage: 0,
    secondaryDamage: 0,
    totalDamage: 0,
    damageTypes: [],
    ...overrides,
  };
}

function makeSaveEvent(overrides = {}) {
  return {
    rollType: 'save',
    d20: 8,
    bonus: -1,
    saveDc: 14,
    saveResult: 'failure',
    saveType: 'Wisdom',
    saveConditions: ['charmed'],
    actionName: 'Fey Charm',
    timestamp: NOW,
    ...overrides,
  };
}

function qualifyingSave(targetName = 'AberrantSorcerer', overrides = {}) {
  findLastAttack.mockResolvedValue(makeAttackResult({
    attackEvent: makeSaveEvent(overrides),
    attackerName: 'Dryad',
    targetName,
  }));
}

function mockRandomDie(die) {
  // Exact-face seed pin (fix#169 idiom): the reroll die arrives pre-rolled
  // through the canonical rollD20 lane (was a Math.floor boundary rig).
  diceRoller.rollD20.mockReturnValue(die);
}

function refusalLogs() {
  return addEntry.mock.calls
    .map(c => c[1])
    .filter(e => e && e.type === 'automation' && e.automationType === 'countercharm_refused');
}

function abilityUseLogs() {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e && e.type === 'ability_use');
}

function rollLogs() {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'roll');
}

function saveResultLogs() {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e && e.type === 'save_result');
}

function defaultCombatContext() {
  return {
    creatures: [
      { name: 'TestHero', type: 'player' },
      { name: 'AberrantSorcerer', type: 'player' },
      { name: 'Dryad', type: 'npc' },
    ],
  };
}

// Runtime-store stub: the only live evidence is the roller's activeConditions.
function activeConditionsStub(conditions) {
  return async (name, key) => {
    if (name === 'AberrantSorcerer' && key === 'activeConditions') return conditions;
    return undefined;
  };
}

// Uses-pool stub: pins only the bard's countercharmUses key.
function storedUsesStub(stored) {
  return async (name, key) => {
    if (name === 'TestHero' && key === 'countercharmUses') return stored;
    return undefined;
  };
}

// Shared refusal census: full-shape popup + refusal-log toEqual pins and a
// zero-write sweep of every side lane (no spend, no reroll, no save-seam,
// no condition lift, no ability_use/roll/save_result logs).
function expectRefusal(result, detail, message) {
  expect(result).toEqual({
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: 'Countercharm',
      description: message,
      automation: makeAction().automation,
    },
  });
  expect(refusalLogs()).toEqual([{
    type: 'automation',
    characterName: 'TestHero',
    automationType: 'countercharm_refused',
    automationDetail: detail,
    abilityName: 'Countercharm',
    description: `Countercharm refused (${detail}): ${message}`,
    timestamp: NOW,
  }]);
  expect(setRuntimeValue).not.toHaveBeenCalled();
  expect(diceRoller.rollD20).not.toHaveBeenCalled();
  expect(sendSaveResult).not.toHaveBeenCalled();
  expect(removeCondition).not.toHaveBeenCalled();
  expect(logConditionEvent).not.toHaveBeenCalled();
  expect(abilityUseLogs()).toHaveLength(0);
  expect(rollLogs()).toHaveLength(0);
  expect(saveResultLogs()).toHaveLength(0);
}

// ── Harness ──────────────────────────────────────────────────────

let combatContext;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  combatContext = defaultCombatContext();
  getCombatContext.mockResolvedValue(combatContext);
  findLastAttack.mockResolvedValue(makeAttackResult());
  isWithinRange.mockResolvedValue(true);
  getRuntimeValue.mockResolvedValue(undefined);
  diceRoller.rollD20.mockReturnValue(1);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────

describe('countercharmHandler.handle — trigger gate (CLA-064)', () => {
  it('refuses with popup + countercharm_refused log when there is no recent roll', async () => {
    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expectRefusal(result, 'no_roll', 'No recent D20 test found. Countercharm must be used as a Reaction after a failed saving throw against a Charmed or Frightened effect.');
  });

  it.each(['attack', 'check'])('refuses a failed %s roll (rollType gate) with zero writes', async (rollType) => {
    findLastAttack.mockResolvedValue(makeAttackResult({
      attackEvent: { rollType, d20: 5, bonus: 7, saveResult: 'failure', timestamp: NOW },
      attackerName: 'Dryad',
      targetName: 'TestHero',
    }));

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expectRefusal(result, `rollType_${rollType}`, `Countercharm refused (rollType_${rollType}).`);
  });

  it('refuses a failed save that already SUCCEEDED', async () => {
    qualifyingSave('AberrantSorcerer', { d20: 18, saveResult: 'success' });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expectRefusal(result, 'save_succeeded', 'The last saving throw already succeeded — Countercharm only triggers on a failed save.');
  });

  it('refuses when no failed-save roller is identified (no_target)', async () => {
    findLastAttack.mockResolvedValue(makeAttackResult({
      attackEvent: makeSaveEvent(),
      attackerName: 'Dryad',
      targetName: null,
    }));

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expectRefusal(result, 'no_target', 'No saving throw roller identified — Countercharm refused.');
  });

  it('refuses a failed save with no charmed/frightened evidence', async () => {
    qualifyingSave('AberrantSorcerer', { saveConditions: [], actionName: 'Ray of Sickness' });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expectRefusal(result, 'not_charmed_or_frightened', 'The last failed save was not against a Charmed or Frightened effect — Countercharm refused.');
  });

  it('accepts a failed save whose evidence is the target freshly-applied charmed condition', async () => {
    qualifyingSave('AberrantSorcerer', { saveConditions: [] });
    mockRandomDie(20);
    getRuntimeValue.mockImplementation(activeConditionsStub(['charmed']));

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(refusalLogs()).toHaveLength(0);
    expect(diceRoller.rollD20).toHaveBeenCalledTimes(1);
    expect(result.payload.description).toContain('Target: AberrantSorcerer');
    expect(result.payload.description).toContain('turned a failure into a success');
  });

  it('refuses when the roller is out of range, parsing the authored 30 ft', async () => {
    qualifyingSave('AberrantSorcerer');
    isWithinRange.mockResolvedValue(false);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(isWithinRange).toHaveBeenCalledWith('TestHero', 'AberrantSorcerer', 30);
    // Source drops the known roller name for gate refusals (handle passes
    // targetName:null), so the message honestly reads "The roller".
    expectRefusal(result, 'out_of_range', 'The roller is beyond 30 feet — Countercharm refused.');
  });
});

describe('countercharmHandler.handle — reroll machine truth', () => {
  it('logs one roll entry rolls:[original,new] mode:"advantage" total:max on fire', async () => {
    qualifyingSave('AberrantSorcerer', { d20: 8, bonus: -1, saveDc: 14 });
    mockRandomDie(17);

    await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(rollLogs()).toEqual([{
      type: 'roll',
      rollType: 'save',
      characterName: 'AberrantSorcerer',
      targetName: 'AberrantSorcerer',
      name: 'Countercharm Reroll',
      rolls: [8, 17],
      mode: 'advantage',
      total: 17,
      bonus: -1,
      saveDc: 14,
      saveType: 'Wisdom',
      success: true,
      timestamp: NOW,
    }]);
  });

  it('on convert-success writes saveResult-<Target> machine truth and logs save_result', async () => {
    qualifyingSave('AberrantSorcerer', { d20: 8, bonus: -1, saveDc: 14 });
    mockRandomDie(17);
    getRuntimeValue.mockImplementation(activeConditionsStub(['charmed']));

    await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(sendSaveResult).toHaveBeenCalledWith('test-campaign', 'AberrantSorcerer', {
      success: true,
      roll: 17,
      total: 16,
      saveBonus: -1,
      rawRolls: [8, 17],
      mode: 'advantage',
    });
    expect(saveResultLogs()).toEqual([{
      type: 'save_result',
      characterName: 'TestHero',
      targetName: 'AberrantSorcerer',
      saveDc: 14,
      saveType: 'Wisdom',
      success: true,
      description: 'AberrantSorcerer converted Wisdom DC 14 to SUCCESS via Countercharm reroll (17 + -1 = 16 vs DC 14).',
      timestamp: NOW,
    }]);
  });

  it('original die wins the advantage max: use still spent, no save-seam, "Still a failure"', async () => {
    qualifyingSave('AberrantSorcerer', { d20: 12, bonus: -1, saveDc: 15 });
    mockRandomDie(5);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    // max(12, 5) = 12, 12 - 1 = 11 < DC 15 → advantage never handicaps.
    expect(rollLogs()).toEqual([expect.objectContaining({
      rolls: [12, 5],
      total: 12,
      success: false,
    })]);
    expect(result.payload.description).toContain('Still a failure');
    // The RAW reaction is paid once the reroll happens, win or lose.
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'countercharmUses', 0, 'test-campaign');
    expect(sendSaveResult).not.toHaveBeenCalled();
    expect(removeCondition).not.toHaveBeenCalled();
    expect(logConditionEvent).not.toHaveBeenCalled();
    expect(saveResultLogs()).toHaveLength(0);
  });
});

describe('countercharmHandler.handle — condition lift seam (CLA-064)', () => {
  beforeEach(() => {
    qualifyingSave('AberrantSorcerer', { d20: 3, bonus: -1, saveDc: 15 });
    mockRandomDie(20);
  });

  it('lifts every active mind condition via removeCondition WITH campaignName and logs each', async () => {
    getRuntimeValue.mockImplementation(activeConditionsStub(['charmed', 'frightened']));

    await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(removeCondition.mock.calls).toEqual([
      [{
        combatSummary: combatContext,
        creatureName: 'AberrantSorcerer',
        condition: 'charmed',
        getRuntimeValue,
        setRuntimeValue,
        campaignName: 'test-campaign',
      }],
      [{
        combatSummary: combatContext,
        creatureName: 'AberrantSorcerer',
        condition: 'frightened',
        getRuntimeValue,
        setRuntimeValue,
        campaignName: 'test-campaign',
      }],
    ]);
    expect(logConditionEvent.mock.calls).toEqual([
      [{ campaignName: 'test-campaign', action: 'removed', creatureName: 'AberrantSorcerer', conditionLabel: 'Charmed' }],
      [{ campaignName: 'test-campaign', action: 'removed', creatureName: 'AberrantSorcerer', conditionLabel: 'Frightened' }],
    ]);
  });

  it('skips wanted conditions the target does not carry and non-mind conditions', async () => {
    getRuntimeValue.mockImplementation(activeConditionsStub(['frightened', 'poisoned']));

    await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(removeCondition).toHaveBeenCalledTimes(1);
    expect(removeCondition).toHaveBeenCalledWith({
      combatSummary: combatContext,
      creatureName: 'AberrantSorcerer',
      condition: 'frightened',
      getRuntimeValue,
      setRuntimeValue,
      campaignName: 'test-campaign',
    });
    expect(logConditionEvent).toHaveBeenCalledTimes(1);
    expect(logConditionEvent).toHaveBeenCalledWith({
      campaignName: 'test-campaign',
      action: 'removed',
      creatureName: 'AberrantSorcerer',
      conditionLabel: 'Frightened',
    });
  });
});

describe('countercharmHandler.handle — uses pool (CLA-064, CLA-027)', () => {
  beforeEach(() => {
    qualifyingSave('AberrantSorcerer', { d20: 8, bonus: -1, saveDc: 14 });
    mockRandomDie(17);
  });

  it.each([undefined, null])('treats a stored pool of %s as re-armed full pool and spends to 0', async (stored) => {
    getRuntimeValue.mockImplementation(storedUsesStub(stored));

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'countercharmUses', 0, 'test-campaign');
    expect(result.payload.description).toContain('Uses remaining: 0');
    expect(refusalLogs()).toHaveLength(0);
  });

  it('refuses at 0 with countercharm_refused log, zero spend, zero reroll', async () => {
    getRuntimeValue.mockImplementation(storedUsesStub(0));

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expectRefusal(result, 'uses_exhausted', 'Countercharm has no uses remaining — it recharges after a Long Rest.');
  });

  it('honors a partially-spent numeric pool over the authored max (stored 1 of uses:2)', async () => {
    getRuntimeValue.mockImplementation(storedUsesStub(1));

    const result = await handle(makeAction({ uses: 2 }), makePlayerStats(), campaignName, mapName);

    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'countercharmUses', 0, 'test-campaign');
    expect(result.payload.description).toContain('Uses remaining: 0');
  });

  it('self-heals a stale non-numeric pool back to max instead of pinning refusals (CLA-027)', async () => {
    getRuntimeValue.mockImplementation(storedUsesStub({ current: 0 }));

    await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'countercharmUses', 0, 'test-campaign');
    expect(refusalLogs()).toHaveLength(0);
  });
});

describe('CLA-064 Countercharm Long Rest re-arm', () => {
  it('registers countercharmUses in LONG_REST_RESOURCES', () => {
    expect(getLongRestResources()).toContain('countercharmUses');
  });
});

describe('countercharmHandler.handle — popup/log surface on success', () => {
  beforeEach(() => {
    qualifyingSave('AberrantSorcerer', { d20: 8, bonus: -1, saveDc: 14 });
    mockRandomDie(17);
  });

  it('logs exactly one ability_use with full actor/ability/target/outcome surface', async () => {
    await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(abilityUseLogs()).toEqual([{
      type: 'ability_use',
      characterName: 'TestHero',
      abilityName: 'Countercharm',
      description: 'TestHero used Countercharm on AberrantSorcerer (save reroll with Advantage). Source: player, Target: player. Countercharm turned a failure into a success! Outcome: success. Uses remaining: 0.',
      targetName: 'AberrantSorcerer',
      timestamp: NOW,
    }]);
  });

  it('shows original vs reroll vs DC vs uses in the popup', async () => {
    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Countercharm',
        description: '<b>Countercharm</b><br/>Target: AberrantSorcerer<br/>' +
          'Original Wisdom save: d20(8) + -1 = 7 vs DC 14 → Failed<br/>' +
          'Reroll with Advantage: d20(17) [new die 17] + -1 = 16 vs DC 14 → Succeeded<br/>' +
          '<br/><i>Countercharm turned a failure into a success!</i><br/><br/>Uses remaining: 0',
        automation: makeAction().automation,
      },
    });
  });
});
