// @improved-by-ai
import { describe, it, expect } from 'vitest';

import rules from '../rules.js';

describe('rules.getArmorClass', () => {
  const createEquipment = () => [
    { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } },
    { name: 'Chain Mail', equipment_category: 'Armor', armor_class: { base: 16, dex_bonus: false } },
    { name: 'Breastplate', equipment_category: 'Armor', armor_class: { base: 14, dex_bonus: true, max_bonus: 2 } },
    { name: 'Shield', equipment_category: 'Armor', armor_class: { base: 2 } },
    { name: 'Longsword', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d8', damage_type: 'Slashing' } }
  ];

  // === 5E RULES: Unarmored Defense ===

  describe('unarmored defense', () => {
    it('calculates AC from Dexterity alone for non-class characters', () => {
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

      expect(ac).toBe(13);
    });

    it('handles negative Dexterity bonus', () => {
      const playerStats = {
        class: { name: 'Wizard' },
        abilities: [
          { name: 'Dexterity', bonus: -2 }
        ],
        inventory: { equipped: [] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(8);
    });

    it('applies Monk wisdom bonus to unarmored AC', () => {
      const playerStats = {
        class: { name: 'Monk' },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Wisdom', bonus: 3 }
        ],
        inventory: { equipped: [] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(15);
    });

    it('applies Barbarian unarmored defense (10 + Dex + Con)', () => {
      const playerStats = {
        class: { name: 'Barbarian' },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Constitution', bonus: 3 }
        ],
        inventory: { equipped: [] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(15);
    });

    it('applies Draconic Sorcerer unarmored defense (13 + Dex)', () => {
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

      expect(ac).toBe(15);
    });

    it('prefers armor AC over unarmored defense when armor is better', () => {
      const playerStats = {
        class: { name: 'Barbarian' },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Constitution', bonus: 1 }
        ],
        inventory: { equipped: ['Chain Mail'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      // Chain mail: 16 (no dex), Barbarian: 10 + 2 + 1 = 13
      expect(ac).toBe(16);
    });

    it('prefers unarmored defense over armor when it is better', () => {
      const playerStats = {
        class: { name: 'Barbarian' },
        abilities: [
          { name: 'Dexterity', bonus: 4 },
          { name: 'Constitution', bonus: 4 }
        ],
        inventory: { equipped: ['Chain Mail'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      // Chain mail: 16, Barbarian: 10 + 4 + 4 = 18
      expect(ac).toBe(18);
    });
  });

  // === 5E RULES: Armor ===

  describe('armored defense', () => {
    it('calculates AC with leather armor (dex bonus allowed)', () => {
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

      expect(ac).toBe(13);
    });

    it('caps Dexterity bonus with breastplate max_bonus of 2', () => {
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

      expect(ac).toBe(16);
    });

    it('excludes Dexterity bonus with chain mail (heavy armor)', () => {
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Dexterity', bonus: 5 },
          { name: 'Constitution', bonus: 2 }
        ],
        inventory: { equipped: ['Chain Mail'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(16);
    });
  });

  // === 5E RULES: Shields ===

  describe('shield bonuses', () => {
    it('adds +2 for Shield when equipped', () => {
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

      expect(ac).toBe(15);
    });

    it('adds magic bonus for +1 Shield', () => {
      const equipment = [
        { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } },
        { name: 'Shield', equipment_category: 'Armor', armor_class: { base: 2 } }
      ];
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: ['Leather Armor', '+1 Shield'] }
      };

      const [ac] = rules.getArmorClass(equipment, playerStats);

      expect(ac).toBe(16);
    });
  });

  // === 5E RULES: Magic Items ===

  describe('magic item bonuses', () => {
    it('adds +1 for +1 Leather Armor', () => {
      const equipment = [
        { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } }
      ];
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: ['+1 Leather Armor'] }
      };

      const [ac] = rules.getArmorClass(equipment, playerStats);

      expect(ac).toBe(14);
    });

    it('stacks Cloak and Ring of Protection (+2 total)', () => {
      const playerStats = {
        class: { name: 'Wizard' },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: [], magicItems: [{ name: 'Cloak of Protection' }, { name: 'Ring of Protection' }] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(14);
    });

    it('stacks magic armor and magic shield bonuses', () => {
      const equipment = [
        { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } },
        { name: 'Shield', equipment_category: 'Armor', armor_class: { base: 2 } }
      ];
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: ['+1 Leather Armor', '+2 Shield'] }
      };

      const [ac] = rules.getArmorClass(equipment, playerStats);

      expect(ac).toBe(18);
    });
  });

  // === 5E RULES: Fighting Styles ===

  describe('fighting styles', () => {
    it('applies Defense fighting style (+1 AC) with armor', () => {
      const playerStats = {
        class: {
          name: 'Fighter',
          fightingStyles: ['Defense']
        },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: ['Leather Armor'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(14);
    });

    it('applies Unarmed Fighting fighting style (+2 AC) when no weapons/shield/armor equipped', () => {
      const playerStats = {
        class: {
          name: 'Fighter',
          fightingStyles: ['Unarmed Fighting']
        },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: [] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(14);
    });

    it('does not apply Unarmed Fighting when a weapon is equipped', () => {
      const playerStats = {
        class: {
          name: 'Fighter',
          fightingStyles: ['Unarmed Fighting']
        },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: ['Longsword'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(12);
    });

    it('applies Unarmed Fighting with armor equipped', () => {
      const playerStats = {
        class: {
          name: 'Fighter',
          fightingStyles: ['Unarmed Fighting']
        },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: ['Leather Armor'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(15);
    });

    it('does not apply Unarmed Fighting when a shield is equipped', () => {
      const playerStats = {
        class: {
          name: 'Fighter',
          fightingStyles: ['Unarmed Fighting']
        },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: ['Shield'] }
      };

      const equipment = [
        { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } },
        { name: 'Shield', equipment_category: 'Armor', armor_category: 'Shield', armor_class: { base: 2 } },
        { name: 'Longsword', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d8', damage_type: 'Slashing' } }
      ];

      const [ac] = rules.getArmorClass(equipment, playerStats);

      expect(ac).toBe(14);
    });

    it('applies Unarmed Fighting in 2024 rules', () => {
      const playerStats = {
        rules: '2024',
        class: {
          name: 'Fighter',
          fightingStyles: ['Unarmed Fighting']
        },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: [], magicItems: [] },
        automation: { passives: [], specialActions: [], reactions: [], bonusActions: [] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(14);
    });
  });

  // === 5E RULES: Unknown items ===

  describe('unknown item handling', () => {
    it('gracefully handles equipped items not in equipment catalog', () => {
      const limitedEquipment = [
        { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } }
      ];
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: ['Unknown Item', 'Leather Armor'] }
      };

      const [ac] = rules.getArmorClass(limitedEquipment, playerStats);

      expect(ac).toBe(13);
    });

    it('handles empty equipped array', () => {
      const playerStats = {
        class: { name: 'Wizard' },
        abilities: [{ name: 'Dexterity', bonus: 3 }],
        inventory: { equipped: [] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(13);
    });
  });

  // === 5E RULES: Formula ===

  describe('formula output', () => {
    it('returns contributions formula for unarmored character', () => {
      const playerStats = {
        class: { name: 'Wizard' },
        abilities: [{ name: 'Dexterity', bonus: 3 }],
        inventory: { equipped: [] }
      };

      const [ac, formula] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(13);
      expect(formula).toContain('Unarmored AC (10) + Dexterity Bonus (3)');
    });

    it('returns contributions formula for armored character with shield', () => {
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: ['Leather Armor', 'Shield'] }
      };

      const [ac, formula] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(15);
      expect(formula).toContain('Armor (11)');
      expect(formula).toContain('Dexterity Bonus (2)');
      expect(formula).toContain('Shield (2)');
    });

    it('returns contributions formula with magic armor', () => {
      const equipment = [
        { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } }
      ];
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        inventory: { equipped: ['+1 Leather Armor'] }
      };

      const [ac, formula] = rules.getArmorClass(equipment, playerStats);

      expect(ac).toBe(14);
      expect(formula).toContain('Armor Magic Bonus (1)');
    });
  });

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
