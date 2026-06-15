import { describe, it, expect } from 'vitest';
import classRules from './classRules.js';
import { addFeatures } from './featureCategorizationUtils.js';
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
        subclasses: [
           {
            name: 'Abjuration',
            class_levels: []
           }
         ]
       },
       {
        name: 'Fighter',
        index: 'fighter',
        saving_throws: ['STR', 'CON'],
        class_levels: [],
        subclasses: []
       }
     ];

    it('should return class data for valid class', () => {
      const playerSummary = {
        class: { name: 'Wizard' }
          };

      const result = classRules.getClass(mockClasses, playerSummary);

      expect(result.name).toBe('Wizard');
      expect(result.saving_throws).toContain('Intelligence');
     });

    it('should convert saving_throws abbreviations to full names', () => {
      const playerSummary = {
        class: { name: 'Fighter' }
          };

      const result = classRules.getClass(mockClasses, playerSummary);

      expect(result.saving_throws).toContain('Strength');
      expect(result.saving_throws).toContain('Constitution');
        });

    it('should include subclass when specified', () => {
      const playerSummary = {
        class: {
          name: 'Wizard',
          subclass: { name: 'Abjuration' }
         }
       };

      const result = classRules.getClass(mockClasses, playerSummary);

      expect(result.subclass.name).toBe('Abjuration');
        });

    it('should set subclass to null when not specified', () => {
      const playerSummary = {
        class: { name: 'Wizard' }
          };

      const result = classRules.getClass(mockClasses, playerSummary);

      expect(result.subclass).toBeNull();
        });

    it('should delete subclasses property from result', () => {
      const playerSummary = {
        class: { name: 'Wizard' }
          };

      const result = classRules.getClass(mockClasses, playerSummary);

      expect(result.subclasses).toBeUndefined();
        });

    it('should merge playerSummary class data with base class', () => {
      const playerSummary = {
        class: {
          name: 'Wizard',
          customProperty: 'custom value'
         }
       };

      const result = classRules.getClass(mockClasses, playerSummary);

      expect(result.name).toBe('Wizard');
      expect(result.customProperty).toBe('custom value');
        });

    it('should return empty class_levels for class not found', () => {
      const playerSummary = {
        class: { name: 'NonExistent' }
          };

      const result = classRules.getClass(mockClasses, playerSummary);

      expect(result.class_levels).toEqual([]);
        });

    it('should handle class without saving_throws', () => {
      const classes = [
         { name: 'Wizard', class_levels: [] }
       ];
      const playerSummary = {
        class: { name: 'Wizard' }
          };

      const result = classRules.getClass(classes, playerSummary);

      expect(result.name).toBe('Wizard');
      expect(result.saving_throws).toBeUndefined();
        });

    it('should handle class without subclasses', () => {
      const classes = [
         { name: 'Fighter', saving_throws: ['STR'], class_levels: [] }
       ];
      const playerSummary = {
        class: { name: 'Fighter' }
          };

      const result = classRules.getClass(classes, playerSummary);

      expect(result.subclass).toBeNull();
      expect(result.subclasses).toBeUndefined();
      });
   });

  describe('getDruidMaxWildShapeChallengeRating', () => {
    it('should return 0 for non-Druid class', () => {
      const playerStats = {
        class: { name: 'Wizard' },
        level: 5
          };

      const result = classRules.getDruidMaxWildShapeChallengeRating(playerStats);

      expect(result).toBe(0);
        });

    it('should return wild_shape_max_cr from class level', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          class_levels: [
             { level: 1, class_specific: { wild_shape_max_cr: 0 } },
             { level: 2, class_specific: { wild_shape_max_cr: 0 } },
             { level: 3, class_specific: { wild_shape_max_cr: 1/2 } }
           ]
         },
        level: 3
          };

      const result = classRules.getDruidMaxWildShapeChallengeRating(playerStats);

      expect(result).toBe(1/2);
        });

    it('should return 1 for Circle of Moon Druid level 2-5', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          subclass: { name: 'Moon' },
          class_levels: [
             { level: 1, class_specific: {} },
             { level: 2, class_specific: {} }
           ]
         },
        level: 2
          };

      const result = classRules.getDruidMaxWildShapeChallengeRating(playerStats);

      expect(result).toBe(1);
        });

    it('should return floor(level/3) for Circle of Moon Druid level 6+', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          subclass: { name: 'Moon' },
          class_levels: []
           },
        level: 9
          };

      const result = classRules.getDruidMaxWildShapeChallengeRating(playerStats);

      expect(result).toBe(3); // floor(9/3) = 3
        });

    it('should return 1 for Circle of Moon Druid level 5', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          subclass: { name: 'Moon' },
          class_levels: []
           },
        level: 5
          };

      const result = classRules.getDruidMaxWildShapeChallengeRating(playerStats);

      expect(result).toBe(1);
        });

    it('should return 0 for Circle of Moon Druid level 1', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          subclass: { name: 'Moon' },
          class_levels: []
           },
        level: 1
          };

      const result = classRules.getDruidMaxWildShapeChallengeRating(playerStats);

      expect(result).toBe(0);
        });

    it('should handle missing class_levels', () => {
      const playerStats = {
        class: { name: 'Druid' },
        level: 5
          };

      const result = classRules.getDruidMaxWildShapeChallengeRating(playerStats);

      expect(result).toBe(0);
        });

    it('should handle missing class_specific', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          class_levels: [{ level: 1 }]
           },
        level: 1
          };

      const result = classRules.getDruidMaxWildShapeChallengeRating(playerStats);

      expect(result).toBe(0);
      });
   });

  describe('getDruidWildShapeUses', () => {
    it('should always return 2 uses', () => {
      const playerStats = {
        class: { name: 'Druid' },
        level: 5
          };

      const result = classRules.getDruidWildShapeUses(playerStats);

      expect(result).toBe(2);
        });

    it('should return 2 for any level', () => {
      for (let level = 1; level <= 20; level++) {
        const playerStats = {
          class: { name: 'Druid' },
          level: level
         };

          const result = classRules.getDruidWildShapeUses(playerStats);

        expect(result).toBe(2);
       }
     });
   });

  describe('getDruidBeastKnownForms', () => {
    it('should always return 0 (no limit)', () => {
      const playerStats = {
        class: { name: 'Druid' },
        level: 5
          };

      const result = classRules.getDruidBeastKnownForms(playerStats);

      expect(result).toBe(0);
      });
   });

  describe('getDruidBeastFlySpeed', () => {
    it('should return true when wild_shape_fly is true', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          class_levels: [
              { level: 1, class_specific: {} },
              { level: 2, class_specific: {} },
              { level: 3, class_specific: {} },
              { level: 4, class_specific: { wild_shape_fly: true } }
            ]
          },
        level: 4
          };

      const result = classRules.getDruidBeastFlySpeed(playerStats);

      expect(result).toBe(true);
        });

    it('should return false when wild_shape_fly is false', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          class_levels: [
             { level: 1, class_specific: { wild_shape_fly: false } }
           ]
         },
        level: 1
          };

      const result = classRules.getDruidBeastFlySpeed(playerStats);

      expect(result).toBe(false);
        });

    it('should return undefined when wild_shape_fly is not set', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          class_levels: [
             { level: 1, class_specific: {} }
           ]
         },
        level: 1
          };

      const result = classRules.getDruidBeastFlySpeed(playerStats);

      expect(result).toBeUndefined();
        });

    it('should return undefined when class_specific is not set', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          class_levels: [
             { level: 1 }
           ]
         },
        level: 1
          };

      const result = classRules.getDruidBeastFlySpeed(playerStats);

      expect(result).toBeUndefined();
        });

    it('should return undefined when class_levels is not set', () => {
      const playerStats = {
        class: { name: 'Druid' },
        level: 1
          };

      const result = classRules.getDruidBeastFlySpeed(playerStats);

      expect(result).toBeUndefined();
      });
   });

  describe('getRogueSneakAttack', () => {
    it('should return sneak attack from class_specific', () => {
      const playerStats = {
        class: {
          name: 'Rogue',
          class_levels: [
             { level: 1, class_specific: { sneak_attack: { dice_count: 1, dice_value: 6 } } },
             { level: 2, class_specific: { sneak_attack: { dice_count: 2, dice_value: 6 } } }
           ]
         },
        level: 2
          };

      const result = classRules.getRogueSneakAttack(playerStats);

      expect(result).toEqual({ dice_count: 2, dice_value: 6 });
        });

    it('should return default sneak attack when not found', () => {
      const playerStats = {
        class: {
          name: 'Rogue',
          class_levels: [
             { level: 1, class_specific: {} }
           ]
         },
        level: 1
          };

      const result = classRules.getRogueSneakAttack(playerStats);

      expect(result).toEqual({ dice_count: 0, dice_value: 6 });
        });

    it('should return default sneak attack when class_specific is missing', () => {
      const playerStats = {
        class: {
          name: 'Rogue',
          class_levels: [
             { level: 1 }
           ]
         },
        level: 1
          };

      const result = classRules.getRogueSneakAttack(playerStats);

      expect(result).toEqual({ dice_count: 0, dice_value: 6 });
        });

    it('should return default sneak attack when class_levels is missing', () => {
      const playerStats = {
        class: { name: 'Rogue' },
        level: 1
          };

      const result = classRules.getRogueSneakAttack(playerStats);

      expect(result).toEqual({ dice_count: 0, dice_value: 6 });
        });

    it('should return correct sneak attack for level 1 Rogue', () => {
      const playerStats = {
        class: {
          name: 'Rogue',
          class_levels: [
             { level: 1, class_specific: { sneak_attack: { dice_count: 1, dice_value: 6 } } }
           ]
         },
        level: 1
          };

      const result = classRules.getRogueSneakAttack(playerStats);

      expect(result.dice_count).toBe(1);
      expect(result.dice_value).toBe(6);
        });

    it('should return correct sneak attack for level 5 Rogue', () => {
      const playerStats = {
        class: {
          name: 'Rogue',
          class_levels: [
             { level: 1, class_specific: { sneak_attack: { dice_count: 1, dice_value: 6 } } },
             { level: 2, class_specific: { sneak_attack: { dice_count: 2, dice_value: 6 } } },
             { level: 3, class_specific: { sneak_attack: { dice_count: 3, dice_value: 6 } } },
             { level: 4, class_specific: { sneak_attack: { dice_count: 4, dice_value: 6 } } },
             { level: 5, class_specific: { sneak_attack: { dice_count: 5, dice_value: 6 } } }
           ]
         },
        level: 5
          };

      const result = classRules.getRogueSneakAttack(playerStats);

      expect(result.dice_count).toBe(5);
      expect(result.dice_value).toBe(6);
      });
   });

  describe('getHighestSubclassLevel', () => {
    it('should return 0 when no subclass', () => {
      const playerStats = {
        class: {
          name: 'Wizard',
          subclass: null
           },
        level: 5
          };

      const result = classRules.getHighestSubclassLevel(playerStats);

      expect(result).toBe(0);
        });

    it('should return highest subclass level <= player level', () => {
      const playerStats = {
        class: {
          name: 'Wizard',
          subclass: {
            name: 'Abjuration',
            class_levels: [
               { level: 2 },
               { level: 3 },
               { level: 4 },
               { level: 5 }
             ]
           }
         },
        level: 4
       };

      const result = classRules.getHighestSubclassLevel(playerStats);

      expect(result.level).toBe(4);
        });

    it('should return 0 when player level is less than first subclass level', () => {
      const playerStats = {
        class: {
          name: 'Wizard',
          subclass: {
            name: 'Abjuration',
            class_levels: [
               { level: 2 },
               { level: 3 }
             ]
           }
         },
        level: 1
          };

      const result = classRules.getHighestSubclassLevel(playerStats);

      expect(result).toBe(0);
        });

    it('should return last subclass level when player level >= all subclass levels', () => {
      const playerStats = {
        class: {
          name: 'Wizard',
          subclass: {
            name: 'Abjuration',
            class_levels: [
               { level: 2 },
               { level: 3 },
               { level: 4 }
             ]
           }
         },
        level: 10
          };

      const result = classRules.getHighestSubclassLevel(playerStats);

      expect(result.level).toBe(4);
        });

    it('should handle subclass without class_levels', () => {
      const playerStats = {
        class: {
          name: 'Wizard',
          subclass: {
            name: 'Abjuration'
           }
         },
        level: 5
          };

      const result = classRules.getHighestSubclassLevel(playerStats);

      expect(result).toBe(0);
      });
   });

  describe('getFeatures', () => {
    it('should return categorized features from class levels', () => {
      const playerStats = {
        class: {
          name: 'Fighter',
          class_levels: [
             { level: 1, features: ['Weapon Training'] },
             { level: 2, features: ['Second Wind', 'Action Surge'] }
           ]
         },
        level: 2,
        subclass: null
          };

      const result = classRules.getFeatures(playerStats);

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
        });

    it('should include subclass features when subclass exists', () => {
      const playerStats = {
        class: {
          name: 'Fighter',
          class_levels: [
             { level: 1, features: ['Weapon Training'] }
           ],
          subclass: {
            name: 'Battle Master',
            class_levels: [
               { level: 3, features: ['Combat Maneuvers'] }
             ]
           }
         },
        level: 3
          };

      const result = classRules.getFeatures(playerStats);

      expect(result).toBeDefined();
        });

    it('should filter class levels by player level', () => {
      const playerStats = {
        class: {
          name: 'Fighter',
          class_levels: [
             { level: 1, features: ['Weapon Training'] },
             { level: 2, features: ['Second Wind'] },
             { level: 3, features: ['Action Surge'] }
           ]
         },
        level: 2,
        subclass: null
          };

      const result = classRules.getFeatures(playerStats);

      expect(result).toBeDefined();
        });

    it('should handle class without features', () => {
      const playerStats = {
        class: {
          name: 'Fighter',
          class_levels: [
             { level: 1 }
           ]
         },
        level: 1,
        subclass: null
          };

      const result = classRules.getFeatures(playerStats);

      expect(result).toBeDefined();
        });

    it('should handle subclass without features', () => {
      const playerStats = {
        class: {
          name: 'Fighter',
          class_levels: [
             { level: 1, features: ['Weapon Training'] }
           ],
          subclass: {
            name: 'Battle Master',
            class_levels: [
               { level: 3 }
             ]
           }
         },
        level: 3
          };

      const result = classRules.getFeatures(playerStats);

      expect(result).toBeDefined();
      });
   });

  describe('addFeatures', () => {
    it('should categorize features from all levels', () => {
      const levels = [
         { level: 1, features: ['Weapon Training'] },
         { level: 2, features: ['Second Wind', 'Action Surge'] }
       ];

       const result = addFeatures(levels, featureCategories, { descriptionField: 'description' });

       expect(result).toBeDefined();
       expect(typeof result).toBe('object');
         });

    it('should handle empty levels array', () => {
      const result = addFeatures([], featureCategories, { descriptionField: 'description' });

      expect(result).toBeDefined();
        });

    it('should handle levels without features', () => {
      const levels = [
         { level: 1 },
         { level: 2 }
       ];

       const result = addFeatures(levels, featureCategories, { descriptionField: 'description' });

      expect(result).toBeDefined();
        });

    it('should handle levels with empty features array', () => {
      const levels = [
         { level: 1, features: [] },
         { level: 2, features: [] }
       ];

       const result = addFeatures(levels, featureCategories, { descriptionField: 'description' });

      expect(result).toBeDefined();
      });
   });
});
