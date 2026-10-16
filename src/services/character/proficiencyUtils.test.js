// @maintained-by-ai
// Unit lane for the shared 5e/2024 proficiency engine (proficiencyUtils.js).
// Pair split: 2024-specific getProficiencyChoiceCount ("Choose N" string parsing,
// majors schema) lives in proficiencyUtils2024.test.js. This file stays on the
// 5e class_levels/proficiency_choices schema. End-to-end pins (e.g. CLA-181
// via rules-proficiencies.implementsOfMercy.test.js) live in the rules/ lane —
// tests here pin the util's own contracts: pool composition, prefix handling,
// and allowed-count arithmetic (consumers pin types only, not the numbers).
import { describe, it, expect } from 'vitest';
import { getProficiencies, getProficiencyChoiceCount } from './proficiencyUtils.js';

describe('proficiencyUtils', () => {
  describe('getProficiencies', () => {
    const defaultConfig = {
      raceProficiencies: () => [],
      bonusSource: null,
    };

    it('builds the skill pool from class, race, and config sources; merges selected skills without inflating the allowance', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Athletics', 'Skill: Perception', 'Light Armor'],
        },
        race: {
          starting_proficiencies: ['Skill: Survival', 'Darkvision'],
        },
        skillProficiencies: ['Stealth', 'Athletics'],
        // playerStats.proficiencies is the non-skill lane — must be ignored here
        proficiencies: ['Skill: Acrobatics'],
      };
      const config = {
        ...defaultConfig,
        raceProficiencies: () => ['Skill: Intimidation'],
      };

      const [allowed, proficiencies] = getProficiencies(playerStats, true, () => 0, config);

      // Exact set: Skill:-prefixed entries stripped, non-skills excluded,
      // deduplicated, sorted; non-skill and un-prefixed entries kept out.
      expect(proficiencies).toEqual(['Athletics', 'Intimidation', 'Perception', 'Stealth', 'Survival']);
      // Allowance = pool at computation time (Athletics, Intimidation, Perception,
      // Survival) + background 2; already-selected Stealth is not re-granted.
      expect(allowed).toBe(6);
    });

    it('accumulates class choice counts, bonus_skill_proficiencies, and bonusSource skill choices into the allowance', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Athletics'],
          proficiency_choices: [
            { choose: 2, from: ['Skill: Acrobatics', 'Skill: Stealth', 'Skill: Perception'] },
          ],
        },
        race: { starting_proficiencies: [] },
        skillProficiencies: [],
      };
      const config = {
        raceProficiencies: () => [],
        bonusSource: {
          bonus_skill_proficiencies: 2,
          proficiency_choices: [
            { choose: 1, from: ['Skill: History', 'Skill: Insight'] },
            { choose: 1, from: ['Tool: Forgery Kit'] },
          ],
        },
      };

      const [allowed, proficiencies] = getProficiencies(playerStats, true, () => 2, config);

      expect(proficiencies).toEqual(['Athletics', 'History', 'Insight']);
      // pool(3) + background(2) + bonus_skill_proficiencies(2) + class choices(2)
      expect(allowed).toBe(9);
    });

    it('merges Skill: prefixed bonus_proficiencies as fixed grants without inflating the allowance (CLA-181 Implements of Mercy)', () => {
      const config = {
        raceProficiencies: () => [],
        bonusSource: {
          bonus_proficiencies: ['Skill: Insight', 'Skill: Medicine', 'Herbalism Kit'],
        },
      };
      const playerStats = {
        class: { proficiencies: [] },
        race: { starting_proficiencies: [] },
        skillProficiencies: ['Religion'],
      };

      const [allowed, proficiencies] = getProficiencies(playerStats, true, () => 0, config);

      expect(proficiencies).toEqual(['Insight', 'Medicine', 'Religion']);
      // Fixed grants must not inflate the selectable allowance (background 2 only)
      expect(allowed).toBe(2);
    });

    it('builds the non-skill pool with dedupe, bonus grants, and allowance computed before selected merges', () => {
      const playerStats = {
        class: {
          proficiencies: ['Light Armor', 'Medium Armor', 'Skill: Athletics'],
        },
        race: {
          starting_proficiencies: ['Light Armor', 'Darkvision'],
        },
        proficiencies: ['Medium Armor', 'Shields'],
      };
      const config = {
        ...defaultConfig,
        bonusSource: { bonus_proficiencies: ['Heavy Armor', 'Skill: Insight'] },
      };

      const [allowed, proficiencies] = getProficiencies(playerStats, false, () => 1, config);

      // Skills excluded (Athletics, Insight), deduped, non-armor grants
      // (Darkvision) pass through, bonus grants merged, already-selected
      // Shields merged last.
      expect(proficiencies).toEqual(['Darkvision', 'Heavy Armor', 'Light Armor', 'Medium Armor', 'Shields']);
      // pool at computation time (4) + class choices stub(1); Shields, merged
      // after the count, is present but not re-granted.
      expect(allowed).toBe(5);
    });

    it('merges background tool proficiencies and tool choices into the non-skill pool', () => {
      const config = {
        ...defaultConfig,
        backgroundToolProficiencies: () => ['Tool: Cook\'s Supplies'],
        backgroundToolProficiencyChoices: () => [
          { choose: 1, from: ['Tool: Alchemist Supplies', 'Tool: Brewer Supplies'] },
        ],
      };
      const playerStats = {
        class: { proficiencies: ['Light Armor'] },
        race: { starting_proficiencies: [] },
        proficiencies: [],
      };

      const [allowed, proficiencies] = getProficiencies(playerStats, false, () => 0, config);

      expect(proficiencies).toEqual([
        'Light Armor',
        'Tool: Alchemist Supplies',
        'Tool: Brewer Supplies',
        'Tool: Cook\'s Supplies',
      ]);
      expect(allowed).toBe(4);
    });

    it('routes bonusSource proficiency_choices to the matching pool for each lane', () => {
      const playerStats = {
        class: { proficiencies: [] },
        race: { starting_proficiencies: [] },
        skillProficiencies: [],
        proficiencies: [],
      };
      const config = {
        raceProficiencies: () => [],
        bonusSource: {
          proficiency_choices: [
            { choose: 1, from: ['Tool: Smith Tools'] },
            { choose: 1, from: ['Skill: Acrobatics', 'Skill: Athletics'] },
          ],
        },
      };

      const [, skillPool] = getProficiencies(playerStats, true, () => 0, config);
      const [, nonSkillPool] = getProficiencies(playerStats, false, () => 0, config);

      expect(skillPool).toEqual(['Acrobatics', 'Athletics']);
      expect(nonSkillPool).toEqual(['Tool: Smith Tools']);
    });

    it.each([
      ['missing class', { skillProficiencies: [] }, defaultConfig],
      ['undefined class', { class: undefined, race: { starting_proficiencies: [] }, skillProficiencies: [] }, defaultConfig],
      ['undefined race', { class: { proficiencies: [] }, skillProficiencies: [] }, defaultConfig],
      ['raceProficiencies returns null', { class: { proficiencies: [] }, race: { starting_proficiencies: [] }, skillProficiencies: [] }, { ...defaultConfig, raceProficiencies: () => null }],
    ])('fails loudly (TypeError) on malformed input: %s', (_label, playerStats, config) => {
      expect(() => getProficiencies(playerStats, true, () => 0, config)).toThrow(TypeError);
    });
  });

  describe('getProficiencyChoiceCount', () => {
    const kitchenSink = (prefix) => ({
      class: {
        proficiency_choices: [
          { choose: 2, from: [`${prefix}Acrobatics`, `${prefix}Stealth`] },
          { choose: 1, from: [`${prefix}Perception`] },
        ],
      },
      race: {
        starting_proficiency_options: { choose: 1, from: [`${prefix}Intimidation`] },
        subrace: {
          racial_traits: [
            { proficiency_choices: { choose: 1, from: [`${prefix}Survival`] } },
          ],
        },
      },
    });

    it('sums matching skill choices from class, race options, and subrace traits; ignores non-matching ones', () => {
      const stats = kitchenSink('Skill: ');
      // A non-skill subrace trait alongside skill traits must be excluded
      stats.race.subrace.racial_traits.push({ proficiency_choices: { choose: 1, from: ['Light Armor'] } });

      expect(getProficiencyChoiceCount(stats, true)).toBe(5);
    });

    it('mirrors the sum for non-skill choices when skills=false', () => {
      const stats = kitchenSink('');
      // A skill-prefixed subrace trait alongside non-skill traits must be excluded
      stats.race.subrace.racial_traits.push({ proficiency_choices: { choose: 1, from: ['Skill: Survival'] } });

      expect(getProficiencyChoiceCount(stats, false)).toBe(5);
    });

    it('returns 0 for empty or zero-choose choices and fails loudly without class/race', () => {
      expect(getProficiencyChoiceCount({ class: {}, race: {} }, true)).toBe(0);
      expect(getProficiencyChoiceCount({ class: {}, race: {} }, false)).toBe(0);
      expect(getProficiencyChoiceCount({
        class: { proficiency_choices: [{ choose: 0, from: ['Skill: Acrobatics'] }] },
        race: {},
      }, true)).toBe(0);
      expect(() => getProficiencyChoiceCount({ race: {} }, true)).toThrow(TypeError);
      expect(() => getProficiencyChoiceCount({ class: {} }, false)).toThrow(TypeError);
    });

    it.each([
      ['class choice missing from', { class: { proficiency_choices: [{ choose: 2 }] }, race: {} }],
      ['class choice empty from', { class: { proficiency_choices: [{ choose: 2, from: [] }] }, race: {} }],
      ['class choice undefined from[0]', { class: { proficiency_choices: [{ choose: 2, from: [undefined] }] }, race: {} }],
      ['race options missing from', { class: {}, race: { starting_proficiency_options: { choose: 1 } } }],
      ['subrace trait empty from', { class: {}, race: { subrace: { racial_traits: [{ proficiency_choices: { choose: 1, from: [] } }] } } }],
    ])('fails loudly (TypeError) on malformed proficiency_choices: %s', (_label, playerStats) => {
      expect(() => getProficiencyChoiceCount(playerStats, true)).toThrow(TypeError);
    });
  });
});
