// @cleaned-by-ai
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
    it('warns and returns default class_levels when class not found', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = classRules.getClass([], { class: { name: 'Nonexistent' } });
      expect(result).toEqual({ class_levels: [] });
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
      const result = classRules.getClass(allClasses, { class: { name: 'Cleric', major: { name: 'Knowledge' } } });
      expect(result.name).toBe('Cleric');
      expect(result.class_levels).toEqual([{ level: 1, features: [] }]);
      expect(result.major).toEqual({ name: 'Knowledge', features: [] });
      expect(result.majors).toBeUndefined();
    });

    it('converts short ability names to long names', () => {
      const allClasses = [{ name: 'Cleric', saving_throw_proficiencies: ['WIS', 'CHA'] }];
      const result = classRules.getClass(allClasses, { class: { name: 'Cleric' } });
      expect(result.saving_throw_proficiencies).toContain('Wisdom');
      expect(result.saving_throw_proficiencies).toContain('Charisma');
    });

    it('handles weapon_proficiencies string mapping', () => {
      const allClasses = [{ name: 'Cleric', weapon_proficiencies: 'Simple and Martial weapons' }];
      const result = classRules.getClass(allClasses, { class: { name: 'Cleric' } });
      expect(result.proficiencies).toContain('Simple Weapons');
      expect(result.proficiencies).toContain('Martial Weapons');
    });

    it('handles armor_training string mapping', () => {
      const allClasses = [{ name: 'Fighter', armor_training: 'Light, Medium, and Heavy armor and Shields' }];
      const result = classRules.getClass(allClasses, { class: { name: 'Fighter' } });
      expect(result.proficiencies).toContain('Light Armor');
      expect(result.proficiencies).toContain('Medium Armor');
      expect(result.proficiencies).toContain('Heavy Armor');
      expect(result.proficiencies).toContain('Shields');
    });

    it('handles tool_proficiencies that do not start with Choose', () => {
      const allClasses = [{ name: 'Cleric', tool_proficiencies: "Healer's Kit" }];
      const result = classRules.getClass(allClasses, { class: { name: 'Cleric' } });
      expect(result.proficiencies).toContain("Healer's Kit");
    });

    it('skips tool_proficiencies that start with Choose', () => {
      const allClasses = [{ name: 'Cleric', tool_proficiencies: "Choose one kind of Artisan's Tools" }];
      const result = classRules.getClass(allClasses, { class: { name: 'Cleric' } });
      expect(result.proficiencies).not.toContain("Choose one kind of Artisan's Tools");
    });

    it('handles skill_proficiencies string parsing', () => {
      const allClasses = [{ name: 'Cleric', skill_proficiencies: 'History, Insight, Medicine' }];
      const result = classRules.getClass(allClasses, { class: { name: 'Cleric' } });
      expect(result.proficiencies).toContain('Skill: History');
      expect(result.proficiencies).toContain('Skill: Insight');
      expect(result.proficiencies).toContain('Skill: Medicine');
    });

    it('skips skill_proficiencies that start with Choose', () => {
      const allClasses = [{ name: 'Cleric', skill_proficiencies: 'Choose two skills' }];
      const result = classRules.getClass(allClasses, { class: { name: 'Cleric' } });
      expect(result.proficiencies).not.toContain('Choose two skills');
    });

    it('adds Martial Weapons and Heavy Armor for Divine Order Protector Cleric', () => {
      const result = classRules.getClass([{ name: 'Cleric' }], { class: { name: 'Cleric', divineOrder: 'Protector' } });
      expect(result.proficiencies).toContain('Martial Weapons');
      expect(result.proficiencies).toContain('Heavy Armor');
    });

    it('adds Martial Weapons and Medium Armor for Primal Order Warden Druid', () => {
      const result = classRules.getClass([{ name: 'Druid' }], { class: { name: 'Druid', primalOrder: 'Warden' } });
      expect(result.proficiencies).toContain('Martial Weapons');
      expect(result.proficiencies).toContain('Medium Armor');
    });

    it('handles missing major by setting to null', () => {
      const result = classRules.getClass([{ name: 'Cleric' }], { class: { name: 'Cleric' } });
      expect(result.major).toBeNull();
    });

    it('handles legacy subclass format via subclass.name fallback', () => {
      const allClasses = [{ name: 'Cleric', majors: [{ name: 'Life' }] }];
      const result = classRules.getClass(allClasses, { class: { name: 'Cleric', subclass: { name: 'Life' } } });
      expect(result.major).toEqual({ name: 'Life' });
    });

    it('creates major with empty features when subclass not found in majors', () => {
      const allClasses = [{ name: 'Cleric', majors: [{ name: 'Life' }] }];
      const result = classRules.getClass(allClasses, { class: { name: 'Cleric', subclass: { name: 'Unknown' } } });
      expect(result.major).toEqual({ name: 'Unknown', features: [] });
    });

    it('throws when playerSummary.class is null', () => {
      expect(() => classRules.getClass([{ name: 'Cleric' }], { class: null })).toThrow(TypeError);
    });
  });

  describe('getDruidMaxWildShapeChallengeRating', () => {
    it('returns beast_max_cr from class_levels', () => {
      const playerStats = { class: { class_levels: [{ level: 3, beast_max_cr: 0.5 }] }, level: 3 };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(0.5);
    });

    it('returns 1 for Moon subclass level > 1', () => {
      const playerStats = { class: { class_levels: [{ level: 3, beast_max_cr: 0.5 }], major: { name: 'Moon' } }, level: 3 };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(1);
    });

    it('returns Math.floor(level/3) for Moon subclass level > 5', () => {
      const playerStats = { class: { class_levels: [{ level: 8, beast_max_cr: 0.5 }], major: { name: 'Moon' } }, level: 8 };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(2);
    });

    it('does not override for non-Moon subclass', () => {
      const playerStats = { class: { class_levels: [{ level: 8, beast_max_cr: 0.5 }], major: { name: 'Spores' } }, level: 8 };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(0.5);
    });
  });

  describe('getDruidWildShapeUses', () => {
    it('returns wild_shape from class_levels', () => {
      const playerStats = { class: { class_levels: [{ level: 3, wild_shape: 2 }] }, level: 3 };
      expect(classRules.getDruidWildShapeUses(playerStats)).toBe(2);
    });

    it('returns 0 when wild_shape is undefined', () => {
      const playerStats = { class: { class_levels: [{ level: 3 }] }, level: 3 };
      expect(classRules.getDruidWildShapeUses(playerStats)).toBe(0);
    });
  });

  describe('getDruidBeastKnownForms', () => {
    it('returns beast_known_forms from class_levels', () => {
      const playerStats = { class: { class_levels: [{ level: 3, beast_known_forms: 2 }] }, level: 3 };
      expect(classRules.getDruidBeastKnownForms(playerStats)).toBe(2);
    });

    it('returns 0 when beast_known_forms is undefined', () => {
      const playerStats = { class: { class_levels: [{ level: 3 }] }, level: 3 };
      expect(classRules.getDruidBeastKnownForms(playerStats)).toBe(0);
    });
  });

  describe('getDruidBeastFlySpeed', () => {
    it('returns true when beast_fly_speed is Yes', () => {
      const playerStats = { class: { class_levels: [{ level: 3, beast_fly_speed: 'Yes' }] }, level: 3 };
      expect(classRules.getDruidBeastFlySpeed(playerStats)).toBe(true);
    });

    it('returns false when beast_fly_speed is No', () => {
      const playerStats = { class: { class_levels: [{ level: 3, beast_fly_speed: 'No' }] }, level: 3 };
      expect(classRules.getDruidBeastFlySpeed(playerStats)).toBe(false);
    });
  });

  describe('getFeatures', () => {
    it('returns categorized features object with all category keys', () => {
      const playerStats = {
        class: { class_levels: [{ level: 1, features: [{ name: 'Channel Divinity', level: 2 }] }, { level: 2, features: [] }] },
        level: 2,
      };
      const result = classRules.getFeatures(playerStats);
      expect(result).toHaveProperty('actions');
      expect(result).toHaveProperty('bonusActions');
      expect(result).toHaveProperty('reactions');
      expect(result).toHaveProperty('specialActions');
      expect(result).toHaveProperty('characterAdvancement');
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
      const allFeatureNames = [
        ...result.actions, ...result.bonusActions, ...result.reactions,
        ...result.specialActions, ...result.characterAdvancement,
      ].map(f => f.name);
      expect(allFeatureNames).not.toContain('Level 3 Feature');
      expect(allFeatureNames).toContain('Level 1 Feature');
    });

    it('replaces base monk features with Heightened versions at level >= 10', () => {
      const playerStats = {
        class: {
          class_levels: [
            { level: 1, features: [{ name: 'Flurry of Blows', level: 2 }, { name: 'Patient Defense', level: 2 }, { name: 'Step of the Wind', level: 2 }] },
            { level: 2, features: [{ name: 'Heightened Flurry of Blows', level: 10 }] },
          ],
        },
        level: 10,
      };
      const result = classRules.getFeatures(playerStats);
      const allFeatureNames = [
        ...result.actions, ...result.bonusActions, ...result.reactions,
        ...result.specialActions, ...result.characterAdvancement,
      ].map(f => f.name);
      expect(allFeatureNames).not.toContain('Flurry of Blows');
      expect(allFeatureNames).toContain('Heightened Flurry of Blows');
    });

    it('replaces Deflect Attacks with Deflect Energy at level >= 13', () => {
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
      const allFeatureNames = [
        ...result.actions, ...result.bonusActions, ...result.reactions,
        ...result.specialActions, ...result.characterAdvancement,
      ].map(f => f.name);
      expect(allFeatureNames).not.toContain('Deflect Attacks');
      expect(allFeatureNames).toContain('Deflect Energy');
    });

    it('includes major features when major exists', () => {
      const playerStats = {
        class: {
          class_levels: [{ level: 1, features: [] }],
          major: { features: [{ name: 'Major Feature', level: 1 }] },
        },
        level: 1,
      };
      const result = classRules.getFeatures(playerStats);
      const allFeatureNames = [
        ...result.actions, ...result.bonusActions, ...result.reactions,
        ...result.specialActions, ...result.characterAdvancement,
      ].map(f => f.name);
      expect(allFeatureNames).toContain('Major Feature');
    });

    it('throws when playerStats has no class property', () => {
      expect(() => classRules.getFeatures({})).toThrow(TypeError);
    });
  });

  describe('getHighestMajorLevel', () => {
    it('returns highest level from major features capped at player level', () => {
      const playerStats = {
        class: {
          major: {
            features: [{ name: 'Feature 1', level: 1 }, { name: 'Feature 2', level: 3 }, { name: 'Feature 3', level: 5 }],
          },
        },
        level: 10,
      };
      expect(classRules.getHighestMajorLevel(playerStats)).toBe(5);
    });

    it('only counts features at or below player level', () => {
      const playerStats = {
        class: {
          major: { features: [{ name: 'Feature 1', level: 1 }, { name: 'Feature 2', level: 15 }] },
        },
        level: 10,
      };
      expect(classRules.getHighestMajorLevel(playerStats)).toBe(1);
    });
  });

  describe('getEnergy', () => {
    it('returns energy when found and required_major matches', () => {
      const playerStats = {
        class: {
          class_levels: [{ level: 5, energy: { type: 'psi', required_major: 'Storm Sorcery' } }],
          major: { name: 'Storm Sorcery' },
        },
        level: 5,
      };
      expect(classRules.getEnergy(playerStats)).toEqual({ type: 'psi', required_major: 'Storm Sorcery' });
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

    it('returns energy when no required_major field', () => {
      const playerStats = {
        class: { class_levels: [{ level: 5, energy: { type: 'psi' } }] },
        level: 5,
      };
      expect(classRules.getEnergy(playerStats)).toEqual({ type: 'psi' });
    });
  });

  describe('class-specific getters', () => {
    it('getSecondWind returns second_wind from class_levels', () => {
      const playerStats = { class: { class_levels: [{ level: 5, second_wind: 2 }] }, level: 5 };
      expect(classRules.getSecondWind(playerStats)).toBe(2);
    });

    it('getWeaponMastery returns weapon_mastery from class_levels', () => {
      const playerStats = { class: { class_levels: [{ level: 5, weapon_mastery: 2 }] }, level: 5 };
      expect(classRules.getWeaponMastery(playerStats)).toBe(2);
    });

    it('getMartialArtsDie returns martial_arts_die from class_levels or defaults to 4', () => {
      const playerStats = { class: { class_levels: [{ level: 5, martial_arts_die: 6 }] }, level: 5 };
      expect(classRules.getMartialArtsDie(playerStats)).toBe(6);
      const noData = { class: { class_levels: [] }, level: 5 };
      expect(classRules.getMartialArtsDie(noData)).toBe(4);
    });

    it('getFocusPoints returns focus_points from class_levels', () => {
      const playerStats = { class: { class_levels: [{ level: 5, focus_points: 8 }] }, level: 5 };
      expect(classRules.getFocusPoints(playerStats)).toBe(8);
    });

    it('getUnarmoredMovementIncrease returns unarmored_movement_increase from class_levels', () => {
      const playerStats = { class: { class_levels: [{ level: 5, unarmored_movement_increase: 10 }] }, level: 5 };
      expect(classRules.getUnarmoredMovementIncrease(playerStats)).toBe(10);
    });

    it('getFavoredEnemy returns favored_enemy from class_levels', () => {
      const playerStats = { class: { class_levels: [{ level: 5, favored_enemy: 2 }] }, level: 5 };
      expect(classRules.getFavoredEnemy(playerStats)).toBe(2);
    });

    it('getRogueSneakAttack returns sneak attack with dice_count and dice_value', () => {
      const playerStats = { class: { class_levels: [{}, {}, {}, {}, { sneak_attack_num_d6: 3 }] }, level: 5 };
      expect(classRules.getRogueSneakAttack(playerStats)).toEqual({ dice_count: 3, dice_value: 6 });
    });

    it('getEldritchInvocations returns eldritch_invocations from class_levels', () => {
      const playerStats = { class: { class_levels: [{}, {}, {}, {}, { eldritch_invocations: 4 }] }, level: 5 };
      expect(classRules.getEldritchInvocations(playerStats)).toBe(4);
    });

    it('getClericFeatures returns maxChannelDivinity', () => {
      const playerStats = { class: { class_levels: [{}, {}, {}, {}, { channel_divinity: 3 }] }, level: 5 };
      expect(classRules.getClericFeatures(playerStats)).toEqual({ maxChannelDivinity: 3, destroyUndeadCR: null });
    });

    it('getDruidFeatures returns all druid feature properties', () => {
      const playerStats = {
        class: { class_levels: [{ level: 3, wild_shape: 2, beast_max_cr: 0.5, beast_known_forms: 2, beast_fly_speed: 'Yes' }] },
        level: 3,
      };
      const result = classRules.getDruidFeatures(playerStats);
      expect(result.maxWildShapeUses).toBe(2);
      expect(result.maxWildShapeChallengeRating).toBe(0.5);
      expect(result.beastKnownForms).toBe(2);
      expect(result.wildShapeLimitations).toBe('walk, swim, or fly');
    });

    it('getPaladinFeatures returns extraAttacks for level > 4', () => {
      const playerStats = { class: { class_levels: [{}, {}, {}, {}, { channel_divinity: 2 }] }, level: 5 };
      const result = classRules.getPaladinFeatures(playerStats);
      expect(result.maxChannelDivinity).toBe(2);
      expect(result.extraAttacks).toBe(1);
    });

    it('getSorcererFeatures returns metamagicKnown based on level thresholds', () => {
      const makeStats = (level) => ({
        class: { class_levels: Array.from({ length: level }, (_, i) => ({ level: i + 1 })) },
        level,
      });
      expect(classRules.getSorcererFeatures(makeStats(2)).metamagicKnown).toBe(0);
      expect(classRules.getSorcererFeatures(makeStats(5)).metamagicKnown).toBe(2);
      expect(classRules.getSorcererFeatures(makeStats(12)).metamagicKnown).toBe(4);
      expect(classRules.getSorcererFeatures(makeStats(20)).metamagicKnown).toBe(6);
    });

    it('getWarlockFeatures returns arcanum levels at each threshold', () => {
      const makeStats = (level) => ({
        class: { class_levels: Array.from({ length: level }, (_, i) => ({ level: i + 1 })), arcanums: [], pactBoon: null, invocations: [] },
        level,
      });
      expect(classRules.getWarlockFeatures(makeStats(11)).arcanumLevels).toEqual({ level6: 1, level7: 0, level8: 0, level9: 0 });
      expect(classRules.getWarlockFeatures(makeStats(13)).arcanumLevels).toEqual({ level6: 1, level7: 1, level8: 0, level9: 0 });
      expect(classRules.getWarlockFeatures(makeStats(17)).arcanumLevels).toEqual({ level6: 1, level7: 1, level8: 1, level9: 1 });
    });

    it('getWizardFeatures returns arcaneRecoveryLevels from class_specific', () => {
      const playerStats = {
        class: { class_levels: [{ level: 5, class_specific: { arcane_recovery_levels: 1 } }] },
        level: 5,
      };
      const result = classRules.getWizardFeatures(playerStats);
      expect(result.showWizardFeatures).toBe(true);
      expect(result.arcaneRecoveryLevels).toBe(1);
    });

    it('getMonkFeatures returns all monk feature properties', () => {
      const playerStats = {
        class: { class_levels: [{ level: 5, martial_arts_die: 6, unarmored_movement_increase: 10, focus_points: 8 }] },
        level: 5,
      };
      const result = classRules.getMonkFeatures(playerStats);
      expect(result.martialArtsDie).toBe(6);
      expect(result.unarmoredMovementIncrease).toBe(10);
      expect(result.maxFocusPoints).toBe(8);
    });

    it('getRangerFeatures returns favoredEnemies and extraAttacks', () => {
      const playerStats = {
        class: { class_levels: [{ level: 5, favored_enemy: 2 }] },
        level: 5,
      };
      const result = classRules.getRangerFeatures(playerStats);
      expect(result.favoredEnemies).toBe(2);
      expect(result.extraAttacks).toBe(1);
    });

    it('getRogueFeatures returns sneakAttack and expertise', () => {
      const playerStats = {
        class: { class_levels: [{}, {}, {}, {}, { sneak_attack_num_d6: 3 }], expertise: ['Stealth', 'Persuasion'] },
        level: 5,
        expertise: ['Stealth', 'Persuasion'],
      };
      const result = classRules.getRogueFeatures(playerStats);
      expect(result.sneakAttack).toEqual({ dice_count: 3, dice_value: 6 });
      expect(result.expertise).toEqual(['Stealth', 'Persuasion']);
    });

    it('getBardFeatures returns bardicDie and magicalSecrets', () => {
      const classLevels = Array.from({ length: 9 }, (_, i) => ({ level: i + 1 }));
      classLevels[9] = { level: 10, bardic_die: 6, class_specific: { magical_secrets: 2 } };
      const playerStats = { class: { class_levels: classLevels }, level: 10 };
      const result = classRules.getBardFeatures(playerStats);
      expect(result.bardicDie).toBe(6);
      expect(result.magicalSecrets).toBe(2);
      expect(result.songOfRestDie).toBeNull();
      expect(result.subclassMagicalSecrets).toBe(0);
    });
  });
});
