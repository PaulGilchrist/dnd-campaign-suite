import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyHeroesFeast } from './heroesFeastHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as automationExpressions from '../../../combat/automation/automationExpressions.js';
import * as logPoster from '../../../shared/logPoster.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: "Heroes' Feast",
    automation: {
      maxTargets: 12,
      ...overrides.automation,
    },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe("heroesFeastHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReset();
  });

  describe('handle', () => {
    it('should return popup with creature targets when combat context exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestHero' },
          { name: 'Goblin1' },
          { name: 'Goblin2' },
        ],
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(11);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('heroes_feast_target_selection');
      expect(result.payload.creatureTargets).toEqual(['Goblin1', 'Goblin2']);
      expect(result.payload.maxTargets).toBe(12);
      expect(result.payload.hpIncrease).toBe(11);
      expect(result.payload.duration).toBe('24 hours');
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('should exclude the player character from creature targets', async () => {
      const ps = makePlayerStats({ name: 'Alice' });
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Alice' },
          { name: 'Bob' },
          { name: 'Alice Clone' },
        ],
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.creatureTargets).toEqual(['Bob', 'Alice Clone']);
    });

    it('should return info popup when no combat context exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No combat context found');
      expect(result.payload.description).toContain(action.name);
    });

    it('should use action.spellSlotLevel for hpIncrease calculation', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ spellSlotLevel: 7 });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Enemy' }],
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(20);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.hpIncrease).toBe(20);
      expect(automationExpressions.evaluateAutoExpression).toHaveBeenCalledWith(
        '2d10',
        { level: 7, proficiency: 0 },
        0,
        7,
        7
      );
    });

    it('should default to slot level 6 when spellSlotLevel is not provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      delete action.spellSlotLevel;
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Enemy' }],
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(20);

      await handle(action, ps, campaignName, null);

      expect(automationExpressions.evaluateAutoExpression).toHaveBeenCalledWith(
        '2d10',
        { level: 6, proficiency: 0 },
        0,
        6,
        6
      );
    });

    it('should use auto.maxTargets from action', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ automation: { maxTargets: 5 } });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Enemy' }],
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(11);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.maxTargets).toBe(5);
    });

    it('should default maxTargets to 12 when auto.maxTargets is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ automation: {} });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Enemy' }],
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(11);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.maxTargets).toBe(12);
    });

    it('should default maxTargets to 12 when automation is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ automation: undefined });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Enemy' }],
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(11);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.maxTargets).toBe(12);
    });

    it('should default hpIncrease to 11 when evaluateAutoExpression returns 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Enemy' }],
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.hpIncrease).toBe(11);
    });

    it('should default hpIncrease to 11 when evaluateAutoExpression returns negative', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Enemy' }],
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(-5);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.hpIncrease).toBe(11);
    });

    it('should default hpIncrease to 11 when evaluateAutoExpression returns non-number', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Enemy' }],
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue('invalid');

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.hpIncrease).toBe(11);
    });
  });

  describe('applyHeroesFeast', () => {
    it('should return null when targetNames is empty array', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyHeroesFeast(action, ps, campaignName, null, []);

      expect(result).toBeNull();
    });

    it('should return null when targetNames is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyHeroesFeast(action, ps, campaignName, null, null);

      expect(result).toBeNull();
    });

    it('should return null when targetNames is not an array', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyHeroesFeast(action, ps, campaignName, null, 'Goblin');

      expect(result).toBeNull();
    });

    it('should apply buff to a single target with correct runtime values', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(0)   // heroesFeastHpMaxIncrease for target
        .mockReturnValueOnce(50)  // hitPoints for target
        .mockReturnValueOnce(30); // currentHitPoints for target
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      const result = await applyHeroesFeast(action, ps, campaignName, null, ['Goblin1']);

      expect(result).toBeDefined();
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('1 target(s)');
      expect(result.payload.description).toContain('+15 HP maximum');
      expect(result.payload.description).toContain('Poison resistance');
      expect(result.payload.description).toContain('Immunity to Frightened and Poisoned');

      // Check setRuntimeValue calls for heroesFeastHpMaxIncrease
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin1',
        'heroesFeastHpMaxIncrease',
        15,
        campaignName
      );
      // Check hitPoints update
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin1',
        'hitPoints',
        65,
        campaignName
      );
      // Check currentHitPoints update (capped to new base)
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin1',
        'currentHitPoints',
        45,
        campaignName
      );
    });

    it('should stack heroesFeastHpMaxIncrease when previously applied', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(10)  // existing heroesFeastHpMaxIncrease
        .mockReturnValueOnce(50)  // hitPoints
        .mockReturnValueOnce(40); // currentHitPoints
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      await applyHeroesFeast(action, ps, campaignName, null, ['Goblin1']);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin1',
        'heroesFeastHpMaxIncrease',
        25,
        campaignName
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin1',
        'hitPoints',
        65,
        campaignName
      );
    });

    it('should cap currentHitPoints at new baseHp when healing would exceed it', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(0)   // heroesFeastHpMaxIncrease
        .mockReturnValueOnce(50)  // hitPoints
        .mockReturnValueOnce(60); // currentHitPoints above new base
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      await applyHeroesFeast(action, ps, campaignName, null, ['Goblin1']);

      // newBaseHp = 65, currentHp + hpIncrease = 60 + 15 = 75, min(65, 75) = 65
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin1',
        'currentHitPoints',
        65,
        campaignName
      );
    });

    it('should skip currentHitPoints update when stored value is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(0)   // heroesFeastHpMaxIncrease
        .mockReturnValueOnce(50)  // hitPoints
        .mockReturnValueOnce(null); // currentHitPoints is null

      await applyHeroesFeast(action, ps, campaignName, null, ['Goblin1']);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin1',
        'currentHitPoints',
        expect.anything(),
        campaignName
      );
    });

    it('should add expiration with remove_heroes_feast_buff effect', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(50)
        .mockReturnValueOnce(30);
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      await applyHeroesFeast(action, ps, campaignName, null, ['Goblin1']);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'TestHero',
        'Goblin1',
        [
          {
            type: 'remove_heroes_feast_buff',
            buffName: "Heroes' Feast",
            hpKey: 'heroesFeastHpMaxIncrease',
          },
        ],
        campaignName
      );
    });

    it('should add activeBuffs entry when target has no existing Heroes Feast buff', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(0)       // heroesFeastHpMaxIncrease
        .mockReturnValueOnce(50)      // hitPoints
        .mockReturnValueOnce(30)      // currentHitPoints
        .mockReturnValueOnce([]);     // activeBuffs (empty)
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      await applyHeroesFeast(action, ps, campaignName, null, ['Goblin1']);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin1',
        'activeBuffs',
        [
          {
            name: "Heroes' Feast",
            effect: 'heroes_feast',
            duration: '24 hours',
            sourceCharacter: 'TestHero',
            resistanceTypes: ['Poison'],
            conditionImmunity: ['Frightened', 'Poisoned'],
          },
        ],
        campaignName
      );
    });

    it('should NOT duplicate activeBuffs entry when Heroes Feast already exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const existingBuffs = [
        {
          name: "Heroes' Feast",
          effect: 'heroes_feast',
          duration: '24 hours',
          sourceCharacter: 'TestHero',
          resistanceTypes: ['Poison'],
          conditionImmunity: ['Frightened', 'Poisoned'],
        },
      ];
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(0)       // heroesFeastHpMaxIncrease
        .mockReturnValueOnce(50)      // hitPoints
        .mockReturnValueOnce(30)      // currentHitPoints
        .mockReturnValueOnce(existingBuffs); // activeBuffs already has it
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      await applyHeroesFeast(action, ps, campaignName, null, ['Goblin1']);

      // Should NOT call setRuntimeValue for activeBuffs when buff already exists
      const buffsCalls = runtimeState.setRuntimeValue.mock.calls.filter(
        (call) => call[1] === 'activeBuffs'
      );
      expect(buffsCalls.length).toBe(0);
    });

    it('should handle target with no activeBuffs stored (undefined)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(0)       // heroesFeastHpMaxIncrease
        .mockReturnValueOnce(50)      // hitPoints
        .mockReturnValueOnce(30)      // currentHitPoints
        .mockReturnValueOnce(undefined); // activeBuffs is undefined
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      await applyHeroesFeast(action, ps, campaignName, null, ['Goblin1']);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin1',
        'activeBuffs',
        [
          {
            name: "Heroes' Feast",
            effect: 'heroes_feast',
            duration: '24 hours',
            sourceCharacter: 'TestHero',
            resistanceTypes: ['Poison'],
            conditionImmunity: ['Frightened', 'Poisoned'],
          },
        ],
        campaignName
      );
    });

    it('should handle target with non-array activeBuffs stored', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(0)       // heroesFeastHpMaxIncrease
        .mockReturnValueOnce(50)      // hitPoints
        .mockReturnValueOnce(30)      // currentHitPoints
        .mockReturnValueOnce('not an array'); // activeBuffs is a string
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      await applyHeroesFeast(action, ps, campaignName, null, ['Goblin1']);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin1',
        'activeBuffs',
        [
          {
            name: "Heroes' Feast",
            effect: 'heroes_feast',
            duration: '24 hours',
            sourceCharacter: 'TestHero',
            resistanceTypes: ['Poison'],
            conditionImmunity: ['Frightened', 'Poisoned'],
          },
        ],
        campaignName
      );
    });

    it('should post log entries for each target', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(50)
        .mockReturnValueOnce(30);
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      await applyHeroesFeast(action, ps, campaignName, null, ['Goblin1', 'Goblin2']);

      expect(logPoster.postLogEntry).toHaveBeenCalledTimes(2);
      expect(logPoster.postLogEntry).toHaveBeenCalledWith(campaignName, {
        type: 'hp_change',
        targetName: 'Goblin1',
        delta: 15,
        isHealing: true,
        sourceName: 'TestHero',
        note: "Heroes' Feast (+15 HP max)",
      });
      expect(logPoster.postLogEntry).toHaveBeenCalledWith(campaignName, {
        type: 'hp_change',
        targetName: 'Goblin2',
        delta: 15,
        isHealing: true,
        sourceName: 'TestHero',
        note: "Heroes' Feast (+15 HP max)",
      });
    });

    it('should apply buff to multiple targets with correct counts', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(0)    // target1 heroesFeastHpMaxIncrease
        .mockReturnValueOnce(50)   // target1 hitPoints
        .mockReturnValueOnce(30)   // target1 currentHitPoints
        .mockReturnValueOnce([])   // target1 activeBuffs
        .mockReturnValueOnce(0)    // target2 heroesFeastHpMaxIncrease
        .mockReturnValueOnce(40)   // target2 hitPoints
        .mockReturnValueOnce(20)   // target2 currentHitPoints
        .mockReturnValueOnce([]);  // target2 activeBuffs
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      const result = await applyHeroesFeast(action, ps, campaignName, null, ['Goblin1', 'Goblin2']);

      expect(result.payload.description).toContain('2 target(s)');
      expect(result.payload.description).toContain('+15 HP maximum');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin1',
        'heroesFeastHpMaxIncrease',
        15,
        campaignName
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin2',
        'heroesFeastHpMaxIncrease',
        15,
        campaignName
      );
    });

    it('should use action.spellSlotLevel for hpIncrease in applyHeroesFeast', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ spellSlotLevel: 7 });
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(50)
        .mockReturnValueOnce(30);
      automationExpressions.evaluateAutoExpression.mockReturnValue(20);

      await applyHeroesFeast(action, ps, campaignName, null, ['Goblin1']);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin1',
        'hitPoints',
        70,
        campaignName
      );
    });

    it('should default to slot level 6 when spellSlotLevel is missing in applyHeroesFeast', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      delete action.spellSlotLevel;
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(50)
        .mockReturnValueOnce(30);
      automationExpressions.evaluateAutoExpression.mockReturnValue(11);

      await applyHeroesFeast(action, ps, campaignName, null, ['Goblin1']);

      expect(automationExpressions.evaluateAutoExpression).toHaveBeenCalledWith(
        '2d10',
        { level: 6, proficiency: 0 },
        0,
        6,
        6
      );
    });

    it('should handle currentHitPoints as string value and convert to number', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(50)
        .mockReturnValueOnce('30'); // string instead of number
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      await applyHeroesFeast(action, ps, campaignName, null, ['Goblin1']);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin1',
        'currentHitPoints',
        45,
        campaignName
      );
    });

    it('should handle hitPoints as string (code does not convert to number)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(0)
        .mockReturnValueOnce('50') // string hitPoints
        .mockReturnValueOnce(30);
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      await applyHeroesFeast(action, ps, campaignName, null, ['Goblin1']);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin1',
        'hitPoints',
        '5015',
        campaignName
      );
    });

    it('should handle heroesFeastHpMaxIncrease as string and convert to number', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      runtimeState.getRuntimeValue
        .mockReturnValueOnce('10') // string existing increase
        .mockReturnValueOnce(50)
        .mockReturnValueOnce(30);
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      await applyHeroesFeast(action, ps, campaignName, null, ['Goblin1']);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin1',
        'heroesFeastHpMaxIncrease',
        25,
        campaignName
      );
    });

    it('should apply separate buff entries per target with correct sourceCharacter', async () => {
      const ps = makePlayerStats({ name: 'Caster' });
      const action = makeAction();
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(0)   // target1 heroesFeastHpMaxIncrease
        .mockReturnValueOnce(50)  // target1 hitPoints
        .mockReturnValueOnce(30)  // target1 currentHitPoints
        .mockReturnValueOnce([])  // target1 activeBuffs
        .mockReturnValueOnce(0)   // target2 heroesFeastHpMaxIncrease
        .mockReturnValueOnce(40)  // target2 hitPoints
        .mockReturnValueOnce(20)  // target2 currentHitPoints
        .mockReturnValueOnce([]); // target2 activeBuffs
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      await applyHeroesFeast(action, ps, campaignName, null, ['Goblin1', 'Goblin2']);

      const buffsCalls = runtimeState.setRuntimeValue.mock.calls.filter(
        (call) => call[1] === 'activeBuffs'
      );
      expect(buffsCalls.length).toBe(2);
      expect(buffsCalls[0][2][0].sourceCharacter).toBe('Caster');
      expect(buffsCalls[1][2][0].sourceCharacter).toBe('Caster');
    });
  });
});
