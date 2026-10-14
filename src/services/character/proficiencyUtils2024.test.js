import { describe, it, expect } from 'vitest';
import { getProficiencyChoiceCount } from './proficiencyUtils2024.js';

describe('proficiencyUtils2024', () => {
  describe('getProficiencyChoiceCount', () => {
    describe('class.skill_proficiency_choices parsing', () => {
      it('parses "Choose X" format with single digit', () => {
        const playerStats = {
          class: { skill_proficiency_choices: 'Choose 2' },
          race: {},
        };
        expect(getProficiencyChoiceCount(playerStats, true)).toBe(2);
      });

      it('parses "Choose X" format with multi-digit number', () => {
        const playerStats = {
          class: { skill_proficiency_choices: 'Choose 10' },
          race: {},
        };
        expect(getProficiencyChoiceCount(playerStats, true)).toBe(10);
      });

      it('returns 0 when skill_proficiency_choices is missing or falsy', () => {
        expect(getProficiencyChoiceCount({ class: {}, race: {} }, true)).toBe(0);
        expect(getProficiencyChoiceCount({ class: { skill_proficiency_choices: null }, race: {} }, true)).toBe(0);
        expect(getProficiencyChoiceCount({ class: { skill_proficiency_choices: '' }, race: {} }, true)).toBe(0);
      });

      it('returns 0 for non-matching format', () => {
        const playerStats = {
          class: { skill_proficiency_choices: 'Choose two skills' },
          race: {},
        };
        expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
      });

      it('ignores skill_proficiency_choices when skills=false', () => {
        const playerStats = {
          class: { skill_proficiency_choices: 'Choose 5' },
          race: {},
        };
        expect(getProficiencyChoiceCount(playerStats, false)).toBe(0);
      });
    });

    describe('race.starting_proficiency_options', () => {
      it('counts race starting_proficiency_options for skills when skills=true', () => {
        const playerStats = {
          class: {},
          race: {
            starting_proficiency_options: {
              choose: 2,
              from: ['Skill: Perception', 'Skill: Stealth'],
            },
          },
        };
        expect(getProficiencyChoiceCount(playerStats, true)).toBe(2);
      });

      it('excludes race starting_proficiency_options non-skills when skills=true', () => {
        const playerStats = {
          class: {},
          race: {
            starting_proficiency_options: {
              choose: 2,
              from: ['Light Armor', 'Medium Armor'],
            },
          },
        };
        expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
      });

      it('counts race starting_proficiency_options for non-skills when skills=false', () => {
        const playerStats = {
          class: {},
          race: {
            starting_proficiency_options: {
              choose: 3,
              from: ['Heavy Armor', 'Martial Weapons', 'Shields'],
            },
          },
        };
        expect(getProficiencyChoiceCount(playerStats, false)).toBe(3);
      });

      it('excludes race starting_proficiency_options skills when skills=false', () => {
        const playerStats = {
          class: {},
          race: {
            starting_proficiency_options: {
              choose: 2,
              from: ['Skill: Perception', 'Skill: Stealth'],
            },
          },
        };
        expect(getProficiencyChoiceCount(playerStats, false)).toBe(0);
      });

      it('returns 0 when starting_proficiency_options is missing or null', () => {
        expect(getProficiencyChoiceCount({ class: {}, race: {} }, true)).toBe(0);
        expect(getProficiencyChoiceCount({ class: {}, race: { starting_proficiency_options: null } }, true)).toBe(0);
      });
    });

    describe('race.traits proficiency choices', () => {
      it('counts race trait proficiency choices for skills', () => {
        const playerStats = {
          class: {},
          race: {
            traits: [
              {
                proficiency_choices: {
                  choose: 1,
                  from: ['Skill: Survival'],
                },
              },
            ],
          },
        };
        expect(getProficiencyChoiceCount(playerStats, true)).toBe(1);
      });

      it('excludes race trait non-skill choices when skills=true', () => {
        const playerStats = {
          class: {},
          race: {
            traits: [
              {
                proficiency_choices: {
                  choose: 2,
                  from: ['Heavy Armor', 'Martial Weapons'],
                },
              },
            ],
          },
        };
        expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
      });

      it('counts race trait non-skill choices when skills=false', () => {
        const playerStats = {
          class: {},
          race: {
            traits: [
              {
                proficiency_choices: {
                  choose: 2,
                  from: ['Heavy Armor', 'Martial Weapons'],
                },
              },
            ],
          },
        };
        expect(getProficiencyChoiceCount(playerStats, false)).toBe(2);
      });

      it('returns 0 when race traits are null, undefined, or empty', () => {
        expect(getProficiencyChoiceCount({ class: {}, race: { traits: null } }, true)).toBe(0);
        expect(getProficiencyChoiceCount({ class: {}, race: { traits: undefined } }, true)).toBe(0);
        expect(getProficiencyChoiceCount({ class: {}, race: { traits: [] } }, true)).toBe(0);
      });

      it('returns 0 when race traits lack proficiency_choices', () => {
        expect(getProficiencyChoiceCount({ class: {}, race: { traits: [{ name: 'Darkvision' }] } }, true)).toBe(0);
        expect(getProficiencyChoiceCount({ class: {}, race: { traits: [{ proficiency_choices: null }] } }, true)).toBe(0);
      });

      it('returns 0 when race trait proficiency_choices has empty or missing from', () => {
        expect(getProficiencyChoiceCount({
          class: {},
          race: { traits: [{ proficiency_choices: { choose: 1, from: [] } }] },
        }, true)).toBe(0);
        expect(getProficiencyChoiceCount({
          class: {},
          race: { traits: [{ proficiency_choices: { choose: 1 } }] },
        }, true)).toBe(0);
      });

      it('sums choices from multiple race traits for skills', () => {
        const playerStats = {
          class: {},
          race: {
            traits: [
              {
                proficiency_choices: {
                  choose: 1,
                  from: ['Skill: Survival'],
                },
              },
              {
                proficiency_choices: {
                  choose: 2,
                  from: ['Skill: Perception', 'Skill: Insight'],
                },
              },
            ],
          },
        };
        expect(getProficiencyChoiceCount(playerStats, true)).toBe(3);
      });

      it('handles mixed skill/non-skill choices across multiple traits', () => {
        const playerStats = {
          class: {},
          race: {
            traits: [
              {
                proficiency_choices: {
                  choose: 2,
                  from: ['Skill: Perception'],
                },
              },
              {
                proficiency_choices: {
                  choose: 3,
                  from: ['Heavy Armor', 'Martial Weapons'],
                },
              },
            ],
          },
        };
        expect(getProficiencyChoiceCount(playerStats, true)).toBe(2);
        expect(getProficiencyChoiceCount(playerStats, false)).toBe(3);
      });

      it('handles choose=0 in race trait', () => {
        const playerStats = {
          class: {},
          race: {
            traits: [
              {
                proficiency_choices: {
                  choose: 0,
                  from: ['Skill: Survival'],
                },
              },
            ],
          },
        };
        expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
      });
    });

    describe('class.major proficiency choices (subclass)', () => {
      it('counts subclass proficiency_choices for skills', () => {
        const playerStats = {
          class: {
            major: {
              proficiency_choices: [
                {
                  choose: 2,
                  from: ['Skill: History', 'Skill: Arcana'],
                },
              ],
            },
          },
          race: {},
        };
        expect(getProficiencyChoiceCount(playerStats, true)).toBe(2);
      });

      it('excludes subclass non-skill choices when skills=true', () => {
        const playerStats = {
          class: {
            major: {
              proficiency_choices: [
                {
                  choose: 2,
                  from: ['Heavy Armor', 'Martial Weapons'],
                },
              ],
            },
          },
          race: {},
        };
        expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
      });

      it('counts subclass non-skill choices when skills=false', () => {
        const playerStats = {
          class: {
            major: {
              proficiency_choices: [
                {
                  choose: 2,
                  from: ['Heavy Armor', 'Martial Weapons'],
                },
              ],
            },
          },
          race: {},
        };
        expect(getProficiencyChoiceCount(playerStats, false)).toBe(2);
      });

      it('returns 0 when class.major is null or lacks proficiency_choices', () => {
        expect(getProficiencyChoiceCount({ class: { major: null }, race: {} }, true)).toBe(0);
        expect(getProficiencyChoiceCount({ class: { major: { proficiency_choices: [] } }, race: {} }, true)).toBe(0);
        expect(getProficiencyChoiceCount({ class: { major: { name: 'Battle Master' } }, race: {} }, true)).toBe(0);
      });

      it('returns 0 when subclass proficiency_choices has empty or missing from', () => {
        expect(getProficiencyChoiceCount({
          class: { major: { proficiency_choices: [{ choose: 1, from: [] }] } },
          race: {},
        }, true)).toBe(0);
        expect(getProficiencyChoiceCount({
          class: { major: { proficiency_choices: [{ choose: 1 }] } },
          race: {},
        }, true)).toBe(0);
      });

      it('sums choices from multiple subclass entries', () => {
        const playerStats = {
          class: {
            major: {
              proficiency_choices: [
                { choose: 1, from: ['Skill: History'] },
                { choose: 2, from: ['Skill: Arcana', 'Skill: Nature'] },
              ],
            },
          },
          race: {},
        };
        expect(getProficiencyChoiceCount(playerStats, true)).toBe(3);
      });

      it('handles multiple subclass entries with mixed skill/non-skill', () => {
        const playerStats = {
          class: {
            major: {
              proficiency_choices: [
                { choose: 1, from: ['Skill: History'] },
                { choose: 2, from: ['Heavy Armor', 'Martial Weapons'] },
              ],
            },
          },
          race: {},
        };
        expect(getProficiencyChoiceCount(playerStats, true)).toBe(1);
        expect(getProficiencyChoiceCount(playerStats, false)).toBe(2);
      });
    });

    describe('combined sources', () => {
      it('sums choices from all sources combined for skills', () => {
        const playerStats = {
          class: {
            skill_proficiency_choices: 'Choose 2',
            major: {
              proficiency_choices: [
                {
                  choose: 1,
                  from: ['Skill: Insight'],
                },
              ],
            },
          },
          race: {
            starting_proficiency_options: {
              choose: 1,
              from: ['Skill: Survival'],
            },
            traits: [
              {
                proficiency_choices: {
                  choose: 1,
                  from: ['Skill: Perception'],
                },
              },
            ],
          },
        };
        expect(getProficiencyChoiceCount(playerStats, true)).toBe(5);
      });

      it('sums choices from all sources combined for non-skills', () => {
        const playerStats = {
          class: {
            skill_proficiency_choices: 'Choose 2',
            major: {
              proficiency_choices: [
                {
                  choose: 1,
                  from: ['Heavy Armor'],
                },
              ],
            },
          },
          race: {
            starting_proficiency_options: {
              choose: 1,
              from: ['Medium Armor'],
            },
            traits: [
              {
                proficiency_choices: {
                  choose: 1,
                  from: ['Shields'],
                },
              },
            ],
          },
        };
        expect(getProficiencyChoiceCount(playerStats, false)).toBe(3);
      });

      it('only counts skill sources when skills=true even if non-skill sources exist', () => {
        const playerStats = {
          class: {
            skill_proficiency_choices: 'Choose 2',
            major: {
              proficiency_choices: [
                { choose: 1, from: ['Heavy Armor'] },
              ],
            },
          },
          race: {
            starting_proficiency_options: {
              choose: 1,
              from: ['Medium Armor'],
            },
            traits: [
              {
                proficiency_choices: {
                  choose: 1,
                  from: ['Shields'],
                },
              },
            ],
          },
        };
        expect(getProficiencyChoiceCount(playerStats, true)).toBe(2);
      });
    });

    describe('default skills parameter', () => {
      it('defaults skills to true when not provided', () => {
        const playerStats = {
          class: { skill_proficiency_choices: 'Choose 3' },
          race: {},
        };
        expect(getProficiencyChoiceCount(playerStats)).toBe(3);
      });

      it('defaults skills to true even when non-skill sources exist', () => {
        const playerStats = {
          class: {},
          race: {
            starting_proficiency_options: {
              choose: 2,
              from: ['Heavy Armor'],
            },
          },
        };
        expect(getProficiencyChoiceCount(playerStats)).toBe(0);
      });
    });

    describe('error handling', () => {
      it('throws TypeError when playerStats.class or playerStats.race is null or undefined', () => {
        expect(() => getProficiencyChoiceCount({ race: {} }, true)).toThrow(TypeError);
        expect(() => getProficiencyChoiceCount({ class: null, race: {} }, true)).toThrow(TypeError);
        expect(() => getProficiencyChoiceCount({ class: undefined, race: {} }, true)).toThrow(TypeError);
        expect(() => getProficiencyChoiceCount({ class: {}, race: null }, true)).toThrow(TypeError);
        expect(() => getProficiencyChoiceCount({ class: {}, race: undefined }, true)).toThrow(TypeError);
      });
    });
  });
});
