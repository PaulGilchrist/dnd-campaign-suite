import { describe, it, expect, vi, beforeEach } from 'vitest';

import { generateLootSuggestions } from './lootGenerator.js';
import { clearDataCache } from '../ui/dataLoader.js';

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

const equipmentData = [
  { name: 'Chain Shirt', cost: { quantity: 75, unit: 'gp' }, equipment_category: 'Armor' },
  { name: 'Longsword', cost: { quantity: 15, unit: 'gp' }, equipment_category: 'Melee Weapons' },
];

const excludedEquip = [
  { name: 'Caravan', cost: { quantity: 5000, unit: 'gp' }, equipment_category: 'Property' },
  { name: 'Warhorse', cost: { quantity: 75, unit: 'gp' }, equipment_category: 'Mounts and Vehicles' },
];

// Stub Math.random to return a fixed value for all calls during a test.
// Returns a cleanup function that restores the original.
function stubRandom(value) {
  const original = Math.random;
  Math.random = () => value;
  return () => { Math.random = original; };
}

beforeEach(() => {
  global.fetch = vi.fn();
  clearDataCache();
});

describe('generateLootSuggestions', () => {
  // ── Early returns ────────────────────────────────────────────────

  describe('early returns', () => {
    it('returns empty loot for null, undefined, and empty monsters array', async () => {
      expect(await generateLootSuggestions(null)).toEqual({ lootEntries: [], totalEncounterXp: 0 });
      expect(await generateLootSuggestions(undefined)).toEqual({ lootEntries: [], totalEncounterXp: 0 });
      expect(await generateLootSuggestions([])).toEqual({ lootEntries: [], totalEncounterXp: 0 });
    });
  });

  // ── Error handling ───────────────────────────────────────────────

  describe('error handling', () => {
    it('handles fetch errors and non-ok responses gracefully, returning valid structure', async () => {
      global.fetch.mockRejectedValue(new Error('network failure'));
      const errorResult = await generateLootSuggestions([{ name: 'Orc', xp: 200, challenge_rating: 3 }]);
      expect(errorResult).toEqual({
        lootEntries: expect.any(Array),
        totalEncounterXp: 200,
      });

      global.fetch.mockResolvedValue(new Response('', { status: 404 }));
      const httpResult = await generateLootSuggestions([{ name: 'Orc', xp: 200, challenge_rating: 3 }]);
      expect(httpResult).toEqual({
        lootEntries: expect.any(Array),
        totalEncounterXp: 200,
      });
    });
  });

  // ── CR threshold ─────────────────────────────────────────────────

  describe('CR threshold', () => {
    it('skips monsters with CR below 1.5 — returns "No loot" message', async () => {
      global.fetch.mockResolvedValue(createMockResponse([]));
      const scenarios = [
        { name: 'Spectral Force', xp: 25, challenge_rating: '1/4' },
        { name: 'No CR', xp: 0, challenge_rating: 0 },
        { name: 'No CR Field', xp: 50 },
        { name: 'Invalid CR', xp: 50, challenge_rating: 'invalid' },
      ];
      for (const monster of scenarios) {
        const result = await generateLootSuggestions([monster]);
        expect(result.lootEntries).toContain('No loot for these monsters');
        expect(result.totalEncounterXp).toBe(monster.xp || 0);
      }
    });

    it('includes loot for monsters with CR at or above 1.5', async () => {
      global.fetch.mockResolvedValue(createMockResponse([]));
      const result = await generateLootSuggestions([
        { name: 'CR1.5', xp: 100, challenge_rating: 1.5 },
      ]);
      expect(result.totalEncounterXp).toBe(100);
      expect(result.lootEntries.length).toBeGreaterThan(0);
    });
  });

  // ── Quantity handling ────────────────────────────────────────────

  describe('quantity handling', () => {
    it('multiplies XP by qty when present', async () => {
      global.fetch.mockResolvedValue(createMockResponse([]));
      const result = await generateLootSuggestions([
        { name: 'Goblins', xp: 25, challenge_rating: 3, qty: 5 },
      ]);
      expect(result.totalEncounterXp).toBe(125);
    });

    it('treats qty of 0 as 1', async () => {
      global.fetch.mockResolvedValue(createMockResponse([]));
      const result = await generateLootSuggestions([
        { name: 'Zero Qty', xp: 50, challenge_rating: 3, qty: 0 },
      ]);
      expect(result.totalEncounterXp).toBe(50);
    });
  });

  // ── Multiple monsters ────────────────────────────────────────────

  describe('multiple monsters', () => {
    it('aggregates XP across multiple monsters', async () => {
      global.fetch.mockResolvedValue(createMockResponse([]));
      const result = await generateLootSuggestions([
        { name: 'Goblin', xp: 25, challenge_rating: 2 },
        { name: 'Hobgoblin', xp: 150, challenge_rating: 4 },
      ]);
      expect(result.totalEncounterXp).toBe(175);
      expect(Array.isArray(result.lootEntries)).toBe(true);
    });

    it('handles mixed valid and invalid CR monsters', async () => {
      global.fetch.mockResolvedValue(createMockResponse([]));
      const result = await generateLootSuggestions([
        { name: 'Valid Monster', xp: 100, challenge_rating: 3 },
        { name: 'Invalid Monster', xp: 50, challenge_rating: 'invalid' },
      ]);
      // Valid monster generates loot, invalid is skipped
      expect(result.totalEncounterXp).toBe(150);
      expect(result.lootEntries.length).toBeGreaterThan(0);
    });
  });

  // ── Treasure frequency ───────────────────────────────────────────

  describe('treasure frequency', () => {
    it('generates no loot when CR < 0.5 (frequency 0)', async () => {
      global.fetch.mockResolvedValue(createMockResponse([]));
      const restore = stubRandom(0.99);
      try {
        const result = await generateLootSuggestions([
          { name: 'Weak Monster', xp: 10, challenge_rating: 0.25 },
        ]);
        expect(result.lootEntries).toContain('No loot for these monsters');
      } finally {
        restore();
      }
    });

    it('generates loot when CR >= 0.5 (frequency > 0)', async () => {
      global.fetch.mockResolvedValue(createMockResponse([]));
      const restore = stubRandom(0.2);
      try {
        const result = await generateLootSuggestions([
          { name: 'Monster', xp: 100, challenge_rating: 2 },
        ]);
        expect(result.lootEntries).not.toContain('No loot for these monsters');
      } finally {
        restore();
      }
    });
  });

  // ── Currency generation ──────────────────────────────────────────

  describe('currency generation', () => {
    it('generates currency entry when roll falls in currency range (< 0.65)', async () => {
      global.fetch.mockResolvedValue(createMockResponse([]));
      const restore = stubRandom(0.4);
      try {
        const result = await generateLootSuggestions([
          { name: 'Monster', xp: 100, challenge_rating: 3 },
        ]);
        expect(result.lootEntries.length).toBeGreaterThan(0);
        const currencyEntry = result.lootEntries.find(entry =>
          /platinum|gold|silver|copper/i.test(entry)
        );
        expect(currencyEntry).toBeDefined();
      } finally {
        restore();
      }
    });
  });

  // ── Gem generation ───────────────────────────────────────────────

  describe('gem generation', () => {
    it('generates a gem entry when roll falls in gem range (0.65-0.82)', async () => {
      global.fetch.mockResolvedValue(createMockResponse([]));
      const restore = stubRandom(0.75);
      try {
        const result = await generateLootSuggestions([
          { name: 'Monster', xp: 500, challenge_rating: 5 },
        ]);
        expect(result.lootEntries.length).toBeGreaterThan(0);
        const gemEntry = result.lootEntries.find(entry =>
          /pearl|coral|amber|ruby|peridot|topaz|lapis|aquamarine|citrine|malachite|jasper|turquoise/i.test(entry)
        );
        expect(gemEntry).toBeDefined();
      } finally {
        restore();
      }
    });
  });

  // ── Equipment generation ─────────────────────────────────────────

  describe('equipment generation', () => {
    it('generates an equipment entry when roll falls in equipment range (0.82-0.94)', async () => {
      global.fetch
        .mockResolvedValueOnce(createMockResponse([]))
        .mockResolvedValueOnce(createMockResponse(equipmentData));

      const restore = stubRandom(0.85);
      try {
        const result = await generateLootSuggestions([
          { name: 'Monster', xp: 500, challenge_rating: 5 },
        ]);
        expect(result.lootEntries.length).toBeGreaterThan(0);
        const equipEntry = result.lootEntries.find(entry =>
          /(Chain Shirt|Longsword)/i.test(entry)
        );
        expect(equipEntry).toBeDefined();
      } finally {
        restore();
      }
    });

    it('excludes Property and Mounts/Vehicles from equipment loot', async () => {
      global.fetch
        .mockResolvedValueOnce(createMockResponse([]))
        .mockResolvedValueOnce(createMockResponse(excludedEquip));

      const restore = stubRandom(0.85);
      try {
        const result = await generateLootSuggestions([
          { name: 'Monster', xp: 500, challenge_rating: 5 },
        ]);
        expect(result.lootEntries).not.toContainEqual(expect.stringContaining('Caravan'));
        expect(result.lootEntries).not.toContainEqual(expect.stringContaining('Warhorse'));
      } finally {
        restore();
      }
    });
  });

  // ── Magic item generation ────────────────────────────────────────

  describe('magic item generation', () => {
    it('generates a magic item entry when roll is >= 0.94', async () => {
      global.fetch
        .mockResolvedValueOnce(createMockResponse(magicItems))
        .mockResolvedValueOnce(createMockResponse([]));

      const restore = stubRandom(0.95);
      try {
        const result = await generateLootSuggestions([
          { name: 'Monster', xp: 500, challenge_rating: 5 },
        ]);
        expect(result.lootEntries.length).toBeGreaterThan(0);
        const magicEntry = result.lootEntries.find(entry =>
          /Wand of Fireballs|Amulet of Health|\+1 Dagger|Common Potions/i.test(entry)
        );
        expect(magicEntry).toBeDefined();
      } finally {
        restore();
      }
    });
  });
});
