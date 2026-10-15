// @maintained-by-ai
// inspiringSmiteHandler unit lane: gate checks (lastAttack Divine Smite by the
// caster), temp HP roll wiring (resolveDiceExpression → rollExpression), target
// building (map / selectedAllies / no-map lanes, cap at 10, isWithinRange
// delegation), and the 'inspiring-smite-pending' modal payload contract.
// Sibling lanes: inspiringSmiteLatch.test.js (CLA-200 once-per-cast tokens),
// inspiringSmiteRowActivation.test.js (executeHandler dispatcher + zero-charges
// and non-smite popups through the real handler).
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
  rangeToFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

// Mocked so healingPoolHandler.js (real, imported for resolveChannelDivinityCharges)
// does not drag the damageUtils dep tree into jsdom.
vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
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

// Divine Smite by the player (gate passes); override attackerName to fail the gate.
function makeDivineSmiteAttack(attackerName = 'TestPaladin') {
  return {
    attackName: 'Divine Smite',
    attackerName,
  };
}

// Route runtime reads: lastAttack gate passes unless overridden per-test.
function mockRuntime({ lastAttack = makeDivineSmiteAttack(), selectedAllies } = {}) {
  useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
    if (name === 'campaign' && key === 'lastAttack') return lastAttack;
    if (name === 'TestPaladin' && key === 'selectedAllies') return selectedAllies;
    return undefined;
  });
}

function getPendingEvent() {
  return customEvents['inspiring-smite-pending'];
}

// ── Tests ──────────────────────────────────────────────────────

describe('inspiringSmiteHandler.handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.keys(customEvents).forEach(key => delete customEvents[key]);
    rangeCheck.isWithinRange.mockResolvedValue(true);
  });

  // ── Divine Smite gate ───────────────────────────────────────

  describe('divine smite check', () => {
    it('returns popup when no lastAttack exists', async () => {
      mockRuntime({ lastAttack: null });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Divine Smite');
      expect(getPendingEvent()).toBeUndefined();
    });

    it('returns popup when lastAttack attackerName does not match player', async () => {
      mockRuntime({ lastAttack: makeDivineSmiteAttack('OtherPlayer') });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Divine Smite');
      expect(getPendingEvent()).toBeUndefined();
    });
  });

  // ── Temp HP calculation ─────────────────────────────────────

  describe('temp HP calculation', () => {
    it('returns popup when rollExpression returns null', async () => {
      mockRuntime();
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Could not calculate temp HP');
      expect(getPendingEvent()).toBeUndefined();
    });

    it('uses resolved dice expression from automationService', async () => {
      mockRuntime();
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
      mockRuntime();
      diceRoller.rollExpression.mockReturnValue({ total: 15 });
      automationService.resolveDiceExpression.mockReturnValue('2d8 + 8');
      rangeValidation.rangeToFeet.mockReturnValue(30);
      mapsService.loadMapData.mockResolvedValue({
        players: [
          { name: 'TestPaladin', gridX: 1, gridY: 1 },
          { name: 'Ally1', gridX: 2, gridY: 2 },
          { name: 'Ally2', gridX: 10, gridY: 10 },
        ],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(rangeValidation.rangeToFeet).toHaveBeenCalledWith('30 ft');
      expect(mapsService.loadMapData).toHaveBeenCalledWith(campaignName, mapName);
      const event = getPendingEvent();
      expect(event).toBeDefined();
      expect(event.detail.tempHp).toBe(15);
      // isWithinRange resolves true for all, so every map player is a target
      expect(event.detail.creatureTargets).toEqual([
        { name: 'Ally1', type: 'player' },
        { name: 'Ally2', type: 'player' },
        { name: 'TestPaladin', type: 'player' },
      ]);
    });

    it('caps targets at 10', async () => {
      mockRuntime();
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      rangeValidation.rangeToFeet.mockReturnValue(30);

      const manyPlayers = [{ name: 'TestPaladin', gridX: 1, gridY: 1 }];
      for (let i = 0; i < 15; i++) {
        manyPlayers.push({ name: `Ally${i}`, gridX: 2, gridY: 2 });
      }
      mapsService.loadMapData.mockResolvedValue({ players: manyPlayers });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      const event = getPendingEvent();
      expect(event.detail.creatureTargets.length).toBe(11); // 10 allies + self
    });

    it('excludes targets beyond range', async () => {
      mockRuntime();
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      rangeValidation.rangeToFeet.mockReturnValue(30);
      rangeCheck.isWithinRange.mockResolvedValue(false);
      mapsService.loadMapData.mockResolvedValue({
        players: [
          { name: 'TestPaladin', gridX: 1, gridY: 1 },
          { name: 'Ally1', gridX: 8, gridY: 8 },
        ],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(rangeCheck.isWithinRange).toHaveBeenCalledWith('TestPaladin', 'Ally1', 30);
      const event = getPendingEvent();
      expect(event.detail.creatureTargets).toEqual([{ name: 'TestPaladin', type: 'player' }]);
    });

    it('includes self even when attacker is not on map or map data is missing', async () => {
      mockRuntime();
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      rangeValidation.rangeToFeet.mockReturnValue(30);

      // Attacker absent from map — in-range players still targeted, self still added
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'OtherPlayer', gridX: 1, gridY: 1 }],
      });
      await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      expect(getPendingEvent().detail.creatureTargets).toEqual([
        { name: 'OtherPlayer', type: 'player' },
        { name: 'TestPaladin', type: 'player' },
      ]);

      // Map data is null — only self included
      mapsService.loadMapData.mockResolvedValue(null);
      await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      expect(getPendingEvent().detail.creatureTargets).toEqual([
        { name: 'TestPaladin', type: 'player' },
      ]);
    });

    it('uses automation.range when provided', async () => {
      mockRuntime();
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
      mockRuntime({ selectedAllies: ['TestPaladin', 'Ally1', 'Ally2'] });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
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
      mockRuntime();
      diceRoller.rollExpression.mockReturnValue({ total: 12 });
      automationService.resolveDiceExpression.mockReturnValue('2d8 + 8');
      rangeValidation.rangeToFeet.mockReturnValue(30);
      mapsService.loadMapData.mockResolvedValue({
        players: [
          { name: 'TestPaladin', gridX: 1, gridY: 1 },
          { name: 'Ally1', gridX: 2, gridY: 2 },
          { name: 'Ally2', gridX: 3, gridY: 3 },
        ],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result).toBeNull(); // modal consumes the rest
      const event = getPendingEvent();
      expect(event).toBeDefined();
      expect(event.detail.action).toEqual(makeAction());
      expect(event.detail.playerStats).toEqual(makePlayerStats());
      expect(event.detail.campaignName).toBe(campaignName);
      expect(event.detail.tempHp).toBe(12);
      expect(event.detail.roll).toBe('2d8 + 8');
      expect(event.detail.channelDivinityCharges).toBe(2);
      expect(typeof event.detail.castToken).toBe('number');
    });

    it('dispatches event without map when mapName is null', async () => {
      mockRuntime();
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toBeNull();
      expect(mapsService.loadMapData).not.toHaveBeenCalled();
      const event = getPendingEvent();
      // No map, so no range checking - only self is included
      expect(event.detail.creatureTargets).toEqual([{ name: 'TestPaladin', type: 'player' }]);
    });
  });
});
