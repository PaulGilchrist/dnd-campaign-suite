// @maintained-by-ai
// Regression: bug-eb-join-swallowed-network-fail-phantom-row — READ side.
// loadCombatSummary conflated "fetch failed" with "no combat" (always null),
// so addMonstersToInitiative normalized a possibly-live board to
// { round: 1, creatures: [] } after a GET blip; a then-successful POST would
// silently REPLACE the live initiative board for every player. New contract:
// { strict: true } (the EB Join lane) THROWS on transport failure — network
// rejection or not-ok HTTP — while an ok response with an absent key still
// resolves null (key absence is NOT a failure). Lenient default bytes are
// unchanged (failure-trio pin lives in sibling combatData.test.js). Helpers
// mirror that sibling exactly.

import { describe, it, expect, vi, afterEach } from 'vitest';
import * as combatData from './combatData.js';

const CAMPAIGN = 'test-campaign';

function stubFetch(payload, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue(
    ok
      ? { ok: true, status: 200, statusText: 'OK', json: async () => ({ combatSummary: payload }) }
      : { ok: false, status: 500, statusText: 'Internal Server Error', json: async () => ({}) }
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function stubFetchReject() {
  const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('loadCombatSummary strict read (EB Join lane)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    combatData.setCombatSummaryCache(null, CAMPAIGN);
  });

  it.each([
    ['fetch rejects', () => stubFetchReject()],
    ['HTTP 500', () => stubFetch(null, false)],
  ])('%s throws instead of reading as "no combat", cache untouched', async (_label, stub) => {
    const previous = { round: 2, creatures: [{ name: 'Goblin', type: 'npc' }] };
    combatData.setCombatSummaryCache(previous, CAMPAIGN);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stub();

    await expect(
      combatData.loadCombatSummary(CAMPAIGN, { strict: true })
    ).rejects.toThrow();

    expect(combatData.getCombatSummary(CAMPAIGN)).toBe(previous);
    expect(errorSpy).toHaveBeenCalled(); // failure stays loudly logged
  });

  it('ok response with absent combatSummary still resolves null — key absence is NOT a failure', async () => {
    stubFetch(null);
    await expect(
      combatData.loadCombatSummary(CAMPAIGN, { strict: true })
    ).resolves.toBeNull();
  });

  it('strict success hands back the live board and caches it', async () => {
    stubFetch({ round: 4, creatures: [{ name: 'Goblin', type: 'npc' }] });
    const result = await combatData.loadCombatSummary(CAMPAIGN, { strict: true });
    expect(result.round).toBe(4);
    expect(combatData.getCombatSummary(CAMPAIGN)).toBe(result);
  });

  it('lenient default keeps the historical null-degradation unchanged', async () => {
    stubFetchReject();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(combatData.loadCombatSummary(CAMPAIGN)).resolves.toBeNull();
  });
});
