// @maintained-by-ai
/**
 * LANE (family seam map in ./5e-immunities.test.js header, mirrored by
 * ./2024-race.test.js — cited, never edited): getRace only — race lookup +
 * subrace join. This file owns: not-found fallback, playerSummary override
 * precedence, subrace JSON join, ability_bonuses abbreviation conversion on
 * BOTH channels, clone independence from the JSON store. Aspect extraction
 * lives in siblings (5e-traits / -senses / -resistances / -immunities /
 * -racial-bonus); index dispatch in index.test.js. Do not re-pin here.
 *
 * MIRROR DELTAS vs 2024-race (pinned, do not inherit 2024 claims):
 *  - 5e returns undefined for an unknown race (no 2024 custom-race
 *    passthrough) and THROWS TypeError when playerSummary.race is missing
 *    and allRaces is non-empty (unchained playerSummary.race.name inside
 *    find's callback; find never runs on an empty allRaces, so no throw).
 *  - unmatched subrace collapses to null (2024 preserves the raw sheet
 *    subrace); race.subraces is deleted from the output.
 *  - join merge source is playerSummary.subrace (top level), NOT
 *    race.subrace — extra fields on race.subrace are dropped at join.
 *  - NO runtime lineage channel in 5e; selectedLineage is a 2024-only
 *    dead-output flag (#1916) with no 5e counterpart.
 *
 * FIXTURES: public/data/races.json — Human (size/speed + ability_bonuses
 * STR..CHA verbatim), Elf > High Elf (verbatim fields; verbose
 * language_options omitted — fixture is a truncated disk row, all values
 * verbatim). No fabricated values.
 *
 * The legacy identity vi.mock of utils.getAbilityLongName (#2036) made every
 * abbreviation assertion vacuous and is REMOVED: the real map ('STR'→
 * 'Strength') is used so assertions discriminate. Fully deterministic — no
 * mocks, no timers, no console noise.
 *
 * CONSUMERS (liveness): rulesFactory.js:104 and rules.js:450 assign the
 * result to playerStats.race, feeding the aspect lanes — exact merged shape
 * is the contract.
 */
import { describe, it, expect } from 'vitest';
import raceRules from './5e.js';

// public/data/races.json — Elf > High Elf, verbatim fields (language_options
// omitted for brevity; every included value verbatim from disk).
const HIGH_ELF = {
  index: 'high-elf',
  name: 'High Elf',
  description: 'As a high elf, you have a keen mind and a mastery of at least the basics of magic. In many fantasy gaming worlds, there are two kinds of high elves. One type is haughty and reclusive, believing themselves to be superior to non-elves and even other elves. The other type is more common and more friendly, and often encountered among humans and other races.',
  ability_bonuses: [{ ability_score: 'INT', bonus: 1 }],
  starting_proficiencies: ['Longswords', 'Shortswords', 'Shortbows', 'Longbows'],
  languages: [],
  racial_traits: [
    {
      index: 'high-elf-cantrip',
      name: 'High Elf Cantrip',
      description: 'You know one cantrip of your choice form the wizard spell list. Intelligence is your spellcasting ability for it.',
      proficiencies: []
    }
  ]
};

const ELF_STORE = [{ name: 'Elf', subraces: [HIGH_ELF] }];

