// @improved-by-ai
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

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, processGreaseAreaSave } from './greaseAreaSaveHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as mapsService from '../../../maps/mapsService.js';
import * as automationImmunities from '../../../combat/automation/automationImmunities.js';

// ── Constants & Helpers ────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'test-map';
const casterName = 'TestWizard';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Intelligence', bonus: 2 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Grease',
    automation: {
      type: 'grease_area_save',
      saveType: 'DEX',
      conditionInflicted: 'Prone',
      size: '10-foot',
      duration: '1_minute',
      ...automation,
    },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: casterName, type: 'player', gridX: 5, gridY: 10 },
  ],
  players: [{ name: casterName, gridX: 5, gridY: 10 }],
  placedItems: [],
};

function findTrackingCall() {
  return useRuntimeState.setRuntimeValue.mock.calls.find(
    (c) => c[1] === '_grease_TestWizard',
  ) || useRuntimeState.setRuntimeValue.mock.calls.find(
    (c) => c[1].includes('_grease_'),
  );
}

// ── Tests ──────────────────────────────────────────────────────

describe('greaseAreaSaveHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('return value', () => {
    it('returns modal with setCondition modalName', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result).toEqual({
        type: 'modal',
        modalName: 'setCondition',
        payload: expect.objectContaining({
          combatSummary: baseCombatContext,
          attackerName: casterName,
          saveDc: 13,
          campaignName,
          featureName: 'Grease',
          conditionName: 'Prone',
          saveType: 'DEX',
          rangeFeet: 10,
          durationRounds: 10,
        }),
      });
    });

    it('includes attackerPos from map data', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 12, gridY: 20 }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.payload.attackerPos).toEqual({ gridX: 12, gridY: 20 });
    });

    it('includes null attackerPos when caster not on map', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({ players: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.payload.attackerPos).toBeNull();
    });

    it('includes mapData in payload when mapName provided', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      const expectedMap = { players: [{ name: casterName, gridX: 5, gridY: 10 }] };
      mapsService.loadMapData.mockResolvedValue(expectedMap);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.payload.mapData).toEqual(expectedMap);
    });

    it('includes null mapData in payload when mapName is null', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.mapData).toBeNull();
    });
  });

  describe('save type and condition defaults', () => {
    it('uses custom saveType from automation', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);

      const result = await handle(
        makeAction({ saveType: 'CON' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.saveType).toBe('CON');
    });

    it('defaults saveType to DEX when not specified', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(10);

      const result = await handle(
        makeAction({ saveType: undefined }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.saveType).toBe('DEX');
    });

    it('uses custom conditionInflicted from automation', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      const result = await handle(
        makeAction({ conditionInflicted: 'Blinded' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.conditionName).toBe('Blinded');
    });

    it('defaults conditionInflicted to Prone', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      const result = await handle(
        makeAction({ conditionInflicted: undefined }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.conditionName).toBe('Prone');
    });
  });

  describe('area radius parsing', () => {
    it('parses 10-foot size', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      const result = await handle(
        makeAction({ size: '10-foot' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.rangeFeet).toBe(10);
    });

    it('parses 15-foot size', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      const result = await handle(
        makeAction({ size: '15-foot' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.rangeFeet).toBe(15);
    });

    it('defaults to 10 when size pattern does not match', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      const result = await handle(
        makeAction({ size: 'invalid' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.rangeFeet).toBe(10);
    });

    it('defaults to 10 when size is undefined', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      const result = await handle(
        makeAction({ size: undefined }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.rangeFeet).toBe(10);
    });
  });

  describe('duration and expiration', () => {
    it('sets expiration for 1_minute duration (10 rounds)', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      await handle(makeAction({ duration: '1_minute' }), makePlayerStats(), campaignName, mapName);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        casterName,
        casterName,
        [{ type: 'remove_grease_area', greaseKey: '_grease_TestWizard' }],
        campaignName,
        10,
      );
    });

    it('sets expiration for round-based duration', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      await handle(makeAction({ duration: '3_rounds' }), makePlayerStats(), campaignName, mapName);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        casterName,
        casterName,
        expect.any(Array),
        campaignName,
        3,
      );
    });

    it('sets durationRounds=15 for 1_rounds duration', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      const result = await handle(
        makeAction({ duration: '1_rounds' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.durationRounds).toBe(1);
    });

    it('does not set expiration when duration is unrecognized', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      await handle(makeAction({ duration: 'unknown' }), makePlayerStats(), campaignName, mapName);

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('does not set expiration when duration is empty string', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      await handle(makeAction({ duration: '' }), makePlayerStats(), campaignName, mapName);

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('does not set expiration when duration is undefined', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      await handle(makeAction({ duration: undefined }), makePlayerStats(), campaignName, mapName);

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('includes durationRounds in payload for 1_minute', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      const result = await handle(
        makeAction({ duration: '1_minute' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.durationRounds).toBe(10);
    });

    it('includes durationRounds in payload for round-based duration', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      const result = await handle(
        makeAction({ duration: '5_rounds' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.durationRounds).toBe(5);
    });

    it('includes null durationRounds in payload when unrecognized', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      const result = await handle(
        makeAction({ duration: 'unknown' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.durationRounds).toBeUndefined();
    });
  });

  describe('tracking data storage', () => {
    it('stores grease tracking data with all fields', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      const call = findTrackingCall();
      expect(call).toBeDefined();
      expect(call[0]).toBe(casterName);
      expect(call[1]).toBe('_grease_TestWizard');
      expect(call[3]).toBe(campaignName);

      const data = call[2];
      expect(data).toEqual(
        expect.objectContaining({
          caster: casterName,
          saveDc: 13,
          saveType: 'DEX',
          condition: 'Prone',
          radius: 10,
          mapName,
          campaignName,
          center: { gridX: 5, gridY: 10 },
          duration: '1_minute',
        }),
      );
      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe('number');
    });

    it('stores null center when caster not found on map', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({ players: [] });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      const call = findTrackingCall();
      expect(call[2].center).toBeNull();
    });

    it('stores null center when mapName is null', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const call = findTrackingCall();
      expect(call[2].center).toBeNull();
      expect(call[2].mapName).toBeNull();
    });

    it('stores mapName in tracking data when mapName provided', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      const call = findTrackingCall();
      expect(call[2].mapName).toBe(mapName);
    });

    it('stores null mapName in tracking data when mapName is null', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const call = findTrackingCall();
      expect(call[2].mapName).toBeNull();
    });

    it('stores duration from automation in tracking data', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);

      await handle(
        makeAction({ duration: '3_rounds' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      const call = findTrackingCall();
      expect(call[2].duration).toBe('3_rounds');
    });

    it('defaults duration to 1 minute when not specified', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);

      await handle(makeAction({ duration: undefined }), makePlayerStats(), campaignName, null);

      const call = findTrackingCall();
      expect(call[2].duration).toBe('1 minute');
    });

    it('stores radius from automation in tracking data', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      await handle(makeAction({ size: '15-foot' }), makePlayerStats(), campaignName, mapName);

      const call = findTrackingCall();
      expect(call[2].radius).toBe(15);
    });

    it('stores condition from automation in tracking data', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      await handle(
        makeAction({ conditionInflicted: 'Blinded' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      const call = findTrackingCall();
      expect(call[2].condition).toBe('Blinded');
    });

    it('stores saveType from automation in tracking data', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      await handle(makeAction({ saveType: 'CON' }), makePlayerStats(), campaignName, mapName);

      const call = findTrackingCall();
      expect(call[2].saveType).toBe('CON');
    });
  });

  describe('map handling', () => {
    it('does not load map data when mapName is null', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(mapsService.loadMapData).not.toHaveBeenCalled();
    });

    it('handles map load failure gracefully', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockRejectedValue(new Error('not found'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, 'bad-map');

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('setCondition');
      expect(result.payload.attackerPos).toBeNull();
      expect(result.payload.mapData).toBeNull();
    });

    it('passes caster position to tracking when found on map', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 7, gridY: 14 }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      const call = findTrackingCall();
      expect(call[2].center).toEqual({ gridX: 7, gridY: 14 });
    });
  });

  describe('log entries', () => {
    it('calls addEntry with ability_use type and correct details', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'Grease',
          description: expect.stringContaining('DEX save DC 13'),
        }),
      );
    });

    it('includes range in log description', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      await handle(
        makeAction({ size: '15-foot' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          description: expect.stringContaining('15ft'),
        }),
      );
    });

    it('catches and swallows addEntry errors without crashing', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });
      logService.addEntry.mockImplementation(
        () => Promise.reject(new Error('network')).catch(() => {}),
      );

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('modal');
    });
  });
});

