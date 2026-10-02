// @improved-by-ai
// CLA-064: Countercharm — trigger gate (failed save vs charmed/frightened),
// uses:1 numeric pool + long_rest re-arm, campaignName on the remove seam,
// machine-truth roll log rolls:[a,b] mode:"advantage".
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

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const mapName = 'tavern-map';

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
    timestamp: Date.now(),
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
  vi.spyOn(Math, 'random').mockReturnValue((die - 1) / 20);
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
  return addEntry.mock.calls.map(c => c[1]).filter(e => e && e.type === 'roll');
}

// ── Tests ──────────────────────────────────────────────────────

describe('countercharmHandler.handle — trigger gate (CLA-064)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findLastAttack.mockResolvedValue(makeAttackResult());
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'TestHero', type: 'player' },
        { name: 'AberrantSorcerer', type: 'player' },
        { name: 'Dryad', type: 'npc' },
      ],
    });
    isWithinRange.mockResolvedValue(true);
    getRuntimeValue.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses with popup + countercharm_refused log when there is no recent roll', async () => {
    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No recent D20 test found');
    const refusals = refusalLogs();
    expect(refusals).toHaveLength(1);
    expect(refusals[0].automationDetail).toBe('no_roll');
    expect(abilityUseLogs()).toHaveLength(0);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('refuses a failed ATTACK roll (rollType gate)', async () => {
    findLastAttack.mockResolvedValue(makeAttackResult({
      attackEvent: { rollType: 'attack', d20: 5, bonus: 7, targetAc: 13, hit: false, timestamp: Date.now() },
      attackerName: 'Dryad',
      targetName: 'TestHero',
    }));

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.description).toContain('refused');
    expect(refusalLogs()[0].automationDetail).toBe('rollType_attack');
    expect(rollLogs()).toHaveLength(0);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('refuses an ability CHECK roll', async () => {
    findLastAttack.mockResolvedValue(makeAttackResult({
      attackEvent: { rollType: 'check', d20: 5, bonus: 2, checkName: 'Persuasion', timestamp: Date.now() },
      attackerName: 'TestHero',
      targetName: 'TestHero',
    }));

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(refusalLogs()[0].automationDetail).toBe('rollType_check');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('refuses a save that already SUCCEEDED', async () => {
    qualifyingSave('AberrantSorcerer', { d20: 18, saveResult: 'success' });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(refusalLogs()[0].automationDetail).toBe('save_succeeded');
    expect(removeCondition).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('refuses a failed save with no charmed/frightened evidence', async () => {
    qualifyingSave('AberrantSorcerer', { saveConditions: [], actionName: 'Ray of Sickness' });
    getRuntimeValue.mockImplementation(async () => undefined);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(refusalLogs()[0].automationDetail).toBe('not_charmed_or_frightened');
    expect(result.payload.description).toContain('Charmed or Frightened');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('accepts a failed save whose evidence is the target freshly-applied charmed condition', async () => {
    qualifyingSave('AberrantSorcerer', { saveConditions: [] });
    mockRandomDie(20);
    getRuntimeValue.mockImplementation(async (name, key) => {
      if (name === 'AberrantSorcerer' && key === 'activeConditions') return ['charmed'];
      return undefined;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(refusalLogs()).toHaveLength(0);
    expect(result.payload.description).toContain('Target: AberrantSorcerer');
    expect(result.payload.description).toContain('turned a failure into a success');
  });

  it('refuses when the roller is out of range', async () => {
    qualifyingSave('AberrantSorcerer');
    isWithinRange.mockResolvedValue(false);

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(refusalLogs()[0].automationDetail).toBe('out_of_range');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

describe('countercharmHandler.handle — reroll machine truth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'TestHero', type: 'player' },
        { name: 'AberrantSorcerer', type: 'player' },
        { name: 'Dryad', type: 'npc' },
      ],
    });
    isWithinRange.mockResolvedValue(true);
    getRuntimeValue.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs a roll entry with rolls:[original,new] mode:"advantage" on fire', async () => {
    qualifyingSave('AberrantSorcerer', { d20: 8, bonus: -1, saveDc: 14 });
    mockRandomDie(17);

    await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(rollLogs()).toHaveLength(1);
    const roll = rollLogs()[0];
    expect(roll.rolls).toEqual([8, 17]);
    expect(roll.mode).toBe('advantage');
    expect(roll.total).toBe(17);
    expect(roll.bonus).toBe(-1);
    expect(roll.saveDc).toBe(14);
    expect(roll.characterName).toBe('AberrantSorcerer');
    expect(roll.success).toBe(true);
  });

  it('on convert-success updates saveResult-<Target> machine truth and logs save_result', async () => {
    qualifyingSave('AberrantSorcerer', { d20: 8, bonus: -1, saveDc: 14 });
    mockRandomDie(17);
    getRuntimeValue.mockImplementation(async (name, key) => {
      if (name === 'AberrantSorcerer' && key === 'activeConditions') return ['charmed'];
      return undefined;
    });

    await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(sendSaveResult).toHaveBeenCalledWith('test-campaign', 'AberrantSorcerer', {
      success: true,
      roll: 17,
      total: 16,
      saveBonus: -1,
      rawRolls: [8, 17],
      mode: 'advantage',
    });
    const converted = addEntry.mock.calls.map(c => c[1]).filter(e => e && e.type === 'save_result');
    expect(converted).toHaveLength(1);
    expect(converted[0].success).toBe(true);
    expect(converted[0].targetName).toBe('AberrantSorcerer');
    expect(converted[0].description).toContain('SUCCESS');
  });

  it('still-fail: no saveResult write, no removeCondition, popup says Still a failure', async () => {
    qualifyingSave('AberrantSorcerer', { d20: 3, bonus: -1, saveDc: 15 });
    mockRandomDie(4);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(result.payload.description).toContain('Still a failure');
    expect(sendSaveResult).not.toHaveBeenCalled();
    expect(removeCondition).not.toHaveBeenCalled();
    expect(logConditionEvent).not.toHaveBeenCalled();
  });
});

describe('countercharmHandler.handle — condition lift seam (CLA-064)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    qualifyingSave('AberrantSorcerer', { d20: 3, bonus: -1, saveDc: 15 });
    mockRandomDie(20);
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'TestHero', type: 'player' },
        { name: 'AberrantSorcerer', type: 'player' },
      ],
    });
    isWithinRange.mockResolvedValue(true);
    getRuntimeValue.mockImplementation(async (name, key) => {
      if (name === 'AberrantSorcerer' && key === 'activeConditions') return ['charmed'];
      return undefined;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls removeCondition WITH campaignName for each active mind condition', async () => {
    await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(removeCondition).toHaveBeenCalledTimes(1);
    expect(removeCondition).toHaveBeenCalledWith({
      combatSummary: expect.any(Object),
      creatureName: 'AberrantSorcerer',
      condition: 'charmed',
      getRuntimeValue: expect.any(Function),
      setRuntimeValue: expect.any(Function),
      campaignName: 'test-campaign',
    });
  });

  it('logs `condition removed` for each lifted condition', async () => {
    await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(logConditionEvent).toHaveBeenCalledWith({
      campaignName: 'test-campaign',
      action: 'removed',
      creatureName: 'AberrantSorcerer',
      conditionLabel: 'Charmed',
    });
  });

  it('lifts frightened too when present', async () => {
    getRuntimeValue.mockImplementation(async (name, key) => {
      if (name === 'AberrantSorcerer' && key === 'activeConditions') return ['charmed', 'frightened'];
      return undefined;
    });

    await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(removeCondition).toHaveBeenCalledTimes(2);
    expect(logConditionEvent).toHaveBeenCalledTimes(2);
  });

  it('does not call removeCondition for a condition the target does not carry', async () => {
    getRuntimeValue.mockImplementation(async (name, key) => {
      if (name === 'AberrantSorcerer' && key === 'activeConditions') return ['frightened'];
      return undefined;
    });

    await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(removeCondition).toHaveBeenCalledTimes(1);
    expect(removeCondition.mock.calls[0][0].condition).toBe('frightened');
  });
});

