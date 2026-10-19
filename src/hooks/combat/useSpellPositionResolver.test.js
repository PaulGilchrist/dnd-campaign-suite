// @maintained-by-ai
// useSpellPositionResolver — RESOLUTION lane: resolvePositions() writes
// cachedPosRef.current = { attackerPos, targetPos } exactly when attacker +
// target both resolve on the map; never touches it otherwise (write-only
// once-per-resolve, stale value survives a failed resolve).
//
// Seams (who owns what):
//   this file           → cache WRITE contract: service wiring, player-first
//                         target lookup, delegation to getNearestPlacedItem,
//                         guards, refresh/stale-retention, 3s map-load timeout.
//   useSpellCastExecutor.castAction.test.js (#945) → cache CONSUMPTION:
//                         executor reads/clears cachedPosRef at cast time.
//   rangeValidation.test.js (#903 lane) → nearest/suffix item selection.
//   damageUtils.test.js → getTargetFromAttacker combat-summary lookup.
// The two pure helpers run UNMOCKED here (#791); only the two network
// boundaries (loadMapData, getCombatContext fetch) are mocked — zero network.
//
// Old → new map of trimmed tests:
//   "return value" x2            → dropped: shape pinned by every cache toEqual
//   early-return x2, no-context x3, no-target x2, attacker-missing x2,
//   target-failure x3, map-edge x4, load-reject x1   → guard it.each table
//   "attacker has no gridX/gridY" → dropped: passed only via unstubbed mock,
//                         not a real contract (see source bugs in audit note)
//   refresh                      → lifecycle test (refresh + retention)
//   useCallback identity x4      → rerender-new-map observable test (#796)
//   fake "timeout" (100ms race)  → real fake-timer test of the 3000ms race

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellPositionResolver } from './useSpellPositionResolver.js';

// ── Mocks (network boundaries only; resolution helpers stay real) ──────────

const mockLoadMapData = vi.fn();
const mockGetCombatContext = vi.fn();

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: (...args) => mockLoadMapData(...args),
}));

