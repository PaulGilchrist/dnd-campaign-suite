// @maintained-by-ai
// Lane: 2024-only getProficiencyChoiceCount ("Choose N" string parsing + majors
// schema). Pair split with proficiencyUtils.test.js: the 5e class.proficiency_choices
// and subrace lanes live there — not duplicated here.
// Consumers (liveness verified 2026-10-16): rules-core.js selects this module as `pu`
// for rules==='2024'; rules-proficiencies.js hands pu.getProficiencyChoiceCount to the
// shared proficiencyUtils.getProficiencies as the allowance counter for BOTH lanes
// (skills=true at getProficiencies:63, skills=false at :107). No dead exports.
// Disk anchors are imported verbatim from public/data/2024/{classes,races}.json
// (re-verified 2026-10-16). Shapes NOT on 2024 disk are labeled synthetic fallback
// pins: (a) race.starting_proficiency_options exists only in 5e races.json;
// (b) disk majors nest proficiency_choices inside features[] — that feature-level
// lane is owned by majorFeatureChoices.js / majorFeatureChoices.test.js, this file
// pins only the direct class.major.proficiency_choices fallback branch;
// (c) multi-digit "Choose 10" has no disk exemplar.
import { describe, it, expect } from 'vitest';
import classes2024 from '../../../public/data/2024/classes.json';
import races2024 from '../../../public/data/2024/races.json';
import { getProficiencyChoiceCount } from './proficiencyUtils2024.js';

const diskClass = (name) => classes2024.find((c) => c.name === name);
const diskTrait = (raceName, traitName) => races2024
  .find((r) => r.name === raceName)
  .traits.find((t) => t.name === traitName);

const classOnly = (skillProficiencyChoices) => ({
  class: skillProficiencyChoices === undefined
    ? {}
    : { skill_proficiency_choices: skillProficiencyChoices },
  race: {},
});

