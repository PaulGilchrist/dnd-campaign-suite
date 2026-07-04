// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { resolveTarget, resolveMapPositions } from './targetResolver.js';
import * as damageUtils from '../../rules/combat/damageUtils.js';
import * as mapsService from '../../maps/mapsService.js';
import * as rangeValidation from '../../rules/combat/rangeValidation.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const attackerName = 'Attacker';

function makeCombatContext(overrides = {}) {
  return {
    targetName: 'Enemy',
    ...overrides,
  };
}

function makeAttacker(overrides = {}) {
  return {
    name: attackerName,
    gridX: 5,
    gridY: 10,
    ...overrides,
  };
}

function makeTarget(overrides = {}) {
  return {
    name: 'Enemy',
    gridX: 15,
    gridY: 20,
    ...overrides,
  };
}

function makeMapData(overrides = {}) {
  return {
    players: [makeAttacker()],
    placedItems: [],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('targetResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveTarget', () => {
    it('returns { target, cs } when both lookups succeed', async () => {
      const cs = makeCombatContext();
      const target = makeTarget();

      damageUtils.getCombatContext.mockResolvedValue(cs);
      damageUtils.getTargetFromAttacker.mockReturnValue(target);

      const result = await resolveTarget(campaignName, attackerName);

      expect(result).toEqual({ target, cs });
      expect(damageUtils.getCombatContext).toHaveBeenCalledWith(campaignName);
      expect(damageUtils.getTargetFromAttacker).toHaveBeenCalledWith(cs, attackerName);
    });

    it('returns null when getCombatContext or getTargetFromAttacker returns a falsy value', async () => {
      // When getCombatContext is falsy, getTargetFromAttacker is never called
      damageUtils.getCombatContext.mockResolvedValue(null);
      let result = await resolveTarget(campaignName, attackerName);
      expect(result).toBeNull();
      expect(damageUtils.getCombatContext).toHaveBeenCalledWith(campaignName);
      expect(damageUtils.getTargetFromAttacker).not.toHaveBeenCalled();

      vi.clearAllMocks();

      // When getTargetFromAttacker is falsy, both functions are called
      const cs = makeCombatContext();
      damageUtils.getCombatContext.mockResolvedValue(cs);
      damageUtils.getTargetFromAttacker.mockReturnValue(null);

      result = await resolveTarget(campaignName, attackerName);
      expect(result).toBeNull();
      expect(damageUtils.getCombatContext).toHaveBeenCalledWith(campaignName);
      expect(damageUtils.getTargetFromAttacker).toHaveBeenCalledWith(cs, attackerName);
    });
  });

  describe('resolveMapPositions', () => {
    it('returns null immediately when mapName is falsy', async () => {
      const result = await resolveMapPositions(campaignName, null, attackerName);

      expect(result).toBeNull();
      expect(mapsService.loadMapData).not.toHaveBeenCalled();
    });

    it('returns null when loadMapData rejects', async () => {
      mapsService.loadMapData.mockRejectedValue(new Error('Failed to load map'));

      const result = await resolveMapPositions(campaignName, 'TestMap', attackerName);

      expect(result).toBeNull();
      expect(mapsService.loadMapData).toHaveBeenCalledWith(campaignName, 'TestMap');
    });

    it('returns null when attacker is not found in mapData.players', async () => {
      const mapData = makeMapData({
        players: [makeAttacker({ name: 'OtherAttacker' })],
      });
      mapsService.loadMapData.mockResolvedValue(mapData);

      const result = await resolveMapPositions(campaignName, 'TestMap', attackerName);

      expect(result).toBeNull();
    });

    it('returns positions when targetPlayer is found on the map', async () => {
      const targetPlayer = makeTarget();
      const mapData = makeMapData({
        players: [makeAttacker(), targetPlayer],
      });

      mapsService.loadMapData.mockResolvedValue(mapData);
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext());
      damageUtils.getTargetFromAttacker.mockReturnValue(targetPlayer);

      const result = await resolveMapPositions(campaignName, 'TestMap', attackerName);

      expect(result).toEqual({
        attackerPos: { gridX: 5, gridY: 10 },
        targetPos: { gridX: 15, gridY: 20 },
      });
      expect(rangeValidation.getNearestPlacedItem).not.toHaveBeenCalled();
    });

    it('falls back to targetNpc when targetPlayer is not on the map', async () => {
      const targetNpc = { name: 'Enemy', gridX: 15, gridY: 20 };
      const mapData = makeMapData({
        placedItems: [targetNpc],
      });

      mapsService.loadMapData.mockResolvedValue(mapData);
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext());
      damageUtils.getTargetFromAttacker.mockReturnValue(targetNpc);
      rangeValidation.getNearestPlacedItem.mockReturnValue(targetNpc);

      const result = await resolveMapPositions(campaignName, 'TestMap', attackerName);

      expect(result).toEqual({
        attackerPos: { gridX: 5, gridY: 10 },
        targetPos: { gridX: 15, gridY: 20 },
      });
      expect(rangeValidation.getNearestPlacedItem).toHaveBeenCalledWith(
        mapData.placedItems,
        targetNpc.name,
        mapData.players[0],
      );
    });

    it('returns targetPos null when target is neither a player nor a placed item', async () => {
      const mapData = makeMapData({
        placedItems: [],
      });

      mapsService.loadMapData.mockResolvedValue(mapData);
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext());
      damageUtils.getTargetFromAttacker.mockReturnValue(makeTarget());

      const result = await resolveMapPositions(campaignName, 'TestMap', attackerName);

      expect(result).toEqual({
        attackerPos: { gridX: 5, gridY: 10 },
        targetPos: null,
      });
    });

    it('returns null when resolveTarget rejects', async () => {
      const mapData = makeMapData();

      mapsService.loadMapData.mockResolvedValue(mapData);
      damageUtils.getCombatContext.mockRejectedValue(new Error('Combat context failed'));

      const result = await resolveMapPositions(campaignName, 'TestMap', attackerName);

      expect(result).toBeNull();
    });
  });
});
