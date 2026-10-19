// @maintained-by-ai
// useNpcImageCache lane. Transport fake: getMonsterImageUrl is Consumers-exact —
// the hook calls (item.name, null, campaignName) (owner contract: monsterUtils.test.js).
// Honest pins as authored: despite the name, every dependency change re-fetches ALL npc
// items (no cache reuse, no fetch dedupe); map is last-write-wins keyed by item.name;
// null resolutions and unnamed items are stored as-is.
// Old -> new: "only fetch npc types" + "empty list" -> test 1 (empty-list dropped as
// low value: filter over [] is trivial); "url map" + "duplicate names" + "null name" +
// "unknown monsters" -> test 2; reactivity pair -> test 3 (extended with no-reuse pin);
// setNpcImages override -> test 4 (kept).
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useNpcImageCache from './useNpcImageCache.js';

vi.mock('../../../services/npcs/monsterUtils.js', () => ({
  getMonsterImageUrl: vi.fn(),
}));

import { getMonsterImageUrl } from '../../../services/npcs/monsterUtils.js';

const URLS = {
  Goblin: 'https://example.com/goblin.jpg',
  Orc: 'https://example.com/orc.jpg',
};

// Deterministic, order-independent transport fake (no Once-chains).
const resolveImages = (name) => Promise.resolve(URLS[name] ?? null);

describe('useNpcImageCache', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const getHook = (items, campaignName) =>
    renderHook(({ items, campaignName }) => useNpcImageCache(items, campaignName), {
      initialProps: { items, campaignName },
    });

  it('fetches once per npc item with exact transport args and skips non-npc items', async () => {
    getMonsterImageUrl.mockImplementation(resolveImages);

    getHook([
      { type: 'npc', name: 'Goblin' },
      { type: 'token', name: 'Other' },
      { type: 'npc', name: 'Orc' },
    ], 'campaign-a');

    await waitFor(() => expect(getMonsterImageUrl).toHaveBeenCalledTimes(2));
    expect(getMonsterImageUrl).toHaveBeenNthCalledWith(1, 'Goblin', null, 'campaign-a');
    expect(getMonsterImageUrl).toHaveBeenNthCalledWith(2, 'Orc', null, 'campaign-a');
  });

  it('builds the npcImages map keyed by name — duplicates collapse to one key, nulls and unnamed items stored as-is', async () => {
    getMonsterImageUrl.mockImplementation(resolveImages);

    const { result } = getHook([
      { type: 'npc', name: 'Goblin' },
      { type: 'npc', name: 'Orc' },
      { type: 'npc', name: 'Goblin' },
      { type: 'npc' },
    ]);

    await waitFor(() => expect(result.current.npcImages).toEqual({
      Goblin: URLS.Goblin,
      Orc: URLS.Orc,
      undefined: null,
    }));

    // Honest pin: one fetch per placed item — duplicate names re-fetch, no dedupe.
    expect(getMonsterImageUrl).toHaveBeenCalledTimes(4);
    expect(getMonsterImageUrl).toHaveBeenNthCalledWith(3, 'Goblin', null, undefined);
    expect(getMonsterImageUrl).toHaveBeenNthCalledWith(4, undefined, null, undefined);
  });

  it('re-runs when placedItems or campaignName change and re-fetches every npc — nothing is reused', async () => {
    getMonsterImageUrl.mockImplementation(resolveImages);
    const goblin = { type: 'npc', name: 'Goblin' };
    const orc = { type: 'npc', name: 'Orc' };

    const { result, rerender } = getHook([goblin], 'campaign-a');

    await waitFor(() => expect(getMonsterImageUrl).toHaveBeenCalledTimes(1));
    expect(getMonsterImageUrl).toHaveBeenLastCalledWith('Goblin', null, 'campaign-a');

    // Same items, new campaign -> re-fetched with the new campaign name.
    rerender({ items: [goblin], campaignName: 'campaign-b' });

    await waitFor(() => expect(getMonsterImageUrl).toHaveBeenCalledTimes(2));
    expect(getMonsterImageUrl).toHaveBeenLastCalledWith('Goblin', null, 'campaign-b');

    // New items list -> ALL npcs re-fetched, including already-resolved Goblin.
    rerender({ items: [goblin, orc], campaignName: 'campaign-b' });

    // Anchor on STATE (both bytes adopted in one Promise.all flush), not fetch count —
    // calls are issued synchronously in the effect, so count 4 lands before the map
    // updates under parallel load. Call-count pins after settle stay exact (4, no more):
    // deps are stable references, so no further effect runs follow this one.
    await waitFor(() => expect(result.current.npcImages).toEqual({ Goblin: URLS.Goblin, Orc: URLS.Orc }));
    expect(getMonsterImageUrl).toHaveBeenCalledTimes(4);
    expect(getMonsterImageUrl).toHaveBeenLastCalledWith('Orc', null, 'campaign-b');
  });

  it('exposes setNpcImages so callers can override the map', () => {
    const { result } = getHook([], undefined);

    expect(result.current.npcImages).toEqual({});

    act(() => {
      result.current.setNpcImages({ Goblin: 'https://example.com/custom.jpg' });
    });

    expect(result.current.npcImages).toEqual({ Goblin: 'https://example.com/custom.jpg' });
  });
});
