// @improved-by-ai
import { describe, it, expect } from 'vitest';

import rules from '../rules.js';

describe('rules.getMagicItems', () => {
  describe('empty input handling', () => {
    it('returns null for 5e when allMagicItems is empty', () => {
      const playerSummary = { inventory: { magicItems: [] } };
      const result = rules.getMagicItems([], playerSummary);
      expect(result).toBeNull();
    });

    it('returns null for 5e when inventory has no magic items', () => {
      const result = rules.getMagicItems([{ name: 'Ring of Protection' }], { inventory: { magicItems: [] } });
      expect(result).toBeNull();
    });

    it('returns [] for 2024 when allMagicItems is empty', () => {
      const playerSummary = { inventory: { magicItems: [] } };
      const result = rules.getMagicItems([], playerSummary, { rules: '2024' });
      expect(result).toEqual([]);
    });

    it('returns [] for 2024 when inventory has no magic items', () => {
      const result = rules.getMagicItems([{ name: 'Ring of Protection' }], { inventory: { magicItems: [] } }, { rules: '2024' });
      expect(result).toEqual([]);
    });

    it('returns null for 5e when allMagicItems is undefined', () => {
      const playerSummary = { inventory: { magicItems: [] } };
      const result = rules.getMagicItems(undefined, playerSummary);
      expect(result).toBeNull();
    });
  });

  describe('basic item resolution', () => {
    it('resolves items from allMagicItems by name match', () => {
      const allMagicItems = [
        { name: 'Ring of Protection', description: 'Grants +1 AC', rarity: 'Rare' }
      ];
      const playerSummary = {
        inventory: { magicItems: [{ name: 'Ring of Protection', quantity: 1 }] }
      };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Ring of Protection');
      expect(result[0].description).toBe('Grants +1 AC');
      expect(result[0].rarity).toBe('Rare');
      expect(result[0].quantity).toBe(1);
    });

    it('preserves source item properties not overridden by inventory', () => {
      const allMagicItems = [
        { name: 'Potion of Healing', description: 'Restores 2d4+2 HP', rarity: 'Common', weight: 0.5 }
      ];
      const playerSummary = {
        inventory: { magicItems: [{ name: 'Potion of Healing', quantity: 3 }] }
      };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result).toHaveLength(1);
      expect(result[0].quantity).toBe(3);
      expect(result[0].description).toBe('Restores 2d4+2 HP');
      expect(result[0].weight).toBe(0.5);
    });

    it('handles multiple magic items', () => {
      const allMagicItems = [
        { name: 'Ring of Protection', rarity: 'Rare' },
        { name: 'Amulet of Health', rarity: 'Very Rare' }
      ];
      const playerSummary = {
        inventory: {
          magicItems: [
            { name: 'Ring of Protection', quantity: 1 },
            { name: 'Amulet of Health', quantity: 1 }
          ]
        }
      };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result).toHaveLength(2);
      expect(result.map(i => i.name)).toEqual(['Ring of Protection', 'Amulet of Health']);
    });
  });

  describe('ring of spell storing special handling', () => {
    it('swaps description/details for Ring of Spell Storing with spell property', () => {
      const allMagicItems = [
        { name: 'Ring of Spell Storing', description: 'Can store spells' }
      ];
      const playerSummary = {
        inventory: {
          magicItems: [{ name: 'Ring of Spell Storing', spell: 'Fireball' }]
        }
      };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result[0].description).toBe('Fireball');
      expect(result[0].details).toBe('Can store spells');
    });

    it('swaps description/details for Ring of Spell Storing with description property', () => {
      const allMagicItems = [
        { name: 'Ring of Spell Storing', description: 'Can store spells' }
      ];
      const playerSummary = {
        inventory: {
          magicItems: [{ name: 'Ring of Spell Storing', description: 'Hold my spells' }]
        }
      };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result[0].description).toBe('Hold my spells');
      expect(result[0].details).toBe('Can store spells');
    });

    it('handles Spell Ring variant name', () => {
      const allMagicItems = [
        { name: 'Spell Ring', description: 'Stores a spell' }
      ];
      const playerSummary = {
        inventory: {
          magicItems: [{ name: 'Spell Ring', spell: 'Shield' }]
        }
      };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result[0].description).toBe('Shield');
      expect(result[0].details).toBe('Stores a spell');
    });

    it('handles Spell Scroll variant name', () => {
      const allMagicItems = [
        { name: 'Spell Scroll', description: 'Contains a spell' }
      ];
      const playerSummary = {
        inventory: {
          magicItems: [{ name: 'Spell Scroll', spell: 'Detect Magic' }]
        }
      };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result[0].description).toBe('Detect Magic');
      expect(result[0].details).toBe('Contains a spell');
    });
  });

  describe('rarity overrides', () => {
    it('uses player inventory rarity when available', () => {
      const allMagicItems = [
        { name: 'Potion of Healing', rarity: 'Common' }
      ];
      const playerSummary = {
        inventory: {
          magicItems: [{ name: 'Potion of Healing', rarity: 'Uncommon' }]
        }
      };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result[0].rarity).toBe('Uncommon');
    });

    it('uses source rarity when player has none', () => {
      const allMagicItems = [
        { name: 'Potion of Healing', rarity: 'Common' }
      ];
      const playerSummary = {
        inventory: {
          magicItems: [{ name: 'Potion of Healing' }]
        }
      };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result[0].rarity).toBe('Common');
    });
  });

  describe('unknown item handling', () => {
    it('keeps not-found items in 5e mode as-is', () => {
      const allMagicItems = [];
      const playerSummary = {
        inventory: {
          magicItems: [{ name: 'Custom Item', quantity: 1 }]
        }
      };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Custom Item');
      expect(result[0].quantity).toBe(1);
    });

    it('filters out not-found items in 2024 mode', () => {
      const allMagicItems = [{ name: 'Ring of Protection', rarity: 'Rare' }];
      const playerSummary = {
        inventory: {
          magicItems: [
            { name: 'Ring of Protection' },
            { name: 'Unknown Item' }
          ]
        }
      };

      const result = rules.getMagicItems(allMagicItems, playerSummary, { rules: '2024' });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Ring of Protection');
    });

    it('returns empty array in 2024 when all items are unknown', () => {
      const allMagicItems = [{ name: 'Ring of Protection' }];
      const playerSummary = {
        inventory: {
          magicItems: [{ name: 'Unknown Item' }]
        }
      };

      const result = rules.getMagicItems(allMagicItems, playerSummary, { rules: '2024' });

      expect(result).toEqual([]);
    });
  });

  describe('ruleset detection', () => {
    it('detects 2024 from playerStats argument and resolves items', () => {
      const allMagicItems = [{ name: 'Ring of Protection' }];
      const playerSummary = { inventory: { magicItems: [{ name: 'Ring of Protection' }] } };
      const result = rules.getMagicItems(allMagicItems, playerSummary, { rules: '2024' });
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });

    it('detects 2024 from playerSummary argument when playerStats lacks rules', () => {
      const allMagicItems = [{ name: 'Ring of Protection' }];
      const playerSummary = {
        inventory: { magicItems: [] },
        rules: '2024'
      };
      const result = rules.getMagicItems(allMagicItems, playerSummary);
      expect(result).toEqual([]);
    });

    it('defaults to 5e when no rules field present', () => {
      const allMagicItems = [{ name: 'Ring of Protection' }];
      const playerSummary = { inventory: { magicItems: [] } };
      const result = rules.getMagicItems(allMagicItems, playerSummary);
      expect(result).toBeNull();
    });

    it('prioritizes playerStats.rules over playerSummary.rules', () => {
      const allMagicItems = [{ name: 'Ring of Protection' }];
      const playerSummary = {
        inventory: { magicItems: [] },
        rules: '2024'
      };
      const result = rules.getMagicItems(allMagicItems, playerSummary, { rules: '5e' });
      expect(result).toBeNull();
    });
  });

  describe('string item names', () => {
    it('handles string item names in inventory', () => {
      const allMagicItems = [
        { name: 'Ring of Protection', rarity: 'Rare' }
      ];
      const playerSummary = {
        inventory: { magicItems: ['Ring of Protection'] }
      };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Ring of Protection');
      expect(result[0].rarity).toBe('Rare');
    });
  });
});
