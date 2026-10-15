// @maintained-by-ai
// Deterministic contract tests for the pure isPolearmWeapon utility:
// hardcoded weapon names, Heavy+Reach property detection, fetch caching,
// and error handling. Only touch these if the polearm detection contract
// in ./polearmUtils.js changes.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function createMockResponse(json) {
  return new Response(JSON.stringify(json), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const glaiveData = [
  { name: 'Glaive', properties: ['Heavy', 'Reach', 'Two-Handed'] },
  { name: 'Halberd', properties: ['Heavy', 'Reach', 'Two-Handed'] },
  { name: 'Pike', properties: ['Heavy', 'Reach', 'Two-Handed'] },
];

const mixedWeaponsData = [
  { name: 'Longsword', properties: ['Versatile'] },
  { name: 'Greatsword', properties: ['Heavy', 'Two-Handed'] },
  { name: 'Whip', properties: ['Reach'] },
  { name: 'Mace', properties: [] },
];

describe('isPolearmWeapon', () => {
  let isPolearmWeapon;

  // Fresh module per test so the module-level equipment cache never leaks
  // between tests that mock fetch with different payloads.
  beforeEach(async () => {
    global.fetch = vi.fn();
    vi.resetModules();
    ({ isPolearmWeapon } = await import('./polearmUtils.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hardcoded weapons', () => {
    it.each(['Quarterstaff', 'Spear'])(
      'returns true for %s without fetching',
      async (name) => {
        expect(await isPolearmWeapon(name)).toBe(true);
        expect(global.fetch).not.toHaveBeenCalled();
      }
    );

    it.each([null, undefined, ''])(
      'returns false for falsy weapon name %p without fetching',
      async (name) => {
        expect(await isPolearmWeapon(name)).toBe(false);
        expect(global.fetch).not.toHaveBeenCalled();
      }
    );
  });

  describe('equipment data lookup', () => {
    it.each(['Glaive', 'Halberd', 'Pike'])(
      'returns true for Heavy + Reach weapon %s',
      async (name) => {
        global.fetch.mockResolvedValue(createMockResponse(glaiveData));
        expect(await isPolearmWeapon(name)).toBe(true);
      }
    );

    it('returns false for weapon with only Heavy property', async () => {
      global.fetch.mockResolvedValue(createMockResponse(mixedWeaponsData));
      expect(await isPolearmWeapon('Greatsword')).toBe(false);
    });

    it('returns false for weapon with only Reach property', async () => {
      global.fetch.mockResolvedValue(createMockResponse(mixedWeaponsData));
      expect(await isPolearmWeapon('Whip')).toBe(false);
    });

    it.each(['Longsword', 'Mace'])(
      'returns false for weapon with neither Heavy nor Reach (%s)',
      async (name) => {
        global.fetch.mockResolvedValue(createMockResponse(mixedWeaponsData));
        expect(await isPolearmWeapon(name)).toBe(false);
      }
    );

    it('treats weapons without a properties array as not polearms', async () => {
      global.fetch.mockResolvedValue(createMockResponse([{ name: 'Strange Weapon' }]));
      expect(await isPolearmWeapon('Strange Weapon')).toBe(false);
    });

    it('returns false for weapons not found in equipment data', async () => {
      global.fetch.mockResolvedValue(createMockResponse(mixedWeaponsData));
      expect(await isPolearmWeapon('FantasySword')).toBe(false);
    });
  });

  describe('equipment data fetching', () => {
    it('fetches /data/equipment.json for unknown weapons', async () => {
      global.fetch.mockResolvedValue(createMockResponse([]));
      await isPolearmWeapon('UnknownWeapon');
      expect(global.fetch).toHaveBeenCalledWith('/data/equipment.json');
    });

    it('caches equipment data — one fetch across multiple lookups', async () => {
      global.fetch.mockResolvedValue(createMockResponse(glaiveData));
      expect(await isPolearmWeapon('Glaive')).toBe(true);
      expect(await isPolearmWeapon('Halberd')).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('caches an empty fetch result instead of refetching', async () => {
      global.fetch.mockResolvedValue(createMockResponse([]));
      expect(await isPolearmWeapon('Glaive')).toBe(false);
      expect(await isPolearmWeapon('Halberd')).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('returns false and caches when fetch fails', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));
      expect(await isPolearmWeapon('Glaive')).toBe(false);
      expect(await isPolearmWeapon('Glaive')).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
