// @maintained-by-ai
// Deterministic unit tests for heroesFeastHandler: stable contracts (popup payload shape,
// runtime-store keys, expiration registration, log entry shape). Mocks are keyed by
// (name, key) — not call order — so internal call-order churn does not break this file.
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

// Key-addressed runtime store mock: resilient to handler-internal call-order changes.
function mockRuntimeState(store = {}) {
  runtimeState.getRuntimeValue.mockImplementation((name, key) => store[key]);
}

function buffsWrites() {
  return runtimeState.setRuntimeValue.mock.calls.filter(
    (call) => call[1] === 'activeBuffs'
  );
}

const FEAST_BUFF_ENTRY = {
  name: "Heroes' Feast",
  effect: 'heroes_feast',
  duration: '24 hours',
  sourceCharacter: 'TestHero',
  resistanceTypes: ['Poison'],
  conditionImmunity: ['Frightened', 'Poisoned'],
};

// ── Tests ──────────────────────────────────────────────────────

describe("heroesFeastHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRuntimeState({ currentHitPoints: 30 });
  });

  describe('handle', () => {
    it('should return target-selection popup for all combat creatures', async () => {
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero' }, { name: 'Goblin1' }, { name: 'Goblin2' }],
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(11);

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('heroes_feast_target_selection');
      expect(result.payload.name).toBe(action.name);
      expect(result.payload.creatureTargets).toEqual(['TestHero', 'Goblin1', 'Goblin2']);
      expect(result.payload.maxTargets).toBe(12);
      expect(result.payload.hpIncrease).toBe(11);
      expect(result.payload.duration).toBe('24 hours');
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('should return info popup when no combat context exists', async () => {
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(action.name);
      expect(result.payload.description).toContain('No combat context found');
      expect(result.payload.description).toContain(action.name);
    });

    it('should evaluate 2d10 at the spell slot level, defaulting to 6', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Enemy' }] });
      automationExpressions.evaluateAutoExpression.mockReturnValue(11);

      const upcast = await handle(
        makeAction({ spellSlotLevel: 7 }),
        makePlayerStats(),
        campaignName,
        null
      );
      const defaultSlot = await handle(
        makeAction({ spellSlotLevel: undefined }),
        makePlayerStats(),
        campaignName,
        null
      );

      expect(automationExpressions.evaluateAutoExpression).toHaveBeenNthCalledWith(
        1,
        '2d10',
        { level: 7, proficiency: 0 },
        0,
        7,
        7
      );
      expect(upcast.payload.hpIncrease).toBe(11);
      expect(automationExpressions.evaluateAutoExpression).toHaveBeenNthCalledWith(
        2,
        '2d10',
        { level: 6, proficiency: 0 },
        0,
        6,
        6
      );
      expect(defaultSlot.payload.hpIncrease).toBe(11);
    });

    it.each([
      ['zero', 0],
      ['negative', -4],
      ['non-number', 'not a number'],
    ])('should default hpIncrease to 11 for %s expression result', async (_label, value) => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Enemy' }] });
      automationExpressions.evaluateAutoExpression.mockReturnValue(value);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.hpIncrease).toBe(11);
    });

    it('should default maxTargets to 12 when action.automation is undefined', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Enemy' }] });
      automationExpressions.evaluateAutoExpression.mockReturnValue(11);

      const result = await handle(
        { name: "Heroes' Feast" },
        makePlayerStats(),
        campaignName,
        null
      );

      expect(result.payload.maxTargets).toBe(12);
      expect(result.payload.automation).toEqual({});
    });
  });

  describe('applyHeroesFeast', () => {
    it('should return null when targetNames is empty, null, or not an array', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      expect(await applyHeroesFeast(action, ps, campaignName, null, [])).toBeNull();
      expect(await applyHeroesFeast(action, ps, campaignName, null, null)).toBeNull();
      expect(await applyHeroesFeast(action, ps, campaignName, null, 'Goblin')).toBeNull();
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should apply buff to a single target with correct runtime values', async () => {
      mockRuntimeState({ heroesFeastHpMaxIncrease: 0, currentHitPoints: 30 });
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      const result = await applyHeroesFeast(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        ['Goblin1']
      );

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
        'currentHitPoints',
        45,
        campaignName
      );
    });

    it('should stack heroesFeastHpMaxIncrease when previously applied', async () => {
      mockRuntimeState({ heroesFeastHpMaxIncrease: 10, currentHitPoints: 40 });
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      await applyHeroesFeast(makeAction(), makePlayerStats(), campaignName, null, ['Goblin1']);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin1',
        'heroesFeastHpMaxIncrease',
        25,
        campaignName
      );
    });

    it('should skip currentHitPoints update when stored value is null', async () => {
      mockRuntimeState({ heroesFeastHpMaxIncrease: 0, currentHitPoints: null });
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      await applyHeroesFeast(makeAction(), makePlayerStats(), campaignName, null, ['Goblin1']);

      const currentHpCalls = runtimeState.setRuntimeValue.mock.calls.filter(
        (call) => call[1] === 'currentHitPoints'
      );
      expect(currentHpCalls.length).toBe(0);
    });

    it('should add expiration with remove_heroes_feast_buff effect', async () => {
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      await applyHeroesFeast(makeAction(), makePlayerStats(), campaignName, null, ['Goblin1']);

      expect(expirations.addExpiration).toHaveBeenCalledWith({
        attackerName: 'TestHero',
        targetName: 'Goblin1',
        effects: [
          {
            type: 'remove_heroes_feast_buff',
            buffName: "Heroes' Feast",
            hpKey: 'heroesFeastHpMaxIncrease',
          },
        ],
        campaignName,
      });
    });

    it('should add the activeBuffs entry once and not duplicate an existing feast', async () => {
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      await applyHeroesFeast(makeAction(), makePlayerStats(), campaignName, null, ['Goblin1']);

      expect(buffsWrites()).toEqual([['Goblin1', 'activeBuffs', [FEAST_BUFF_ENTRY], campaignName]]);

      // Second cast on a target that already has the buff: no additional write.
      mockRuntimeState({ heroesFeastHpMaxIncrease: 15, currentHitPoints: 45, activeBuffs: [FEAST_BUFF_ENTRY] });
      await applyHeroesFeast(makeAction(), makePlayerStats(), campaignName, null, ['Goblin1']);

      expect(buffsWrites().length).toBe(1);
    });

    it.each([
      ['undefined', undefined],
      ['non-array string', 'invalid-buffs-data'],
    ])('should treat %s activeBuffs as empty array', async (_label, stored) => {
      mockRuntimeState({ activeBuffs: stored });
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      await applyHeroesFeast(makeAction(), makePlayerStats(), campaignName, null, ['Goblin1']);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin1',
        'activeBuffs',
        [FEAST_BUFF_ENTRY],
        campaignName
      );
    });

    it('should apply buff to each of multiple targets and log one hp_change per target', async () => {
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);

      const result = await applyHeroesFeast(
        makeAction(),
        makePlayerStats({ name: 'Caster' }),
        campaignName,
        null,
        ['Goblin1', 'Goblin2']
      );

      expect(result.payload.description).toContain('2 target(s)');
      expect(result.payload.description).toContain('+15 HP maximum');

      for (const targetName of ['Goblin1', 'Goblin2']) {
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          targetName,
          'heroesFeastHpMaxIncrease',
          15,
          campaignName
        );
        expect(logPoster.addEntry).toHaveBeenCalledWith(campaignName, {
          type: 'hp_change',
          targetName,
          delta: 15,
          isHealing: true,
          sourceName: 'Caster',
          note: "Heroes' Feast (+15 HP max)",
        });
      }

      const writes = buffsWrites();
      expect(writes.length).toBe(2);
      expect(writes.map((call) => call[0])).toEqual(['Goblin1', 'Goblin2']);
      // Each target's entry records the caster as sourceCharacter.
      expect(writes.every((call) => call[2][0].sourceCharacter === 'Caster')).toBe(true);
    });

    it('should interpolate action.name into popup description and log note', async () => {
      automationExpressions.evaluateAutoExpression.mockReturnValue(10);

      const result = await applyHeroesFeast(
        makeAction({ name: 'Custom Feast Spell' }),
        makePlayerStats(),
        campaignName,
        null,
        ['Goblin1']
      );

      expect(result.payload.description).toContain('Custom Feast Spell');
      expect(logPoster.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'hp_change',
        targetName: 'Goblin1',
        delta: 10,
        isHealing: true,
        sourceName: 'TestHero',
        note: 'Custom Feast Spell (+10 HP max)',
      });
    });

    it('should not crash when addEntry rejects', async () => {
      automationExpressions.evaluateAutoExpression.mockReturnValue(15);
      logPoster.addEntry.mockRejectedValue(new Error('log write failed'));

      const result = await applyHeroesFeast(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        ['Goblin1']
      );

      expect(result).toBeDefined();
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });
  });
});
