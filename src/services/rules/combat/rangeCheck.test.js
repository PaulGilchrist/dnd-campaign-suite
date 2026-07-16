import { isWithinRange, isDistanceInRange } from './rangeCheck.js';
import * as mapsService from '../../maps/mapsService.js';

vi.mock('../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((key, prop) => {
    if (key === '__map__' && prop === 'activeMapName') return 'test-map';
    if (key === '__campaign__' && prop === 'campaignName') return 'test-campaign';
    return null;
  }),
}));

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

    it('returns true when source not found on map', async () => {
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'Bob', gridX: 1, gridY: 1 }],
        placedItems: [],
      });
      expect(await isWithinRange('Alice', 'Bob', 30)).toBe(true);
    });

    it('returns true when target not found on map', async () => {
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'Alice', gridX: 1, gridY: 1 }],
        placedItems: [],
      });
      expect(await isWithinRange('Alice', 'Bob', 30)).toBe(true);
    });

    it('returns true when source found in placedItems but not players', async () => {
      mapsService.loadMapData.mockResolvedValue({
        players: [],
        placedItems: [{ name: 'Alice', gridX: 1, gridY: 1 }],
      });
      expect(await isWithinRange('Alice', 'Bob', 30)).toBe(true);
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
