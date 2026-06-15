import { describe, it, expect, vi } from 'vitest';
import classRules from './classRules2024.js';

// Mock dependencies
vi.mock('lodash', () => ({
  cloneDeep: vi.fn(obj => obj),
  uniqBy: vi.fn()
}));

vi.mock('../ui/utils.js', () => ({
  default: {
    getAbilityLongName: vi.fn(name => name)
     }
}));

vi.mock('./featureCategories.js', () => ({
  getCategories: vi.fn(() => ({
    actions: [],
    bonusActions: [],
    reactions: [],
    passive: [],
    maintained: []
  })),
  categories2024: {
    actions: [],
    bonusActions: [],
    reactions: [],
    passive: [],
    maintained: []
  }
}));

vi.mock('./featureCategorizationUtils.js', () => ({
  categorizeFeatures: vi.fn((features) => ({
    actions: features.filter(f => f.type === 'action'),
    bonusActions: features.filter(f => f.type === 'bonusAction'),
    reactions: features.filter(f => f.type === 'reaction'),
    passive: features.filter(f => f.type === 'passive'),
    maintained: features.filter(f => f.type === 'maintained')
   })),
  mergeCategorizedFeatures: vi.fn((a, b) => ({
    actions: [...(a.actions || []), ...(b.actions || [])],
    bonusActions: [...(a.bonusActions || []), ...(b.bonusActions || [])],
    reactions: [...(a.reactions || []), ...(b.reactions || [])],
    passive: [...(a.passive || []), ...(b.passive || [])],
    maintained: [...(a.maintained || []), ...(b.maintained || [])]
   }))
}));

