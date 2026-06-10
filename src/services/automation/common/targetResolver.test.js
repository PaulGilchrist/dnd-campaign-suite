import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../rules/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../rules/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { resolveTarget, resolveMapPositions } from './targetResolver.js';
import * as damageUtils from '../../rules/damageUtils.js';
import * as mapsService from '../../maps/mapsService.js';
import * as rangeValidation from '../../rules/rangeValidation.js';

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
    it('should return { target, cs } when both getCombatContext and getTargetFromAttacker succeed', async () => {
      const cs = makeCombatContext();
      const target = makeTarget();

      damageUtils.getCombatContext.mockResolvedValue(cs);
      damageUtils.getTargetFromAttacker.mockReturnValue(target);

      const result = await resolveTarget(campaignName, attackerName);

      expect(result).toEqual({ target, cs });
      expect(damageUtils.getCombatContext).toHaveBeenCalledWith(campaignName);
      expect(damageUtils.getTargetFromAttacker).toHaveBeenCalledWith(cs, attackerName);
    });

    it('should return null when getCombatContext returns null', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await resolveTarget(campaignName, attackerName);

      expect(result).toBeNull();
      expect(damageUtils.getCombatContext).toHaveBeenCalledWith(campaignName);
      expect(damageUtils.getTargetFromAttacker).not.toHaveBeenCalled();
    });

    it('should return null when getCombatContext returns undefined', async () => {
      damageUtils.getCombatContext.mockResolvedValue(undefined);

      const result = await resolveTarget(campaignName, attackerName);

      expect(result).toBeNull();
      expect(damageUtils.getTargetFromAttacker).not.toHaveBeenCalled();
    });

    it('should return null when getTargetFromAttacker returns null (no targetName on attacker)', async () => {
      const cs = makeCombatContext();

      damageUtils.getCombatContext.mockResolvedValue(cs);
      damageUtils.getTargetFromAttacker.mockReturnValue(null);

      const result = await resolveTarget(campaignName, attackerName);

      expect(result).toBeNull();
      expect(damageUtils.getCombatContext).toHaveBeenCalledWith(campaignName);
      expect(damageUtils.getTargetFromAttacker).toHaveBeenCalledWith(cs, attackerName);
    });

    it('should return null when getTargetFromAttacker returns undefined', async () => {
      const cs = makeCombatContext();

      damageUtils.getCombatContext.mockResolvedValue(cs);
      damageUtils.getTargetFromAttacker.mockReturnValue(undefined);

      const result = await resolveTarget(campaignName, attackerName);

      expect(result).toBeNull();
    });
  });

  describe('resolveMapPositions', () => {
    it('should return null immediately when mapName is falsy', async () => {
      const result = await resolveMapPositions(campaignName, null, attackerName);

      expect(result).toBeNull();
      expect(mapsService.loadMapData).not.toHaveBeenCalled();
    });

    it('should return null immediately when mapName is empty string', async () => {
      const result = await resolveMapPositions(campaignName, '', attackerName);

      expect(result).toBeNull();
      expect(mapsService.loadMapData).not.toHaveBeenCalled();
    });

    it('should return null when loadMapData rejects', async () => {
      mapsService.loadMapData.mockRejectedValue(new Error('Failed to load map'));

      const result = await resolveMapPositions(campaignName, 'TestMap', attackerName);

      expect(result).toBeNull();
      expect(mapsService.loadMapData).toHaveBeenCalledWith(campaignName, 'TestMap');
    });

    it('should return null when mapData is falsy/undefined', async () => {
      mapsService.loadMapData.mockResolvedValue(null);

      const result = await resolveMapPositions(campaignName, 'TestMap', attackerName);

      expect(result).toBeNull();
      expect(mapsService.loadMapData).toHaveBeenCalledWith(campaignName, 'TestMap');
    });

    it('should return null when attackerPlayer not found in mapData.players', async () => {
      const mapData = makeMapData({
        players: [makeAttacker({ name: 'OtherAttacker' })],
      });
      mapsService.loadMapData.mockResolvedValue(mapData);

      const result = await resolveMapPositions(campaignName, 'TestMap', attackerName);

      expect(result).toBeNull();
    });

    it('should return null when target is null (no combat target) due to destructuring error', async () => {
      const mapData = makeMapData();

      mapsService.loadMapData.mockResolvedValue(mapData);
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext());
      damageUtils.getTargetFromAttacker.mockReturnValue(null);

      const result = await resolveMapPositions(campaignName, 'TestMap', attackerName);

      expect(result).toBeNull();
    });

    it('should return { attackerPos, targetPos } when targetPlayer found in mapData.players', async () => {
      const targetPlayer = makeTarget();
      const mapData = makeMapData({
        players: [makeAttacker(), targetPlayer],
      });

      mapsService.loadMapData.mockResolvedValue(mapData);
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext());
      damageUtils.getTargetFromAttacker.mockReturnValue(targetPlayer);

      const result = await resolveMapPositions(campaignName, 'TestMap', attackerName);

      expect(result).toEqual({
        attackerPos: { gridX: mapData.players[0].gridX, gridY: mapData.players[0].gridY },
        targetPos: { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY },
      });
      expect(rangeValidation.getNearestPlacedItem).not.toHaveBeenCalled();
    });

    it('should return { attackerPos, targetPos } when targetNpc found via getNearestPlacedItem', async () => {
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
        attackerPos: { gridX: mapData.players[0].gridX, gridY: mapData.players[0].gridY },
        targetPos: { gridX: targetNpc.gridX, gridY: targetNpc.gridY },
      });
      expect(rangeValidation.getNearestPlacedItem).toHaveBeenCalledWith(
        mapData.placedItems,
        targetNpc.name,
        mapData.players[0],
      );
    });

    it('should return { attackerPos, targetPos: null } when neither targetPlayer nor targetNpc found', async () => {
      const mapData = makeMapData({
        placedItems: [],
      });

      mapsService.loadMapData.mockResolvedValue(mapData);
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext());
      damageUtils.getTargetFromAttacker.mockReturnValue(makeTarget());

      const result = await resolveMapPositions(campaignName, 'TestMap', attackerName);

      expect(result).toEqual({
        attackerPos: { gridX: mapData.players[0].gridX, gridY: mapData.players[0].gridY },
        targetPos: null,
      });
    });

    it('should use getNearestPlacedItem only when mapData.placedItems has length > 0', async () => {
      const targetNpc = { name: 'Enemy', gridX: 15, gridY: 20 };
      const mapData = makeMapData({
        placedItems: [targetNpc],
      });

      mapsService.loadMapData.mockResolvedValue(mapData);
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext());
      damageUtils.getTargetFromAttacker.mockReturnValue(targetNpc);
      rangeValidation.getNearestPlacedItem.mockReturnValue(targetNpc);

      await resolveMapPositions(campaignName, 'TestMap', attackerName);

      expect(rangeValidation.getNearestPlacedItem).toHaveBeenCalled();
    });

    it('should not call getNearestPlacedItem when mapData.placedItems is empty', async () => {
      const targetNpc = makeTarget();
      const mapData = makeMapData({
        placedItems: [],
      });

      mapsService.loadMapData.mockResolvedValue(mapData);
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext());
      damageUtils.getTargetFromAttacker.mockReturnValue(targetNpc);

      const result = await resolveMapPositions(campaignName, 'TestMap', attackerName);

      expect(result.targetPos).toBeNull();
      expect(rangeValidation.getNearestPlacedItem).not.toHaveBeenCalled();
    });

    it('should not call getNearestPlacedItem when mapData.placedItems is undefined', async () => {
      const targetNpc = makeTarget();
      const mapData = makeMapData({
        placedItems: undefined,
      });

      mapsService.loadMapData.mockResolvedValue(mapData);
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext());
      damageUtils.getTargetFromAttacker.mockReturnValue(targetNpc);

      const result = await resolveMapPositions(campaignName, 'TestMap', attackerName);

      expect(result.targetPos).toBeNull();
      expect(rangeValidation.getNearestPlacedItem).not.toHaveBeenCalled();
    });

    it('should prioritize targetPos from targetPlayer over targetNpc when both exist', async () => {
      const targetPlayer = { name: 'Enemy', gridX: 1, gridY: 2 };
      const targetNpc = { name: 'Enemy', gridX: 100, gridY: 200 };
      const mapData = makeMapData({
        players: [makeAttacker(), targetPlayer],
        placedItems: [targetNpc],
      });

      mapsService.loadMapData.mockResolvedValue(mapData);
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext());
      damageUtils.getTargetFromAttacker.mockReturnValue(targetPlayer);
      rangeValidation.getNearestPlacedItem.mockReturnValue(targetNpc);

      const result = await resolveMapPositions(campaignName, 'TestMap', attackerName);

      expect(result.targetPos).toEqual({ gridX: 1, gridY: 2 });
      expect(rangeValidation.getNearestPlacedItem).toHaveBeenCalled();
    });

    it('should handle mapData with no players array', async () => {
      mapsService.loadMapData.mockResolvedValue({});

      const result = await resolveMapPositions(campaignName, 'TestMap', attackerName);

      expect(result).toBeNull();
    });
  });
});
