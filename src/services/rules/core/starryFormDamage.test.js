// @maintained-by-ai
import { describe, it, expect } from 'vitest';
import classes2024 from '../../../../public/data/2024/classes.json' with { type: 'json' };
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
    // fix#351(a)(ii) disk-law range pin (#1348 flip of the old honest 120_ft
    // mismatch pin): disk canon public/data/2024/classes.json 'Starry Form'
    // BY-name — "targets one creature within 60 feet of yourself" — is now the
    // emitted constant. The twin pin in
    // attackCalc2024-special-attacks.test.js flipped the same pass.
    expect(result.range).toBe('60_ft');
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

  it('fix#351(a)(ii) 60ft disk-law arm: range token is DERIVED from the disk Starry Form row BY-name, not transcribed', () => {
    // Read the disk feature, do not trust this lane's memory of it: locate the
    // 2024 Druid 'Circle of Stars' major BY-name (classes.json shape:
    // classes[Druid].majors[Circle of Stars].features), then extract the feet
    // number from the 'Starry Form' prose and require the module token to match.
    const druid = classes2024.find(c => c.name === 'Druid');
    expect(druid, '2024 classes.json missing the Druid').toBeTruthy();
    const starsMajor = (druid.majors || []).find(m => m.name === 'Circle of the Stars');
    expect(starsMajor, '2024 Druid majors missing Circle of the Stars').toBeTruthy();
    const feature = (starsMajor.features || []).find(f => f.name === 'Starry Form');
    expect(feature, 'Circle of the Stars features missing Starry Form').toBeTruthy();
    const diskFeet = Number(/targets one creature within (\d+) feet of yourself/.exec(feature.description)?.[1]);
    expect(Number.isFinite(diskFeet)).toBe(true); // disk prose really says "within N feet"
    expect(diskFeet).toBe(60);                     // ... and N is 60 (the disk law)

    const result = buildStarryFormLuminousArrow(makePlayerStats(), ARCHER_BUFF);
    expect(result.range).toBe(`${diskFeet}_ft`);   // module range follows disk, token-folded
  });

  it('fix#351(a)(i) abilities-absent degrades to +0 instead of throwing (Archer buff active, abilities key missing)', () => {
    // The defect shape: Starry-Form-Archer is active AND the stats object has
    // NO abilities key at all — the old bare playerStats.abilities.find threw a
    // TypeError mid-attack-build. The ?? [] degrade (file sibling :2 idiom)
    // must produce a lawful plain-damage arrow instead.
    const { abilities, ...noAbilities } = makePlayerStats();
    expect(abilities).toBeTruthy(); // fixture sanity: the key existed before deletion

    let result;
    expect(() => { result = buildStarryFormLuminousArrow(noAbilities, ARCHER_BUFF); }).not.toThrow();
    expect(result).not.toBeNull();
    expect(result.damage).toBe('2d8+0');           // wisMod degrades to 0
    expect(result.autoDamageFormula).toBe('2d8+0');
    expect(result.damageFormula).toBe('Damage Formula = 2d8 + Wisdom Modifier (0)');
    expect(result.range).toBe('60_ft');

    // A missing key and an empty array behave identically (both ?? []-degrade).
    expect(buildStarryFormLuminousArrow({ ...noAbilities, abilities: [] }, ARCHER_BUFF).damage).toBe('2d8+0');
  });
});