describe('proficiencyUtils2024.getProficiencyChoiceCount', () => {
  describe('class.skill_proficiency_choices "Choose N" parsing', () => {
    it.each([
      // Disk verbatim: Druid matches only because digits directly follow "Choose".
      ['Druid verbatim counts its skills, ignores the ": pool" suffix', 'Druid', true, 2],
      // Disk quirk pinned honestly: the regex needs \d+ right after "Choose", so
      // Barbarian/Bard verbatim strings yield 0 — they are NOT counted today.
      ['Barbarian "Choose any 2 from…" is NOT counted (regex needs digits after Choose)', 'Barbarian', true, 0],
      ['Bard "Choose any 3 (see chapter 1)" is NOT counted', 'Bard', true, 0],
      ['the same Druid string contributes nothing to the non-skill lane', 'Druid', false, 0],
    ])('%s', (_label, className, skills, expected) => {
      const playerStats = classOnly(diskClass(className).skill_proficiency_choices);
      expect(getProficiencyChoiceCount(playerStats, skills)).toBe(expected);
    });

    it.each([
      ['multi-digit numbers parse fully (synthetic — no disk exemplar)', 'Choose 10', 10],
      ['missing field', undefined, 0],
      ['null', null, 0],
      ['empty string', '', 0],
    ])('%s', (_label, value, expected) => {
      expect(getProficiencyChoiceCount(classOnly(value), true)).toBe(expected);
    });
  });

  describe('race.starting_proficiency_options (synthetic lane — 2024 races.json carries none)', () => {
    it('routes by the "Skill: " prefix of from[0] in both directions', () => {
      const skillPool = { class: {}, race: { starting_proficiency_options: { choose: 2, from: ['Skill: Perception', 'Skill: Stealth'] } } };
      const armorPool = { class: {}, race: { starting_proficiency_options: { choose: 3, from: ['Heavy Armor', 'Martial Weapons', 'Shields'] } } };

      expect(getProficiencyChoiceCount(skillPool, true)).toBe(2);
      expect(getProficiencyChoiceCount(skillPool, false)).toBe(0);
      expect(getProficiencyChoiceCount(armorPool, false)).toBe(3);
      expect(getProficiencyChoiceCount(armorPool, true)).toBe(0);
    });

    it('is unguarded on from[0] and fails loudly (TypeError) when from is missing or empty', () => {
      // Mirrors the 5e lane pin at proficiencyUtils.test.js:229 — the traits/major
      // lanes below ARE guarded against this; this lane is not. Pinned honestly.
      expect(() => getProficiencyChoiceCount({ class: {}, race: { starting_proficiency_options: { choose: 1 } } }, true)).toThrow(TypeError);
      expect(() => getProficiencyChoiceCount({ class: {}, race: { starting_proficiency_options: { choose: 1, from: [] } } }, false)).toThrow(TypeError);
    });
  });

  describe('race traits proficiency_choices (disk-backed)', () => {
    it('counts Elf Keen Senses as skills only; Human Skillful + Versatile split across lanes; guarded against missing/empty from and choose=0', () => {
      const elf = { class: {}, race: { traits: [diskTrait('Elf', 'Keen Senses')] } };
      expect(getProficiencyChoiceCount(elf, true)).toBe(1);
      expect(getProficiencyChoiceCount(elf, false)).toBe(0);
      // skills defaults to true when the parameter is omitted
      expect(getProficiencyChoiceCount(elf)).toBe(1);

      // Versatile's pool is FEATS (no "Skill: " prefix) — counted as non-skills
      // today (prefix-lane quirk, pinned honestly). Zero-contribution noise rows
      // ride along: trait without proficiency_choices, empty from, choose=0.
      const human = {
        class: {},
        race: {
          traits: [
            diskTrait('Human', 'Skillful'),
            diskTrait('Human', 'Versatile'),
            { name: 'Darkvision' },
            { proficiency_choices: { choose: 1, from: [] } },
            { proficiency_choices: { choose: 0, from: ['Skill: Performance'] } },
          ],
        },
      };
      expect(getProficiencyChoiceCount(human, true)).toBe(1);
      expect(getProficiencyChoiceCount(human, false)).toBe(1);
    });
  });

  describe('class.major.proficiency_choices (synthetic shape — disk majors nest choices in features[], owned by majorFeatureChoices.test.js)', () => {
    it('sums array entries per lane and skips entries with empty or missing from', () => {
      const major = {
        class: { major: { proficiency_choices: [{ choose: 1, from: ['Skill: History'] }, { choose: 2, from: ['Heavy Armor', 'Martial Weapons'] }] } },
        race: {},
      };
      expect(getProficiencyChoiceCount(major, true)).toBe(1);
      expect(getProficiencyChoiceCount(major, false)).toBe(2);

      const guarded = { class: { major: { proficiency_choices: [{ choose: 1, from: [] }, { choose: 1 }] } }, race: {} };
      expect(getProficiencyChoiceCount(guarded, true)).toBe(0);
      expect(getProficiencyChoiceCount(guarded, false)).toBe(0);
    });

    it('returns 0 when major is absent, null, or lacks proficiency_choices', () => {
      expect(getProficiencyChoiceCount({ class: {}, race: {} }, true)).toBe(0);
      expect(getProficiencyChoiceCount({ class: { major: null }, race: {} }, true)).toBe(0);
      expect(getProficiencyChoiceCount({ class: { major: { name: 'Battle Master' } }, race: {} }, true)).toBe(0);
    });
  });

  describe('combined sources', () => {
    it('sums each lane exactly: skills = disk class string + disk trait, non-skills = spo + major', () => {
      const playerStats = {
        class: {
          skill_proficiency_choices: diskClass('Druid').skill_proficiency_choices,
          major: { proficiency_choices: [{ choose: 1, from: ['Tool: Alchemist\'s Supplies'] }] },
        },
        race: {
          starting_proficiency_options: { choose: 2, from: ['Medium Armor', 'Shields'] },
          traits: [diskTrait('Elf', 'Keen Senses')],
        },
      };
      // skills lane: 'Choose 2' + Keen Senses 1; spo/major must NOT leak in.
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(3);
      // non-skill lane: spo 2 + major 1; the class string must NOT leak in.
      expect(getProficiencyChoiceCount(playerStats, false)).toBe(3);
    });
  });

  describe('malformed input', () => {
    it('fails loudly (TypeError) when class or race is missing', () => {
      expect(() => getProficiencyChoiceCount({ race: {} })).toThrow(TypeError);
      expect(() => getProficiencyChoiceCount({ class: {} })).toThrow(TypeError);
      expect(() => getProficiencyChoiceCount({ class: {}, race: null }, false)).toThrow(TypeError);
    });
  });
});
