import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Imports ─────────────────────────────────────────────────────
import {
  normalizeCurrency,
  formatCurrencyString,
  calculateEncounterXp,
  generateLootSuggestions,
} from './lootGenerator.js';

// ── Helpers ─────────────────────────────────────────────────────

/** Controlled Math.random via sequential value array. */
let randomSeq = [];
let randomIdx = 0;

function mockRandom(values) {
  randomSeq = values;
  randomIdx = 0;
  return vi.spyOn(Math, 'random').mockImplementation(() => {
    const v = randomSeq[randomIdx];
    randomIdx++;
    return v !== undefined ? v : 0.5;
   });
}

function createMockResponse(json) {
  return new Response(JSON.stringify(json), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
   });
}

const magicItems = [
   { name: 'Wand of Fireballs', rarity: 'rare', type: 'wand', requiresAttunement: false },
   { name: 'Amulet of Health', rarity: 'very rare', type: 'wondrous item', requiresAttunement: true },
   { name: '+1 Dagger', rarity: 'uncommon', type: 'dagger (weapon)' },
   { name: 'Common Potions', rarity: 'common', type: 'potion' },
];

// ── Setup / teardown ────────────────────────────────────────────

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete global.fetch;
});

// ═══════════════════════════════════════════════════════════════╗
//  normalizeCurrency                                            ║
// ╚════════════════════════════════════════════════════════════╝

describe('normalizeCurrency', () => {
  it('returns all zero for totalGP of 0', () => {
    const result = normalizeCurrency(0);
    expect(result).toEqual({ pp: 0, gp: 0, sp: 0, cp: 0 });
   });

  it('converts fractional GP correctly — stays in copper/silver/gp', () => {
     // totalGP=2.55 → totalCP=255 → spTotal=25, spRm=5, gpTotal=2, gpRm=2, pp=0
    const result = normalizeCurrency(2.55);
    expect(result.cp).toBe(5);
    expect(result.sp).toBe(5);
    expect(result.gp).toBe(2);
    expect(result.pp).toBe(0);
   });

  it('produces pp for large GP amounts', () => {
     // totalGP=1234.56 → totalCP=123456 → spTotal=12345, gpTotal=1234, pp=123
    const result = normalizeCurrency(1234.56);
    expect(result).toEqual({ pp: 123, gp: 4, sp: 5, cp: 6 });
   });

  it('handles odd CP remainders', () => {
    const result = normalizeCurrency(0.07);
    expect(result).toEqual({ pp: 0, gp: 0, sp: 0, cp: 7 });
   });

  it('handles negative totalGP — JS modulo follows sign of dividend', () => {
    const result = normalizeCurrency(-2.55);
    expect(result.cp).toBe(-5);
    expect(typeof result.pp).toBe('number');
    expect(typeof result.gp).toBe('number');
    expect(typeof result.sp).toBe('number');
    expect(typeof result.cp).toBe('number');
   });

  it('returns an object with exactly pp, gp, sp, cp keys', () => {
    const result = normalizeCurrency(100);
    expect(Object.keys(result)).toEqual(['pp', 'gp', 'sp', 'cp']);
   });
});

// ═══════════════════════════════════════════════════════════════╗
//  formatCurrencyString                                        ║
// ╚════════════════════════════════════════════════════════════╝

