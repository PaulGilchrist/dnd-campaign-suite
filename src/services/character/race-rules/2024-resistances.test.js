// @maintained-by-ai
/**
 * Lane: getResistances (2024.js) per FAMILY SEAM MAP in 2024-immunities.test.js —
 * subrace.damage_resistance, Fiendish Legacy map + runtime refinement (CLA-139),
 * "Resistance to X" regex, custom playerSummary.resistances merge. Do not re-pin
 * other lanes here.
 *
 * DISK ANCHOR: public/data/2024/races.json (2024 phrasing IS "Resistance to", so
 * this lane is regex-native — unlike the immunities lane). Verbatim rows used:
 * Dragonborn subrace damage_resistance strings (singular field; disk never uses
 * 'resistances'), Dwarf race-level 'Poison' (which the code IGNORES — it reads
 * subrace.damage_resistance only; the Dwarf value flows via the trait regex),
 * Dwarf 'Dwarven Resilience', Dragonborn 'Damage Resistance' (the 'the' guard's
 * disk reason), Aasimar 'Celestial Resistance' (single-token regex limitation),
 * Tiefling 'Fiendish Legacies' table + Abyssal/Chthonic/Infernal subrace rows.
 *
 * CONSUMERS (liveness): rules-senses.js and rulesFactory.js assign output to
 * playerStats.resistances; damageUtils.js consumes it for damage application —
 * so exact strings + deterministic order are the contract (exact-set toEqual).
 * utils.js is NOT called by getResistances (no mock). getRuntimeValue is only
 * consulted for a Tiefling with no subrace (sheet chooser refinement).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import raceRules from './2024.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null)
}));

// public/data/2024/races.json — verbatim trait descriptions
const DWARVEN_RESILIENCE = {
  name: 'Dwarven Resilience',
  description: 'You have Resistance to Poison damage. You also have Advantage on saving throws you make to avoid or end the Poisoned condition.'
};
const DRAGONBORN_DAMAGE_RESISTANCE = {
  name: 'Damage Resistance',
  description: 'You have Resistance to the damage type determined by your Draconic Ancestry trait.'
};
const CELESTIAL_RESISTANCE = {
  name: 'Celestial Resistance',
  description: 'You have Resistance to Necrotic damage and Radiant damage.'
};
// First table cell is Abyssal→"Resistance to Poison damage." — the regex would
// leak 'Poison' for an unresolved legacy if the skip branch didn't fire.
const FIENDISH_LEGACIES_TABLE = {
  name: 'Fiendish Legacies',
  description: "<table  class='table table-condensed table-striped table-hover'><caption>Fiendish Legacies</caption><thead><tr><th>Legacy</th><th>Level 1</th><th>Level 3</th><th>Level 5</th></tr></thead><tbody><tr><td>Abyssal</td><td>You have Resistance to Poison damage."
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('raceRules 2024 - getResistances', () => {
  it('returns [] for empty and malformed input (no race, null traits/resistances, trait text with no keyword)', () => {
    expect(raceRules.getResistances({})).toEqual([]);
    expect(raceRules.getResistances({ race: null })).toEqual([]);
    expect(raceRules.getResistances({ race: { traits: null } })).toEqual([]);
    expect(raceRules.getResistances({ race: { name: 'Human', subrace: undefined } })).toEqual([]);
    expect(raceRules.getResistances({ race: { traits: [{ name: 'Some Trait' }] } })).toEqual([]);
    expect(raceRules.getResistances({ race: { traits: [] }, resistances: null })).toEqual([]);
    // noise trait (no keyword) contributes nothing
    expect(raceRules.getResistances({
      race: { traits: [{ description: 'You have darkvision with a range of 60 feet.' }] }
    })).toEqual([]);
    // race-level damage_resistance (Dwarf, races.json) is NOT the channel —
    // only subrace.damage_resistance is read
    expect(raceRules.getResistances({ race: { damage_resistance: 'Poison' } })).toEqual([]);
  });

  it('Dwarf "Dwarven Resilience" (verbatim) extracts Poison, skipping the "the" token from Dragonborn text', () => {
    expect(raceRules.getResistances({ race: { traits: [DWARVEN_RESILIENCE] } }))
      .toEqual(['Poison']);
    // verbatim Dragonborn trait matches the regex on "the" — the guard must drop it
    expect(raceRules.getResistances({ race: { traits: [DRAGONBORN_DAMAGE_RESISTANCE] } }))
      .toEqual([]);
  });

  it('extracts subrace damage_resistance (singular field, races.json verbatim rows)', () => {
    const dragonbornRows = [
      ['Black Dragonborn', 'Acid'],
      ['Red Dragonborn', 'Fire'],
      ['White Dragonborn', 'Cold']
    ];
    for (const [name, dr] of dragonbornRows) {
      expect(raceRules.getResistances({
        race: { name: 'Dragonborn', subrace: { name, damage_resistance: dr }, traits: [DRAGONBORN_DAMAGE_RESISTANCE] }
      })).toEqual([dr]);
    }
  });

  it('Aasimar "Celestial Resistance" (verbatim): regex captures only the first token after "Resistance to"', () => {
    // Known single-token limitation pinned: 'Radiant' in the same sentence is
    // NOT extracted (no second "Resistance to"), so the contract is exact ['Necrotic'].
    expect(raceRules.getResistances({ race: { traits: [CELESTIAL_RESISTANCE] } }))
      .toEqual(['Necrotic']);
  });

  it('combines subrace, trait, and custom sources: case-insensitive keyword, dedup, ASCII sort', () => {
    const input = {
      race: {
        subrace: { name: 'Red Dragonborn', damage_resistance: 'Fire' },
        traits: [
          DWARVEN_RESILIENCE, // 'Poison'
          { description: 'You have resistance to cold.' } // lowercase keyword still matches; case preserved
        ]
      },
      resistances: ['cold', 'Acid'] // 'cold' duplicates the trait hit
    };
    // deduplicateAndSort drops the dup; default sort is ASCII, so uppercase
    // entries precede lowercase — that ordering is the contract
    expect(raceRules.getResistances(input)).toEqual(['Acid', 'Fire', 'Poison', 'cold']);
  });

  it('Tiefling Fiendish Legacy: subrace row wins, table is skipped when resolved, sheet chooser refines when not', () => {
    const tieflingRows = [
      [{ name: 'Abyssal Tiefling', damage_resistance: 'Poison' }, 'Poison'],
      [{ name: 'Chthonic Tiefling', damage_resistance: 'Necrotic' }, 'Necrotic'],
      [{ name: 'Infernal Tiefling', damage_resistance: 'Fire' }, 'Fire']
    ];
    for (const [subrace, expected] of tieflingRows) {
      // exactly ONE entry: subrace dr + legacy-map dedup, and verbatim table
      // skipped (an unguarded table regex would leak a second 'Poison' for Abyssal)
      expect(raceRules.getResistances({
        race: { name: 'Tiefling', subrace, traits: [FIENDISH_LEGACIES_TABLE] }
      })).toEqual([expected]);
    }

    // No subrace: runtime '_fiendishLegacySelection' drives the resistance (CLA-139)
    getRuntimeValue.mockReturnValueOnce('Chthonic');
    expect(raceRules.getResistances({
      name: 'Zara',
      campaignName: 'test-campaign',
      race: { name: 'Tiefling', traits: [FIENDISH_LEGACIES_TABLE] }
    })).toEqual(['Necrotic']);
  });
});
