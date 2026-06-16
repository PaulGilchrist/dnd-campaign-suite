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
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn().mockResolvedValue(undefined),
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

// ── Tests ──────────────────────────────────────────────────────

describe('stepsOfTheFeyHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  describe('uses remaining check', () => {
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

    it('returns popup when free cast count is negative', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue.mockReturnValue(-1);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No free uses');
    });

    it('uses uses_expression to determine max uses', async () => {
      const action = makeAction({ uses_expression: '3' });
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('freeCastCount')) return 3;
        if (key === 'tempHp') return 0;
        return null;
      });

      automationExpressions.evaluateAutoExpression.mockReturnValue(1);

      await handle(action, ps, campaignName, null);

      // After decrement, should be 2
      const setCalls = useRuntimeState.setRuntimeValue.mock.calls;
      const countCall = setCalls.find(c => c[1].includes('freeCastCount'));
      expect(countCall).toBeDefined();
      expect(countCall[2]).toBe(2);
    });
  });

  describe('temp HP gain', () => {
    it('rolls 1d10 for temp HP and sets it when higher than existing', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('freeCastCount')) return 1;
        if (key === 'tempHp') return 0;
        return null;
      });

      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue(null);

      await handle(action, ps, campaignName, null);

      const setCalls = useRuntimeState.setRuntimeValue.mock.calls;
      const tempHpCall = setCalls.find(c => c[1] === 'tempHp');
      expect(tempHpCall).toBeDefined();
    });

    it('does not reduce existing temp HP', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('freeCastCount')) return 1;
        if (key === 'tempHp') return 10;
        return null;
      });

      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue(null);

      await handle(action, ps, campaignName, null);

      const setCalls = useRuntimeState.setRuntimeValue.mock.calls;
      const tempHpCall = setCalls.find(c => c[1] === 'tempHp');
      expect(tempHpCall).toBeDefined();
      expect(tempHpCall[2]).toBe(10); // existing 10 > rolled value
    });
  });

  describe('taunting step with target', () => {
    it('resolves target and creates save listener', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('freeCastCount')) return 1;
        if (key === 'tempHp') return 0;
        return null;
      });

      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      savePrompt.buildSaveDc.mockReturnValue(13);
      savePrompt.createSaveListener.mockReturnValue({ promptId: 'test-prompt-1' });

      const result = await handle(action, ps, campaignName, null);

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

    it('adds ability_use log entry with promptId', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('freeCastCount')) return 1;
        if (key === 'tempHp') return 0;
        return null;
      });

      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Orc' } });
      savePrompt.buildSaveDc.mockReturnValue(14);
      savePrompt.createSaveListener.mockReturnValue({ promptId: 'test-prompt-2' });

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCleric',
          abilityName: 'Steps of the Fey',
          promptId: 'test-prompt-2',
        }),
      );
    });

    it('adds save-result event listener', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('freeCastCount')) return 1;
        if (key === 'tempHp') return 0;
        return null;
      });

      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Bugbear' } });
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue({ promptId: 'test-prompt-3' });

      await handle(action, ps, campaignName, null);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'save-result',
        expect.any(Function),
      );
      addEventListenerSpy.mockRestore();
    });

    it('uses custom saveDc from automation', async () => {
      const action = makeAction({ saveDc: 17 });
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('freeCastCount')) return 1;
        if (key === 'tempHp') return 0;
        return null;
      });

      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      savePrompt.buildSaveDc.mockReturnValue(17);
      savePrompt.createSaveListener.mockReturnValue({ promptId: 'test-prompt-4' });

      await handle(action, ps, campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: 17,
      });
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
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const setRuntimeValue = useRuntimeState.setRuntimeValue;

      setupSaveMocks('save-fail-prompt');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'save-fail-prompt',
          success: false,
        },
      });

      // Flush microtasks from the async handleSaveResult handler
      await Promise.resolve();
      await Promise.resolve();

      expect(setRuntimeValue).toHaveBeenCalledWith(
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
        1,
      );
      addEventListenerSpy.mockRestore();
    });

    it('logs save_result on failed save', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('freeCastCount')) return 1;
        if (key === 'tempHp') return 0;
        return null;
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Orc' } });
      savePrompt.buildSaveDc.mockReturnValue(14);
      savePrompt.createSaveListener.mockReturnValue({ promptId: 'save-fail-prompt-2' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'save-fail-prompt-2',
          success: false,
        },
      });

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
      addEventListenerSpy.mockRestore();
    });

    it('logs save_result on successful save', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('freeCastCount')) return 1;
        if (key === 'tempHp') return 0;
        return null;
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Hobgoblin' } });
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue({ promptId: 'save-success-prompt' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'save-success-prompt',
          success: true,
        },
      });

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          targetName: 'Hobgoblin',
          success: true,
        }),
      );
      addEventListenerSpy.mockRestore();
    });

    it('ignores save-result events with different promptId', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('freeCastCount')) return 1;
        if (key === 'tempHp') return 0;
        return null;
      });
      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      savePrompt.buildSaveDc.mockReturnValue(13);
      savePrompt.createSaveListener.mockReturnValue({ promptId: 'correct-prompt' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'wrong-prompt',
          success: false,
        },
      });

      // The wrong promptId is ignored so no save_result should be added
      const saveResultCalls = logService.addEntry.mock.calls.filter(
        call => call[1]?.type === 'save_result',
      );
      expect(saveResultCalls.length).toBe(0);
      addEventListenerSpy.mockRestore();
    });

    it('removes event listener after handling save result', async () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      setupSaveMocks('remove-test-prompt');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Verify addEventListener was called
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'save-result',
        expect.any(Function),
      );

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'remove-test-prompt',
          success: false,
        },
      });

      // Flush microtasks from the async handleSaveResult handler
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
    it('returns popup without target when resolveTarget returns null', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      // getRuntimeValue for freeCastCount -> 1, then tempHp -> 0
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('freeCastCount')) return 1;
        if (key === 'tempHp') return 0;
        return null;
      });

      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('returns popup without target when targetInfo is null', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('freeCastCount')) return 1;
        if (key === 'tempHp') return 0;
        return null;
      });

      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('No target selected');
    });
  });

  describe('log entries', () => {
    it('calls addEntry with ability_use type on success with target', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(0);

      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      savePrompt.buildSaveDc.mockReturnValue(13);
      savePrompt.createSaveListener.mockReturnValue({ promptId: 'log-prompt-1' });

      await handle(action, ps, campaignName, null);

      // There should be two ability_use entries: one for the save listener, one for the final log
      const abilityUseCalls = logService.addEntry.mock.calls.filter(
        call => call[1]?.type === 'ability_use',
      );
      expect(abilityUseCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('catches and swallows addEntry errors', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(0);

      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      savePrompt.buildSaveDc.mockReturnValue(13);
      savePrompt.createSaveListener.mockReturnValue({ promptId: 'err-prompt' });
      logService.addEntry.mockRejectedValue(new Error('network'));

      await expect(handle(action, ps, campaignName, null)).resolves.toBeDefined();
    });
  });

  describe('popup payload structure', () => {
    it('payload contains correct keys', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(0);

      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      savePrompt.buildSaveDc.mockReturnValue(13);
      savePrompt.createSaveListener.mockReturnValue({ promptId: 'payload-prompt' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Steps of the Fey');
      expect(result.payload.triggerMistyStep).toBe(true);
      expect(result.payload.automation).toBe(action.automation);
    });

    it('uses action.name as featureName when provided', async () => {
      const action = { name: 'My Fey Steps', automation: { type: 'free_cast' } };
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('freeCastCount')) return 1;
        if (key === 'tempHp') return 0;
        return null;
      });

      automationExpressions.evaluateAutoExpression.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      savePrompt.buildSaveDc.mockReturnValue(13);
      savePrompt.createSaveListener.mockReturnValue({ promptId: 'name-prompt' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('My Fey Steps');
      expect(result.payload.description).toContain('My Fey Steps');
    });
  });
});
