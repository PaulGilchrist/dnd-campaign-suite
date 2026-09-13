// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

import { handle } from './greaseAreaSaveHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as mapsService from '../../../maps/mapsService.js';

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

// ── Tests ──────────────────────────────────────────────────────

describe('greaseAreaSaveHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('return value', () => {
    it('returns modal with setCondition modalName and correct payload', async () => {
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

    it('includes attackerPos from map data or null when caster not on map', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);

      // caster found on map
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 12, gridY: 20 }],
      });
      let result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      expect(result.payload.attackerPos).toEqual({ gridX: 12, gridY: 20 });

      // caster not on map
      mapsService.loadMapData.mockResolvedValue({ players: [] });
      result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      expect(result.payload.attackerPos).toBeNull();
    });

    it('includes mapData when mapName provided, null when mapName is null', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);

      const expectedMap = { players: [{ name: casterName, gridX: 5, gridY: 10 }] };
      mapsService.loadMapData.mockResolvedValue(expectedMap);
      let result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      expect(result.payload.mapData).toEqual(expectedMap);

      mapsService.loadMapData.mockClear();
      result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.mapData).toBeNull();
    });
  });

  describe('save type and condition defaults', () => {
    it('uses custom saveType from automation, defaults to DEX', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);

      let result = await handle(makeAction({ saveType: 'CON' }), makePlayerStats(), campaignName, null);
      expect(result.payload.saveType).toBe('CON');

      result = await handle(makeAction({ saveType: undefined }), makePlayerStats(), campaignName, null);
      expect(result.payload.saveType).toBe('DEX');
    });

    it('uses custom conditionInflicted from automation, defaults to Prone', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      let result = await handle(makeAction({ conditionInflicted: 'Blinded' }), makePlayerStats(), campaignName, mapName);
      expect(result.payload.conditionName).toBe('Blinded');

      result = await handle(makeAction({ conditionInflicted: undefined }), makePlayerStats(), campaignName, mapName);
      expect(result.payload.conditionName).toBe('Prone');
    });
  });

  describe('area radius parsing', () => {
    it('parses size values correctly, defaulting to 10', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      let result = await handle(makeAction({ size: '10-foot' }), makePlayerStats(), campaignName, mapName);
      expect(result.payload.rangeFeet).toBe(10);

      result = await handle(makeAction({ size: '15-foot' }), makePlayerStats(), campaignName, mapName);
      expect(result.payload.rangeFeet).toBe(15);

      result = await handle(makeAction({ size: 'invalid' }), makePlayerStats(), campaignName, mapName);
      expect(result.payload.rangeFeet).toBe(10);

      result = await handle(makeAction({ size: undefined }), makePlayerStats(), campaignName, mapName);
      expect(result.payload.rangeFeet).toBe(10);
    });
  });

  describe('duration and expiration', () => {
    function setupDuration() {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });
    }

    it('sets expiration and payload durationRounds for 1_minute (10 rounds)', async () => {
      setupDuration();
      const result = await handle(makeAction({ duration: '1_minute' }), makePlayerStats(), campaignName, mapName);
      expect(result.payload.durationRounds).toBe(10);
      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: casterName, targetName: casterName, effects: [{ type: 'remove_grease_area', greaseKey: '_grease_TestWizard' }], campaignName, rounds: 10 });
    });

    it('sets expiration and payload durationRounds for round-based duration', async () => {
      setupDuration();
      let result = await handle(makeAction({ duration: '3_rounds' }), makePlayerStats(), campaignName, mapName);
      expect(result.payload.durationRounds).toBe(3);
      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: casterName, targetName: casterName, effects: expect.any(Array), campaignName, rounds: 3 });

      result = await handle(makeAction({ duration: '1_rounds' }), makePlayerStats(), campaignName, mapName);
      expect(result.payload.durationRounds).toBe(1);

      result = await handle(makeAction({ duration: '5_rounds' }), makePlayerStats(), campaignName, mapName);
      expect(result.payload.durationRounds).toBe(5);
    });

    it('does not set expiration or durationRounds for unrecognized duration values', async () => {
      setupDuration();
      let result = await handle(makeAction({ duration: 'unknown' }), makePlayerStats(), campaignName, mapName);
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(result.payload.durationRounds).toBeUndefined();

      expirations.addExpiration.mockClear();
      result = await handle(makeAction({ duration: '' }), makePlayerStats(), campaignName, mapName);
      expect(expirations.addExpiration).not.toHaveBeenCalled();

      expirations.addExpiration.mockClear();
      result = await handle(makeAction({ duration: undefined }), makePlayerStats(), campaignName, mapName);
      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('tracking data storage', () => {
    function setupTracking() {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
    }

    it('stores grease tracking data with all fields when caster found on map', async () => {
      setupTracking();
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      const call = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === '_grease_TestWizard',
      ) || useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1]?.includes('_grease_'),
      );
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

    it('stores null center and mapName when caster not on map or mapName is null', async () => {
      setupTracking();

      // caster not found on map
      mapsService.loadMapData.mockResolvedValue({ players: [] });
      await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      let call = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1]?.includes('_grease_'),
      );
      expect(call[2].center).toBeNull();

      // mapName is null
      useRuntimeState.setRuntimeValue.mockClear();
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      call = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1]?.includes('_grease_'),
      );
      expect(call[2].center).toBeNull();
      expect(call[2].mapName).toBeNull();
    });

    it('stores custom values from automation in tracking data', async () => {
      setupTracking();

      await handle(makeAction({ duration: '3_rounds' }), makePlayerStats(), campaignName, null);
      let call = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1]?.includes('_grease_'),
      );
      expect(call[2].duration).toBe('3_rounds');

      useRuntimeState.setRuntimeValue.mockClear();
      await handle(makeAction({ size: '15-foot' }), makePlayerStats(), campaignName, mapName);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });
      call = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1]?.includes('_grease_'),
      );
      expect(call[2].radius).toBe(15);

      useRuntimeState.setRuntimeValue.mockClear();
      await handle(makeAction({ conditionInflicted: 'Blinded' }), makePlayerStats(), campaignName, mapName);
      call = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1]?.includes('_grease_'),
      );
      expect(call[2].condition).toBe('Blinded');

      useRuntimeState.setRuntimeValue.mockClear();
      savePrompt.buildSaveDc.mockReturnValue(14);
      await handle(makeAction({ saveType: 'CON' }), makePlayerStats(), campaignName, mapName);
      call = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1]?.includes('_grease_'),
      );
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
  });

  describe('log entries', () => {
    it('calls addEntry with ability_use type and correct details including range', async () => {
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

    it('calls addEntry with range in log description', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
      });

      await handle(makeAction({ size: '15-foot' }), makePlayerStats(), campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          description: expect.stringContaining('15ft'),
        }),
      );
    });
  });
});
