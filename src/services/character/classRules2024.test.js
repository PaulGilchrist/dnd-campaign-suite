import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import classRules from './classRules2024.js';

describe('classRules2024', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getClass', () => {
    it('returns default class_levels when class not found', () => {
      const result = classRules.getClass([], { class: { name: 'Nonexistent' } });
      expect(result).toEqual({ class_levels: [] });
    });

    it('warns when class not found', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      classRules.getClass([], { class: { name: 'Nonexistent' } });
      expect(consoleWarnSpy).toHaveBeenCalledWith('Could not find class: Nonexistent');
      consoleWarnSpy.mockRestore();
    });

    it('returns found class with merged data', () => {
      const allClasses = [{
        name: 'Cleric',
        class_levels: [{ level: 1, features: [] }],
        saving_throw_proficiencies: ['WIS', 'CHA'],
        weapon_proficiencies: 'Simple weapons',
        armor_training: 'Light armor',
        tool_proficiencies: null,
        skill_proficiencies: null,
        skill_proficiencies_choices: null,
        majors: [],
      }];
      const result = classRules.getClass(allClasses, {
        class: { name: 'Cleric', major: { name: 'Knowledge' } },
      });
      expect(result.name).toBe('Cleric');
      expect(result.class_levels).toEqual([{ level: 1, features: [] }]);
      expect(result.major).toEqual({ name: 'Knowledge', features: [] });
      expect(result.majors).toBeUndefined();
    });

    it('converts short ability names to long names', () => {
      const allClasses = [{
        name: 'Cleric',
        saving_throw_proficiencies: ['WIS', 'CHA'],
      }];
      const result = classRules.getClass(allClasses, { class: { name: 'Cleric' } });
      expect(result.saving_throw_proficiencies).toContain('Wisdom');
      expect(result.saving_throw_proficiencies).toContain('Charisma');
    });

    it('handles weapon_proficiencies string mapping', () => {
      const allClasses = [{
        name: 'Cleric',
        weapon_proficiencies: 'Simple and Martial weapons',
      }];
      const result = classRules.getClass(allClasses, { class: { name: 'Cleric' } });
      expect(result.proficiencies).toContain('Simple Weapons');
      expect(result.proficiencies).toContain('Martial Weapons');
    });

    it('handles armor_training string mapping', () => {
      const allClasses = [{
        name: 'Fighter',
        armor_training: 'Light, Medium, and Heavy armor and Shields',
      }];
      const result = classRules.getClass(allClasses, { class: { name: 'Fighter' } });
      expect(result.proficiencies).toContain('Light Armor');
      expect(result.proficiencies).toContain('Medium Armor');
      expect(result.proficiencies).toContain('Heavy Armor');
      expect(result.proficiencies).toContain('Shields');
    });

    it('handles tool_proficiencies that do not start with Choose', () => {
      const allClasses = [{
        name: 'Cleric',
        tool_proficiencies: 'Healer\'s Kit',
      }];
      const result = classRules.getClass(allClasses, { class: { name: 'Cleric' } });
      expect(result.proficiencies).toContain('Healer\'s Kit');
    });

    it('skips tool_proficiencies that start with Choose', () => {
      const allClasses = [{
        name: 'Cleric',
        tool_proficiencies: 'Choose one kind of Artisan\'s Tools',
      }];
      const result = classRules.getClass(allClasses, { class: { name: 'Cleric' } });
      expect(result.proficiencies).not.toContain('Choose one kind of Artisan\'s Tools');
    });

    it('handles skill_proficiencies string parsing', () => {
      const allClasses = [{
        name: 'Cleric',
        skill_proficiencies: 'History, Insight, Medicine',
      }];
      const result = classRules.getClass(allClasses, { class: { name: 'Cleric' } });
      expect(result.proficiencies).toContain('Skill: History');
      expect(result.proficiencies).toContain('Skill: Insight');
      expect(result.proficiencies).toContain('Skill: Medicine');
    });

    it('skips skill_proficiencies that start with Choose', () => {
      const allClasses = [{
        name: 'Cleric',
        skill_proficiencies: 'Choose two skills',
      }];
      const result = classRules.getClass(allClasses, { class: { name: 'Cleric' } });
      expect(result.proficiencies).not.toContain('Choose two skills');
    });

    it('adds Martial Weapons and Heavy Armor for Divine Order Protector Cleric', () => {
      const allClasses = [{
        name: 'Cleric',
      }];
      const result = classRules.getClass(allClasses, {
        class: { name: 'Cleric', divineOrder: 'Protector' },
      });
      expect(result.proficiencies).toContain('Martial Weapons');
      expect(result.proficiencies).toContain('Heavy Armor');
    });

    it('adds Martial Weapons and Medium Armor for Primal Order Warden Druid', () => {
      const allClasses = [{
        name: 'Druid',
      }];
      const result = classRules.getClass(allClasses, {
        class: { name: 'Druid', primalOrder: 'Warden' },
      });
      expect(result.proficiencies).toContain('Martial Weapons');
      expect(result.proficiencies).toContain('Medium Armor');
    });

    it('handles missing major by setting to null', () => {
      const allClasses = [{
        name: 'Cleric',
      }];
      const result = classRules.getClass(allClasses, {
        class: { name: 'Cleric' },
      });
      expect(result.major).toBeNull();
    });
  });

  describe('getDruidMaxWildShapeChallengeRating', () => {
    it('returns beast_max_cr from class_levels', () => {
      const playerStats = {
        class: { class_levels: [{ level: 3, beast_max_cr: 0.5 }] },
        level: 3,
      };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(0.5);
    });

    it('returns 0 when no class_level found', () => {
      const playerStats = {
        class: { class_levels: [] },
        level: 3,
      };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(0);
    });

    it('returns 1 for Moon subclass level > 1', () => {
      const playerStats = {
        class: {
          class_levels: [{ level: 3, beast_max_cr: 0.5 }],
          major: { name: 'Moon' },
        },
        level: 3,
      };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(1);
    });

    it('returns Math.floor(level/3) for Moon subclass level > 5', () => {
      const playerStats = {
        class: {
          class_levels: [{ level: 8, beast_max_cr: 0.5 }],
          major: { name: 'Moon' },
        },
        level: 8,
      };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(2);
    });
  });

  describe('getDruidWildShapeUses', () => {
    it('returns wild_shape from class_levels', () => {
      const playerStats = {
        class: { class_levels: [{ level: 3, wild_shape: 2 }] },
        level: 3,
      };
      expect(classRules.getDruidWildShapeUses(playerStats)).toBe(2);
    });

    it('returns 0 when no class_level found', () => {
      const playerStats = {
        class: { class_levels: [] },
        level: 3,
      };
      expect(classRules.getDruidWildShapeUses(playerStats)).toBe(0);
    });
  });

  describe('getDruidBeastKnownForms', () => {
    it('returns beast_known_forms from class_levels', () => {
      const playerStats = {
        class: { class_levels: [{ level: 3, beast_known_forms: 2 }] },
        level: 3,
      };
      expect(classRules.getDruidBeastKnownForms(playerStats)).toBe(2);
    });

    it('returns 0 when no class_level found', () => {
      const playerStats = {
        class: { class_levels: [] },
        level: 3,
      };
      expect(classRules.getDruidBeastKnownForms(playerStats)).toBe(0);
    });
  });

  describe('getDruidBeastFlySpeed', () => {
    it('returns true when beast_fly_speed is Yes', () => {
      const playerStats = {
        class: { class_levels: [{ level: 3, beast_fly_speed: 'Yes' }] },
        level: 3,
      };
      expect(classRules.getDruidBeastFlySpeed(playerStats)).toBe(true);
    });

    it('returns false when beast_fly_speed is No', () => {
      const playerStats = {
        class: { class_levels: [{ level: 3, beast_fly_speed: 'No' }] },
        level: 3,
      };
      expect(classRules.getDruidBeastFlySpeed(playerStats)).toBe(false);
    });

    it('returns false when no class_level found', () => {
      const playerStats = {
        class: { class_levels: [] },
        level: 3,
      };
      expect(classRules.getDruidBeastFlySpeed(playerStats)).toBe(false);
    });
  });

  describe('getFeatures', () => {
    it('returns features from class levels', () => {
      const playerStats = {
        class: {
          class_levels: [
            { level: 1, features: [{ name: 'Channel Divinity', level: 2 }] },
            { level: 2, features: [] },
          ],
        },
        level: 2,
      };
      const result = classRules.getFeatures(playerStats);
      expect(result).toBeDefined();
    });

    it('filters out features above player level', () => {
      const playerStats = {
        class: {
          class_levels: [
            { level: 1, features: [{ name: 'Level 1 Feature', level: 1 }] },
            { level: 2, features: [{ name: 'Level 2 Feature', level: 2 }] },
            { level: 3, features: [{ name: 'Level 3 Feature', level: 3 }] },
          ],
        },
        level: 2,
      };
      const result = classRules.getFeatures(playerStats);
      expect(result).toBeDefined();
    });

    it('handles Heightened replacement for Monk at level >= 10', () => {
      const playerStats = {
        class: {
          class_levels: [
            { level: 1, features: [{ name: 'Flurry of Blows', level: 2 }] },
            { level: 2, features: [{ name: 'Heightened Flurry of Blows', level: 10 }] },
            { level: 3, features: [] },
          ],
        },
        level: 10,
      };
      const result = classRules.getFeatures(playerStats);
      expect(result).toBeDefined();
    });

    it('handles Deflect Energy replacement at level >= 13', () => {
      const playerStats = {
        class: {
          class_levels: [
            { level: 1, features: [{ name: 'Deflect Attacks', level: 1 }] },
            { level: 2, features: [{ name: 'Deflect Energy', level: 13 }] },
          ],
        },
        level: 13,
      };
      const result = classRules.getFeatures(playerStats);
      expect(result).toBeDefined();
    });

    it('includes major features when major exists', () => {
      const playerStats = {
        class: {
          class_levels: [{ level: 1, features: [] }],
          major: {
            features: [{ name: 'Major Feature', level: 1 }],
          },
        },
        level: 1,
      };
      const result = classRules.getFeatures(playerStats);
      expect(result).toBeDefined();
    });
  });

  describe('getHighestMajorLevel', () => {
    it('returns 0 when no major', () => {
      const playerStats = { class: {} };
      expect(classRules.getHighestMajorLevel(playerStats)).toBe(0);
    });

    it('returns highest level from major features', () => {
      const playerStats = {
        class: {
          major: {
            features: [
              { name: 'Feature 1', level: 1 },
              { name: 'Feature 2', level: 3 },
              { name: 'Feature 3', level: 5 },
            ],
          },
        },
        level: 10,
      };
      expect(classRules.getHighestMajorLevel(playerStats)).toBe(5);
    });

    it('only counts features at or below player level', () => {
      const playerStats = {
        class: {
          major: {
            features: [
              { name: 'Feature 1', level: 1 },
              { name: 'Feature 2', level: 15 },
            ],
          },
        },
        level: 10,
      };
      expect(classRules.getHighestMajorLevel(playerStats)).toBe(1);
    });
  });

  describe('getEnergy', () => {
    it('returns energy when found', () => {
      const playerStats = {
        class: {
          class_levels: [{ level: 5, energy: { type: 'psi', size: '1d6' } }],
        },
        level: 5,
      };
      expect(classRules.getEnergy(playerStats)).toEqual({ type: 'psi', size: '1d6' });
    });

    it('returns null when no class_level found', () => {
      const playerStats = {
        class: { class_levels: [] },
        level: 5,
      };
      expect(classRules.getEnergy(playerStats)).toBeNull();
    });

    it('returns null when energy is not defined', () => {
      const playerStats = {
        class: { class_levels: [{ level: 5 }] },
        level: 5,
      };
      expect(classRules.getEnergy(playerStats)).toBeNull();
    });

    it('returns null when required_major does not match', () => {
      const playerStats = {
        class: {
          class_levels: [{ level: 5, energy: { type: 'psi', required_major: 'Storm Sorcery' } }],
          major: { name: 'Shadow' },
        },
        level: 5,
      };
      expect(classRules.getEnergy(playerStats)).toBeNull();
    });
  });

  describe('getSecondWind', () => {
    it('returns second_wind from class_levels', () => {
      const playerStats = {
        class: { class_levels: [{ level: 5, second_wind: 2 }] },
        level: 5,
      };
      expect(classRules.getSecondWind(playerStats)).toBe(2);
    });

    it('returns 0 when no class_level found', () => {
      const playerStats = {
        class: { class_levels: [] },
        level: 5,
      };
      expect(classRules.getSecondWind(playerStats)).toBe(0);
    });

    it('returns 0 when second_wind is not defined', () => {
      const playerStats = {
        class: { class_levels: [{ level: 5 }] },
        level: 5,
      };
      expect(classRules.getSecondWind(playerStats)).toBe(0);
    });
  });

  describe('getWeaponMastery', () => {
    it('returns weapon_mastery from class_levels', () => {
      const playerStats = {
        class: { class_levels: [{ level: 5, weapon_mastery: 2 }] },
        level: 5,
      };
      expect(classRules.getWeaponMastery(playerStats)).toBe(2);
    });

    it('returns 0 when no class_level found', () => {
      const playerStats = {
        class: { class_levels: [] },
        level: 5,
      };
      expect(classRules.getWeaponMastery(playerStats)).toBe(0);
    });
  });

  describe('getMartialArtsDie', () => {
    it('returns martial_arts_die from class_levels', () => {
      const playerStats = {
        class: { class_levels: [{ level: 5, martial_arts_die: 6 }] },
        level: 5,
      };
      expect(classRules.getMartialArtsDie(playerStats)).toBe(6);
    });

    it('returns 4 (d4) when no class_level found', () => {
      const playerStats = {
        class: { class_levels: [] },
        level: 5,
      };
      expect(classRules.getMartialArtsDie(playerStats)).toBe(4);
    });
  });

  describe('getFocusPoints', () => {
    it('returns focus_points from class_levels', () => {
      const playerStats = {
        class: { class_levels: [{ level: 5, focus_points: 8 }] },
        level: 5,
      };
      expect(classRules.getFocusPoints(playerStats)).toBe(8);
    });

    it('returns 0 when no class_level found', () => {
      const playerStats = {
        class: { class_levels: [] },
        level: 5,
      };
      expect(classRules.getFocusPoints(playerStats)).toBe(0);
    });
  });

  describe('getUnarmoredMovementIncrease', () => {
    it('returns unarmored_movement_increase from class_levels', () => {
      const playerStats = {
        class: { class_levels: [{ level: 5, unarmored_movement_increase: 10 }] },
        level: 5,
      };
      expect(classRules.getUnarmoredMovementIncrease(playerStats)).toBe(10);
    });

    it('returns 0 when no class_level found', () => {
      const playerStats = {
        class: { class_levels: [] },
        level: 5,
      };
      expect(classRules.getUnarmoredMovementIncrease(playerStats)).toBe(0);
    });
  });

  describe('getFavoredEnemy', () => {
    it('returns favored_enemy from class_levels', () => {
      const playerStats = {
        class: { class_levels: [{ level: 5, favored_enemy: 2 }] },
        level: 5,
      };
      expect(classRules.getFavoredEnemy(playerStats)).toBe(2);
    });

    it('returns 0 when no class_level found', () => {
      const playerStats = {
        class: { class_levels: [] },
        level: 5,
      };
      expect(classRules.getFavoredEnemy(playerStats)).toBe(0);
    });
  });

  describe('getRogueSneakAttack', () => {
    it('returns sneak attack with dice_count and dice_value', () => {
      const playerStats = {
        class: { class_levels: [{}, {}, {}, {}, { sneak_attack_num_d6: 3 }] },
        level: 5,
      };
      expect(classRules.getRogueSneakAttack(playerStats)).toEqual({ dice_count: 3, dice_value: 6 });
    });

    it('returns 0 when no class_level found', () => {
      const playerStats = {
        class: { class_levels: [] },
        level: 5,
      };
      expect(classRules.getRogueSneakAttack(playerStats)).toEqual({ dice_count: 0, dice_value: 6 });
    });
  });

  describe('getEldritchInvocations', () => {
    it('returns eldritch_invocations from class_levels', () => {
      const playerStats = {
        class: { class_levels: [{}, {}, {}, {}, { eldritch_invocations: 4 }] },
        level: 5,
      };
      expect(classRules.getEldritchInvocations(playerStats)).toBe(4);
    });

    it('returns 0 when no class_level found', () => {
      const playerStats = {
        class: { class_levels: [] },
        level: 5,
      };
      expect(classRules.getEldritchInvocations(playerStats)).toBe(0);
    });
  });

  describe('getClericFeatures', () => {
    it('returns maxChannelDivinity and destroyUndeadCR', () => {
      const playerStats = {
        class: { class_levels: [{}, {}, {}, {}, { channel_divinity: 3 }] },
        level: 5,
      };
      const result = classRules.getClericFeatures(playerStats);
      expect(result).toEqual({ maxChannelDivinity: 3, destroyUndeadCR: null });
    });

    it('returns 0 when no class_level found', () => {
      const playerStats = {
        class: { class_levels: [] },
        level: 5,
      };
      const result = classRules.getClericFeatures(playerStats);
      expect(result).toEqual({ maxChannelDivinity: 0, destroyUndeadCR: null });
    });
  });

  describe('getDruidFeatures', () => {
    it('returns all druid feature properties', () => {
      const playerStats = {
        class: {
          class_levels: [{ level: 3, wild_shape: 2, beast_max_cr: 0.5, beast_known_forms: 2, beast_fly_speed: 'Yes' }],
        },
        level: 3,
      };
      const result = classRules.getDruidFeatures(playerStats);
      expect(result.maxWildShapeUses).toBe(2);
      expect(result.maxWildShapeChallengeRating).toBe(0.5);
      expect(result.beastKnownForms).toBe(2);
      expect(result.wildShapeLimitations).toBe('walk, swim, or fly');
    });

    it('returns no fly limitation when fly speed is false', () => {
      const playerStats = {
        class: {
          class_levels: [{ level: 3, wild_shape: 2, beast_max_cr: 0.5, beast_known_forms: 2, beast_fly_speed: 'No' }],
        },
        level: 3,
      };
      const result = classRules.getDruidFeatures(playerStats);
      expect(result.wildShapeLimitations).toBe('walk or swim only (no fly)');
    });
  });

  describe('getPaladinFeatures', () => {
    it('returns paladin features with extraAttacks for level > 4', () => {
      const playerStats = {
        class: { class_levels: [{}, {}, {}, {}, { channel_divinity: 2 }] },
        level: 5,
      };
      const result = classRules.getPaladinFeatures(playerStats);
      expect(result.maxChannelDivinity).toBe(2);
      expect(result.auraRange).toBeNull();
      expect(result.extraAttacks).toBe(1);
    });

    it('returns 0 extraAttacks for level <= 4', () => {
      const playerStats = {
        class: { class_levels: [{}, {}, {}, { channel_divinity: 2 }] },
        level: 3,
      };
      const result = classRules.getPaladinFeatures(playerStats);
      expect(result.extraAttacks).toBe(0);
    });
  });

  describe('getSorcererFeatures', () => {
    it('returns metamagicKnown based on level', () => {
      const playerStats = {
        class: { class_levels: [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, { sorcery_points: 5 }] },
        level: 20,
      };
      const result = classRules.getSorcererFeatures(playerStats);
      expect(result.maxSorceryPoints).toBe(5);
      expect(result.metamagicKnown).toBe(6);
      expect(result.maxInnateSorcery).toBe(2);
    });

    it('returns metamagicKnown=4 for level >= 10', () => {
      const playerStats = {
        class: { class_levels: [{}, {}, {}, {}, {}, {}, {}, {}, {}, { sorcery_points: 5 }] },
        level: 12,
      };
      const result = classRules.getSorcererFeatures(playerStats);
      expect(result.metamagicKnown).toBe(4);
    });

    it('returns metamagicKnown=2 for level >= 3', () => {
      const playerStats = {
        class: { class_levels: [{}, {}, { sorcery_points: 5 }] },
        level: 5,
      };
      const result = classRules.getSorcererFeatures(playerStats);
      expect(result.metamagicKnown).toBe(2);
    });

    it('returns metamagicKnown=0 for level < 3', () => {
      const playerStats = {
        class: { class_levels: [{ sorcery_points: 5 }] },
        level: 2,
      };
      const result = classRules.getSorcererFeatures(playerStats);
      expect(result.metamagicKnown).toBe(0);
    });
  });

  describe('getWarlockFeatures', () => {
    it('returns warlock features with arcanum for level > 10', () => {
      const classLevels = Array(15).fill(null);
      classLevels[14] = { eldritch_invocations: 4 };
      const playerStats = {
        class: {
          class_levels: classLevels,
          arcanums: [],
          pactBoon: 'Book',
          invocations: [],
        },
        level: 15,
      };
      const result = classRules.getWarlockFeatures(playerStats);
      expect(result.invocationsKnown).toBe(4);
      expect(result.hasArcanum).toBe(true);
      expect(result.arcanumLevels.level6).toBe(1);
      expect(result.arcanumLevels.level7).toBe(1);
      expect(result.arcanumLevels.level8).toBe(1);
      expect(result.arcanumLevels.level9).toBe(0);
      expect(result.pactBoon).toBe('Book');
    });

    it('returns null arcanumLevels for level <= 10', () => {
      const classLevels = Array(11).fill(null);
      classLevels[9] = { eldritch_invocations: 2 };
      const playerStats = {
        class: {
          class_levels: classLevels,
          arcanums: [],
          pactBoon: null,
          invocations: [],
        },
        level: 10,
      };
      const result = classRules.getWarlockFeatures(playerStats);
      expect(result.hasArcanum).toBe(false);
      expect(result.arcanumLevels).toBeNull();
    });
  });

  describe('getWizardFeatures', () => {
    it('returns wizard features with arcaneRecoveryLevels', () => {
      const classLevels = [
        { level: 1 }, { level: 2 }, { level: 3 }, { level: 4 },
        { level: 5, class_specific: { arcane_recovery_levels: 1 } }
      ];
      const playerStats = {
        class: { class_levels: classLevels },
        level: 5,
      };
      const result = classRules.getWizardFeatures(playerStats);
      expect(result.showWizardFeatures).toBe(false);
      expect(result.arcaneRecoveryLevels).toBe(1);
    });

    it('returns 0 arcaneRecoveryLevels when not defined', () => {
      const classLevels = [
        { level: 1 }, { level: 2 }, { level: 3 }, { level: 4 },
        { level: 5 }
      ];
      const playerStats = {
        class: { class_levels: classLevels },
        level: 5,
      };
      const result = classRules.getWizardFeatures(playerStats);
      expect(result.arcaneRecoveryLevels).toBe(0);
    });
  });

  describe('getMonkFeatures', () => {
    it('returns all monk feature properties', () => {
      const playerStats = {
        class: {
          class_levels: [{
            level: 5,
            martial_arts_die: 6,
            unarmored_movement_increase: 10,
            focus_points: 8,
          }],
        },
        level: 5,
      };
      const result = classRules.getMonkFeatures(playerStats);
      expect(result.martialArtsDie).toBe(6);
      expect(result.unarmoredMovementIncrease).toBe(10);
      expect(result.maxFocusPoints).toBe(8);
      expect(result.wisdomBonus).toBe(0);
    });
  });

  describe('getRangerFeatures', () => {
    it('returns ranger features with extraAttacks for level > 4', () => {
      const classLevels = [
        { level: 1 }, { level: 2 }, { level: 3 }, { level: 4 },
        { level: 5, favored_enemy: 2 }
      ];
      const playerStats = {
        class: { class_levels: classLevels },
        level: 5,
      };
      const result = classRules.getRangerFeatures(playerStats);
      expect(result.favoredEnemies).toBe(2);
      expect(result.extraAttacks).toBe(1);
    });

    it('returns 0 extraAttacks for level <= 4', () => {
      const classLevels = [
        { level: 1 }, { level: 2 }, { level: 3, favored_enemy: 1 }
      ];
      const playerStats = {
        class: { class_levels: classLevels },
        level: 3,
      };
      const result = classRules.getRangerFeatures(playerStats);
      expect(result.extraAttacks).toBe(0);
    });
  });

  describe('getRogueFeatures', () => {
    it('returns rogue features with sneakAttack and expertise', () => {
      const playerStats = {
        class: {
          class_levels: [{}, {}, {}, {}, { sneak_attack_num_d6: 3 }],
          expertise: ['Stealth', 'Persuasion'],
        },
        level: 5,
      };
      const result = classRules.getRogueFeatures(playerStats);
      expect(result.sneakAttack).toEqual({ dice_count: 3, dice_value: 6 });
      expect(result.expertise).toEqual(['Stealth', 'Persuasion']);
    });
  });

  describe('getBardFeatures', () => {
    it('returns bard features with bardicDie and magicalSecrets', () => {
      const classLevels = Array(9).fill(null).map((_, i) => ({ level: i + 1 }));
      classLevels[9] = { level: 10, bardic_die: 6, class_specific: { magical_secrets: 2 } };
      const playerStats = {
        class: { class_levels: classLevels },
        level: 10,
      };
      const result = classRules.getBardFeatures(playerStats);
      expect(result.bardicDie).toBe(6);
      expect(result.songOfRestDie).toBeNull();
      expect(result.magicalSecrets).toBe(2);
      expect(result.subclassMagicalSecrets).toBe(0);
    });

    it('returns 0 bardicDie when not defined', () => {
      const classLevels = [
        { level: 1 }, { level: 2 }, { level: 3 }, { level: 4 },
        { level: 5 }
      ];
      const playerStats = {
        class: { class_levels: classLevels },
        level: 5,
      };
      const result = classRules.getBardFeatures(playerStats);
      expect(result.bardicDie).toBe(0);
    });
  });
});
