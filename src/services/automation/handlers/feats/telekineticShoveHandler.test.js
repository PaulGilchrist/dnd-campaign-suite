import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './telekineticShoveHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestMonk',
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Wisdom', bonus: 2 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Telekinetic Shove',
    automation: {
      type: 'telekinetic_shove',
      saveType: 'STR',
      pushDistance: 5,
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('telekineticShoveHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  it('resolves target and creates save listener', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    savePrompt.buildSaveDc.mockReturnValue(13);
    savePrompt.createSaveListener.mockReturnValue({ promptId: 'test-prompt-1' });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.targetName).toBe('Goblin');
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'STR',
      saveDc: 13,
    });
  });

  it('falls back to player name when no target resolved', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    targetResolver.resolveTarget.mockResolvedValue(null);
    savePrompt.buildSaveDc.mockReturnValue(13);
    savePrompt.createSaveListener.mockReturnValue({ promptId: 'test-prompt-2' });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.targetName).toBe('TestMonk');
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'TestMonk',
      saveType: 'STR',
      saveDc: 13,
    });
  });

  it('uses custom pushDistance from automation', async () => {
    const action = makeAction({ pushDistance: 10 });
    const ps = makePlayerStats();

    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Orc' } });
    savePrompt.buildSaveDc.mockReturnValue(14);
    savePrompt.createSaveListener.mockReturnValue({ promptId: 'test-prompt-3' });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toContain('10 feet');
  });

  it('defaults pushDistance to 5', async () => {
    const action = makeAction({ pushDistance: undefined });
    const ps = makePlayerStats();

    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Orc' } });
    savePrompt.buildSaveDc.mockReturnValue(14);
    savePrompt.createSaveListener.mockReturnValue({ promptId: 'test-prompt-4' });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toContain('5 feet');
  });

  it('uses custom saveType from automation', async () => {
    const action = makeAction({ saveType: 'CON' });
    const ps = makePlayerStats();

    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    savePrompt.buildSaveDc.mockReturnValue(13);
    savePrompt.createSaveListener.mockReturnValue({ promptId: 'test-prompt-5' });

    await handle(action, ps, campaignName, null);

    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'CON',
      saveDc: 13,
    });
  });

  it('adds ability_use log entry with promptId', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Bugbear' } });
    savePrompt.buildSaveDc.mockReturnValue(15);
    savePrompt.createSaveListener.mockReturnValue({ promptId: 'test-prompt-6' });

    await handle(action, ps, campaignName, null);

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestMonk',
        abilityName: 'Telekinetic Shove',
        promptId: 'test-prompt-6',
      }),
    );
  });

  it('adds save-result event listener', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const action = makeAction();
    const ps = makePlayerStats();

    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    savePrompt.buildSaveDc.mockReturnValue(13);
    savePrompt.createSaveListener.mockReturnValue({ promptId: 'test-prompt-7' });

    await handle(action, ps, campaignName, null);

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'save-result',
      expect.any(Function),
    );
    addEventListenerSpy.mockRestore();
  });

  describe('save result handling', () => {
    it('applies push effect on failed save', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      savePrompt.buildSaveDc.mockReturnValue(13);
      savePrompt.createSaveListener.mockReturnValue({ promptId: 'save-fail-prompt' });
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'save-fail-prompt',
          success: false,
        },
      });

      // Flush async handler
      await Promise.resolve();
      await Promise.resolve();

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: 'Goblin',
            effect: 'push',
            value: 5,
            direction: 'toward_or_away',
            duration: 'immediate',
          }),
        ]),
        campaignName,
      );
      addEventListenerSpy.mockRestore();
    });

    it('logs save_result on failed save', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Orc' } });
      savePrompt.buildSaveDc.mockReturnValue(14);
      savePrompt.createSaveListener.mockReturnValue({ promptId: 'save-fail-prompt-2' });
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

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
          saveType: 'STR',
        }),
      );
      addEventListenerSpy.mockRestore();
    });

    it('logs save_result on successful save', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

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

      const saveResultCalls = logService.addEntry.mock.calls.filter(
        call => call[1]?.type === 'save_result',
      );
      expect(saveResultCalls.length).toBe(0);
      addEventListenerSpy.mockRestore();
    });

    it('removes event listener after handling save result', async () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      savePrompt.buildSaveDc.mockReturnValue(13);
      savePrompt.createSaveListener.mockReturnValue({ promptId: 'remove-test-prompt' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'remove-test-prompt',
          success: false,
        },
      });

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

  it('propagates addEntry errors', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    savePrompt.buildSaveDc.mockReturnValue(13);
    savePrompt.createSaveListener.mockReturnValue({ promptId: 'err-prompt' });
    logService.addEntry.mockRejectedValue(new Error('network'));

    await expect(handle(action, ps, campaignName, null)).rejects.toThrow('network');
  });

  it('popup payload contains correct structure', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    savePrompt.buildSaveDc.mockReturnValue(13);
    savePrompt.createSaveListener.mockReturnValue({ promptId: 'payload-prompt' });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Telekinetic Shove');
    expect(result.payload.targetName).toBe('Goblin');
    expect(result.payload.automation).toBe(action.automation);
  });
});
