// @maintained-by-ai
// 2024-only divergences of rules.getArmorClass (rules-armorClass.js).
// Shared rows are pinned VERBATIM elsewhere and are NOT repeated here:
//  - 5e twin core/rules-armorClass.test.js: unarmored baseline 10 + Dex
//    ('handles empty equipped array'), Barbarian UD ('applies Barbarian unarmored
//    defense (10 + Dex + Con)'), and the applyMediumArmorMaster helper gates
//    ('5e medium armor master' block: Dex < 16 / light armor / no armor negatives).
//  - rules.test.js: 'calculates barbarian unarmored defense in 2024' (AC 15),
//    'calculates college of dance unarmored defense in 2024' (AC 17),
//    'does not apply defense fighting style for 2024' (unarmored base 12 dispatch).
// Armor rows are disk-read from public/data/equipment.json (the single shared
// catalog — public/data/2024/ ships no equipment file), never transcribed.
// Disk rows as read: Leather=Light base 11 (dex, no cap), Chain Mail=Heavy base 16
// (no dex), Plate Armor=Heavy base 18 (no dex), Chain Shirt=Medium base 13
// (dex max 2), Shield=Shield base 2.
import { describe, it, expect } from 'vitest';

import rules from '../rules.js';
import DISK_EQUIPMENT from '../../../../public/data/equipment.json';

const ARMOR_CATALOG = DISK_EQUIPMENT.filter(item => item.equipment_category === 'Armor');

function stats2024({ equipped = [], abilities, passives = [], cls }) {
  return {
    name: 'AcTest2024',
    rules: '2024',
    class: { name: 'Fighter', ...cls },
    abilities,
    inventory: { equipped },
    automation: { passives }
  };
}

const DEX2 = [{ name: 'Dexterity', bonus: 2 }];
const defenseFeat = {
  type: 'passive_buff',
  name: 'Defense',
  effect: 'ac_bonus',
  bonus: 1,
  condition: 'wearing_light_medium_or_heavy_armor'
};

