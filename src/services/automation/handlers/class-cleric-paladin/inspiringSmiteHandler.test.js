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

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

// Track CustomEvent dispatch
const customEvents = {};
window.dispatchEvent = vi.fn((event) => {
  customEvents[event.type] = event;
});

// ── Imports ────────────────────────────────────────────────────

import { handle } from './inspiringSmiteHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as mapsService from '../../../maps/mapsService.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

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

function makeDivineSmiteAttack(attackerName = 'TestPaladin') {
  return {
    spellName: 'Divine Smite',
    attackerName,
  };
}

function makeNonSmiteAttack() {
  return {
    spellName: 'Weapon Attack',
    attackerName: 'TestPaladin',
  };
}

function getPendingEvent() {
  return customEvents['inspiring-smite-pending'];
}

// ── Tests ──────────────────────────────────────────────────────

describe('inspiringSmiteHandler.handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.keys(customEvents).forEach(key => delete customEvents[key]);
    useRuntimeState.getRuntimeValue.mockReset();
    damageUtils.getCombatContext.mockReset();
    diceRoller.rollExpression.mockReset();
    mapsService.loadMapData.mockReset();
    rangeValidation.rangeToFeet.mockReset();
    rangeValidation.getDistanceFeet.mockReset();
    automationService.resolveDiceExpression.mockReset();
    rangeCheck.isWithinRange.mockReset().mockResolvedValue(true);
  });

  // ── Divine Smite check ──────────────────────────────────────

  describe('divine smite check', () => {
    it('returns popup when no lastAttack exists', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Divine Smite');
      expect(getPendingEvent()).toBeUndefined();
    });

    it('returns popup when lastAttack spellName is not Divine Smite', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [],
        lastAttack: makeNonSmiteAttack(),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Divine Smite');
      expect(getPendingEvent()).toBeUndefined();
    });

    it('returns popup when lastAttack attackerName does not match player', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [],
        lastAttack: makeDivineSmiteAttack('OtherPlayer'),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Divine Smite');
      expect(getPendingEvent()).toBeUndefined();
    });

    it('proceeds when lastAttack is Divine Smite cast by the player', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [],
        lastAttack: makeDivineSmiteAttack('TestPaladin'),
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toBeNull();
      expect(getPendingEvent()).toBeDefined();
    });
  });

  // ── Temp HP calculation ─────────────────────────────────────

  describe('temp HP calculation', () => {
    it('returns popup when temp HP is zero', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [],
        lastAttack: makeDivineSmiteAttack(),
      });
      diceRoller.rollExpression.mockReturnValue({ total: 0 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Could not calculate temp HP');
      expect(getPendingEvent()).toBeUndefined();
    });

    it('returns popup when rollExpression returns null', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [],
        lastAttack: makeDivineSmiteAttack(),
      });
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Could not calculate temp HP');
      expect(getPendingEvent()).toBeUndefined();
    });

    it('uses resolved dice expression from automationService', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [],
        lastAttack: makeDivineSmiteAttack(),
      });
      automationService.resolveDiceExpression.mockReturnValue('2d8 + 8');
      diceRoller.rollExpression.mockReturnValue({ total: 12 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(automationService.resolveDiceExpression).toHaveBeenCalledWith(
        '2d8 + paladin level',
        expect.objectContaining({ level: 8 }),
      );
    });
  });

  // ── Target finding ──────────────────────────────────────────

  describe('target finding', () => {
    it('dispatches event with targets within range on map', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [],
        lastAttack: makeDivineSmiteAttack(),
      });
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

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(mapsService.loadMapData).toHaveBeenCalledWith(campaignName, mapName);
      const event = getPendingEvent();
      expect(event).toBeDefined();
      expect(event.detail.tempHp).toBe(15);
      // getDistanceFeet returns 25 for all, which is <= 30, so all allies included
      expect(event.detail.creatureTargets).toEqual([
        { name: 'Ally1', type: 'player' },
        { name: 'Ally2', type: 'player' },
        { name: 'TestPaladin', type: 'player' },
      ]);
    });

    it('caps targets at 10', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [],
        lastAttack: makeDivineSmiteAttack(),
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      automationService.resolveDiceExpression.mockReturnValue('2d8 + 8');
      rangeValidation.rangeToFeet.mockReturnValue(30);
      rangeValidation.getDistanceFeet.mockReturnValue(10);

      const manyPlayers = [{ name: 'TestPaladin', gridX: 1, gridY: 1 }];
      for (let i = 0; i < 15; i++) {
        manyPlayers.push({ name: `Ally${i}`, gridX: 2, gridY: 2 });
      }
      mapsService.loadMapData.mockResolvedValue({ players: manyPlayers });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      const event = getPendingEvent();
      expect(event.detail.creatureTargets.length).toBe(11); // 10 allies + self
    });

    it('returns empty targets when attacker not found or map data is missing', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [],
        lastAttack: makeDivineSmiteAttack(),
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      rangeValidation.rangeToFeet.mockReturnValue(30);

      let event;

      // Attacker not found in map data - other players still included since they're within range
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'OtherPlayer', gridX: 1, gridY: 1 }],
      });
      await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      event = getPendingEvent();
      expect(event.detail.creatureTargets).toEqual([
        { name: 'OtherPlayer', type: 'player' },
        { name: 'TestPaladin', type: 'player' },
      ]);

      // Map data is null - only self included
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [],
        lastAttack: makeDivineSmiteAttack(),
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      rangeValidation.rangeToFeet.mockReturnValue(30);
      mapsService.loadMapData.mockResolvedValue(null);
      await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      event = getPendingEvent();
      expect(event.detail.creatureTargets).toEqual([
        { name: 'TestPaladin', type: 'player' },
      ]);

      // Map data has no players - only self included
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [],
        lastAttack: makeDivineSmiteAttack(),
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      rangeValidation.rangeToFeet.mockReturnValue(30);
      mapsService.loadMapData.mockResolvedValue({});
      await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      event = getPendingEvent();
      expect(event.detail.creatureTargets).toEqual([
        { name: 'TestPaladin', type: 'player' },
      ]);
    });

    it('excludes targets beyond range', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [],
        lastAttack: makeDivineSmiteAttack(),
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      automationService.resolveDiceExpression.mockReturnValue('2d8 + 8');
      rangeValidation.rangeToFeet.mockReturnValue(30);
      rangeValidation.getDistanceFeet.mockReturnValue(40);
      rangeCheck.isWithinRange.mockResolvedValue(false);
      mapsService.loadMapData.mockResolvedValue({
        players: [
          { name: 'TestPaladin', gridX: 1, gridY: 1 },
          { name: 'Ally1', gridX: 8, gridY: 8 },
        ],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      const event = getPendingEvent();
      expect(event.detail.creatureTargets).toEqual([{ name: 'TestPaladin', type: 'player' }]);
    });

    it('includes targets when getDistanceFeet returns null (assumes in range)', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [],
        lastAttack: makeDivineSmiteAttack(),
      });
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

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      const event = getPendingEvent();
      expect(event.detail.creatureTargets).toEqual([
        { name: 'Ally1', type: 'player' },
        { name: 'TestPaladin', type: 'player' },
      ]);
    });

    it('uses automation.range when provided', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [],
        lastAttack: makeDivineSmiteAttack(),
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
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

    it('uses selectedAllies from runtime store when available', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [],
        lastAttack: makeDivineSmiteAttack(),
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      useRuntimeState.getRuntimeValue.mockReturnValue(['Ally1', 'Ally2']);
      mapsService.loadMapData.mockResolvedValue({
        players: [
          { name: 'TestPaladin', gridX: 1, gridY: 1 },
          { name: 'Ally1', gridX: 2, gridY: 2 },
          { name: 'Ally2', gridX: 3, gridY: 3 },
        ],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      const event = getPendingEvent();
      expect(event.detail.creatureTargets).toEqual([
        { name: 'Ally1', type: 'player' },
        { name: 'Ally2', type: 'player' },
        { name: 'TestPaladin', type: 'player' },
      ]);
    });
  });

  // ── Execution ───────────────────────────────────────────────

  describe('execution', () => {
    it('dispatches CustomEvent with correct detail', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [],
        lastAttack: makeDivineSmiteAttack(),
      });
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
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      const event = getPendingEvent();
      expect(event).toBeDefined();
      expect(event.detail.action).toEqual(makeAction());
      expect(event.detail.playerStats).toEqual(makePlayerStats());
      expect(event.detail.campaignName).toBe(campaignName);
      expect(event.detail.tempHp).toBe(12);
      expect(event.detail.roll).toBe('2d8 + 8');
      expect(event.detail.channelDivinityCharges).toBe(2);
    });

    it('returns null on success (modal handles the rest)', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [],
        lastAttack: makeDivineSmiteAttack(),
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestPaladin', gridX: 1, gridY: 1 }],
      });
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result).toBeNull();
    });

    it('dispatches event without map when mapName is null', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [],
        lastAttack: makeDivineSmiteAttack(),
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const event = getPendingEvent();
      // No map, so no range checking - only self is included
      expect(event.detail.creatureTargets).toEqual([{ name: 'TestPaladin', type: 'player' }]);
    });
  });
});
