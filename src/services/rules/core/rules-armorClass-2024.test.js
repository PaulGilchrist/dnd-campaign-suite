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

  // QUIRK PINS: 2024 unarmored defense x shield. The 2024 disk texts differ
  // feature-by-feature, and the shared shield lane (applyShield at :241 runs
  // BEFORE applyUnarmoredDefense2024) honors neither correctly. Reported as
  // SOURCE BUGS; these rows pin current behavior so any change is deliberate.
  describe('QUIRK PINS: shield interaction with 2024 unarmored defenses', () => {
    it.each([
      {
        // Disk: Barbarian UD applies "while you aren't wearing any armor" (shield
        // allowed). applyUnarmoredDefense2024:174 replaces armorClass — which
        // already includes the shield +2 — with a bare 10+Dex+Con, dropping it.
        // Rules-correct would be 10 + 2 + 3 + shield 2 = 17.
        label: 'Barbarian: shield dropped when UD overwrites (rules-correct 17, actual 15)',
        playerStats: stats2024({
          cls: { name: 'Barbarian' },
          abilities: [{ name: 'Dexterity', bonus: 2 }, { name: 'Constitution', bonus: 3 }],
          equipped: ['Shield']
        }),
        ac: 15
      }
    ])('$label', ({ playerStats, ac }) => {
      const [actualAc] = rules.getArmorClass(ARMOR_CATALOG, playerStats);

      expect(actualAc).toBe(ac);
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
