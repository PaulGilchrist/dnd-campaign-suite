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

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './stepsOfTheFeyHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationExpressions from '../../../combat/automation/automationExpressions.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as logService from '../../../ui/logService.js';
import * as expirations from '../../../rules/effects/expirations.js';

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

function dispatchSaveResult(promptId, success) {
  window.dispatchEvent(new CustomEvent('save-result', {
    detail: { promptId, success },
  }));
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

  describe('temp HP gain', () => {
    function setupTempHpMocks(existingTempHp = 0) {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('freeCastCount')) return 1;
        if (key === 'tempHp') return existingTempHp;
        return null;
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue(null);
    }

    it('sets temp HP to rolled value when higher than existing', async () => {
      setupTempHpMocks(0);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const setCalls = useRuntimeState.setRuntimeValue.mock.calls;
      const tempHpCall = setCalls.find(c => c[1] === 'tempHp');
      expect(tempHpCall).toBeDefined();
    });

    it('preserves existing temp HP when rolled value is lower', async () => {
      setupTempHpMocks(10);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const setCalls = useRuntimeState.setRuntimeValue.mock.calls;
      const tempHpCall = setCalls.find(c => c[1] === 'tempHp');
      expect(tempHpCall).toBeDefined();
      expect(tempHpCall[2]).toBe(10);
    });
  });

  describe('taunting step with target', () => {
    function setupTargetMocks(promptId = 'test-prompt', customSaveDc = undefined) {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('freeCastCount')) return 1;
        if (key === 'tempHp') return 0;
        return null;
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      savePrompt.buildSaveDc.mockReturnValue(customSaveDc ?? 13);
      savePrompt.createSaveListener.mockReturnValue({ promptId });
    }

    it('resolves target and creates save listener with correct parameters', async () => {
      setupTargetMocks('taunt-prompt-1');

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.triggerMistyStep).toBe(true);
      expect(result.payload.description).toContain('Taunting Step');
      expect(result.payload.description).toContain('Goblin');
      expect(result.payload.description).toContain('DC 13');
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: 13,
      });
    });

    it('uses custom saveDc from automation config', async () => {
      setupTargetMocks('custom-dc-prompt', 17);

      await handle(makeAction({ saveDc: 17 }), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: 17,
      });
    });

    it('registers save-result event listener for the prompt', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      setupTargetMocks('listener-prompt');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'save-result',
        expect.any(Function),
      );
      addEventListenerSpy.mockRestore();
    });
  });

  describe('save result handling', () => {
    function setupSaveMocks(promptId, targetName = 'Goblin') {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('freeCastCount')) return 1;
        if (key === 'tempHp') return 0;
        if (key === 'activeConditions') return [];
        return null;
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: targetName } });
      savePrompt.buildSaveDc.mockReturnValue(13);
      savePrompt.createSaveListener.mockReturnValue({ promptId });
    }

    it('applies condition on failed save', async () => {
      setupSaveMocks('fail-prompt');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      dispatchSaveResult('fail-prompt', false);

      // The handler is async; flush microtasks for the await inside
      await Promise.resolve();
      await Promise.resolve();

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining([expect.stringContaining('taunted_by_testcleric')]),
        campaignName,
      );
      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'TestCleric',
        'Goblin',
        expect.arrayContaining([
          expect.objectContaining({ type: 'condition' }),
        ]),
        campaignName,
        undefined,
        'TestCleric',
      );
    });

    it('logs save_result on failed save', async () => {
      setupSaveMocks('fail-log-prompt', 'Orc');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      dispatchSaveResult('fail-log-prompt', false);

      await Promise.resolve();
      await Promise.resolve();

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          targetName: 'Orc',
          success: false,
          saveType: 'WIS',
        }),
      );
    });

    it('logs save_result on successful save', async () => {
      setupSaveMocks('success-prompt', 'Hobgoblin');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      dispatchSaveResult('success-prompt', true);

      await Promise.resolve();
      await Promise.resolve();

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          targetName: 'Hobgoblin',
          success: true,
        }),
      );
    });

    it('removes event listener after handling save result', async () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      setupSaveMocks('cleanup-prompt');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];

      dispatchSaveResult('cleanup-prompt', false);

      await Promise.resolve();
      await Promise.resolve();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'save-result',
        savedCallback,
      );
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

  });

  describe('taunting step without target', () => {
    function setupNoTargetMocks() {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('freeCastCount')) return 1;
        if (key === 'tempHp') return 0;
        return null;
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue(null);
    }

    it('returns popup without taunting when no target is selected', async () => {
      setupNoTargetMocks();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
      expect(result.payload.triggerMistyStep).toBe(true);
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });
  });

  describe('popup payload structure', () => {
    function setupPayloadMocks() {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('freeCastCount')) return 1;
        if (key === 'tempHp') return 0;
        return null;
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      savePrompt.buildSaveDc.mockReturnValue(13);
      savePrompt.createSaveListener.mockReturnValue({ promptId: 'payload-prompt' });
    }

    it('payload contains correct keys for target case', async () => {
      setupPayloadMocks();

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
