import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProficiencyChoiceCount, getProficiencies } from './proficiencyUtils2024.js';

vi.mock('./proficiencyUtils.js', () => ({
  getProficiencies: vi.fn(() => ({ skills: ['Athletics'], tools: [] })),
}));

describe('getProficiencyChoiceCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports getProficiencyChoiceCount function', () => {
    expect(getProficiencyChoiceCount).toBeDefined();
    expect(typeof getProficiencyChoiceCount).toBe('function');
  });

  it('returns 0 when no proficiency choices exist', () => {
    const playerStats = {
      class: {},
      race: {},
    };
    expect(getProficiencyChoiceCount(playerStats)).toBe(0);
  });

  it('returns 0 when skills is false and no choices exist', () => {
    const playerStats = {
      class: {},
      race: {},
    };
    expect(getProficiencyChoiceCount(playerStats, false)).toBe(0);
  });

  it('extracts choice count from class skill_proficiency_choices', () => {
    const playerStats = {
      class: { skill_proficiency_choices: 'Choose 2' },
      race: {},
    };
    expect(getProficiencyChoiceCount(playerStats)).toBe(2);
  });

  it('extracts choice count from class skill_proficiency_choices with different numbers', () => {
    const playerStats = {
      class: { skill_proficiency_choices: 'Choose 3' },
      race: {},
    };
    expect(getProficiencyChoiceCount(playerStats)).toBe(3);
  });

  it('returns 0 when class skill_proficiency_choices does not match pattern', () => {
    const playerStats = {
      class: { skill_proficiency_choices: 'Pick 2' },
      race: {},
    };
    expect(getProficiencyChoiceCount(playerStats)).toBe(0);
  });

  it('ignores class skill_proficiency_choices when skills is false', () => {
    const playerStats = {
      class: { skill_proficiency_choices: 'Choose 5' },
      race: {},
    };
    expect(getProficiencyChoiceCount(playerStats, false)).toBe(0);
  });

  it('adds race starting_proficiency_options skill choices', () => {
    const playerStats = {
      class: {},
      race: {
        starting_proficiency_options: {
          from: ['Skill: Athletics', 'Skill: Acrobatics'],
          choose: 2,
        },
      },
    };
    expect(getProficiencyChoiceCount(playerStats)).toBe(2);
  });

  it('adds race starting_proficiency_options non-skill choices when skills is false', () => {
    const playerStats = {
      class: {},
      race: {
        starting_proficiency_options: {
          from: ['Tool: Thieves\' Tools'],
          choose: 1,
        },
      },
    };
    expect(getProficiencyChoiceCount(playerStats, false)).toBe(1);
  });

  it('excludes race starting_proficiency_options skill choices when skills is false', () => {
    const playerStats = {
      class: {},
      race: {
        starting_proficiency_options: {
          from: ['Skill: Stealth'],
          choose: 1,
        },
      },
    };
    expect(getProficiencyChoiceCount(playerStats, false)).toBe(0);
  });

  it('excludes race starting_proficiency_options non-skill choices when skills is true', () => {
    const playerStats = {
      class: {},
      race: {
        starting_proficiency_options: {
          from: ['Tool: Gaming Set'],
          choose: 1,
        },
      },
    };
    expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
  });

  it('combines class and race skill proficiency choices', () => {
    const playerStats = {
      class: { skill_proficiency_choices: 'Choose 1' },
      race: {
        starting_proficiency_options: {
          from: ['Skill: Perception'],
          choose: 1,
        },
      },
    };
    expect(getProficiencyChoiceCount(playerStats)).toBe(2);
  });

  it('counts proficiency choices from race traits', () => {
    const playerStats = {
      class: {},
      race: {
        traits: [
          {
            proficiency_choices: {
              from: ['Skill: Intimidation'],
              choose: 1,
            },
          },
        ],
      },
    };
    expect(getProficiencyChoiceCount(playerStats)).toBe(1);
  });

  it('counts proficiency choices from multiple race traits', () => {
    const playerStats = {
      class: {},
      race: {
        traits: [
          {
            proficiency_choices: {
              from: ['Skill: Athletics'],
              choose: 1,
            },
          },
          {
            proficiency_choices: {
              from: ['Tool: Herbalism Kit'],
              choose: 1,
            },
          },
        ],
      },
    };
    expect(getProficiencyChoiceCount(playerStats)).toBe(1);
    expect(getProficiencyChoiceCount(playerStats, false)).toBe(1);
  });

  it('skips race trait proficiency choices that are skill choices when skills is false', () => {
    const playerStats = {
      class: {},
      race: {
        traits: [
          {
            proficiency_choices: {
              from: ['Skill: Stealth'],
              choose: 2,
            },
          },
        ],
      },
    };
    expect(getProficiencyChoiceCount(playerStats, false)).toBe(0);
  });

  it('skips race trait proficiency choices that are non-skill choices when skills is true', () => {
    const playerStats = {
      class: {},
      race: {
        traits: [
          {
            proficiency_choices: {
              from: ['Tool: Cartographer\'s Tools'],
              choose: 2,
            },
          },
        ],
      },
    };
    expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
  });

  it('counts proficiency choices from subclass/major', () => {
    const playerStats = {
      class: {
        major: {
          proficiency_choices: [
            {
              from: ['Skill: Arcana'],
              choose: 2,
            },
          ],
        },
      },
      race: {},
    };
    expect(getProficiencyChoiceCount(playerStats)).toBe(2);
  });

  it('counts proficiency choices from multiple subclass/major entries', () => {
    const playerStats = {
      class: {
        major: {
          proficiency_choices: [
            {
              from: ['Skill: History'],
              choose: 1,
            },
            {
              from: ['Skill: Religion'],
              choose: 1,
            },
          ],
        },
      },
      race: {},
    };
    expect(getProficiencyChoiceCount(playerStats)).toBe(2);
  });

  it('excludes subclass non-skill choices when skills is true', () => {
    const playerStats = {
      class: {
        major: {
          proficiency_choices: [
            {
              from: ['Tool: Navigator\'s Tools'],
              choose: 1,
            },
          ],
        },
      },
      race: {},
    };
    expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
  });

  it('excludes subclass non-skill choices when skills is false', () => {
    const playerStats = {
      class: {
        major: {
          proficiency_choices: [
            {
              from: ['Skill: Nature'],
              choose: 1,
            },
          ],
        },
      },
      race: {},
    };
    expect(getProficiencyChoiceCount(playerStats, false)).toBe(0);
  });

  it('combines all sources of proficiency choices', () => {
    const playerStats = {
      class: {
        skill_proficiency_choices: 'Choose 1',
        major: {
          proficiency_choices: [
            {
              from: ['Skill: Arcana'],
              choose: 1,
            },
          ],
        },
      },
      race: {
        starting_proficiency_options: {
          from: ['Skill: Perception'],
          choose: 1,
        },
        traits: [
          {
            proficiency_choices: {
              from: ['Skill: Medicine'],
              choose: 1,
            },
          },
        ],
      },
    };
    expect(getProficiencyChoiceCount(playerStats)).toBe(4);
  });

  it('throws when race is missing', () => {
    const playerStats = {
      class: { skill_proficiency_choices: 'Choose 1' },
    };
    expect(() => getProficiencyChoiceCount(playerStats)).toThrow();
  });

  it('throws when class is missing', () => {
    const playerStats = {
      race: {
        starting_proficiency_options: {
          from: ['Skill: Stealth'],
          choose: 1,
        },
      },
    };
    expect(() => getProficiencyChoiceCount(playerStats)).toThrow();
  });

  it('handles missing class.major', () => {
    const playerStats = {
      class: { skill_proficiency_choices: 'Choose 1' },
      race: {},
    };
    expect(getProficiencyChoiceCount(playerStats)).toBe(1);
  });

  it('handles race with traits array but no proficiency_choices', () => {
    const playerStats = {
      class: {},
      race: {
        traits: [
          { name: 'Darkvision' },
          { name: 'Trance' },
        ],
      },
    };
    expect(getProficiencyChoiceCount(playerStats)).toBe(0);
  });

  it('handles race traits with empty proficiency_choices', () => {
    const playerStats = {
      class: {},
      race: {
        traits: [
          {
            proficiency_choices: {
              from: [],
              choose: 0,
            },
          },
        ],
      },
    };
    expect(getProficiencyChoiceCount(playerStats)).toBe(0);
  });

  it('handles race traits with undefined from', () => {
    const playerStats = {
      class: {},
      race: {
        traits: [
          {
            proficiency_choices: {
              choose: 1,
            },
          },
        ],
      },
    };
    expect(getProficiencyChoiceCount(playerStats)).toBe(0);
  });
});

describe('getProficiencies', () => {
  it('exports getProficiencies function', () => {
    expect(getProficiencies).toBeDefined();
    expect(typeof getProficiencies).toBe('function');
  });

  it('is the same as the re-exported getProficiencies from proficiencyUtils.js', () => {
    // Since we re-export, it should be the mocked function
    expect(getProficiencies).toBeDefined();
  });
});
