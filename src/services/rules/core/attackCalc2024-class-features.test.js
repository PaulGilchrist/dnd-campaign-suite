// @maintained-by-ai
// 2024 class-feature axes of getAttacks: Tavern Brawler, College of Dance,
// Soulknife Psychic Blade, and Blessed Warrior fallback unarmed strikes.
// Lane splits (verified 2026-10-20, real builders, no stub echoes):
// - Monk Martial Arts gate/ladder → attackCalc2024.cla225-martial-arts-gate.test.js
//   ("lv20 Quarterstaff-only: quarterstaff row is 1d12+DEX, MA unarmed rows present",
//    "non-Monk classes never receive MA rows (Fighter in Leather)")
// - Swift Quiver / Starry Form → attackCalc2024-special-attacks.test.js
// - Light melee/ranged weapon seams → attackCalc2024-light-melee/-light-ranged.test.js
// - Nick / Dual Wielder off-hand lanes → attackCalc2024*.nick / -nick-dual-wielder.test.js
import { describe, it, expect, vi } from 'vitest';
import { getAttacks } from './attackCalc2024.js';
import DISK_EQUIPMENT from '../../../../public/data/equipment.json';

// Only combatData is stubbed — buildWeaponAttack / buildMonkAttacks /
// buildFallbackUnarmedAttacks / classRules2024 run REAL (cla225-lane pattern),
// so every expectation below is canonical output, not a stub echo.
vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  getCurrentCombatRound: vi.fn(() => 1),
}));

// Proficiency ladder floor((level-1)/4)+2: lv2 → +2, lv5/lv6 → +3.
const char = ({ level = 5, str = 3, dex = 3, int, cls = { name: 'Fighter' }, passives = [] } = {}) => ({
  level,
  abilities: [
    { name: 'Strength', bonus: str },
    { name: 'Dexterity', bonus: dex },
    ...(int != null ? [{ name: 'Intelligence', bonus: int }] : []),
  ],
  inventory: { equipped: [] },
  automation: { passives, bonusActions: [] },
  activeBuffs: [],
  class: cls,
});

