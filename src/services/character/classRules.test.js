// @improved-by-ai
import { describe, it, expect } from 'vitest';
import classRules from './classRules.js';
import { addFeatures, mergeCategorizedFeatures } from './featureCategorizationUtils.js';
import { categories5e } from './featureCategories.js';
const featureCategories = categories5e;

describe('classRules', () => {
  describe('getClass', () => {
    const mockClasses = [
      {
        name: 'Wizard',
        index: 'wizard',
        saving_throws: ['INT'],
        class_levels: [],
        subclasses: [{ name: 'Abjuration', class_levels: [] }],
      },
      {
        name: 'Fighter',
        index: 'fighter',
        saving_throws: ['STR', 'CON'],
        class_levels: [],
        subclasses: [],
      },
      {
        name: 'Bard',
        index: 'bard',
        class_levels: [],
      },
    ];

    it('should return merged class data for a valid class', () => {
      const playerSummary = { class: { name: 'Wizard' } };
      const result = classRules.getClass(mockClasses, playerSummary);

      expect(result.name).toBe('Wizard');
      expect(result.saving_throws).toEqual(['Intelligence']);
      expect(result.subclass).toBeNull();
      expect(result.subclasses).toBeUndefined();
    });

    it('should convert all saving_throws abbreviations to full names', () => {
      const playerSummary = { class: { name: 'Fighter' } };
      const result = classRules.getClass(mockClasses, playerSummary);

      expect(result.saving_throws).toEqual(['Strength', 'Constitution']);
    });

    it('should omit saving_throws when the base class has none', () => {
      const playerSummary = { class: { name: 'Bard' } };
      const result = classRules.getClass(mockClasses, playerSummary);

      expect(result.saving_throws).toBeUndefined();
    });

    it('should include subclass when specified in playerSummary', () => {
      const playerSummary = {
        class: { name: 'Wizard', subclass: { name: 'Abjuration' } },
      };
      const result = classRules.getClass(mockClasses, playerSummary);

      expect(result.subclass.name).toBe('Abjuration');
    });

    it('should set subclass to null when not specified', () => {
      const playerSummary = { class: { name: 'Wizard' } };
      const result = classRules.getClass(mockClasses, playerSummary);

      expect(result.subclass).toBeNull();
    });

    it('should merge playerSummary class properties onto base class', () => {
      const playerSummary = {
        class: { name: 'Wizard', customProperty: 'custom value' },
      };
      const result = classRules.getClass(mockClasses, playerSummary);

      expect(result.customProperty).toBe('custom value');
    });

    it('should return empty class_levels when class is not found', () => {
      const playerSummary = { class: { name: 'NonExistent' } };
      const result = classRules.getClass(mockClasses, playerSummary);

      expect(result).toEqual({ class_levels: [] });
    });

    it('should handle class without subclasses array', () => {
      const classes = [{ name: 'Fighter', saving_throws: ['STR'], class_levels: [] }];
      const playerSummary = { class: { name: 'Fighter' } };
      const result = classRules.getClass(classes, playerSummary);

      expect(result.subclass).toBeNull();
      expect(result.subclasses).toBeUndefined();
    });
  });

  describe('getDruidMaxWildShapeChallengeRating', () => {
    it('should return 0 for non-Druid class', () => {
      const playerStats = { class: { name: 'Wizard' }, level: 5 };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(0);
    });

    it('should return wild_shape_max_cr from class_specific when set', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          class_levels: [
            { level: 3, class_specific: { wild_shape_max_cr: 1 / 2 } },
          ],
        },
        level: 3,
      };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(1 / 2);
    });

    it('should return 1 for Circle of Moon Druid levels 2-5', () => {
      const playerStats = {
        class: { name: 'Druid', subclass: { name: 'Moon' } },
        level: 4,
      };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(1);
    });

    it('should return floor(level/3) for Circle of Moon Druid level 6+', () => {
      const playerStats = {
        class: { name: 'Druid', subclass: { name: 'Moon' } },
        level: 9,
      };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(3);
    });

    it('should return 0 for Circle of Moon Druid at level 1', () => {
      const playerStats = {
        class: { name: 'Druid', subclass: { name: 'Moon' } },
        level: 1,
      };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(0);
    });

    it('should return 0 when class_levels is missing', () => {
      const playerStats = { class: { name: 'Druid' }, level: 5 };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(0);
    });

    it('should return 0 when class_specific is missing', () => {
      const playerStats = {
        class: { name: 'Druid', class_levels: [{ level: 1 }] },
        level: 1,
      };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(0);
    });

    it('should prefer class_specific over Moon subclass modifier', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          subclass: { name: 'Moon' },
          class_levels: [{ level: 4, class_specific: { wild_shape_max_cr: 1 } }],
        },
        level: 4,
      };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(1);
    });
  });

  describe('getDruidWildShapeUses', () => {
    it('should always return 2 regardless of level or subclass', () => {
      const playerStats = { class: { name: 'Druid' }, level: 10 };
      expect(classRules.getDruidWildShapeUses(playerStats)).toBe(2);
    });
  });

  describe('getDruidBeastKnownForms', () => {
    it('should always return 0 (no limit)', () => {
      const playerStats = { class: { name: 'Druid' }, level: 5 };
      expect(classRules.getDruidBeastKnownForms(playerStats)).toBe(0);
    });
  });

  describe('getDruidBeastFlySpeed', () => {
    it('should return true when wild_shape_fly is true', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          class_levels: [{ level: 4, class_specific: { wild_shape_fly: true } }],
        },
        level: 4,
      };
      expect(classRules.getDruidBeastFlySpeed(playerStats)).toBe(true);
    });

    it('should return false when wild_shape_fly is false', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          class_levels: [{ level: 1, class_specific: { wild_shape_fly: false } }],
        },
        level: 1,
      };
      expect(classRules.getDruidBeastFlySpeed(playerStats)).toBe(false);
    });

    it('should return undefined when wild_shape_fly is not set', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          class_levels: [{ level: 1, class_specific: {} }],
        },
        level: 1,
      };
      expect(classRules.getDruidBeastFlySpeed(playerStats)).toBeUndefined();
    });

    it('should return undefined when class_specific is missing', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          class_levels: [{ level: 1 }],
        },
        level: 1,
      };
      expect(classRules.getDruidBeastFlySpeed(playerStats)).toBeUndefined();
    });

    it('should return undefined when class_levels is missing', () => {
      const playerStats = { class: { name: 'Druid' }, level: 1 };
      expect(classRules.getDruidBeastFlySpeed(playerStats)).toBeUndefined();
    });
  });

  describe('getRogueSneakAttack', () => {
    it('should return sneak_attack from current level class_specific', () => {
      const playerStats = {
        class: {
          name: 'Rogue',
          class_levels: [
            { level: 5, class_specific: { sneak_attack: { dice_count: 5, dice_value: 6 } } },
          ],
        },
        level: 5,
      };
      expect(classRules.getRogueSneakAttack(playerStats)).toEqual({ dice_count: 5, dice_value: 6 });
    });

    it('should return default when class_specific is missing', () => {
      const playerStats = {
        class: {
          name: 'Rogue',
          class_levels: [{ level: 1 }],
        },
        level: 1,
      };
      expect(classRules.getRogueSneakAttack(playerStats)).toEqual({ dice_count: 0, dice_value: 6 });
    });

    it('should return default when class_levels is missing', () => {
      const playerStats = { class: { name: 'Rogue' }, level: 1 };
      expect(classRules.getRogueSneakAttack(playerStats)).toEqual({ dice_count: 0, dice_value: 6 });
    });

    it('should return default when sneak_attack is not in class_specific', () => {
      const playerStats = {
        class: {
          name: 'Rogue',
          class_levels: [{ level: 3, class_specific: {} }],
        },
        level: 3,
      };
      expect(classRules.getRogueSneakAttack(playerStats)).toEqual({ dice_count: 0, dice_value: 6 });
    });
  });

  describe('getHighestSubclassLevel', () => {
    it('should return 0 when no subclass exists', () => {
      const playerStats = { class: { name: 'Wizard', subclass: null }, level: 5 };
      expect(classRules.getHighestSubclassLevel(playerStats)).toBe(0);
    });

    it('should return highest subclass level <= player level', () => {
      const playerStats = {
        class: {
          name: 'Wizard',
          subclass: {
            name: 'Abjuration',
            class_levels: [{ level: 2 }, { level: 3 }, { level: 4 }, { level: 5 }],
          },
        },
        level: 4,
      };
      const result = classRules.getHighestSubclassLevel(playerStats);
      expect(result.level).toBe(4);
    });

    it('should return 0 when player level is below first subclass level', () => {
      const playerStats = {
        class: {
          name: 'Wizard',
          subclass: {
            name: 'Abjuration',
            class_levels: [{ level: 2 }, { level: 3 }],
          },
        },
        level: 1,
      };
      expect(classRules.getHighestSubclassLevel(playerStats)).toBe(0);
    });

    it('should return last subclass level when player level exceeds all subclass levels', () => {
      const playerStats = {
        class: {
          name: 'Wizard',
          subclass: {
            name: 'Abjuration',
            class_levels: [{ level: 2 }, { level: 3 }, { level: 4 }],
          },
        },
        level: 10,
      };
      expect(classRules.getHighestSubclassLevel(playerStats)).toEqual({ level: 4 });
    });

    it('should handle subclass without class_levels', () => {
      const playerStats = {
        class: {
          name: 'Wizard',
          subclass: { name: 'Abjuration' },
        },
        level: 5,
      };
      expect(classRules.getHighestSubclassLevel(playerStats)).toBe(0);
    });
  });

  describe('getFeatures', () => {
    it('should return categorized features from class levels up to player level', () => {
      const playerStats = {
        class: {
          name: 'Fighter',
          class_levels: [
            { level: 1, features: ['Weapon Training'] },
            { level: 2, features: ['Second Wind', 'Action Surge'] },
            { level: 3, features: ['Extra Attack'] },
          ],
        },
        level: 2,
        subclass: null,
      };
      const result = classRules.getFeatures(playerStats);

      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
      expect(result.bonusActions).toBeDefined();
      expect(result.reactions).toBeDefined();
      expect(result.specialActions).toBeDefined();
      expect(result.characterAdvancement).toBeDefined();
    });

    it('should filter out class levels beyond player level', () => {
      const playerStats = {
        class: {
          name: 'Fighter',
          class_levels: [
            { level: 1, features: [{ name: 'Weapon Training' }] },
            { level: 2, features: [{ name: 'Second Wind' }] },
            { level: 3, features: [{ name: 'Action Surge' }] },
          ],
        },
        level: 2,
        subclass: null,
      };
      const result = classRules.getFeatures(playerStats);

      const allFeatureNames = [
        ...result.actions,
        ...result.bonusActions,
        ...result.reactions,
        ...result.specialActions,
        ...result.characterAdvancement,
      ].map((f) => f.name);
      expect(allFeatureNames).toContain('Second Wind');
      expect(allFeatureNames).not.toContain('Action Surge');
    });

    it('should merge subclass features with class features', () => {
      const playerStats = {
        class: {
          name: 'Fighter',
          class_levels: [{ level: 1, features: [{ name: 'Weapon Training' }] }],
          subclass: {
            name: 'Battle Master',
            class_levels: [{ level: 3, features: [{ name: 'Combat Maneuvers' }] }],
          },
        },
        level: 3,
      };
      const result = classRules.getFeatures(playerStats);

      const allFeatureNames = [
        ...result.actions,
        ...result.bonusActions,
        ...result.reactions,
        ...result.specialActions,
        ...result.characterAdvancement,
      ].map((f) => f.name);
      expect(allFeatureNames).toContain('Weapon Training');
      expect(allFeatureNames).toContain('Combat Maneuvers');
    });

    it('should return empty categories when class has no features', () => {
      const playerStats = {
        class: {
          name: 'Fighter',
          class_levels: [{ level: 1 }],
        },
        level: 1,
        subclass: null,
      };
      const result = classRules.getFeatures(playerStats);

      expect(result.actions).toEqual([]);
      expect(result.bonusActions).toEqual([]);
      expect(result.reactions).toEqual([]);
      expect(result.specialActions).toEqual([]);
      expect(result.characterAdvancement).toEqual([]);
    });

    it('should handle subclass without features', () => {
      const playerStats = {
        class: {
          name: 'Fighter',
          class_levels: [{ level: 1, features: ['Weapon Training'] }],
          subclass: {
            name: 'Battle Master',
            class_levels: [{ level: 3 }],
          },
        },
        level: 3,
      };
      const result = classRules.getFeatures(playerStats);

      expect(result).toBeDefined();
    });
  });

  describe('addFeatures', () => {
    it('should categorize features from all levels', () => {
      const levels = [
        { level: 1, features: ['Weapon Training'] },
        { level: 2, features: ['Second Wind', 'Action Surge'] },
      ];
      const result = addFeatures(levels, featureCategories, { descriptionField: 'description' });

      expect(result).toHaveProperty('actions');
      expect(result).toHaveProperty('bonusActions');
      expect(result).toHaveProperty('reactions');
      expect(result).toHaveProperty('specialActions');
      expect(result).toHaveProperty('characterAdvancement');
    });

    it('should return empty category arrays for empty levels', () => {
      const result = addFeatures([], featureCategories, { descriptionField: 'description' });

      expect(result.actions).toEqual([]);
      expect(result.bonusActions).toEqual([]);
      expect(result.reactions).toEqual([]);
      expect(result.specialActions).toEqual([]);
      expect(result.characterAdvancement).toEqual([]);
    });

    it('should return empty category arrays for levels without features', () => {
      const levels = [{ level: 1 }, { level: 2 }];
      const result = addFeatures(levels, featureCategories, { descriptionField: 'description' });

      expect(result.actions).toEqual([]);
      expect(result.bonusActions).toEqual([]);
      expect(result.reactions).toEqual([]);
      expect(result.specialActions).toEqual([]);
      expect(result.characterAdvancement).toEqual([]);
    });

    it('should return empty category arrays for levels with empty features arrays', () => {
      const levels = [{ level: 1, features: [] }, { level: 2, features: [] }];
      const result = addFeatures(levels, featureCategories, { descriptionField: 'description' });

      expect(result.actions).toEqual([]);
      expect(result.bonusActions).toEqual([]);
      expect(result.reactions).toEqual([]);
      expect(result.specialActions).toEqual([]);
      expect(result.characterAdvancement).toEqual([]);
    });
  });

  describe('mergeCategorizedFeatures', () => {
    it('should merge two categorized feature objects deduplicating by name', () => {
      const base = {
        actions: [{ name: 'Attack' }],
        bonusActions: [{ name: 'Bonus' }],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      };
      const additional = {
        actions: [{ name: 'Attack' }, { name: 'Cast Spell' }],
        bonusActions: [],
        reactions: [{ name: 'Opportunity Attack' }],
        specialActions: [],
        characterAdvancement: [],
      };

      const result = mergeCategorizedFeatures(base, additional);

      expect(result.actions).toHaveLength(2);
      expect(result.actions.map((f) => f.name)).toEqual(['Attack', 'Cast Spell']);
      expect(result.reactions).toHaveLength(1);
      expect(result.reactions[0].name).toBe('Opportunity Attack');
    });

    it('should deduplicate features with the same name across base and additional', () => {
      const base = {
        actions: [{ name: 'Same Name' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      };
      const additional = {
        actions: [{ name: 'Same Name' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      };

      const result = mergeCategorizedFeatures(base, additional);

      expect(result.actions).toHaveLength(1);
    });
  });

  describe('getClericFeatures', () => {
    it('should return channel_divinity_charges and destroy_undead_cr from class_specific', () => {
      const playerStats = {
        class: {
          name: 'Cleric',
          class_levels: [
            {
              level: 5,
              class_specific: { channel_divinity_charges: 2, destroy_undead_cr: 1 / 2 },
            },
          ],
        },
        level: 5,
      };
      const result = classRules.getClericFeatures(playerStats);

      expect(result).toEqual({ maxChannelDivinity: 2, destroyUndeadCR: 1 / 2 });
    });

    it('should return 0 for channel_divinity_charges when missing', () => {
      const playerStats = {
        class: {
          name: 'Cleric',
          class_levels: [{ level: 1 }],
        },
        level: 1,
      };
      const result = classRules.getClericFeatures(playerStats);

      expect(result).toEqual({ maxChannelDivinity: 0, destroyUndeadCR: null });
    });

    it('should return null for destroy_undead_cr when not set', () => {
      const playerStats = {
        class: {
          name: 'Cleric',
          class_levels: [{ level: 5, class_specific: { channel_divinity_charges: 2 } }],
        },
        level: 5,
      };
      const result = classRules.getClericFeatures(playerStats);

      expect(result.destroyUndeadCR).toBeNull();
    });

    it('should return defaults when class_levels is missing', () => {
      const playerStats = { class: { name: 'Cleric' }, level: 1 };
      const result = classRules.getClericFeatures(playerStats);

      expect(result).toEqual({ maxChannelDivinity: 0, destroyUndeadCR: null });
    });
  });

  describe('getDruidFeatures', () => {
    it('should return wild shape features with correct defaults', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          class_levels: [{ level: 2, class_specific: {} }],
        },
        level: 2,
      };
      const result = classRules.getDruidFeatures(playerStats);

      expect(result).toEqual({
        maxWildShapeUses: 2,
        maxWildShapeChallengeRating: 0,
        beastKnownForms: 0,
        wildShapeLimitations: 'walk only (no swim or fly)',
      });
    });

    it('should set wildShapeLimitations to include fly when wild_shape_fly is true', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          class_levels: [{ level: 4, class_specific: { wild_shape_fly: true } }],
        },
        level: 4,
      };
      const result = classRules.getDruidFeatures(playerStats);

      expect(result.wildShapeLimitations).toBe('walk, swim, or fly');
    });

    it('should set wildShapeLimitations to include swim when wild_shape_swim is true', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          class_levels: [{ level: 4, class_specific: { wild_shape_swim: true } }],
        },
        level: 4,
      };
      const result = classRules.getDruidFeatures(playerStats);

      expect(result.wildShapeLimitations).toBe('walk or swim only (no fly)');
    });

    it('should return fly limitation when both wild_shape_fly and wild_shape_swim are true', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          class_levels: [
            { level: 4, class_specific: { wild_shape_fly: true, wild_shape_swim: true } },
          ],
        },
        level: 4,
      };
      const result = classRules.getDruidFeatures(playerStats);

      expect(result.wildShapeLimitations).toBe('walk, swim, or fly');
    });

    it('should return defaults when class_levels is missing', () => {
      const playerStats = { class: { name: 'Druid' }, level: 1 };
      const result = classRules.getDruidFeatures(playerStats);

      expect(result.maxWildShapeUses).toBe(2);
      expect(result.maxWildShapeChallengeRating).toBe(0);
      expect(result.beastKnownForms).toBe(0);
      expect(result.wildShapeLimitations).toBe('walk only (no swim or fly)');
    });
  });

  describe('getPaladinFeatures', () => {
    it('should return channel_divinity_charges, aura_range, and extraAttacks from class_specific', () => {
      const playerStats = {
        class: {
          name: 'Paladin',
          class_levels: [
            { level: 5, class_specific: { channel_divinity_charges: 2, aura_range: 10 } },
          ],
        },
        level: 5,
      };
      const result = classRules.getPaladinFeatures(playerStats);

      expect(result).toEqual({ maxChannelDivinity: 2, auraRange: 10, extraAttacks: 1 });
    });

    it('should return 0 extraAttacks when level <= 4', () => {
      const playerStats = {
        class: {
          name: 'Paladin',
          class_levels: [{ level: 3, class_specific: { channel_divinity_charges: 1 } }],
        },
        level: 3,
      };
      const result = classRules.getPaladinFeatures(playerStats);

      expect(result.extraAttacks).toBe(0);
    });

    it('should return defaults when class_specific is missing', () => {
      const playerStats = {
        class: {
          name: 'Paladin',
          class_levels: [{ level: 5 }],
        },
        level: 5,
      };
      const result = classRules.getPaladinFeatures(playerStats);

      expect(result).toEqual({ maxChannelDivinity: 0, auraRange: null, extraAttacks: 1 });
    });

    it('should return defaults when class_levels is missing', () => {
      const playerStats = { class: { name: 'Paladin' }, level: 1 };
      const result = classRules.getPaladinFeatures(playerStats);

      expect(result).toEqual({ maxChannelDivinity: 0, auraRange: null, extraAttacks: 0 });
    });
  });

  describe('getSorcererFeatures', () => {
    it('should return sorcerer features from class_specific', () => {
      const playerStats = {
        class: {
          name: 'Sorcerer',
          class_levels: [
            {
              level: 3,
              class_specific: {
                sorcery_points: 3,
                metamagic_known: 2,
                creating_spell_slots: [
                  { sorcery_point_cost: 2 },
                  { sorcery_point_cost: 3 },
                ],
              },
            },
          ],
        },
        level: 3,
      };
      const result = classRules.getSorcererFeatures(playerStats);

      expect(result).toEqual({
        maxSorceryPoints: 3,
        metamagicKnown: 2,
        maxInnateSorcery: 0,
        creatingSpellSlotCosts: [2, 3],
      });
    });

    it('should return defaults when class_specific is missing', () => {
      const playerStats = {
        class: {
          name: 'Sorcerer',
          class_levels: [{ level: 1 }],
        },
        level: 1,
      };
      const result = classRules.getSorcererFeatures(playerStats);

      expect(result).toEqual({
        maxSorceryPoints: 0,
        metamagicKnown: 0,
        maxInnateSorcery: 0,
        creatingSpellSlotCosts: [],
      });
    });

    it('should return empty creatingSpellSlotCosts when creating_spell_slots is missing', () => {
      const playerStats = {
        class: {
          name: 'Sorcerer',
          class_levels: [{ level: 3, class_specific: { sorcery_points: 3 } }],
        },
        level: 3,
      };
      const result = classRules.getSorcererFeatures(playerStats);

      expect(result.creatingSpellSlotCosts).toEqual([]);
    });

    it('should return defaults when class_levels is missing', () => {
      const playerStats = { class: { name: 'Sorcerer' }, level: 1 };
      const result = classRules.getSorcererFeatures(playerStats);

      expect(result).toEqual({
        maxSorceryPoints: 0,
        metamagicKnown: 0,
        maxInnateSorcery: 0,
        creatingSpellSlotCosts: [],
      });
    });
  });

  describe('getWarlockFeatures', () => {
    it('should return warlock features from class_specific', () => {
      const playerStats = {
        class: {
          name: 'Warlock',
          class_levels: [
            {
              level: 5,
              class_specific: {
                invocations_known: 5,
                mystic_arcanum_level_6: 4,
                mystic_arcanum_level_7: 5,
                mystic_arcanum_level_8: 6,
                mystic_arcanum_level_9: 7,
              },
            },
          ],
        },
        level: 5,
      };
      const result = classRules.getWarlockFeatures(playerStats);

      expect(result).toEqual({
        invocationsKnown: 5,
        hasArcanum: false,
        arcanumLevels: { level6: 0, level7: 0, level8: 0, level9: 0 },
        arcanums: [],
      });
    });

    it('should return arcanum data when level > 10', () => {
      const playerStats = {
        class: {
          name: 'Warlock',
          class_levels: [
            {
              level: 13,
              class_specific: {
                invocations_known: 10,
                mystic_arcanum_level_6: 5,
                mystic_arcanum_level_7: 6,
                mystic_arcanum_level_8: 7,
                mystic_arcanum_level_9: 8,
              },
            },
          ],
        },
        level: 13,
      };
      const result = classRules.getWarlockFeatures(playerStats);

      expect(result).toEqual({
        invocationsKnown: 10,
        hasArcanum: true,
        arcanumLevels: { level6: 5, level7: 6, level8: 7, level9: 8 },
        arcanums: [],
      });
    });

    it('should use class.arcanums when provided', () => {
      const playerStats = {
        class: {
          name: 'Warlock',
          arcanums: [{ name: 'Foresight', level: 9 }],
          class_levels: [{ level: 13, class_specific: { invocations_known: 10 } }],
        },
        level: 13,
      };
      const result = classRules.getWarlockFeatures(playerStats);

      expect(result.arcanums).toEqual([{ name: 'Foresight', level: 9 }]);
    });

    it('should return defaults when class_specific is missing', () => {
      const playerStats = {
        class: {
          name: 'Warlock',
          class_levels: [{ level: 1 }],
        },
        level: 1,
      };
      const result = classRules.getWarlockFeatures(playerStats);

      expect(result).toEqual({
        invocationsKnown: 0,
        hasArcanum: false,
        arcanumLevels: { level6: 0, level7: 0, level8: 0, level9: 0 },
        arcanums: [],
      });
    });

    it('should return defaults when class_levels is missing', () => {
      const playerStats = { class: { name: 'Warlock' }, level: 1 };
      const result = classRules.getWarlockFeatures(playerStats);

      expect(result).toEqual({
        invocationsKnown: 0,
        hasArcanum: false,
        arcanumLevels: { level6: 0, level7: 0, level8: 0, level9: 0 },
        arcanums: [],
      });
    });
  });

  describe('getWizardFeatures', () => {
    it('should return arcaneRecoveryLevels from class_specific', () => {
      const playerStats = {
        class: {
          name: 'Wizard',
          class_levels: [
            { level: 4, class_specific: { arcane_recovery_levels: 3 } },
          ],
        },
        level: 4,
      };
      const result = classRules.getWizardFeatures(playerStats);

      expect(result).toEqual({ arcaneRecoveryLevels: 3, showWizardFeatures: true });
    });

    it('should return 0 for arcaneRecoveryLevels when missing', () => {
      const playerStats = {
        class: {
          name: 'Wizard',
          class_levels: [{ level: 1 }],
        },
        level: 1,
      };
      const result = classRules.getWizardFeatures(playerStats);

      expect(result).toEqual({ arcaneRecoveryLevels: 0, showWizardFeatures: true });
    });

    it('should return defaults when class_levels is missing', () => {
      const playerStats = { class: { name: 'Wizard' }, level: 1 };
      const result = classRules.getWizardFeatures(playerStats);

      expect(result).toEqual({ arcaneRecoveryLevels: 0, showWizardFeatures: true });
    });
  });

  describe('getMonkFeatures', () => {
    it('should return hardcoded monk features', () => {
      const result = classRules.getMonkFeatures();

      expect(result).toEqual({
        martialArtsDie: 4,
        unarmoredMovementIncrease: 0,
        maxFocusPoints: 0,
        wisdomBonus: 0,
      });
    });
  });

  describe('getRangerFeatures', () => {
    it('should return favoredEnemies and extraAttacks', () => {
      const playerStats = {
        class: { name: 'Ranger' },
        level: 5,
      };
      const result = classRules.getRangerFeatures(playerStats);

      expect(result).toEqual({ favoredEnemies: 0, extraAttacks: 1 });
    });

    it('should return 0 extraAttacks when level <= 4', () => {
      const playerStats = { class: { name: 'Ranger' }, level: 3 };
      const result = classRules.getRangerFeatures(playerStats);

      expect(result).toEqual({ favoredEnemies: 0, extraAttacks: 0 });
    });
  });

  describe('getRogueFeatures', () => {
    it('should return sneakAttack and expertise from class', () => {
      const playerStats = {
        class: {
          name: 'Rogue',
          expertise: ['Stealth', 'Persuasion'],
          class_levels: [
            { level: 5, class_specific: { sneak_attack: { dice_count: 5, dice_value: 6 } } },
          ],
        },
        level: 5,
        expertise: ['Stealth', 'Persuasion'],
      };
      const result = classRules.getRogueFeatures(playerStats);

      expect(result).toEqual({
        sneakAttack: { dice_count: 5, dice_value: 6 },
        expertise: ['Stealth', 'Persuasion'],
      });
    });

    it('should return default sneakAttack when class_levels is missing', () => {
      const playerStats = { class: { name: 'Rogue', expertise: ['Stealth'] }, level: 1, expertise: ['Stealth'] };
      const result = classRules.getRogueFeatures(playerStats);

      expect(result).toEqual({
        sneakAttack: { dice_count: 0, dice_value: 6 },
        expertise: ['Stealth'],
      });
    });
  });

  describe('getBardFeatures', () => {
    it('should return bardicDie, songOfRestDie, and magicalSecrets from class_specific', () => {
      const playerStats = {
        class: {
          name: 'Bard',
          class_levels: [
            {
              level: 5,
              class_specific: {
                bardic_inspiration_die: 'd6',
                song_of_rest_die: 'd6',
                magical_secrets_max_5: 2,
              },
            },
          ],
        },
        level: 5,
      };
      const result = classRules.getBardFeatures(playerStats);

      expect(result).toEqual({
        bardicDie: 'd6',
        songOfRestDie: 'd6',
        magicalSecrets: 2,
        subclassMagicalSecrets: 0,
      });
    });

    it('should return 0 for songOfRestDie when null in class_specific', () => {
      const playerStats = {
        class: {
          name: 'Bard',
          class_levels: [{ level: 3, class_specific: { bardic_inspiration_die: 'd4', song_of_rest_die: null } }],
        },
        level: 3,
      };
      const result = classRules.getBardFeatures(playerStats);

      expect(result.songOfRestDie).toBeNull();
    });

    it('should return 0 for magicalSecrets when not set', () => {
      const playerStats = {
        class: {
          name: 'Bard',
          class_levels: [{ level: 5, class_specific: { bardic_inspiration_die: 'd6' } }],
        },
        level: 5,
      };
      const result = classRules.getBardFeatures(playerStats);

      expect(result.magicalSecrets).toBeNull();
    });

    it('should return subclassMagicalSecrets for College of Lore bard level > 2', () => {
      const playerStats = {
        class: {
          name: 'Bard',
          subclass: { name: 'Lore', class_levels: [{ level: 6, subclass_specific: { additional_magical_secrets_max_lvl: 2 } }] },
          class_levels: [{ level: 6, class_specific: { bardic_inspiration_die: 'd8' } }],
        },
        level: 6,
      };
      const result = classRules.getBardFeatures(playerStats);

      expect(result.subclassMagicalSecrets).toBe(2);
    });

    it('should return 0 subclassMagicalSecrets for non-Lore subclass', () => {
      const playerStats = {
        class: {
          name: 'Bard',
          subclass: { name: 'Valley' },
          class_levels: [{ level: 6, class_specific: { bardic_inspiration_die: 'd8' } }],
        },
        level: 6,
      };
      const result = classRules.getBardFeatures(playerStats);

      expect(result.subclassMagicalSecrets).toBe(0);
    });

    it('should return 0 subclassMagicalSecrets for Lore bard at level <= 2', () => {
      const playerStats = {
        class: {
          name: 'Bard',
          subclass: { name: 'Lore' },
          class_levels: [{ level: 2, class_specific: { bardic_inspiration_die: 'd6' } }],
        },
        level: 2,
      };
      const result = classRules.getBardFeatures(playerStats);

      expect(result.subclassMagicalSecrets).toBe(0);
    });

    it('should return defaults when class_levels is missing', () => {
      const playerStats = { class: { name: 'Bard' }, level: 1 };
      const result = classRules.getBardFeatures(playerStats);

      expect(result.bardicDie).toBe(0);
      expect(result.songOfRestDie).toBeNull();
      expect(result.magicalSecrets).toBeNull();
      expect(result.subclassMagicalSecrets).toBe(0);
    });
  });
});
