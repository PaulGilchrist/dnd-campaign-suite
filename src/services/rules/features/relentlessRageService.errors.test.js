import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  clearDeathSavePrompt: vi.fn(),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({
  default: { guid: vi.fn(() => 'test-guid-123') },
}));

// ── Imports ────────────────────────────────────────────────────

import { checkRelentlessRage } from './relentlessRageService.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../ui/logService.js';
import { sendDeathSavePrompt } from '../../combat/conditions/savePromptService.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';

const campaignName = 'test-campaign';

function makeCreature(overrides = {}) {
  return {
    name: 'TestBarbarian',
    type: 'player',
    currentHp: 0,
    ...overrides,
  };
}

function makePlayerComputed(overrides = {}) {
  return {
    name: 'TestBarbarian',
    level: 11,
    allFeatures: [
      {
        name: 'Relentless Rage',
        automation: {
          type: 'reaction_save_heal',
          saveType: 'CON',
          saveDc: 10,
          dcScaling: 5,
          healExpression: '2 * barbarian_level',
        },
      },
    ],
    class: {
      class_levels: [{ name: 'Barbarian', level: 11 }],
    },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('relentlessRageService - error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSaveListener.mockReturnValue({ promptId: 'prompt-123' });
  });

  describe('addEntry error handling', () => {
    it('handles addEntry rejection on initial trigger', async () => {
      logService.addEntry.mockRejectedValue(new Error('log error'));
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
        if (key === 'relentlessrageUses') return 0;
        return null;
      });
      checkRelentlessRage(makeCreature(), makePlayerComputed(), campaignName);
      await vi.waitFor(() => {
        expect(logService.addEntry).toHaveBeenCalled();
      });
    });

    it('handles addEntry rejection on success path', async () => {
      logService.addEntry.mockReset();
      logService.addEntry.mockImplementation(() => {
        const p = new Promise((resolve, reject) => {
          reject(new Error('log error'));
        });
        p.catch(() => { });
        return p;
      });
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
        if (key === 'relentlessrageUses') return 0;
        return null;
      });
      checkRelentlessRage(makeCreature(), makePlayerComputed(), campaignName);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: true, roll: 15, saveBonus: 8, total: 23 },
      }));

      await vi.waitFor(() => {
        expect(runtimeState.setRuntimeValue).toHaveBeenCalled();
      });
    });

    it('handles addEntry rejection on failure path', async () => {
      logService.addEntry.mockReset();
      logService.addEntry.mockImplementation(() => {
        const p = new Promise((resolve, reject) => {
          reject(new Error('log error'));
        });
        p.catch(() => { });
        return p;
      });
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
        if (key === 'relentlessrageUses') return 0;
        if (key === 'currentHitPoints') return 10;
        return null;
      });
      const creature = makeCreature();
      checkRelentlessRage(creature, makePlayerComputed(), campaignName);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: false, roll: 5, saveBonus: 8, total: 13 },
      }));

      await vi.waitFor(() => {
        expect(sendDeathSavePrompt).not.toHaveBeenCalled();
      });
    });

    it('handles addEntry rejection on death save path', async () => {
      logService.addEntry.mockReset();
      logService.addEntry.mockImplementation(() => {
        const p = new Promise((resolve, reject) => {
          reject(new Error('log error'));
        });
        p.catch(() => { });
        return p;
      });
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
        if (key === 'relentlessrageUses') return 0;
        if (key === 'currentHitPoints') return -1;
        if (key === 'deathSaves') return [false, false, false];
        if (key === 'deathFailures') return [false, false, false];
        return null;
      });
      const creature = makeCreature();
      checkRelentlessRage(creature, makePlayerComputed(), campaignName);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: false, roll: 5, saveBonus: 8, total: 13 },
      }));

      await vi.waitFor(() => {
        expect(sendDeathSavePrompt).toHaveBeenCalled();
      });

      const deathPromptId = sendDeathSavePrompt.mock.calls[0][1].promptId;
      window.dispatchEvent(new CustomEvent('death-save-result', {
        detail: { promptId: deathPromptId, success: false, roll: 3 },
      }));

      await vi.waitFor(() => {
        expect(runtimeState.setRuntimeValue).toHaveBeenCalled();
      });
    });
  });
});