describe('greaseAreaSaveHandler.processGreaseAreaSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('early returns', () => {
    it('returns null when no tracking data exists', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      const result = await processGreaseAreaSave(
        casterName,
        'Goblin',
        campaignName,
        mapName,
      );

      expect(result).toBeNull();
    });

    it('returns null when tracking has no center', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue({
        caster: casterName,
        center: null,
        saveDc: 13,
      });

      const result = await processGreaseAreaSave(
        casterName,
        'Goblin',
        campaignName,
        mapName,
      );

      expect(result).toBeNull();
    });

    it('returns null when tracking has no saveDc', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue({
        caster: casterName,
        center: { gridX: 5, gridY: 10 },
      });

      const result = await processGreaseAreaSave(
        casterName,
        'Goblin',
        campaignName,
        mapName,
      );

      expect(result).toBeNull();
    });

    it('returns null when mapName is null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue({
        caster: casterName,
        center: { gridX: 5, gridY: 10 },
        saveDc: 13,
      });

      const result = await processGreaseAreaSave(
        casterName,
        'Goblin',
        campaignName,
        null,
      );

      expect(result).toBeNull();
    });

    it('returns null when target not found on map players', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue({
        caster: casterName,
        center: { gridX: 5, gridY: 10 },
        saveDc: 13,
      });
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [],
      });

      const result = await processGreaseAreaSave(
        casterName,
        'Unknown',
        campaignName,
        mapName,
      );

      expect(result).toBeNull();
    });

    it('returns null when target not found on map placedItems', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue({
        caster: casterName,
        center: { gridX: 5, gridY: 10 },
        saveDc: 13,
      });
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [],
      });

      const result = await processGreaseAreaSave(
        casterName,
        'UnknownItem',
        campaignName,
        mapName,
      );

      expect(result).toBeNull();
    });

    it('returns null when target is outside the area radius', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue({
        caster: casterName,
        center: { gridX: 5, gridY: 10 },
        saveDc: 13,
        saveType: 'DEX',
        condition: 'Prone',
        radius: 10,
      });
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [{ name: 'Goblin', gridX: 50, gridY: 50 }],
      });
      rangeValidation.getDistanceFeet.mockReturnValue(200);

      const result = await processGreaseAreaSave(
        casterName,
        'Goblin',
        campaignName,
        mapName,
      );

      expect(result).toBeNull();
    });

    it('returns null when target is already prone (uppercase)', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('_grease_')) {
          return {
            caster: casterName,
            center: { gridX: 5, gridY: 10 },
            saveDc: 13,
            saveType: 'DEX',
            condition: 'Prone',
            radius: 10,
          };
        }
        if (key === 'activeConditions') return ['Prone'];
        return null;
      });
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
      });
      rangeValidation.getDistanceFeet.mockReturnValue(5);

      const result = await processGreaseAreaSave(
        casterName,
        'Goblin',
        campaignName,
        mapName,
      );

      expect(result).toBeNull();
    });

    it('returns null when target is already prone (lowercase)', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('_grease_')) {
          return {
            caster: casterName,
            center: { gridX: 5, gridY: 10 },
            saveDc: 13,
            saveType: 'DEX',
            condition: 'Prone',
            radius: 10,
          };
        }
        if (key === 'activeConditions') return ['prone'];
        return null;
      });
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
      });
      rangeValidation.getDistanceFeet.mockReturnValue(5);

      const result = await processGreaseAreaSave(
        casterName,
        'Goblin',
        campaignName,
        mapName,
      );

      expect(result).toBeNull();
    });

    it('returns null when target is already prone (mixed case)', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('_grease_')) {
          return {
            caster: casterName,
            center: { gridX: 5, gridY: 10 },
            saveDc: 13,
            saveType: 'DEX',
            condition: 'Prone',
            radius: 10,
          };
        }
        if (key === 'activeConditions') return ['PrOnE'];
        return null;
      });
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
      });
      rangeValidation.getDistanceFeet.mockReturnValue(5);

      const result = await processGreaseAreaSave(
        casterName,
        'Goblin',
        campaignName,
        mapName,
      );

      expect(result).toBeNull();
    });

    it('returns null when player is immune to the condition', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('_grease_')) {
          return {
            caster: casterName,
            center: { gridX: 5, gridY: 10 },
            saveDc: 13,
            saveType: 'DEX',
            condition: 'Prone',
            radius: 10,
          };
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
      rangeValidation.getDistanceFeet.mockReturnValue(5);

      const result = await processGreaseAreaSave(
        casterName,
        'Goblin',
        campaignName,
        mapName,
      );

      expect(result).toBeNull();
      expect(automationImmunities.playerIsImmuneToCondition).toHaveBeenCalledWith(
        expect.objectContaining({
          conditionKey: 'prone',
          campaignName,
        }),
      );
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('skips immunity check for non-player targets', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('_grease_')) {
          return {
            caster: casterName,
            center: { gridX: 5, gridY: 10 },
            saveDc: 13,
            saveType: 'DEX',
            condition: 'Prone',
            radius: 10,
          };
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
      rangeValidation.getDistanceFeet.mockReturnValue(5);

      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-monster',
        promise: Promise.resolve({ success: true }),
      });

      const result = await processGreaseAreaSave(
        casterName,
        'Goblin',
        campaignName,
        mapName,
      );

      expect(result.type).toBe('popup');
      expect(automationImmunities.playerIsImmuneToCondition).not.toHaveBeenCalled();
    });
  });

  describe('save processing', () => {
    function setupBaseSave() {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('_grease_')) {
          return {
            caster: casterName,
            center: { gridX: 5, gridY: 10 },
            saveDc: 13,
            saveType: 'DEX',
            condition: 'Prone',
            radius: 10,
          };
        }
        if (key === 'activeConditions') return [];
        return null;
      });
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
      });
      rangeValidation.getDistanceFeet.mockReturnValue(5);
    }

    it('triggers save listener with correct parameters on failed save', async () => {
      setupBaseSave();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-fail',
        promise: Promise.resolve({ success: false }),
      });

      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'DEX',
        saveDc: 13,
      });
    });

    it('triggers save listener with correct parameters on successful save', async () => {
      setupBaseSave();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-success',
        promise: Promise.resolve({ success: true }),
      });

      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'DEX',
        saveDc: 13,
      });
    });

    it('returns popup with failed description on failed save', async () => {
      setupBaseSave();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-fail-desc',
        promise: Promise.resolve({ success: false }),
      });

      const result = await processGreaseAreaSave(
        casterName,
        'Goblin',
        campaignName,
        mapName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('failed');
      expect(result.payload.description).toContain('DEX');
      expect(result.payload.description).toContain('DC 13');
      expect(result.payload.description).toContain('Becomes Prone');
    });

    it('returns popup with succeeded description on successful save', async () => {
      setupBaseSave();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-success-desc',
        promise: Promise.resolve({ success: true }),
      });

      const result = await processGreaseAreaSave(
        casterName,
        'Goblin',
        campaignName,
        mapName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('succeeded');
      expect(result.payload.description).toContain('Unaffected');
    });

    it('returns popup with correct payload type', async () => {
      setupBaseSave();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-payload-type',
        promise: Promise.resolve({ success: false }),
      });

      const result = await processGreaseAreaSave(
        casterName,
        'Goblin',
        campaignName,
        mapName,
      );

      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Grease');
    });

    it('applies condition on failed save', async () => {
      setupBaseSave();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-apply-cond',
        promise: Promise.resolve({ success: false }),
      });

      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['prone']),
        campaignName,
      );
    });

    it('does not apply condition on successful save', async () => {
      setupBaseSave();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-no-cond',
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

    it('removes existing condition of same type before adding on failed save', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('_grease_')) {
          return {
            caster: casterName,
            center: { gridX: 5, gridY: 10 },
            saveDc: 13,
            saveType: 'DEX',
            condition: 'Blinded',
            radius: 10,
          };
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
      rangeValidation.getDistanceFeet.mockReturnValue(5);
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

    it('uses condition from tracking data for deduplication', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('_grease_')) {
          return {
            caster: casterName,
            center: { gridX: 5, gridY: 10 },
            saveDc: 13,
            saveType: 'DEX',
            condition: 'Blinded',
            radius: 10,
          };
        }
        if (key === 'activeConditions') return ['blinded'];
        return null;
      });
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
      });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      rangeValidation.getDistanceFeet.mockReturnValue(5);
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-custom-cond',
        promise: Promise.resolve({ success: false }),
      });

      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['blinded'],
        campaignName,
      );
    });
  });

  describe('log entries in process', () => {
    function setupBaseSave() {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('_grease_')) {
          return {
            caster: casterName,
            center: { gridX: 5, gridY: 10 },
            saveDc: 13,
            saveType: 'DEX',
            condition: 'Prone',
            radius: 10,
          };
        }
        if (key === 'activeConditions') return [];
        return null;
      });
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
      });
      rangeValidation.getDistanceFeet.mockReturnValue(5);
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

    it('calls addEntry with save_result on failed save', async () => {
      setupBaseSave();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-result-fail',
        promise: Promise.resolve({ success: false }),
      });

      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      const saveResultCall = logService.addEntry.mock.calls.find(
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
    });

    it('calls addEntry with save_result on successful save', async () => {
      setupBaseSave();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-result-success',
        promise: Promise.resolve({ success: true }),
      });

      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      const saveResultCall = logService.addEntry.mock.calls.find(
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

  describe('distance and map checks', () => {
    it('proceeds with save when target is within radius', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('_grease_')) {
          return {
            caster: casterName,
            center: { gridX: 5, gridY: 10 },
            saveDc: 13,
            saveType: 'DEX',
            condition: 'Prone',
            radius: 10,
          };
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
      rangeValidation.getDistanceFeet.mockReturnValue(5);
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-within',
        promise: Promise.resolve({ success: true }),
      });

      const result = await processGreaseAreaSave(
        casterName,
        'Goblin',
        campaignName,
        mapName,
      );

      expect(result.type).toBe('popup');
      expect(rangeValidation.getDistanceFeet).toHaveBeenCalled();
    });

    it('proceeds with save when map load fails (catches and returns popup)', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue({
        caster: casterName,
        center: { gridX: 5, gridY: 10 },
        saveDc: 13,
        saveType: 'DEX',
        condition: 'Prone',
        radius: 10,
      });
      mapsService.loadMapData.mockRejectedValue(new Error('map not found'));

      const result = await processGreaseAreaSave(
        casterName,
        'Goblin',
        campaignName,
        mapName,
      );

      expect(result).toBeNull();
    });

    it('does not check distance when no center in tracking', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue({
        caster: casterName,
        center: null,
        saveDc: 13,
        saveType: 'DEX',
      });

      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(mapsService.loadMapData).not.toHaveBeenCalled();
      expect(rangeValidation.getDistanceFeet).not.toHaveBeenCalled();
    });

    it('does not check distance when no mapName', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue({
        caster: casterName,
        center: { gridX: 5, gridY: 10 },
        saveDc: 13,
        saveType: 'DEX',
        radius: 10,
      });

      await processGreaseAreaSave(casterName, 'Goblin', campaignName, null);

      expect(mapsService.loadMapData).not.toHaveBeenCalled();
      expect(rangeValidation.getDistanceFeet).not.toHaveBeenCalled();
    });

    it('does not check distance when no saveDc in tracking', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue({
        caster: casterName,
        center: { gridX: 5, gridY: 10 },
      });

      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(mapsService.loadMapData).not.toHaveBeenCalled();
      expect(rangeValidation.getDistanceFeet).not.toHaveBeenCalled();
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

      const result = await processGreaseAreaSave(
        casterName,
        'Goblin',
        campaignName,
        mapName,
      );

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
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('_grease_')) {
          return {
            caster: casterName,
            center: { gridX: 5, gridY: 10 },
            saveDc: 13,
            saveType: 'DEX',
            condition: 'Prone',
            radius: 10,
          };
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
      rangeValidation.getDistanceFeet.mockReturnValue(5);
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-placed-items',
        promise: Promise.resolve({ success: true }),
      });

      const result = await processGreaseAreaSave(
        casterName,
        'Goblin',
        campaignName,
        mapName,
      );

      expect(result.type).toBe('popup');
    });

    it('prefers players over placedItems when target is in both', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.includes('_grease_')) {
          return {
            caster: casterName,
            center: { gridX: 5, gridY: 10 },
            saveDc: 13,
            saveType: 'DEX',
            condition: 'Prone',
            radius: 10,
          };
        }
        if (key === 'activeConditions') return [];
        return null;
      });
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'Goblin', gridX: 3, gridY: 3 }],
        placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
      });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'player' }],
      });
      rangeValidation.getDistanceFeet.mockReturnValue(4);
      automationImmunities.playerIsImmuneToCondition.mockReturnValue(false);
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-prefer-players',
        promise: Promise.resolve({ success: true }),
      });

      const result = await processGreaseAreaSave(
        casterName,
        'Goblin',
        campaignName,
        mapName,
      );

      expect(result.type).toBe('popup');
      expect(rangeValidation.getDistanceFeet).toHaveBeenCalledWith(
        expect.objectContaining({ gridX: 5, gridY: 10 }),
        expect.objectContaining({ gridX: 3, gridY: 3 }),
      );
    });
  });
});
