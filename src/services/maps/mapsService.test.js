import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadMapData,
  updateMapDescription,
  formatMapName,
  toKebabCase,
} from './mapsService';

// ─── fetch mock helpers ────────────────────────────────────────────────

function mockFetch(ok, body) {
  return vi.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    json: async () => body,
  });
}

function mockFetchError(errorMsg = 'API error') {
  return vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: false,
    json: async () => ({ error: errorMsg }),
  });
}

function mockFetchNetworkError() {
  return vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network'));
}

// ─── console.error suppression ────────────────────────────────────────
let consoleSpy;
beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  consoleSpy.mockRestore();
  vi.restoreAllMocks();
});

// ════════════════════════════════════════════════════════════════════════
// formatMapName — lines 166-173 (currently uncovered)
// ════════════════════════════════════════════════════════════════════════

describe('formatMapName', () => {
  it('returns empty string for null input', () => {
    expect(formatMapName(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(formatMapName(undefined)).toBe('');
  });

  it('returns empty string for empty string input', () => {
    expect(formatMapName('')).toBe('');
  });

  it('converts kebab-case to Title Case', () => {
    expect(formatMapName('dungeon-hall')).toBe('Dungeon Hall');
  });

  it('strips .json suffix before formatting', () => {
    expect(formatMapName('treasure-room.json')).toBe('Treasure Room');
  });

  it('handles single word without dashes', () => {
    expect(formatMapName('entrance')).toBe('Entrance');
  });

  it('capitalizes each segment', () => {
    expect(formatMapName('long-dark-corridor')).toBe('Long Dark Corridor');
  });

  it('handles mixed case input (lowercases then uppercases first char)', () => {
    expect(formatMapName('Dark-Hall')).toBe('Dark Hall');
  });
});

// ════════════════════════════════════════════════════════════════════════
// toKebabCase — used by loadMapData, updateMapDescription (exported)
// ═════════════════════════════════════odash──────────────────────────────

describe('toKebabCase', () => {
  it('converts spaces to dashes', () => {
    expect(toKebabCase('Dungeon Hall')).toBe('dungeon-hall');
  });

  it('strips .json suffix', () => {
    expect(toKebabCase('Treasure Room.json')).toBe('treasure-room');
  });

  it('removes special characters', () => {
    expect(toKebabCase('Room #1 (Main)')).toBe('room-1-main');
  });

  it('lowercases everything', () => {
    expect(toKebabCase('UPPER CASE')).toBe('upper-case');
  });
});

// ═════════════════════════════════─────────────────────────────────────
// loadMapData — success path (already covered elsewhere? testing fail here)
// Uncovered lines: 140-143 (catch block with console.error + throw)
// ════════════════════════════════════════════════════════════════════════

describe('loadMapData', () => {
  const campaign = 'my-campaign';
  const mapName = 'Dungeon Hall';

  it('returns map data on successful GET', async () => {
    const fetchData = mockFetch(true, { id: 'dungeon-hall', type: 'indoor' });
    const result = await loadMapData(campaign, mapName);
    expect(result).toEqual({ id: 'dungeon-hall', type: 'indoor' });
    expect(fetchData).toHaveBeenCalledWith(
      `/api/campaigns/${encodeURIComponent(campaign)}/maps/dungeon-hall`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
  });

  // Lines 140-143: catch block with console.error + throw (error response path)
  it('throws error on non-ok response and logs to console', async () => {
    const errMsg = 'Map not found';
    mockFetchError(errMsg);

    await expect(loadMapData(campaign, mapName)).rejects.toThrow(errMsg);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error loading map data:',
      expect.any(Error),
    );
  });

  // Lines 140-143: catch block — network error path
  it('throws on network failure and logs to console', async () => {
    mockFetchNetworkError();
    await expect(loadMapData(campaign, mapName)).rejects.toThrow('network');
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error loading map data:',
      expect.any(Error),
    );
  });

  it('encodes campaign name in URL', async () => {
    const fetchData = mockFetch(true, {});
    await loadMapData('My Campaign?', 'Test Map');
    expect(fetchData).toHaveBeenLastCalledWith(
        '/api/campaigns/My%20Campaign%3F/maps/test-map',
      expect.any(Object),
      );
    });
  });

// ═════════════─────────────────────────────────────────────────────────
// updateMapDescription — lines 146-163 (currently uncovered)
// ════════════════════════════════════════════════════════════════════════

describe('updateMapDescription', () => {
  const campaign = 'my-campaign';
  const mapName = 'Dungeon Hall';

  it('sends PUT request with description payload on success', async () => {
    const desc = 'A dark and dusty corridor.';
    const responseData = { name: 'dungeon-hall', description: desc };
    const fetchData = mockFetch(true, responseData);

    const result = await updateMapDescription(campaign, mapName, desc);
    expect(result).toEqual(responseData);
    expect(fetchData).toHaveBeenCalledWith(
      `/api/campaigns/${encodeURIComponent(campaign)}/maps/dungeon-hall/description`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc }),
      },
    );
  });

  it('throws and logs on non-ok response', async () => {
    const errMsg = 'Failed to update description';
    mockFetchError(errMsg);

    await expect(
      updateMapDescription(campaign, mapName, 'new desc'),
    ).rejects.toThrow(errMsg);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error updating map description:',
      expect.any(Error),
    );
  });

  it('throws custom error message when server returns one', async () => {
    const errMsg = 'Map not found';
    mockFetchError(errMsg);

    await expect(
      updateMapDescription(campaign, mapName, ''),
    ).rejects.toThrow(errMsg);
  });

  it('encodes campaign and map name in URL', async () => {
    const fetchData = mockFetch(true, {});
    await updateMapDescription('Adventure Map', 'Grand Hall', 'test');
    expect(fetchData).toHaveBeenLastCalledWith(
      '/api/campaigns/Adventure%20Map/maps/grand-hall/description',
      expect.any(Object),
    );
  });

  it('uses default error message when server body has no error field', async () => {
    const fetchData = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    await expect(
      updateMapDescription(campaign, mapName, 'desc'),
    ).rejects.toThrow('Failed to update map description');
    expect(fetchData).toHaveBeenCalled();
  });

  it('throws and logs on network failure', async () => {
    mockFetchNetworkError();

    await expect(
      updateMapDescription(campaign, mapName, 'desc'),
    ).rejects.toThrow('network');
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error updating map description:',
      expect.any(Error),
    );
  });

  it('handles empty description', async () => {
    const fetchData = mockFetch(true, { description: '' });
    await updateMapDescription(campaign, mapName, '');
    expect(fetchData).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ description: '' }),
      }),
    );
  });
});
