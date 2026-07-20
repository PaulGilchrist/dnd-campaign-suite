// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './stepsOfTheFeyHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationExpressions from '../../../combat/automation/automationExpressions.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCleric',
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Charisma', bonus: 2 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Steps of the Fey',
    automation: {
      type: 'free_cast',
      uses_expression: 'CHA modifier_min_1',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('stepsOfTheFeyHandler.handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('remaining uses check', () => {
    it('returns popup when no free uses remaining', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Steps of the Fey');
      expect(result.payload.description).toContain('No free uses');
      expect(result.payload.description).toContain('Finish a Long Rest');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('temp HP gain and use decrement', () => {
    function setupTempHpMocks(existingTempHp = 0) {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('freeCastCount')) return 1;
        if (key === 'tempHp') return existingTempHp;
        return null;
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
    }

    it('decrements use count and sets temp HP', async () => {
      setupTempHpMocks(0);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 10 }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const setCalls = useRuntimeState.setRuntimeValue.mock.calls;
      const countCall = setCalls.find(c => c[1] === '_Steps_of_the_Fey_freeCastCount');
      expect(countCall).toBeDefined();
      expect(countCall[2]).toBe(0);

      const tempHpCall = setCalls.find(c => c[1] === 'tempHp');
      expect(tempHpCall).toBeDefined();
    });

    it('preserves existing temp HP when rolled value is lower', async () => {
      setupTempHpMocks(10);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 10 }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const setCalls = useRuntimeState.setRuntimeValue.mock.calls;
      const tempHpCall = setCalls.find(c => c[1] === 'tempHp');
      expect(tempHpCall).toBeDefined();
      expect(tempHpCall[2]).toBe(10);
    });
  });

  describe('modal return for creature selection', () => {
    function setupModalMocks() {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('freeCastCount')) return 1;
        if (key === 'tempHp') return 0;
        return null;
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
    }

    it('returns modal with eligible targets when combat has creatures', async () => {
      setupModalMocks();
      const combatCreatures = [
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 10 },
        { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 20 },
      ];
      damageUtils.getCombatContext.mockResolvedValue({ creatures: combatCreatures });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('stepsOfTheFeyTaunt');
      expect(result.payload.targets).toEqual(combatCreatures);
      expect(result.payload.saveDc).toBe(13); // 8 + 2 (CHA) + 3 (prof)
      expect(result.payload.featureName).toBe('Steps of the Fey');
      expect(result.payload.tempHpRoll).toBeDefined();
      expect(result.payload.newCount).toBe(0);
    });

    it('filters out the warlock from eligible targets', async () => {
      setupModalMocks();
      const combatCreatures = [
        { name: 'TestCleric', type: 'player', currentHp: 20, maxHp: 20 },
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 10 },
      ];
      damageUtils.getCombatContext.mockResolvedValue({ creatures: combatCreatures });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.targets.length).toBe(1);
      expect(result.payload.targets[0].name).toBe('Goblin');
    });

    it('returns popup with no creatures message when combat is empty', async () => {
      setupModalMocks();
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('returns popup with no other creatures when only warlock is in combat', async () => {
      setupModalMocks();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestCleric', type: 'player', currentHp: 20, maxHp: 20 }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No other creatures in combat');
    });

    it('returns popup when combat context fetch fails', async () => {
      setupModalMocks();
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    describe('popup payload structure', () => {
      it('payload contains correct keys for empty combat case', async () => {
        setupModalMocks();
        damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

        const action = makeAction();
        const result = await handle(action, makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Steps of the Fey');
        expect(result.payload.triggerMistyStep).toBe(true);
        expect(result.payload.automation).toBe(action.automation);
      });
    });
  });
});
