// @maintained-by-ai 2026-11-27
import { describe, it, expect } from 'vitest';
import { computeRaceBuffs } from './raceBuffService.js';
import races5e from '../../../public/data/races.json';

// Coverage notes (audited 2026-11-27):
// - This file is the sole behavioral home for computeRaceBuffs: consumers
//   (src/config/utils.js, src/hooks/wizard/useWizardAbilities.js,
//   src/components/character-creation/WizardStepAbilities.jsx) all vi.mock it in
//   their own tests, so nothing here is duplicated elsewhere.
// - Dead export unpinned (#1916, re-verified 2026-11-27): applyRaceBuffsToPlayerData
//   has zero production callers (grep across src/ finds none) — its tests were
//   removed. If the export is ever wired back up, mergeDeduplicated dedup/append/
//   create semantics are canonically tested in src/services/shared/buffApplier.test.js.
// - Source dead-branch flag (#1916): raceBuffService.js L111-113 re-pushes a
//   'Trance' trait, but L94 already pushed every trait unconditionally, so the
//   some() guard can never fire. The traits test pins the observable outcome
//   (exactly one Trance entry).
// - Latent source-bug flag (reported, NOT pinned): the addSkillProficiencies2024
//   regex cannot parse serial-comma lists ("Insight, Perception, or Survival
//   skill") — the delimiter class cannot cross the second comma. The only 2024
//   disk row in that shape (Elf "Keen Senses") carries proficiency_choices, so
//   the choices lane ships its options regardless and no live data is lost. Do
//   not pin the broken comma-list outcome; fix the regex instead.

const DEFAULT_BUFFS = {
  abilityScoreIncreases: [],
  proficiencies: [],
  languages: [],
  resistances: [],
  traits: [],
  speed: null,
  hitPointBonusPerLevel: 0,
  feats: [],
};

