import { describe, it, expect } from 'vitest';
import { computeRaceBuffs, applyRaceBuffsToPlayerData } from './raceBuffService.js';

describe('raceBuffService', () => {
  describe('computeRaceBuffs', () => {
    it('returns default result when race is null or empty', () => {
      const nullResult = computeRaceBuffs(null, {});
      expect(nullResult).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        languages: [],
        resistances: [],
        traits: [],
        speed: null,
        hitPointBonusPerLevel: 0,
        feats: [],
      });

      const emptyResult = computeRaceBuffs({}, {});
      expect(emptyResult.abilityScoreIncreases).toEqual([]);
      expect(emptyResult.speed).toBeNull();
      expect(emptyResult.hitPointBonusPerLevel).toBe(0);
    });

    describe('5e ruleset', () => {
      it('maps ability bonus shorthand names to full names and handles edge cases', () => {
        const race = {
          ability_bonuses: [
            { name: 'str', bonus: 2 },
            { name: 'dex', bonus: 1 },
            { name: 'con', bonus: 3 },
            { name: 'customStat', bonus: 2 },
            { bonus: 1 },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.abilityScoreIncreases).toEqual([
          { name: 'Strength', amount: 2 },
          { name: 'Dexterity', amount: 1 },
          { name: 'Constitution', amount: 3 },
          { name: 'customStat', amount: 2 },
        ]);
      });

      it('defaults bonus amount to 1 when bonus is missing or 0', () => {
        const race = {
          ability_bonuses: [
            { name: 'str' },
            { name: 'dex', bonus: 0 },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.abilityScoreIncreases).toEqual([
          { name: 'Strength', amount: 1 },
          { name: 'Dexterity', amount: 1 },
        ]);
      });

      it('falls back to ability_score property when name is missing', () => {
        const race = {
          ability_bonuses: [{ ability_score: 'dex', bonus: 2 }],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.abilityScoreIncreases).toEqual([
          { name: 'Dexterity', amount: 2 },
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

      it('applies starting proficiencies from race and subrace', () => {
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

      it('applies languages from race and deduplicates with subrace overlap', () => {
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

      it('extracts speed from trait with "Speed" name or trait_type "speed"', () => {
        const speedRace = {
          traits: [{ name: 'Speed', description: '30 feet' }],
        };
        expect(computeRaceBuffs(speedRace, {}, '5e').speed).toBe(30);

        const typeRace = {
          traits: [{ trait_type: 'speed', description: '25 feet' }],
        };
        expect(computeRaceBuffs(typeRace, {}, '5e').speed).toBe(25);

        const noNumberRace = {
          traits: [{ name: 'Speed', description: 'varies' }],
        };
        expect(computeRaceBuffs(noNumberRace, {}, '5e').speed).toBeNull();
      });

      it('extracts resistance types from trait description in 5e', () => {
        const race = {
          traits: [
            { name: 'Resistance', description: 'Resistance to fire. Resistant to cold.' },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.resistances).toContain('fire');
        expect(result.resistances).toContain('cold');
      });

      it('extracts proficiencies from trait.proficiencies and proficiency_choices in 5e', () => {
        const race = {
          traits: [
            { name: 'Skill Proficiency', proficiencies: ['Perception'] },
            {
              name: 'Skill Choice',
              proficiency_choices: [
                { choose: '2', from: ['Stealth', 'Athletics'] },
              ],
            },
          ],
        };
        const result = computeRaceBuffs(race, {}, '5e');
        expect(result.proficiencies).toContainEqual({ name: 'Perception' });
        expect(result.proficiencies).toContainEqual({
          name: '2 from: Stealth, Athletics',
          isChoice: true,
          choose: '2',
          from: ['Stealth', 'Athletics'],
        });
      });

      it('handles proficiency_choices with missing or empty from array in 5e', () => {
        const race = {
          traits: [
            {
              name: 'Skill Choice',
              proficiency_choices: [
                { choose: '1' },
                { choose: '1', from: [] },
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
        expect(result.proficiencies).toContainEqual({
          name: '1 from: ',
          isChoice: true,
          choose: '1',
          from: [],
        });
      });

      it('extracts proficiencies and traits from subrace racial_traits in 5e', () => {
        const race = {
          subraces: [
            {
              name: 'High Elf',
              racial_traits: [
                { name: 'Cantrip', proficiencies: ['Arcana'] },
                { name: 'Cantrip', description: 'You can cast one cantrip' },
              ],
            },
          ],
        };
        const result = computeRaceBuffs(race, { race: { subrace: { name: 'High Elf' } } }, '5e');
        expect(result.proficiencies).toContainEqual({ name: 'Arcana' });
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
    });

    describe('2024 ruleset', () => {
      it('applies damage_resistance from race and subrace with deduplication', () => {
        const sameRace = {
          damage_resistance: 'fire',
          subraces: [{ name: 'Variant', damage_resistance: 'fire' }],
        };
        let result = computeRaceBuffs(sameRace, { race: { subrace: { name: 'Variant' } } }, '2024');
        expect(result.resistances).toEqual(['fire']);

        const diffRace = {
          damage_resistance: 'fire',
          subraces: [{ name: 'Variant', damage_resistance: 'cold' }],
        };
        result = computeRaceBuffs(diffRace, { race: { subrace: { name: 'Variant' } } }, '2024');
        expect(result.resistances).toEqual(['fire', 'cold']);
      });

      it('applies starting_proficiencies from race and subrace in 2024', () => {
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
            { name: 'Skill Proficiency', description: 'Proficiency in the Perception and Stealth skills' },
          ],
        };
        const result = computeRaceBuffs(race, {}, '2024');
        expect(result.proficiencies).toContainEqual({ name: 'Skill: Perception' });
        expect(result.proficiencies).toContainEqual({ name: 'Skill: Stealth' });
      });

      it('applies proficiency_choices as individual entries and Versatile as feats in 2024', () => {
        const race = {
          traits: [
            {
              name: 'Skillful',
              proficiency_choices: {
                choose: '2',
                from: ['Perception', 'Stealth'],
              },
            },
            {
              name: 'Versatile',
              proficiency_choices: {
                choose: '1',
                from: ['Lucky'],
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
        expect(result.feats).toContainEqual({
          name: 'Lucky',
          isChoice: true,
          choose: '1',
        });
      });

      it('handles Versatile proficiency_choices with missing or empty from array in 2024', () => {
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
    });

    describe('playerData interactions', () => {
      it('falls back to race-only buffs when subrace is missing or does not match', () => {
        const race = {
          ability_bonuses: [{ name: 'str', bonus: 2 }],
          subraces: [
            { name: 'High Elf', ability_bonuses: [{ name: 'int', bonus: 1 }] },
          ],
        };

        // subrace field missing
        let result = computeRaceBuffs(race, { race: {} }, '5e');
        expect(result.abilityScoreIncreases).toEqual([{ name: 'Strength', amount: 2 }]);

        // subrace name does not match
        result = computeRaceBuffs(race, { race: { subrace: { name: 'Drow' } } }, '5e');
        expect(result.abilityScoreIncreases).toEqual([{ name: 'Strength', amount: 2 }]);

        // subrace has no ability_bonuses
        const emptySubraceRace = {
          ability_bonuses: [{ name: 'str', bonus: 2 }],
          subraces: [{ name: 'High Elf', ability_bonuses: [] }],
        };
        result = computeRaceBuffs(emptySubraceRace, { race: { subrace: { name: 'High Elf' } } }, '5e');
        expect(result.abilityScoreIncreases).toEqual([{ name: 'Strength', amount: 2 }]);

        // subrace missing fields
        const missingFieldsRace = {
          starting_proficiencies: ['Perception'],
          languages: ['Common'],
          subraces: [{ name: 'High Elf' }],
        };
        result = computeRaceBuffs(missingFieldsRace, { race: { subrace: { name: 'High Elf' } } }, '5e');
        expect(result.proficiencies).toEqual([{ name: 'Perception' }]);
        expect(result.languages).toEqual(['Common']);

        // playerData.race without subrace field
        result = computeRaceBuffs(race, { race: { name: 'Elf' } }, '5e');
        expect(result.abilityScoreIncreases).toEqual([{ name: 'Strength', amount: 2 }]);
      });

      it('handles null or undefined playerData', () => {
        const race = {
          ability_bonuses: [{ name: 'str', bonus: 2 }],
          subraces: [
            { name: 'High Elf', ability_bonuses: [{ name: 'int', bonus: 1 }] },
          ],
        };
        let result = computeRaceBuffs(race, null, '5e');
        expect(result.abilityScoreIncreases).toEqual([{ name: 'Strength', amount: 2 }]);

        result = computeRaceBuffs(race, undefined, '5e');
        expect(result.abilityScoreIncreases).toEqual([{ name: 'Strength', amount: 2 }]);
      });
    });
  });

  describe('applyRaceBuffsToPlayerData', () => {
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

    it('creates languages array when playerData has none', () => {
      const playerData = { abilities: [] };
      const buffs = { abilityScoreIncreases: [], languages: ['Common'] };
      applyRaceBuffsToPlayerData(playerData, buffs);
      expect(playerData.languages).toEqual(['Common']);
    });

    it('does not modify playerData when buff languages are empty or undefined', () => {
      const playerData = { abilities: [], languages: ['Common'] };

      applyRaceBuffsToPlayerData(playerData, {
        abilityScoreIncreases: [],
        languages: [],
      });
      expect(playerData.languages).toEqual(['Common']);

      applyRaceBuffsToPlayerData(playerData, {
        abilityScoreIncreases: [],
        languages: undefined,
      });
      expect(playerData.languages).toEqual(['Common']);
    });

    it('throws TypeError when buffs is null or undefined', () => {
      const playerData = { abilities: [], languages: ['Common'] };
      expect(() => applyRaceBuffsToPlayerData(playerData, null)).toThrow(TypeError);
      expect(() => applyRaceBuffsToPlayerData(playerData, undefined)).toThrow(TypeError);
    });

    it('does not mutate abilities when buffs contain ability score increases', () => {
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
        languages: [],
      };
      applyRaceBuffsToPlayerData(playerData, buffs);
      expect(playerData.abilities[0].featIncrease).toBe(0);
      expect(playerData.abilities[1].featIncrease).toBe(0);
    });
  });
});
