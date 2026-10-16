import { describe, it, expect } from 'vitest';
import classRules from './classRules.js';
import classes5e from '../../../public/data/classes.json';

// Lane: 5e classRules (this file). Sibling classRules2024.test.js owns the
// 2024 lane (public/data/2024/classes.json — separate disk, verified via
// dataLoader.getDataPath(); classes.json is NOT shared between rulesets, so
// no cross-lane pin reuse; #2015 handoff: 2024 lane pins its own rows).
//
// Production liveness (verified 2026-10-16):
//  - getClass            → rulesFactory.getPlayerStats (re-reads class after build)
//  - getFeatures         → rules-actions.js
//  - getHighestSubclassLevel → spellCalc.js (subclass spellcasting rows)
//  - get*Features (x10)  → classFeatures.getClassFeatures FEATURE_GETTERS dispatch
//                          → CharClassFeatures.jsx, trackedResources.js, automation
//  - FLAG getDruidWildShapeUses / getDruidBeastKnownForms / getDruidBeastFlySpeed
//                        → only reachable via rulesFactory delegators that have NO
//                          production call sites; values re-pinned via getDruidFeatures
//                          (wild_shape lane is live through the sheet). Kept as minimal
//                          constant pins; source exports are dead-export cleanup candidates.
//
// All class rows below are verbatim public/data/classes.json (5e home path).

const diskClass = (name) => classes5e.find((c) => c.name === name);
const diskLevels = (name) => diskClass(name).class_levels;
const namesIn = (categorized) => [
  ...categorized.actions,
  ...categorized.bonusActions,
  ...categorized.reactions,
  ...categorized.specialActions,
  ...categorized.characterAdvancement,
].map((f) => f.name);

