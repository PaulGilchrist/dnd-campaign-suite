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

describe('relentlessRageService - death save handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSaveListener.mockReturnValue({ promptId: 'prompt-123' });
  });

  function setupAndTriggerFailure() {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
      if (key === 'relentlessrageUses') return 0;
      if (key === 'currentHitPoints') return -1;
      return null;
    });
    const creature = makeCreature();
    checkRelentlessRage(creature, makePlayerComputed(), campaignName);

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: false, roll: 5, saveBonus: 8, total: 13 },
    }));
  }

  it('sends death save prompt when save fails and HP <= 0', async () => {
    setupAndTriggerFailure();

    await vi.waitFor(() => {
      expect(sendDeathSavePrompt).toHaveBeenCalledWith(campaignName, {
        promptId: 'test-guid-123',
        targetName: 'TestBarbarian',
      });
    });
  });

  it('does not send death save prompt when save fails but HP > 0', async () => {
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

  it('handles death save nat20 result (clears all saves and sets HP to 1)', async () => {
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
      detail: { promptId: deathPromptId, isNat20: true, success: true, roll: 20 },
    }));

    await vi.waitFor(() => {
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        1,
        campaignName,
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'deathSaves',
        [false, false, false],
        campaignName,
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'deathFailures',
        [false, false, false],
        campaignName,
      );
    });
  });

  it('handles death save success result', async () => {
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
      detail: { promptId: deathPromptId, success: true, roll: 15, saveBonus: 5, total: 20 },
    }));

    await vi.waitFor(() => {
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'deathSaves',
        [true, false, false],
        campaignName,
      );
    });
  });

  it('handles death save failure result with single fail', async () => {
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
      detail: { promptId: deathPromptId, success: false, roll: 3, saveBonus: 2, total: 5 },
    }));

    await vi.waitFor(() => {
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'deathFailures',
        [true, false, false],
        campaignName,
      );
    });
  });

  it('handles death save failure with nat1 (double fail)', async () => {
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
      detail: { promptId: deathPromptId, isNat1: true, success: false, roll: 1, saveBonus: 0, total: 1 },
    }));

    await vi.waitFor(() => {
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'deathFailures',
        [true, true, false],
        campaignName,
      );
    });
  });

  it('logs death save entry with correct fields', async () => {
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
      detail: { promptId: deathPromptId, success: false, roll: 3, isNat1: false, isNat20: false },
    }));

    await vi.waitFor(() => {
      const deathSaveCalls = logService.addEntry.mock.calls.filter(
        (call) => call[1]?.type === 'death_save',
      );
      expect(deathSaveCalls.length).toBeGreaterThan(0);
      expect(deathSaveCalls[0][1].characterName).toBe('TestBarbarian');
      expect(deathSaveCalls[0][1].roll).toBe(3);
      expect(deathSaveCalls[0][1].isNatural1).toBe(false);
    });
  });

  it('ignores death save result with wrong promptId', async () => {
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

    window.dispatchEvent(new CustomEvent('death-save-result', {
      detail: { promptId: 'wrong-prompt-id', success: true, roll: 20 },
    }));

    await vi.waitFor(() => {
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'TestBarbarian',
        'deathSaves',
        expect.any(Array),
        campaignName,
      );
    });
  });

  it('handles death save with all saves already filled (nat20 clears them)', async () => {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
      if (key === 'relentlessrageUses') return 0;
      if (key === 'currentHitPoints') return -1;
      if (key === 'deathSaves') return [true, true, true];
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
      detail: { promptId: deathPromptId, isNat20: true, success: true, roll: 20 },
    }));

    await vi.waitFor(() => {
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'deathSaves',
        [false, false, false],
        campaignName,
      );
    });
  });

  it('handles death save failure when all failure slots filled (no-op)', async () => {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
      if (key === 'relentlessrageUses') return 0;
      if (key === 'currentHitPoints') return -1;
      if (key === 'deathSaves') return [false, false, false];
      if (key === 'deathFailures') return [true, true, true];
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
      detail: { promptId: deathPromptId, success: false, roll: 3, isNat1: false },
    }));

    await vi.waitFor(() => {
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'deathFailures',
        [true, true, true],
        campaignName,
      );
    });
  });

  it('uses existing deathSaves array from runtime when truthy', async () => {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
      if (key === 'relentlessrageUses') return 0;
      if (key === 'currentHitPoints') return -1;
      if (key === 'deathSaves') return [true, false, false];
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
      detail: { promptId: deathPromptId, success: true, roll: 15 },
    }));

    await vi.waitFor(() => {
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'deathSaves',
        [true, true, false],
        campaignName,
      );
    });
  });

  it('handles death save success when all deathSaves slots are already filled (uses default array)', async () => {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
      if (key === 'relentlessrageUses') return 0;
      if (key === 'currentHitPoints') return -1;
      if (key === 'deathSaves') return [true, true, true];
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
      detail: { promptId: deathPromptId, success: true, roll: 15 },
    }));

    await vi.waitFor(() => {
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'deathSaves',
        [true, true, true],
        campaignName,
      );
    });
  });

  it('handles death save with null deathSaves from runtime (uses default array)', async () => {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
      if (key === 'relentlessrageUses') return 0;
      if (key === 'currentHitPoints') return -1;
      if (key === 'deathSaves') return null;
      if (key === 'deathFailures') return null;
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
      detail: { promptId: deathPromptId, success: true, roll: 15 },
    }));

    await vi.waitFor(() => {
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'deathSaves',
        [true, false, false],
        campaignName,
      );
    });
  });

  it('handles death save with null deathFailures from runtime (uses default array)', async () => {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
      if (key === 'relentlessrageUses') return 0;
      if (key === 'currentHitPoints') return -1;
      if (key === 'deathSaves') return [false, false, false];
      if (key === 'deathFailures') return null;
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
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'deathFailures',
        [true, false, false],
        campaignName,
      );
    });
  });
});
