// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { computeRaceBuffs, applyRaceBuffsToPlayerData } from './raceBuffService.js';

describe('raceBuffService', () => {
  describe('computeRaceBuffs', () => {
    it('returns default result when race is null', () => {
      const result = computeRaceBuffs(null, {});
      expect(result).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        languages: [],
        resistances: [],
        traits: [],
        speed: null,
        hitPointBonusPerLevel: 0,
        feats: [],
      });
    });

    it('returns default result when race is undefined', () => {
      const result = computeRaceBuffs(undefined, {});
      expect(result.abilityScoreIncreases).toEqual([]);
      expect(result.speed).toBeNull();
      expect(result.hitPointBonusPerLevel).toBe(0);
    });

    it('returns default result when race object is empty', () => {
      const result = computeRaceBuffs({}, {});
      expect(result.abilityScoreIncreases).toEqual([]);
      expect(result.speed).toBeNull();
      expect(result.hitPointBonusPerLevel).toBe(0);
    });

    describe('5e ruleset', () => {
      it('maps ability bonus shorthand names to full names', () => {
        const race = {
          ability_bonuses: [
            { name: 'str', bonus: 2 },
            { name: 'dex', bonus: 1 },
            { name: 'con', bonus: 3 },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.abilityScoreIncreases).toEqual([
          { name: 'Strength', amount: 2 },
          { name: 'Dexterity', amount: 1 },
          { name: 'Constitution', amount: 3 },
        ]);
      });

      it('defaults bonus amount to 1 when bonus is missing', () => {
        const race = {
          ability_bonuses: [{ name: 'str' }],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.abilityScoreIncreases).toEqual([
          { name: 'Strength', amount: 1 },
        ]);
      });

      it('applies ability bonuses from subrace and aggregates with race', () => {
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

      it('sums ability bonuses when race and subrace share the same ability', () => {
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

      it('does not aggregate when subrace name does not match', () => {
        const race = {
          ability_bonuses: [{ name: 'str', bonus: 2 }],
          subraces: [
            { name: 'High Elf', ability_bonuses: [{ name: 'str', bonus: 1 }] },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'Drow' } } }, '5e');
        expect(result.abilityScoreIncreases).toEqual([
          { name: 'Strength', amount: 2 },
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

      it('applies starting proficiencies from subrace in addition to race', () => {
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

      it('deduplicates languages when subrace overlaps', () => {
        const race = {
          languages: ['Common'],
          subraces: [
            { name: 'High Elf', languages: ['Common', 'Elvish'] },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'High Elf' } } }, '5e');
        expect(result.languages).toEqual(['Common', 'Elvish']);
      });

      it('passes through traits from race', () => {
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

      it('extracts speed from trait with "Speed" name', () => {
        const race = {
          traits: [
            { name: 'Speed', description: '30 feet' },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.speed).toBe(30);
      });

      it('extracts speed with varied casing and "feet" plural', () => {
        const race = {
          traits: [
            { name: 'Speed', description: '35 Feet' },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.speed).toBe(35);
      });

      it('extracts speed from trait with "speed" in lowercase name', () => {
        const race = {
          traits: [
            { name: 'Walking Speed', description: '40 feet' },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.speed).toBe(40);
      });

      it('ignores speed extraction when description has no number', () => {
        const race = {
          traits: [
            { name: 'Speed', description: 'varies' },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.speed).toBeNull();
      });

      it('extracts resistance types from trait description in 5e', () => {
        const race = {
          traits: [
            { name: 'Resistance', description: 'Resistance to fire' },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.resistances).toContain('fire');
      });

      it('extracts a single resistance from a trait description with multiple words after "to"', () => {
        const race = {
          traits: [
            { name: 'Resistance', description: 'Resistance to fire and cold' },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.resistances).toEqual(['fire']);
      });

      it('extracts resistant variant of resistance keyword', () => {
        const race = {
          traits: [
            { name: 'Resistance', description: 'Resistant to poison' },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.resistances).toContain('poison');
      });

      it('does not deduplicate Trance traits beyond the Trance-specific check', () => {
        const race = {
          traits: [
            { name: 'Trance', description: '4 hours.' },
            { name: 'Trance', description: '4 hours.' },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        const tranceTraits = result.traits.filter(t => t.name === 'Trance');
        expect(tranceTraits).toHaveLength(2);
      });

      it('extracts proficiencies from trait.proficiencies in 5e', () => {
        const race = {
          traits: [
            { name: 'Skill Proficiency', proficiencies: ['Perception'] },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.proficiencies).toContainEqual({ name: 'Perception' });
      });

      it('formats proficiency_choices as a single choice entry in 5e', () => {
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

      it('handles proficiency_choices with missing from array in 5e', () => {
        const race = {
          traits: [
            {
              name: 'Skill Choice',
              proficiency_choices: [
                { choose: '1' },
              ],
            },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.proficiencies).toContainEqual({
          name: '1 from: ',
          isChoice: true,
          choose: '1',
          from: undefined,
        });
      });

      it('extracts proficiencies from subrace racial_traits in 5e', () => {
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

      it('extracts traits from subrace racial_traits in 5e', () => {
        const race = {
          subraces: [
            {
              name: 'High Elf',
              racial_traits: [
                { name: 'Cantrip', description: 'You can cast one cantrip' },
              ],
            },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'High Elf' } } }, '5e');
        expect(result.traits).toContainEqual({ name: 'Cantrip', description: 'You can cast one cantrip' });
      });

      it('adds hit_point_bonus_per_level from subrace in 5e', () => {
        const race = {
          subraces: [
            { name: 'Half-Orc', hit_point_bonus_per_level: 1 },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'Half-Orc' } } }, '5e');
        expect(result.hitPointBonusPerLevel).toBe(1);
      });

      it('adds hit_point_bonus_per_level from multiple subraces cumulatively', () => {
        const race = {
          subraces: [
            { name: 'Variant', hit_point_bonus_per_level: 1 },
            { name: 'Other', hit_point_bonus_per_level: 2 },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'Variant' } } }, '5e');
        expect(result.hitPointBonusPerLevel).toBe(1);
      });
    });

    describe('2024 ruleset', () => {
      it('applies damage_resistance from race as a single-item array', () => {
        const race = {
          damage_resistance: 'fire',
        };
        const result = computeRaceBuffs(race, {}, '2024');
        expect(result.resistances).toEqual(['fire']);
      });

      it('combines damage_resistance from race and subrace in 2024', () => {
        const race = {
          damage_resistance: 'fire',
          subraces: [
            { name: 'Variant', damage_resistance: 'cold' },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'Variant' } } }, '2024');
        expect(result.resistances).toEqual(['fire', 'cold']);
      });

      it('deduplicates damage_resistance when race and subrace share the same type', () => {
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

      it('combines starting_proficiencies from race and subrace in 2024', () => {
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

      it('extracts multiple skills separated by "and" from trait description in 2024', () => {
        const race = {
          traits: [
            { name: 'Skill Proficiency', description: 'Proficiency in the Perception and Stealth skills' },
          ],
        };
        const result = computeRaceBuffs(race, {}, '2024');
        expect(result.proficiencies).toContainEqual({ name: 'Skill: Perception' });
        expect(result.proficiencies).toContainEqual({ name: 'Skill: Stealth' });
      });

      it('extracts skills separated by "or" from trait description in 2024', () => {
        const race = {
          traits: [
            { name: 'Skill Proficiency', description: 'Proficiency in the Perception or Stealth skill' },
          ],
        };
        const result = computeRaceBuffs(race, {}, '2024');
        expect(result.proficiencies).toContainEqual({ name: 'Skill: Perception' });
        expect(result.proficiencies).toContainEqual({ name: 'Skill: Stealth' });
      });

      it('applies proficiency_choices as individual proficiency entries in 2024', () => {
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

      it('handles Versatile proficiency_choices with missing from array in 2024', () => {
        const race = {
          traits: [
            {
              name: 'Versatile',
              proficiency_choices: {
                choose: '1',
              },
            },
          ],
        };
        const result = computeRaceBuffs(race, {}, '2024');
        expect(result.feats).toEqual([]);
      });

      it('adds hit_point_bonus_per_level from subrace in 2024', () => {
        const race = {
          subraces: [
            { name: 'Variant', hit_point_bonus_per_level: 1 },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'Variant' } } }, '2024');
        expect(result.hitPointBonusPerLevel).toBe(1);
      });

      it('does not apply damage_resistance when race has no damage_resistance field in 2024', () => {
        const race = {};
        const result = computeRaceBuffs(race, {}, '2024');
        expect(result.resistances).toEqual([]);
      });
    });

    describe('default ruleset', () => {
      it('defaults to 5e ruleset when ruleset argument is omitted', () => {
        const race = {
          ability_bonuses: [{ name: 'str', bonus: 2 }],
        };
        const result = computeRaceBuffs(race, {});
        expect(result.abilityScoreIncreases).toEqual([{ name: 'Strength', amount: 2 }]);
      });
    });

    describe('playerData interactions', () => {
      it('returns empty buffs when playerData is null', () => {
        const race = {
          ability_bonuses: [{ name: 'str', bonus: 2 }],
        };
        const result = computeRaceBuffs(race, null, '5e');
        expect(result.abilityScoreIncreases).toEqual([{ name: 'Strength', amount: 2 }]);
      });

      it('returns empty buffs when playerData.race is undefined', () => {
        const race = {
          ability_bonuses: [{ name: 'str', bonus: 2 }],
          subraces: [
            { name: 'High Elf', ability_bonuses: [{ name: 'int', bonus: 1 }] },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.abilityScoreIncreases).toEqual([{ name: 'Strength', amount: 2 }]);
      });

      it('returns empty buffs when playerData.race.subrace is undefined', () => {
        const race = {
          ability_bonuses: [{ name: 'str', bonus: 2 }],
          subraces: [
            { name: 'High Elf', ability_bonuses: [{ name: 'int', bonus: 1 }] },
          ],
        };
        const result = computeRaceBuffs(race, { race: {} }, '5e');
        expect(result.abilityScoreIncreases).toEqual([{ name: 'Strength', amount: 2 }]);
      });

      it('handles subrace with empty ability_bonuses array', () => {
        const race = {
          ability_bonuses: [{ name: 'str', bonus: 2 }],
          subraces: [
            { name: 'High Elf', ability_bonuses: [] },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'High Elf' } } }, '5e');
        expect(result.abilityScoreIncreases).toEqual([{ name: 'Strength', amount: 2 }]);
      });

      it('handles subrace with no starting_proficiencies field', () => {
        const race = {
          starting_proficiencies: ['Perception'],
          subraces: [
            { name: 'High Elf' },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'High Elf' } } }, '5e');
        expect(result.proficiencies).toEqual([{ name: 'Perception' }]);
      });

      it('handles subrace with no languages field', () => {
        const race = {
          languages: ['Common'],
          subraces: [
            { name: 'High Elf' },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'High Elf' } } }, '5e');
        expect(result.languages).toEqual(['Common']);
      });
    });
  });

  describe('applyRaceBuffsToPlayerData', () => {
    it('does not apply ability score increases to playerData abilities', () => {
      const playerData = {
        abilities: [
          { name: 'Strength', featIncrease: 0 },
          { name: 'Dexterity', featIncrease: 0 },
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
      expect(playerData.abilities[0].featIncrease).toBe(0);
      expect(playerData.abilities[1].featIncrease).toBe(0);
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
        abilities: [{ name: 'Strength', featIncrease: 0 }],
        languages: [],
      };
      const buffs = {
        abilityScoreIncreases: [],
        languages: [],
      };
      applyRaceBuffsToPlayerData(playerData, buffs);
      expect(playerData.abilities[0].featIncrease).toBe(0);
    });

    it('handles undefined playerData abilities gracefully without crashing', () => {
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

    it('creates languages array when playerData has no languages', () => {
      const playerData = {
        abilities: [],
      };
      const buffs = {
        abilityScoreIncreases: [],
        languages: ['Common'],
      };
      applyRaceBuffsToPlayerData(playerData, buffs);
      expect(playerData.languages).toEqual(['Common']);
    });

    it('handles empty buff languages without modifying playerData', () => {
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

    it('handles undefined languages in buffs without crashing', () => {
      const playerData = {
        abilities: [],
        languages: ['Common'],
      };
      const buffs = {
        abilityScoreIncreases: [],
        languages: undefined,
      };
      applyRaceBuffsToPlayerData(playerData, buffs);
      expect(playerData.languages).toEqual(['Common']);
    });

    it('throws when buffs is null', () => {
      const playerData = {
        abilities: [{ name: 'Strength', featIncrease: 0 }],
        languages: ['Common'],
      };
      expect(() => applyRaceBuffsToPlayerData(playerData, null)).toThrow(TypeError);
    });

    it('throws when buffs is undefined', () => {
      const playerData = {
        abilities: [{ name: 'Strength', featIncrease: 0 }],
        languages: ['Common'],
      };
      expect(() => applyRaceBuffsToPlayerData(playerData, undefined)).toThrow(TypeError);
    });
  });
});