describe('classRules 2024', () => {
  describe('getClass', () => {
    it('should return class with empty class_levels when class not found', () => {
      const allClasses = [];
      const playerSummary = { class: { name: 'NonExistent' } };

      const result = classRules.getClass(allClasses, playerSummary);

      expect(result).toEqual({ class_levels: [] });
       });

    it('should return class data when found', () => {
      const allClasses = [{
        name: 'Fighter',
        class_levels: [{ level: 1, features: [] }],
        weapon_proficiencies: 'Simple weapons',
        armor_training: 'Light armor',
        tool_proficiencies: 'Tinker\'s Tools',
        skill_proficiencies: 'Athletics, Intimidation'
        }];
      const playerSummary = { class: { name: 'Fighter' } };

      const result = classRules.getClass(allClasses, playerSummary);

      expect(result.name).toBe('Fighter');
      expect(result.class_levels).toEqual([{ level: 1, features: [] }]);
       });

    it('should handle major (subclass) when specified', () => {
      const allClasses = [{
        name: 'Fighter',
        class_levels: [],
        majors: [{ name: 'Battle Master', features: [] }]
        }];
      const playerSummary = { class: { name: 'Fighter', major: { name: 'Battle Master' } } };

      const result = classRules.getClass(allClasses, playerSummary);

      expect(result.major).toBeDefined();
      expect(result.major.name).toBe('Battle Master');
       });

    it('should set major to null when not specified', () => {
      const allClasses = [{
        name: 'Fighter',
        class_levels: [],
        majors: []
        }];
      const playerSummary = { class: { name: 'Fighter' } };

      const result = classRules.getClass(allClasses, playerSummary);

      expect(result.major).toBeNull();
    });
     });

  describe('getDruidMaxWildShapeChallengeRating', () => {
    it('should return 0 when no class level data', () => {
      const playerStats = { class: { class_levels: [] }, level: 1 };

      const result = classRules.getDruidMaxWildShapeChallengeRating(playerStats);

      expect(result).toBe(0);
       });

    it('should return beast_max_cr from class level', () => {
      const playerStats = {
        class: { class_levels: [{ level: 1, beast_max_cr: 0 }] },
        level: 1
        };

      const result = classRules.getDruidMaxWildShapeChallengeRating(playerStats);

      expect(result).toBe(0);
       });

    it('should return 1 for Circle of Moon druids', () => {
          const playerStats = {
            class: {
              class_levels: [{}, { level: 2, beast_max_cr: 0 }],
              major: { name: 'Moon' }
               },
            level: 2
             };

      const result = classRules.getDruidMaxWildShapeChallengeRating(playerStats);

          expect(result).toBe(1);
            });

        it('should calculate CR based on level for Moon druids level 5+', () => {
          const playerStats = {
            class: {
              class_levels: [{}, {}, {}, {}, {}, { level: 6, beast_max_cr: 0 }],
              major: { name: 'Moon' }
               },
            level: 6
             };

      const result = classRules.getDruidMaxWildShapeChallengeRating(playerStats);

          expect(result).toBe(2); // Math.floor(6 / 3) = 2
         });
          });

  describe('getDruidWildShapeUses', () => {
    it('should return 0 when no class level data', () => {
      const playerStats = { class: { class_levels: [] }, level: 1 };

      const result = classRules.getDruidWildShapeUses(playerStats);

      expect(result).toBe(0);
       });

    it('should return wild_shape from class level', () => {
          const playerStats = {
            class: { class_levels: [{}, { level: 2, wild_shape: 2 }] },
            level: 2
              };

      const result = classRules.getDruidWildShapeUses(playerStats);

          expect(result).toBe(2);
          });
           });

  describe('getDruidBeastKnownForms', () => {
    it('should return 0 when no class level data', () => {
      const playerStats = { class: { class_levels: [] }, level: 1 };

      const result = classRules.getDruidBeastKnownForms(playerStats);

      expect(result).toBe(0);
       });

    it('should return beast_known_forms from class level', () => {
          const playerStats = {
            class: { class_levels: [{}, { level: 2, beast_known_forms: 2 }] },
            level: 2
               };

      const result = classRules.getDruidBeastKnownForms(playerStats);

          expect(result).toBe(2);
           });
            });

  describe('getDruidBeastFlySpeed', () => {
    it('should return false when no class level data', () => {
      const playerStats = { class: { class_levels: [] }, level: 1 };

      const result = classRules.getDruidBeastFlySpeed(playerStats);

      expect(result).toBe(false);
       });

    it('should return true when beast_fly_speed is Yes', () => {
          const playerStats = {
            class: { class_levels: [{}, {}, {}, { level: 4, beast_fly_speed: 'Yes' }] },
            level: 4
               };

      const result = classRules.getDruidBeastFlySpeed(playerStats);

          expect(result).toBe(true);
             });

        it('should return false when beast_fly_speed is No', () => {
          const playerStats = {
            class: { class_levels: [{}, { level: 2, beast_fly_speed: 'No' }] },
            level: 2
               };

      const result = classRules.getDruidBeastFlySpeed(playerStats);

          expect(result).toBe(false);
           });
            });

  describe('getEnergy', () => {
    it('should return null when no class level data', () => {
      const playerStats = { class: { class_levels: [] }, level: 1 };

      const result = classRules.getEnergy(playerStats);

      expect(result).toBeNull();
       });

    it('should return null when no energy property', () => {
      const playerStats = {
        class: { class_levels: [{ level: 1 }] },
        level: 1
        };

      const result = classRules.getEnergy(playerStats);

      expect(result).toBeNull();
       });

    it('should return energy when available', () => {
      const playerStats = {
        class: {
          class_levels: [{ level: 1, energy: { dice: 2, die: 6 } }],
          major: null
          },
        level: 1
        };

      const result = classRules.getEnergy(playerStats);

      expect(result).toEqual({ dice: 2, die: 6 });
       });

    it('should return null when energy requires different major', () => {
          const playerStats = {
            class: {
              class_levels: [{}, { level: 2, energy: { dice: 2, die: 6, required_major: 'Psi Warrior' } }],
              major: { name: 'Battle Master' }
                },
            level: 2
              };

      const result = classRules.getEnergy(playerStats);

          expect(result).toBeNull();
           });
            });

  describe('getSecondWind', () => {
    it('should return 0 when no class level data', () => {
      const playerStats = { class: { class_levels: [] }, level: 1 };

      const result = classRules.getSecondWind(playerStats);

      expect(result).toBe(0);
       });

    it('should return second_wind from class level', () => {
      const playerStats = {
        class: { class_levels: [{ level: 1, second_wind: 2 }] },
        level: 1
        };

      const result = classRules.getSecondWind(playerStats);

      expect(result).toBe(2);
    });
     });

  describe('getWeaponMastery', () => {
    it('should return 0 when no class level data', () => {
      const playerStats = { class: { class_levels: [] }, level: 1 };

      const result = classRules.getWeaponMastery(playerStats);

      expect(result).toBe(0);
       });

    it('should return weapon_mastery from class level', () => {
          const playerStats = {
            class: { class_levels: [{}, {}, {}, {}, {}, {}, {}, { level: 8, weapon_mastery: 1 }] },
            level: 8
                };

      const result = classRules.getWeaponMastery(playerStats);

          expect(result).toBe(1);
           });
            });

  describe('getMartialArtsDie', () => {
    it('should return default d4 when no class level data', () => {
      const playerStats = { class: { class_levels: [] }, level: 1 };

      const result = classRules.getMartialArtsDie(playerStats);

      expect(result).toBe(4);
       });

    it('should return martial_arts_die from class level', () => {
          const playerStats = {
            class: { class_levels: [{}, {}, {}, {}, { level: 5, martial_arts_die: 8 }] },
            level: 5
                };

      const result = classRules.getMartialArtsDie(playerStats);

          expect(result).toBe(8);
            });
             });

  describe('getFocusPoints', () => {
    it('should return 0 when no class level data', () => {
      const playerStats = { class: { class_levels: [] }, level: 1 };

      const result = classRules.getFocusPoints(playerStats);

      expect(result).toBe(0);
       });

    it('should return focus_points from class level', () => {
          const playerStats = {
            class: { class_levels: [{}, { level: 2, focus_points: 4 }] },
            level: 2
                 };

      const result = classRules.getFocusPoints(playerStats);

          expect(result).toBe(4);
             });
              });

  describe('getUnarmoredMovementIncrease', () => {
    it('should return 0 when no class level data', () => {
      const playerStats = { class: { class_levels: [] }, level: 1 };

      const result = classRules.getUnarmoredMovementIncrease(playerStats);

      expect(result).toBe(0);
       });

    it('should return unarmored_movement_increase from class level', () => {
      const playerStats = {
        class: { class_levels: [{ level: 1, unarmored_movement_increase: 10 }] },
        level: 1
        };

      const result = classRules.getUnarmoredMovementIncrease(playerStats);

      expect(result).toBe(10);
    });
     });

  describe('getFavoredEnemy', () => {
    it('should return 0 when no class level data', () => {
      const playerStats = { class: { class_levels: [] }, level: 1 };

      const result = classRules.getFavoredEnemy(playerStats);

      expect(result).toBe(0);
       });

    it('should return favored_enemy from class level', () => {
          const playerStats = {
            class: { class_levels: [{}, {}, { level: 3, favored_enemy: 2 }] },
            level: 3
                   };

      const result = classRules.getFavoredEnemy(playerStats);

          expect(result).toBe(2);
             });
              });

  describe('getRogueSneakAttack', () => {
    it('should return 0 dice when no class level data', () => {
      const playerStats = { class: { class_levels: [] }, level: 1 };

      const result = classRules.getRogueSneakAttack(playerStats);

      expect(result).toEqual({ dice_count: 0, dice_value: 6 });
       });

    it('should return sneak_attack_num_d6 from class level', () => {
      const playerStats = {
        class: { class_levels: [{ level: 1, sneak_attack_num_d6: 1 }] },
        level: 1
        };

      const result = classRules.getRogueSneakAttack(playerStats);

      expect(result).toEqual({ dice_count: 1, dice_value: 6 });
    });
     });

  describe('getEldritchInvocations', () => {
    it('should return 0 when no class level data', () => {
      const playerStats = { class: { class_levels: [] }, level: 1 };

      const result = classRules.getEldritchInvocations(playerStats);

      expect(result).toBe(0);
       });

    it('should return eldritch_invocations from class level', () => {
          const playerStats = {
            class: { class_levels: [{}, { level: 2, eldritch_invocations: 2 }] },
            level: 2
                    };

      const result = classRules.getEldritchInvocations(playerStats);

          expect(result).toBe(2);
              });
               });
});

