// @maintained-by-ai
/**
 * LANE (family seam map in 5e-immunities.test.js header, cited not edited):
 * getSenses only — computePassiveSkills merge, Darkvision trait grant,
 * Feral Senses class grant, Blind Fighting → Blindvision, final sort.
 * Other aspects live in 5e-race / -resistances / -immunities / -traits;
 * 2024 mirror is 2024-senses.test.js.
 *
 * CONSUMERS (liveness): rules-senses.js:23 and rulesFactory assign output to
 * playerStats.senses for display + sense checks, so exact entry shapes
 * ({ name, value }) and the final order are the contract; every test pins
 * exact sets, never contain*.
 *
 * 5e-lane facts verified fresh against 5e.js:97-115 (2026-10-16) — do NOT
 * inherit the 2024-senses claims:
 *  - Throws TypeError on missing race/race.traits (unchained .traits.some,
 *    5e.js:101), unlike 2024 which returns [] on {}.
 *  - Final sort is localeCompare (5e.js:114), asymmetric to this ruleset's
 *    ASCII .sort() in immunities/resistances; lowercase 'normal vision'
 *    mid-list in the combine test distinguishes locale from ASCII.
 *  - Darkvision is a HARDcoded '60 ft.' on an EXACT case-sensitive
 *    trait.name match — no description regex, no lineage/120-ft minimum,
 *    no getRuntimeValue channel. DISK anchor: public/data/races.json has
 *    exactly six traits named verbatim 'Darkvision' (Dwarf/Elf/Gnome/
 *    Half-Elf/Half-Orc/Tiefling), all 60 feet — the constant matches disk.
 *  - Shares computePassiveSkills.js, so ANY Wisdom emits BOTH Passive
 *    Perception AND Passive Insight (ability-bonus fallback when the skill
 *    row is missing) and ANY Intelligence emits Passive Investigation —
 *    the old toContain pins hid Insight shadows; exact sets pin them.
 *  - Feral Senses stays 'Feral Senses' with value '' (2024 mints
 *    'Blindsight 30 ft.' instead). class?.fightingStyles and
 *    class?.class_levels ARE optional-chained here (5e.js:110/129).
 *  - computePassiveSkills copies playerStats.senses — input never mutated.
 */
import { describe, it, expect } from 'vitest';
import raceRules from './5e.js';

const DARKVISION_TRAIT = { name: 'Darkvision' }; // verbatim trait name in public/data/races.json

