import { describe, it, expect, vi } from 'vitest';

vi.mock('../../ui/dataLoader.js', () => ({
  loadSkills: vi.fn(),
  loadPassiveSkills: vi.fn(),
  loadFeatData: vi.fn().mockResolvedValue([])
}));

import rules from '../rules.js';

describe('rules', () => {
  describe('getArmorClass', () => {
    const createEquipment = () => [
      { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } },
      { name: 'Chain Mail', equipment_category: 'Armor', armor_class: { base: 16, dex_bonus: false } },
      { name: 'Breastplate', equipment_category: 'Armor', armor_class: { base: 14, dex_bonus: true, max_bonus: 2 } },
      { name: 'Shield', equipment_category: 'Armor', armor_class: { base: 2 } },
      { name: 'Longsword', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d8', damage_type: 'Slashing' } }
    ];

    it('should calculate AC for unarmored character', () => {
      const playerStats = {
        class: { name: 'Wizard' },
        abilities: [
          { name: 'Dexterity', bonus: 3 },
          { name: 'Constitution', bonus: 2 },
          { name: 'Wisdom', bonus: 1 }
        ],
        inventory: { equipped: [] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(13); // 10 + 3 (dex)
    });

    it('should calculate AC with armor', () => {
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Constitution', bonus: 2 },
          { name: 'Wisdom', bonus: 1 }
        ],
        inventory: { equipped: ['Leather Armor'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(13); // 11 (leather) + 2 (dex)
    });

    it('should calculate AC with armor and max dex bonus', () => {
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Dexterity', bonus: 4 },
          { name: 'Constitution', bonus: 2 },
          { name: 'Wisdom', bonus: 1 }
        ],
        inventory: { equipped: ['Breastplate'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(16); // 14 (breastplate) + 2 (max dex bonus)
    });

    it('should calculate AC with shield', () => {
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Constitution', bonus: 2 },
          { name: 'Wisdom', bonus: 1 }
        ],
        inventory: { equipped: ['Leather Armor', 'Shield'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(15); // 11 + 2 + 2 (shield)
    });

    it('should calculate AC with magic armor', () => {
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Constitution', bonus: 2 },
          { name: 'Wisdom', bonus: 1 }
        ],
        inventory: { equipped: ['+1 Leather Armor'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(14); // 11 (leather) + 2 (dex) + 1 (magic)
    });

    it('should calculate AC with magic shield', () => {
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Constitution', bonus: 2 },
          { name: 'Wisdom', bonus: 1 }
        ],
        inventory: { equipped: ['Leather Armor', '+2 Shield'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(17); // 11 + 2 + 2 (shield) + 2 (magic shield)
    });

    it('should handle equipped items not found in equipment catalog', () => {
      const limitedEquipment = () => [
        { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } }
      ];
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Dexterity', bonus: 2 }
        ],
        inventory: { equipped: ['Unknown Item', 'Leather Armor'] }
      };
      const [ac] = rules.getArmorClass(limitedEquipment(), playerStats);
      expect(ac).toBe(13); // 11 + 2 (dex)
    });

    it('should apply Monk wisdom bonus to AC', () => {
      const playerStats = {
        class: { name: 'Monk' },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Constitution', bonus: 2 },
          { name: 'Wisdom', bonus: 3 }
        ],
        inventory: { equipped: [] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(15); // 10 + 2 (dex) + 3 (wisdom for Monk)
    });

    it('should apply Barbarian unarmored defense', () => {
      const playerStats = {
        class: { name: 'Barbarian' },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Constitution', bonus: 3 }
        ],
        inventory: { equipped: [] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(15); // 10 + 2 (dex) + 3 (con for Barbarian)
    });

    it('should apply Draconic Sorcerer unarmored defense', () => {
      const playerStats = {
        class: {
          name: 'Sorcerer',
          subclass: { name: 'Draconic' }
        },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Constitution', bonus: 2 }
        ],
        inventory: { equipped: [] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(15); // 13 + 2 (dex) for Draconic
    });

    it('should apply Defense fighting style', () => {
      const playerStats = {
        class: {
          name: 'Fighter',
          fightingStyles: ['Defense']
        },
        abilities: [
          { name: 'Dexterity', bonus: 2 }
        ],
        inventory: { equipped: ['Leather Armor'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(14); // 11 + 2 + 1 (Defense)
    });

    it('should apply Cloak of Protection', () => {
      const playerStats = {
        class: { name: 'Wizard' },
        abilities: [
          { name: 'Dexterity', bonus: 2 }
        ],
        inventory: {
          equipped: [],
          magicItems: [{ name: 'Cloak of Protection' }]
        }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(13); // 10 + 2 (dex) + 1 (Cloak)
    });

    it('should apply Ring of Protection', () => {
      const playerStats = {
        class: { name: 'Wizard' },
        abilities: [
          { name: 'Dexterity', bonus: 2 }
        ],
        inventory: {
          equipped: [],
          magicItems: [{ name: 'Ring of Protection' }]
        }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(13); // 10 + 2 (dex) + 1 (Ring)
    });

    it('should return AC contributions formula', () => {
      const playerStats = {
        class: { name: 'Wizard' },
        abilities: [
          { name: 'Dexterity', bonus: 3 }
        ],
        inventory: { equipped: [] }
      };

      const [ac, formula] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(13);
      expect(formula).toContain('Unarmored AC (10)');
      expect(formula).toContain('Dexterity Bonus (3)');
    });
  });

  describe('2024 ruleset dispatch / getArmorClass', () => {
    const baseEquipment2024 = () => [
      { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } },
      { name: 'Shield', equipment_category: 'Armor', armor_class: { base: 2 } }
    ];

    it('should not apply Defense fighting style in 2024 mode', () => {
      const playerStats = {
        rules: '2024',
        class: { name: 'Fighter', fightingStyles: ['Defense'] },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: [] }
      };
      const [ac] = rules.getArmorClass(baseEquipment2024(), playerStats);
      expect(ac).toBe(12); // 10 + 2 (dex), no Defense bonus
    });

    it('should not apply Cloak of Protection in 2024 mode', () => {
      const playerStats = {
        rules: '2024',
        class: { name: 'Wizard' },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: [], magicItems: [{ name: 'Cloak of Protection' }] }
      };
      const [ac] = rules.getArmorClass(baseEquipment2024(), playerStats);
      expect(ac).toBe(12);
    });

    it('should not apply Ring of Protection in 2024 mode', () => {
      const playerStats = {
        rules: '2024',
        class: { name: 'Wizard' },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: [], magicItems: [{ name: 'Ring of Protection' }] }
      };
      const [ac] = rules.getArmorClass(baseEquipment2024(), playerStats);
      expect(ac).toBe(12);
    });

    it('should apply Barbarian unarmored defense in 2024 mode', () => {
      const playerStats = {
        rules: '2024',
        class: { name: 'Barbarian' },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Constitution', bonus: 3 }
        ],
        inventory: { equipped: [] }
      };
      const [ac] = rules.getArmorClass(baseEquipment2024(), playerStats);
      expect(ac).toBe(15); // 10 + 2 + 3
    });

    it('should apply Draconic Sorcery unarmored defense in 2024 mode', () => {
      const playerStats = {
        rules: '2024',
        class: { name: 'Sorcerer', major: { name: 'Draconic Sorcery' } },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Charisma', bonus: 3 }
        ],
        inventory: { equipped: [] }
      };
      const [ac] = rules.getArmorClass(baseEquipment2024(), playerStats);
      expect(ac).toBe(15); // 10 + 2 (dex) + 3 (cha) for Draconic Sorcery
    });

    it('should not apply Draconic Sorcery unarmored defense when wearing armor', () => {
      const playerStats = {
        rules: '2024',
        class: { name: 'Sorcerer', major: { name: 'Draconic Sorcery' } },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Charisma', bonus: 3 }
        ],
        inventory: { equipped: ['Leather Armor'] }
      };
      const [ac] = rules.getArmorClass(baseEquipment2024(), playerStats);
      expect(ac).toBe(13); // 11 (leather) + 2 (dex), no Draconic bonus with armor
    });
  });

  describe('dispatch edge cases / Shield string variant in getArmorClass', () => {
    it('should handle "Shield" string in equipped items', () => {
      const equipment = [
        { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } },
        { name: 'Shield', equipment_category: 'Armor', armor_class: { base: 2 } }
      ];
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: ['Leather Armor', 'Shield'] }
      };
      const [ac] = rules.getArmorClass(equipment, playerStats);
      expect(ac).toBe(15); // 11 + 2 (dex) + 2 (shield)
    });
  });
});
