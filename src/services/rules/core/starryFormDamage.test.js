// @maintained-by-ai
import { describe, it, expect } from 'vitest';
import { buildStarryFormLuminousArrow } from './starryFormDamage.js';

// Starry Form Archer (2024 Circle of Stars, public/data/2024/classes.json):
// ranged spell attack, 1d8 + Wisdom modifier Radiant; Twinkling Constellations
// (lv10) turns that 1d8 into 2d8 — there is no third tier on disk.
// Handler orchestration / attack_roll integration is owned by
// starryFormArrowHandler.test.js and attackCalc2024-special-attacks.test.js.

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
  it('builds a radiant ranged spell attack from the active Archer buff', () => {
    const result = buildStarryFormLuminousArrow(makePlayerStats(), ARCHER_BUFF);

    expect(result.name).toBe('Starry Form: Luminous Arrow');
    expect(result.attackType).toBe('spell');
    expect(result.isRanged).toBe(true);
    expect(result.toHit).toBe(7);
    expect(result.hitBonus).toBe(7);
    expect(result.hitBonusFormula).toBe('To Hit Bonus = Wisdom Modifier (3) + Proficiency (4)');
    expect(result.damageType).toBe('Radiant');
    expect(result.actionType).toBe('Bonus Action');
    // Disk canon (classes.json Archer) says "within 60 feet"; the module emits
    // 120_ft. Honest pin of current behavior — mismatch reported, not silently fixed.
    expect(result.range).toBe('120_ft');
  });

  it('scales the die at Twinkling Constellations: 1d8 below lv10, 2d8 at lv10+', () => {
    const below = buildStarryFormLuminousArrow(makePlayerStats({ level: 9 }), ARCHER_BUFF);
    expect(below.damage_dice).toBe('1d8');
    expect(below.damage).toBe('1d8+3');

    const twinkled = buildStarryFormLuminousArrow(makePlayerStats({ level: 10 }), ARCHER_BUFF);
    expect(twinkled.damage_dice).toBe('2d8');
    expect(twinkled.damage).toBe('2d8+3');
    expect(twinkled.autoDamageFormula).toBe('2d8+3');

    // lv17 stays 2d8 — disk has no third tier (Full of Stars is defense only).
    const high = buildStarryFormLuminousArrow(makePlayerStats({ level: 17 }), ARCHER_BUFF);
    expect(high.damage_dice).toBe('2d8');
  });

  it('substitutes the Wisdom modifier into every damage expression', () => {
    const buffed = buildStarryFormLuminousArrow(
      makePlayerStats({ abilities: [{ name: 'Wisdom', bonus: 5 }] }),
      ARCHER_BUFF,
    );
    expect(buffed.damage).toBe('2d8+5');
    expect(buffed.autoDamageFormula).toBe('2d8+5');
    expect(buffed.damageFormula).toBe('Damage Formula = 2d8 + Wisdom Modifier (5)');

    // Negative modifiers compose literally (rules-legal: 1d8-1 style damage).
    const cursed = buildStarryFormLuminousArrow(
      makePlayerStats({ abilities: [{ name: 'Wisdom', bonus: -1 }] }),
      ARCHER_BUFF,
    );
    expect(cursed.damage).toBe('2d8+-1');
  });

  it('returns null unless an Archer Starry Form buff is active', () => {
    expect(buildStarryFormLuminousArrow(makePlayerStats(), [])).toBeNull();
    expect(buildStarryFormLuminousArrow(makePlayerStats(), [
      { name: 'Starry Form', effect: 'starry_form', constellation: 'Chalice' },
    ])).toBeNull();
  });

  it('falls back to playerStats.activeBuffs when no buffs argument is given', () => {
    // Production path: attackCalc2024.js calls this with playerStats only.
    const result = buildStarryFormLuminousArrow(makePlayerStats({ activeBuffs: ARCHER_BUFF }));
    expect(result).not.toBeNull();
    expect(result.damage).toBe('2d8+3');
  });
});