vi.mock('../../services/rules/combat/damageUtils.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getCombatContext: (...args) => mockGetCombatContext(...args),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

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

async function resolveWith(setup) {
  if (setup) setup();
  const { result } = renderHook(() =>
    useSpellPositionResolver('TestCampaign', 'TestMap', 'Wizard')
  );
  await act(async () => {
    await result.current.resolvePositions();
  });
  return result;
}

function stubHappyPath() {
  mockLoadMapData.mockResolvedValue([makeMapData()]);
  mockGetCombatContext.mockResolvedValue(makeCombatSummary());
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useSpellPositionResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('caches the full positions object and queries the exact campaign/map', async () => {
    // Target 'Goblin' matches placed items 'Goblin'(3,3) and 'Goblin 2'(8,8);
    // nearest to attacker Wizard(5,5) is Goblin(3,3) — pins attacker forwarding.
    const result = await resolveWith(stubHappyPath);

    expect(mockLoadMapData).toHaveBeenCalledWith('TestCampaign', 'TestMap');
    expect(mockGetCombatContext).toHaveBeenCalledWith('TestCampaign');
    expect(result.current.cachedPosRef.current).toEqual({
      attackerPos: { gridX: 5, gridY: 5 },
      targetPos: { gridX: 3, gridY: 3 },
    });
  });

  it('resolves a player target from the players list', async () => {
    mockLoadMapData.mockResolvedValue([makeMapData()]);
    mockGetCombatContext.mockResolvedValue(makeCombatSummary({
      creatures: [{ name: 'Wizard', targetName: 'Rogue' }, { name: 'Rogue' }],
    }));

    const result = await resolveWith();

    expect(result.current.cachedPosRef.current).toEqual({
      attackerPos: { gridX: 5, gridY: 5 },
      targetPos: { gridX: 10, gridY: 10 },
    });
  });

  it('prefers a player entry over a same-named placed item', async () => {
    mockLoadMapData.mockResolvedValue([makeMapData({
      players: [
        { name: 'Wizard', gridX: 5, gridY: 5 },
        { name: 'Goblin', gridX: 3, gridY: 3 },
      ],
      placedItems: [{ name: 'Goblin', gridX: 99, gridY: 99 }],
    })]);
    mockGetCombatContext.mockResolvedValue(makeCombatSummary());

    const result = await resolveWith();

    expect(result.current.cachedPosRef.current).toEqual({
      attackerPos: { gridX: 5, gridY: 5 },
      targetPos: { gridX: 3, gridY: 3 },
    });
  });

  const guardCases = [
    {
      title: 'mapName is falsy',
      mapName: '',
      check: () => expect(mockLoadMapData).not.toHaveBeenCalled(),
    },
    {
      title: 'no map data comes back',
      setup: () => mockLoadMapData.mockResolvedValue(undefined),
      check: () => expect(mockGetCombatContext).not.toHaveBeenCalled(),
    },
    {
      title: 'the attacker is not on the map',
      setup: () => mockLoadMapData.mockResolvedValue([
        makeMapData({ players: [{ name: 'Rogue', gridX: 10, gridY: 10 }] }),
      ]),
      check: () => expect(mockGetCombatContext).not.toHaveBeenCalled(),
    },
    {
      title: 'there is no combat context',
      setup: () => mockGetCombatContext.mockResolvedValue(null),
    },
    {
      title: 'the attacker has no target in the combat summary',
      setup: () => mockGetCombatContext.mockResolvedValue({ creatures: [{ name: 'Wizard' }] }),
    },
    {
      title: 'the target is nowhere on the map',
      setup: () => mockGetCombatContext.mockResolvedValue(makeCombatSummary({
        creatures: [
          { name: 'Wizard', targetName: 'Mystery Creature' },
          { name: 'Mystery Creature' },
        ],
      })),
    },
    {
      title: 'map loading fails',
      setup: () => mockLoadMapData.mockRejectedValue(new Error('Map not found')),
    },
    {
      title: 'fetching the combat context fails',
      setup: () => mockGetCombatContext.mockRejectedValue(new Error('Context error')),
    },
  ];

  it.each(guardCases)(
    'leaves cachedPosRef untouched when $title',
    async ({ mapName = 'TestMap', setup = () => {}, check = () => {} }) => {
      stubHappyPath();
      setup();

      const { result } = renderHook(() =>
        useSpellPositionResolver('TestCampaign', mapName, 'Wizard')
      );
      await act(async () => { await result.current.resolvePositions(); });

      expect(result.current.cachedPosRef.current).toBeNull();
      check();
    }
  );

  it('refreshes the cache on every resolve and keeps the last good value when a later resolve fails', async () => {
    stubHappyPath();
    mockLoadMapData.mockResolvedValueOnce([makeMapData()]); // consumed first
    const map2 = makeMapData({
      players: [{ name: 'Wizard', gridX: 7, gridY: 7 }],
      placedItems: [{ name: 'Goblin', gridX: 2, gridY: 2 }],
    });

    const { result } = renderHook(() =>
      useSpellPositionResolver('TestCampaign', 'TestMap', 'Wizard')
    );

    await act(async () => { await result.current.resolvePositions(); });
    const first = { attackerPos: { gridX: 5, gridY: 5 }, targetPos: { gridX: 3, gridY: 3 } };
    expect(result.current.cachedPosRef.current).toEqual(first);

    mockGetCombatContext.mockResolvedValueOnce(null); // failed resolve
    await act(async () => { await result.current.resolvePositions(); });
    expect(result.current.cachedPosRef.current).toEqual(first); // retained

    mockLoadMapData.mockResolvedValueOnce([map2]); // map has moved
    await act(async () => { await result.current.resolvePositions(); });
    expect(mockLoadMapData).toHaveBeenCalledTimes(3);
    expect(result.current.cachedPosRef.current).toEqual({
      attackerPos: { gridX: 7, gridY: 7 },
      targetPos: { gridX: 2, gridY: 2 },
    });
  });

  it('resolves against the new map after mapName changes', async () => {
    const mapB = {
      players: [{ name: 'Wizard', gridX: 0, gridY: 0 }],
      placedItems: [{ name: 'Goblin', gridX: 6, gridY: 6 }],
    };
    mockLoadMapData
      .mockResolvedValueOnce([makeMapData()])
      .mockResolvedValueOnce([mapB]);
    mockGetCombatContext.mockResolvedValue(makeCombatSummary());

    const { result, rerender } = renderHook(
      ({ map }) => useSpellPositionResolver('TestCampaign', map, 'Wizard'),
      { initialProps: { map: 'TestMap' } }
    );

    await act(async () => { await result.current.resolvePositions(); });
    expect(result.current.cachedPosRef.current).toEqual({
      attackerPos: { gridX: 5, gridY: 5 },
      targetPos: { gridX: 3, gridY: 3 },
    });

    rerender({ map: 'NewMap' });
    await act(async () => { await result.current.resolvePositions(); });
    expect(mockLoadMapData).toHaveBeenLastCalledWith('TestCampaign', 'NewMap');
    expect(result.current.cachedPosRef.current).toEqual({
      attackerPos: { gridX: 0, gridY: 0 },
      targetPos: { gridX: 6, gridY: 6 },
    });
  });

  it('gives up after its 3-second map-load timeout without caching', async () => {
    vi.useFakeTimers();
    mockLoadMapData.mockImplementation(() => new Promise(() => {})); // hangs
    mockGetCombatContext.mockResolvedValue(makeCombatSummary());

    const { result } = renderHook(() =>
      useSpellPositionResolver('TestCampaign', 'TestMap', 'Wizard')
    );

    let settled = false;
    let pending;
    act(() => {
      pending = result.current.resolvePositions().then(() => { settled = true; });
    });

    await act(async () => { await vi.advanceTimersByTimeAsync(2999); });
    expect(settled).toBe(false); // still waiting before the timeout

    await act(async () => { await vi.advanceTimersByTimeAsync(2); });
    await pending;
    expect(settled).toBe(true); // never hangs past the timeout
    expect(result.current.cachedPosRef.current).toBeNull();
    expect(mockGetCombatContext).not.toHaveBeenCalled();
  });
});