describe('rules.getArmorClass — 2024 ruleset', () => {
  // 2024-only lane: the Defense feat arrives as an automation ac_bonus passive
  // (applyAcBonusPassives / acBonusConditionMet, rules-armorClass.js:186-207).
  describe('2024 Defense feat ac_bonus condition matrix', () => {
    it.each([
      { label: 'light armor qualifies', equipped: ['Leather'], ac: 14 },
      { label: 'medium armor qualifies', equipped: ['Chain Mail'], ac: 17 },
      { label: 'heavy armor qualifies', equipped: ['Plate Armor'], ac: 19 },
      { label: 'unarmored does not qualify', equipped: [], ac: 12 },
      { label: 'armor missing from catalog does not qualify', equipped: ['Mystery Armor'], ac: 12 }
    ])('$label', ({ equipped, ac }) => {
      const playerStats = stats2024({ equipped, abilities: DEX2, passives: [defenseFeat] });

      const [actualAc, formula] = rules.getArmorClass(ARMOR_CATALOG, playerStats);

      expect(actualAc).toBe(ac);
      if (ac > 12) {
        expect(formula).toContain('Defense (+1)');
      } else {
        expect(formula).not.toContain('Defense');
      }
    });

    it('applies ac_bonus passives without a condition unarmored', () => {
      const playerStats = stats2024({
        abilities: DEX2,
        passives: [{ type: 'passive_buff', name: 'Magic Armor', effect: 'ac_bonus', bonus: 2 }]
      });

      const [ac, formula] = rules.getArmorClass(ARMOR_CATALOG, playerStats);

      expect(ac).toBe(14);
      expect(formula).toContain('Magic Armor (+2)');
    });
  });

  // 2024 disk canon (public/data/2024/classes.json): Draconic Sorcery lv1
  // "Draconic Resilience: While not wearing armor, base AC = 10 + Dexterity +
  // Charisma modifiers" (read from class.major); College of Dance lv3
  // "Dazzling Footwork ... Unarmored Defense: base AC equals 10 plus Dexterity
  // and Charisma" — gated on subclass, armor blocks it in both cases.
  describe('2024 10 + Dex + Cha unarmored defenses', () => {
    const draconic = { name: 'Sorcerer', major: { name: 'Draconic Sorcery' } };
    const dance = { name: 'Bard', subclass: { name: 'College of Dance' } };

    it.each([
      { label: 'Draconic Sorcery unarmored (10+2+3)', cls: draconic, abilities: [{ name: 'Dexterity', bonus: 2 }, { name: 'Charisma', bonus: 3 }], equipped: [], ac: 15 },
      { label: 'Draconic Sorcery blocked while armored (Leather 11+2 beats ungated 15)', cls: draconic, abilities: [{ name: 'Dexterity', bonus: 2 }, { name: 'Charisma', bonus: 3 }], equipped: ['Leather'], ac: 13 },
      { label: 'College of Dance unarmored (10+2+4)', cls: dance, abilities: [{ name: 'Dexterity', bonus: 2 }, { name: 'Charisma', bonus: 4 }], equipped: [], ac: 16 },
      { label: 'College of Dance blocked while armored (armor branch wins in computeBaseArmorClass)', cls: dance, abilities: [{ name: 'Dexterity', bonus: 2 }, { name: 'Charisma', bonus: 2 }], equipped: ['Chain Mail'], ac: 16 }
    ])('$label', ({ cls, abilities, equipped, ac }) => {
      const playerStats = stats2024({ cls, abilities, equipped });

      const [actualAc, formula] = rules.getArmorClass(ARMOR_CATALOG, playerStats);

      expect(actualAc).toBe(ac);
      if (equipped.length) {
        expect(formula).toContain('Armor (');
        expect(formula).not.toContain('Charisma Bonus');
      } else {
        expect(formula).toContain('Charisma Bonus');
      }
    });

    it('Barbarian armored takes armor AC (2024 gate), unlike the 5e twin max() quirk', () => {
      // 5e twin rules-armorClass.test.js VERBATIM: 'prefers unarmored defense over
      // armor when it is better' — same input in 5e returns 18 (10+4+4 overwrites
      // Chain Mail 16). 2024 gates Barbarian UD on !armorName (rules-armorClass.js:174),
      // so armored Barbarian stays at the armor value.
      const playerStats = stats2024({
        cls: { name: 'Barbarian' },
        abilities: [{ name: 'Dexterity', bonus: 4 }, { name: 'Constitution', bonus: 4 }],
        equipped: ['Chain Mail']
      });

      const [ac] = rules.getArmorClass(ARMOR_CATALOG, playerStats);

      expect(ac).toBe(16);
    });
  });

  // FIXED #1249: College of Dance + shield. Disk: Dazzling Footwork requires
  // "aren't wearing armor or wielding a shield". computeBaseArmorClass now gates
  // the Dance branch on !shield (mirroring applyUnarmoredDefense2024:158), so a
  // shielded dancer falls through to the plain unarmored lane and the shield
  // stacks there: 10 + Dex 2 + Shield 2 = 14 (pre-fix: dance 10+2+4 = 16, then
  // the :241 shield lane stacked +2 on the Dance formula for an illegal 18).
  describe('College of Dance shield gate (#1249)', () => {
    it('shield blocks the Dance formula: falls to unarmored 10 + Dex + Shield = 14', () => {
      const playerStats = stats2024({
        cls: { name: 'Bard', subclass: { name: 'College of Dance' } },
        abilities: [{ name: 'Dexterity', bonus: 2 }, { name: 'Charisma', bonus: 4 }],
        equipped: ['Shield']
      });

      const [ac, formula] = rules.getArmorClass(ARMOR_CATALOG, playerStats);

      expect(ac).toBe(14);
      expect(formula).toContain('Unarmored AC (10) + Dexterity Bonus (2)');
      expect(formula).toContain('Shield (2)');
      expect(formula).not.toContain('Charisma Bonus');
    });

    it('magic shield also blocks the Dance branch (parseMagicItemName gate): 10 + Dex 2 + Shield 2 + 1 = 15', () => {
      const playerStats = stats2024({
        cls: { name: 'Bard', subclass: { name: 'College of Dance' } },
        abilities: [{ name: 'Dexterity', bonus: 2 }, { name: 'Charisma', bonus: 4 }],
        equipped: ['+1 Shield']
      });

      const [ac, formula] = rules.getArmorClass(ARMOR_CATALOG, playerStats);

      expect(ac).toBe(15);
      expect(formula).not.toContain('Charisma Bonus');
    });
  });

  // FIXED #340 (#ledger:1253): shield no longer dropped when Barbarian UD
  // overwrites. Disk public/data/2024/classes.json Barbarian lv1
  // 'Unarmored Defense': "While you aren't wearing any armor, your base Armor
  // Class equals 10 plus your Dexterity and Constitution modifiers." — a shield
  // is not armor (armorName derivation excludes armor_category 'Shield'), so
  // UD applies and applyShield's :251 +2 must survive the overwrite.
  // Pre-fix the branch replaced armorClass with bare 10+Dex+Con (15); the
  // former QUIRK PIN recorded that drop. Rules-correct 10 + Dex 2 + Con 3 +
  // Shield 2 = 17, now the actual. The College of Dance twin keeps its
  // !shield gate — its disk text explicitly says "aren't wearing armor or
  // wielding a shield" (#1249 lane above).
  describe('FIXED #340: Barbarian UD keeps the shield +2 (disk: no shield clause)', () => {
    const barbarian = (equipped, dex = 2, con = 3) => stats2024({
      cls: { name: 'Barbarian' },
      abilities: [{ name: 'Dexterity', bonus: dex }, { name: 'Constitution', bonus: con }],
      equipped
    });

    it('shielded Barbarian: 10 + Dex 2 + Con 3 + Shield 2 = 17 (pre-fix dropped the +2 for 15)', () => {
      const [ac, formula] = rules.getArmorClass(ARMOR_CATALOG, barbarian(['Shield']));

      expect(ac).toBe(17);
      expect(formula).toContain('Unarmored AC (10) + Dexterity Bonus (2) + Constitution Bonus (3)');
      expect(formula).toContain('Shield (2)');
    });

    it('magic shield stacks through the UD overwrite: 10 + Dex 2 + Con 3 + Shield 2 + magic 1 = 18', () => {
      const [ac, formula] = rules.getArmorClass(ARMOR_CATALOG, barbarian(['+1 Shield']));

      expect(ac).toBe(18);
      expect(formula).toContain('Shield Magic Bonus (1)');
    });

    it('armor still blocks UD (!armorName gate): Chain Mail 16 + Shield 2 = 18, no UD bytes', () => {
      const [ac, formula] = rules.getArmorClass(ARMOR_CATALOG, barbarian(['Chain Mail', 'Shield']));

      expect(ac).toBe(18);
      expect(formula).toContain('Armor (16)');
      expect(formula).not.toContain('Constitution Bonus');
    });

    it('falsifier — the +2 is the shield law, not free CON inflation: unshielded stays 10+Dex+Con = 15', () => {
      const [ac, formula] = rules.getArmorClass(ARMOR_CATALOG, barbarian([]));

      expect(ac).toBe(15);
      expect(formula).not.toContain('Shield');
    });
  });

  // Same-name feat exists in both rulesets and the helper (applyMediumArmorMaster)
  // is shared; its Dex<16 / light / unarmored false-gates are pinned VERBATIM by
  // the 5e twin '5e medium armor master' block. This row pins only the 2024 call
  // site (rules-armorClass.js:259-260), which the 5e lane cannot reach.
  it('2024 Medium Armor Master applies on the 2024 passives lane (Chain Shirt 13 + Dex cap 2 + 1)', () => {
    const playerStats = stats2024({
      abilities: [{ name: 'Dexterity', bonus: 3, totalScore: 16 }, { name: 'Constitution', bonus: 2 }],
      equipped: ['Chain Shirt'],
      passives: [
        { type: 'passive_buff', name: 'Medium Armor Master', effect: 'medium_armor_dex_bonus_increase', bonusExpression: '1' }
      ]
    });

    const [ac, formula] = rules.getArmorClass(ARMOR_CATALOG, playerStats);

    expect(ac).toBe(16);
    expect(formula).toContain('Medium Armor Master (+1)');
  });
});
