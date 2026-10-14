import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAttacks } from './attackCalc2024.js';

// ---------------------------------------------------------------------------
// Module-level stubs
// ---------------------------------------------------------------------------

const findEquippedWeaponsStub = vi.fn();
const buildWeaponAttackStub = vi.fn((opts) => ({
  name: opts.weaponName,
  damage: opts.includeAbilityBonusInDamage !== false
    ? `${opts.weapon.damage.damage_dice}+${opts.abilityBonus}`
    : opts.weapon.damage.damage_dice,
  damageType: opts.weapon.damage.damage_type,
  damageFormula: 'Damage Formula',
  hitBonus: opts.abilityBonus + opts.proficiency,
  hitBonusFormula: 'Hit Bonus Formula',
  range: opts.weapon.range?.normal ?? 5,
  type: opts.actionType,
  weaponType: opts.weaponType,
}));
const buildMonkAttacksStub = vi.fn((_opts) => [
  {
    name: 'Unarmed Strike',
    damage: `${_opts.diceStr}+${_opts.dexterityBonus}`,
    damageType: 'Bludgeoning',
    damageFormula: 'Damage Formula',
    hitBonus: _opts.dexterityBonus + _opts.proficiency,
    hitBonusFormula: 'Hit Bonus Formula',
    range: 5,
    type: 'Action',
  },
  {
    name: 'Unarmed Strike',
    damage: `${_opts.diceStr}+${_opts.dexterityBonus}`,
    damageType: 'Bludgeoning',
    damageFormula: 'Damage Formula',
    hitBonus: _opts.dexterityBonus + _opts.proficiency,
    hitBonusFormula: 'Hit Bonus Formula',
    range: 5,
    type: 'Bonus Action',
  },
]);

