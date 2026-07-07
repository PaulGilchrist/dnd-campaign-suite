// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
  getDistanceFeet: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './encouragingSongHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as mapsService from '../../../maps/mapsService.js';
import * as logService from '../../../ui/logService.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Bard',
    proficiency: 3,
    abilities: [{ name: 'Charisma', score: 16, bonus: 3 }],
    class: { class_levels: [{ level: 1, bardic_die: 6 }] },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Encouraging Song',
    automation: {
      type: 'heroic_inspiration_buff',
      effect: 'heroic_inspiration',
      action: 'action',
      range: '30_ft',
      uses_expression: 'proficiency_bonus',
      recharge: 'short_or_long_rest',
      casting_time: '1 action',
      buffExpression: 'heroic_inspiration',
      targetsExpression: 'proficiency_bonus',
      ...automation,
    },
  };
}

function makeMapData(players) {
  return { players };
}

const defaultMapPlayers = [
  { name: 'Bard', gridX: 0, gridY: 0 },
  { name: 'Ally1', gridX: 1, gridY: 1 },
  { name: 'Ally2', gridX: 2, gridY: 2 },
];

// ── Tests ──────────────────────────────────────────────────────

describe('encouragingSongHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  // ── No map / no map data / no targets ───────────────────────

  describe('map resolution', () => {
    it('should return popup when mapName is null', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Could not resolve allies without a map');
      expect(result.payload.name).toBe('Encouraging Song');
      expect(result.payload.automationType).toBe('heroic_inspiration_buff');
    });

    it('should return popup with no targets when map data is unavailable, player is missing, or no allies in range', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      // No map data
      mapsService.loadMapData.mockResolvedValue(null);
      let result = await handle(action, ps, campaignName, 'nonexistent-map');
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no targets in range');

      // Player not found on map
      mapsService.loadMapData.mockResolvedValue(makeMapData([
        { name: 'Ally1', gridX: 5, gridY: 5 },
      ]));
      result = await handle(action, ps, campaignName, 'test-map');
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no targets in range');
    });

    it('should return popup with no targets when all allies are outside range', async () => {
      rangeValidation.rangeToFeet.mockReturnValue(15);
      rangeValidation.getDistanceFeet.mockReturnValue(30);
      mapsService.loadMapData.mockResolvedValue(makeMapData(defaultMapPlayers));

      const action = makeAction();
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName, 'test-map');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no targets in range');
    });
  });

  // ── Range filtering ─────────────────────────────────────────

  describe('range filtering', () => {
    it('should include allies within range', async () => {
      rangeValidation.rangeToFeet.mockReturnValue(30);
      rangeValidation.getDistanceFeet.mockReturnValue(15);
      mapsService.loadMapData.mockResolvedValue(makeMapData(defaultMapPlayers));
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction();
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName, 'test-map');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toMatch(/all(y|ies)/);
      expect(result.payload.description).toContain('Ally1');
      expect(result.payload.description).toContain('Ally2');
    });

    it('should use singular "ally" when exactly one target', async () => {
      rangeValidation.rangeToFeet.mockReturnValue(30);
      rangeValidation.getDistanceFeet.mockReturnValue(15);
      mapsService.loadMapData.mockResolvedValue(makeMapData([
        { name: 'Bard', gridX: 0, gridY: 0 },
        { name: 'Ally1', gridX: 1, gridY: 1 },
      ]));
      runtimeState.getRuntimeValue.mockReturnValue(false);

      const action = makeAction();
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName, 'test-map');

      expect(result.payload.description).toContain('1 ally');
      expect(result.payload.description).not.toContain('allies');
    });
  });

  // ── Inspiration toggling ─────────────────────────────────────

  describe('inspiration toggling', () => {
    it('should grant inspiration to allies without it and skip those who have it', async () => {
      rangeValidation.rangeToFeet.mockReturnValue(30);
      rangeValidation.getDistanceFeet.mockReturnValue(15);
      mapsService.loadMapData.mockResolvedValue(makeMapData(defaultMapPlayers));
      runtimeState.getRuntimeValue.mockImplementation((_player, key) => {
        if (key === 'hasInspiration' && _player === 'Ally1') return true;
        if (key === 'hasInspiration') return false;
        return null;
      });

      const action = makeAction();
      const ps = makePlayerStats();

      await handle(action, ps, campaignName, 'test-map');

      // Ally1 already has inspiration — should NOT be set again
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Ally1',
        'hasInspiration',
        true,
        campaignName,
      );
      // Ally2 does not have inspiration — should be granted
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally2',
        'hasInspiration',
        true,
        campaignName,
      );
    });

    it('should grant inspiration to all allies when none have it', async () => {
      rangeValidation.rangeToFeet.mockReturnValue(30);
      rangeValidation.getDistanceFeet.mockReturnValue(15);
      mapsService.loadMapData.mockResolvedValue(makeMapData(defaultMapPlayers));
      runtimeState.getRuntimeValue.mockReturnValue(false);

      const action = makeAction();
      const ps = makePlayerStats();

      await handle(action, ps, campaignName, 'test-map');

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'hasInspiration', true, campaignName);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally2', 'hasInspiration', true, campaignName);
    });
  });

  // ── Uses tracking ───────────────────────────────────────────

  describe('uses tracking', () => {
    it('should decrement uses when available and grant inspiration', async () => {
      rangeValidation.rangeToFeet.mockReturnValue(30);
      rangeValidation.getDistanceFeet.mockReturnValue(15);
      mapsService.loadMapData.mockResolvedValue(makeMapData(defaultMapPlayers));
      runtimeState.getRuntimeValue.mockImplementation((_player, key) => {
        if (key === 'hasInspiration') return false;
        if (key === 'encouragingsongUses') return 2;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(3);

      const action = makeAction();
      const ps = makePlayerStats();

      await handle(action, ps, campaignName, 'test-map');

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Bard', 'encouragingsongUses', 1, campaignName);
    });

    it('should return error popup when no uses remaining', async () => {
      rangeValidation.rangeToFeet.mockReturnValue(30);
      rangeValidation.getDistanceFeet.mockReturnValue(15);
      mapsService.loadMapData.mockResolvedValue(makeMapData(defaultMapPlayers));
      runtimeState.getRuntimeValue.mockImplementation((_player, key) => {
        if (key === 'encouragingsongUses') return 0;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(3);

      const action = makeAction();
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName, 'test-map');

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('cannot be used again');
      expect(result.payload.name).toBe('Encouraging Song');
    });

    it('should use resourceKey from automation when provided', async () => {
      rangeValidation.rangeToFeet.mockReturnValue(30);
      rangeValidation.getDistanceFeet.mockReturnValue(15);
      mapsService.loadMapData.mockResolvedValue(makeMapData(defaultMapPlayers));
      runtimeState.getRuntimeValue.mockImplementation((_player, key) => {
        if (key === 'hasInspiration') return false;
        if (key === 'customResource') return 3;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(3);

      const action = makeAction({ resourceKey: 'customResource' });
      const ps = makePlayerStats();

      await handle(action, ps, campaignName, 'test-map');

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Bard', 'customResource', 2, campaignName);
    });
  });

  // ── Logging ─────────────────────────────────────────────────

  describe('logging', () => {
    it('should call addEntry with ability_use log type', async () => {
      rangeValidation.rangeToFeet.mockReturnValue(30);
      rangeValidation.getDistanceFeet.mockReturnValue(15);
      mapsService.loadMapData.mockResolvedValue(makeMapData(defaultMapPlayers));
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction();
      const ps = makePlayerStats();

      await handle(action, ps, campaignName, 'test-map');

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'Bard',
        abilityName: 'Encouraging Song',
      }));
    });
  });
});