describe('attackCalc2024 - class features', () => {
  describe('Tavern Brawler', () => {
    it.each([
      { label: 'tavern_brawler_push passive', effect: 'tavern_brawler_push', blessed: false, hitBonus: 6 },
      { label: 'tavern_brawler_reroll_ones passive (second OR branch, attackCalc2024.js:320)', effect: 'tavern_brawler_reroll_ones', blessed: false, hitBonus: 6 },
      { label: 'Blessed Warrior stacks +2 hit', effect: 'tavern_brawler_push', blessed: true, hitBonus: 8 },
    ])('unarmed strike row — $label', ({ effect, blessed, hitBonus }) => {
      const result = getAttacks([], [], char({
        cls: blessed
          ? { name: 'Cleric', fightingStyles: ['Blessed Warrior'] }
          : { name: 'Fighter' },
        passives: [{ effect, name: 'Tavern Brawler' }],
      }));

      expect(result).toHaveLength(1);
      const row = result[0];
      expect(row.name).toBe('Unarmed Strike');
      expect(row.type).toBe('Action');
      expect(row.weaponType).toBe('unarmed');
      expect(row.damage).toBe('1d4+3');
      expect(row.damageType).toBe('Bludgeoning');
      expect(row.damageFormula).toContain('Tavern Brawler Unarmed Strike (1d4)');
      expect(row.hitBonus).toBe(hitBonus); // str(3) + PB(3) [+ BW(2)]
      expect(row.hitBonusFormula).toContain(blessed ? 'Blessed Warrior (2)' : 'Proficiency (3)');
      if (!blessed) expect(row.hitBonusFormula).not.toContain('Blessed Warrior');
    });

    it('Monks get MA unarmed rows only — Tavern Brawler row suppressed (class guard)', () => {
      const result = getAttacks([], [], char({
        dex: 4,
        cls: { name: 'Monk', class_levels: [{ level: 5, martial_arts_die: 8 }] },
        passives: [{ effect: 'tavern_brawler_push', name: 'Tavern Brawler' }],
      }));

      // MA lane owns these two rows (cla225 covers the gate); if the
      // class-name guard in buildTavernBrawlerAttacks were removed, a third
      // 1d4+4 "Tavern Brawler" row would appear here.
      expect(result).toHaveLength(2);
      expect(result.map(a => a.type)).toEqual(['Action', 'Bonus Action']);
      expect(result.every(a => a.damage === '1d8+4')).toBe(true);
      expect(result.every(a => !String(a.damageFormula).includes('Tavern Brawler'))).toBe(true);
    });
  });

  describe('College of Dance', () => {
    it.each([
      { label: 'lv3 d6', level: 3, bardicDie: 6, subclass: 'College of Dance', dice: '1d6', damage: '1d6+4', hitBonus: 6 },
      { label: 'lv5 d8 — bardic_die interpolation (never hardcoded)', level: 5, bardicDie: 8, subclass: 'College of Dance', dice: '1d8', damage: '1d8+4', hitBonus: 7 },
      { label: 'lv2 Bard — level<3 gate falsifier', level: 2, bardicDie: null, subclass: 'College of Dance' },
      { label: 'wrong subclass name falsifier', level: 5, bardicDie: null, subclass: 'College of Whispers' },
    ])('Dazzling Footwork — $label', ({ level, bardicDie, subclass, dice, damage, hitBonus }) => {
      const result = getAttacks([], [], char({
        level,
        dex: 4,
        cls: {
          name: 'Bard',
          subclass: { name: subclass },
          ...(bardicDie != null ? { class_levels: [{ level, bardic_die: bardicDie }] } : {}),
        },
      }));

      const dance = result.filter(a => a.name === 'Unarmed Strike (Dance)');
      if (bardicDie == null) {
        expect(dance).toHaveLength(0);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Unarmed Strike');
        return;
      }
      expect(dance).toHaveLength(2);
      expect(dance.map(a => a.type)).toEqual(['Action', 'Bonus Action']);
      expect(dance.every(a => a.damage === damage)).toBe(true);
      expect(dance.every(a => a.hitBonus === hitBonus)).toBe(true);
      expect(dance[0].damageFormula).toBe(`Damage Formula = Bardic Inspiration Die (${dice}) + Dexterity Bonus (4)`);
      expect(dance[0].hitBonusFormula).toBe(`To Hit Bonus Formula = Dexterity Bonus (4) + Proficiency (${hitBonus - 4})`);
    });
  });

  describe('Soulknife', () => {
    it.each([
      { label: 'DEX 3 ≥ INT 2 → Dexterity', dex: 3, int: 2, ability: 'Dexterity', bonus: 3 },
      { label: 'INT 5 > DEX 3 → Intelligence (ability-pick falsifier)', dex: 3, int: 5, ability: 'Intelligence', bonus: 5 },
    ])('Psychic Blade pair — $label', ({ dex, int, ability, bonus }) => {
      const result = getAttacks([], [], char({
        dex,
        int,
        cls: { name: 'Rogue', major: { name: 'Soulknife' } },
      }));

      expect(result).toHaveLength(2);
      const [main, off] = result;
      expect(main.name).toBe('Psychic Blade');
      expect(main.type).toBe('Action');
      expect(main.range).toBe('5 ft');
      expect(main.damage).toBe(`1d6+${bonus}`);
      expect(main.damageFormula).toBe(`Damage Formula = 1d6 + ${ability} Modifier (${bonus})`);
      expect(off.type).toBe('Bonus Action');
      expect(off.range).toBe('60 ft');
      expect(off.damage).toBe('1d4'); // off-hand blade: dice only, no ability mod
      expect(main.hitBonus).toBe(bonus + 3);
      expect(off.hitBonus).toBe(bonus + 3);
      expect(main.hitBonusFormula).toBe(`To Hit Bonus = ${ability} Modifier (${bonus}) + Proficiency (3)`);
      for (const blade of result) {
        expect(blade.damageType).toBe('Psychic');
        expect(blade.mastery).toBe('Vex');
        expect(blade.properties).toEqual(['Finesse', 'Thrown (60/120)']);
        expect(blade.isPsychicBlade).toBe(true);
        expect(blade.abilityName).toBe(ability);
      }
    });

    it.each([
      { label: 'Rogue lv2 — level<3 gate', level: 2, cls: { name: 'Rogue', major: { name: 'Soulknife' } } },
      { label: 'Fighter lv5 with Soulknife major — class-name gate', level: 5, cls: { name: 'Fighter', major: { name: 'Soulknife' } } },
      { label: 'Rogue lv5 Thief — major-name falsifier', level: 5, cls: { name: 'Rogue', major: { name: 'Thief' } } },
    ])('no Psychic Blade — $label', ({ level, cls }) => {
      const result = getAttacks([], [], char({ level, cls }));

      expect(result.filter(a => a.isPsychicBlade)).toHaveLength(0);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Unarmed Strike');
    });
  });

  // #1240 DISCHARGED fix#340 — WEAPON-row byte pin for 2024
  // buildMeleeMainHandAttack extraHit/extraDamage (attackCalc2024.js:141-158).
  // Gap: prior coverage pinned Blessed Warrior only on FALLBACK/UNARMED rows
  // (:41 Tavern Brawler lane, :159 fallback lane); the equipped-weapon row that
  // folds the style bonuses through buildWeaponAttack was never pinned.
  // Disk law public/data/fighting-styles.json (read BY-name 2026-10-23):
  //   "Blessed Warrior":  "You gain a +2 bonus to attack rolls you make with melee weapons."
  //   "Druidic Warrior":  "You gain a +2 bonus to damage rolls you make with melee weapons."
  // Granted 2024 by public/data/2024/classes.json Cleric lv1 [6]: "Alternatively,
  // you can choose Blessed Warrior..." and Druid lv1 [7]: "...choose Druidic
  // Warrior...". Dagger row is the REAL disk object (index dagger: 1d4
  // Piercing, Simple Melee, Light), never transcribed. 5e twin comparison is
  // already pinned in attackCalc.test.js:296-305 (Longsword weapon rows) —
  // not repeated here.
  describe('Blessed Warrior / Druidic Warrior on WEAPON rows (#1240)', () => {
    const DAGGER = DISK_EQUIPMENT.find(it => it.name === 'Dagger');
    const armedChar = (cls, level = 5) => ({
      ...char({ level, str: 3, dex: 1, cls }),
      inventory: { equipped: ['Dagger'] },
    });

    it('falsifier — no style: plain Dagger 1d4+3, to-hit 6, neither label', () => {
      const result = getAttacks([DAGGER], [], armedChar({ name: 'Fighter' }));

      expect(result).toHaveLength(1);
      const row = result[0];
      expect(row).toMatchObject({
        name: 'Dagger', type: 'Action', weaponType: 'melee',
        damage: '1d4+3', hitBonus: 6,
        damageFormula: 'Damage Formula = Weapon (1d4) + Strength Bonus (3)',
        hitBonusFormula: 'To Hit Bonus Formula = Strength Bonus (3) + Proficiency (3)',
      });
      expect(row.damageFormula).not.toContain('Druidic Warrior');
      expect(row.hitBonusFormula).not.toContain('Blessed Warrior');
    });

    it('Blessed Warrior: +2 to the attack roll ONLY (disk) — hit 6 to 8, damage stays 1d4+3', () => {
      const result = getAttacks([DAGGER], [], armedChar({ name: 'Cleric', fightingStyles: ['Blessed Warrior'] }));

      expect(result).toHaveLength(1);
      const row = result[0];
      expect(row.hitBonus).toBe(8); // str(3) + PB(3) + BW(2)
      expect(row.hitBonusFormula).toBe('To Hit Bonus Formula = Strength Bonus (3) + Proficiency (3) + Blessed Warrior (2)');
      expect(row.damage).toBe('1d4+3');
      expect(row.damageFormula).not.toContain('Druidic Warrior');
    });

    it('Druidic Warrior: +2 to the damage roll ONLY (disk) — damage 1d4+5, hit stays 6', () => {
      const result = getAttacks([DAGGER], [], armedChar({ name: 'Druid', fightingStyles: ['Druidic Warrior'] }));

      expect(result).toHaveLength(1);
      const row = result[0];
      expect(row.damage).toBe('1d4+5'); // str(3) + DW(2)
      expect(row.damageFormula).toBe('Damage Formula = Weapon (1d4) + Strength Bonus (3) + Druidic Warrior (2)');
      expect(row.hitBonus).toBe(6);
      expect(row.hitBonusFormula).not.toContain('Blessed Warrior');
    });

    it('BW + DW stack by their own terms (attack +2, damage +2) — acquisition legality not asserted', () => {
      const result = getAttacks([DAGGER], [], armedChar({ name: 'Fighter', fightingStyles: ['Blessed Warrior', 'Druidic Warrior'] }));

      expect(result).toHaveLength(1);
      const row = result[0];
      expect(row.hitBonus).toBe(8);
      expect(row.hitBonusFormula).toContain('Blessed Warrior (2)');
      expect(row.damage).toBe('1d4+5');
      expect(row.damageFormula).toContain('Druidic Warrior (2)');
    });
  });

  describe('Blessed Warrior fighting style on fallback unarmed strikes', () => {
    // Mirrors the folded fallback table in 5e twin attackCalc.test.js (#1234).
    it.each([
      { label: 'solo BW with negative STR', styles: ['Blessed Warrior'], str: -1, length: 1, hitBonus: 4, damage: '1d4-1' },
      { label: 'BW + Two-Weapon Fighting', styles: ['Blessed Warrior', 'Two-Weapon Fighting'], str: 3, length: 2, hitBonus: 8, damage: '1d4+3' },
    ])('$label', ({ styles, str, length, hitBonus, damage }) => {
      const result = getAttacks([], [], char({ level: 6, str, cls: { name: 'Cleric', fightingStyles: styles } }));

      expect(result).toHaveLength(length);
      expect(result[0].name).toBe('Unarmed Strike');
      expect(result[0].type).toBe('Action');
      expect(result[0].weaponType).toBe('unarmed');
      for (const row of result) {
        expect(row.damage).toBe(damage);
        expect(row.hitBonus).toBe(hitBonus); // str + PB(3) + BW(2)
        expect(row.hitBonusFormula).toContain('Blessed Warrior (2)');
      }
      if (length === 2) expect(result[1].type).toBe('Bonus Action');
    });
  });
});
