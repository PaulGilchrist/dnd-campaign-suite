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

import { checkRelentlessRage, evaluateHealExpression, getRuntimeUsesKey } from './relentlessRageService.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../ui/logService.js';
import { sendDeathSavePrompt } from '../../combat/conditions/savePromptService.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';

const campaignName = 'TestCampaign';

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

describe('relentlessRageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSaveListener.mockReturnValue({ promptId: 'prompt-123' });
  });

  // ── checkRelentlessRage ─────────────────────────────────────

  describe('checkRelentlessRage', () => {
    it('returns intercepted: false when allFeatures is missing', () => {
      const result = checkRelentlessRage(makeCreature(), makePlayerComputed({ allFeatures: null }), campaignName);
      expect(result.intercepted).toBe(false);
    });

    it('returns intercepted: false when allFeatures is not an array', () => {
      const result = checkRelentlessRage(makeCreature(), makePlayerComputed({ allFeatures: 'invalid' }), campaignName);
      expect(result.intercepted).toBe(false);
    });

    it('returns intercepted: false when Relentless Rage feature is not found', () => {
      const computed = makePlayerComputed({ allFeatures: [] });
      const result = checkRelentlessRage(makeCreature(), computed, campaignName);
      expect(result.intercepted).toBe(false);
    });

    it('returns intercepted: false when rage is zero', () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'ragePoints') return 0;
        if (key === 'relentlessrageUses') return 0;
        return null;
      });
      const result = checkRelentlessRage(makeCreature(), makePlayerComputed(), campaignName);
      expect(result.intercepted).toBe(false);
    });

    it('returns intercepted: false when rage is null', () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'ragePoints') return null;
        if (key === 'relentlessrageUses') return 0;
        return null;
      });
      const result = checkRelentlessRage(makeCreature(), makePlayerComputed(), campaignName);
      expect(result.intercepted).toBe(false);
    });

    it('returns intercepted: false when uses are exhausted', () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 1;
        return null;
      });
      const result = checkRelentlessRage(makeCreature(), makePlayerComputed(), campaignName);
      expect(result.intercepted).toBe(false);
    });

    it('returns intercepted: true with awaitingSave when all conditions met', () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return null;
      });
      const result = checkRelentlessRage(makeCreature(), makePlayerComputed(), campaignName);
      expect(result.intercepted).toBe(true);
      expect(result.awaitingSave).toBe(true);
    });

    it('creates save listener with correct parameters including scaling DC', () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return null;
      });
      checkRelentlessRage(makeCreature(), makePlayerComputed(), campaignName);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestBarbarian',
        saveType: 'CON',
        saveDc: 10,
      });
    });

    it('increments DC by 5 when already used once', () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 1;
        return null;
      });
      const result = checkRelentlessRage(makeCreature(), makePlayerComputed(), campaignName);
      expect(result.intercepted).toBe(false);
    });

    it('logs trigger entry with source field', () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return null;
      });
      checkRelentlessRage(makeCreature(), makePlayerComputed(), campaignName);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestBarbarian',
        abilityName: 'Relentless Rage',
        source: 'Relentless Rage',
      }));
    });
  });

  // ── Save result handling ────────────────────────────────────

  describe('save result handling', () => {
    function setupAndTriggerSuccess() {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        if (key === 'hitPoints') return 50;
        return null;
      });
      const creature = makeCreature();
      checkRelentlessRage(creature, makePlayerComputed(), campaignName);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: true, roll: 15, saveBonus: 8, total: 23 },
      }));
    }

    it('sets HP to heal amount on success', async () => {
      setupAndTriggerSuccess();

      await vi.waitFor(() => {
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'TestBarbarian',
          'currentHitPoints',
          22,
          campaignName,
        );
      });
    });

    it('clears death saves on success', async () => {
      setupAndTriggerSuccess();

      await vi.waitFor(() => {
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'TestBarbarian',
          'deathSaves',
          [false, false, false],
          campaignName,
        );
      });
    });

    it('logs success with save details and hpGained', async () => {
      setupAndTriggerSuccess();

      await vi.waitFor(() => {
        const calls = logService.addEntry.mock.calls.filter(
          (call) => call[1]?.type === 'ability_use' && call[1]?.saveSuccess === true,
        );
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[0][1].saveRoll).toBe(15);
        expect(calls[0][1].saveBonus).toBe(8);
        expect(calls[0][1].saveTotal).toBe(23);
        expect(calls[0][1].saveDc).toBe(10);
        expect(calls[0][1].hpGained).toBe(22);
        expect(calls[0][1].source).toBe('Relentless Rage');
      });
    });

    it('increments uses after save', async () => {
      setupAndTriggerSuccess();

      await vi.waitFor(() => {
        const calls = runtimeState.setRuntimeValue.mock.calls;
        const usesCall = calls.find((call) => call[1] === 'relentlessrageUses');
        expect(usesCall).toEqual(['TestBarbarian', 'relentlessrageUses', 1, campaignName]);
      });
    });

    it('sends death save prompt on failure when HP is 0', async () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      const creature = makeCreature();
      checkRelentlessRage(creature, makePlayerComputed(), campaignName);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: false, roll: 5, saveBonus: 8, total: 13 },
      }));

      await vi.waitFor(() => {
        expect(sendDeathSavePrompt).toHaveBeenCalledWith(campaignName, {
          promptId: 'test-guid-123',
          targetName: 'TestBarbarian',
        });
      });
    });

    it('logs failure with save details', async () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      const creature = makeCreature();
      checkRelentlessRage(creature, makePlayerComputed(), campaignName);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: false, roll: 5, saveBonus: 8, total: 13 },
      }));

      await vi.waitFor(() => {
        const calls = logService.addEntry.mock.calls.filter(
          (call) => call[1]?.type === 'ability_use' && call[1]?.saveSuccess === false,
        );
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[0][1].saveRoll).toBe(5);
        expect(calls[0][1].source).toBe('Relentless Rage');
      });
    });
  });

  // ── evaluateHealExpression ──────────────────────────────────

  describe('evaluateHealExpression', () => {
    it('returns numeric expression directly', () => {
      expect(evaluateHealExpression(10, makePlayerComputed())).toBe(10);
    });

    it('evaluates "2 * barbarian_level"', () => {
      const computed = makePlayerComputed({ level: 11 });
      expect(evaluateHealExpression('2 * barbarian_level', computed)).toBe(22);
    });

    it('evaluates "2 * level"', () => {
      const computed = makePlayerComputed({ level: 9 });
      expect(evaluateHealExpression('2 * level', computed)).toBe(18);
    });

    it('falls back to level for unrecognizable expressions', () => {
      const computed = makePlayerComputed({ level: 7 });
      expect(evaluateHealExpression('1d8+CON', computed)).toBe(7);
    });

    it('returns 1 when no expression and no level', () => {
      expect(evaluateHealExpression(null, {})).toBe(1);
    });
  });

  // ── getRuntimeUsesKey ───────────────────────────────────────

  describe('getRuntimeUsesKey', () => {
    it('lowercases and removes spaces from feature name', () => {
      expect(getRuntimeUsesKey('Relentless Rage')).toBe('relentlessrageUses');
    });

    it('handles single word feature names', () => {
      expect(getRuntimeUsesKey('Frenzy')).toBe('frenzyUses');
    });
  });
});
