// @cleaned-by-ai
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
      },
      {
        name: 'Bard',
        index: 'bard',
        class_levels: [],
      },
    ];

    it('returns merged class data for a valid class', () => {
      const playerSummary = { class: { name: 'Wizard' } };
      const result = classRules.getClass(mockClasses, playerSummary);

      expect(result.name).toBe('Wizard');
      expect(result.saving_throws).toEqual(['Intelligence']);
      expect(result.subclass).toBeNull();
      expect(result.subclasses).toBeUndefined();
    });

    it('converts all saving_throws abbreviations to full names', () => {
      const playerSummary = { class: { name: 'Fighter' } };
      const result = classRules.getClass(mockClasses, playerSummary);
      expect(result.saving_throws).toEqual(['Strength', 'Constitution']);
    });

    it('includes subclass when specified in playerSummary', () => {
      const playerSummary = { class: { name: 'Wizard', subclass: { name: 'Abjuration' } } };
      const result = classRules.getClass(mockClasses, playerSummary);
      expect(result.subclass.name).toBe('Abjuration');
    });

    it('should set subclass to null when not specified', () => {
      const playerSummary = { class: { name: 'Wizard' } };
      const result = classRules.getClass(mockClasses, playerSummary);
      expect(result.subclass).toBeNull();
    });

    it('should merge playerSummary class properties onto base class', () => {
      const playerSummary = { class: { name: 'Wizard', customProperty: 'custom value' } };
      const result = classRules.getClass(mockClasses, playerSummary);
      expect(result.customProperty).toBe('custom value');
    });

    it('should return empty class_levels when class is not found', () => {
      const playerSummary = { class: { name: 'NonExistent' } };
      const result = classRules.getClass(mockClasses, playerSummary);
      expect(result).toEqual({ class_levels: [] });
    });
  });

  describe('getDruidMaxWildShapeChallengeRating', () => {
    it('returns wild_shape_max_cr from class_specific when set', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          class_levels: [{ level: 3, class_specific: { wild_shape_max_cr: 1 / 2 } }],
        },
        level: 3,
      };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(1 / 2);
    });

    it('returns 1 for Circle of Moon Druid levels 2-5', () => {
      const playerStats = { class: { name: 'Druid', subclass: { name: 'Moon' } }, level: 4 };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(1);
    });

    it('returns floor(level/3) for Circle of Moon Druid level 6+', () => {
      const playerStats = { class: { name: 'Druid', subclass: { name: 'Moon' } }, level: 9 };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(3);
    });

    it('prefers class_specific over Moon subclass modifier', () => {
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

  describe('getDruidBeastFlySpeed', () => {
    it('returns true when wild_shape_fly is true', () => {
      const playerStats = {
        class: { name: 'Druid', class_levels: [{ level: 4, class_specific: { wild_shape_fly: true } }] },
        level: 4,
      };
      expect(classRules.getDruidBeastFlySpeed(playerStats)).toBe(true);
    });

    it('returns false when wild_shape_fly is false', () => {
      const playerStats = {
        class: { name: 'Druid', class_levels: [{ level: 1, class_specific: { wild_shape_fly: false } }] },
        level: 1,
      };
      expect(classRules.getDruidBeastFlySpeed(playerStats)).toBe(false);
    });

    it('returns undefined when wild_shape_fly is not set', () => {
      const playerStats = {
        class: { name: 'Druid', class_levels: [{ level: 1, class_specific: {} }] },
        level: 1,
      };
      expect(classRules.getDruidBeastFlySpeed(playerStats)).toBeUndefined();
    });
  });

  describe('getRogueSneakAttack', () => {
    it('returns sneak_attack from current level class_specific', () => {
      const playerStats = {
        class: {
          name: 'Rogue',
          class_levels: [{ level: 5, class_specific: { sneak_attack: { dice_count: 5, dice_value: 6 } } }],
        },
        level: 5,
      };
      expect(classRules.getRogueSneakAttack(playerStats)).toEqual({ dice_count: 5, dice_value: 6 });
    });

    it('returns default when class_specific is missing', () => {
      const playerStats = { class: { name: 'Rogue' }, level: 1 };
      expect(classRules.getRogueSneakAttack(playerStats)).toEqual({ dice_count: 0, dice_value: 6 });
    });
  });

  describe('getHighestSubclassLevel', () => {
    it('returns 0 when no subclass exists', () => {
      const playerStats = { class: { name: 'Wizard', subclass: null }, level: 5 };
      expect(classRules.getHighestSubclassLevel(playerStats)).toBe(0);
    });

    it('returns highest subclass level <= player level', () => {
      const playerStats = {
        class: {
          name: 'Wizard',
          subclass: { name: 'Abjuration', class_levels: [{ level: 2 }, { level: 3 }, { level: 4 }, { level: 5 }] },
        },
        level: 4,
      };
      expect(classRules.getHighestSubclassLevel(playerStats).level).toBe(4);
    });

    it('returns 0 when player level is below first subclass level', () => {
      const playerStats = {
        class: {
          name: 'Wizard',
          subclass: { name: 'Abjuration', class_levels: [{ level: 2 }] },
        },
        level: 1,
      };
      expect(classRules.getHighestSubclassLevel(playerStats)).toBe(0);
    });
  });

  describe('getFeatures', () => {
    it('returns categorized features from class levels up to player level', () => {
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
      expect(result.actions).toBeDefined();
      expect(result.bonusActions).toBeDefined();
      expect(result.reactions).toBeDefined();
      expect(result.specialActions).toBeDefined();
      expect(result.characterAdvancement).toBeDefined();
    });

    it('filters out class levels beyond player level', () => {
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
        ...result.actions, ...result.bonusActions, ...result.reactions,
        ...result.specialActions, ...result.characterAdvancement,
      ].map((f) => f.name);
      expect(allFeatureNames).toContain('Second Wind');
      expect(allFeatureNames).not.toContain('Action Surge');
    });

    it('merges subclass features with class features', () => {
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
        ...result.actions, ...result.bonusActions, ...result.reactions,
        ...result.specialActions, ...result.characterAdvancement,
      ].map((f) => f.name);
      expect(allFeatureNames).toContain('Weapon Training');
      expect(allFeatureNames).toContain('Combat Maneuvers');
    });

    it('returns empty categories when class has no features', () => {
      const playerStats = {
        class: { name: 'Fighter', class_levels: [{ level: 1 }] },
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
    });

    it('should deduplicate features with the same name across base and additional', () => {
      const base = { actions: [{ name: 'Same Name' }], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [] };
      const additional = { actions: [{ name: 'Same Name' }], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [] };
      const result = mergeCategorizedFeatures(base, additional);
      expect(result.actions).toHaveLength(1);
    });
  });

  describe('class-specific getters', () => {
    it('getClericFeatures returns channel_divinity_charges and destroy_undead_cr from class_specific', () => {
      const playerStats = {
        class: {
          name: 'Cleric',
          class_levels: [{ level: 5, class_specific: { channel_divinity_charges: 2, destroy_undead_cr: 1 / 2 } }],
        },
        level: 5,
      };
      expect(classRules.getClericFeatures(playerStats)).toEqual({ maxChannelDivinity: 2, destroyUndeadCR: 1 / 2 });
    });

    it('getDruidFeatures returns wild shape features with correct defaults', () => {
      const playerStats = {
        class: { name: 'Druid', class_levels: [{ level: 2, class_specific: {} }] },
        level: 2,
      };
      const result = classRules.getDruidFeatures(playerStats);
      expect(result.maxWildShapeUses).toBe(2);
      expect(result.maxWildShapeChallengeRating).toBe(0);
      expect(result.beastKnownForms).toBe(0);
      expect(result.wildShapeLimitations).toBe('walk only (no swim or fly)');
    });

    it('getDruidFeatures sets wildShapeLimitations based on fly/swim flags', () => {
      const flyStats = {
        class: { name: 'Druid', class_levels: [{ level: 4, class_specific: { wild_shape_fly: true } }] },
        level: 4,
      };
      expect(classRules.getDruidFeatures(flyStats).wildShapeLimitations).toBe('walk, swim, or fly');

      const swimStats = {
        class: { name: 'Druid', class_levels: [{ level: 4, class_specific: { wild_shape_swim: true } }] },
        level: 4,
      };
      expect(classRules.getDruidFeatures(swimStats).wildShapeLimitations).toBe('walk or swim only (no fly)');
    });

    it('getPaladinFeatures returns channel_divinity_charges, aura_range, and extraAttacks', () => {
      const playerStats = {
        class: { name: 'Paladin', class_levels: [{ level: 5, class_specific: { channel_divinity_charges: 2, aura_range: 10 } }] },
        level: 5,
      };
      expect(classRules.getPaladinFeatures(playerStats)).toEqual({ maxChannelDivinity: 2, auraRange: 10, extraAttacks: 1 });
    });

    it('getPaladinFeatures returns 0 extraAttacks when level <= 4', () => {
      const playerStats = { class: { name: 'Paladin' }, level: 3 };
      expect(classRules.getPaladinFeatures(playerStats).extraAttacks).toBe(0);
    });

    it('getSorcererFeatures returns sorcerer features from class_specific', () => {
      const playerStats = {
        class: {
          name: 'Sorcerer',
          class_levels: [{ level: 3, class_specific: { sorcery_points: 3, metamagic_known: 2, creating_spell_slots: [{ sorcery_point_cost: 2 }] } }],
        },
        level: 3,
      };
      const result = classRules.getSorcererFeatures(playerStats);
      expect(result.maxSorceryPoints).toBe(3);
      expect(result.metamagicKnown).toBe(2);
      expect(result.creatingSpellSlotCosts).toEqual([2]);
    });

    it('getWarlockFeatures returns arcanum data when level > 10', () => {
      const playerStats = {
        class: {
          name: 'Warlock',
          class_levels: [{ level: 13, class_specific: { invocations_known: 10, mystic_arcanum_level_6: 5 } }],
        },
        level: 13,
      };
      const result = classRules.getWarlockFeatures(playerStats);
      expect(result.invocationsKnown).toBe(10);
      expect(result.hasArcanum).toBe(true);
      expect(result.arcanumLevels.level6).toBe(5);
    });

    it('getWarlockFeatures uses class.arcanums when provided', () => {
      const playerStats = {
        class: {
          name: 'Warlock',
          arcanums: [{ name: 'Foresight', level: 9 }],
          class_levels: [{ level: 13, class_specific: { invocations_known: 10 } }],
        },
        level: 13,
      };
      expect(classRules.getWarlockFeatures(playerStats).arcanums).toEqual([{ name: 'Foresight', level: 9 }]);
    });

    it('getWizardFeatures returns arcaneRecoveryLevels from class_specific', () => {
      const playerStats = {
        class: { name: 'Wizard', class_levels: [{ level: 4, class_specific: { arcane_recovery_levels: 3 } }] },
        level: 4,
      };
      expect(classRules.getWizardFeatures(playerStats)).toEqual({ arcaneRecoveryLevels: 3, arcaneWard: false, arcaneWardMax: 0, showWizardFeatures: true });
    });

    it('getWizardFeatures returns arcaneWard: true for Abjurer', () => {
      const playerStats = {
        class: { name: 'Wizard', subclass: { name: 'Abjuration' }, class_levels: [{ level: 4 }] },
        level: 4,
        abilities: [{ name: 'Intelligence', bonus: 3 }],
        automation: { passives: [{ type: 'arcane_ward', name: 'Arcane Ward' }] },
      };
      expect(classRules.getWizardFeatures(playerStats)).toEqual({ arcaneRecoveryLevels: 0, arcaneWard: true, arcaneWardMax: 11, showWizardFeatures: true });
    });

    it('getMonkFeatures returns hardcoded values', () => {
      expect(classRules.getMonkFeatures()).toEqual({
        martialArtsDie: 4, unarmoredMovementIncrease: 0, maxFocusPoints: 0, wisdomBonus: 0,
      });
    });

    it('getRangerFeatures returns extraAttacks based on level', () => {
      const highLevel = { class: { name: 'Ranger' }, level: 5 };
      expect(classRules.getRangerFeatures(highLevel).extraAttacks).toBe(1);
      const lowLevel = { class: { name: 'Ranger' }, level: 3 };
      expect(classRules.getRangerFeatures(lowLevel).extraAttacks).toBe(0);
    });

    it('getRogueFeatures returns sneakAttack and expertise', () => {
      const playerStats = {
        class: { name: 'Rogue', expertise: ['Stealth'], class_levels: [{ level: 5, class_specific: { sneak_attack: { dice_count: 5, dice_value: 6 } } }] },
        level: 5,
        expertise: ['Stealth'],
      };
      const result = classRules.getRogueFeatures(playerStats);
      expect(result.sneakAttack).toEqual({ dice_count: 5, dice_value: 6 });
      expect(result.expertise).toEqual(['Stealth']);
    });

    it('getBardFeatures returns subclassMagicalSecrets for College of Lore bard level > 2', () => {
      const playerStats = {
        class: {
          name: 'Bard',
          subclass: { name: 'Lore', class_levels: [{ level: 6, subclass_specific: { additional_magical_secrets_max_lvl: 2 } }] },
          class_levels: [{ level: 6, class_specific: { bardic_inspiration_die: 'd8' } }],
        },
        level: 6,
      };
      const result = classRules.getBardFeatures(playerStats);
      expect(result.bardicDie).toBe('d8');
      expect(result.subclassMagicalSecrets).toBe(2);
    });

    it('getBardFeatures returns 0 subclassMagicalSecrets for non-Lore subclass', () => {
      const playerStats = {
        class: {
          name: 'Bard',
          subclass: { name: 'Valley' },
          class_levels: [{ level: 6, class_specific: { bardic_inspiration_die: 'd8' } }],
        },
        level: 6,
      };
      expect(classRules.getBardFeatures(playerStats).subclassMagicalSecrets).toBe(0);
    });
  });
});
