import { isWithinRange, isDistanceInRange } from './rangeCheck.js';
import * as mapsService from '../../maps/mapsService.js';

vi.mock('../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const state = { activeMapName: 'test-map', campaignName: 'test-campaign' };
  return {
    getRuntimeValue: vi.fn((key, prop) => {
      if (key === '__map__' && prop === 'activeMapName') return state.activeMapName;
      if (key === '__campaign__' && prop === 'campaignName') return state.campaignName;
      return null;
    }),
    setRuntimeMockState: (patch) => Object.assign(state, patch),
    getStore: vi.fn(() => ({ keys: () => [] })),
  };
});

const { setRuntimeMockState } = await import('../../../hooks/runtime/useRuntimeState.js');

describe('rangeCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isWithinRange', () => {
    it('returns true when inRangeDistance is null', async () => {
      expect(await isWithinRange('Alice', 'Bob', null)).toBe(true);
    });

    it('returns true when inRangeDistance is undefined', async () => {
      expect(await isWithinRange('Alice', 'Bob', undefined)).toBe(true);
    });

    it('returns true when loadMapData returns null', async () => {
      mapsService.loadMapData.mockResolvedValue(null);
      expect(await isWithinRange('Alice', 'Bob', 30)).toBe(true);
    });

    it('returns true when loadMapData throws', async () => {
      mapsService.loadMapData.mockRejectedValue(new Error('network error'));
      expect(await isWithinRange('Alice', 'Bob', 30)).toBe(true);
    });

    it('returns false when source not found on a tracked map', async () => {
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'Bob', gridX: 1, gridY: 1 }],
        placedItems: [],
      });
      expect(await isWithinRange('Alice', 'Bob', 30)).toBe(false);
    });

    it('returns false when target not found on a tracked map', async () => {
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'Alice', gridX: 1, gridY: 1 }],
        placedItems: [],
      });
      expect(await isWithinRange('Alice', 'Bob', 30)).toBe(false);
    });

    it('returns false when source unplaced even if other tokens are tracked', async () => {
      mapsService.loadMapData.mockResolvedValue({
        players: [],
        placedItems: [{ name: 'Alice', gridX: 1, gridY: 1 }],
      });
      expect(await isWithinRange('Alice', 'Bob', 30)).toBe(false);
    });

    it('returns true when no map is active (gridless lenient)', async () => {
      setRuntimeMockState({ activeMapName: null });
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'Alice', gridX: 1, gridY: 1 }],
        placedItems: [],
      });
      expect(await isWithinRange('Alice', 'Unplaced', 5)).toBe(true);
      setRuntimeMockState({ activeMapName: 'test-map' });
    });

    it('returns true when active map has no positioned tokens (gridless lenient)', async () => {
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'Alice' }, { name: 'Bob' }],
        placedItems: [],
      });
      expect(await isWithinRange('Alice', 'Bob', 5)).toBe(true);
    });

    it('returns true when active map has no tokens at all', async () => {
      mapsService.loadMapData.mockResolvedValue({
        players: [],
        placedItems: [],
      });
      expect(await isWithinRange('Alice', 'Bob', 5)).toBe(true);
    });

    it('returns true for orthogonally adjacent tokens within 5 ft', async () => {
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'Ally', gridX: 6, gridY: 10 }],
        placedItems: [{ name: 'Thug 1', gridX: 7, gridY: 10 }],
      });
      expect(await isWithinRange('Thug 1', 'Ally', 5)).toBe(true);
    });

    it('returns false for diagonally adjacent tokens beyond 5 ft', async () => {
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'Ally', gridX: 6, gridY: 9 }],
        placedItems: [{ name: 'Thug 1', gridX: 7, gridY: 10 }],
      });
      expect(await isWithinRange('Thug 1', 'Ally', 5)).toBe(false);
    });

    it('returns false for 25 ft apart tokens against a 5 ft check', async () => {
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'ElderPaladin', gridX: 4, gridY: 5 }],
        placedItems: [{ name: 'Thug 1', gridX: 7, gridY: 10 }],
      });
      expect(await isWithinRange('Thug 1', 'ElderPaladin', 5)).toBe(false);
    });

    it('returns false for unplaced creature when other tokens are tracked', async () => {
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'NPC 1' }],
        placedItems: [{ name: 'Thug 1', gridX: 7, gridY: 10 }],
      });
      expect(await isWithinRange('Thug 1', 'NPC 1', 5)).toBe(false);
    });

    it('returns true when target found in placedItems but not players', async () => {
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'Alice', gridX: 1, gridY: 1 }],
        placedItems: [{ name: 'Bob', gridX: 2, gridY: 2 }],
      });
      expect(await isWithinRange('Alice', 'Bob', 30)).toBe(true);
    });

    it('returns true when both found in placedItems', async () => {
      mapsService.loadMapData.mockResolvedValue({
        players: [],
        placedItems: [
          { name: 'Goblin', gridX: 1, gridY: 1 },
          { name: 'Dragon', gridX: 2, gridY: 2 },
        ],
      });
      expect(await isWithinRange('Goblin', 'Dragon', 30)).toBe(true);
    });

    it('returns true when distance is zero (same position)', async () => {
      mapsService.loadMapData.mockResolvedValue({
        players: [
          { name: 'Alice', gridX: 5, gridY: 5 },
          { name: 'Bob', gridX: 5, gridY: 5 },
        ],
        placedItems: [],
      });
      expect(await isWithinRange('Alice', 'Bob', 30)).toBe(true);
    });

    it('returns true when distance is within range', async () => {
      mapsService.loadMapData.mockResolvedValue({
        players: [
          { name: 'Alice', gridX: 1, gridY: 1 },
          { name: 'Bob', gridX: 4, gridY: 1 },
        ],
        placedItems: [],
      });
      expect(await isWithinRange('Alice', 'Bob', 30)).toBe(true);
    });

    it('returns true at exact range boundary', async () => {
      mapsService.loadMapData.mockResolvedValue({
        players: [
          { name: 'Alice', gridX: 1, gridY: 1 },
          { name: 'Bob', gridX: 1, gridY: 7 },
        ],
        placedItems: [],
      });
      expect(await isWithinRange('Alice', 'Bob', 30)).toBe(true);
    });

    it('returns false when beyond range', async () => {
      mapsService.loadMapData.mockResolvedValue({
        players: [
          { name: 'Alice', gridX: 1, gridY: 1 },
          { name: 'Bob', gridX: 1, gridY: 8 },
        ],
        placedItems: [],
      });
      expect(await isWithinRange('Alice', 'Bob', 30)).toBe(false);
    });

    it('returns false when diagonal distance beyond range', async () => {
      mapsService.loadMapData.mockResolvedValue({
        players: [
          { name: 'Alice', gridX: 1, gridY: 1 },
          { name: 'Bob', gridX: 8, gridY: 8 },
        ],
        placedItems: [],
      });
      expect(await isWithinRange('Alice', 'Bob', 30)).toBe(false);
    });
  });

  describe('isDistanceInRange', () => {
    it('returns true when rangeFt is null', () => {
      expect(isDistanceInRange(25, null)).toBe(true);
      expect(isDistanceInRange(25, undefined)).toBe(true);
    });

    it('returns true when dist is null', () => {
      expect(isDistanceInRange(null, 30)).toBe(true);
      expect(isDistanceInRange(undefined, 30)).toBe(true);
    });

    it('returns true when within range', () => {
      expect(isDistanceInRange(20, 30)).toBe(true);
      expect(isDistanceInRange(0, 30)).toBe(true);
    });

    it('returns true at exact range boundary', () => {
      expect(isDistanceInRange(30, 30)).toBe(true);
    });

    it('returns false when beyond range', () => {
      expect(isDistanceInRange(35, 30)).toBe(false);
      expect(isDistanceInRange(100, 30)).toBe(false);
    });
  });
});