describe('countercharmHandler.handle — uses:1 pool (CLA-064)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    qualifyingSave('AberrantSorcerer', { d20: 8, bonus: -1, saveDc: 14 });
    mockRandomDie(17);
    getCombatContext.mockResolvedValue({ creatures: [{ name: 'TestHero', type: 'player' }] });
    isWithinRange.mockResolvedValue(true);
    getRuntimeValue.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('spends 1 use as a numeric runtime key on the bard', async () => {
    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'countercharmUses', 0, 'test-campaign');
    expect(result.payload.description).toContain('Uses remaining: 0');
    expect(abilityUseLogs()).toHaveLength(1);
    expect(abilityUseLogs()[0].description).toContain('Uses remaining: 0');
  });

  it('refuses at 0 with countercharm_refused log, zero spend, zero reroll', async () => {
    getRuntimeValue.mockImplementation(async (name, key) => {
      if (name === 'TestHero' && key === 'countercharmUses') return 0;
      return undefined;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(result.payload.description).toContain('no uses remaining');
    expect(refusalLogs()[0].automationDetail).toBe('uses_exhausted');
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(rollLogs()).toHaveLength(0);
    expect(addEntry.mock.calls.filter(c => c[1].type === 'ability_use')).toHaveLength(0);
  });

  it('honors a partially-spent numeric pool (stored 1 of auto.uses)', async () => {
    getRuntimeValue.mockImplementation(async (name, key) => {
      if (name === 'TestHero' && key === 'countercharmUses') return 1;
      return undefined;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'countercharmUses', 0, 'test-campaign');
    expect(result.payload.description).toContain('Uses remaining: 0');
  });

  it('treats a null stored pool (missing key) as re-armed, not exhausted', async () => {
    getRuntimeValue.mockImplementation(async (name, key) => {
      if (name === 'TestHero' && key === 'countercharmUses') return null;
      return null;
    });

    await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(refusalLogs()).toHaveLength(0);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'countercharmUses', 0, 'test-campaign');
  });

  it('self-heals a stale non-numeric pool back to max instead of pinning refusals (CLA-027)', async () => {
    getRuntimeValue.mockImplementation(async (name, key) => {
      if (name === 'TestHero' && key === 'countercharmUses') return { current: 0 };
      return undefined;
    });

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
    vi.clearAllMocks();
    qualifyingSave('AberrantSorcerer', { d20: 8, bonus: -1, saveDc: 14 });
    mockRandomDie(17);
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'TestHero', type: 'player' },
        { name: 'AberrantSorcerer', type: 'player' },
      ],
    });
    isWithinRange.mockResolvedValue(true);
    getRuntimeValue.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs ability_use with correct actor/ability/target', async () => {
    await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    const use = abilityUseLogs()[0];
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestHero',
      abilityName: 'Countercharm',
      targetName: 'AberrantSorcerer',
    }));
    expect(use.description).toContain('TestHero used Countercharm on AberrantSorcerer');
    expect(use.description).toContain('Source: player');
    expect(use.description).toContain('Outcome: success');
  });

  it('shows original vs reroll vs DC in the popup', async () => {
    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(result.payload.name).toBe('Countercharm');
    expect(result.payload.description).toContain('Original Wisdom save: d20(8) + -1 = 7 vs DC 14');
    expect(result.payload.description).toContain('Reroll with Advantage');
    expect(result.payload.description).toContain('16 vs DC 14 → Succeeded');
  });
});
