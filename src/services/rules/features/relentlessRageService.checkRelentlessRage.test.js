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

describe('relentlessRageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSaveListener.mockReturnValue({ promptId: 'prompt-123' });
  });

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

    it('returns intercepted: false when Rage stance is not active even with ragePoints remaining', () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'ragePoints') return 5;
        if (key === 'activeBuffs') return [];
        if (key === 'relentlessrageUses') return 0;
        return null;
      });
      const result = checkRelentlessRage(makeCreature(), makePlayerComputed(), campaignName);
      expect(result.intercepted).toBe(false);
      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('returns intercepted: false when activeBuffs is null', () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'ragePoints') return 5;
        if (key === 'activeBuffs') return null;
        if (key === 'relentlessrageUses') return 0;
        return null;
      });
      const result = checkRelentlessRage(makeCreature(), makePlayerComputed(), campaignName);
      expect(result.intercepted).toBe(false);
      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('returns intercepted: true when Rage stance is active even with ragePoints at zero', () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'ragePoints') return 0;
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
        if (key === 'relentlessrageUses') return 0;
        return null;
      });
      const result = checkRelentlessRage(makeCreature(), makePlayerComputed(), campaignName);
      expect(result.intercepted).toBe(true);
      expect(result.awaitingSave).toBe(true);
    });

    it('returns intercepted: true when uses are exhausted (unlimited uses per rest)', () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
        if (key === 'relentlessrageUses') return 1;
        return null;
      });
      const result = checkRelentlessRage(makeCreature(), makePlayerComputed(), campaignName);
      expect(result.intercepted).toBe(true);
    });

    it('returns intercepted: true with awaitingSave when all conditions met', () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
        if (key === 'relentlessrageUses') return 0;
        return null;
      });
      const result = checkRelentlessRage(makeCreature(), makePlayerComputed(), campaignName);
      expect(result.intercepted).toBe(true);
      expect(result.awaitingSave).toBe(true);
    });

    it('creates save listener with correct parameters including scaling DC', () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
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
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
        if (key === 'relentlessrageUses') return 1;
        return null;
      });
      checkRelentlessRage(makeCreature(), makePlayerComputed(), campaignName);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestBarbarian',
        saveType: 'CON',
        saveDc: 15,
      });
    });

    it('escalates DC by 5 per prior use (uses=2 -> DC 20, uses=3 -> DC 25)', () => {
      for (const [uses, expectedDc] of [[2, 20], [3, 25]]) {
        createSaveListener.mockClear();
        runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
          if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
          if (key === 'relentlessrageUses') return uses;
          return null;
        });
        checkRelentlessRage(makeCreature(), makePlayerComputed(), campaignName);
        expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
          targetName: 'TestBarbarian',
          saveType: 'CON',
          saveDc: expectedDc,
        });
      }
    });

    it('resets DC to base 10 after short rest nulls relentlessrageUses', () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
        if (key === 'relentlessrageUses') return null;
        return null;
      });
      checkRelentlessRage(makeCreature(), makePlayerComputed(), campaignName);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestBarbarian',
        saveType: 'CON',
        saveDc: 10,
      });
    });

    it('logs trigger entry with source field', () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
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

    it('uses default saveDc of 10 when automation has no saveDc', () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
        if (key === 'relentlessrageUses') return 0;
        return null;
      });
      const computed = makePlayerComputed({
        allFeatures: [
          {
            name: 'Relentless Rage',
            automation: {
              type: 'reaction_save_heal',
              saveType: 'CON',
              dcScaling: 0,
              healExpression: '2 * barbarian_level',
            },
          },
        ],
      });
      checkRelentlessRage(makeCreature(), computed, campaignName);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestBarbarian',
        saveType: 'CON',
        saveDc: 10,
      });
    });

    it('uses default dcScaling of 0 when automation has no dcScaling', () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
        if (key === 'relentlessrageUses') return 0;
        return null;
      });
      const computed = makePlayerComputed({
        allFeatures: [
          {
            name: 'Relentless Rage',
            automation: {
              type: 'reaction_save_heal',
              saveType: 'CON',
              saveDc: 12,
              healExpression: '2 * barbarian_level',
            },
          },
        ],
      });
      checkRelentlessRage(makeCreature(), computed, campaignName);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestBarbarian',
        saveType: 'CON',
        saveDc: 12,
      });
    });

    it('uses custom saveType from automation', () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
        if (key === 'relentlessrageUses') return 0;
        return null;
      });
      const computed = makePlayerComputed({
        allFeatures: [
          {
            name: 'Relentless Rage',
            automation: {
              type: 'reaction_save_heal',
              saveType: 'WIS',
              saveDc: 10,
              dcScaling: 0,
              healExpression: '2 * barbarian_level',
            },
          },
        ],
      });
      checkRelentlessRage(makeCreature(), computed, campaignName);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestBarbarian',
        saveType: 'WIS',
        saveDc: 10,
      });
    });

    it('uses default saveType when automation saveType is null', () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
        if (key === 'relentlessrageUses') return 0;
        return null;
      });
      const computed = makePlayerComputed({
        allFeatures: [
          {
            name: 'Relentless Rage',
            automation: {
              type: 'reaction_save_heal',
              saveType: null,
              saveDc: 10,
              dcScaling: 0,
              healExpression: '2 * barbarian_level',
            },
          },
        ],
      });
      checkRelentlessRage(makeCreature(), computed, campaignName);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestBarbarian',
        saveType: 'CON',
        saveDc: 10,
      });
    });

    it('handles null uses value from getRuntimeValue', () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
        if (key === 'relentlessrageUses') return null;
        return null;
      });
      const result = checkRelentlessRage(makeCreature(), makePlayerComputed(), campaignName);
      expect(result.intercepted).toBe(true);
      expect(result.awaitingSave).toBe(true);
    });

    it('returns intercepted: false when feature has no automation', () => {
      const computed = makePlayerComputed({
        allFeatures: [
          {
            name: 'Relentless Rage',
            automation: null,
          },
        ],
      });
      const result = checkRelentlessRage(makeCreature(), computed, campaignName);
      expect(result.intercepted).toBe(false);
    });
  });
});
