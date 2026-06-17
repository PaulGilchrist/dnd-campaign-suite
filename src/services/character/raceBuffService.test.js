import { describe, it, expect } from 'vitest';
import { computeRaceBuffs, applyRaceBuffsToPlayerData } from './raceBuffService.js';

describe('raceBuffService', () => {
  describe('computeRaceBuffs', () => {
    it('returns empty result when race is null', () => {
      const result = computeRaceBuffs(null, {});
      expect(result.abilityScoreIncreases).toEqual([]);
      expect(result.proficiencies).toEqual([]);
      expect(result.languages).toEqual([]);
      expect(result.resistances).toEqual([]);
      expect(result.traits).toEqual([]);
      expect(result.speed).toBeNull();
      expect(result.hitPointBonusPerLevel).toBe(0);
      expect(result.feats).toEqual([]);
    });

    it('returns empty result when race is undefined', () => {
      const result = computeRaceBuffs(undefined, {});
      expect(result.abilityScoreIncreases).toEqual([]);
    });

    it('returns default result with no race data', () => {
      const result = computeRaceBuffs({}, {});
      expect(result.abilityScoreIncreases).toEqual([]);
      expect(result.proficiencies).toEqual([]);
      expect(result.languages).toEqual([]);
      expect(result.resistances).toEqual([]);
      expect(result.traits).toEqual([]);
      expect(result.speed).toBeNull();
      expect(result.hitPointBonusPerLevel).toBe(0);
    });

    describe('5e ruleset', () => {
      it('applies ability bonuses from race', () => {
        const race = {
          ability_bonuses: [
            { name: 'str', bonus: 2 },
            { name: 'dex', bonus: 1 },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.abilityScoreIncreases).toEqual([
          { name: 'Strength', amount: 2 },
          { name: 'Dexterity', amount: 1 },
        ]);
      });

      it('applies ability bonuses from subrace', () => {
        const race = {
          ability_bonuses: [{ name: 'str', bonus: 2 }],
          subraces: [
            { name: 'High Elf', ability_bonuses: [{ name: 'int', bonus: 1 }] },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'High Elf' } } }, '5e');
        expect(result.abilityScoreIncreases).toEqual([
          { name: 'Strength', amount: 2 },
          { name: 'Intelligence', amount: 1 },
        ]);
      });

      it('combines ability bonuses from race and subrace', () => {
        const race = {
          ability_bonuses: [{ name: 'str', bonus: 2 }],
          subraces: [
            { name: 'Half-Elf', ability_bonuses: [{ name: 'str', bonus: 1 }] },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'Half-Elf' } } }, '5e');
        expect(result.abilityScoreIncreases).toEqual([
          { name: 'Strength', amount: 3 },
        ]);
      });

      it('applies starting proficiencies from race', () => {
        const race = {
          starting_proficiencies: ['Perception', 'Stealth'],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.proficiencies).toEqual([
          { name: 'Perception' },
          { name: 'Stealth' },
        ]);
      });

      it('applies starting proficiencies from subrace', () => {
        const race = {
          starting_proficiencies: ['Perception'],
          subraces: [
            { name: 'High Elf', starting_proficiencies: ['Stealth'] },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'High Elf' } } }, '5e');
        expect(result.proficiencies).toEqual([
          { name: 'Perception' },
          { name: 'Stealth' },
        ]);
      });

      it('applies languages from race', () => {
        const race = {
          languages: ['Common', 'Elvish'],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.languages).toEqual(['Common', 'Elvish']);
      });

      it('applies languages from subrace (deduplicated)', () => {
        const race = {
          languages: ['Common'],
          subraces: [
            { name: 'High Elf', languages: ['Common', 'Elvish'] },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'High Elf' } } }, '5e');
        expect(result.languages).toEqual(['Common', 'Elvish']);
      });

      it('applies traits from race', () => {
        const race = {
          traits: [
            { name: 'Darkvision', description: '60 ft.' },
            { name: 'Trance', description: '4 hours.' },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.traits).toEqual([
          { name: 'Darkvision', description: '60 ft.' },
          { name: 'Trance', description: '4 hours.' },
        ]);
      });

      it('extracts speed from trait description', () => {
        const race = {
          traits: [
            { name: 'Speed', description: '30 feet' },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.speed).toBe(30);
      });

      it('extracts speed with different casing', () => {
        const race = {
          traits: [
            { name: 'Speed', description: '35 Feet' },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.speed).toBe(35);
      });

      it('extracts resistances from trait description in 5e', () => {
        const race = {
          traits: [
            { name: 'Resistance', description: 'Resistance to fire' },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.resistances).toContain('fire');
      });

      it('adds Trance trait for Trance trait name', () => {
        const race = {
          traits: [
            { name: 'Trance', description: '4 hours.' },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.traits.some(t => t.name === 'Trance')).toBe(true);
      });

      it('applies trait proficiencies from race in 5e', () => {
        const race = {
          traits: [
            { name: 'Skill Proficiency', proficiencies: ['Perception'] },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.proficiencies).toContainEqual({ name: 'Perception' });
      });

      it('applies trait proficiency_choices from race in 5e', () => {
        const race = {
          traits: [
            {
              name: 'Skill Choice',
              proficiency_choices: [
                {
                  choose: '2',
                  from: ['Perception', 'Stealth', 'Athletics'],
                },
              ],
            },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.proficiencies).toContainEqual({
          name: '2 from: Perception, Stealth, Athletics',
          isChoice: true,
          choose: '2',
          from: ['Perception', 'Stealth', 'Athletics'],
        });
      });

      it('applies subrace racial_traits proficiencies', () => {
        const race = {
          subraces: [
            {
              name: 'High Elf',
              racial_traits: [
                { name: 'Cantrip', proficiencies: ['Arcana'] },
              ],
            },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'High Elf' } } }, '5e');
        expect(result.proficiencies).toContainEqual({ name: 'Arcana' });
      });

      it('applies subrace hit_point_bonus_per_level', () => {
        const race = {
          subraces: [
            { name: 'Half-Orc', hit_point_bonus_per_level: 1 },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'Half-Orc' } } }, '5e');
        expect(result.hitPointBonusPerLevel).toBe(1);
      });
    });

    describe('2024 ruleset', () => {
      it('applies damage_resistance from race', () => {
        const race = {
          damage_resistance: 'fire',
        };
        const result = computeRaceBuffs(race, {}, '2024');
        expect(result.resistances).toEqual(['fire']);
      });

      it('applies damage_resistance from subrace', () => {
        const race = {
          damage_resistance: 'fire',
          subraces: [
            { name: 'Variant', damage_resistance: 'cold' },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'Variant' } } }, '2024');
        expect(result.resistances).toEqual(['fire', 'cold']);
      });

      it('deduplicates damage_resistance from race and subrace', () => {
        const race = {
          damage_resistance: 'fire',
          subraces: [
            { name: 'Variant', damage_resistance: 'fire' },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'Variant' } } }, '2024');
        expect(result.resistances).toEqual(['fire']);
      });

      it('applies starting_proficiencies from race in 2024', () => {
        const race = {
          starting_proficiencies: ['Perception'],
          subraces: [],
        };
        const result = computeRaceBuffs(race, {}, '2024');
        expect(result.proficiencies).toEqual([{ name: 'Perception' }]);
      });

      it('applies starting_proficiencies from subrace in 2024', () => {
        const race = {
          starting_proficiencies: ['Perception'],
          subraces: [
            { name: 'Variant', starting_proficiencies: ['Stealth'] },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'Variant' } } }, '2024');
        expect(result.proficiencies).toContainEqual({ name: 'Perception' });
        expect(result.proficiencies).toContainEqual({ name: 'Stealth' });
      });

      it('extracts skill proficiencies from trait description in 2024', () => {
        const race = {
          traits: [
            { name: 'Skill Proficiency', description: 'Proficiency in the Perception skill' },
          ],
        };
        const result = computeRaceBuffs(race, {}, '2024');
        expect(result.proficiencies).toContainEqual({ name: 'Skill: Perception' });
      });

      it('extracts multiple skills from trait description in 2024', () => {
        const race = {
          traits: [
            { name: 'Skill Proficiency', description: 'Proficiency in the Perception and Stealth skills' },
          ],
        };
        const result = computeRaceBuffs(race, {}, '2024');
        expect(result.proficiencies).toContainEqual({ name: 'Skill: Perception' });
        expect(result.proficiencies).toContainEqual({ name: 'Skill: Stealth' });
      });

      it('extracts skills with "or" separator in 2024', () => {
        const race = {
          traits: [
            { name: 'Skill Proficiency', description: 'Proficiency in the Perception or Stealth skill' },
          ],
        };
        const result = computeRaceBuffs(race, {}, '2024');
        expect(result.proficiencies).toContainEqual({ name: 'Skill: Perception' });
        expect(result.proficiencies).toContainEqual({ name: 'Skill: Stealth' });
      });

      it('applies proficiency_choices from trait in 2024', () => {
        const race = {
          traits: [
            {
              name: 'Skillful',
              proficiency_choices: {
                choose: '2',
                from: ['Perception', 'Stealth', 'Athletics'],
              },
            },
          ],
        };
        const result = computeRaceBuffs(race, {}, '2024');
        expect(result.proficiencies).toContainEqual({
          name: 'Perception',
          isChoice: true,
          choose: '2',
        });
        expect(result.proficiencies).toContainEqual({
          name: 'Stealth',
          isChoice: true,
          choose: '2',
        });
        expect(result.proficiencies).toContainEqual({
          name: 'Athletics',
          isChoice: true,
          choose: '2',
        });
      });

      it('applies Versatile proficiency_choices as feats in 2024', () => {
        const race = {
          traits: [
            {
              name: 'Versatile',
              proficiency_choices: {
                choose: '1',
                from: ['Lucky', 'Observant'],
              },
            },
          ],
        };
        const result = computeRaceBuffs(race, {}, '2024');
        expect(result.feats).toContainEqual({
          name: 'Lucky',
          isChoice: true,
          choose: '1',
        });
        expect(result.feats).toContainEqual({
          name: 'Observant',
          isChoice: true,
          choose: '1',
        });
      });

      it('applies subrace starting_proficiencies in 2024', () => {
        const race = {
          starting_proficiencies: ['Perception'],
          subraces: [
            { name: 'Variant', starting_proficiencies: ['Stealth'] },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'Variant' } } }, '2024');
        expect(result.proficiencies).toContainEqual({ name: 'Perception' });
        expect(result.proficiencies).toContainEqual({ name: 'Stealth' });
      });

      it('applies subrace hit_point_bonus_per_level in 2024', () => {
        const race = {
          subraces: [
            { name: 'Variant', hit_point_bonus_per_level: 1 },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'Variant' } } }, '2024');
        expect(result.hitPointBonusPerLevel).toBe(1);
      });
    });

    describe('default ruleset (5e)', () => {
      it('defaults to 5e ruleset when not specified', () => {
        const race = {
          ability_bonuses: [{ name: 'str', bonus: 2 }],
        };
        const result = computeRaceBuffs(race, {});
        expect(result.abilityScoreIncreases).toEqual([{ name: 'Strength', amount: 2 }]);
      });
    });
  });

  describe('applyRaceBuffsToPlayerData', () => {
    it('applies ability score increases to playerData', () => {
      const playerData = {
        abilities: [
          { name: 'Strength', miscBonus: 0 },
          { name: 'Dexterity', miscBonus: 0 },
        ],
        languages: [],
      };
      const buffs = {
        abilityScoreIncreases: [
          { name: 'Strength', amount: 2 },
          { name: 'Dexterity', amount: 1 },
        ],
        languages: ['Common', 'Elvish'],
      };
      applyRaceBuffsToPlayerData(playerData, buffs);
      expect(playerData.abilities[0].miscBonus).toBe(2);
      expect(playerData.abilities[1].miscBonus).toBe(1);
    });

    it('merges languages with deduplication', () => {
      const playerData = {
        abilities: [],
        languages: ['Common'],
      };
      const buffs = {
        abilityScoreIncreases: [],
        languages: ['Common', 'Elvish'],
      };
      applyRaceBuffsToPlayerData(playerData, buffs);
      expect(playerData.languages).toEqual(['Common', 'Elvish']);
    });

    it('does not duplicate existing languages', () => {
      const playerData = {
        abilities: [],
        languages: ['Common'],
      };
      const buffs = {
        abilityScoreIncreases: [],
        languages: ['Common'],
      };
      applyRaceBuffsToPlayerData(playerData, buffs);
      expect(playerData.languages).toEqual(['Common']);
    });

    it('handles empty abilityScoreIncreases', () => {
      const playerData = {
        abilities: [{ name: 'Strength', miscBonus: 0 }],
        languages: [],
      };
      const buffs = {
        abilityScoreIncreases: [],
        languages: [],
      };
      applyRaceBuffsToPlayerData(playerData, buffs);
      expect(playerData.abilities[0].miscBonus).toBe(0);
    });

    it('handles undefined playerData abilities gracefully', () => {
      const playerData = {
        languages: [],
      };
      const buffs = {
        abilityScoreIncreases: [{ name: 'Strength', amount: 2 }],
        languages: [],
      };
      applyRaceBuffsToPlayerData(playerData, buffs);
      expect(playerData.abilities).toBeUndefined();
    });

    it('handles empty buff languages', () => {
      const playerData = {
        abilities: [],
        languages: ['Common'],
      };
      const buffs = {
        abilityScoreIncreases: [],
        languages: [],
      };
      applyRaceBuffsToPlayerData(playerData, buffs);
      expect(playerData.languages).toEqual(['Common']);
    });
  });
});
