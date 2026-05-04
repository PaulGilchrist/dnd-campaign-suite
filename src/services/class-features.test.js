import { describe, it, expect } from 'vitest';
import { getClassFeatures } from './class-features';

describe('getClassFeatures', () => {
  describe('Bard Features (5e)', () => {
    it('should return correct bardicDie, songOfRestDie, magicalSecrets, subclassMagicalSecrets for 5e rules', () => {
      const playerStats = {
        class: {
          name: 'Bard',
          class_levels: [
            { level: 1, class_specific: {} },
            { level: 2, class_specific: {} },
            { level: 3, class_specific: { bardic_inspiration_die: 6, song_of_rest_die: 6, magical_secrets_max_5: 2 } }
          ]
        },
        level: 3
      };

      const result = getClassFeatures(playerStats);

      expect(result.bardicDie).toBe(6);
      expect(result.songOfRestDie).toBe(6);
      expect(result.magicalSecrets).toBe(2);
      expect(result.subclassMagicalSecrets).toBe(0);
    });

    it('should return subclassMagicalSecrets for Lore subclass', () => {
      const playerStats = {
        class: {
          name: 'Bard',
          subclass: {
            name: 'Lore',
            class_levels: [
              { level: 3, subclass_specific: { additional_magical_secrets_max_lvl: 2 } }
            ]
          },
          class_levels: [
            { level: 1, class_specific: {} },
            { level: 2, class_specific: {} },
            { level: 3, class_specific: { bardic_inspiration_die: 6 } }
          ]
        },
        level: 3
      };

      const result = getClassFeatures(playerStats);

      expect(result.subclassMagicalSecrets).toBe(2);
    });
  });

  describe('Bard Features (2024)', () => {
    it('should return bardicDie with songOfRestDie and magicalSecrets as null', () => {
      const playerStats = {
        rules: '2024',
        class: {
          name: 'Bard',
          class_levels: [
            { level: 1 },
            { level: 2 },
            { level: 3, bardic_die: 6 }
          ]
        },
        level: 3
      };

      const result = getClassFeatures(playerStats);

      expect(result.bardicDie).toBe(6);
      expect(result.songOfRestDie).toBeNull();
      expect(result.magicalSecrets).toBeNull();
      expect(result.subclassMagicalSecrets).toBe(0);
    });
  });

  describe('Cleric Features (5e)', () => {
    it('should return maxChannelDivinity and destroyUndeadCR', () => {
      const playerStats = {
        class: {
          name: 'Cleric',
          class_levels: [
            { level: 1, class_specific: {} },
            { level: 2, class_specific: {} },
            { level: 3, class_specific: { channel_divinity_charges: 1, destroy_undead_cr: 1/2 } }
          ]
        },
        level: 3
      };

      const result = getClassFeatures(playerStats);

      expect(result.maxChannelDivinity).toBe(1);
      expect(result.destroyUndeadCR).toBe(1/2);
    });
  });

  describe('Cleric Features (2024)', () => {
    it('should return maxChannelDivinity with destroyUndeadCR as null', () => {
      const playerStats = {
        rules: '2024',
        class: {
          name: 'Cleric',
          class_levels: [
            { level: 1 },
            { level: 2 },
            { level: 3, channel_divinity: 1 }
          ]
        },
        level: 3
      };

      const result = getClassFeatures(playerStats);

      expect(result.maxChannelDivinity).toBe(1);
      expect(result.destroyUndeadCR).toBeNull();
    });
  });

  describe('Druid Features (5e)', () => {
    it('should return correct wild shape data with limitations based on fly flag', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          class_levels: [
            { level: 1, class_specific: {} },
            { level: 2, class_specific: {} },
            { level: 3, class_specific: { wild_shape_max_cr: 1/2, wild_shape_fly: true } }
          ]
        },
        level: 3
      };

      const result = getClassFeatures(playerStats);

      expect(result.maxWildShapeUses).toBe(2);
      expect(result.maxWildShapeChallengeRating).toBe(1/2);
      expect(result.beastKnownForms).toBe(0);
      expect(result.wildShapeLimitations).toBe('walk, swim, or fly');
    });

    it('should return correct wild shape data with limitations based on swim flag', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          class_levels: [
            { level: 1, class_specific: {} },
            { level: 2, class_specific: {} },
            { level: 3, class_specific: { wild_shape_max_cr: 1/2, wild_shape_swim: true } }
          ]
        },
        level: 3
      };

      const result = getClassFeatures(playerStats);

      expect(result.wildShapeLimitations).toBe('walk or swim only (no fly)');
    });

    it('should return walk only limitation when neither fly nor swim is true', () => {
      const playerStats = {
        class: {
          name: 'Druid',
          class_levels: [
            { level: 1, class_specific: {} },
            { level: 2, class_specific: {} },
            { level: 3, class_specific: { wild_shape_max_cr: 1/2 } }
          ]
        },
        level: 3
      };

      const result = getClassFeatures(playerStats);

      expect(result.wildShapeLimitations).toBe('walk only (no swim or fly)');
    });
  });

  describe('Druid Features (2024)', () => {
    it('should return wild shape data from 2024 methods', () => {
      const playerStats = {
        rules: '2024',
        class: {
          name: 'Druid',
          class_levels: [
            { level: 1 },
            { level: 2 },
            { level: 3, beast_max_cr: 1, wild_shape: 2, beast_known_forms: 4, beast_fly_speed: 'Yes' }
          ]
        },
        level: 3
      };

      const result = getClassFeatures(playerStats);

      expect(result.maxWildShapeUses).toBe(2);
      expect(result.maxWildShapeChallengeRating).toBe(1);
      expect(result.beastKnownForms).toBe(4);
      expect(result.wildShapeLimitations).toBe('walk, swim, or fly');
    });

    it('should return walk or swim only when beast_fly_speed is not Yes', () => {
      const playerStats = {
        rules: '2024',
        class: {
          name: 'Druid',
          class_levels: [
            { level: 3, beast_max_cr: 1, wild_shape: 2, beast_known_forms: 4, beast_fly_speed: 'No' }
          ]
        },
        level: 3
      };

      const result = getClassFeatures(playerStats);

      expect(result.wildShapeLimitations).toBe('walk or swim only (no fly)');
    });
  });

  describe('Paladin Features (5e)', () => {
    it('should return channel divinity, aura range, and extra attacks', () => {
      const playerStats = {
        class: {
          name: 'Paladin',
          class_levels: [
            { level: 1, class_specific: {} },
            { level: 2, class_specific: {} },
            { level: 3, class_specific: { channel_divinity_charges: 1, aura_range: 10 } }
          ]
        },
        level: 3
      };

      const result = getClassFeatures(playerStats);

      expect(result.maxChannelDivinity).toBe(1);
      expect(result.auraRange).toBe(10);
      expect(result.extraAttacks).toBe(0);
    });

    it('should return extra attacks for level > 4', () => {
      const playerStats = {
        class: {
          name: 'Paladin',
          class_levels: [
            { level: 5, class_specific: { channel_divinity_charges: 1 } }
          ]
        },
        level: 5
      };

      const result = getClassFeatures(playerStats);

      expect(result.extraAttacks).toBe(1);
    });
  });

  describe('Paladin Features (2024)', () => {
    it('should return channel divinity with aura range as null', () => {
      const playerStats = {
        rules: '2024',
        class: {
          name: 'Paladin',
          class_levels: [
            { level: 1 },
            { level: 2 },
            { level: 3, channel_divinity: 1 }
          ]
        },
        level: 3
      };

      const result = getClassFeatures(playerStats);

      expect(result.maxChannelDivinity).toBe(1);
      expect(result.auraRange).toBeNull();
      expect(result.extraAttacks).toBe(0);
    });
  });

  describe('Sorcerer Features (5e)', () => {
    it('should return sorcery points, metamagic known, and spell slot costs', () => {
      const playerStats = {
        class: {
          name: 'Sorcerer',
          class_levels: [
            { level: 1, class_specific: {} },
            { level: 2, class_specific: {} },
            { level: 3, class_specific: { sorcery_points: 3, metamagic_known: 2, creating_spell_slots: [{ sorcery_point_cost: 2 }, { sorcery_point_cost: 3 }] } }
          ]
        },
        level: 3
      };

      const result = getClassFeatures(playerStats);

      expect(result.maxSorceryPoints).toBe(3);
      expect(result.metamagicKnown).toBe(2);
      expect(result.creatingSpellSlotCosts).toEqual([2, 3]);
    });
  });

  describe('Sorcerer Features (2024)', () => {
    it('should return sorcery points and metamagic known based on level', () => {
      const playerStats = {
        rules: '2024',
        class: {
          name: 'Sorcerer',
          class_levels: [
            { level: 1 },
            { level: 2 },
            { level: 3, sorcery_points: 3 }
          ]
        },
        level: 3
      };

      const result = getClassFeatures(playerStats);

      expect(result.maxSorceryPoints).toBe(3);
      expect(result.metamagicKnown).toBe(2);
      expect(result.creatingSpellSlotCosts).toEqual([]);
    });

    it('should return 4 metamagic known for level 10', () => {
      const playerStats = {
        rules: '2024',
        class: {
          name: 'Sorcerer',
          class_levels: [
            { level: 10, sorcery_points: 10 }
          ]
        },
        level: 10
      };

      const result = getClassFeatures(playerStats);

      expect(result.metamagicKnown).toBe(4);
    });

    it('should return 6 metamagic known for level 17', () => {
      const playerStats = {
        rules: '2024',
        class: {
          name: 'Sorcerer',
          class_levels: [
            { level: 17, sorcery_points: 17 }
          ]
        },
        level: 17
      };

      const result = getClassFeatures(playerStats);

      expect(result.metamagicKnown).toBe(6);
    });
  });

  describe('Warlock Features (5e)', () => {
    it('should return invocations known and arcanum data for level > 10', () => {
      const playerStats = {
        class: {
          name: 'Warlock',
          class_levels: [
            { level: 1, class_specific: {} },
            { level: 11, class_specific: { invocations_known: 6, mystic_arcanum_level_6: 1, mystic_arcanum_level_7: 1 } }
          ],
          arcanums: [{ level: 6, spell: 'Sunbeam' }]
        },
        level: 11
      };

      const result = getClassFeatures(playerStats);

      expect(result.invocationsKnown).toBe(6);
      expect(result.hasArcanum).toBe(true);
      expect(result.arcanumLevels).toEqual({ level6: 1, level7: 1, level8: 0, level9: 0 });
      expect(result.arcanums).toEqual([{ level: 6, spell: 'Sunbeam' }]);
    });

    it('should return hasArcanum false for level <= 10', () => {
      const playerStats = {
        class: {
          name: 'Warlock',
          class_levels: [
            { level: 10, class_specific: { invocations_known: 5 } }
          ]
        },
        level: 10
      };

      const result = getClassFeatures(playerStats);

      expect(result.hasArcanum).toBe(false);
      expect(result.arcanumLevels).toEqual({ level6: 0, level7: 0, level8: 0, level9: 0 });
    });
  });

  describe('Warlock Features (2024)', () => {
    it('should return eldritch invocations with hasArcanum false', () => {
      const playerStats = {
        rules: '2024',
        class: {
          name: 'Warlock',
          class_levels: [
            { level: 1 },
            { level: 2, eldritch_invocations: 2 }
          ],
          eldritchInvocations: [{ name: 'Agonizing Blast' }],
          pactBoon: { name: 'Pact of the Blade' },
          invocations: [{ name: 'Agonizing Blast' }]
        },
        level: 2
      };

      const result = getClassFeatures(playerStats);

      expect(result.invocationsKnown).toBe(2);
      expect(result.hasArcanum).toBe(false);
      expect(result.arcanumLevels).toBeNull();
      expect(result.arcanums).toEqual([{ name: 'Agonizing Blast' }]);
      expect(result.pactBoon).toEqual({ name: 'Pact of the Blade' });
      expect(result.invocations).toEqual([{ name: 'Agonizing Blast' }]);
    });
  });

  describe('Wizard Features (5e)', () => {
    it('should return arcane recovery levels with showWizardFeatures true', () => {
      const playerStats = {
        class: {
          name: 'Wizard',
          class_levels: [
            { level: 1, class_specific: {} },
            { level: 2, class_specific: {} },
            { level: 3, class_specific: { arcane_recovery_levels: 2 } }
          ]
        },
        level: 3
      };

      const result = getClassFeatures(playerStats);

      expect(result.arcaneRecoveryLevels).toBe(2);
      expect(result.showWizardFeatures).toBe(true);
    });
  });

  describe('Wizard Features (2024)', () => {
    it('should return showWizardFeatures false', () => {
      const playerStats = {
        rules: '2024',
        class: {
          name: 'Wizard',
          class_levels: [
            { level: 1 },
            { level: 2 },
            { level: 3 }
          ]
        },
        level: 3
      };

      const result = getClassFeatures(playerStats);

      expect(result.showWizardFeatures).toBe(false);
      expect(result.arcaneRecoveryLevels).toBeUndefined();
    });
  });

  describe('Unknown class', () => {
    it('should return null for unknown class names', () => {
      const playerStats = {
        class: {
          name: 'NonExistentClass'
        },
        level: 1
      };

      const result = getClassFeatures(playerStats);

      expect(result).toBeNull();
    });
  });
});