describe('raceBuffService', () => {
  describe('computeRaceBuffs', () => {
    it('returns the full default envelope when race is null or has no data', () => {
      expect(computeRaceBuffs(null, {})).toEqual(DEFAULT_BUFFS);
      expect(computeRaceBuffs({}, {})).toEqual(DEFAULT_BUFFS);
    });

    it('normalizes 5e ability bonuses: expands shorthands, defaults bonus to 1, skips unnamed entries', () => {
      const race = {
        ability_bonuses: [
          { name: 'str', bonus: 2 },          // shorthand expansion
          { name: 'customStat', bonus: 2 },  // unknown names pass through
          { name: 'dex' },                   // missing bonus defaults to 1
          { name: 'con', bonus: 0 },        // 0 is falsy, defaults to 1
          { ability_score: 'wis', bonus: 3 },// ability_score fallback when name missing
          { bonus: 1 },                      // no name at all: skipped
        ],
      };
      const result = computeRaceBuffs(race, {}, '5e');
      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 2 },
        { name: 'customStat', amount: 2 },
        { name: 'Dexterity', amount: 1 },
        { name: 'Constitution', amount: 1 },
        { name: 'Wisdom', amount: 3 },
      ]);
    });

    it('merges subrace ability bonuses with the race: appends new abilities, sums shared ones', () => {
      const race = {
        ability_bonuses: [{ name: 'str', bonus: 2 }],
        subraces: [
          { name: 'High Elf', ability_bonuses: [{ name: 'int', bonus: 1 }] },
          { name: 'Hill Dwarf', ability_bonuses: [{ name: 'str', bonus: 1 }] },
        ],
      };
      // Different ability: appended as a new entry
      expect(
        computeRaceBuffs(race, { race: { subrace: { name: 'High Elf' } } }, '5e').abilityScoreIncreases
      ).toEqual([
        { name: 'Strength', amount: 2 },
        { name: 'Intelligence', amount: 1 },
      ]);
      // Same ability: summed into the existing entry
      expect(
        computeRaceBuffs(race, { race: { subrace: { name: 'Hill Dwarf' } } }, '5e').abilityScoreIncreases
      ).toEqual([{ name: 'Strength', amount: 3 }]);
      // Unmatched-subrace resolution failures live in the dedicated
      // "subrace cannot be resolved" boundary test below.
    });

    it('applies starting_proficiencies from race and subrace, ruleset-agnostic', () => {
      const race = {
        starting_proficiencies: ['Perception'],
        subraces: [{ name: 'High Elf', starting_proficiencies: ['Stealth'] }],
      };
      const expected = [{ name: 'Perception' }, { name: 'Stealth' }];
      expect(computeRaceBuffs(race, { race: { subrace: { name: 'High Elf' } } }, '5e').proficiencies).toEqual(expected);
      expect(computeRaceBuffs(race, { race: { subrace: { name: 'High Elf' } } }, '2024').proficiencies).toEqual(expected);
    });

    it('deduplicates languages when race and subrace overlap', () => {
      const race = {
        languages: ['Common'],
        subraces: [{ name: 'High Elf', languages: ['Common', 'Elvish'] }],
      };
      const result = computeRaceBuffs(race, { race: { subrace: { name: 'High Elf' } } }, '5e');
      expect(result.languages).toEqual(['Common', 'Elvish']);
    });

    it('passes race traits through exactly once (never double-pushes Trance)', () => {
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

    it('extracts speed from a trait named "Speed" or trait_type "speed", else null', () => {
      expect(computeRaceBuffs({ traits: [{ name: 'Speed', description: '30 feet' }] }, {}, '5e').speed).toBe(30);
      expect(computeRaceBuffs({ traits: [{ trait_type: 'speed', description: '25 feet' }] }, {}, '5e').speed).toBe(25);
      expect(computeRaceBuffs({ traits: [{ name: 'Speed', description: 'varies' }] }, {}, '5e').speed).toBeNull();
      expect(computeRaceBuffs({ traits: [{ name: 'Climbing' }] }, {}, '5e').speed).toBeNull();
    });

    it('extracts 5e resistance types from trait descriptions matching "resistance/resistant to X"', () => {
      const race = {
        traits: [{ name: 'Resistance', description: 'Resistance to fire. Resistant to cold.' }],
      };
      const result = computeRaceBuffs(race, {}, '5e');
      expect(result.resistances).toEqual(['fire', 'cold']);
    });

    it('builds 5e trait proficiencies from proficiencies arrays and the canonical single-object proficiency_choices', () => {
      // Canonical disk shape (public/data/races.json): ONE {choose, from}
      // object per trait — never an array (bug-racebuff-single-object-
      // proficiency-choices-throws retired the array fixture). A choice
      // object without a usable "from" emits nothing (guarded like the
      // 2024 sibling lane).
      const race = {
        traits: [
          { name: 'Skill Proficiency', proficiencies: ['Perception'] },
          { name: 'Skill Choice', proficiency_choices: { choose: 2, from: ['Skill: Stealth', 'Skill: Athletics'] } },
          { name: 'Empty Choice', proficiency_choices: { choose: 1 } },
        ],
      };
      const result = computeRaceBuffs(race, {}, '5e');
      expect(result.proficiencies).toEqual([
        { name: 'Perception' },
        { name: '2 from: Skill: Stealth, Skill: Athletics', isChoice: true, choose: 2, from: ['Skill: Stealth', 'Skill: Athletics'] },
      ]);
    });

    it('regression: real 5e disk rows (Dwarf, Half-Elf) compute without throwing (single-object proficiency_choices)', () => {
      // The live crash face: Dwarf "Tool Proficiency" and Half-Elf "Skill
      // Versatility" carry single-object proficiency_choices; the 5e trait
      // lane used to .forEach them (unhandled TypeError through
      // validateAbilityTotals). The lane must read the rows AS SHIPPED and
      // surface each choice group as one isChoice entry.
      const dwarf = races5e.find(r => r.name === 'Dwarf');
      const halfElf = races5e.find(r => r.name === 'Half-Elf');
      expect(dwarf && halfElf).toBeTruthy();

      const dwarven = computeRaceBuffs(dwarf, {}, '5e');
      const toolChoice = dwarven.proficiencies.find(p => p.isChoice && p.from?.includes("Smith's Tools"));
      expect(toolChoice).toEqual({
        name: '1 from: Smith\'s Tools, Brewer\'s Supplies, Mason\'s Tools',
        isChoice: true,
        choose: 1,
        from: ["Smith's Tools", "Brewer's Supplies", "Mason's Tools"],
      });

      const elven = computeRaceBuffs(halfElf, {}, '5e');
      const skillChoice = elven.proficiencies.find(p => p.isChoice && p.choose === 2);
      expect(skillChoice).toBeTruthy();
      expect(skillChoice.from.length).toBe(18);
      expect(skillChoice.name).toBe(`2 from: ${skillChoice.from.join(', ')}`);
    });

    it('pulls proficiencies and traits from subrace racial_traits', () => {
      const race = {
        subraces: [
          {
            name: 'High Elf',
            racial_traits: [
              { name: 'Cantrip', description: 'You know one cantrip', proficiencies: ['Arcana'] },
            ],
          },
        ],
      };
      const result = computeRaceBuffs(race, { race: { subrace: { name: 'High Elf' } } }, '5e');
      expect(result.proficiencies).toEqual([{ name: 'Arcana' }]);
      expect(result.traits).toEqual([{ name: 'Cantrip', description: 'You know one cantrip' }]);
    });

    it('adds subrace hit_point_bonus_per_level, ruleset-agnostic', () => {
      const race = { subraces: [{ name: 'Half-Orc', hit_point_bonus_per_level: 1 }] };
      const playerData = { race: { subrace: { name: 'Half-Orc' } } };
      expect(computeRaceBuffs(race, playerData, '5e').hitPointBonusPerLevel).toBe(1);
      expect(computeRaceBuffs(race, playerData, '2024').hitPointBonusPerLevel).toBe(1);
    });

    it('applies 2024 damage_resistance from race and subrace with deduplication', () => {
      const resolve = (subResistance) =>
        computeRaceBuffs(
          { damage_resistance: 'fire', subraces: [{ name: 'Variant', damage_resistance: subResistance }] },
          { race: { subrace: { name: 'Variant' } } },
          '2024'
        ).resistances;
      expect(resolve('fire')).toEqual(['fire']);
      expect(resolve('cold')).toEqual(['fire', 'cold']);
    });

    it('parses 2024 skill proficiencies from trait descriptions ("and" and "or" separators)', () => {
      const race = {
        traits: [
          { name: 'Skill Proficiency', description: 'Proficiency in the Perception and Stealth skills' },
          { name: 'Tool Proficiency', description: 'Proficiency in the Perception or Investigation skill' },
        ],
      };
      const result = computeRaceBuffs(race, {}, '2024');
      expect(result.proficiencies).toEqual([
        { name: 'Skill: Perception' },
        { name: 'Skill: Stealth' },
        { name: 'Skill: Perception' },
        { name: 'Skill: Investigation' },
      ]);
    });

    it('expands 2024 proficiency_choices per option and duplicates Versatile options into feats', () => {
      const race = {
        // 2024 never reads ability_bonuses (the ASI lane is ruleset === '5e' only)
        ability_bonuses: [{ name: 'str', bonus: 2 }],
        traits: [
          { name: 'Skillful', proficiency_choices: { choose: '2', from: ['Perception', 'Stealth'] } },
          { name: 'Versatile', proficiency_choices: { choose: '1', from: ['Lucky'] } },
          { name: 'Versatile', proficiency_choices: { choose: '1' } }, // missing "from": guarded, nothing emitted
        ],
      };
      const result = computeRaceBuffs(race, {}, '2024');
      expect(result.abilityScoreIncreases).toEqual([]);
      expect(result.proficiencies).toEqual([
        { name: 'Perception', isChoice: true, choose: '2' },
        { name: 'Stealth', isChoice: true, choose: '2' },
        { name: 'Lucky', isChoice: true, choose: '1' },
      ]);
      // Current behavior: Versatile options land in BOTH proficiencies and feats.
      expect(result.feats).toEqual([{ name: 'Lucky', isChoice: true, choose: '1' }]);
    });

    it('computes race-only buffs when the subrace cannot be resolved', () => {
      const race = {
        ability_bonuses: [{ name: 'str', bonus: 2 }],
        subraces: [{ name: 'High Elf', ability_bonuses: [{ name: 'int', bonus: 1 }] }],
      };
      const raceOnly = [{ name: 'Strength', amount: 2 }];
      // no subrace selected on playerData
      expect(computeRaceBuffs(race, { race: {} }, '5e').abilityScoreIncreases).toEqual(raceOnly);
      // selected subrace does not match any listed subrace
      expect(computeRaceBuffs(race, { race: { subrace: { name: 'Drow' } } }, '5e').abilityScoreIncreases).toEqual(raceOnly);
      // null / undefined playerData (optional chain)
      expect(computeRaceBuffs(race, null, '5e').abilityScoreIncreases).toEqual(raceOnly);
      expect(computeRaceBuffs(race, undefined, '5e').abilityScoreIncreases).toEqual(raceOnly);
      // race lists no subraces at all
      const noSubraces = { ability_bonuses: [{ name: 'str', bonus: 2 }] };
      expect(
        computeRaceBuffs(noSubraces, { race: { subrace: { name: 'High Elf' } } }, '5e').abilityScoreIncreases
      ).toEqual(raceOnly);
    });
  });
});
