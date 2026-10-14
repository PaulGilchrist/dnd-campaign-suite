import { describe, it, expect } from 'vitest';
import { buildStarryFormLuminousArrow } from './starryFormDamage.js';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestDruid',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Wisdom', bonus: 3 }],
    spellAbilities: { toHit: 7, modifier: 3, saveDc: 15, spellCastingAbility: 'Wisdom' },
    ...overrides,
  };
}

const ARCHER_BUFF = [{ name: 'Starry Form', effect: 'starry_form', constellation: 'Archer' }];

describe('buildStarryFormLuminousArrow', () => {
  it('builds the arrow when the Archer constellation buff is active', () => {
    const result = buildStarryFormLuminousArrow(makePlayerStats(), ARCHER_BUFF);

    expect(result.name).toBe('Starry Form: Luminous Arrow');
    expect(result.attackType).toBe('spell');
    expect(result.isRanged).toBe(true);
    expect(result.range).toBe('120_ft');
    expect(result.toHit).toBe(7);
    expect(result.hitBonus).toBe(7);
    expect(result.hitBonusFormula).toContain('Wisdom Modifier (3)');
    expect(result.hitBonusFormula).toContain('Proficiency (4)');
    expect(result.damage).toBe('2d8+3');
    expect(result.damageType).toBe('Radiant');
    expect(result.autoDamageFormula).toBe('2d8+3');
  });

  it('uses 2d8 damage dice at level 10+ (Twinkling Constellation)', () => {
    const result = buildStarryFormLuminousArrow(makePlayerStats(), ARCHER_BUFF);
    expect(result.damage_dice).toBe('2d8');
    expect(result.damageType).toBe('Radiant');
  });

  it('uses 1d8 damage dice below level 10', () => {
    const result = buildStarryFormLuminousArrow(makePlayerStats({ level: 8 }), ARCHER_BUFF);
    expect(result.damage_dice).toBe('1d8');
    expect(result.damage).toBe('1d8+3');
  });

  it('returns null when the Archer constellation buff is not active', () => {
    const result = buildStarryFormLuminousArrow(
      makePlayerStats(),
      [{ name: 'Starry Form', effect: 'starry_form', constellation: 'Chalice' }],
    );
    expect(result).toBeNull();
  });

  it('falls back to playerStats.activeBuffs when no buffs argument is provided', () => {
    const result = buildStarryFormLuminousArrow(
      makePlayerStats({ activeBuffs: ARCHER_BUFF }),
    );
    expect(result).not.toBeNull();
  });
});
