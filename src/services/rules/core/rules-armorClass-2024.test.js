import { describe, it, expect } from 'vitest';

import rules from '../rules.js';

describe('rules.getArmorClass', () => {
  // === 2024 RULES: Basic dispatch ===

  describe('2024 ruleset', () => {
    const baseEquipment2024 = () => [
      { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } },
      { name: 'Shield', equipment_category: 'Armor', armor_class: { base: 2 } }
    ];

    it('defaults to unarmored AC when no armor equipped', () => {
      const playerStats = {
        rules: '2024',
        class: { name: 'Wizard' },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: [] },
        automation: { passives: [] }
      };

      const [ac] = rules.getArmorClass(baseEquipment2024(), playerStats);

      expect(ac).toBe(12);
    });
  });

  // === 2024 RULES: Unarmored Defense ===

  describe('2024 unarmored defense', () => {
    const baseEquipment2024 = () => [
      { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } },
      { name: 'Shield', equipment_category: 'Armor', armor_class: { base: 2 } }
    ];

    it('applies Barbarian unarmored defense in 2024 mode', () => {
      const playerStats = {
        rules: '2024',
        class: { name: 'Barbarian' },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Constitution', bonus: 3 }
        ],
        inventory: { equipped: [] },
        automation: { passives: [] }
      };

      const [ac] = rules.getArmorClass(baseEquipment2024(), playerStats);

      expect(ac).toBe(15);
    });

    it('applies Draconic Sorcery unarmored defense (10 + Dex + Cha)', () => {
      const playerStats = {
        rules: '2024',
        class: { name: 'Sorcerer', major: { name: 'Draconic Sorcery' } },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Charisma', bonus: 3 }
        ],
        inventory: { equipped: [] },
        automation: { passives: [] }
      };

      const [ac] = rules.getArmorClass(baseEquipment2024(), playerStats);

      expect(ac).toBe(15);
    });

    it('does not apply Draconic Sorcery unarmored defense when wearing armor', () => {
      const playerStats = {
        rules: '2024',
        class: { name: 'Sorcerer', major: { name: 'Draconic Sorcery' } },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Charisma', bonus: 3 }
        ],
        inventory: { equipped: ['Leather Armor'] },
        automation: { passives: [] }
      };

      const [ac] = rules.getArmorClass(baseEquipment2024(), playerStats);

      expect(ac).toBe(13);
    });

    it('applies College of Dance unarmored defense (10 + Dex + Cha)', () => {
      const playerStats = {
        rules: '2024',
        class: { name: 'Bard', subclass: { name: 'College of Dance' } },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Charisma', bonus: 4 }
        ],
        inventory: { equipped: [] },
        automation: { passives: [] }
      };

      const [ac] = rules.getArmorClass(baseEquipment2024(), playerStats);

      expect(ac).toBe(16);
    });

    it('prefers armor AC over College of Dance when armor is better', () => {
      const equipment = [
        ...baseEquipment2024(),
        { name: 'Chain Mail', equipment_category: 'Armor', armor_category: 'Medium', armor_class: { base: 16, dex_bonus: false } }
      ];
      const playerStats = {
        rules: '2024',
        class: { name: 'Bard', subclass: { name: 'College of Dance' } },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Charisma', bonus: 2 }
        ],
        inventory: { equipped: ['Chain Mail'] },
        automation: { passives: [] }
      };

      const [ac] = rules.getArmorClass(equipment, playerStats);

      // Chain Mail: 16, College of Dance: 10 + 2 + 2 = 14
      expect(ac).toBe(16);
    });
  });

  // === 2024 RULES: Passive Buffs ===

  describe('2024 passive buffs', () => {
    const baseEquipment2024 = () => [
      { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } },
      { name: 'Shield', equipment_category: 'Armor', armor_class: { base: 2 } }
    ];

    it('applies Defense feat ac_bonus when wearing light armor', () => {
      const equipment = [
        ...baseEquipment2024(),
        { name: 'Leather', equipment_category: 'Armor', armor_category: 'Light', armor_class: { base: 11, dex_bonus: true, max_bonus: null } }
      ];
      const playerStats = {
        rules: '2024',
        class: { name: 'Fighter' },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: ['Leather'] },
        automation: {
          passives: [
            { type: 'passive_buff', name: 'Defense', effect: 'ac_bonus', bonus: 1, condition: 'wearing_light_medium_or_heavy_armor' }
          ]
        }
      };

      const [ac, formula] = rules.getArmorClass(equipment, playerStats);

      expect(ac).toBe(14);
      expect(formula).toContain('Defense (+1)');
    });

    it('applies Defense feat ac_bonus when wearing medium armor', () => {
      const equipment = [
        ...baseEquipment2024(),
        { name: 'Chain Mail', equipment_category: 'Armor', armor_category: 'Medium', armor_class: { base: 16, dex_bonus: false } }
      ];
      const playerStats = {
        rules: '2024',
        class: { name: 'Fighter' },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: ['Chain Mail'] },
        automation: {
          passives: [
            { type: 'passive_buff', name: 'Defense', effect: 'ac_bonus', bonus: 1, condition: 'wearing_light_medium_or_heavy_armor' }
          ]
        }
      };

      const [ac] = rules.getArmorClass(equipment, playerStats);

      expect(ac).toBe(17);
    });

    it('applies Defense feat ac_bonus when wearing heavy armor', () => {
      const equipment = [
        ...baseEquipment2024(),
        { name: 'Plate', equipment_category: 'Armor', armor_category: 'Heavy', armor_class: { base: 18, dex_bonus: false } }
      ];
      const playerStats = {
        rules: '2024',
        class: { name: 'Fighter' },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: ['Plate'] },
        automation: {
          passives: [
            { type: 'passive_buff', name: 'Defense', effect: 'ac_bonus', bonus: 1, condition: 'wearing_light_medium_or_heavy_armor' }
          ]
        }
      };

      const [ac] = rules.getArmorClass(equipment, playerStats);

      expect(ac).toBe(19);
    });

    it('does not apply Defense feat ac_bonus when unarmored', () => {
      const playerStats = {
        rules: '2024',
        class: { name: 'Fighter' },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: [] },
        automation: {
          passives: [
            { type: 'passive_buff', name: 'Defense', effect: 'ac_bonus', bonus: 1, condition: 'wearing_light_medium_or_heavy_armor' }
          ]
        }
      };

      const [ac] = rules.getArmorClass(baseEquipment2024(), playerStats);

      expect(ac).toBe(12);
    });

    it('applies unconditional ac_bonus passives', () => {
      const playerStats = {
        rules: '2024',
        class: { name: 'Wizard' },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: [] },
        automation: {
          passives: [
            { type: 'passive_buff', name: 'Magic Armor', effect: 'ac_bonus', bonus: 2 }
          ]
        }
      };

      const [ac, formula] = rules.getArmorClass(baseEquipment2024(), playerStats);

      expect(ac).toBe(14);
      expect(formula).toContain('Magic Armor (+2)');
    });

    it('does not apply Defense when armor is not in equipment catalog', () => {
      const playerStats = {
        rules: '2024',
        class: { name: 'Fighter' },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: ['Mystery Armor'] },
        automation: {
          passives: [
            { type: 'passive_buff', name: 'Defense', effect: 'ac_bonus', bonus: 1, condition: 'wearing_light_medium_or_heavy_armor' }
          ]
        }
      };

      const [ac] = rules.getArmorClass(baseEquipment2024(), playerStats);

      expect(ac).toBe(12);
    });
  });

  // === 2024 RULES: Medium Armor Master ===

  describe('2024 medium armor master', () => {
    it('applies Medium Armor Master dex bonus increase when wearing medium armor and Dex >= 16', () => {
      const equipment = [
        { name: 'Chain Shirt', equipment_category: 'Armor', armor_category: 'Medium', armor_class: { base: 13, dex_bonus: true, max_bonus: 2 } }
      ];
      const playerStats = {
        rules: '2024',
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Dexterity', bonus: 3, totalScore: 16 },
          { name: 'Constitution', bonus: 2 }
        ],
        inventory: { equipped: ['Chain Shirt'] },
        automation: {
          passives: [
            { type: 'passive_buff', name: 'Medium Armor Master', effect: 'medium_armor_dex_bonus_increase', bonusExpression: '1' }
          ]
        }
      };

      const [ac, formula] = rules.getArmorClass(equipment, playerStats);

      expect(ac).toBe(16);
      expect(formula).toContain('Medium Armor Master (+1)');
    });

    it('does not apply Medium Armor Master when Dex < 16', () => {
      const equipment = [
        { name: 'Chain Shirt', equipment_category: 'Armor', armor_category: 'Medium', armor_class: { base: 13, dex_bonus: true, max_bonus: 2 } }
      ];
      const playerStats = {
        rules: '2024',
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Dexterity', bonus: 2, totalScore: 14 },
          { name: 'Constitution', bonus: 2 }
        ],
        inventory: { equipped: ['Chain Shirt'] },
        automation: {
          passives: [
            { type: 'passive_buff', name: 'Medium Armor Master', effect: 'medium_armor_dex_bonus_increase', bonusExpression: '1' }
          ]
        }
      };

      const [ac] = rules.getArmorClass(equipment, playerStats);

      expect(ac).toBe(15);
    });

    it('does not apply Medium Armor Master when wearing light armor', () => {
      const equipment = [
        { name: 'Studded Leather', equipment_category: 'Armor', armor_category: 'Light', armor_class: { base: 12, dex_bonus: true, max_bonus: null } }
      ];
      const playerStats = {
        rules: '2024',
        class: { name: 'Rogue' },
        abilities: [
          { name: 'Dexterity', bonus: 5, totalScore: 20 },
          { name: 'Constitution', bonus: 2 }
        ],
        inventory: { equipped: ['Studded Leather'] },
        automation: {
          passives: [
            { type: 'passive_buff', name: 'Medium Armor Master', effect: 'medium_armor_dex_bonus_increase', bonusExpression: '1' }
          ]
        }
      };

      const [ac] = rules.getArmorClass(equipment, playerStats);

      expect(ac).toBe(17);
    });

    it('does not apply Medium Armor Master when not wearing any armor', () => {
      const playerStats = {
        rules: '2024',
        class: { name: 'Wizard' },
        abilities: [
          { name: 'Dexterity', bonus: 3, totalScore: 16 },
          { name: 'Constitution', bonus: 2 }
        ],
        inventory: { equipped: [] },
        automation: {
          passives: [
            { type: 'passive_buff', name: 'Medium Armor Master', effect: 'medium_armor_dex_bonus_increase', bonusExpression: '1' }
          ]
        }
      };

      const [ac] = rules.getArmorClass([], playerStats);

      expect(ac).toBe(13);
    });
  });
});
