import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellPositionResolver } from './useSpellPositionResolver.js';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockLoadMapData = vi.fn();
const mockGetCombatContext = vi.fn();
const mockGetTargetFromAttacker = vi.fn();
const mockGetNearestPlacedItem = vi.fn();

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: (...args) => mockLoadMapData(...args),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: (...args) => mockGetCombatContext(...args),
  getTargetFromAttacker: (...args) => mockGetTargetFromAttacker(...args),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: (...args) => mockGetNearestPlacedItem(...args),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMapData(overrides = {}) {
  return {
    players: [
      { name: 'Wizard', gridX: 5, gridY: 5 },
      { name: 'Rogue', gridX: 10, gridY: 10 },
    ],
    placedItems: [
      { name: 'Goblin', gridX: 3, gridY: 3 },
      { name: 'Goblin 2', gridX: 8, gridY: 8 },
    ],
    ...overrides,
  };
}

function makeCombatSummary(overrides = {}) {
  return {
    creatures: [
      { name: 'Wizard', targetName: 'Goblin' },
      { name: 'Rogue', targetName: 'Goblin 2' },
      { name: 'Goblin' },
      { name: 'Goblin 2' },
    ],
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useSpellPositionResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Return value structure ─────────────────────────────────────────────

  describe('return value', () => {
    it('returns an object with resolvePositions and cachedPosRef', () => {
      const { result } = renderHook(() =>
        useSpellPositionResolver('TestCampaign', 'TestMap', 'Wizard')
      );

      expect(result.current).toHaveProperty('resolvePositions');
      expect(result.current).toHaveProperty('cachedPosRef');
      expect(typeof result.current.resolvePositions).toBe('function');
      expect(result.current.cachedPosRef).toHaveProperty('current');
      expect(result.current.cachedPosRef.current).toBeNull();
    });

    it('cachedPosRef.current starts as null', () => {
      const { result } = renderHook(() =>
        useSpellPositionResolver('TestCampaign', 'TestMap', 'Wizard')
      );

      expect(result.current.cachedPosRef.current).toBeNull();
    });
  });

  // ── Early return when no mapName ───────────────────────────────────────

  describe('early return when no mapName', () => {
    it('does not call any services when mapName is null', async () => {
      const { result } = renderHook(() =>
        useSpellPositionResolver('TestCampaign', null, 'Wizard')
      );

      await act(async () => {
        await result.current.resolvePositions();
      });

      expect(mockLoadMapData).not.toHaveBeenCalled();
      expect(mockGetCombatContext).not.toHaveBeenCalled();
      expect(mockGetTargetFromAttacker).not.toHaveBeenCalled();
      expect(mockGetNearestPlacedItem).not.toHaveBeenCalled();
    });

    it('does not call any services when mapName is undefined', async () => {
      const { result } = renderHook(() =>
        useSpellPositionResolver('TestCampaign', undefined, 'Wizard')
      );

      await act(async () => {
        await result.current.resolvePositions();
      });

      expect(mockLoadMapData).not.toHaveBeenCalled();
    });

    it('does not call any services when mapName is empty string', async () => {
      const { result } = renderHook(() =>
        useSpellPositionResolver('TestCampaign', '', 'Wizard')
      );

      await act(async () => {
        await result.current.resolvePositions();
      });

      expect(mockLoadMapData).not.toHaveBeenCalled();
    });
  });

  // ── Successful resolution with player target ──────────────────────────

  describe('successful resolution', () => {
    it('loads map data and resolves positions when attacker is a player with a target', async () => {
      const csData = makeCombatSummary();
      const mapData = makeMapData();
      mockLoadMapData.mockResolvedValue([mapData]);
      mockGetCombatContext.mockResolvedValue(csData);
      mockGetTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      mockGetNearestPlacedItem.mockReturnValue({ name: 'Goblin', gridX: 3, gridY: 3 });

      const { result } = renderHook(() =>
        useSpellPositionResolver('TestCampaign', 'TestMap', 'Wizard')
      );

      await act(async () => {
        await result.current.resolvePositions();
      });

      expect(mockLoadMapData).toHaveBeenCalledWith('TestCampaign', 'TestMap');
      expect(mockGetCombatContext).toHaveBeenCalledWith('TestCampaign');
      expect(mockGetTargetFromAttacker).toHaveBeenCalledWith(
        expect.anything(),
        'Wizard'
      );

      expect(result.current.cachedPosRef.current).toEqual({
        attackerPos: { gridX: 5, gridY: 5 },
        targetPos: { gridX: 3, gridY: 3 },
      });
    });

    it('resolves position when target is found on the map as a player', async () => {
      mockLoadMapData.mockResolvedValue([makeMapData()]);
      mockGetCombatContext.mockResolvedValue(makeCombatSummary());
      mockGetTargetFromAttacker.mockReturnValue({ name: 'Rogue' });

      const { result } = renderHook(() =>
        useSpellPositionResolver('TestCampaign', 'TestMap', 'Wizard')
      );

      await act(async () => {
        await result.current.resolvePositions();
      });

      expect(result.current.cachedPosRef.current).toEqual({
        attackerPos: { gridX: 5, gridY: 5 },
        targetPos: { gridX: 10, gridY: 10 },
      });
    });

    it('resolves position when target is an NPC not on the map', async () => {
      const mapData = makeMapData({
        players: [{ name: 'Wizard', gridX: 5, gridY: 5 }],
        placedItems: [
          { name: 'Goblin', gridX: 3, gridY: 3 },
          { name: 'Goblin 2', gridX: 8, gridY: 8 },
        ],
      });
      mockLoadMapData.mockResolvedValue([mapData]);
      mockGetCombatContext.mockResolvedValue(makeCombatSummary());
      mockGetTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      mockGetNearestPlacedItem.mockReturnValue({ name: 'Goblin', gridX: 3, gridY: 3 });

      const { result } = renderHook(() =>
        useSpellPositionResolver('TestCampaign', 'TestMap', 'Wizard')
      );

      await act(async () => {
        await result.current.resolvePositions();
      });

      expect(mockGetNearestPlacedItem).toHaveBeenCalledWith(
        mapData.placedItems,
        'Goblin',
        expect.objectContaining({ name: 'Wizard', gridX: 5, gridY: 5 })
      );

      expect(result.current.cachedPosRef.current).toEqual({
        attackerPos: { gridX: 5, gridY: 5 },
        targetPos: { gridX: 3, gridY: 3 },
      });
    });

    it('uses nearest placed item when multiple matches exist', async () => {
      const mapData = makeMapData({
        players: [{ name: 'Wizard', gridX: 5, gridY: 5 }],
        placedItems: [
          { name: 'Goblin', gridX: 3, gridY: 3 },
          { name: 'Goblin 2', gridX: 8, gridY: 8 },
        ],
      });
      mockLoadMapData.mockResolvedValue([mapData]);
      mockGetCombatContext.mockResolvedValue(makeCombatSummary());
      mockGetTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      mockGetNearestPlacedItem.mockReturnValue({ name: 'Goblin', gridX: 3, gridY: 3 });

      const { result } = renderHook(() =>
        useSpellPositionResolver('TestCampaign', 'TestMap', 'Wizard')
      );

      await act(async () => {
        await result.current.resolvePositions();
      });

      expect(mockGetNearestPlacedItem).toHaveBeenCalledTimes(1);
      expect(result.current.cachedPosRef.current.targetPos).toEqual({
        gridX: 3,
        gridY: 3,
      });
    });

    it('uses player position when target exists as both player and placed item', async () => {
      const mapData = makeMapData({
        players: [
          { name: 'Wizard', gridX: 5, gridY: 5 },
          { name: 'Goblin', gridX: 3, gridY: 3 },
        ],
        placedItems: [
          { name: 'Goblin', gridX: 99, gridY: 99 },
        ],
      });
      mockLoadMapData.mockResolvedValue([mapData]);
      mockGetCombatContext.mockResolvedValue(makeCombatSummary());
      mockGetTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      mockGetNearestPlacedItem.mockReturnValue({ name: 'Goblin', gridX: 99, gridY: 99 });

      const { result } = renderHook(() =>
        useSpellPositionResolver('TestCampaign', 'TestMap', 'Wizard')
      );

      await act(async () => {
        await result.current.resolvePositions();
      });

      expect(result.current.cachedPosRef.current).toEqual({
        attackerPos: { gridX: 5, gridY: 5 },
        targetPos: { gridX: 3, gridY: 3 },
      });
    });
  });

  // ── No combat context ──────────────────────────────────────────────────

  describe('no combat context', () => {
    it('does not cache positions when getCombatContext returns null', async () => {
      mockLoadMapData.mockResolvedValue([makeMapData()]);
      mockGetCombatContext.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useSpellPositionResolver('TestCampaign', 'TestMap', 'Wizard')
      );

      await act(async () => {
        await result.current.resolvePositions();
      });

      expect(result.current.cachedPosRef.current).toBeNull();
    });

    it('does not cache positions when getCombatContext returns undefined', async () => {
      mockLoadMapData.mockResolvedValue([makeMapData()]);
      mockGetCombatContext.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useSpellPositionResolver('TestCampaign', 'TestMap', 'Wizard')
      );

      await act(async () => {
        await result.current.resolvePositions();
      });

      expect(result.current.cachedPosRef.current).toBeNull();
    });
  });

  // ── No target from attacker ────────────────────────────────────────────

  describe('no target from attacker', () => {
    it('does not cache positions when getTargetFromAttacker returns null', async () => {
      mockLoadMapData.mockResolvedValue([makeMapData()]);
      mockGetCombatContext.mockResolvedValue(makeCombatSummary());
      mockGetTargetFromAttacker.mockReturnValue(null);

      const { result } = renderHook(() =>
        useSpellPositionResolver('TestCampaign', 'TestMap', 'Wizard')
      );

      await act(async () => {
        await result.current.resolvePositions();
      });

      expect(result.current.cachedPosRef.current).toBeNull();
    });

    it('does not call getNearestPlacedItem when there is no target', async () => {
      mockLoadMapData.mockResolvedValue([makeMapData()]);
      mockGetCombatContext.mockResolvedValue(makeCombatSummary());
      mockGetTargetFromAttacker.mockReturnValue(null);

      const { result } = renderHook(() =>
        useSpellPositionResolver('TestCampaign', 'TestMap', 'Wizard')
      );

      await act(async () => {
        await result.current.resolvePositions();
      });

      expect(mockGetNearestPlacedItem).not.toHaveBeenCalled();
    });
  });

  // ── Attacker not found on map ──────────────────────────────────────────

  describe('attacker not found on map', () => {
    it('does not cache positions when attacker is not in mapData.players', async () => {
      mockLoadMapData.mockResolvedValue(makeMapData({
        players: [{ name: 'Rogue', gridX: 10, gridY: 10 }],
      }));
      mockGetCombatContext.mockResolvedValue(makeCombatSummary());
      mockGetTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

      const { result } = renderHook(() =>
        useSpellPositionResolver('TestCampaign', 'TestMap', 'Wizard')
      );

      await act(async () => {
        await result.current.resolvePositions();
      });

      expect(result.current.cachedPosRef.current).toBeNull();
    });
  });

  // ── Target position resolution failure ─────────────────────────────────

  describe('target position resolution failure', () => {
    it('does not cache positions when target is not a player and no placed items', async () => {
      const mapData = makeMapData({
        players: [{ name: 'Wizard', gridX: 5, gridY: 5 }],
        placedItems: [],
      });
      mockLoadMapData.mockResolvedValue(mapData);
      mockGetCombatContext.mockResolvedValue(makeCombatSummary());
      mockGetTargetFromAttacker.mockReturnValue({ name: 'Mystery Creature' });

      const { result } = renderHook(() =>
        useSpellPositionResolver('TestCampaign', 'TestMap', 'Wizard')
      );

      await act(async () => {
        await result.current.resolvePositions();
      });

      expect(mockGetNearestPlacedItem).not.toHaveBeenCalled();
      expect(result.current.cachedPosRef.current).toBeNull();
    });

    it('does not cache positions when target is not a player and getNearestPlacedItem returns null', async () => {
      const mapData = makeMapData();
      mockLoadMapData.mockResolvedValue([mapData]);
      mockGetCombatContext.mockResolvedValue(makeCombatSummary());
      mockGetTargetFromAttacker.mockReturnValue({ name: 'Mystery Creature' });
      mockGetNearestPlacedItem.mockReturnValue(null);

      const { result } = renderHook(() =>
        useSpellPositionResolver('TestCampaign', 'TestMap', 'Wizard')
      );

      await act(async () => {
        await result.current.resolvePositions();
      });

      expect(mockGetNearestPlacedItem).toHaveBeenCalled();
      expect(result.current.cachedPosRef.current).toBeNull();
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────

  describe('error handling', () => {
    it('catches errors and does not cache positions when loadMapData fails', async () => {
      mockLoadMapData.mockRejectedValue(new Error('Map not found'));

      const { result } = renderHook(() =>
        useSpellPositionResolver('TestCampaign', 'TestMap', 'Wizard')
      );

      await act(async () => {
        await result.current.resolvePositions();
      });

      expect(result.current.cachedPosRef.current).toBeNull();
    });

    it('catches errors and does not cache positions when getCombatContext fails', async () => {
      mockLoadMapData.mockResolvedValue([makeMapData()]);
      mockGetCombatContext.mockRejectedValue(new Error('Context error'));

      const { result } = renderHook(() =>
        useSpellPositionResolver('TestCampaign', 'TestMap', 'Wizard')
      );

      await act(async () => {
        await result.current.resolvePositions();
      });

      expect(result.current.cachedPosRef.current).toBeNull();
    });
  });

  // ── useCallback stability ──────────────────────────────────────────────

  describe('useCallback stability', () => {
    it('returns the same resolvePositions function when props do not change', () => {
      const { result, rerender } = renderHook(
        ({ campaign, map, player }) =>
          useSpellPositionResolver(campaign, map, player),
        {
          initialProps: {
            campaign: 'TestCampaign',
            map: 'TestMap',
            player: 'Wizard',
          },
        }
      );

      const firstResolve = result.current.resolvePositions;

      rerender({
        campaign: 'TestCampaign',
        map: 'TestMap',
        player: 'Wizard',
      });

      expect(result.current.resolvePositions).toBe(firstResolve);
    });

    it('returns a new resolvePositions function when mapName changes', () => {
      const { result, rerender } = renderHook(
        ({ campaign, map, player }) =>
          useSpellPositionResolver(campaign, map, player),
        {
          initialProps: {
            campaign: 'TestCampaign',
            map: 'TestMap',
            player: 'Wizard',
          },
        }
      );

      const firstResolve = result.current.resolvePositions;

      rerender({
        campaign: 'TestCampaign',
        map: 'NewMap',
        player: 'Wizard',
      });

      expect(result.current.resolvePositions).not.toBe(firstResolve);
    });

    it('returns a new resolvePositions function when playerName changes', () => {
      const { result, rerender } = renderHook(
        ({ campaign, map, player }) =>
          useSpellPositionResolver(campaign, map, player),
        {
          initialProps: {
            campaign: 'TestCampaign',
            map: 'TestMap',
            player: 'Wizard',
          },
        }
      );

      const firstResolve = result.current.resolvePositions;

      rerender({
        campaign: 'TestCampaign',
        map: 'TestMap',
        player: 'Rogue',
      });

      expect(result.current.resolvePositions).not.toBe(firstResolve);
    });

    it('returns a new resolvePositions function when campaignName changes', () => {
      const { result, rerender } = renderHook(
        ({ campaign, map, player }) =>
          useSpellPositionResolver(campaign, map, player),
        {
          initialProps: {
            campaign: 'TestCampaign',
            map: 'TestMap',
            player: 'Wizard',
          },
        }
      );

      const firstResolve = result.current.resolvePositions;

      rerender({
        campaign: 'NewCampaign',
        map: 'TestMap',
        player: 'Wizard',
      });

      expect(result.current.resolvePositions).not.toBe(firstResolve);
    });
  });
});
