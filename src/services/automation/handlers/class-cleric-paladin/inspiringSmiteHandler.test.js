// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  resolveDiceExpression: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './inspiringSmiteHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as mapsService from '../../../maps/mapsService.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as logService from '../../../ui/logService.js';

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

// ── Helpers ────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestPaladin',
    level: 8,
    class: {
      class_levels: [{ level: 8, channel_divinity: 2 }],
      ...overrides.class,
    },
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Inspiring Smite',
    automation: {
      type: 'inspiring_smite',
      range: '30 ft',
      ...overrides.automation,
    },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('inspiringSmiteHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Charge checks ───────────────────────────────────────────

  describe('channel divinity charge checks', () => {
    it('returns popup when no charges remaining (storedCharges = 0)', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Inspiring Smite');
      expect(result.payload.description).toBe('Inspiring Smite: No Channel Divinity charges remaining.');
      expect(result.payload.automation).toEqual(makeAction().automation);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('uses stored charges when available (storedCharges = 1)', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      mapsService.loadMapData.mockResolvedValue({ players: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.tempHp).toBe(10);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestPaladin',
        'channelDivinityCharges',
        0,
        campaignName,
      );
    });

    it('uses stored charges (storedCharges = 3)', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(3);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      mapsService.loadMapData.mockResolvedValue({ players: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestPaladin',
        'channelDivinityCharges',
        2,
        campaignName,
      );
    });

    it('defaults to maxCharges when storedCharges is null or undefined', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      mapsService.loadMapData.mockResolvedValue({ players: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      // maxCharges from class_levels[7].channel_divinity = 2, newCharges = 1
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestPaladin',
        'channelDivinityCharges',
        1,
        campaignName,
      );
    });

    it('uses channel_divinity from class_levels for maxCharges', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      mapsService.loadMapData.mockResolvedValue({ players: [] });

      const ps = makePlayerStats({
        level: 5,
        class: {
          class_levels: [
            undefined,
            undefined,
            undefined,
            undefined,
            {
              channel_divinity: 0,
              class_specific: { channel_divinity_charges: 4 },
            },
          ],
        },
      });

      await handle(makeAction(), ps, campaignName, null);

      // channel_divinity is 0 (falsy), falls back to class_specific = 4, newCharges = 3
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestPaladin',
        'channelDivinityCharges',
        3,
        campaignName,
      );
    });
  });

  // ── Temp HP calculation ─────────────────────────────────────

  describe('temp HP calculation', () => {
    it('returns popup when rollExpression returns null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Inspiring Smite: Could not calculate temp HP.');
    });

    it('returns popup when temp HP is zero', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 0 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Could not calculate temp HP');
    });

    it('uses resolved dice expression from automationService', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      automationService.resolveDiceExpression.mockReturnValue('2d8 + 8');
      diceRoller.rollExpression.mockReturnValue({ total: 12 });
      mapsService.loadMapData.mockResolvedValue({ players: [] });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(automationService.resolveDiceExpression).toHaveBeenCalledWith(
        '2d8 + paladin level',
        expect.objectContaining({ level: 8 }),
      );
    });
  });

  // ── Target finding ──────────────────────────────────────────

  describe('target finding', () => {
    it('finds targets within range on map', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 15 });
      automationService.resolveDiceExpression.mockReturnValue('2d8 + 8');
      rangeValidation.rangeToFeet.mockReturnValue(30);
      rangeValidation.getDistanceFeet.mockReturnValue(25);
      mapsService.loadMapData.mockResolvedValue({
        players: [
          { name: 'TestPaladin', gridX: 1, gridY: 1 },
          { name: 'Ally1', gridX: 2, gridY: 2 },
          { name: 'Ally2', gridX: 10, gridY: 10 },
        ],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(mapsService.loadMapData).toHaveBeenCalledWith(campaignName, mapName);
      expect(result.type).toBe('roll');
      expect(result.payload.tempHp).toBe(15);
      expect(result.payload.targets).toEqual(['Ally1', 'Ally2']);
    });

    it('caps targets at 10', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      automationService.resolveDiceExpression.mockReturnValue('2d8 + 8');
      rangeValidation.rangeToFeet.mockReturnValue(30);
      rangeValidation.getDistanceFeet.mockReturnValue(10);

      const manyPlayers = [{ name: 'TestPaladin', gridX: 1, gridY: 1 }];
      for (let i = 0; i < 15; i++) {
        manyPlayers.push({ name: `Ally${i}`, gridX: 2, gridY: 2 });
      }
      mapsService.loadMapData.mockResolvedValue({ players: manyPlayers });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.payload.targets.length).toBe(10);
    });

    it('returns empty targets when attacker not found or map data is missing', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'OtherPlayer', gridX: 1, gridY: 1 }],
      });

      let result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      expect(result.payload.targets).toEqual([]);

      vi.clearAllMocks();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      mapsService.loadMapData.mockResolvedValue(null);
      result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      expect(result.payload.targets).toEqual([]);

      vi.clearAllMocks();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      mapsService.loadMapData.mockResolvedValue({});
      result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      expect(result.payload.targets).toEqual([]);
    });

    it('excludes targets beyond range', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      automationService.resolveDiceExpression.mockReturnValue('2d8 + 8');
      rangeValidation.rangeToFeet.mockReturnValue(30);
      rangeValidation.getDistanceFeet.mockReturnValue(40);
      mapsService.loadMapData.mockResolvedValue({
        players: [
          { name: 'TestPaladin', gridX: 1, gridY: 1 },
          { name: 'Ally1', gridX: 8, gridY: 8 },
        ],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.payload.targets).toEqual([]);
    });

    it('skips targets when getDistanceFeet returns null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      automationService.resolveDiceExpression.mockReturnValue('2d8 + 8');
      rangeValidation.rangeToFeet.mockReturnValue(30);
      rangeValidation.getDistanceFeet.mockReturnValue(null);
      mapsService.loadMapData.mockResolvedValue({
        players: [
          { name: 'TestPaladin', gridX: 1, gridY: 1 },
          { name: 'Ally1', gridX: 2, gridY: 2 },
        ],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.payload.targets).toEqual([]);
    });

    it('uses automation.range when provided', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      rangeValidation.rangeToFeet.mockReturnValue(60);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestPaladin', gridX: 1, gridY: 1 }],
      });

      await handle(
        makeAction({ automation: { range: '60 ft' } }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(rangeValidation.rangeToFeet).toHaveBeenCalledWith('60 ft');
    });
  });

  // ── Execution ───────────────────────────────────────────────

  describe('execution', () => {
    it('distributes temp HP to each target', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 12 });
      automationService.resolveDiceExpression.mockReturnValue('2d8 + 8');
      rangeValidation.rangeToFeet.mockReturnValue(30);
      rangeValidation.getDistanceFeet.mockReturnValue(10);
      mapsService.loadMapData.mockResolvedValue({
        players: [
          { name: 'TestPaladin', gridX: 1, gridY: 1 },
          { name: 'Ally1', gridX: 2, gridY: 2 },
          { name: 'Ally2', gridX: 3, gridY: 3 },
        ],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'tempHp', 12, campaignName);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally2', 'tempHp', 12, campaignName);
    });

    it('expend channel divinity charge', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestPaladin', gridX: 1, gridY: 1 }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestPaladin',
        'channelDivinityCharges',
        1,
        campaignName,
      );
    });

    it('calls addEntry with correct ability_use data', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestPaladin', gridX: 1, gridY: 1 }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestPaladin',
        abilityName: 'Inspiring Smite',
        description: expect.stringContaining('Inspiring Smite'),
      });
    });

    it('includes target names in log description', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      rangeValidation.rangeToFeet.mockReturnValue(30);
      rangeValidation.getDistanceFeet.mockReturnValue(10);
      mapsService.loadMapData.mockResolvedValue({
        players: [
          { name: 'TestPaladin', gridX: 1, gridY: 1 },
          { name: 'Ally1', gridX: 2, gridY: 2 },
        ],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          description: expect.stringContaining('Ally1'),
        }),
      );
    });

    it('handles addEntry rejection gracefully', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      logService.addEntry.mockRejectedValue(new Error('log failure'));
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestPaladin', gridX: 1, gridY: 1 }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('roll');
      expect(result.payload.tempHp).toBe(10);
    });

    it('returns roll result with correct payload fields', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 14 });
      automationService.resolveDiceExpression.mockReturnValue('2d8 + 8');
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestPaladin', gridX: 1, gridY: 1 }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('roll');
      expect(result.payload.roll).toBe('2d8 + 8');
      expect(result.payload.result).toBe(14);
      expect(result.payload.name).toBe('Inspiring Smite');
      expect(result.payload.tempHp).toBe(14);
      expect(result.payload.targets).toEqual([]);
      expect(result.payload.description).toContain('Inspiring Smite');
    });
  });
});