describe('raceRules 5e - getRace', () => {
  it('input contract: throws on missing race with non-empty store (unchained access); unknown race or missing name returns undefined', () => {
    expect(() => raceRules.getRace([{ name: 'Human' }], {})).toThrow(TypeError);
    // find never invokes its callback on an empty store, so nothing throws
    expect(raceRules.getRace([], {})).toBeUndefined();
    expect(raceRules.getRace([], { race: { name: 'Custom Race' } })).toBeUndefined();
    expect(raceRules.getRace([{ name: 'Human' }], { race: {} })).toBeUndefined();
    // mirror delta: 5e gives undefined for custom races, not the raw sheet race
    expect(raceRules.getRace([{ name: 'Human' }], { race: { name: 'Custom Race' } })).toBeUndefined();
  });

  it('merges playerSummary.race over a deep clone of the JSON race: sheet wins on conflict, no fabricated keys, store untouched', () => {
    // public/data/races.json — Human fields verbatim (truncated row)
    const jsonRace = {
      name: 'Human',
      size: 'Medium',
      speed: 30,
      traits: [{
        index: 'naturally-stealthy',
        name: 'Naturally Stealthy',
        description: 'You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you.',
        proficiencies: []
      }]
    };
    const result = raceRules.getRace([jsonRace], {
      race: { name: 'Human', speed: 35, customProp: 'sheet' }
    });
    // exact set: sheet overrides speed, customProp added, JSON-only fields survive
    expect(result).toEqual({
      name: 'Human',
      size: 'Medium',
      speed: 35,
      traits: jsonRace.traits,
      customProp: 'sheet',
      subrace: null
    });

    // deep independence: mutating result must not poison the JSON store
    result.customProp = 'mutated';
    result.traits.push({ name: 'extra' });
    expect(jsonRace).toEqual({
      name: 'Human',
      size: 'Medium',
      speed: 30,
      traits: [{
        index: 'naturally-stealthy',
        name: 'Naturally Stealthy',
        description: 'You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you.',
        proficiencies: []
      }]
    });
  });

  it('joins the subrace from JSON onto race.subrace, playerSummary.subrace fields winning; race.subraces deleted; joined subrace is a fresh clone', () => {
    const result = raceRules.getRace(ELF_STORE, {
      race: { name: 'Elf', subrace: { name: 'High Elf', discarded: 'race.subrace extras are dropped' } },
      subrace: { customProp: 'sheet' }
    });
    // exact set: verbatim JSON subrace (ability_score already converted —
    // the subrace map runs after the join) + sheet overrides from
    // playerSummary.subrace; 'discarded' absent — the join merges
    // cloneDeep(JSON) with cloneDeep(playerSummary.subrace)
    expect(result.subrace).toEqual({ ...HIGH_ELF, ability_bonuses: [{ ability_score: 'Intelligence', bonus: 1 }], customProp: 'sheet' });
    expect(result).not.toHaveProperty('subraces');

    // joined subrace (incl. nested arrays) is a fresh clone — mutating it
    // must not poison the JSON store, whose abbreviations stay raw 'INT'
    result.subrace.ability_bonuses.push({ ability_score: 'Strength', bonus: 1 });
    result.subrace.racial_traits.length = 0;
    expect(ELF_STORE[0].subraces[0]).toEqual(HIGH_ELF);
  });

  it('collapses subrace to null when unselected, name-mismatched, or store has none — never preserving the raw sheet subrace', () => {
    // unselected
    expect(raceRules.getRace(ELF_STORE, { race: { name: 'Elf' } }).subrace).toBeNull();
    // mirror delta: mismatched custom sheet subrace becomes null
    // (2024 preserves { name: 'Custom Subrace' } raw)
    expect(raceRules.getRace(ELF_STORE, { race: { name: 'Elf', subrace: { name: 'Wood Elf' } } }).subrace).toBeNull();
    // race without a subraces property: optional-chained lookup, no crash
    expect(raceRules.getRace([{ name: 'Human' }], { race: { name: 'Human', subrace: { name: 'High Elf' } } }).subrace).toBeNull();
    // empty subraces array
    expect(raceRules.getRace([{ name: 'Elf', subraces: [] }], { race: { name: 'Elf' } }).subrace).toBeNull();
  });

  it('converts ability_bonuses abbreviations to long names via the REAL utils map on both race and subrace channels (disk-anchored; store keeps raw abbreviations)', () => {
    // public/data/races.json — Human ability_bonuses verbatim, real disk row
    const humanBonus = (ability_score) => ({ ability_score, bonus: 1 });
    const humanResult = raceRules.getRace(
      [{ name: 'Human', ability_bonuses: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(humanBonus) }],
      { race: { name: 'Human' } }
    );
    expect(humanResult.ability_bonuses).toEqual(
      ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'].map(humanBonus)
    );

    // subrace channel: disk High Elf INT +1 → Intelligence +1
    const elfResult = raceRules.getRace(ELF_STORE, {
      race: { name: 'Elf', subrace: { name: 'High Elf' } }
    });
    expect(elfResult.subrace.ability_bonuses).toEqual([{ ability_score: 'Intelligence', bonus: 1 }]);
    // conversion mutated clones only — store still holds raw abbreviations
    expect(ELF_STORE[0].subraces[0].ability_bonuses).toEqual([{ ability_score: 'INT', bonus: 1 }]);
  });
});