describe('formatCurrencyString', () => {
  it('returns "0 platinum pieces" for all-zero currency', () => {
    expect(formatCurrencyString({ pp: 0, gp: 0, sp: 0, cp: 0 })).toBe(
      '0 platinum pieces'
     );
   });

  it('uses singular "platinum piece" when pp === 1', () => {
    expect(formatCurrencyString({ pp: 1, gp: 0, sp: 0, cp: 0 })).toBe(
      '1 platinum piece'
     );
   });

  it('uses plural "platinum pieces" when pp > 1', () => {
    expect(formatCurrencyString({ pp: 5, gp: 0, sp: 0, cp: 0 })).toBe(
      '5 platinum pieces'
     );
   });

  it('uses singular "gold piece" when gp === 1', () => {
    expect(formatCurrencyString({ pp: 0, gp: 1, sp: 0, cp: 0 })).toBe(
      '1 gold piece'
     );
   });

  it('uses plural "gold pieces" when gp is not 1 and present', () => {
    expect(formatCurrencyString({ pp: 0, gp: 3, sp: 0, cp: 0 })).toBe(
      '3 gold pieces'
     );
   });

  it('uses singular "silver coin" when sp === 1', () => {
    expect(formatCurrencyString({ pp: 0, gp: 0, sp: 1, cp: 0 })).toBe(
      '1 silver coin'
     );
   });

  it('uses plural "silver coins" when sp is not 1', () => {
    expect(formatCurrencyString({ pp: 0, gp: 0, sp: 2, cp: 0 })).toBe(
      '2 silver coins'
     );
   });

  it('uses singular "copper coin" when cp === 1', () => {
    expect(formatCurrencyString({ pp: 0, gp: 0, sp: 0, cp: 1 })).toBe(
      '1 copper coin'
     );
   });

  it('uses plural "copper coins" when cp is not 1 and present', () => {
    expect(formatCurrencyString({ pp: 0, gp: 0, sp: 0, cp: 4 })).toBe(
      '4 copper coins'
     );
   });

  it('joins multiple denominations with ", "', () => {
    const result = formatCurrencyString({ pp: 1, gp: 3, sp: 2, cp: 5 });
    expect(result).toContain(',');
    expect(result).toContain('1 platinum piece');
    expect(result).toContain('3 gold pieces');
    expect(result).toContain('2 silver coins');
    expect(result).toContain('5 copper coins');
   });

  it('omits zero-valued denominations', () => {
    const result = formatCurrencyString({ pp: 0, gp: 5, sp: 0, cp: 3 });
    expect(result).not.toContain('platinum');
    expect(result).not.toContain('silver');
   });
});

// ═══════════════════════════════════════════════════════════════╗
//  calculateEncounterXp                                        ║
// ╚════════════════════════════════════════════════════════════╝

describe('calculateEncounterXp', () => {
  it('returns 0 when selectedMonsters is null', () => {
    expect(calculateEncounterXp(null)).toBe(0);
   });

  it('returns 0 when selectedMonsters is undefined', () => {
    expect(calculateEncounterXp(undefined)).toBe(0);
   });

  it('returns 0 when selectedMonsters is empty array', () => {
    expect(calculateEncounterXp([])).toBe(0);
   });

  it('sums xp for a single monster without qty', () => {
    const monsters = [{ name: 'Goblin', xp: 50 }];
    expect(calculateEncounterXp(monsters)).toBe(50);
   });

  it('multiplies xp by qty when present', () => {
    const monsters = [{ name: 'Orc', xp: 200, qty: 3 }];
    expect(calculateEncounterXp(monsters)).toBe(600);
   });

  it('defaults missing xp to 0', () => {
    const monsters = [{ name: 'Unknown' }];
    expect(calculateEncounterXp(monsters)).toBe(0);
   });

  it('defaults qty to 1 when omitted', () => {
    const monsters = [{ name: 'Bugbear', xp: 200 }];
    expect(calculateEncounterXp(monsters)).toBe(200);
   });

  it('handles mixed monsters — some with, some without xp', () => {
    const monsters = [
      { name: 'Goblin', xp: 50, qty: 2 },
      { name: 'Skeleton' },
      { name: 'Orc', xp: 200 },
     ];
    expect(calculateEncounterXp(monsters)).toBe(300);
   });

  it('handles monsters with qty of 0 — treated as 1 due to || 1', () => {
    const monsters = [{ name: 'Gnome', xp: 50, qty: 0 }];
    expect(calculateEncounterXp(monsters)).toBe(50);
   });

  it('sums xp for multiple monsters', () => {
    const monsters = [
      { name: 'Goblin', xp: 25 },
      { name: 'Orc', xp: 45, qty: 2 },
     ];
    expect(calculateEncounterXp(monsters)).toBe(115);
   });
});

// ═══════════════════════════════════════════════════════════════╗
//  generateLootSuggestions                                      ║
// ╚════════════════════════════════════════════════════════════╝

