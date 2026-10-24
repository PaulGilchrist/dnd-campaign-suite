// @maintained-by-ai: 2026-10-24
/* Lane: server-side oEmbed title resolution for music overrides (backlog
 * 2026-10-24 — editor stores title = raw video ID; save path must enrich to
 * readable titles, with graceful raw-ID fallback that never blocks the save).
 * global fetch is mocked throughout — no real YouTube calls in tests. */
import { fetchVideoTitle, resolveOverrideTitles } from './resolveTrackTitles.js';

const okResponse = (title) => ({ ok: true, status: 200, json: async () => ({ title }) });
const failResponse = (status = 500) => ({ ok: false, status, json: async () => ({}) });
const timeoutError = () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });

let fetchMock;
let consoleError;

beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('fetchVideoTitle', () => {
    it('builds the oEmbed URL for the video id and returns the trimmed title', async () => {
        fetchMock.mockResolvedValue(okResponse('  Medieval Tavern Ambience  '));
        const title = await fetchVideoTitle('vyg5jJrZ42s');

        expect(title).toBe('Medieval Tavern Ambience');
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dvyg5jJrZ42s&format=json');
        expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('throws on non-200 so the caller falls back', async () => {
        fetchMock.mockResolvedValue(failResponse(404));
        await expect(fetchVideoTitle('vyg5jJrZ42s')).rejects.toThrow(/404/);
    });

    it('throws on a 200 response with no usable title', async () => {
        fetchMock.mockResolvedValue(okResponse('   '));
        await expect(fetchVideoTitle('vyg5jJrZ42s')).rejects.toThrow(/no title/);
    });

    it('propagates network/timeout rejection (AbortError, TimeoutError, …)', async () => {
        fetchMock.mockRejectedValue(timeoutError());
        await expect(fetchVideoTitle('vyg5jJrZ42s')).rejects.toThrow(/timeout/i);
    });
});

describe('resolveOverrideTitles', () => {
    it('resolves raw-ID titles into human-readable stored overrides', async () => {
        fetchMock.mockImplementation(async (url) => (
            url.includes('vyg5jJrZ42s') ? okResponse('Medieval Fantasy Tavern') : okResponse('Tavern Ambience')
        ));
        const resolved = await resolveOverrideTitles({
            tavern: [
                { videoId: 'vyg5jJrZ42s', title: 'vyg5jJrZ42s' },
                { videoId: '2P8J7Cx1plA', title: '2P8J7Cx1plA' }
            ]
        });

        expect(resolved.tavern).toEqual([
            { videoId: 'vyg5jJrZ42s', title: 'Medieval Fantasy Tavern' },
            { videoId: '2P8J7Cx1plA', title: 'Tavern Ambience' }
        ]);
        expect(consoleError).not.toHaveBeenCalled();
    });

    it('keeps the raw ID as fallback when oEmbed times out — never rejects, logs the failure', async () => {
        fetchMock.mockRejectedValue(timeoutError());
        const resolved = await resolveOverrideTitles({
            outdoors: [{ videoId: '6Em9tLXbhfo', title: '6Em9tLXbhfo' }]
        });

        expect(resolved.outdoors).toEqual([{ videoId: '6Em9tLXbhfo', title: '6Em9tLXbhfo' }]);
        expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('6Em9tLXbhfo'), expect.anything());
    });

    it('keeps the raw ID as fallback on a non-200 oEmbed response', async () => {
        fetchMock.mockResolvedValue(failResponse(401));
        const resolved = await resolveOverrideTitles({
            dungeon: [{ videoId: 'bxoRRobHtGM', title: 'bxoRRobHtGM' }]
        });

        expect(resolved.dungeon).toEqual([{ videoId: 'bxoRRobHtGM', title: 'bxoRRobHtGM' }]);
        expect(consoleError).toHaveBeenCalledTimes(1);
    });

    it('mixed batch: good video resolves, bad video keeps its ID, save data is complete', async () => {
        fetchMock.mockImplementation(async (url) => {
            if (url.includes('vyg5jJrZ42s')) return okResponse('Medieval Fantasy Tavern');
            if (url.includes('aAAAAAAAAAA')) throw timeoutError();
            return failResponse(404);
        });
        const resolved = await resolveOverrideTitles({
            tavern: [
                { videoId: 'vyg5jJrZ42s', title: 'vyg5jJrZ42s' },
                { videoId: 'aAAAAAAAAAA', title: 'aAAAAAAAAAA' },
                { videoId: 'bBBBBBBBBBB', title: 'bBBBBBBBBBB' }
            ]
        });

        expect(resolved.tavern).toEqual([
            { videoId: 'vyg5jJrZ42s', title: 'Medieval Fantasy Tavern' },
            { videoId: 'aAAAAAAAAAA', title: 'aAAAAAAAAAA' }, // timeout → fallback
            { videoId: 'bBBBBBBBBBB', title: 'bBBBBBBBBBB' }  // 404   → fallback
        ]);
        expect(consoleError).toHaveBeenCalledTimes(2); // one per failed video, no silent swallow
    });

    it('fetches every unique videoId once, in parallel', async () => {
        let inflight = 0;
        let maxInflight = 0;
        fetchMock.mockImplementation(async () => {
            inflight++;
            maxInflight = Math.max(maxInflight, inflight);
            await Promise.resolve();
            inflight--;
            return okResponse('Whatever');
        });
        await resolveOverrideTitles({
            town: [{ videoId: 'q9yaKpYS9qc', title: 'q9yaKpYS9qc' }, { videoId: 'q9yaKpYS9qc', title: 'q9yaKpYS9qc' }],
            outdoors: [{ videoId: '6Em9tLXbhfo', title: '6Em9tLXbhfo' }]
        });

        expect(fetchMock).toHaveBeenCalledTimes(2); // 3 rows, 2 unique ids
        expect(maxInflight).toBe(2);              // both lookups run concurrently
    });

    it('stampede guard: a videoId already resolved in stored overrides is reused without re-fetch', async () => {
        const stored = { tavern: [{ videoId: 'vyg5jJrZ42s', title: 'Medieval Fantasy Tavern (Daydreaming of Persephone)' }] };
        const resolved = await resolveOverrideTitles(
            { tavern: [{ videoId: 'vyg5jJrZ42s', title: 'vyg5jJrZ42s' }] }, // editor re-stamped raw ID
            stored
        );

        expect(fetchMock).not.toHaveBeenCalled();
        expect(resolved.tavern).toEqual([stored.tavern[0]]);
    });

    it('trusts a real title supplied by the client — no fetch', async () => {
        const resolved = await resolveOverrideTitles({
            tavern: [{ videoId: 'vyg5jJrZ42s', title: 'Client Known Title' }]
        });

        expect(fetchMock).not.toHaveBeenCalled();
        expect(resolved.tavern).toEqual([{ videoId: 'vyg5jJrZ42s', title: 'Client Known Title' }]);
    });

    it('passes through malformed payloads untouched', async () => {
        expect(await resolveOverrideTitles(null)).toBeNull();
        expect(await resolveOverrideTitles('nope')).toBe('nope');

        const resolved = await resolveOverrideTitles({
            town: 'not-an-array',
            tavern: [{ title: 'no videoId here' }]
        });
        expect(fetchMock).not.toHaveBeenCalled();
        expect(resolved).toEqual({ town: 'not-an-array', tavern: [{ title: 'no videoId here' }] });
    });
});
