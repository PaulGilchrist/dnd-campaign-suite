import { describe, it, expect, vi } from 'vitest';

vi.mock('../../ui/dataLoader.js', () => ({
  loadSkills: vi.fn(),
  loadPassiveSkills: vi.fn(),
  loadFeatData: vi.fn().mockResolvedValue([])
}));

import rules from '../rules.js';

describe('rules', () => {
  describe('getMagicItems', () => {
    it('should return null when no magic items', () => {
      const allMagicItems = [];
      const playerSummary = {
        inventory: { magicItems: [] }
      };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result).toBeNull();
    });

    it('should return magic items with details', () => {
      const allMagicItems = [
        { name: 'Ring of Protection', description: 'Grants +1 AC', rarity: 'Rare' }
      ];
      const playerSummary = {
        inventory: {
          magicItems: [
            { name: 'Ring of Protection', quantity: 1 }
          ]
        }
      };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Ring of Protection');
      expect(result[0].quantity).toBe(1);
    });

    it('should handle Ring of Spell Storing specially', () => {
      const allMagicItems = [
        {
          name: 'Ring of Spell Storing',
          description: 'Can store spells',
          rarity: 'Rare'
        }
      ];
      const playerSummary = {
        inventory: {
          magicItems: [
            { name: 'Ring of Spell Storing', quantity: 1, spell: 'Fireball' }
          ]
        }
      };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result[0].description).toBe('Fireball');
      expect(result[0].details).toBe('Can store spells');
    });

    it('should handle magic items not found in allMagicItems', () => {
      const allMagicItems = [];
      const playerSummary = {
        inventory: {
          magicItems: [
            { name: 'Custom Item', quantity: 1 }
          ]
        }
      };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Custom Item');
    });

    it('should use player magic item rarity if available', () => {
      const allMagicItems = [
        { name: 'Potion of Healing', rarity: 'Common' }
      ];
      const playerSummary = {
        inventory: {
          magicItems: [
            { name: 'Potion of Healing', quantity: 3, rarity: 'Uncommon' }
          ]
        }
      };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result[0].rarity).toBe('Uncommon');
    });
  });

  describe('2024 ruleset dispatch / getMagicItems', () => {
    it('should return [] instead of null for empty magic items in 2024 mode', () => {
      const result = rules.getMagicItems([], { inventory: { magicItems: [] } }, { rules: '2024' });
      expect(result).toEqual([]);
    });

    it('should return null for empty magic items in 5e mode', () => {
      const result = rules.getMagicItems([], { inventory: { magicItems: [] } });
      expect(result).toBeNull();
    });

    it('should filter out not-found items in 2024 mode', () => {
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

    it('should keep not-found items in 5e mode', () => {
      const allMagicItems = [];
      const playerSummary = {
        inventory: {
          magicItems: [
            { name: 'Custom Item', quantity: 1 }
          ]
        }
      };
      const result = rules.getMagicItems(allMagicItems, playerSummary);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Custom Item');
    });
  });
});
