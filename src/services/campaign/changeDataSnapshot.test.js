// @maintained-by-ai
/**
 * Lane: shared in-flight change-data reads — src/services/campaign/
 * changeDataSnapshot.js (backlog 2026-11-22 SV: the mount seam fired four
 * near-simultaneous GETs of the SAME snapshot per campaign entry).
 *
 * Laws pinned here:
 *  - concurrent readers share ONE physical GET (single-flight per campaign);
 *  - the in-flight slot clears on settle — a later SEQUENTIAL load still
 *    fetches fresh (no stale-data law, no timers);
 *  - a rejected shared promise rejects EVERY waiter, and the strict EB-join
 *    rethrow survives dedupe while the lenient lane keeps null-as-no-combat;
 *  - an ENTER seam (begin → adopt) collapses hydrate + seed + preload onto one
 *    GET: late adopters await the settled promise (zero re-fetch) and receive
 *    isolated clones (the old four-independent-parses graph stays per-lane);
 *  - a re-select begins a FRESH read — the adopt-and-evict "re-select re-reads
 *    server truth" law never serves the previous seam's bytes.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchCampaignChangeData,
  beginCampaignChangeDataEntry,
  readCampaignChangeData,
  abandonCampaignChangeDataEntry,
} from './changeDataSnapshot.js';

// damageUtils (pulled in by combatData) transitively loads these — stub them
// so the suite never touches rule JSON.
vi.mock('../ui/dataLoader.js', () => ({ loadEquipment: vi.fn() }));
vi.mock('../rules/core/attackCalc.js', () => ({ parseMagicItemName: vi.fn() }));

import * as combatData from '../encounters/combatData.js';

const snapshot = (round) => ({
  combatSummary: { round, creatures: [{ name: 'Thorndeer', currentHp: 27 }] },
  aiConfig: { mode: 'off' },
});

function okResponse(payload) {
  return { ok: true, status: 200, statusText: 'OK', json: async () => payload };
}

function stubOk(payload) {
  const fetchMock = vi.fn().mockResolvedValue(okResponse(payload));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  combatData.setCombatSummaryCache(null, 'strict-dedupe');
});

describe('changeDataSnapshot single-flight', () => {
  it('concurrent mount-seam readers share ONE GET on the encoded change-data URL', async () => {
    const fetchMock = stubOk(snapshot(3));
    const [a, b] = await Promise.all([
      fetchCampaignChangeData('My Campaign'),
      fetchCampaignChangeData('My Campaign'),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/campaigns/My%20Campaign/change-data');
    expect(a).toBe(b); // same shared snapshot reference
  });

  it('a settled slot refetches for a later sequential load (no stale-data law)', async () => {
    const fetchMock = stubOk(snapshot(3));
    await fetchCampaignChangeData('seq-campaign');
    await fetchCampaignChangeData('seq-campaign');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a rejected shared promise rejects every waiter, and the slot clears after settle', async () => {
    const boom = new TypeError('Failed to fetch');
    const fetchMock = vi.fn().mockRejectedValue(boom);
    vi.stubGlobal('fetch', fetchMock);
    const results = await Promise.allSettled([
      fetchCampaignChangeData('reject-campaign'),
      fetchCampaignChangeData('reject-campaign'),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    expect(results[0].reason).toBe(boom);
    expect(results[1].reason).toBe(boom);
    // Genuinely later load: fresh fetch, fresh success.
    fetchMock.mockResolvedValue(okResponse(snapshot(1)));
    await expect(fetchCampaignChangeData('reject-campaign')).resolves.toEqual(snapshot(1));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('not-ok rejects with the strict-lane message plus changeDataStatus metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      { ok: false, status: 500, statusText: 'Server Error', json: async () => ({}) }
    ));
    const err = await fetchCampaignChangeData('notok-campaign').catch((e) => e);
    expect(err.message).toBe('change-data fetch failed (500) for notok-campaign');
    expect(err.changeDataStatus).toBe(500);
    expect(err.changeDataStatusText).toBe('Server Error');
  });

  it('an enter seam collapses late adopters onto the begun GET with isolated clones', async () => {
    const seamFetch = stubOk(snapshot(3));
    const canonical = await beginCampaignChangeDataEntry('enter-campaign');
    expect(seamFetch).toHaveBeenCalledTimes(1);
    // Server truth MOVES after the seam GET — later seam reads must still
    // adopt the entry snapshot (zero re-fetch), never the fresher bytes twice.
    const movedFetch = stubOk(snapshot(99));

    const first = await readCampaignChangeData('enter-campaign');
    const second = await readCampaignChangeData('enter-campaign');
    expect(movedFetch).not.toHaveBeenCalled();
    expect(first).toEqual(canonical);
    expect(first).not.toBe(canonical); // private graph, like the old separate parses
    expect(first).not.toBe(second);

    first.combatSummary.round = 42; // mutating an adopter must not poison the seam
    const third = await readCampaignChangeData('enter-campaign');
    expect(third.combatSummary.round).toBe(canonical.combatSummary.round);
  });

  it('a re-select begins a FRESH entry read — never the previous seam bytes', async () => {
    const firstFetch = stubOk(snapshot(3));
    await beginCampaignChangeDataEntry('reselect-campaign');
    expect(await readCampaignChangeData('reselect-campaign')).toEqual(snapshot(3));

    stubOk(snapshot(7)); // admin cleared + re-armed server-side between seams
    await beginCampaignChangeDataEntry('reselect-campaign');
    expect(firstFetch).toHaveBeenCalledTimes(1);
    expect(await readCampaignChangeData('reselect-campaign')).toEqual(snapshot(7));
  });

  it('a read without a begun entry read still single-flights', async () => {
    const fetchMock = stubOk(snapshot(2));
    const [a, b] = await Promise.all([
      readCampaignChangeData('plain-campaign'),
      readCampaignChangeData('plain-campaign'),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a).not.toBe(b); // clone-per-reader isolation applies to every read lane
  });
});

describe('strict EB-join lane survives dedupe', () => {
  it('a shared rejected GET rejects the strict waiter while the lenient load still reads null', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(
      { ok: false, status: 500, statusText: 'Internal Server Error', json: async () => ({}) }
    );
    vi.stubGlobal('fetch', fetchMock);

    const [strict, lenient] = await Promise.allSettled([
      combatData.loadCombatSummary('strict-dedupe', { strict: true }),
      combatData.loadCombatSummary('strict-dedupe'),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1); // ONE physical GET for both lanes
    expect(strict.status).toBe('rejected');
    expect(strict.reason.message).toBe('change-data fetch failed (500) for strict-dedupe');
    expect(lenient.status).toBe('fulfilled');
    expect(lenient.value).toBeNull(); // lenient bytes unchanged
    expect(errorSpy).toHaveBeenCalled(); // failure stays loudly logged
  });
});

describe('enter-seam stall escape (backlog TT 2026-11-22)', () => {
  /** Fetch that hangs until its abort signal fires (a captive proxy). */
  function stubHangingFetch() {
    const fetchMock = vi.fn((url, opts = {}) => new Promise((resolve, reject) => {
      const settled = { resolve, reject };
      fetchMock.settles.push({ url, opts, settled });
      opts.signal?.addEventListener('abort', () => reject(opts.signal.reason));
    }));
    fetchMock.settles = [];
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('the enter read carries an abort signal; plain reads keep the un-signalled call', async () => {
    const seamFetch = stubHangingFetch();
    const entry = beginCampaignChangeDataEntry('signal-campaign');
    expect(seamFetch).toHaveBeenCalledWith(
      '/api/campaigns/signal-campaign/change-data',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    fetchCampaignChangeData('plain-campaign');
    expect(seamFetch).toHaveBeenLastCalledWith('/api/campaigns/plain-campaign/change-data');
    // Release the harness' hung sockets.
    abandonCampaignChangeDataEntry('signal-campaign');
    seamFetch.settles[1].settled.resolve(okResponse(snapshot(1)));
    await expect(entry).rejects.toThrow();
  });

  it('abandoning a stalled enter read rejects every joiner and frees the slot for a FRESH GET', async () => {
    const hungFetch = stubHangingFetch();
    const entry = beginCampaignChangeDataEntry('stalled-campaign');
    const joiner = combatData.loadCombatSummary('stalled-campaign', { strict: true });
    const adopter = readCampaignChangeData('stalled-campaign').catch(() => null);

    const results = Promise.allSettled([entry, joiner]);
    abandonCampaignChangeDataEntry('stalled-campaign');
    const settled = await results;

    // Stall escape reaches EVERY waiter on the one shared read…
    expect(settled.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    expect(hungFetch).toHaveBeenCalledTimes(1); // …from ONE physical GET, not a fan-out
    // …and the seam adopter keeps its historical null-on-failure contract.
    expect(await adopter).toBeNull();

    // Retry law: the slot cleared on the aborted settle, so the NEXT begin
    // physically re-fetches instead of re-joining the dead socket.
    const retryFetch = stubOk(snapshot(4));
    await expect(beginCampaignChangeDataEntry('stalled-campaign')).resolves.toEqual(snapshot(4));
    expect(retryFetch).toHaveBeenCalledTimes(1);
  });

  it('abandon is a no-op after the read settled — a live plain read stays un-aborted', async () => {
    const fetchMock = stubOk(snapshot(2));
    await beginCampaignChangeDataEntry('settled-campaign');
    expect(() => abandonCampaignChangeDataEntry('settled-campaign')).not.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A plain in-flight read has no enter abort: abandon cannot kill it.
    const liveFetch = stubHangingFetch();
    const live = fetchCampaignChangeData('plain-live-campaign');
    expect(() => abandonCampaignChangeDataEntry('plain-live-campaign')).not.toThrow();
    expect(liveFetch.settles).toHaveLength(1); // still in flight, un-aborted
    liveFetch.settles[0].settled.resolve(okResponse(snapshot(1)));
    await expect(live).resolves.toEqual(snapshot(1));
  });
});
