// @maintained-by-ai
import { isWithinRange, isDistanceInRange, isWithinRangeOf } from './rangeCheck.js';
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

const mapWith = (players = [], placedItems = []) => ({ players, placedItems });

describe('rangeCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRuntimeMockState({ activeMapName: 'test-map', campaignName: 'test-campaign' });
  });

  describe('isWithinRange', () => {
    // Nullish range short-circuits BEFORE map load — even a far-apart,
    // fully-tracked map must pass (kills a check-moved-after-load mutant,
    // where `dist <= null` coerces to `dist <= 0`).
    it.each([null, undefined])(
      'returns true immediately when inRangeDistance is %p (always in range)',
      async (inRangeDistance) => {
        mapsService.loadMapData.mockResolvedValue(mapWith(
          [{ name: 'Alice', gridX: 1, gridY: 1 }],
          [{ name: 'Bob', gridX: 20, gridY: 20 }],
        ));
        expect(await isWithinRange('Alice', 'Bob', inRangeDistance)).toBe(true);
        expect(mapsService.loadMapData).not.toHaveBeenCalled();
      },
    );

    it('returns true when no map is active (gridless lenient)', async () => {
      setRuntimeMockState({ activeMapName: null });
      expect(await isWithinRange('Alice', 'Unplaced', 5)).toBe(true);
      expect(mapsService.loadMapData).not.toHaveBeenCalled();
    });

    it.each([
      ['map data resolves null', () => mapsService.loadMapData.mockResolvedValue(null)],
      ['map data load throws', () => mapsService.loadMapData.mockRejectedValue(new Error('network error'))],
      ['active map has only unplaced tokens (gridless)', () => mapsService.loadMapData.mockResolvedValue(mapWith([{ name: 'Alice' }, { name: 'Bob' }]))],
      ['active map has no tokens at all', () => mapsService.loadMapData.mockResolvedValue(mapWith())],
    ])('returns true when %s', async (_label, setup) => {
      setup();
      expect(await isWithinRange('Alice', 'Bob', 5)).toBe(true);
    });

    // Grid cells are 5 ft, Euclidean via getDistanceFeet (owned by
    // rangeValidation.test.js). Boundary rows falsify off-by-one mutants
    // both directions: exact 30 ft in / 35 ft out; exact 5 ft in /
    // diagonal ≈7.1 ft out. Zero-range row falsifies a falsy-short-circuit
    // mutant of the `inRangeDistance == null` guard.
    it.each([
      ['same cell, 5 ft range', 1, 1, 1, 1, 5, true],
      ['orthogonally adjacent = exact 5 ft boundary', 6, 10, 7, 10, 5, true],
      ['diagonally adjacent ≈7.1 ft beyond 5 ft', 6, 9, 7, 10, 5, false],
      ['diagonally adjacent ≈7.1 ft within 10 ft', 6, 9, 7, 10, 10, true],
      ['orthogonal 30 ft exact boundary', 1, 1, 1, 7, 30, true],
      ['orthogonal 35 ft just beyond boundary', 1, 1, 1, 8, 30, false],
      ['diagonal ≈49.5 ft beyond 30 ft', 1, 1, 8, 8, 30, false],
      ['adjacent 5 ft beyond zero range', 6, 10, 7, 10, 0, false],
    ])('%s', async (_label, sx, sy, tx, ty, rangeFt, expected) => {
      mapsService.loadMapData.mockResolvedValue(mapWith(
        [{ name: 'Alice', gridX: sx, gridY: sy }],
        [{ name: 'Bob', gridX: tx, gridY: ty }],
      ));
      expect(await isWithinRange('Alice', 'Bob', rangeFt)).toBe(expected);
      // Pin runtime-store wiring on every geometric row.
      expect(mapsService.loadMapData).toHaveBeenCalledWith('test-campaign', 'test-map');
    });

    // Map tracks at least one positioned token, so the strict guard applies:
    // a missing or unplaced endpoint cannot satisfy range (no phantom adjacency).
    it.each([
      ['source missing from a tracked map', mapWith([], [{ name: 'Bob', gridX: 1, gridY: 1 }])],
      ['target missing from a tracked map', mapWith([{ name: 'Alice', gridX: 1, gridY: 1 }], [])],
      ['source exists but is unplaced', mapWith([{ name: 'Alice' }], [{ name: 'Bob', gridX: 1, gridY: 1 }])],
      ['target exists but is unplaced', mapWith([{ name: 'Alice', gridX: 1, gridY: 1 }], [{ name: 'Bob' }])],
    ])('returns false when %s', async (_label, data) => {
      mapsService.loadMapData.mockResolvedValue(data);
      expect(await isWithinRange('Alice', 'Bob', 30)).toBe(false);
    });

    it('finds tokens across players and placedItems in either argument order', async () => {
      mapsService.loadMapData.mockResolvedValue(mapWith(
        [{ name: 'Alice', gridX: 1, gridY: 1 }],
        [{ name: 'Bob', gridX: 2, gridY: 2 }],
      ));
      expect(await isWithinRange('Alice', 'Bob', 30)).toBe(true);
      expect(await isWithinRange('Bob', 'Alice', 30)).toBe(true);
    });
  });

  describe('isDistanceInRange', () => {
    // Boundary pair 30 in / 31 out falsifies off-by-one both directions;
    // (5, 0) falsifies a falsy-short-circuit of the `rangeFt == null` guard.
    it.each([
      [null, 30, true],
      [undefined, 30, true],
      [25, null, true],
      [25, undefined, true],
      [0, 30, true],
      [20, 30, true],
      [30, 30, true],
      [31, 30, false],
      [0, 0, true],
      [5, 0, false],
    ])('isDistanceInRange(%s, %s) → %s', (dist, rangeFt, expected) => {
      expect(isDistanceInRange(dist, rangeFt)).toBe(expected);
    });
  });

  describe('isWithinRangeOf', () => {
    it('radiates from the reference token position like isWithinRange', async () => {
      mapsService.loadMapData.mockResolvedValue(mapWith(
        [{ name: 'Altar', gridX: 1, gridY: 1 }],
        [
          { name: 'Cultist', gridX: 1, gridY: 2 },
          { name: 'FarGoblin', gridX: 1, gridY: 20 },
        ],
      ));
      expect(await isWithinRangeOf('Altar', 'Cultist', 5)).toBe(true);
      expect(await isWithinRangeOf('Altar', 'FarGoblin', 5)).toBe(false);
    });
  });
});
