// @maintained-by-ai
/**
 * FAMILY SEAM MAP — race-rules cluster (this file opens the 2024 half).
 * Source: ./2024.js exports { getImmunities, getRace, getRacialBonus,
 * getResistances, getSenses, addTraits, getTraits }. Lane ownership by aspect:
 *  - 2024-immunities (THIS FILE): getImmunities — trait-description regex
 *    /immunity to <type>/i, Trance→'Magical Sleep' (name branch), custom
 *    playerSummary.immunities merge/dedup/sort.
 *  - 2024-race: getRace (lookup, subrace/lineage merge)
 *  - 2024-racial-bonus: getRacialBonus (2024 constant 0)
 *  - 2024-resistances: getResistances (subrace.damage_resistance, Fiendish
 *    Legacy map, "Resistance to X" regex, custom merge)
 *  - 2024-senses: getSenses (darkvision/tremorsense regex, Feral Senses,
 *    Blind Fighting, Elfish/Gnomish lineage 120 ft. overrides)
 *  - 2024-traits: addTraits/getTraits (categorization, sub_traits, subrace)
 *  - 5e-* mirror the same lanes against ./5e.js; index.test.js owns index.js.
 * Do not re-pin another lane's behavior here.
 *
 * INHERITED QUADRANT MAP (proficiency lane #2034): 2024 trait-pool counts →
 * proficiencyUtils2024.test.js; feature-level major choices →
 * majorFeatureChoices.test.js; 5e pool membership → proficiencyUtils.test.js;
 * races.json has NO starting_proficiency_options — stays off-disk here.
 *
 * DISK ANCHOR: public/data/2024/races.json — no 2024 trait description
 * contains the word "immunity" (official 2024 phrasing is "Resistance to"),
 * so the regex fixtures below are labeled synthetic (GM/sheet-supplied text).
 * The only disk-backed immunity is Elf 'Trance' (name branch), pinned
 * verbatim. Discriminating boundary pinned: "immune" ≠ "immunity" guard.
 *
 * CONSUMERS (liveness): rules-senses.js:21 and rulesFactory.js:105 assign
 * output to playerStats.immunities; combat consumers compare case-insensitively
 * (hooks/combat/saveProcessing.js:772, char-sheet MonsterCardBody.jsx:349),
 * so exact strings + deterministic order are the contract. getImmunities never
 * calls getRuntimeValue — no mocks needed; fully deterministic.
 */
import { describe, it, expect } from 'vitest';
import raceRules from './2024.js';

// public/data/2024/races.json — Elf > Trance, verbatim. Note it contains no
// "immunity" keyword, so it must contribute exactly one immunity via name.
const ELF_TRANCE = {
  name: 'Trance',
  description: "You don't need to sleep, and magic can't put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trance-like meditation, during which you retain consciousness."
};

describe('raceRules 2024 - getImmunities', () => {
  it('returns [] when nothing grants an immunity (no race, missing fields, non-immunity text)', () => {
    expect(raceRules.getImmunities({})).toEqual([]);
    expect(raceRules.getImmunities({ race: null })).toEqual([]);
    expect(raceRules.getImmunities({ race: { traits: null } })).toEqual([]);
    // trait with no description field must not throw or contribute
    expect(raceRules.getImmunities({ race: { traits: [{ name: 'Some Trait' }] } })).toEqual([]);
    // descriptions without the keyword (incl. "immune", not matched by guard)
    expect(raceRules.getImmunities({
      race: {
        traits: [
          { description: 'You have darkvision with a range of 60 feet.' },
          { description: 'You are immune to poison damage.' }
        ]
      }
    })).toEqual([]);
  });

  it('extracts the first token after "immunity to", one per trait, case-insensitive (synthetic)', () => {
    // 'poison damage.' boundary: stops before trailing word AND strips period
    // capitalised keyword still extracted, captured case preserved
    const input = {
      race: {
        traits: [
          { description: 'You have immunity to poison damage.' },
          { description: 'You have immunity to charm.' },
          { description: 'You have Immunity to Fire.' }
        ]
      }
    };
    // strings-only path skips deduplicateAndSort; final name-key sort is a
    // no-op, so trait insertion order is the pinned contract
    expect(raceRules.getImmunities(input)).toEqual(['poison', 'charm', 'Fire']);
  });

  it('Elf Trance trait (races.json verbatim) grants exactly Magical Sleep, alone and combined', () => {
    expect(raceRules.getImmunities({ race: { traits: [ELF_TRANCE] } }))
      .toEqual(['Magical Sleep']);
    expect(raceRules.getImmunities({
      race: { traits: [ELF_TRANCE, { description: 'You have immunity to poison.' }] }
    })).toEqual(['Magical Sleep', 'poison']);
  });

  it('merges custom immunities with trait immunities: deduplicates and sorts ASCII (exact set)', () => {
    const input = {
      race: { traits: [{ description: 'You have immunity to poison.' }] },
      immunities: ['poison', 'Zebra', 'Alpha'] // synthetic; 'poison' dup of trait
    };
    // deduplicateAndSort drops the duplicate; default sort is ASCII, so
    // uppercase entries precede lowercase ones — that ordering is the pin
    expect(raceRules.getImmunities(input)).toEqual(['Alpha', 'Zebra', 'poison']);
  });

  it('sorts object immunities by name via the name-key comparator', () => {
    const input = {
      race: { traits: [] },
      immunities: [{ name: 'Zebra' }, { name: 'Alpha' }, { name: 'Middle' }]
    };
    expect(raceRules.getImmunities(input).map((i) => i.name)).toEqual(['Alpha', 'Middle', 'Zebra']);
  });
});
