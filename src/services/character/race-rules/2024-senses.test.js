// @maintained-by-ai
/**
 * LANE (family seam map in 2024-immunities.test.js header): getSenses only —
 * computePassiveSkills merge, darkvision/tremorsense trait regex, Feral
 * Senses → Blindsight 30 ft., Blind Fighting → Blindvision 10 ft., and the
 * Elfish(Drow)/Gnomish(Deep Gnome) Darkvision-120 minimum. Other aspects live
 * in 2024-traits / -resistances / -immunities / -race; 5e mirror is 5e-senses.
 *
 * CONSUMERS (liveness): rules-senses.js:11/23 assign output to
 * playerStats.senses for display + sense checks, so exact entry shapes
 * ({ name, value: 'N ft.' | 'N' }) and the final localeCompare sort are the
 * contract; every test pins exact sets, not contain*.
 *
 * RUNTIME SELECTION LANES (CLA-118 analogue of CLA-139 _fiendishLegacySelection):
 * resolveElfishLineage = race.lineage || race.subrace.name || runtime
 * '_elfishLineageSelection'; resolveGnomishLineage = race.lineage || runtime
 * '_gnomishLineageSelection' || race.subrace.name (note the asymmetric order:
 * for elves the sheet subrace outranks runtime, for gnomes runtime outranks
 * subrace). getRuntimeValue is a mutable vi.fn; afterEach mockReset restores
 * the () => null baseline (clearAllMocks would NOT undo mockImplementation).
 *
 * DISK ANCHOR: public/data/2024/races.json (verified 2026-10-16) — trait
 * wording is case-split across species: Elf/Dwarf 'darkvision', Gnome/
 * Tiefling/Aasimar/Orc 'Darkvision'; ranges are 60 ft (most) and 120 ft
 * (Dwarf, Orc). The only disk tremorsense is Dwarf 'Stonecunning' (verbatim,
 * capital T, inside longer Bonus-Action text) — excluded by the name guard,
 * so passive tremorsense fixtures are labeled synthetic. No 2024 disk trait
 * uses shorthand like 'Darkvision 120 ft.' — pinned as a regex non-match.
 * 'Deep Gnome' is app-level (gnomishLineageHandler), absent from races.json.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import raceRules from './2024.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// Mutable runtime-store seam; default null = nothing selected.
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null)
}));

afterEach(() => {
  // Vitest ≥2: mockReset restores the original () => null implementation.
  getRuntimeValue.mockReset();
});

// public/data/2024/races.json — Dwarf > Stonecunning, verbatim. Matches the
// tremorsense regex but must be excluded by the trait-name guard (it is a
// limited-use Bonus Action, not a passive sense).
const DWARF_STONECUNNING = {
  name: 'Stonecunning',
  description: 'As a Bonus Action, you gain Tremorsense with a range of 60 feet for 10 minutes. You must be on a stone surface or touching a stone surface to use this Tremorsense. The stone can be natural or worked.<br/>You can use this Bonus Action a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest.'
};

const darkvision60Trait = { description: 'You have darkvision with a range of 60 feet.' }; // Elf verbatim

describe('raceRules 2024 - getSenses', () => {
  it('returns [] for empty/missing inputs (no senses, race, abilities, class)', () => {
    expect(raceRules.getSenses({})).toEqual([]);
    expect(raceRules.getSenses({ senses: [] })).toEqual([]);
    expect(raceRules.getSenses({ senses: [], race: {} })).toEqual([]);
    expect(raceRules.getSenses({ race: { traits: [] } })).toEqual([]);
    expect(raceRules.getSenses({ senses: [], race: { traits: [] }, abilities: [] })).toEqual([]);
    // abilities present but no Wisdom/Intelligence → no passives derived
    expect(raceRules.getSenses({
      senses: [],
      race: { traits: [] },
      abilities: [{ name: 'Strength', bonus: 2, skills: [] }]
    })).toEqual([]);
    // class present in every partial shape without Feral Senses / Blind Fighting
    expect(raceRules.getSenses({ senses: [], race: { traits: [] }, class: {} })).toEqual([]);
    expect(raceRules.getSenses({ senses: [], race: { traits: [] }, class: { class_levels: [] } })).toEqual([]);
    expect(raceRules.getSenses({ senses: [], race: { traits: [] }, class: { class_levels: [{ level: 18 }] } })).toEqual([]);
    expect(raceRules.getSenses({ senses: [], race: { traits: [] }, class: { fightingStyles: ['Dueling'] } })).toEqual([]);
  });

  it('extracts Darkvision feet from trait text case-insensitively; shorthand does not match (disk-anchored)', () => {
    const cases = [
      // verbatim disk rows: lowercase (Elf/Dwarf), capitalised (Gnome et al.)
      ['You have darkvision with a range of 60 feet.', '60 ft.'],
      ['You have darkvision with a range of 120 feet.', '120 ft.'],
      ['You have Darkvision with a range of 60 feet.', '60 ft.'],
      // distance number is genuinely extracted, not hardcoded
      ['You have darkvision with a range of 90 feet.', '90 ft.']
    ];
    for (const [description, value] of cases) {
      expect(raceRules.getSenses({ senses: [], race: { traits: [{ description }] } }))
        .toEqual([{ name: 'Darkvision', value }]);
    }
    // keyword present but the "with a range of N feet" phrase absent → nothing
    expect(raceRules.getSenses({
      senses: [],
      race: { traits: [{ description: 'Darkvision 120 ft. + Dancing Lights cantrip.' }] }
    })).toEqual([]);
  });

  it('first matching trait wins and existing senses are preserved, never mutated', () => {
    const input = {
      senses: [{ name: 'Normal Vision', value: '60 ft.' }, { name: 'Darkvision', value: '120 ft.' }],
      race: { traits: [darkvision60Trait, { description: 'You have darkvision with a range of 120 feet.' }] }
    };
    // sheet-darkvision outranks traits; traits dedupe first-wins; output sorted
    expect(raceRules.getSenses(input)).toEqual([
      { name: 'Darkvision', value: '120 ft.' },
      { name: 'Normal Vision', value: '60 ft.' }
    ]);
    // input senses untouched (server-first state must not be mutated)
    expect(input.senses).toEqual([
      { name: 'Normal Vision', value: '60 ft.' },
      { name: 'Darkvision', value: '120 ft.' }
    ]);
  });

  it('extracts tremorsense from passive traits but never from Dwarf Stonecunning (disk-anchored)', () => {
    // Stonecunning text matches the regex — the name guard is the only defense
    expect(raceRules.getSenses({ senses: [], race: { traits: [DWARF_STONECUNNING] } })).toEqual([]);
    // synthetic: 2024 disk has no passive-tremorsense trait; number extracted
    expect(raceRules.getSenses({
      senses: [],
      race: { traits: [{ name: 'Burrow Sense', description: 'You have tremorsense with a range of 30 feet.' }] }
    })).toEqual([{ name: 'Tremorsense', value: '30 ft.' }]);
    // first matching trait wins, second ignored
    expect(raceRules.getSenses({
      senses: [],
      race: { traits: [
        { description: 'You have tremorsense with a range of 60 feet.' },
        { description: 'You have tremorsense with a range of 30 feet.' }
      ] }
    })).toEqual([{ name: 'Tremorsense', value: '60 ft.' }]);
  });

  it('computes passives: skill bonus outranks ability bonus, ability-only falls back, exact sorted set', () => {
    // skill-bonus path + unrelated ability contributes nothing
    expect(raceRules.getSenses({
      senses: [],
      race: { traits: [] },
      abilities: [
        { name: 'Wisdom', bonus: 2, skills: [{ name: 'Perception', bonus: 5 }, { name: 'Insight', bonus: 2 }] },
        { name: 'Intelligence', bonus: 1, skills: [{ name: 'Investigation', bonus: 3 }] },
        { name: 'Charisma', bonus: 4 }
      ]
    })).toEqual([
      { name: 'Passive Insight', value: '12' },
      { name: 'Passive Investigation', value: '13' },
      { name: 'Passive Perception', value: '15' } // 10+5 skill, not 10+2 ability
    ]);
    // missing/empty skills array falls back to 10 + ability bonus — for BOTH
    // Wisdom passives (Perception AND Insight), a fact the old contain-based
    // assertions hid
    expect(raceRules.getSenses({
      senses: [],
      race: { traits: [] },
      abilities: [{ name: 'Wisdom', bonus: 3, skills: [] }]
    })).toEqual([
      { name: 'Passive Insight', value: '13' },
      { name: 'Passive Perception', value: '13' }
    ]);
    expect(raceRules.getSenses({
      senses: [],
      race: { traits: [] },
      abilities: [{ name: 'Wisdom', bonus: 5 }]
    })).toEqual([
      { name: 'Passive Insight', value: '15' },
      { name: 'Passive Perception', value: '15' }
    ]);
  });

  it('grants Blindsight 30 ft. for Feral Senses, preserving any existing value', () => {
    const feral = { class_levels: [{ level: 18, features: [{ name: 'Feral Senses' }] }] };
    expect(raceRules.getSenses({ senses: [], race: { traits: [] }, class: feral }))
      .toEqual([{ name: 'Blindsight', value: '30 ft.' }]);
    // existing value wins and is not duplicated (level field is not consulted)
    const result = raceRules.getSenses({
      senses: [{ name: 'Blindsight', value: '60 ft.' }],
      race: { traits: [] },
      class: { class_levels: [{ features: [{ name: 'Feral Senses' }] }] }
    });
    expect(result).toEqual([{ name: 'Blindsight', value: '60 ft.' }]);
  });

  it('grants Blindvision 10 ft. only for the Blind Fighting style, preserving existing', () => {
    expect(raceRules.getSenses({ senses: [], race: { traits: [] }, class: { fightingStyles: ['Blind Fighting'] } }))
      .toEqual([{ name: 'Blindvision', value: '10 ft.' }]);
    expect(raceRules.getSenses({ senses: [{ name: 'Blindvision', value: '30 ft.' }], race: { traits: [] }, class: { fightingStyles: ['Blind Fighting'] } }))
      .toEqual([{ name: 'Blindvision', value: '30 ft.' }]);
    expect(raceRules.getSenses({ senses: [], race: { traits: [] }, class: { fightingStyles: [] } }))
      .toEqual([]);
  });

  it('applies Darkvision minimum 120 ft. for Drow via every resolution channel (CLA-118 order)', () => {
    const channels = [
      // race.lineage upgrades a 60 ft. trait
      [{ race: { traits: [darkvision60Trait], lineage: 'Drow' } }, '120 ft.'],
      // race.lineage with no darkvision trait adds one
      [{ race: { traits: [], lineage: 'Drow' } }, '120 ft.'],
      // sheet subrace is an authoritative channel
      [{ race: { traits: [darkvision60Trait], subrace: { name: 'Drow' } } }, '120 ft.'],
      // runtime fallback when neither lineage nor subrace is set
      [{ race: { traits: [darkvision60Trait] }, name: 'Elowen', campaignName: 'test-campaign' }, '120 ft.']
    ];
    for (const [stats, expected] of channels) {
      getRuntimeValue.mockImplementation((name, key) =>
        key === '_elfishLineageSelection' ? 'Drow' : null);
      const dv = raceRules.getSenses({ senses: [], ...stats }).find((s) => s.name === 'Darkvision');
      expect(dv).toEqual({ name: 'Darkvision', value: expected });
    }
    // CLA-118: sheet subrace outranks a stale runtime 'Drow' selection
    getRuntimeValue.mockImplementation((name, key) =>
      key === '_elfishLineageSelection' ? 'Drow' : null);
    const woodElf = raceRules.getSenses({
      senses: [],
      race: { traits: [darkvision60Trait], subrace: { name: 'Wood Elf' } }
    });
    expect(woodElf).toEqual([{ name: 'Darkvision', value: '60 ft.' }]);
    // minimum never downgrades superior darkvision
    expect(raceRules.getSenses({
      senses: [{ name: 'Darkvision', value: '240 ft.' }],
      race: { traits: [], lineage: 'Drow' }
    })).toEqual([{ name: 'Darkvision', value: '240 ft.' }]);
    // Wood Elf lineage never overrides (negative control)
    expect(raceRules.getSenses({
      senses: [],
      race: { traits: [darkvision60Trait], lineage: 'Wood Elf' }
    })).toEqual([{ name: 'Darkvision', value: '60 ft.' }]);
  });

  it('applies Darkvision minimum 120 ft. for Deep Gnome via lineage, runtime, and subrace channels', () => {
    // 'Deep Gnome' is app-level (gnomishLineageHandler), absent from races.json
    const channels = [
      [{ race: { traits: [darkvision60Trait], lineage: 'Deep Gnome' } }],
      [{ race: { traits: [], lineage: 'Deep Gnome' } }],
      [{ race: { traits: [darkvision60Trait], subrace: { name: 'Deep Gnome' } } }],
      // gnomish order differs from elven: runtime outranks subrace
      [{ race: { traits: [darkvision60Trait], subrace: { name: 'Forest Gnome' } }, name: 'Boddkin', campaignName: 'test-campaign' }]
    ];
    for (const [stats] of channels) {
      getRuntimeValue.mockImplementation((name, key) =>
        key === '_gnomishLineageSelection' ? 'Deep Gnome' : null);
      const dv = raceRules.getSenses({ senses: [], ...stats }).find((s) => s.name === 'Darkvision');
      expect(dv).toEqual({ name: 'Darkvision', value: '120 ft.' });
    }
    // no selection anywhere → no override (restore () => null baseline first)
    getRuntimeValue.mockReset();
    expect(raceRules.getSenses({
      senses: [],
      race: { traits: [darkvision60Trait], subrace: { name: 'Forest Gnome' } }
    })).toEqual([{ name: 'Darkvision', value: '60 ft.' }]);
  });

  it('combines all lanes into one exact, localeCompare-sorted senses list (disk-shaped Dwarf)', () => {
    // order is part of the contract: localeCompare on name
    expect(raceRules.getSenses({
      senses: [{ name: 'Normal Vision', value: '60 ft.' }],
      race: { traits: [
        { name: 'Darkvision', description: 'You have darkvision with a range of 120 feet.' }, // Dwarf verbatim
        DWARF_STONECUNNING
      ] },
      abilities: [{ name: 'Wisdom', bonus: 2, skills: [{ name: 'Perception', bonus: 5 }] }]
    })).toEqual([
      { name: 'Darkvision', value: '120 ft.' },
      { name: 'Normal Vision', value: '60 ft.' },
      { name: 'Passive Insight', value: '12' }, // Wisdom-derived, ability-bonus fallback
      { name: 'Passive Perception', value: '15' }
    ]);
  });
});
