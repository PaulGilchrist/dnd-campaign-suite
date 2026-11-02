// @maintained-by-ai
// Starter-seed client lane: GET unwraps { seed } → value-or-null; PUT sends the
// { seed } envelope the route expects and surfaces server error text.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadStarterSeed, saveStarterSeed } from './starterSeedService.js';

const CAMPAIGN = 'qa-starter';
const URL = `/api/campaigns/${CAMPAIGN}/starter-seed`;

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('loadStarterSeed', () => {
  it('returns the seed document when present', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ seed: { version: 1, seed: 3 } }));
    await expect(loadStarterSeed(CAMPAIGN)).resolves.toEqual({ version: 1, seed: 3 });
    expect(fetchMock).toHaveBeenCalledWith(URL);
  });

  it('returns null for a regular campaign (seed:null answer)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ seed: null }));
    await expect(loadStarterSeed(CAMPAIGN)).resolves.toBeNull();
  });

  it('throws the server error on failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'boom' }, false, 500));
    await expect(loadStarterSeed(CAMPAIGN)).rejects.toThrow('boom');
  });
});

describe('saveStarterSeed', () => {
  it('PUTs the { seed } envelope', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'ok' }));
    await saveStarterSeed(CAMPAIGN, { version: 1 });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(URL);
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body)).toEqual({ seed: { version: 1 } });
  });

  it('throws the server error text (e.g. the GM-only 403)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Only the GM (localhost) can write the starter seed' }, false, 403));
    await expect(saveStarterSeed(CAMPAIGN, {})).rejects.toThrow(/Only the GM/);
  });
});
