// @improved-by-ai
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

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyHeroesFeast } from './heroesFeastHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as automationExpressions from '../../../combat/automation/automationExpressions.js';
import * as logPoster from '../../../ui/logService.js';

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

    it('should return empty creatureTargets when player is the only creature', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero' }],
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(11);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.creatureTargets).toEqual([]);
      expect(result.payload.maxTargets).toBe(12);
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

    it('should default to slot level 6 and hpIncrease 11 when defaults apply', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      delete action.spellSlotLevel;
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Enemy' }],
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName, null);

      expect(automationExpressions.evaluateAutoExpression).toHaveBeenCalledWith(
        '2d10',
        { level: 6, proficiency: 0 },
        0,
        6,
        6
      );
      expect(result.payload.hpIncrease).toBe(11);
    });

    it('should default hpIncrease to 11 when evaluateAutoExpression returns non-positive or non-number', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Enemy' }],
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName, null);
      expect(result.payload.hpIncrease).toBe(11);
    });
  });

  describe('applyHeroesFeast', () => {
    it('should return null when targetNames is empty, null, or not an array', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      expect(await applyHeroesFeast(action, ps, campaignName, null, [])).toBeNull();
      expect(await applyHeroesFeast(action, ps, campaignName, null, null)).toBeNull();
      expect(await applyHeroesFeast(action, ps, campaignName, null, 'Goblin')).toBeNull();
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

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin1',
        'heroesFeastHpMaxIncrease',
        15,
        campaignName
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin1',
        'hitPoints',
        65,
        campaignName
      );
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

      const currentHpCalls = runtimeState.setRuntimeValue.mock.calls.filter(
        (call) => call[1] === 'currentHitPoints'
      );
      expect(currentHpCalls.length).toBe(0);
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

      const buffsCalls = runtimeState.setRuntimeValue.mock.calls.filter(
        (call) => call[1] === 'activeBuffs'
      );
      expect(buffsCalls.length).toBe(0);
    });

    it('should treat undefined activeBuffs as empty array', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const expectedBuffs = [
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
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(50)
        .mockReturnValueOnce(30)
        .mockReturnValueOnce(undefined);
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      await applyHeroesFeast(action, ps, campaignName, null, ['Goblin1']);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin1',
        'activeBuffs',
        expectedBuffs,
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

      expect(logPoster.addEntry).toHaveBeenCalledTimes(2);
      expect(logPoster.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'hp_change',
        targetName: 'Goblin1',
        delta: 15,
        isHealing: true,
        sourceName: 'TestHero',
        note: "Heroes' Feast (+15 HP max)",
      });
      expect(logPoster.addEntry).toHaveBeenCalledWith(campaignName, {
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
