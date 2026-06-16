import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

import { handle } from './suggestionHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Suggestion',
    automation: { type: 'suggestion', saveType: 'WIS', saveDc: 15, ...automation },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

describe('suggestionHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('target resolution', () => {
    it('should return popup when no target selected', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No target selected');
    });

    it('should call resolveTarget with campaignName and casterName', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      createSaveListener.mockReturnValue({
        promptId: 'sug-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(resolveTarget).toHaveBeenCalledWith(campaignName, 'TestCaster');
    });
  });

  describe('successful save', () => {
    it('should return popup when target succeeds save', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      createSaveListener.mockReturnValue({
        promptId: 'sug-success',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('succeeded on WIS save');
    });

    it('should call addEntry with save_result on success', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      createSaveListener.mockReturnValue({
        promptId: 'sug-save',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: true,
        rollType: 'save-suggestion',
      }));
    });
  });

  describe('failed save', () => {
    it('should apply Charmed condition', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'sug-fail',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['charmed']),
        campaignName,
      );
      expect(result.payload.description).toContain('Charmed');
    });

    it('should deduplicate charmed condition', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue(['charmed']);
      createSaveListener.mockReturnValue({
        promptId: 'sug-dedup',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('should call addExpiration with default 24 hour duration', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'sug-exp',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'Goblin',
        expect.arrayContaining([{ type: 'charmed', condition: 'charmed' }]),
        campaignName,
        24,
      );
    });

    it('should use 8 hour duration when auto.duration is true', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'sug-exp-short',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction({ duration: true }), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'Goblin',
        expect.arrayContaining([{ type: 'charmed', condition: 'charmed' }]),
        campaignName,
        8,
      );
    });

    it('should call postLogEntry on failed save', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'sug-log',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: 'Goblin',
          condition: 'Charmed',
        }),
      );
    });

    it('should call addEntry with save_result on failed save', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'sug-fail-entry',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: false,
        rollType: 'save-suggestion',
      }));
    });

    it('should include caster name in description', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'sug-desc',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('TestCaster');
    });
  });

  describe('edge cases', () => {
    it('should handle empty automation object', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      createSaveListener.mockReturnValue({
        promptId: 'sug-empty-auto',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle({ name: 'Suggestion', automation: {} }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
    });

    it('should use action.name in log entries', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      createSaveListener.mockReturnValue({
        promptId: 'sug-name',
        promise: Promise.resolve({ success: false }),
      });

      await handle({ name: 'My Suggestion', automation: { saveType: 'WIS', saveDc: 15 } }, makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        characterName: 'TestCaster',
        abilityName: 'My Suggestion',
      }));
    });
  });
});
