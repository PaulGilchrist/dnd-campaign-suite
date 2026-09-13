// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './tashasLaughterHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';

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

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

const campaignName = 'test-campaign';

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
    name: "Tasha's Hideous Laughter",
    automation: { type: 'tashas_laughter', saveType: 'WIS', saveDc: 15, ...automation },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster' },
    { name: 'Orc', type: 'monster' },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

/**
 * Configure getRuntimeValue to dispatch on key, returning the appropriate value.
 * Returns a function to call before each test so the mock is fresh.
 */
function mockGetRuntimeValue(dispatch) {
  runtimeState.getRuntimeValue.mockImplementation((playerName, key, _cName) => dispatch(playerName, key, _cName));
}

// ── handle ───────────────────────────────────────────────────────

describe('tashasLaughterHandler.handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('combat context validation', () => {
    it('should return popup when no combat context exists', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('should return popup when combat context has no creatures', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });
  });

  describe('target processing', () => {
    it('should skip the caster itself from targets', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-caster-skip',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Two monsters (Goblin + Orc) should get save listeners; caster is skipped
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(2);
    });

    it('should return early when all creatures are the caster', async () => {
      const onlyPlayerCombat = {
        creatures: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      damageUtils.getCombatContext.mockResolvedValue(onlyPlayerCombat);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-only-player',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No valid targets');
    });

    it('should handle all targets saving successfully', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(20);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-success',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('creature(s) saved');
    });

    it('should report both affected and saved creatures in summary', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);

      let callCount = 0;
      savePrompt.createSaveListener.mockImplementation(() => {
        callCount++;
        const success = callCount === 1 ? false : true;
        return {
          promptId: `laughter-prompt-${callCount}`,
          promise: Promise.resolve({ success }),
        };
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('creature(s)');
      expect(result.payload.description).toContain('creature(s) saved');
    });

    it('should filter targets when metaCtx.targets is provided', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-selected',
        promise: Promise.resolve({ success: false }),
      });
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'activeConditions') return [];
        return null;
      });

      const action = { ...makeAction(), metaCtx: { targets: ['Goblin'] } };
      await handle(action, makePlayerStats(), campaignName, null);

      // Only Goblin should get a save listener, not Orc
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName: 'Goblin' }),
      );
    });

    it('should return early when selected targets are empty after filtering', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);

      const action = { ...makeAction(), metaCtx: { targets: [] } };
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No valid targets');
    });

    it('should exclude caster from selected targets', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-caster-filtered',
        promise: Promise.resolve({ success: true }),
      });

      const action = { ...makeAction(), metaCtx: { targets: ['TestCaster', 'Goblin'] } };
      await handle(action, makePlayerStats(), campaignName, null);

      // Only Goblin should get a save listener; TestCaster is excluded
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName: 'Goblin' }),
      );
    });
  });

  describe('failed save handling', () => {
    function setupFailedSaveMock() {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'activeConditions') return [];
        if (key === 'targetEffects') return [];
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-fail',
        promise: Promise.resolve({ success: false }),
      });
    }

    it('should apply Prone and Incapacitated conditions on failed save', async () => {
      setupFailedSaveMock();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['prone', 'incapacitated']),
        campaignName,
      );
      expect(result.payload.description).toContain('Prone and Incapacitated');
    });

    it('should preserve existing conditions and add new ones', async () => {
      setupFailedSaveMock();
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'activeConditions') return ['frightened'];
        if (key === 'targetEffects') return [];
        return null;
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['frightened', 'prone', 'incapacitated']),
        campaignName,
      );
    });

    it('should add expiration for concentration', async () => {
      setupFailedSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'TestCaster', targetName: 'Goblin', effects: expect.arrayContaining([
          { type: 'condition', condition: 'prone' },
          { type: 'condition', condition: 'incapacitated' },
          { type: 'tashas_laughter_expiration' },
        ]), campaignName });
    });

    it('should register tashas_hideous_laughter targetEffect on failed save', async () => {
      setupFailedSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: 'Goblin',
            effect: 'tashas_hideous_laughter',
            source: 'TestCaster',
            dc: 15,
            duration: 'concentration',
            conditions: ['prone', 'incapacitated'],
          }),
        ]),
        campaignName,
      );
    });

    it('should update existing targetEffect if one already exists', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(16);
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'activeConditions') return [];
        if (key === 'targetEffects') return [
          { target: 'Goblin', effect: 'tashas_hideous_laughter', source: 'TestCaster', dc: 14, duration: 'concentration', conditions: ['prone', 'incapacitated'] },
        ];
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-update',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: 'Goblin',
            effect: 'tashas_hideous_laughter',
            dc: 16,
          }),
        ]),
        campaignName,
      );
    });
  });

  describe('successful save handling', () => {
    function setupSuccessfulSaveMock() {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(20);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-success-save',
        promise: Promise.resolve({ success: true }),
      });
    }

    it('should not apply conditions when save succeeds', async () => {
      setupSuccessfulSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.any(Array),
      );
    });
  });

  describe('error handling - addEntry rejection', () => {
    it('should handle addEntry rejection on ability_use log without throwing', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-catch',
        promise: Promise.resolve({ success: true }),
      });
      addEntry.mockImplementation(() => Promise.reject(new Error('log write failed')));

      await expect(
        handle(makeAction(), makePlayerStats(), campaignName, null)
      ).resolves.toBeDefined();
    });

    it('should handle addEntry rejection on save_result success log without throwing', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-catch-success',
        promise: Promise.resolve({ success: true }),
      });
      addEntry.mockImplementation((_camp, entry) => {
        if (entry.type === 'save_result' && entry.saveType === 'WIS') {
          return Promise.reject(new Error('log write failed'));
        }
        return Promise.resolve();
      });

      await expect(
        handle(makeAction(), makePlayerStats(), campaignName, null)
      ).resolves.toBeDefined();
    });

    it('should handle addEntry rejection on condition log without throwing', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'activeConditions') return [];
        if (key === 'targetEffects') return [];
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-catch-fail',
        promise: Promise.resolve({ success: false }),
      });
      addEntry.mockImplementation((_camp, entry) => {
        if (entry.type === 'condition') {
          return Promise.reject(new Error('log write failed'));
        }
        return Promise.resolve();
      });

      await expect(
        handle(makeAction(), makePlayerStats(), campaignName, null)
      ).resolves.toBeDefined();
    });

    it('should handle addEntry rejection on save_result failure log without throwing', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'activeConditions') return [];
        if (key === 'targetEffects') return [];
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-catch-fail-save',
        promise: Promise.resolve({ success: false }),
      });
      addEntry.mockImplementation((_camp, entry) => {
        if (entry.type === 'save_result' && entry.success === false) {
          return Promise.reject(new Error('log write failed'));
        }
        return Promise.resolve();
      });

      await expect(
        handle(makeAction(), makePlayerStats(), campaignName, null)
      ).resolves.toBeDefined();
    });

    it('should handle missing automation object on action', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-no-automation',
        promise: Promise.resolve({ success: true }),
      });

      const action = { name: "Tasha's Hideous Laughter" };
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('creature(s) saved');
    });

    it('should handle non-array activeConditions gracefully', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'activeConditions') return 'not-an-array';
        if (key === 'activeConditionMeta') return {};
        if (key === 'targetEffects') return [];
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-non-array-conditions',
        promise: Promise.resolve({ success: false }),
      });

      await expect(
        handle(makeAction(), makePlayerStats(), campaignName, null)
      ).resolves.toBeDefined();
    });
  });
});
