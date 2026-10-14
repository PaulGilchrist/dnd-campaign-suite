import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isDistanceInRange: vi.fn((dist, rangeFt) => rangeFt == null || dist == null || dist <= rangeFt),
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { processGreaseAreaSave } from './greaseAreaSaveHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as mapsService from '../../../maps/mapsService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as automationImmunities from '../../../combat/automation/automationImmunities.js';

// ── Constants & Helpers ────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'test-map';
const casterName = 'TestWizard';

function makeGreaseTracking(overrides = {}) {
  return {
    caster: casterName,
    center: { gridX: 5, gridY: 10 },
    saveDc: 13,
    saveType: 'DEX',
    condition: 'Prone',
    radius: 10,
    ...overrides,
  };
}

function setupBaseRuntime(mockFn, overrides = {}) {
  mockFn.mockImplementation((name, key) => {
    if (key.includes('_grease_')) {
      return makeGreaseTracking(overrides);
    }
    if (key === 'activeConditions') return [];
    return null;
  });
}

function setupBaseMap(mockFn) {
  mockFn.mockResolvedValue({
    players: [{ name: casterName, gridX: 5, gridY: 10 }],
    placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
  });
}

// ── Tests ──────────────────────────────────────────────────────

describe('greaseAreaSaveHandler.processGreaseAreaSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('early returns', () => {
    it('returns null when target is already prone (case-insensitive)', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('_grease_')) {
          return makeGreaseTracking();
        }
        if (key === 'activeConditions') return ['prone'];
        return null;
      });
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
      });
      rangeCheck.isWithinRange.mockResolvedValue(true);

      setupBaseRuntime(useRuntimeState.getRuntimeValue);
      expect(await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName)).toBeNull();

      // mixed case
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('_grease_')) {
          return makeGreaseTracking();
        }
        if (key === 'activeConditions') return ['PrOnE'];
        return null;
      });
      expect(await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName)).toBeNull();
    });

    it('returns null when player is immune to the condition, skips immunity for non-players', async () => {
      // immune player
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('_grease_')) {
          return makeGreaseTracking();
        }
        if (key === 'activeConditions') return [];
        if (key === 'computedStats') return { immunities: ['prone'] };
        return null;
      });
      mapsService.loadMapData.mockResolvedValue({
        players: [
          { name: casterName, gridX: 5, gridY: 10 },
          { name: 'Goblin', gridX: 6, gridY: 10 },
        ],
        placedItems: [],
      });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'player' }],
      });
      automationImmunities.playerIsImmuneToCondition.mockReturnValue(true);
      rangeCheck.isWithinRange.mockResolvedValue(true);

      const result = await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);
      expect(result).toBeNull();
      expect(automationImmunities.playerIsImmuneToCondition).toHaveBeenCalled();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();

      // non-player target — skips immunity check
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('_grease_')) {
          return makeGreaseTracking();
        }
        if (key === 'activeConditions') return [];
        return null;
      });
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
      });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      automationImmunities.playerIsImmuneToCondition.mockClear();
      rangeCheck.isWithinRange.mockResolvedValue(true);
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-monster',
        promise: Promise.resolve({ success: true }),
      });

      const result2 = await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);
      expect(result2.type).toBe('popup');
      expect(automationImmunities.playerIsImmuneToCondition).not.toHaveBeenCalled();
    });
  });

  describe('save processing', () => {
    function setupBaseSave() {
      setupBaseRuntime(useRuntimeState.getRuntimeValue);
      setupBaseMap(mapsService.loadMapData);
      rangeCheck.isWithinRange.mockResolvedValue(true);
    }

    it('triggers save listener with correct parameters', async () => {
      setupBaseSave();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-test',
        promise: Promise.resolve({ success: false }),
      });

      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'DEX',
        saveDc: 13,
      });
    });

    it('returns popup with correct description based on save result', async () => {
      setupBaseSave();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });

      // failed save
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-fail',
        promise: Promise.resolve({ success: false }),
      });
      let result = await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('failed');
      expect(result.payload.description).toContain('DEX');
      expect(result.payload.description).toContain('DC 13');
      expect(result.payload.description).toContain('Becomes Prone');

      // successful save
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-success',
        promise: Promise.resolve({ success: true }),
      });
      result = await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);
      expect(result.payload.description).toContain('succeeded');
      expect(result.payload.description).toContain('Unaffected');
    });

    it('returns popup with correct payload type', async () => {
      setupBaseSave();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-payload',
        promise: Promise.resolve({ success: false }),
      });

      const result = await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Grease');
    });

    it('applies condition on failed save and does not on success', async () => {
      setupBaseSave();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });

      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-apply',
        promise: Promise.resolve({ success: false }),
      });
      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['prone']),
        campaignName,
      );

      // successful save — no condition applied
      useRuntimeState.setRuntimeValue.mockClear();
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-no-apply',
        promise: Promise.resolve({ success: true }),
      });
      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.anything(),
        campaignName,
      );
    });

    it('deduplicates conditions before adding on failed save', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('_grease_')) {
          return makeGreaseTracking({ condition: 'Blinded' });
        }
        if (key === 'activeConditions') return ['blinded', 'frightened'];
        return null;
      });
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
      });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      rangeCheck.isWithinRange.mockResolvedValue(true);
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-dedup',
        promise: Promise.resolve({ success: false }),
      });

      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['frightened', 'blinded'],
        campaignName,
      );
    });
  });

  describe('log entries in process', () => {
    function setupBaseSave() {
      setupBaseRuntime(useRuntimeState.getRuntimeValue);
      setupBaseMap(mapsService.loadMapData);
      rangeCheck.isWithinRange.mockResolvedValue(true);
    }

    it('calls addEntry with ability_use when triggering save', async () => {
      setupBaseSave();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-trigger',
        promise: Promise.resolve({ success: false }),
      });

      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'Grease',
          description: expect.stringContaining('Goblin'),
        }),
      );
    });

    it('calls addEntry with save_result on failed and successful saves', async () => {
      setupBaseSave();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });

      // failed save
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-result-fail',
        promise: Promise.resolve({ success: false }),
      });
      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      let saveResultCall = logService.addEntry.mock.calls.find(
        (c) => c[1].type === 'save_result',
      );
      expect(saveResultCall).toBeDefined();
      expect(saveResultCall[1]).toEqual(
        expect.objectContaining({
          type: 'save_result',
          targetName: 'Goblin',
          success: false,
          saveDc: 13,
          saveType: 'DEX',
          description: expect.stringContaining('failed'),
        }),
      );

      // successful save
      logService.addEntry.mockClear();
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-result-success',
        promise: Promise.resolve({ success: true }),
      });
      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      saveResultCall = logService.addEntry.mock.calls.find(
        (c) => c[1].type === 'save_result',
      );
      expect(saveResultCall).toBeDefined();
      expect(saveResultCall[1]).toEqual(
        expect.objectContaining({
          type: 'save_result',
          targetName: 'Goblin',
          success: true,
          saveDc: 13,
          saveType: 'DEX',
          description: expect.stringContaining('succeeded'),
        }),
      );
    });
  });

  describe('error handling', () => {
    it('returns null on unexpected error during processing', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue({
        caster: casterName,
        center: { gridX: 5, gridY: 10 },
        saveDc: 13,
      });
      mapsService.loadMapData.mockRejectedValue(new Error('map not found'));

      const result = await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result).toBeNull();
    });

    it('propagates error when getRuntimeValue throws on tracking lookup', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation(() => {
        throw new Error('runtime error');
      });

      await expect(
        processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName),
      ).rejects.toThrow('runtime error');
    });
  });

  describe('target found in placedItems', () => {
    it('finds target in placedItems and proceeds with save', async () => {
      setupBaseRuntime(useRuntimeState.getRuntimeValue);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
      });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      rangeCheck.isWithinRange.mockResolvedValue(true);
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-placed-items',
        promise: Promise.resolve({ success: true }),
      });

      const result = await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result.type).toBe('popup');
    });

    it('prefers players over placedItems when target is in both', async () => {
      setupBaseRuntime(useRuntimeState.getRuntimeValue);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'Goblin', gridX: 3, gridY: 3 }],
        placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
      });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'player' }],
      });
      rangeCheck.isWithinRange.mockResolvedValue(true);
      automationImmunities.playerIsImmuneToCondition.mockReturnValue(false);
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-prefer-players',
        promise: Promise.resolve({ success: true }),
      });

      const result = await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(rangeCheck.isWithinRange).toHaveBeenCalledWith(casterName, 'Goblin', expect.any(Number));
    });
  });
});
