// @maintained-by-ai
/**
 * 5e-racial-bonus lane (family seam map in ./5e-immunities.test.js header;
 * mirrors ./2024-race.test.js — siblings cited, never edited): owns 5e.js:58-74
 * getRacialBonus only. This lane is a LIVE match contract, not the 2024
 * constant-0 stub (#2042/#2037): it sums matching rows of
 * playerStats.race.ability_bonuses and playerStats.race.subrace.ability_bonuses
 * with loose `==` against the raw ability_score — long names only, since
 * getRace (./5e-race.test.js lane, cited not re-pinned) converts disk
 * abbreviations via the real utils.getAbilityLongName map before this runs.
 *
 * Liveness: NOT dead code (#1916) — sole production caller is abilityCalc.js:12,
 * where it is one additive term of every ability's baseScore
 * (baseScore = base + feat + background + misc + getRacialBonus(...)); it is
 * called with ability.name (long name) and the getRace-merged playerStats.race.
 * abilityCalc.test.js MOCKS this module, so it does not cover the real lookup.
 *
 * FIXTURES anchored to public/data/races.json (verified): Dwarf CON +2 with
 * Hill Dwarf subrace WIS +1 (and Mountain Dwarf STR +2 as the discriminator),
 * Elf DEX +2 with High Elf subrace INT +1, Human +1 to all six. Rows here are
 * the long-name post-getRace shapes of those verbatim disk rows. The
 * same-ability race+subrace stack is labeled SYNTHETIC: no disk race gives
 * bonuses to the same ability in both channels, and the code ADDS (never
 * overrides) — the +3 pins that against an override implementation.
 *
 * MIRROR DELTAs vs 2024-racial-bonus (pinned, do not inherit 2024 claims):
 *  - 5e THROWS TypeError on missing race ({}, no-arg — unchained
 *    playerStats.race access), unlike 2024's constant 0 on every call shape.
 *  - 5e returns real nonzero sums; 2024 is constant 0 with zero ability_bonuses
 *    on 2024 disk.
 *
 * Fully deterministic: no mocks, no spies, no timers, no runtime-store reads,
 * no console noise. Exact values via toBe throughout.
 */
import { describe, it, expect } from 'vitest';
import raceRules from './5e.js';

// public/data/races.json ordering; the names abilityCalc.js:12 passes (ability.name).
const ABILITIES = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];

describe('raceRules 5e - getRacialBonus', () => {
  it('scores disk-anchored races exactly: race channel, subrace-only channel, and 0 for non-matching abilities', () => {
    // races.json Dwarf 'CON' +2 + Hill Dwarf subrace 'WIS' +1, long-named by getRace
    const hillDwarf = {
      race: {
        name: 'Dwarf',
        ability_bonuses: [{ ability_score: 'Constitution', bonus: 2 }],
        subrace: { name: 'Hill Dwarf', ability_bonuses: [{ ability_score: 'Wisdom', bonus: 1 }] }
      }
    };
    expect(raceRules.getRacialBonus(hillDwarf, 'Constitution')).toBe(2); // race row
    expect(raceRules.getRacialBonus(hillDwarf, 'Wisdom')).toBe(1);                     // subrace row
    // discriminator: the OTHER dwarf subrace (Mountain Dwarf, disk 'STR' +2) must not leak in
    expect(raceRules.getRacialBonus(hillDwarf, 'Strength')).toBe(0);
    expect(raceRules.getRacialBonus(hillDwarf, 'Dexterity')).toBe(0);
    expect(raceRules.getRacialBonus(hillDwarf, 'Intelligence')).toBe(0);
    expect(raceRules.getRacialBonus(hillDwarf, 'Charisma')).toBe(0);

    // races.json Elf 'DEX' +2 + High Elf subrace 'INT' +1
    const highElf = {
      race: {
        name: 'Elf',
        ability_bonuses: [{ ability_score: 'Dexterity', bonus: 2 }],
        subrace: { name: 'High Elf', ability_bonuses: [{ ability_score: 'Intelligence', bonus: 1 }] }
      }
    };
    expect(raceRules.getRacialBonus(highElf, 'Dexterity')).toBe(2);
    expect(raceRules.getRacialBonus(highElf, 'Intelligence')).toBe(1);
    expect(raceRules.getRacialBonus(highElf, 'Wisdom')).toBe(0); // Wood Elf's +1 must not leak

    // races.json Human 'STR'..'CHA' +1 each; getRace sets subrace:null when unselected
    const human = {
      race: {
        name: 'Human',
        ability_bonuses: ABILITIES.map((ability_score) => ({ ability_score, bonus: 1 })),
        subrace: null
      }
    };
    for (const ability of ABILITIES) {
      expect(raceRules.getRacialBonus(human, ability)).toBe(1);
    }
  });

  it('adds race and subrace bonuses for the same ability (never overrides)', () => {
    // SYNTHETIC: no disk race hits the same ability in both channels; the code
    // sums (racialBonus += race, += subrace). An override implementation returns 2.
    const stacked = {
      race: {
        ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }],
        subrace: { ability_bonuses: [{ ability_score: 'Strength', bonus: 1 }] }
      }
    };
    expect(raceRules.getRacialBonus(stacked, 'Strength')).toBe(3);
    expect(raceRules.getRacialBonus(stacked, 'Constitution')).toBe(0);
  });

  it('input contract: throws TypeError on missing race (unchained access, unlike the 2024 constant-0 mirror); absent rows score 0; matches long names only', () => {
    expect(() => raceRules.getRacialBonus()).toThrow(TypeError);
    expect(() => raceRules.getRacialBonus({}, 'Strength')).toThrow(TypeError);
    // race present but no bonus rows anywhere (also guards subrace-present-
    // without-ability_bonuses via the truthiness guard) → 0, never undefined
    expect(raceRules.getRacialBonus({ race: {} }, 'Strength')).toBe(0);
    expect(raceRules.getRacialBonus({ race: { ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }] }, subrace: { name: 'High Elf' } }, 'Strength')).toBe(2);
    // seam pin: matching happens on getRace-converted LONG names (5e-race lane);
    // a raw disk abbreviation row must NOT match a long-name query — a future
    // abbreviation-aware or case-insensitive lookup would silently break this contract
    expect(raceRules.getRacialBonus({ race: { ability_bonuses: [{ ability_score: 'CON', bonus: 2 }] } }, 'Constitution')).toBe(0);
    expect(raceRules.getRacialBonus({ race: { ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }] } }, undefined)).toBe(0);
  });
});
