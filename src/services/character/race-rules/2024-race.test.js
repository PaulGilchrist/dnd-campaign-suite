// @maintained-by-ai
/**
 * LANE (family seam map in 2024-immunities.test.js header): getRace only —
 * species lookup + merge. This file owns: custom-race fallback, playerSummary
 * override precedence, subrace JSON join (enrich vs raw-preserve), race-level
 * ability_bonuses abbreviation conversion, clone independence from the JSON
 * store. Aspect extraction lives in siblings (2024-traits / -senses /
 * -resistances / -immunities / -racial-bonus); index dispatch in
 * index.test.js. Do not re-pin their behavior here.
 *
 * CONSUMERS (liveness): rulesFactory.js:104 and rules.js:450 assign the
 * result to playerStats.race, which feeds the aspect lanes above — so exact
 * merged shapes are the contract.
 *
 * DEAD-OUTPUT FLAG (#1916, report-not-fix): getRace's selectedLineage
 * attachment (2024.js lineage branch) is unreachable and unconsumed —
 * "sub_traits" appears in ZERO files under public/ and non-test grep for
 * selectedLineage hits only its producer in 2024.js (verified 2026-10-16).
 * Real lineage handling lives in the getTraits/getSenses lanes via runtime
 * selection, so no test here pins the dead branch.
 *
 * DISK ANCHOR: public/data/2024/races.json — subraces exist (Dragonborn >
 * Gold Dragonborn pinned verbatim, full string). No 2024 disk race carries
 * ability_bonuses (2024 retired Racial Ability Score Improvements), so the
 * conversion fixture is labeled synthetic legacy-shape; it uses the REAL
 * utils mapping — the previous identity mock made every ability assertion
 * vacuous. getRace never calls getRuntimeValue, so no mocks are needed at
 * all: fully deterministic.
 */
import { describe, it, expect } from 'vitest';
import raceRules from './2024.js';

// public/data/2024/races.json — Dragonborn > Gold Dragonborn, verbatim.
const GOLD_DRAGONBORN = {
  name: 'Gold Dragonborn',
  description: 'Gold Dragonborn embody nobility and inner fire, inheriting a powerful flame breath and the disciplined, honorable nature of gold dragons.',
  damage_resistance: 'Fire'
};

describe('raceRules 2024 - getRace', () => {
  it('returns playerSummary.race unchanged when race is not in allRaces (custom race)', () => {
    const playerSummary = { race: { name: 'Custom Race' } };
    expect(raceRules.getRace([], playerSummary)).toEqual({ name: 'Custom Race' });
    expect(raceRules.getRace([{ name: 'Human' }], playerSummary)).toEqual({ name: 'Custom Race' });
  });

  it('merges playerSummary fields over a deep clone of the JSON race without touching the source', () => {
    const jsonRace = { name: 'Human', size: 'Medium', speed: 30, traits: [{ name: 'Size' }] };
    const playerSummary = { race: { name: 'Human', customProp: 'sheet' } };

    const result = raceRules.getRace([jsonRace], playerSummary);
    // exact set: sheet overrides on conflict, JSON-only fields survive,
    // no fabricated keys (no subrace/ability_bonuses appear)
    expect(result).toEqual({ name: 'Human', size: 'Medium', speed: 30, traits: [{ name: 'Size' }], customProp: 'sheet' });

    result.customProp = 'mutated';
    result.traits.push({ name: 'extra' });
    expect(jsonRace).toEqual({ name: 'Human', size: 'Medium', speed: 30, traits: [{ name: 'Size' }] });
  });

  it('joins the subrace from JSON onto race.subrace, sheet subrace fields winning (disk-anchored)', () => {
    const allRaces = [{ name: 'Dragonborn', subraces: [GOLD_DRAGONBORN] }];
    const result = raceRules.getRace(allRaces, {
      race: { name: 'Dragonborn', subrace: { name: 'Gold Dragonborn', customProp: 'sheet' } }
    });
    expect(result.subrace).toEqual({ ...GOLD_DRAGONBORN, customProp: 'sheet' });

    // joined subrace is a fresh clone — mutating it must not poison the JSON store
    result.subrace.damage_resistance = 'Cold';
    expect(allRaces[0].subraces[0]).toEqual(GOLD_DRAGONBORN);
  });

  it('preserves subrace exactly as the sheet supplied it when there is nothing to join', () => {
    const allRaces = [{ name: 'Dragonborn', subraces: [GOLD_DRAGONBORN] }];
    // name mismatch: no JSON enrichment, raw sheet subrace survives
    expect(raceRules.getRace(allRaces, { race: { name: 'Dragonborn', subrace: { name: 'Custom Subrace' } } }).subrace)
      .toEqual({ name: 'Custom Subrace' });
    // null subrace: copied through as null, join skipped, no crash
    expect(raceRules.getRace(allRaces, { race: { name: 'Dragonborn', subrace: null } }).subrace).toBeNull();
    // race without subraces property: exact merged shape, nothing fabricated
    expect(raceRules.getRace([{ name: 'Human', size: 'Medium' }], { race: { name: 'Human' } }))
      .toEqual({ name: 'Human', size: 'Medium' });
  });

  it('converts race-level ability_bonuses abbreviations to long names via the real utils map (synthetic legacy shape — no 2024 disk race has ability_bonuses)', () => {
    const result = raceRules.getRace(
      [{ name: 'Legacy Human', ability_bonuses: [{ ability_score: 'STR', bonus: 2 }, { ability_score: 'DEX', bonus: 1 }] }],
      { race: { name: 'Legacy Human' } }
    );
    expect(result.ability_bonuses).toEqual([
      { ability_score: 'Strength', bonus: 2 },
      { ability_score: 'Dexterity', bonus: 1 }
    ]);
  });
});
