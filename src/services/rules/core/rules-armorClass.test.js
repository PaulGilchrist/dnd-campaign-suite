// @maintained-by-ai
// 5e canon rows of rules.getArmorClass (src/services/rules/rules-armorClass.js).
// 2024 divergences live in rules-armorClass-2024.test.js (which cites several of
// the VERBATIM test names pinned here); the mage_armor runtime-buff lane lives in
// rules-armorClass.mageArmor.test.js — neither is repeated in this file.
// Armor rows are disk-read from public/data/equipment.json (the single shared
// catalog — public/data/2024/ ships no equipment file), never transcribed.
// Disk rows as read: Leather=Light base 11 (dex, no cap), Studded Leather=Light
// base 12, Breastplate=Medium base 14 (dex max 2), Chain Shirt=Medium base 13
// (dex max 2), Chain Mail=Heavy base 16 (no dex), Shield=Shield base 2,
// Longsword=Weapon.
import { describe, it, expect } from 'vitest';

import rules from '../rules.js';
import DISK_EQUIPMENT from '../../../../public/data/equipment.json';

function stats5e({ equipped = [], abilities, passives = [], magicItems, cls }) {
  return {
    name: 'AcTest5e',
    rules: '5e',
    class: { name: 'Fighter', ...cls },
    abilities,
    inventory: { equipped, ...(magicItems ? { magicItems } : {}) },
    automation: { passives }
  };
}

const DEX2 = [{ name: 'Dexterity', bonus: 2 }];
const mamPassive = [
  { type: 'passive_buff', name: 'Medium Armor Master', effect: 'medium_armor_dex_bonus_increase', bonusExpression: '1' }
];