vi.mock('./attackCalc.js', () => ({
  parseMagicItemName: (name) =>
    name && name.charAt(0) === '+'
      ? { baseName: name.substring(3), magicBonus: Number(name.charAt(1)) || 0 }
      : { baseName: name, magicBonus: 0 },
  findEquippedWeapons: (...args) => findEquippedWeaponsStub(...args),
  buildWeaponAttack: (...args) => buildWeaponAttackStub(...args),
  buildMonkAttacks: (...args) => buildMonkAttacksStub(...args),
  parseDamageDice: (diceStr) => {
    const match = String(diceStr).match(/(\d+)d(\d+)/);
    if (!match) return 0;
    const [, count, sides] = match;
    return parseInt(count, 10) * (parseInt(sides, 10) + 1) / 2;
  },
}));

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getMartialArtsDie: vi.fn(() => 8),
  },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultPlayerStats = (overrides = {}) => ({
  level: 1,
  abilities: [
    { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
    { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
  ],
  inventory: { equipped: [] },
  automation: { passives: [], bonusActions: [] },
  activeBuffs: [],
  class: { name: 'Fighter' },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('attackCalc2024 - class features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Monk', () => {
    it('provides two unarmed strike attacks for a Monk', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 5,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 18, abilityImprovements: 0, miscBonus: 0, bonus: 4 },
        ],
        class: { name: 'Monk' },
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Unarmed Strike');
      expect(result[1].name).toBe('Unarmed Strike');
      expect(result[0].type).toBe('Action');
      expect(result[1].type).toBe('Bonus Action');
      expect(result[0].damageType).toBe('Bludgeoning');
      expect(buildMonkAttacksStub).toHaveBeenCalledWith(
        expect.objectContaining({
          dexterityBonus: 4,
          proficiency: 3,
        })
      );
    });

    it('does not add monk attacks for non-Monk classes', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const result = getAttacks([], [], defaultPlayerStats({ class: { name: 'Fighter' } }));

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Unarmed Strike');
    });
  });

  describe('Tavern Brawler', () => {
    it('includes tavern brawler unarmed strike for non-Monk characters with the feat', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 5,
        abilities: [
          { name: 'Strength', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
          { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        ],
        class: { name: 'Fighter' },
        automation: {
          passives: [
            { effect: 'tavern_brawler_push', name: 'Tavern Brawler' },
          ],
          bonusActions: [],
        },
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Unarmed Strike');
      expect(result[0].damage).toBe('1d4+3');
      expect(result[0].damageType).toBe('Bludgeoning');
      expect(result[0].type).toBe('Action');
    });

    it('does not add tavern brawler attack for Monk characters', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 5,
        class: { name: 'Monk' },
        automation: {
          passives: [
            { effect: 'tavern_brawler_push', name: 'Tavern Brawler' },
          ],
          bonusActions: [],
        },
      });

      const result = getAttacks([], [], playerStats);

      // Monk gets unarmed strikes but not tavern brawler
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Unarmed Strike');
    });

    it('applies Blessed Warrior +2 to Tavern Brawler unarmed strike hit bonus', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 5,
        abilities: [
          { name: 'Strength', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
          { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        ],
        class: { name: 'Cleric', fightingStyles: ['Blessed Warrior'] },
        automation: {
          passives: [
            { effect: 'tavern_brawler_push', name: 'Tavern Brawler' },
          ],
          bonusActions: [],
        },
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Unarmed Strike');
      expect(result[0].hitBonus).toBe(8); // strMod(3) + proficiency(3) + blessedWarrior(2)
      expect(result[0].hitBonusFormula).toContain('Blessed Warrior (2)');
    });
  });

  describe('College of Dance', () => {
    it('adds College of Dance Dazzling Footwork attacks for Bard level 3+', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 5,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 18, abilityImprovements: 0, miscBonus: 0, bonus: 4 },
        ],
        class: {
          name: 'Bard',
          subclass: { name: 'College of Dance' },
          class_levels: [{ level: 5, bardic_die: 6 }],
        },
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Unarmed Strike (Dance)');
      expect(result[0].type).toBe('Action');
      expect(result[1].type).toBe('Bonus Action');
    });

    it('does not add College of Dance attacks for Bard below level 3', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 2,
        class: {
          name: 'Bard',
          subclass: { name: 'College of Dance' },
        },
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Unarmed Strike');
    });
  });

  describe('Soulknife', () => {
    it('adds Soulknife Psychic Blade attacks for Rogue level 3+', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 5,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
          { name: 'Intelligence', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
        ],
        class: {
          name: 'Rogue',
          major: { name: 'Soulknife' },
        },
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Psychic Blade');
      expect(result[1].name).toBe('Psychic Blade');
      expect(result[0].damageType).toBe('Psychic');
      expect(result[0].type).toBe('Action');
      expect(result[1].type).toBe('Bonus Action');
      expect(result[0].damage).toBe('1d6+3');
      expect(result[1].damage).toBe('1d4');
      expect(result[0].mastery).toBe('Vex');
      expect(result[1].mastery).toBe('Vex');
      expect(result[0].properties).toContain('Finesse');
      expect(result[0].properties).toContain('Thrown (60/120)');
      expect(result[1].properties).toContain('Finesse');
      expect(result[1].properties).toContain('Thrown (60/120)');
      expect(result[0].isPsychicBlade).toBe(true);
      expect(result[1].isPsychicBlade).toBe(true);
    });

    it('does not add Soulknife attacks for Rogue below level 3', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 2,
        class: {
          name: 'Rogue',
          major: { name: 'Soulknife' },
        },
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Unarmed Strike');
    });

    it('does not add Soulknife attacks for non-Rogue classes', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 5,
        class: { name: 'Fighter' },
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Unarmed Strike');
    });
  });

  describe('Blessed Warrior fighting style on unarmed strikes', () => {
    it('applies Blessed Warrior +2 to fallback unarmed strike hit bonus when no weapons equipped', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 6,
        abilities: [
          { name: 'Strength', baseScore: 8, abilityImprovements: 0, miscBonus: 0, bonus: -1 },
          { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        ],
        class: { name: 'Cleric', fightingStyles: ['Blessed Warrior'] },
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Unarmed Strike');
      expect(result[0].hitBonus).toBe(4); // strMod(-1) + proficiency(3) + blessedWarrior(2)
      expect(result[0].hitBonusFormula).toContain('Blessed Warrior (2)');
    });

    it('applies Blessed Warrior +2 to both unarmed strikes when Two-Weapon Fighting is active', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 6,
        abilities: [
          { name: 'Strength', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
          { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        ],
        class: { name: 'Cleric', fightingStyles: ['Blessed Warrior', 'Two-Weapon Fighting'] },
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Unarmed Strike');
      expect(result[0].type).toBe('Action');
      expect(result[0].hitBonus).toBe(8); // strMod(3) + proficiency(3) + blessedWarrior(2)
      expect(result[0].hitBonusFormula).toContain('Blessed Warrior (2)');
      expect(result[1].name).toBe('Unarmed Strike');
      expect(result[1].type).toBe('Bonus Action');
      expect(result[1].hitBonus).toBe(8);
      expect(result[1].hitBonusFormula).toContain('Blessed Warrior (2)');
    });
  });
});