describe('raceRules 5e - getSenses', () => {
  it('input contract: throws on missing race/traits; grants nothing on empty/negative shapes', () => {
    // unchained race.traits.some (5e.js:101) — caller must supply race.traits
    expect(() => raceRules.getSenses({})).toThrow(TypeError);
    expect(() => raceRules.getSenses({ race: {} })).toThrow(TypeError);
    // nothing derivable: no traits, no Wisdom/Intelligence, no Feral/Blind Fighting
    expect(raceRules.getSenses({ senses: [], race: { traits: [] } })).toEqual([]);
    expect(raceRules.getSenses({ senses: [], race: { traits: [] }, abilities: null })).toEqual([]);
    expect(raceRules.getSenses({ senses: [], race: { traits: [] }, abilities: [] })).toEqual([]);
    expect(raceRules.getSenses({
      senses: [],
      race: { traits: [] },
      abilities: [{ name: 'Strength', bonus: 2, skills: [{ name: 'Athletics', bonus: 3 }] }]
    })).toEqual([]);
    expect(raceRules.getSenses({ senses: [], race: { traits: [{ name: 'Other Trait' }] } })).toEqual([]);
    // exact case-sensitive name match: lowercase 'darkvision' grants nothing
    // (2024's description regex lane would match; this lane must not)
    expect(raceRules.getSenses({ senses: [], race: { traits: [{ name: 'darkvision' }] } })).toEqual([]);
    // class channel is optional-chained — every partial shape is inert
    expect(raceRules.getSenses({ senses: [], race: { traits: [] }, class: {} })).toEqual([]);
    expect(raceRules.getSenses({ senses: [], race: { traits: [] }, class: { class_levels: [{ level: 3 }] } })).toEqual([]);
    expect(raceRules.getSenses({ senses: [], race: { traits: [] }, class: { class_levels: [{ features: [{ name: 'Other Feature' }] }] } })).toEqual([]);
    expect(raceRules.getSenses({ senses: [], race: { traits: [] }, class: { fightingStyles: ['Dueling'] } })).toEqual([]);
    // existing senses pass through untouched when nothing is derived
    expect(raceRules.getSenses({ senses: [{ name: 'Normal Vision', value: '60 ft.' }], race: { traits: [] } }))
      .toEqual([{ name: 'Normal Vision', value: '60 ft.' }]);
  });

  it('Darkvision trait grants hardcoded 60 ft.; existing sheet value outranks it, never duplicated', () => {
    expect(raceRules.getSenses({ senses: [], race: { traits: [DARKVISION_TRAIT] } }))
      .toEqual([{ name: 'Darkvision', value: '60 ft.' }]);
    // value is a constant, NOT parsed from text: a 120-ft description still yields 60 ft.
    expect(raceRules.getSenses({
      senses: [],
      race: { traits: [{ name: 'Darkvision', description: 'You can see in dim light within 120 feet.' }] }
    })).toEqual([{ name: 'Darkvision', value: '60 ft.' }]);
    // existing sheet darkvision wins and is not duplicated
    expect(raceRules.getSenses({
      senses: [{ name: 'Darkvision', value: '120 ft.' }],
      race: { traits: [DARKVISION_TRAIT] }
    })).toEqual([{ name: 'Darkvision', value: '120 ft.' }]);
  });

  it('passives via shared computePassiveSkills: skill outranks ability, fallback emits Insight too (exact sets)', () => {
    // skill-bonus path — and Wisdom's Insight still appears via ability
    // fallback even though only Perception/Investigation had skill rows;
    // the old toContain assertions hid this third entry
    expect(raceRules.getSenses({
      senses: [],
      race: { traits: [] },
      abilities: [
        { name: 'Wisdom', bonus: 2, skills: [{ name: 'Perception', bonus: 5 }] },
        { name: 'Intelligence', bonus: 1, skills: [{ name: 'Investigation', bonus: 3 }] },
        { name: 'Charisma', bonus: 4 }
      ]
    })).toEqual([
      { name: 'Passive Insight', value: '12' }, // Wisdom fallback, 10 + 2
      { name: 'Passive Investigation', value: '13' },
      { name: 'Passive Perception', value: '15' } // 10 + 5 skill, not 10 + 2 ability
    ]);
    // missing skills array and empty skills array both fall back to 10 + ability
    // bonus, for BOTH Wisdom passives
    expect(raceRules.getSenses({ senses: [], race: { traits: [] }, abilities: [{ name: 'Wisdom', bonus: 3, skills: [] }] }))
      .toEqual([
        { name: 'Passive Insight', value: '13' },
        { name: 'Passive Perception', value: '13' }
      ]);
    expect(raceRules.getSenses({ senses: [], race: { traits: [] }, abilities: [{ name: 'Wisdom', bonus: 5 }] }))
      .toEqual([
        { name: 'Passive Insight', value: '15' },
        { name: 'Passive Perception', value: '15' }
      ]);
    // skill row present but bonus undefined → treated as 0, not skipped
    expect(raceRules.getSenses({
      senses: [],
      race: { traits: [] },
      abilities: [{ name: 'Intelligence', skills: [{ name: 'Investigation' }] }]
    })).toEqual([{ name: 'Passive Investigation', value: '10' }]);
  });

  it('class channels: Feral Senses → exact 5e shape, Blind Fighting → Blindvision 10 ft., existing values preserved', () => {
    // scans every class_levels entry; 5e keeps the 'Feral Senses' name with
    // an EMPTY value (the 2024 lane mints 'Blindsight 30 ft.' instead)
    expect(raceRules.getSenses({
      senses: [],
      race: { traits: [] },
      class: { class_levels: [{ features: [{ name: 'Other Feature' }] }, { features: [{ name: 'Feral Senses' }] }] }
    })).toEqual([{ name: 'Feral Senses', value: '' }]);
    expect(raceRules.getSenses({
      senses: [{ name: 'Feral Senses', value: '120 ft.' }],
      race: { traits: [] },
      class: { class_levels: [{ features: [{ name: 'Feral Senses' }] }] }
    })).toEqual([{ name: 'Feral Senses', value: '120 ft.' }]);

    expect(raceRules.getSenses({ senses: [], race: { traits: [] }, class: { fightingStyles: ['Blind Fighting'] } }))
      .toEqual([{ name: 'Blindvision', value: '10 ft.' }]);
    expect(raceRules.getSenses({
      senses: [{ name: 'Blindvision', value: '30 ft.' }],
      race: { traits: [] },
      class: { fightingStyles: ['Blind Fighting'] }
    })).toEqual([{ name: 'Blindvision', value: '30 ft.' }]);
  });

  it('combines all channels into one exact set, localeCompare-sorted, input senses never mutated', () => {
    const playerStats = {
      senses: [{ name: 'normal vision', value: '60 ft.' }], // lowercase: ASCII sort would sink this last
      race: { traits: [DARKVISION_TRAIT, { name: 'Other Trait' }] },
      abilities: [{ name: 'Wisdom', bonus: 2, skills: [{ name: 'Perception', bonus: 5 }] }],
      class: {
        fightingStyles: ['Blind Fighting'],
        class_levels: [{ level: 3, features: [{ name: 'Feral Senses' }] }]
      }
    };
    expect(raceRules.getSenses(playerStats)).toEqual([
      { name: 'Blindvision', value: '10 ft.' },
      { name: 'Darkvision', value: '60 ft.' },
      { name: 'Feral Senses', value: '' },
      { name: 'normal vision', value: '60 ft.' },
      { name: 'Passive Insight', value: '12' }, // Wisdom ability-bonus shadow of Perception
      { name: 'Passive Perception', value: '15' }
    ]);
    // server-first state must not be mutated by sense derivation
    expect(playerStats.senses).toEqual([{ name: 'normal vision', value: '60 ft.' }]);
  });
});
