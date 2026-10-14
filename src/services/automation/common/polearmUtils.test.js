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

// Hardcoded weapon tests don't need fetch — no resetModules needed
describe('isPolearmWeapon (hardcoded weapons)', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true for Quarterstaff', async () => {
    const { isPolearmWeapon } = await import('./polearmUtils.js');
    const result = await isPolearmWeapon('Quarterstaff');
    expect(result).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns true for Spear', async () => {
    const { isPolearmWeapon } = await import('./polearmUtils.js');
    const result = await isPolearmWeapon('Spear');
    expect(result).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not call fetch for hardcoded weapons', async () => {
    global.fetch.mockResolvedValue(createMockResponse(glaiveData));
    const { isPolearmWeapon } = await import('./polearmUtils.js');

    await isPolearmWeapon('Quarterstaff');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns false for null weapon name', async () => {
    const { isPolearmWeapon } = await import('./polearmUtils.js');
    const result = await isPolearmWeapon(null);
    expect(result).toBe(false);
  });

  it('returns false for undefined weapon name', async () => {
    const { isPolearmWeapon } = await import('./polearmUtils.js');
    const result = await isPolearmWeapon(undefined);
    expect(result).toBe(false);
  });

  it('returns false for empty string weapon name', async () => {
    const { isPolearmWeapon } = await import('./polearmUtils.js');
    const result = await isPolearmWeapon('');
    expect(result).toBe(false);
  });
});

// Equipment-data-based tests need fetch mocking + module reset
describe('isPolearmWeapon (equipment data)', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true for weapons with Heavy and Reach properties (Glaive)', async () => {
    global.fetch.mockResolvedValue(createMockResponse(glaiveData));
    const { isPolearmWeapon } = await import('./polearmUtils.js');

    const result = await isPolearmWeapon('Glaive');
    expect(result).toBe(true);
  });

  it('returns true for weapons with Heavy and Reach properties (Halberd)', async () => {
    global.fetch.mockResolvedValue(createMockResponse(glaiveData));
    const { isPolearmWeapon } = await import('./polearmUtils.js');

    const result = await isPolearmWeapon('Halberd');
    expect(result).toBe(true);
  });

  it('returns true for weapons with Heavy and Reach properties (Pike)', async () => {
    global.fetch.mockResolvedValue(createMockResponse(glaiveData));
    const { isPolearmWeapon } = await import('./polearmUtils.js');

    const result = await isPolearmWeapon('Pike');
    expect(result).toBe(true);
  });

  it('returns false for weapons with only Heavy property', async () => {
    global.fetch.mockResolvedValue(createMockResponse(mixedWeaponsData));
    const { isPolearmWeapon } = await import('./polearmUtils.js');

    const result = await isPolearmWeapon('Greatsword');
    expect(result).toBe(false);
  });

  it('returns false for weapons with only Reach property', async () => {
    global.fetch.mockResolvedValue(createMockResponse(mixedWeaponsData));
    const { isPolearmWeapon } = await import('./polearmUtils.js');

    const result = await isPolearmWeapon('Whip');
    expect(result).toBe(false);
  });

  it('returns false for weapons with neither Heavy nor Reach', async () => {
    global.fetch.mockResolvedValue(createMockResponse(mixedWeaponsData));
    const { isPolearmWeapon } = await import('./polearmUtils.js');

    const result = await isPolearmWeapon('Longsword');
    expect(result).toBe(false);
  });

  it('returns false for weapons with empty properties', async () => {
    global.fetch.mockResolvedValue(createMockResponse(mixedWeaponsData));
    const { isPolearmWeapon } = await import('./polearmUtils.js');

    const result = await isPolearmWeapon('Mace');
    expect(result).toBe(false);
  });

  it('returns false for weapons not found in equipment data', async () => {
    global.fetch.mockResolvedValue(createMockResponse(mixedWeaponsData));
    const { isPolearmWeapon } = await import('./polearmUtils.js');

    const result = await isPolearmWeapon('FantasySword');
    expect(result).toBe(false);
  });

  it('fetches equipment data for unknown weapons', async () => {
    global.fetch.mockResolvedValue(createMockResponse([]));
    const { isPolearmWeapon } = await import('./polearmUtils.js');

    await isPolearmWeapon('UnknownWeapon');
    expect(global.fetch).toHaveBeenCalledWith('/data/equipment.json');
  });

  it('caches equipment data on first fetch', async () => {
    global.fetch.mockResolvedValue(createMockResponse(glaiveData));
    const { isPolearmWeapon } = await import('./polearmUtils.js');

    await isPolearmWeapon('Glaive');
    await isPolearmWeapon('Halberd');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('handles fetch failure by returning false for non-hardcoded weapons', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));
    const { isPolearmWeapon } = await import('./polearmUtils.js');

    const result = await isPolearmWeapon('Glaive');
    expect(result).toBe(false);
  });

  it('treats weapons without properties array as not polearm weapons', async () => {
    const noPropsData = [
      { name: 'Strange Weapon' },
    ];
    global.fetch.mockResolvedValue(createMockResponse(noPropsData));
    const { isPolearmWeapon } = await import('./polearmUtils.js');

    const result = await isPolearmWeapon('Strange Weapon');
    expect(result).toBe(false);
  });

  it('caches empty array when fetch returns empty', async () => {
    global.fetch.mockResolvedValue(createMockResponse([]));
    const { isPolearmWeapon } = await import('./polearmUtils.js');

    const result1 = await isPolearmWeapon('Glaive');
    const result2 = await isPolearmWeapon('Halberd');

    expect(result1).toBe(false);
    expect(result2).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
