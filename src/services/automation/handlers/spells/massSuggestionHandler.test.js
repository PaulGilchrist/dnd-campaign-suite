import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './massSuggestionHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 15,
    proficiency: 6,
    abilities: [{ name: 'Charisma', bonus: 5 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Mass Suggestion',
    automation: {
      type: 'mass_suggestion',
      saveType: 'WIS',
      saveDc: 'spell_save_dc',
      range: '60 feet',
      duration: '24 hours',
      maxTargets: 12,
      ...automation,
    },
  };
}

const baseCombatSummary = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    { name: 'Bugbear', type: 'monster', currentHp: 12, maxHp: 15 },
    { name: 'Hobgoblin', type: 'monster', currentHp: 10, maxHp: 11 },
    { name: 'Kobold', type: 'monster', currentHp: 4, maxHp: 5 },
  ],
  players: [
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  placedItems: [],
};

// ── Tests ──────────────────────────────────────────────────────

describe('massSuggestionHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combat context validation', () => {
    it('should return popup when no combat context exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('should return popup when creatures list is empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('save prompt creation', () => {
    it('should create save prompts for all non-caster creatures', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatSummary);
      buildSaveDc.mockReturnValue(16);

      let saveResultIndex = 0;
      const saveResults = [
        { success: false },
        { success: true },
        { success: false },
        { success: false },
        { success: true },
      ];
      createSaveListener.mockImplementation((_camp, _config) => {
        const promptId = `prompt-${saveResultIndex}`;
        const promise = new Promise(resolve => {
          setTimeout(() => resolve(saveResults[saveResultIndex++]), 0);
        });
        return { promptId, promise };
      });

      await handle(action, ps, campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(5);
      // Caster excluded from targets
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: 16,
        dcSuccess: 'none',
      });
    });
  });

  describe('failed save handling', () => {
    it('should apply Charmed condition on failed save', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatSummary);
      buildSaveDc.mockReturnValue(16);
      getRuntimeValue.mockReturnValue(['frightened']);

      createSaveListener.mockImplementation((_camp, config) => {
        const promptId = `prompt-${config.targetName}`;
        const promise = new Promise(resolve => {
          setTimeout(() => resolve({ success: false }), 0);
        });
        return { promptId, promise };
      });

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['frightened', 'charmed'],
        campaignName
      );
    });

    it('should call addExpiration for caster-target charmed tracking', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatSummary);
      buildSaveDc.mockReturnValue(16);

      createSaveListener.mockImplementation((_camp, config) => {
        const promptId = `prompt-${config.targetName}`;
        const promise = new Promise(resolve => {
          setTimeout(() => resolve({ success: false }), 0);
        });
        return { promptId, promise };
      });

      await handle(action, ps, campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'Goblin',
        [{ type: 'charmed', condition: 'charmed' }],
        campaignName,
        24
      );
    });

    it('should log condition application via postLogEntry', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatSummary);
      buildSaveDc.mockReturnValue(16);

      createSaveListener.mockImplementation((_camp, config) => {
        const promptId = `prompt-${config.targetName}`;
        const promise = new Promise(resolve => {
          setTimeout(() => resolve({ success: false }), 0);
        });
        return { promptId, promise };
      });

      await handle(action, ps, campaignName, null);

      expect(postLogEntry).toHaveBeenCalledWith(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Charmed',
        reason: 'Mass Suggestion spell',
        note: expect.stringContaining('Mass Suggestion'),
        timestamp: expect.any(Number),
      });
    });
  });

  describe('successful save handling', () => {
    it('should not apply conditions on successful save', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatSummary);
      buildSaveDc.mockReturnValue(16);

      createSaveListener.mockImplementation((_camp, config) => {
        const promptId = `prompt-${config.targetName}`;
        const promise = new Promise(resolve => {
          setTimeout(() => resolve({ success: true }), 0);
        });
        return { promptId, promise };
      });

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('max targets limit', () => {
    it('should limit to maxTargets when more creatures exist', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ maxTargets: 2 });

      getCombatContext.mockResolvedValue(baseCombatSummary);
      buildSaveDc.mockReturnValue(16);

      createSaveListener.mockImplementation((_camp, config) => {
        const promptId = `prompt-${config.targetName}`;
        const promise = new Promise(resolve => {
          setTimeout(() => resolve({ success: false }), 0);
        });
        return { promptId, promise };
      });

      await handle(action, ps, campaignName, null);

      // Only 2 targets should get save prompts
      expect(createSaveListener).toHaveBeenCalledTimes(2);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: 16,
        dcSuccess: 'none',
      });
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Orc',
        saveType: 'WIS',
        saveDc: 16,
        dcSuccess: 'none',
      });
    });

    it('should default to 12 max targets when not specified', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ maxTargets: undefined });

      getCombatContext.mockResolvedValue(baseCombatSummary);
      buildSaveDc.mockReturnValue(16);

      createSaveListener.mockImplementation((_camp, config) => {
        const promptId = `prompt-${config.targetName}`;
        const promise = new Promise(resolve => {
          setTimeout(() => resolve({ success: false }), 0);
        });
        return { promptId, promise };
      });

      await handle(action, ps, campaignName, null);

      // All 5 creatures should get save prompts (under the default limit of 12)
      expect(createSaveListener).toHaveBeenCalledTimes(5);
    });
  });

  describe('summary popup', () => {
    it('should return popup with affected count summary', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatSummary);
      buildSaveDc.mockReturnValue(16);

      createSaveListener.mockImplementation((_camp, config) => {
        const promptId = `prompt-${config.targetName}`;
        const promise = new Promise(resolve => {
          setTimeout(() => resolve({ success: false }), 0);
        });
        return { promptId, promise };
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Mass Suggestion');
      expect(result.payload.description).toContain('affects 5 creature');
      expect(result.payload.description).toContain('Charmed');
    });

    it('should return popup when no creatures are affected', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatSummary);
      buildSaveDc.mockReturnValue(16);

      createSaveListener.mockImplementation((_camp, config) => {
        const promptId = `prompt-${config.targetName}`;
        const promise = new Promise(resolve => {
          setTimeout(() => resolve({ success: true }), 0);
        });
        return { promptId, promise };
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures affected');
    });
  });

  describe('condition deduplication', () => {
    it('should not duplicate Charmed if already present', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatSummary);
      buildSaveDc.mockReturnValue(16);
      getRuntimeValue.mockReturnValue(['charmed', 'frightened']);

      createSaveListener.mockImplementation((_camp, config) => {
        const promptId = `prompt-${config.targetName}`;
        const promise = new Promise(resolve => {
          setTimeout(() => resolve({ success: false }), 0);
        });
        return { promptId, promise };
      });

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['frightened', 'charmed'],
        campaignName
      );
    });
  });
});
