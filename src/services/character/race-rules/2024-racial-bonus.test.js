// @maintained-by-ai
/**
 * 2024-racial-bonus lane (race-rules cluster, per FAMILY SEAM MAP in
 * ./2024-immunities.test.js): owns ./2024.js:112-116 getRacialBonus —
 * a constant-0 stub ("2024 Rules: No racial ability score bonuses").
 *
 * Liveness: NOT dead code (#1916) — the sole production caller is
 * abilityCalc.js:12, where it is one additive term of every ability's
 * baseScore:
 *   baseScore = base + feat + background + misc + raceRules.getRacialBonus(playerStats, ability.name)
 * Contract pinned here: with a 2024 ruleset selected, that term is exactly 0
 * for every input. Ability-bonus *consumption* plumbing (that the term is
 * wired into baseScore at all) belongs to abilityCalc.test.js, which mocks
 * this module — that mock does not substitute for pinning the real stub.
 *
 * DISK ANCHOR (public/data/2024/races.json, verified): ability_bonuses is
 * absent on ALL 10 species AND every subrace (the +2/+1 spread is applied at
 * character creation, never here); the only on-disk resistance-ish key is
 * damage_resistance (owned by the 2024-resistances lane — cited, not used
 * for assertions beyond shape). Any ability_bonuses fixture below is there-
 * fore labeled SYNTHETIC-LEGACY: built from the 5e spec (5e races.json Human
 * is +1 to all six, abbreviations 'STR'…'CHA').
 *
 * Why the fixture is SYNTHETIC yet DISCRIMINATING: 5e.js:58-75
 * getRacialBonus would return nonzero for these shapes (race+subrace sum =
 * 3 for 'Strength'; 2 and 1 for subraces; long-name 'Strength' matches only
 * after utils.getAbilityLongName maps the disk abbreviation 'STR', see the
 * getRace conversion pinned in ./2024-race.test.js — cited, not re-pinned).
 * A leaked-5e implementation therefore fails here on all six abilities plus
 * both 5e lookup branches, while the 2024 constant stays 0.
 * No spies, no timers, no runtime-store reads (resolveFiendishLegacyName is
 * unreachable from this stub) — fully deterministic.
 */
import { describe, it, expect } from 'vitest';
import raceRules from './2024.js';

// Real ability names as abilityCalc.js:12 passes them (ability.name).
const ABILITIES = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];

describe('raceRules 2024 - getRacialBonus', () => {
  it('is exactly 0 for all six abilities even when a synthetic-legacy 5e shape (which 5e.js scores nonzero) is supplied', () => {
    // SYNTHETIC-LEGACY fixture: 5e races.json Human (+1 all six, but with
    // a +2 race entry and a +1 subrace entry so a leaked 5e sum would be
    // 3) — 5e.js:58-75 matches race AND subrace for 'Strength'.
    const leaked5eShape = {
      race: {
        name: 'Human',
        ability_bonuses: [
          { ability_score: 'Strength', bonus: 2 },
          { ability_score: 'Dexterity', bonus: 1 }
        ],
        subrace: { ability_bonuses: [{ ability_score: 'Strength', bonus: 1 }] }
      }
    };
    for (const ability of ABILITIES) {
      expect(raceRules.getRacialBonus(leaked5eShape, ability)).toBe(0);
    }
  });

  it('is exactly 0 for every call shape abilityCalc.js can present, without throwing', () => {
    // Zero-arg and null/empty summaries (getRace not-found passthrough).
    expect(raceRules.getRacialBonus()).toBe(0);
    expect(raceRules.getRacialBonus(null, 'Strength')).toBe(0);
    expect(raceRules.getRacialBonus({}, 'Strength')).toBe(0);
    expect(raceRules.getRacialBonus({ race: undefined }, undefined)).toBe(0);
    // Disk-verbatim 2024 shape: real Dwarf entry (damage_resistance:'Poison',
    // ability_bonuses absent), plus the real Elf subrace 'High Elf' standing
    // in for a merged subrace — still no ability_bonuses anywhere on disk.
    expect(raceRules.getRacialBonus({ race: { name: 'Dwarf', damage_resistance: 'Poison' } }, 'Constitution')).toBe(0);
    expect(raceRules.getRacialBonus({ race: { name: 'Elf', subrace: { name: 'High Elf' } } }, 'Intelligence')).toBe(0);
  });
});
