// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, processWebAreaSave } from './webAreaSaveHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as mapsService from '../../../maps/mapsService.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as automationImmunities from '../../../combat/automation/automationImmunities.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

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
    name: 'Web',
    automation: { type: 'web', saveType: 'DEX', saveDc: 15, ...automation },
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

// ── Tests ──────────────────────────────────────────────────────

describe('webAreaSaveHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic handling', () => {
    it('returns modal with setCondition and correct payload', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('setCondition');
      expect(result.payload.conditionName).toBe('restrained');
      expect(result.payload.saveType).toBe('DEX');
      expect(result.payload.saveDc).toBe(15);
      expect(result.payload.rangeFeet).toBe(20);
      expect(result.payload.durationRounds).toBe(60);
      expect(result.payload.featureName).toBe('Web');
      expect(result.payload.campaignName).toBe(campaignName);
      expect(result.payload.mapData).toEqual({
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
      });
    });

    it('uses custom saveType from automation config', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);

      const result = await handle(makeAction({ saveType: 'CON' }), makePlayerStats(), campaignName, null);
      expect(result.payload.saveType).toBe('CON');
    });
  });

  describe('tracking data storage', () => {
    it('stores tracking data with map position', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        '_web_TestCaster',
        expect.objectContaining({
          caster: 'TestCaster',
          saveDc: 15,
          saveType: 'DEX',
          radius: 20,
          mapName,
          campaignName,
          center: { gridX: 5, gridY: 10 },
        }),
        campaignName,
      );
    });

    it('stores null center when caster not found on map', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      mapsService.loadMapData.mockResolvedValue({ players: [] });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      const trackingCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === '_web_TestCaster',
      );
      expect(trackingCall[2].center).toBeNull();
    });

    it('stores null center when mapName is null', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const trackingCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === '_web_TestCaster',
      );
      expect(trackingCall[2].center).toBeNull();
    });

    it('stores duration from automation config', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);

      await handle(makeAction({ duration: '10 minutes' }), makePlayerStats(), campaignName, null);

      const trackingCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === '_web_TestCaster',
      );
      expect(trackingCall[2].duration).toBe('10 minutes');
    });

    it('defaults duration to 1 hour when not specified', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);

      await handle(makeAction({ duration: undefined }), makePlayerStats(), campaignName, null);

      const trackingCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === '_web_TestCaster',
      );
      expect(trackingCall[2].duration).toBe('1 hour');
    });
  });

  describe('map handling', () => {
    it('does not load map data when mapName is null', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(mapsService.loadMapData).not.toHaveBeenCalled();
    });

    it('handles map load failure gracefully', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      mapsService.loadMapData.mockRejectedValue(new Error('not found'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, 'bad-map');

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('setCondition');
    });
  });
});

describe('webAreaSaveHandler.processWebAreaSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('early returns', () => {
    it('returns null when target is already restrained', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'DEX' };
        if (key === 'activeConditions') return ['restrained'];
        return null;
      });

      expect(await processWebAreaSave('TestCaster', 'Goblin', campaignName, mapName)).toBeNull();
    });

    it('returns null when target is immune to restrained', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'DEX' };
        if (key === 'activeConditions') return [];
        if (key === 'computedStats') return {};
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'player', computedStats: {} }],
      });
      automationImmunities.playerIsImmuneToCondition.mockReturnValue(true);

      const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, mapName);

      expect(result).toBeNull();
      expect(automationImmunities.playerIsImmuneToCondition).toHaveBeenCalledWith(
        expect.objectContaining({
          conditionKey: 'restrained',
          campaignName,
        }),
      );
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

  });

  describe('save processing', () => {
    function setupBaseSave() {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'DEX' };
        if (key === 'activeConditions') return [];
        return null;
      });
      automationImmunities.playerIsImmuneToCondition.mockReturnValue(false);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'player', computedStats: {} }],
      });
    }

    it('triggers save listener with correct parameters on failed save', async () => {
      setupBaseSave();
      const mockPromise = Promise.resolve({ success: false });
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-fail',
        promise: mockPromise,
      });

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, mapName);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'DEX',
        saveDc: 15,
      });
    });

    it('returns popup with correct description based on save result', async () => {
      setupBaseSave();

      // failed save
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-fail-desc',
        promise: Promise.resolve({ success: false }),
      });
      let result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, mapName);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('failed');
      expect(result.payload.description).toContain('DEX');
      expect(result.payload.description).toContain('DC 15');

      // successful save
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-success',
        promise: Promise.resolve({ success: true }),
      });
      result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, mapName);
      expect(result.payload.description).toContain('succeeded');
    });

    it('applies restrained condition on failed save and not on success', async () => {
      setupBaseSave();

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-cond',
        promise: Promise.resolve({ success: false }),
      });
      await processWebAreaSave('TestCaster', 'Goblin', campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['restrained']),
        campaignName,
      );

      // successful save — no condition applied
      useRuntimeState.setRuntimeValue.mockClear();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-nocond',
        promise: Promise.resolve({ success: true }),
      });
      await processWebAreaSave('TestCaster', 'Goblin', campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.anything(),
        campaignName,
      );
    });

    it('calls addEntry with ability_use, save_result on failed save', async () => {
      setupBaseSave();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-entry-fail',
        promise: Promise.resolve({ success: false }),
      });

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCaster',
          abilityName: 'Web',
          description: expect.stringContaining('Goblin'),
        }),
      );

      const saveResultCall = logService.addEntry.mock.calls.find(
        (c) => c[1].type === 'save_result',
      );
      expect(saveResultCall).toBeDefined();
      expect(saveResultCall[1]).toEqual(
        expect.objectContaining({
          type: 'save_result',
          targetName: 'Goblin',
          success: false,
          saveDc: 15,
          saveType: 'DEX',
        }),
      );
    });

    it('calls addEntry with save_result on successful save', async () => {
      setupBaseSave();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-result-success',
        promise: Promise.resolve({ success: true }),
      });

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, mapName);

      const saveResultCall = logService.addEntry.mock.calls.find(
        (c) => c[1].type === 'save_result',
      );
      expect(saveResultCall).toBeDefined();
      expect(saveResultCall[1]).toEqual(
        expect.objectContaining({
          type: 'save_result',
          targetName: 'Goblin',
          success: true,
          saveDc: 15,
          saveType: 'DEX',
        }),
      );
    });
  });

  describe('map-based distance checks', () => {
    it('checks distance and proceeds when target is within radius', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'DEX', center: { gridX: 5, gridY: 10 }, radius: 20 };
        if (key === 'activeConditions') return [];
        return null;
      });
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
      });
      rangeValidation.getDistanceFeet.mockReturnValue(5);
      automationImmunities.playerIsImmuneToCondition.mockReturnValue(false);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'player', computedStats: {} }],
      });
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-dist-within',
        promise: Promise.resolve({ success: true }),
      });

      const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(rangeValidation.getDistanceFeet).toHaveBeenCalled();
    });

    it('proceeds with save when map load fails', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return {
          caster: 'TestCaster',
          center: { gridX: 5, gridY: 10 },
          saveDc: 15,
          saveType: 'DEX',
          radius: 20,
        };
        if (key === 'activeConditions') return [];
        return null;
      });
      mapsService.loadMapData.mockRejectedValue(new Error('map not found'));
      automationImmunities.playerIsImmuneToCondition.mockReturnValue(false);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'player', computedStats: {} }],
      });
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-dist-error',
        promise: Promise.resolve({ success: true }),
      });

      const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, mapName);

      expect(result.type).toBe('popup');
    });

  });
});