describe('classRules (5e)', () => {
  describe('getClass', () => {
    it('merges disk Wizard with full saving-throw names and null subclass', () => {
      // disk: saving_throws ["INT","WIS"]
      const result = classRules.getClass(classes5e, { class: { name: 'Wizard' } });
      expect(result.name).toBe('Wizard');
      expect(result.saving_throws).toEqual(['Intelligence', 'Wisdom']);
      expect(result.subclass).toBeNull();
      expect(result.subclasses).toBeUndefined();
    });

    it('converts multiple saving_throws abbreviations to full names', () => {
      // disk Fighter: saving_throws ["STR","CON"]
      const result = classRules.getClass(classes5e, { class: { name: 'Fighter' } });
      expect(result.saving_throws).toEqual(['Strength', 'Constitution']);
    });

    it('merges playerSummary subclass onto the disk subclass', () => {
      const result = classRules.getClass(
        classes5e,
        { class: { name: 'Wizard', subclass: { name: 'Abjuration', customProp: 'x' } } },
      );
      expect(result.subclass.name).toBe('Abjuration');
      expect(result.subclass.customProp).toBe('x');
      // disk Abjuration subclass_levels: [2, 6, 10, 14]
      expect(result.subclass.class_levels.map((cl) => cl.level)).toEqual([2, 6, 10, 14]);
    });

    it('merges playerSummary class properties onto base class', () => {
      const result = classRules.getClass(classes5e, { class: { name: 'Wizard', customProperty: 'custom value' } });
      expect(result.customProperty).toBe('custom value');
    });

    it('returns default class_levels when class is not found', () => {
      expect(classRules.getClass(classes5e, { class: { name: 'NonExistent' } })).toEqual({ class_levels: [] });
    });

    it('throws when playerSummary.class is null', () => {
      expect(() => classRules.getClass(classes5e, { class: null })).toThrow(TypeError);
    });

    it('throws when playerSummary.class is missing', () => {
      expect(() => classRules.getClass(classes5e, {})).toThrow(TypeError);
    });
  });

  describe('getDruidMaxWildShapeChallengeRating', () => {
    // disk Druid (non-Moon path) class_specific.wild_shape_max_cr verbatim
    it.each([
      [1, 0],
      [2, 0.25],
      [3, 0.25],
      [4, 0.5],
      [8, 1],
    ])('reads disk wild_shape_max_cr verbatim at level %i', (level, expected) => {
      const playerStats = { class: { name: 'Druid', class_levels: diskLevels('Druid') }, level };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(expected);
    });

    // Circle-of-the-Moon formula override (source: >1 → 1; >5 → floor(level/3)).
    it.each([
      [1, 0],
      [2, 1],
      [5, 1],
      [6, 2],
      [9, 3],
    ])('applies Moon formula over disk at level %i', (level, expected) => {
      const playerStats = {
        class: { name: 'Druid', subclass: { name: 'Circle of the Moon' }, class_levels: diskLevels('Druid') },
        level,
      };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(expected);
    });

    it('does NOT apply the Moon formula to the disk subclass name "Moon"', () => {
      // FLAG: disk subclass is named "Moon" but the source formula keys off
      // "Circle of the Moon" — a runtime-named Moon druid falls back to disk CR.
      const playerStats = {
        class: { name: 'Druid', subclass: { name: 'Moon' }, class_levels: diskLevels('Druid') },
        level: 4,
      };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(0.5); // disk L4 value, not formula's 1
    });

    it('applies the Moon formula via class.major.name at level 10', () => {
      const playerStats = {
        class: { name: 'Druid', major: { name: 'Circle of the Moon' }, class_levels: diskLevels('Druid') },
        level: 10,
      };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(3);
    });

    it('returns 0 when class_levels is missing', () => {
      expect(classRules.getDruidMaxWildShapeChallengeRating({ class: { name: 'Druid' }, level: 3 })).toBe(0);
    });

    it('returns 0 when class is missing', () => {
      expect(classRules.getDruidMaxWildShapeChallengeRating({})).toBe(0);
    });
  });

  describe('getDruidWildShapeUses', () => {
    // Keep-constant pin: only reachable via unused factory delegator; 2/Infinity
    // re-pinned live via getDruidFeatures.maxWildShapeUses below.
    it('returns 2 for finite lv19 (disk has no Archdruid row there)', () => {
      const playerStats = { rules: '5e', level: 19, class: { name: 'Druid', class_levels: diskLevels('Druid') } };
      expect(classRules.getDruidWildShapeUses(playerStats)).toBe(2);
    });

    it('returns Infinity for lv20 with the disk Archdruid row (CLA-013)', () => {
      // disk Druid L20 features: ["Archdruid"]
      const playerStats = { rules: '5e', level: 20, class: { name: 'Druid', class_levels: diskLevels('Druid') } };
      expect(classRules.getDruidWildShapeUses(playerStats)).toBe(Infinity);
    });
  });

  describe('getDruidBeastKnownForms', () => {
    it('returns 0 (constant; re-pinned via getDruidFeatures.beastKnownForms)', () => {
      expect(classRules.getDruidBeastKnownForms()).toBe(0);
    });
  });

  describe('getDruidBeastFlySpeed', () => {
    // disk wild_shape_fly flags verbatim (L4 has swim=true, fly=false — discriminates
    // that the swim field is never used as fly).
    it.each([
      [1, false],
      [4, false],
      [8, true],
    ])('reads disk wild_shape_fly verbatim at level %i', (level, expected) => {
      const playerStats = { class: { name: 'Druid', class_levels: diskLevels('Druid') }, level };
      expect(classRules.getDruidBeastFlySpeed(playerStats)).toBe(expected);
    });

    it('returns undefined when no class_level row matches the level', () => {
      const playerStats = { class: { name: 'Druid', class_levels: [] }, level: 4 };
      expect(classRules.getDruidBeastFlySpeed(playerStats)).toBeUndefined();
    });

    it('returns undefined when class is missing', () => {
      expect(classRules.getDruidBeastFlySpeed({})).toBeUndefined();
    });
  });

  describe('getFeatures', () => {
    it('returns all category keys', () => {
      const playerStats = { class: { name: 'Fighter', class_levels: diskLevels('Fighter') }, level: 2, subclass: null };
      const result = classRules.getFeatures(playerStats);
      expect(result).toHaveProperty('actions');
      expect(result).toHaveProperty('bonusActions');
      expect(result).toHaveProperty('reactions');
      expect(result).toHaveProperty('specialActions');
      expect(result).toHaveProperty('characterAdvancement');
    });

    it('filters out class levels beyond player level', () => {
      // disk Fighter L1: ["Fighting Style","Second Wind"]; L2: ["Action Surge"]
      const fighter = diskClass('Fighter');
      const playerStats = { class: { name: 'Fighter', class_levels: fighter.class_levels }, level: 1 };
      expect(namesIn(classRules.getFeatures(playerStats))).toContain('Fighting Style');
      expect(namesIn(classRules.getFeatures(playerStats))).not.toContain('Action Surge');
    });

    it('merges subclass features with class features', () => {
      // disk Druid L2: ["Druid Circle","Wild Shape"]; disk Moon L2: ["Circle Forms","Combat Wild Shape"]
      const druid = diskClass('Druid');
      const playerStats = {
        class: { name: 'Druid', class_levels: druid.class_levels, subclass: druid.subclasses.find((s) => s.name === 'Moon') },
        level: 2,
      };
      const names = namesIn(classRules.getFeatures(playerStats));
      expect(names).toContain('Wild Shape');
      expect(names).toContain('Combat Wild Shape');
    });

    it('excludes subclass features when subclass is null', () => {
      const playerStats = {
        class: { name: 'Druid', class_levels: diskLevels('Druid').filter((cl) => cl.level <= 2), subclass: null },
        level: 2,
      };
      const names = namesIn(classRules.getFeatures(playerStats));
      expect(names).toContain('Wild Shape');
      expect(names).not.toContain('Combat Wild Shape');
    });
  });

  describe('getHighestSubclassLevel', () => {
    // disk Wizard/Abjuration subclass_levels: [2, 6, 10, 14]
    const abjurationStats = (level) => ({
      class: { name: 'Wizard', subclass: diskClass('Wizard').subclasses.find((s) => s.name === 'Abjuration') },
      level,
    });

    it.each([
      [7, 6],
      [10, 10],
      [14, 14],
    ])('returns the highest disk subclass row <= player level %i (row level %i)', (level, expected) => {
      expect(classRules.getHighestSubclassLevel(abjurationStats(level)).level).toBe(expected);
    });

    it('returns 0 when player level is below the first subclass level', () => {
      expect(classRules.getHighestSubclassLevel(abjurationStats(1))).toBe(0);
    });

    it('returns 0 when subclass has no class_levels', () => {
      expect(classRules.getHighestSubclassLevel({ class: { name: 'Wizard', subclass: { name: 'Abjuration' } }, level: 5 })).toBe(0);
    });

    it('returns 0 when subclass is undefined', () => {
      expect(classRules.getHighestSubclassLevel({ class: { name: 'Wizard' }, level: 5 })).toBe(0);
    });
  });

  describe('getRogueSneakAttack', () => {
    // disk Rogue sneak_attack verbatim
    it.each([
      [1, { dice_count: 1, dice_value: 6 }],
      [5, { dice_count: 3, dice_value: 6 }],
      [9, { dice_count: 5, dice_value: 6 }],
      [11, { dice_count: 6, dice_value: 6 }],
      [17, { dice_count: 9, dice_value: 6 }],
      [20, { dice_count: 10, dice_value: 6 }],
    ])('reads disk sneak_attack verbatim at level %i', (level, expected) => {
      const playerStats = { class: { name: 'Rogue', class_levels: diskLevels('Rogue') }, level };
      expect(classRules.getRogueSneakAttack(playerStats)).toEqual(expected);
    });

    it('returns default {0,6} when class_specific.sneak_attack is missing', () => {
      const playerStats = { class: { name: 'Rogue', class_levels: [{ level: 5, class_specific: {} }] }, level: 5 };
      expect(classRules.getRogueSneakAttack(playerStats)).toEqual({ dice_count: 0, dice_value: 6 });
    });

    it('returns default {0,6} when class is missing', () => {
      expect(classRules.getRogueSneakAttack({})).toEqual({ dice_count: 0, dice_value: 6 });
    });
  });

  describe('getClericFeatures', () => {
    // disk Cleric class_specific verbatim
    it.each([
      [5, { maxChannelDivinity: 1, destroyUndeadCR: 0.5 }],
      [6, { maxChannelDivinity: 2, destroyUndeadCR: 0.5 }],
      [18, { maxChannelDivinity: 3, destroyUndeadCR: 4 }],
    ])('reads disk channel/divinity verbatim at level %i', (level, expected) => {
      const playerStats = { class: { name: 'Cleric', class_levels: diskLevels('Cleric') }, level };
      expect(classRules.getClericFeatures(playerStats)).toEqual(expected);
    });

    it('maps disk destroy_undead_cr 0 to null (|| coercion)', () => {
      // disk Cleric L2: {channel_divinity_charges:1, destroy_undead_cr:0}
      const playerStats = { class: { name: 'Cleric', class_levels: diskLevels('Cleric') }, level: 2 };
      expect(classRules.getClericFeatures(playerStats)).toEqual({ maxChannelDivinity: 1, destroyUndeadCR: null });
    });

    it('returns defaults when class is missing', () => {
      expect(classRules.getClericFeatures({})).toEqual({ maxChannelDivinity: 0, destroyUndeadCR: null });
    });
  });

  describe('getPaladinFeatures', () => {
    // FLAG: disk Paladin class_specific has only aura_range — maxChannelDivinity
    // never populates from the main class table (channel oath lives in subclasses).
    it('reads disk L5 row: aura_range 0 → null, extraAttacks 1', () => {
      const playerStats = { class: { name: 'Paladin', class_levels: diskLevels('Paladin') }, level: 5 };
      expect(classRules.getPaladinFeatures(playerStats)).toEqual({ maxChannelDivinity: 0, auraRange: null, extraAttacks: 1 });
    });

    it('reads disk L6 aura_range verbatim (10)', () => {
      const playerStats = { class: { name: 'Paladin', class_levels: diskLevels('Paladin') }, level: 6 };
      expect(classRules.getPaladinFeatures(playerStats).auraRange).toBe(10);
    });

    it('returns 0 extraAttacks at level 4 (threshold boundary)', () => {
      const playerStats = { class: { name: 'Paladin' }, level: 4 };
      expect(classRules.getPaladinFeatures(playerStats).extraAttacks).toBe(0);
    });

    it('returns defaults when class is missing', () => {
      expect(classRules.getPaladinFeatures({})).toEqual({ maxChannelDivinity: 0, auraRange: null, extraAttacks: 0 });
    });
  });

  describe('getSorcererFeatures', () => {
    it('reads disk L1 row: empty creating_spell_slots → []', () => {
      const playerStats = { class: { name: 'Sorcerer', class_levels: diskLevels('Sorcerer') }, level: 1 };
      const result = classRules.getSorcererFeatures(playerStats);
      expect(result).toEqual({ maxSorceryPoints: 0, metamagicKnown: 0, maxInnateSorcery: 0, creatingSpellSlotCosts: [] });
    });

    it('maps disk L6 creating_spell_slots to costs verbatim', () => {
      const playerStats = { class: { name: 'Sorcerer', class_levels: diskLevels('Sorcerer') }, level: 6 };
      const result = classRules.getSorcererFeatures(playerStats);
      expect(result.maxSorceryPoints).toBe(6);
      expect(result.metamagicKnown).toBe(2);
      expect(result.creatingSpellSlotCosts).toEqual([2, 3, 5, 6, 7]);
    });

    it('returns defaults when class is missing', () => {
      const result = classRules.getSorcererFeatures({});
      expect(result).toEqual({ maxSorceryPoints: 0, metamagicKnown: 0, maxInnateSorcery: 0, creatingSpellSlotCosts: [] });
    });
  });

  describe('getWarlockFeatures', () => {
    // disk Warlock class_specific verbatim
    it.each([
      [11, { invocationsKnown: 5, hasArcanum: true, arcanumLevels: { level6: 1, level7: 0, level8: 0, level9: 0 } }],
      [13, { invocationsKnown: 6, hasArcanum: true, arcanumLevels: { level6: 1, level7: 1, level8: 0, level9: 0 } }],
      [17, { invocationsKnown: 7, hasArcanum: true, arcanumLevels: { level6: 1, level7: 1, level8: 1, level9: 1 } }],
    ])('reads disk arcanum/invocations verbatim at level %i', (level, expected) => {
      const playerStats = { class: { name: 'Warlock', class_levels: diskLevels('Warlock') }, level };
      const { invocationsKnown, hasArcanum, arcanumLevels } = classRules.getWarlockFeatures(playerStats);
      expect({ invocationsKnown, hasArcanum, arcanumLevels }).toEqual(expected);
    });

    it('forces all-zero arcanumLevels at level 10 (hasArcanum boundary)', () => {
      const playerStats = { class: { name: 'Warlock', class_levels: diskLevels('Warlock') }, level: 10 };
      const result = classRules.getWarlockFeatures(playerStats);
      expect(result).toMatchObject({ invocationsKnown: 5, hasArcanum: false, arcanumLevels: { level6: 0, level7: 0, level8: 0, level9: 0 } });
    });

    it('passes through runtime arcanums/pactBoon/invocations from playerSummary-derived class', () => {
      const playerStats = {
        class: {
          name: 'Warlock',
          arcanums: [{ name: 'Foresight', level: 9 }],
          pactBoon: { name: 'Tome' },
          invocations: [{ name: 'Eldritch Sight' }],
          class_levels: diskLevels('Warlock'),
        },
        level: 13,
      };
      const result = classRules.getWarlockFeatures(playerStats);
      expect(result.arcanums).toEqual([{ name: 'Foresight', level: 9 }]);
      expect(result.pactBoon).toEqual({ name: 'Tome' });
      expect(result.invocations).toEqual([{ name: 'Eldritch Sight' }]);
    });

    it('returns defaults when class is missing', () => {
      expect(classRules.getWarlockFeatures({})).toEqual({
        invocationsKnown: 0,
        hasArcanum: false,
        arcanumLevels: { level6: 0, level7: 0, level8: 0, level9: 0 },
        arcanums: [],
        pactBoon: null,
        invocations: [],
      });
    });
  });

  describe('getWizardFeatures', () => {
    it('reads disk L4 arcane_recovery_levels verbatim (2)', () => {
      const playerStats = { class: { name: 'Wizard', class_levels: diskLevels('Wizard') }, level: 4 };
      expect(classRules.getWizardFeatures(playerStats)).toEqual({
        arcaneRecoveryLevels: 2,
        arcaneWard: false,
        arcaneWardMax: 0,
        showWizardFeatures: true,
      });
    });

    it('computes arcaneWardMax as 2*level + INT mod for arcane_ward passive', () => {
      const playerStats = {
        class: { name: 'Wizard', subclass: { name: 'Abjuration' }, class_levels: diskLevels('Wizard') },
        level: 7,
        abilities: [{ name: 'Intelligence', bonus: 5 }],
        automation: { passives: [{ type: 'arcane_ward' }] },
      };
      const result = classRules.getWizardFeatures(playerStats);
      expect(result.arcaneWard).toBe(true);
      expect(result.arcaneWardMax).toBe(19); // 2*7 + 5
    });

    it('accepts passive_rule/effect=arcane_ward shape and defaults INT to 0', () => {
      const playerStats = {
        class: { name: 'Wizard', subclass: { name: 'Abjuration' }, class_levels: diskLevels('Wizard') },
        level: 4,
        abilities: [{ name: 'Strength', bonus: 3 }],
        automation: { passives: [{ type: 'passive_rule', effect: 'arcane_ward' }] },
      };
      const result = classRules.getWizardFeatures(playerStats);
      expect(result.arcaneWard).toBe(true);
      expect(result.arcaneWardMax).toBe(8); // 2*4 + 0
    });

    it('returns arcaneWard false when automation passives is missing', () => {
      const playerStats = { class: { name: 'Wizard' }, level: 4, abilities: [{ name: 'Intelligence', bonus: 3 }] };
      const result = classRules.getWizardFeatures(playerStats);
      expect(result.arcaneWard).toBe(false);
      expect(result.arcaneWardMax).toBe(0);
    });
  });

  describe('getMonkFeatures', () => {
    // FLAG: hardcoded constants, ignores disk martial-arts dice — pinned as-is.
    it('returns hardcoded 5e values', () => {
      expect(classRules.getMonkFeatures()).toEqual({
        martialArtsDie: 4,
        unarmoredMovementIncrease: 0,
        maxFocusPoints: 0,
        wisdomBonus: 0,
      });
    });
  });

  describe('getRangerFeatures', () => {
    it.each([
      [4, 0],
      [5, 1],
    ])('extraAttacks %i at level %i (>4 threshold)', (level, expected) => {
      expect(classRules.getRangerFeatures({ class: { name: 'Ranger' }, level }).extraAttacks).toBe(expected);
    });

    it('returns hardcoded favoredEnemies 0 and defaults when class is missing', () => {
      expect(classRules.getRangerFeatures({})).toEqual({ favoredEnemies: 0, extraAttacks: 0 });
    });
  });

  describe('getRogueFeatures', () => {
    it('delegates sneak attack to disk L5 row and passes through runtime expertise', () => {
      const playerStats = {
        class: { name: 'Rogue', class_levels: diskLevels('Rogue') },
        level: 5,
        expertise: ['Stealth'],
      };
      const result = classRules.getRogueFeatures(playerStats);
      expect(result.sneakAttack).toEqual({ dice_count: 3, dice_value: 6 });
      expect(result.expertise).toEqual(['Stealth']);
    });

    it('returns empty expertise and default sneak attack when class is missing', () => {
      expect(classRules.getRogueFeatures({})).toEqual({ sneakAttack: { dice_count: 0, dice_value: 6 }, expertise: [] });
    });
  });

  describe('getBardFeatures', () => {
    it('reads disk bard dice verbatim (numeric, not strings)', () => {
      // disk Bard L1: {bardic 6, song 0, ms5 0} — ?? keeps 0 (not null)
      const l1 = { class: { name: 'Bard', class_levels: diskLevels('Bard') }, level: 1 };
      expect(classRules.getBardFeatures(l1)).toMatchObject({ bardicDie: 6, songOfRestDie: 0 });
      // disk Bard L10: {bardic 10, song 8, ms5 2}
      const l10 = { class: { name: 'Bard', class_levels: diskLevels('Bard') }, level: 10 };
      expect(classRules.getBardFeatures(l10)).toMatchObject({ bardicDie: 10, songOfRestDie: 8, magicalSecrets: 2 });
    });

    it('reads disk Lore subclass row verbatim: 3 magical secrets at level 6', () => {
      const bard = diskClass('Bard');
      const playerStats = {
        class: { name: 'Bard', subclass: bard.subclasses.find((s) => s.name === 'Lore'), class_levels: bard.class_levels },
        level: 6,
      };
      const result = classRules.getBardFeatures(playerStats);
      expect(result.bardicDie).toBe(8); // disk L6
      expect(result.subclassMagicalSecrets).toBe(3); // disk Lore L6: additional_magical_secrets_max_lvl 3
    });

    it('returns 0 subclassMagicalSecrets for disk Valor subclass (non-Lore)', () => {
      const bard = diskClass('Bard');
      const playerStats = {
        class: { name: 'Bard', subclass: bard.subclasses.find((s) => s.name === 'Valor'), class_levels: bard.class_levels },
        level: 6,
      };
      expect(classRules.getBardFeatures(playerStats).subclassMagicalSecrets).toBe(0);
    });

    it('returns 0 subclassMagicalSecrets for Lore bard at level <= 2', () => {
      const bard = diskClass('Bard');
      const playerStats = {
        class: { name: 'Bard', subclass: bard.subclasses.find((s) => s.name === 'Lore'), class_levels: bard.class_levels },
        level: 2,
      };
      expect(classRules.getBardFeatures(playerStats).subclassMagicalSecrets).toBe(0);
    });

    it('returns defaults when class is missing', () => {
      expect(classRules.getBardFeatures({})).toEqual({ bardicDie: 0, songOfRestDie: null, magicalSecrets: null, subclassMagicalSecrets: 0 });
    });
  });
});