describe('rules.getArmorClass — 5e ruleset', () => {
  describe('unarmored defense', () => {
    it('handles empty equipped array', () => {
      const playerStats = stats5e({
        cls: { name: 'Wizard' },
        abilities: [
          { name: 'Dexterity', bonus: 3 },
          { name: 'Constitution', bonus: 2 },
          { name: 'Wisdom', bonus: 1 }
        ]
      });

      const [ac, formula] = rules.getArmorClass(DISK_EQUIPMENT, playerStats);

      expect(ac).toBe(13);
      expect(formula).toContain('Unarmored AC (10) + Dexterity Bonus (3)');
      expect(formula).not.toContain('Armor (');
    });

    it('applies a negative Dexterity modifier below the 10 base', () => {
      const playerStats = stats5e({ cls: { name: 'Wizard' }, abilities: [{ name: 'Dexterity', bonus: -2 }] });

      const [ac] = rules.getArmorClass(DISK_EQUIPMENT, playerStats);

      expect(ac).toBe(8);
    });

    it('applies Monk wisdom bonus to unarmored AC', () => {
      const playerStats = stats5e({
        cls: { name: 'Monk' },
        abilities: [{ name: 'Dexterity', bonus: 2 }, { name: 'Wisdom', bonus: 3 }]
      });

      const [ac, formula] = rules.getArmorClass(DISK_EQUIPMENT, playerStats);

      expect(ac).toBe(15);
      expect(formula).toContain('Monk Wisdom Bonus (3)');
    });

    it('applies Barbarian unarmored defense (10 + Dex + Con)', () => {
      const playerStats = stats5e({
        cls: { name: 'Barbarian' },
        abilities: [{ name: 'Dexterity', bonus: 2 }, { name: 'Constitution', bonus: 3 }]
      });

      const [ac, formula] = rules.getArmorClass(DISK_EQUIPMENT, playerStats);

      expect(ac).toBe(15);
      expect(formula).toContain('Unarmored AC (10) + Dexterity Bonus (2) + Constitution Bonus (3)');
    });

    it('applies Draconic Sorcerer unarmored defense (13 + Dex)', () => {
      const playerStats = stats5e({
        cls: { name: 'Sorcerer', subclass: { name: 'Draconic' } },
        abilities: [{ name: 'Dexterity', bonus: 2 }, { name: 'Constitution', bonus: 2 }]
      });

      const [ac, formula] = rules.getArmorClass(DISK_EQUIPMENT, playerStats);

      expect(ac).toBe(15);
      expect(formula).toContain('Unarmored AC (13) + Dexterity Bonus (2)');
    });

    it('prefers armor AC over unarmored defense when armor is better', () => {
      const playerStats = stats5e({
        cls: { name: 'Barbarian' },
        abilities: [{ name: 'Dexterity', bonus: 2 }, { name: 'Constitution', bonus: 1 }],
        equipped: ['Chain Mail']
      });

      const [ac] = rules.getArmorClass(DISK_EQUIPMENT, playerStats);

      // Chain mail: 16 (no dex), Barbarian: 10 + 2 + 1 = 13
      expect(ac).toBe(16);
    });

    it('prefers unarmored defense over armor when it is better', () => {
      // QUIRK pin (cited verbatim by the 2024 twin): applyUnarmoredDefense5e
      // (rules-armorClass.js:135-152) is an ungated max() — armored Barbarian
      // overwrites Chain Mail 16 with 10 + 4 + 4 = 18. 2024 gates this on
      // !armorName (:174); 5e does not.
      const playerStats = stats5e({
        cls: { name: 'Barbarian' },
        abilities: [{ name: 'Dexterity', bonus: 4 }, { name: 'Constitution', bonus: 4 }],
        equipped: ['Chain Mail']
      });

      const [ac] = rules.getArmorClass(DISK_EQUIPMENT, playerStats);

      expect(ac).toBe(18);
    });
  });

  // Light/medium/heavy dex handling plus the shield stack, all from disk rows.
  describe('armored defense', () => {
    it.each([
      { label: 'light armor adds full Dexterity (Leather 11 + 5)', equipped: ['Leather'], dex: 5, ac: 16, formula: ['Armor (11)', 'Dexterity Bonus (5)'] },
      { label: 'medium armor caps Dexterity at +2 (Breastplate 14 + 2)', equipped: ['Breastplate'], dex: 4, ac: 16, formula: ['Armor (14)', 'Dexterity Bonus (2)'] },
      { label: 'heavy armor excludes Dexterity (Chain Mail 16)', equipped: ['Chain Mail'], dex: 5, ac: 16, formula: ['Armor (16)'], noDex: true },
      { label: 'shield stacks +2 (Leather 11 + Dex 2 + Shield 2)', equipped: ['Leather', 'Shield'], dex: 2, ac: 15, formula: ['Armor (11)', 'Dexterity Bonus (2)', 'Shield (2)'] },
      { label: 'equipped items missing from the catalog are ignored', equipped: ['Unknown Item', 'Leather'], dex: 2, ac: 13, formula: ['Armor (11)'] }
    ])('$label', ({ equipped, dex, ac, formula, noDex }) => {
      const playerStats = stats5e({ equipped, abilities: [{ name: 'Dexterity', bonus: dex }] });

      const [actualAc, actualFormula] = rules.getArmorClass(DISK_EQUIPMENT, playerStats);

      expect(actualAc).toBe(ac);
      formula.forEach(fragment => expect(actualFormula).toContain(fragment));
      if (noDex) {
        expect(actualFormula).not.toContain('Dexterity');
      }
    });
  });

  // Magic bonuses arrive parsed from the equipped name (parseMagicItemName),
  // so the catalog only needs the base disk rows.
  describe('magic item bonuses', () => {
    it.each([
      { label: '+1 Leather armor (11 + Dex 2 + 1)', equipped: ['+1 Leather'], ac: 14, formula: ['Armor Magic Bonus (1)'] },
      { label: '+1 Shield stacks (11 + Dex 2 + Shield 2 + 1)', equipped: ['Leather', '+1 Shield'], ac: 16, formula: ['Shield Magic Bonus (1)'] },
      { label: '+1 armor and +2 shield stack (11 + Dex 2 + 1 + 2 + 2)', equipped: ['+1 Leather', '+2 Shield'], ac: 18, formula: ['Armor Magic Bonus (1)', 'Shield Magic Bonus (2)'] }
    ])('$label', ({ equipped, ac, formula }) => {
      const playerStats = stats5e({ equipped, abilities: DEX2 });

      const [actualAc, actualFormula] = rules.getArmorClass(DISK_EQUIPMENT, playerStats);

      expect(actualAc).toBe(ac);
      formula.forEach(fragment => expect(actualFormula).toContain(fragment));
    });

    it('stacks Cloak and Ring of Protection (+2 total)', () => {
      const playerStats = stats5e({
        cls: { name: 'Wizard' },
        abilities: DEX2,
        magicItems: [{ name: 'Cloak of Protection' }, { name: 'Ring of Protection' }]
      });

      const [ac, formula] = rules.getArmorClass(DISK_EQUIPMENT, playerStats);

      expect(ac).toBe(14);
      expect(formula).toContain('Cloak of Protection (1)');
      expect(formula).toContain('Ring of Protection (1)');
    });
  });

  describe('fighting styles', () => {
    it.each([
      { label: 'Defense adds +1 while armored', style: 'Defense', equipped: ['Leather'], ac: 14, bonus: true },
      { label: 'Defense does not apply unarmored', style: 'Defense', equipped: [], ac: 12, bonus: false },
      { label: 'Unarmed Fighting adds +2 with empty hands', style: 'Unarmed Fighting', equipped: [], ac: 14, bonus: true },
      { label: 'Unarmed Fighting does not apply with a weapon', style: 'Unarmed Fighting', equipped: ['Longsword'], ac: 12, bonus: false },
      { label: 'Unarmed Fighting applies with armor (no weapon or shield held)', style: 'Unarmed Fighting', equipped: ['Leather'], ac: 15, bonus: true },
      { label: 'Unarmed Fighting does not apply with a shield', style: 'Unarmed Fighting', equipped: ['Shield'], ac: 14, bonus: false }
    ])('$label', ({ style, equipped, ac, bonus }) => {
      const playerStats = stats5e({ cls: { fightingStyles: [style] }, equipped, abilities: DEX2 });

      const [actualAc, formula] = rules.getArmorClass(DISK_EQUIPMENT, playerStats);

      expect(actualAc).toBe(ac);
      const fragment = style === 'Defense' ? 'Fighting Style Defense' : 'Fighting Style Unarmed';
      if (bonus) {
        expect(formula).toContain(fragment);
      } else {
        expect(formula).not.toContain(fragment);
      }
    });
  });

  // 5e call site of the shared applyMediumArmorMaster helper (rules-armorClass.js:91-107,
  // Dex-16 prerequisite at :94). The 2024 twin pins only its own call site (:259-260).
  describe('5e medium armor master', () => {
    it('applies Medium Armor Master dex bonus increase when wearing medium armor and Dex >= 16', () => {
      const playerStats = stats5e({
        equipped: ['Chain Shirt'],
        abilities: [{ name: 'Dexterity', bonus: 3, totalScore: 16 }, { name: 'Constitution', bonus: 2 }],
        passives: mamPassive
      });

      const [ac, formula] = rules.getArmorClass(DISK_EQUIPMENT, playerStats);

      // Chain Shirt 13 + capped Dex 2 + MAM (+1 over the cap) = 16
      expect(ac).toBe(16);
      expect(formula).toContain('Medium Armor Master (+1)');
    });

    // Note: with max_bonus 2 and bonusExpression '1', a Dex bonus below +3 cannot
    // exceed the raised cap of 3, so these negatives cannot change the AC numerically.
    // They pin the gate's behavior (and its formula label) so a future change to
    // bonusExpression or the cap cannot silently widen it past these faces.
    it.each([
      { label: 'does not apply Medium Armor Master when Dex < 16', equipped: ['Chain Shirt'], abilities: [{ name: 'Dexterity', bonus: 2, totalScore: 14 }, { name: 'Constitution', bonus: 2 }], ac: 15 },
      { label: 'does not apply Medium Armor Master when wearing light armor', equipped: ['Studded Leather'], abilities: [{ name: 'Dexterity', bonus: 5, totalScore: 20 }, { name: 'Constitution', bonus: 2 }], ac: 17 },
      { label: 'does not apply Medium Armor Master when not wearing any armor', equipped: [], abilities: [{ name: 'Dexterity', bonus: 3, totalScore: 16 }, { name: 'Constitution', bonus: 2 }], ac: 13 }
    ])('$label', ({ equipped, abilities, ac }) => {
      const playerStats = stats5e({ equipped, abilities, passives: mamPassive });

      const [actualAc, formula] = rules.getArmorClass(DISK_EQUIPMENT, playerStats);

      expect(actualAc).toBe(ac);
      expect(formula).not.toContain('Medium Armor Master');
    });
  });

  // QUIRK PINS: applyUnarmoredDefense5e (rules-armorClass.js:135-152) replaces the
  // whole accumulated AC (shield included) when its bare formula wins the max().
  // Same family of defect the 2024 twin pins at its own call site.
  describe('QUIRK PINS: 5e unarmored defenses overwrite accumulated AC', () => {
    it.each([
      {
        // Rules-correct Barbarian + shield: 10 + 2 + 3 + shield 2 = 17.
        // UD overwrite (:138-141) drops the shield contribution: actual 15.
        label: 'Barbarian unarmored defense drops shield bonus while shielded (rules-correct 17, actual 15)',
        playerStats: stats5e({ cls: { name: 'Barbarian' }, abilities: [{ name: 'Dexterity', bonus: 2 }, { name: 'Constitution', bonus: 3 }], equipped: ['Shield'] }),
        ac: 15
      },
      {
        // 5e RAW requires "while you aren't wearing armor"; :143 checks only max(),
        // so armored Draconic (Leather 11 + Dex 2 = 13) is overwritten by 13 + 2.
        label: "Draconic unarmored defense overwrites armor AC (rules-correct 13, actual 15)",
        playerStats: stats5e({ cls: { name: 'Sorcerer', subclass: { name: 'Draconic' } }, abilities: [{ name: 'Dexterity', bonus: 2 }], equipped: ['Leather'] }),
        ac: 15
      }
    ])('$label', ({ playerStats, ac }) => {
      const [actualAc, formula] = rules.getArmorClass(DISK_EQUIPMENT, playerStats);

      expect(actualAc).toBe(ac);
      expect(formula).not.toContain('Shield (');
      expect(formula).not.toContain('Armor (');
    });
  });
});