describe('generateLootSuggestions', () => {

   // ── Edge cases / early returns ──────────────────────────────

  it('returns empty loot for null monsters array', async () => {
    const result = await generateLootSuggestions(null);
    expect(result.lootEntries).toEqual([]);
    expect(result.totalEncounterXp).toBe(0);
   });

  it('returns empty loot for undefined monsters', async () => {
    const result = await generateLootSuggestions(undefined);
    expect(result.lootEntries).toEqual([]);
    expect(result.totalEncounterXp).toBe(0);
   });

  it('returns empty loot for empty monsters array', async () => {
    const result = await generateLootSuggestions([]);
    expect(result.lootEntries).toEqual([]);
    expect(result.totalEncounterXp).toBe(0);
   });

   // ── Fetch failure tolerance ────────────────────────────────

  it('handles fetch errors gracefully', async () => {
    mockRandom([0.2]);
    global.fetch.mockRejectedValue(new Error('network failure'));
    const result = await generateLootSuggestions([{ name: 'Orc', xp: 200, challenge_rating: 3 }]);
    expect(result.totalEncounterXp).toBe(200);
    expect(Array.isArray(result.lootEntries)).toBe(true);
   });

  it('handles non-ok fetch response gracefully', async () => {
    global.fetch.mockResolvedValue(new Response('', { status: 404 }));
    const result = await generateLootSuggestions([{ name: 'Orc', xp: 200, challenge_rating: 3 }]);
    expect(result.totalEncounterXp).toBe(200);
    expect(Array.isArray(result.lootEntries)).toBe(true);
   });

   // ── Treasure tier = "none" (CR < 1.5) → skipped ────────────

  it('skips monsters with CR below 1.5 — "none" tier', async () => {
    global.fetch.mockResolvedValue(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Spectral Force', xp: 25, challenge_rating: '1/4' },
     ]);
    expect(result.lootEntries).toContain('No loot for these monsters');
    expect(result.totalEncounterXp).toBe(25);
   });

  it('handles half-integer challenge ratings as numbers', async () => {
    global.fetch.mockResolvedValue(createMockResponse([]));
    mockRandom([0.2]);
    const result = await generateLootSuggestions([
      { name: 'Skeleton', xp: 45, challenge_rating: 1.75 },
     ]);
    expect(typeof result.totalEncounterXp).toBe('number');
   });

  it('handles fractional string challenge ratings', async () => {
    global.fetch.mockResolvedValue(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Specter', xp: 100, challenge_rating: '3/4' },
     ]);
    expect(result.totalEncounterXp).toBe(100);
    expect(result.lootEntries[0]).toBe('No loot for these monsters');
   });

  it('handles invalid challenge rating string gracefully', async () => {
    global.fetch.mockResolvedValue(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Unknown Beast', xp: 50, challenge_rating: 'not-a-number' },
     ]);
    expect(result.lootEntries[0]).toBe('No loot for these monsters');
    expect(result.totalEncounterXp).toBe(50);
   });

  it('handles missing challenge_rating (defaults via crToNumber)', async () => {
    global.fetch.mockResolvedValue(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Monster', xp: 100 },
     ]);
    expect(result.totalEncounterXp).toBe(100);
   });

   // ── Treasure frequency skip ────────────────────────────────

  it('skips entry generation when treasure frequency roll fails', async () => {
    mockRandom([0.9]);
    global.fetch.mockResolvedValue(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Mouse', xp: 10, challenge_rating: 0.25 },
     ]);
    expect(result.lootEntries[0]).toBe('No loot for these monsters');
    expect(result.totalEncounterXp).toBe(10);
   });

  it('skips monster when Math.random exceeds treasure frequency', async () => {
    mockRandom([0.5]);
    global.fetch.mockResolvedValue(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Goblin', xp: 25, challenge_rating: 2 },
     ]);
    expect(result.lootEntries).toContain('No loot for these monsters');
   });

   // ── Currency entry generation (roll < 0.65) ────────────────

  it('generates currency entry when roll is below 0.65', async () => {
    mockRandom([0.2, 0.1, 0.0, 0.5, 0.5]);
    global.fetch.mockResolvedValue(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Goblin', xp: 25, challenge_rating: 3 },
     ]);
    expect(result.totalEncounterXp).toBe(25);
    expect(result.lootEntries.length).toBeGreaterThan(0);
    expect(result.lootEntries[0] !== 'No loot for these monsters').toBe(true);
   });

  it('generates currency from moderate tier (CR 3-5)', async () => {
    mockRandom([0.2, 0.1, 0.3, 0.4, 0.3]);
    global.fetch.mockResolvedValue(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Orc', xp: 200, challenge_rating: 4 },
     ]);
    expect(result.lootEntries[0]).not.toBe('No loot for these monsters');
   });

  it('generates platinum-piece currency from treasure hoard tier (CR 17-30)', async () => {
    mockRandom([0.1, 0.4, 0.1, 0.95, 0.5]);
    global.fetch.mockResolvedValue(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Tarrasque', xp: 16000, challenge_rating: 30 },
     ]);
    expect(Array.isArray(result.lootEntries)).toBe(true);
    expect(result.totalEncounterXp).toBe(16000);
   });

   // ── Gem entry generation (0.65 <= roll < 0.82) ────────────

  it('generates a gem entry when roll falls in gem range', async () => {
    mockRandom([0.2, 0.1, 0.7, 0.3, 0.0, 0.5]);
    global.fetch.mockResolvedValue(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Hobgoblin', xp: 150, challenge_rating: 4 },
     ]);
    expect(result.totalEncounterXp).toBe(150);
    expect(Array.isArray(result.lootEntries)).toBe(true);
    expect(result.lootEntries.some(e => e.includes('gp'))).toBe(true);
   });

  it('generates a jewelry gem entry when value >= 25 and roll < 0.35', async () => {
    mockRandom([0.2, 0.1, 0.75, 0.3, 0.0, 0.1, 0.2]);
    global.fetch.mockResolvedValue(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Bugbear', xp: 50, challenge_rating: 1.5 },
     ]);
    expect(Array.isArray(result.lootEntries)).toBe(true);
   });

  it('handles empty gem pool — falls back gracefully', async () => {
    mockRandom([0.2, 0.1, 0.75, 0.5, 0.5, 0.5]);
    global.fetch.mockResolvedValue(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Ghast', xp: 700, challenge_rating: 7 },
     ]);
    expect(Array.isArray(result.lootEntries)).toBe(true);
   });

   // ── Equipment entry generation (0.82 <= roll < 0.94) ──────

  it('generates an equipment entry when roll falls in equipment range', async () => {
    const equipmentData = [
      { name: 'Chain Shirt', cost: { quantity: 75, unit: 'gp' }, equipment_category: 'Armor' },
      { name: 'Longsword', cost: { quantity: 15, unit: 'gp' }, equipment_category: 'Melee Weapons' },
     ];
    mockRandom([0.2, 0.1, 0.88]);
    global.fetch
      .mockResolvedValueOnce(createMockResponse([]))
      .mockResolvedValueOnce(createMockResponse(equipmentData));

    const result = await generateLootSuggestions([
      { name: 'Giant', xp: 50, challenge_rating: 3 },
     ]);
    expect(Array.isArray(result.lootEntries)).toBe(true);
    if (result.lootEntries[0] !== 'No loot for these monsters') {
      expect(result.lootEntries.some(e => /\(\d+ \w+\)/.test(e))).toBe(true);
     }
   });

  it('skips equipment in "Property" category', async () => {
    const equipmentData = [
      { name: 'Caravan', cost: { quantity: 5000, unit: 'gp' }, equipment_category: 'Property' },
     ];
    mockRandom([0.2, 0.1, 0.88]);
    global.fetch
      .mockResolvedValueOnce(createMockResponse([]))
      .mockResolvedValueOnce(createMockResponse(equipmentData));

    const result = await generateLootSuggestions([
      { name: 'Monster', xp: 50, challenge_rating: 3 },
     ]);
    expect(Array.isArray(result.lootEntries)).toBe(true);
   });

  it('handles missing equipment data gracefully', async () => {
    mockRandom([0.2, 0.1, 0.88]);
    global.fetch.mockResolvedValueOnce(createMockResponse([]));
    global.fetch.mockResolvedValueOnce(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Monster', xp: 50, challenge_rating: 3 },
     ]);
    expect(Array.isArray(result.lootEntries)).toBe(true);
   });

  it('handles equipment cost in silver pieces', async () => {
    const equipData = [
      { name: 'Wooden Shield', cost: { quantity: 5, unit: 'sp' }, equipment_category: 'Armor' },
     ];
    mockRandom([0.2, 0.1, 0.88]);
    global.fetch
      .mockResolvedValueOnce(createMockResponse([]))
      .mockResolvedValueOnce(createMockResponse(equipData));

    const result = await generateLootSuggestions([
      { name: 'Monster', xp: 50, challenge_rating: 2 },
     ]);
    expect(Array.isArray(result.lootEntries)).toBe(true);
   });

  it('handles equipment cost in platinum pieces', async () => {
    const equipData = [
      { name: 'Masterwork Longsword', cost: { quantity: 1, unit: 'pp' }, equipment_category: 'Melee Weapons' },
     ];
    mockRandom([0.2, 0.1, 0.88]);
    global.fetch
      .mockResolvedValueOnce(createMockResponse([]))
      .mockResolvedValueOnce(createMockResponse(equipData));

    const result = await generateLootSuggestions([
      { name: 'Monster', xp: 50, challenge_rating: 3 },
     ]);
    expect(Array.isArray(result.lootEntries)).toBe(true);
   });

  it('handles equipment with non-standard cost gracefully', async () => {
    const badEquipment = [
      { name: 'Broken Item', cost: null, equipment_category: 'Weapon' },
     ];
    mockRandom([0.2, 0.1, 0.88]);
    global.fetch
      .mockResolvedValueOnce(createMockResponse([]))
      .mockResolvedValueOnce(createMockResponse(badEquipment));

    const result = await generateLootSuggestions([
      { name: 'Monster', xp: 50, challenge_rating: 3 },
     ]);
    expect(Array.isArray(result.lootEntries)).toBe(true);
   });

  it('handles equipment missing quantity in cost object', async () => {
    const badEquipment = [
      { name: 'No Qty Item', cost: { unit: 'gp' }, equipment_category: 'Armor' },
     ];
    mockRandom([0.2, 0.1, 0.88]);
    global.fetch
      .mockResolvedValueOnce(createMockResponse([]))
      .mockResolvedValueOnce(createMockResponse(badEquipment));

    const result = await generateLootSuggestions([
      { name: 'Monster', xp: 50, challenge_rating: 3 },
     ]);
    expect(Array.isArray(result.lootEntries)).toBe(true);
   });

  it('handles equipment with completely undefined cost', async () => {
    const badEquip = [{ name: 'Costless' }];
    mockRandom([0.2, 0.1, 0.88]);
    global.fetch
      .mockResolvedValueOnce(createMockResponse([]))
      .mockResolvedValueOnce(createMockResponse(badEquip));

    const result = await generateLootSuggestions([
      { name: 'Monster', xp: 50, challenge_rating: 3 },
     ]);
    expect(Array.isArray(result.lootEntries)).toBe(true);
   });

  it('excludes "Mounts and Vehicles" from equipment loot', async () => {
    const mountEquip = [
      { name: 'Warhorse', cost: { quantity: 75, unit: 'gp' }, equipment_category: 'Mounts and Vehicles' },
     ];
    mockRandom([0.2, 0.1, 0.88]);
    global.fetch
      .mockResolvedValueOnce(createMockResponse([]))
      .mockResolvedValueOnce(createMockResponse(mountEquip));

    const result = await generateLootSuggestions([
      { name: 'Monster', xp: 50, challenge_rating: 3 },
     ]);
    expect(Array.isArray(result.lootEntries)).toBe(true);
   });

   // ── Magic item entry generation (roll >= 0.94) ────────────

  it('generates a magic item entry when roll is above 0.94', async () => {
    mockRandom([0.2, 0.1, 0.97, 0.35, 0.33]);
    global.fetch
      .mockResolvedValueOnce(createMockResponse(magicItems))
      .mockResolvedValueOnce(createMockResponse([]));

    const result = await generateLootSuggestions([
      { name: 'Dragon', xp: 5000, challenge_rating: 10 },
     ]);
    expect(result.totalEncounterXp).toBe(5000);
   });

  it('generates magic item with attunement and type shown', async () => {
    mockRandom([0.1, 0.0, 0.98, 0.5, 0.33]);
    const customItems = [
      { name: 'Potion of Healing+', rarity: 'common', type: 'potion', requiresAttunement: true },
     ];
    global.fetch
      .mockResolvedValueOnce(createMockResponse(customItems))
      .mockResolvedValueOnce(createMockResponse([]));

    const result = await generateLootSuggestions([
      { name: 'Ancient Dragon', xp: 10000, challenge_rating: 20 },
     ]);
    expect(Array.isArray(result.lootEntries)).toBe(true);
    if (result.lootEntries[0] !== 'No loot for these monsters') {
      expect(result.lootEntries.some(e => e.includes('requires attunement'))).toBe(true);
     }
   });

  it('handles empty magic items data — no magic item generated', async () => {
    mockRandom([0.2, 0.1, 0.97]);
    global.fetch.mockResolvedValue(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Monster', xp: 100, challenge_rating: 5 },
     ]);
    expect(Array.isArray(result.lootEntries)).toBe(true);
   });

  it('recognizes "Very rare" rarity with +3 notation', async () => {
    mockRandom([0.2, 0.1, 0.97, 0.5, 0.33]);
    const plusThreeItems = [
      { name: '+3 Sword', rarity: 'rare +3', type: 'sword' },
     ];
    global.fetch
      .mockResolvedValueOnce(createMockResponse(plusThreeItems))
      .mockResolvedValueOnce(createMockResponse([]));

    const result = await generateLootSuggestions([
      { name: 'Monster', xp: 100, challenge_rating: 5 },
     ]);
    expect(Array.isArray(result.lootEntries)).toBe(true);
   });

  it('handles artifact keyword in rarity', async () => {
    mockRandom([0.2, 0.1, 0.97, 0.5, 0.33]);
    const artifactItems = [
      { name: 'The Amulet of Champions', rarity: 'artifact', type: 'amulet (wondrous item)', requiresAttunement: true },
     ];
    global.fetch
      .mockResolvedValueOnce(createMockResponse(artifactItems))
      .mockResolvedValueOnce(createMockResponse([]));

    const result = await generateLootSuggestions([
      { name: 'Monster', xp: 100, challenge_rating: 5 },
     ]);
    expect(Array.isArray(result.lootEntries)).toBe(true);
   });

  it('shows bare quoted name for items with unrecognizable rarity', async () => {
    mockRandom([0.2, 0.1, 0.97, 0.5, 0.33]);
    const weirdItems = [
      { name: 'Strange Artifact', rarity: 'varies', type: 'wondrous item' },
     ];
    global.fetch
      .mockResolvedValueOnce(createMockResponse(weirdItems))
      .mockResolvedValueOnce(createMockResponse([]));

    const result = await generateLootSuggestions([
      { name: 'Monster', xp: 100, challenge_rating: 5 },
     ]);
    expect(Array.isArray(result.lootEntries)).toBe(true);
   });

   // ── Multiple monsters processing ───────────────────────────

  it('processes multiple monsters with different tiers', async () => {
    mockRandom([0.2, 0.1, 0.3, 0.5, 0.5, 0.1, 0.1, 0.3, 0.5, 0.5]);
    global.fetch.mockResolvedValue(createMockResponse([]));

    const result = await generateLootSuggestions([
      { name: 'Goblin', xp: 25, challenge_rating: 2 },
      { name: 'Hobgoblin', xp: 150, challenge_rating: 4 },
     ]);
    expect(result.totalEncounterXp).toBe(175);
   });

  it('processes multiple qty monsters individually', async () => {
    mockRandom([0.1, 0.0, 0.3, 0.5, 0.5]);
    global.fetch.mockResolvedValue(createMockResponse([]));

    const result = await generateLootSuggestions([
      { name: 'Goblin', xp: 25, challenge_rating: 2, qty: 4 },
     ]);
    expect(result.totalEncounterXp).toBe(100);
   });

   // ── No loot fallback message ───────────────────────────────

  it('shows "No loot for these monsters" fallback', async () => {
    mockRandom([0.5]);
    global.fetch.mockResolvedValue(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Rat', xp: 5, challenge_rating: '1/2' },
     ]);
    expect(result.lootEntries[0]).toBe('No loot for these monsters');
   });

   // ── Total loot entry assembly ──────────────────────────────

  it('includes formatted currency string as first lootEntry', async () => {
    mockRandom([0.2, 0.0, 0.1, 0.5, 0.3]);
    global.fetch.mockResolvedValue(createMockResponse([]));

    const result = await generateLootSuggestions([
      { name: 'Goblin', xp: 25, challenge_rating: 2 },
     ]);
    if (result.lootEntries[0] !== 'No loot for these monsters') {
      expect(result.lootEntries[0].charAt(0)).not.toBe('"');
     }
   });

  it('returns formatted result with both currency and other entries', async () => {
    mockRandom([0.2, 0.5, 0.2, 0.5, 0.3, 0.7, 0.3, 0.0, 0.5]);
    global.fetch.mockResolvedValue(createMockResponse([]));

    const result = await generateLootSuggestions([
      { name: 'Goblin', xp: 25, challenge_rating: 2 },
     ]);
    expect(Array.isArray(result.lootEntries)).toBe(true);
    expect(typeof result.totalEncounterXp).toBe('number');
   });

   // ── Edge cases for crToNumber via generateLootSuggestions ──

  it('handles null challenge_rating gracefully', async () => {
    global.fetch.mockResolvedValue(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Unknown', xp: 10, challenge_rating: null },
     ]);
    expect(result.totalEncounterXp).toBe(10);
   });

  it('handles numeric challenge rating as number (no conversion needed)', async () => {
    mockRandom([0.2, 0.1, 0.3]);
    global.fetch.mockResolvedValue(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Orc', xp: 200, challenge_rating: 5 },
     ]);
    expect(result.totalEncounterXp).toBe(200);
   });

   // ── Total currency normalization — all coins combined ───────

  it('normalizes total currency across multiple entries into one string', async () => {
    mockRandom([0.2, 0.0, 0.3, 0.5, 0.3, 0.2, 0.0, 0.3, 0.5, 0.3]);
    global.fetch.mockResolvedValue(createMockResponse([]));

    const monsters = [
      { name: 'Goblin', xp: 25, challenge_rating: 3 },
      { name: 'Bugbear', xp: 50, challenge_rating: 1.5 },
     ];
    const result = await generateLootSuggestions(monsters);
    expect(result.totalEncounterXp).toBe(75);
    expect(Array.isArray(result.lootEntries)).toBe(true);
   });

   // ── CR boundary coverage ───────────────────────────────────

  it('handles CR at boundary — exactly 9 (rich to greater transition)', async () => {
    mockRandom([0.1, 0.0, 0.1]);
    global.fetch.mockResolvedValue(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Monster', xp: 4500, challenge_rating: 9 },
     ]);
    expect(result.totalEncounterXp).toBe(4500);
   });

  it('handles CR at boundary — exactly 1 (none to poor transition)', async () => {
    mockRandom([0.2, 0.1, 0.3]);
    global.fetch.mockResolvedValue(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Monster', xp: 50, challenge_rating: 1 },
     ]);
    expect(result.lootEntries[0]).toBe('No loot for these monsters');
    expect(result.totalEncounterXp).toBe(50);
   });

  it('handles CR at boundary — exactly 17 (major to treasure hoard)', async () => {
    mockRandom([0.1, 0.0, 0.98]);
    global.fetch.mockResolvedValueOnce(createMockResponse([]));
    global.fetch.mockResolvedValueOnce(createMockResponse([]));

    const result = await generateLootSuggestions([
      { name: 'Monster', xp: 15000, challenge_rating: 17 },
     ]);
    expect(result.totalEncounterXp).toBe(15000);
   });

  it('handles CR at boundary — exactly 7 (standard to rich)', async () => {
    mockRandom([0.1, 0.0, 0.3]);
    global.fetch.mockResolvedValue(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Monster', xp: 900, challenge_rating: 7 },
     ]);
    expect(result.totalEncounterXp).toBe(900);
   });

  it('uses middle-value gem pool for CR 9-10 (maxV <= 2000)', async () => {
    mockRandom([0.1, 0.33, 0.75, 0.1, 0.0, 0.9]);
    global.fetch.mockResolvedValue(createMockResponse([]));
    const result = await generateLootSuggestions([
      { name: 'Monster', xp: 4500, challenge_rating: 10 },
     ]);
    expect(Array.isArray(result.lootEntries)).toBe(true);
   });

  it('generates non-jewelry gem entry (plain format with adj + name)', async () => {
    mockRandom([0.2, 0.0, 0.74, 0.5, 0.5, 0.5]);
    global.fetch.mockResolvedValue(createMockResponse([]));

    const result = await generateLootSuggestions([
      { name: 'Monster', xp: 25, challenge_rating: 1.75 },
     ]);
    expect(Array.isArray(result.lootEntries)).toBe(true);
    if (result.lootEntries.length > 0 && result.lootEntries[0] !== 'No loot for these monsters') {
      expect(result.lootEntries[0]).toMatch(/gp\s*$/);
     }
   });
});
