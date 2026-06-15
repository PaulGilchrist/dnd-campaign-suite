import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../shared/buffApplier.js', () => ({
  applyAbilityScoreIncreases: vi.fn(),
  mergeDeduplicated: vi.fn(),
}));

import { computeRaceBuffs, applyRaceBuffsToPlayerData } from './raceBuffService.js';
import * as buffApplier from '../shared/buffApplier.js';

// ── Helpers ───────────────────────────────────────────────────────

function makeRace(overrides = {}) {
  return {
    name: 'Dragonborn',
    ability_bonuses: [
      { name: 'str', bonus: 2 },
      { name: 'cha', bonus: 1 },
    ],
    starting_proficiencies: [],
    languages: [],
    traits: [],
    subraces: [],
    ...overrides,
  };
}

function makePlayerData(overrides = {}) {
  return {
    race: { name: 'Dragonborn', subrace: { name: 'Gold Dragon' } },
    abilities: [
      { name: 'Strength', score: 10 },
      { name: 'Dexterity', score: 10 },
      { name: 'Constitution', score: 10 },
      { name: 'Intelligence', score: 10 },
      { name: 'Wisdom', score: 10 },
      { name: 'Charisma', score: 10 },
    ],
    languages: [],
    ...overrides,
  };
}

function resetMocks() {
  buffApplier.applyAbilityScoreIncreases.mockClear();
  buffApplier.mergeDeduplicated.mockClear();
}

// ── computeRaceBuffs — general / null safety ──────────────────────

describe('computeRaceBuffs — null safety', () => {
  beforeEach(resetMocks);

  it('returns default empty result when race is null', () => {
    const result = computeRaceBuffs(null, makePlayerData());

    expect(result).toEqual({
      abilityScoreIncreases: [],
      proficiencies: [],
      languages: [],
      resistances: [],
      traits: [],
      speed: null,
      hitPointBonusPerLevel: 0,
      feats: [],
    });
  });

  it('returns default empty result when race is undefined', () => {
    const result = computeRaceBuffs(undefined, makePlayerData());

    expect(result).toEqual({
      abilityScoreIncreases: [],
      proficiencies: [],
      languages: [],
      resistances: [],
      traits: [],
      speed: null,
      hitPointBonusPerLevel: 0,
      feats: [],
    });
  });

  it('returns default empty result when race is an empty object', () => {
    const result = computeRaceBuffs({}, makePlayerData());

    expect(result.abilityScoreIncreases).toEqual([]);
    expect(result.proficiencies).toEqual([]);
    expect(result.languages).toEqual([]);
    expect(result.resistances).toEqual([]);
    expect(result.traits).toEqual([]);
    expect(result.speed).toBeNull();
    expect(result.hitPointBonusPerLevel).toBe(0);
  });
});

// ── computeRaceBuffs — ability bonuses (5e) ───────────────────────

describe('computeRaceBuffs — ability bonuses (5e)', () => {
  beforeEach(resetMocks);

  it('extracts ability bonuses from race.ability_bonuses for 5e', () => {
    const race = makeRace({
      ability_bonuses: [
        { name: 'str', bonus: 2 },
        { name: 'cha', bonus: 1 },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.abilityScoreIncreases).toEqual([
      { name: 'Strength', amount: 2 },
      { name: 'Charisma', amount: 1 },
    ]);
  });

  it('defaults bonus to 1 when bonus property is missing', () => {
    const race = makeRace({
      ability_bonuses: [
        { name: 'dex' },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.abilityScoreIncreases).toEqual([
      { name: 'Dexterity', amount: 1 },
    ]);
  });

  it('defaults bonus to 1 when bonus is null', () => {
    const race = makeRace({
      ability_bonuses: [
        { name: 'con', bonus: null },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.abilityScoreIncreases).toEqual([
      { name: 'Constitution', amount: 1 },
    ]);
  });

  it('expands abbreviated ability names to full names', () => {
    const race = makeRace({
      ability_bonuses: [
        { name: 'str', bonus: 2 },
        { name: 'dex', bonus: 1 },
        { name: 'con', bonus: 2 },
        { name: 'int', bonus: 1 },
        { name: 'wis', bonus: 2 },
        { name: 'cha', bonus: 1 },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.abilityScoreIncreases.map(i => i.name)).toEqual([
      'Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma',
    ]);
  });

  it('leaves ability names unchanged when already expanded', () => {
    const race = makeRace({
      ability_bonuses: [
        { name: 'Strength', bonus: 2 },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.abilityScoreIncreases).toEqual([
      { name: 'Strength', amount: 2 },
    ]);
  });

  it('does not extract ability bonuses for 2024 ruleset', () => {
    const race = makeRace({
      ability_bonuses: [
        { name: 'str', bonus: 2 },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '2024');

    expect(result.abilityScoreIncreases).toEqual([]);
  });
});

// ── computeRaceBuffs — starting proficiencies ────────────────────

describe('computeRaceBuffs — starting proficiencies', () => {
  beforeEach(resetMocks);

  it('extracts starting_proficiencies from race', () => {
    const race = makeRace({
      starting_proficiencies: ['Light Armor', 'Simple Weapons'],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.proficiencies).toEqual([
      { name: 'Light Armor' },
      { name: 'Simple Weapons' },
    ]);
  });

  it('handles empty starting_proficiencies', () => {
    const race = makeRace({
      starting_proficiencies: [],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.proficiencies).toEqual([]);
  });

  it('handles missing starting_proficiencies', () => {
    const race = makeRace({
      starting_proficiencies: undefined,
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.proficiencies).toEqual([]);
  });
});

// ── computeRaceBuffs — languages ──────────────────────────────────

describe('computeRaceBuffs — languages', () => {
  beforeEach(resetMocks);

  it('extracts languages from race', () => {
    const race = makeRace({
      languages: ['Common', 'Draconic'],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.languages).toEqual(['Common', 'Draconic']);
  });

  it('handles empty languages array', () => {
    const race = makeRace({
      languages: [],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.languages).toEqual([]);
  });

  it('handles missing languages', () => {
    const race = makeRace({
      languages: undefined,
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.languages).toEqual([]);
  });
});

// ── computeRaceBuffs — traits (5e) ───────────────────────────────

describe('computeRaceBuffs — traits (5e)', () => {
  beforeEach(resetMocks);

  it('extracts traits with name and description', () => {
    const race = makeRace({
      traits: [
        { name: 'Draconic Ancestry', description: 'You can speak, read, and write Draconic.' },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.traits).toEqual([
      { name: 'Draconic Ancestry', description: 'You can speak, read, and write Draconic.' },
    ]);
  });

  it('extracts proficiencies from trait.proficiencies', () => {
    const race = makeRace({
      traits: [
        { name: 'Combat Training', description: 'Proficiency with certain weapons.', proficiencies: ['Shortsword', 'Longspear'] },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.proficiencies).toEqual([
      { name: 'Shortsword' },
      { name: 'Longspear' },
    ]);
  });

  it('extracts proficiency choices from trait.proficiency_choices', () => {
    const race = makeRace({
      traits: [
        {
          name: 'Skill Proficiencies',
          description: 'Choose two skills.',
          proficiency_choices: [
            { choose: '2', from: ['Acrobatics', 'Athletics', 'Stealth', 'Sleight of Hand'] },
          ],
        },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.proficiencies).toEqual([
      {
        name: '2 from: Acrobatics, Athletics, Stealth, Sleight of Hand',
        isChoice: true,
        choose: '2',
        from: ['Acrobatics', 'Athletics', 'Stealth', 'Sleight of Hand'],
      },
    ]);
  });

  it('extracts speed from trait description', () => {
    const race = makeRace({
      traits: [
        { name: 'Swimming Speed', description: "You have a swimming speed of 40 feet." },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.speed).toBe(40);
  });

  it('extracts speed with "feet" (plural)', () => {
    const race = makeRace({
      traits: [
        { name: 'Walking Speed', description: "You have a walking speed of 30 feet." },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.speed).toBe(30);
  });

  it('extracts speed with "feet" (singular)', () => {
    const race = makeRace({
      traits: [
        { name: 'Walking Speed', description: "You have a walking speed of 30 feet." },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.speed).toBe(30);
  });

  it('does not extract speed when no number found in description', () => {
    const race = makeRace({
      traits: [
        { name: 'Darkvision', description: 'You can see in dim light within 60 feet.' },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.speed).toBeNull();
  });

  it('extracts resistances from trait description (5e)', () => {
    const race = makeRace({
      traits: [
        { name: 'Resistance', description: 'You have resistance to fire.' },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.resistances).toEqual(['fire']);
  });

  it('extracts resistances with "resistant" keyword', () => {
    const race = makeRace({
      traits: [
        { name: 'Damage Resistance', description: 'You are resistant to cold damage.' },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.resistances).toEqual(['cold']);
  });

  it('does not extract resistances for 2024 ruleset', () => {
    const race = makeRace({
      traits: [
        { name: 'Resistance', description: 'You have resistance to fire.' },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '2024');

    expect(result.resistances).toEqual([]);
  });

  it('handles traits with no proficiencies or proficiency_choices', () => {
    const race = makeRace({
      traits: [
        { name: 'Darkvision', description: 'You can see in dim light within 60 feet.' },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.traits).toEqual([
      { name: 'Darkvision', description: 'You can see in dim light within 60 feet.' },
    ]);
    expect(result.proficiencies).toEqual([]);
  });

  it('handles traits with both proficiencies and proficiency_choices', () => {
    const race = makeRace({
      traits: [
        {
          name: 'Combat Training',
          description: 'Proficiency with certain weapons.',
          proficiencies: ['Shortsword'],
          proficiency_choices: [
            { choose: '1', from: ['Acrobatics', 'Athletics'] },
          ],
        },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.proficiencies).toEqual([
      { name: 'Shortsword' },
      {
        name: '1 from: Acrobatics, Athletics',
        isChoice: true,
        choose: '1',
        from: ['Acrobatics', 'Athletics'],
      },
    ]);
  });

  it('handles empty traits array', () => {
    const race = makeRace({
      traits: [],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.traits).toEqual([]);
  });

  it('handles missing traits', () => {
    const race = makeRace({
      traits: undefined,
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.traits).toEqual([]);
  });
});

// ── computeRaceBuffs — subrace (5e) ───────────────────────────────

describe('computeRaceBuffs — subrace (5e)', () => {
  beforeEach(resetMocks);

  it('merges subrace ability bonuses with race ability bonuses', () => {
    const race = makeRace({
      subraces: [
        {
          name: 'Gold Dragon',
          ability_bonuses: [
            { name: 'str', bonus: 1 },
            { name: 'cha', bonus: 2 },
          ],
        },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.abilityScoreIncreases).toEqual([
      { name: 'Strength', amount: 3 },
      { name: 'Charisma', amount: 3 },
    ]);
  });

  it('adds new ability entries from subrace when not in race bonuses', () => {
    const race = makeRace({
      ability_bonuses: [
        { name: 'str', bonus: 2 },
      ],
      subraces: [
        {
          name: 'Gold Dragon',
          ability_bonuses: [
            { name: 'dex', bonus: 1 },
          ],
        },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.abilityScoreIncreases).toEqual([
      { name: 'Strength', amount: 2 },
      { name: 'Dexterity', amount: 1 },
    ]);
  });

  it('extracts subrace starting_proficiencies', () => {
    const race = makeRace({
      subraces: [
        {
          name: 'Gold Dragon',
          starting_proficiencies: ['Dragon Breath'],
        },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.proficiencies).toEqual([
      { name: 'Dragon Breath' },
    ]);
  });

  it('extracts subrace languages with deduplication', () => {
    const race = makeRace({
      languages: ['Common'],
      subraces: [
        {
          name: 'Gold Dragon',
          languages: ['Common', 'Draconic'],
        },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.languages).toEqual(['Common', 'Draconic']);
  });

  it('does not duplicate languages already present from race', () => {
    const race = makeRace({
      languages: ['Common', 'Draconic'],
      subraces: [
        {
          name: 'Gold Dragon',
          languages: ['Common'],
        },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.languages).toEqual(['Common', 'Draconic']);
  });

  it('accumulates hitPointBonusPerLevel from subrace', () => {
    const race = makeRace({
      subraces: [
        {
          name: 'Gold Dragon',
          hit_point_bonus_per_level: 1,
        },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.hitPointBonusPerLevel).toBe(1);
  });

  it('extracts racial_traits from subrace', () => {
    const race = makeRace({
      subraces: [
        {
          name: 'Gold Dragon',
          racial_traits: [
            { name: 'Breath Weapon', description: 'You can exhale destructive energy.' },
          ],
        },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.traits).toEqual([
      { name: 'Breath Weapon', description: 'You can exhale destructive energy.' },
    ]);
  });

  it('extracts proficiencies from subrace racial_traits', () => {
    const race = makeRace({
      subraces: [
        {
          name: 'Gold Dragon',
          racial_traits: [
            {
              name: 'Dragon Weapons',
              description: 'Proficiency with certain weapons.',
              proficiencies: ['Longsword', 'Shortsword'],
            },
          ],
        },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.proficiencies).toEqual([
      { name: 'Longsword' },
      { name: 'Shortsword' },
    ]);
  });

  it('does not match subrace when playerData race subrace name is missing', () => {
    const race = makeRace({
      ability_bonuses: [{ name: 'str', bonus: 2 }],
      subraces: [
        {
          name: 'Gold Dragon',
          ability_bonuses: [{ name: 'str', bonus: 5 }],
        },
      ],
    });

    const playerData = makePlayerData({ race: { name: 'Dragonborn' } }); // no subrace

    const result = computeRaceBuffs(race, playerData, '5e');

    // Only race ability_bonuses apply; subrace is not matched
    expect(result.abilityScoreIncreases).toEqual([
      { name: 'Strength', amount: 2 },
    ]);
  });

  it('does not match subrace when playerData is null', () => {
    const race = makeRace({
      ability_bonuses: [{ name: 'str', bonus: 2 }],
      subraces: [
        {
          name: 'Gold Dragon',
          ability_bonuses: [{ name: 'str', bonus: 5 }],
        },
      ],
    });

    const result = computeRaceBuffs(race, null, '5e');

    // Only race ability_bonuses apply; subrace is not matched
    expect(result.abilityScoreIncreases).toEqual([
      { name: 'Strength', amount: 2 },
    ]);
  });

  it('does not match subrace when race has no subraces', () => {
    const race = makeRace({
      subraces: undefined,
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.abilityScoreIncreases).toEqual([
      { name: 'Strength', amount: 2 },
      { name: 'Charisma', amount: 1 },
    ]);
  });

  it('does not apply subrace ability bonuses for 2024 ruleset', () => {
    const race = makeRace({
      subraces: [
        {
          name: 'Gold Dragon',
          ability_bonuses: [{ name: 'str', bonus: 5 }],
        },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '2024');

    expect(result.abilityScoreIncreases).toEqual([]);
  });

  it('applies subrace starting_proficiencies for 2024 ruleset', () => {
    const race = makeRace({
      subraces: [
        {
          name: 'Gold Dragon',
          starting_proficiencies: ['Dragon Breath'],
        },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '2024');

    expect(result.proficiencies).toEqual([
      { name: 'Dragon Breath' },
    ]);
  });

  it('applies subrace languages for 2024 ruleset', () => {
    const race = makeRace({
      subraces: [
        {
          name: 'Gold Dragon',
          languages: ['Draconic'],
        },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '2024');

    expect(result.languages).toEqual(['Draconic']);
  });

  it('applies subrace hit_point_bonus_per_level for 2024 ruleset', () => {
    const race = makeRace({
      subraces: [
        {
          name: 'Gold Dragon',
          hit_point_bonus_per_level: 2,
        },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '2024');

    expect(result.hitPointBonusPerLevel).toBe(2);
  });

  it('applies subrace racial_traits for 2024 ruleset', () => {
    const race = makeRace({
      subraces: [
        {
          name: 'Gold Dragon',
          racial_traits: [
            { name: 'Breath Weapon', description: 'Destructive energy.' },
          ],
        },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '2024');

    expect(result.traits).toEqual([
      { name: 'Breath Weapon', description: 'Destructive energy.' },
    ]);
  });

  it('applies subrace racial_trait proficiencies for 2024 ruleset', () => {
    const race = makeRace({
      subraces: [
        {
          name: 'Gold Dragon',
          racial_traits: [
            {
              name: 'Dragon Weapons',
              description: 'Proficiency.',
              proficiencies: ['Longsword'],
            },
          ],
        },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '2024');

    expect(result.proficiencies).toEqual([
      { name: 'Longsword' },
    ]);
  });
});

// ── computeRaceBuffs — speed extraction edge cases ────────────────

describe('computeRaceBuffs — speed extraction edge cases', () => {
  beforeEach(resetMocks);

  it('extracts speed from trait with "Speed" in name', () => {
    const race = makeRace({
      traits: [
        { name: 'Speed', description: 'Your speed is 35 feet.' },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.speed).toBe(35);
  });

  it('extracts speed from trait with "speed" in name (lowercase)', () => {
    const race = makeRace({
      traits: [
        { name: 'walking speed', description: 'Your speed is 30 feet.' },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.speed).toBe(30);
  });

  it('does not extract speed when trait name does not contain "speed" and trait_type is not set', () => {
    const race = makeRace({
      traits: [
        { name: 'Amorphous', description: 'You can move through a space as narrow as 1 inch wide. Your speed is 25 feet.' },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    // Source only checks trait.trait_type === 'speed' or trait.name.includes('speed')
    expect(result.speed).toBeNull();
  });

  it('extracts speed when trait_type is "speed"', () => {
    const race = makeRace({
      traits: [
        { name: 'Walking Speed', trait_type: 'speed', description: 'Your speed is 25 feet.' },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.speed).toBe(25);
  });

  it('handles speed with no space between number and feet', () => {
    const race = makeRace({
      traits: [
        { name: 'Walking Speed', description: 'Your speed is 30feet.' },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.speed).toBe(30);
  });

  it('does not extract speed when trait has no description', () => {
    const race = makeRace({
      traits: [
        { name: 'Walking Speed' },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.speed).toBeNull();
  });
});

// ── computeRaceBuffs — multiple traits processing ─────────────────

describe('computeRaceBuffs — multiple traits', () => {
  beforeEach(resetMocks);

  it('processes all traits and accumulates proficiencies', () => {
    const race = makeRace({
      starting_proficiencies: ['Light Armor'],
      traits: [
        { name: 'Combat Training', description: 'Weapon proficiency.', proficiencies: ['Shortsword'] },
        { name: 'Darkvision', description: 'You can see in dim light within 60 feet.' },
        { name: 'Resistance', description: 'You have resistance to fire.', proficiencies: ['Medium Armor'] },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.proficiencies).toEqual([
      { name: 'Light Armor' },
      { name: 'Shortsword' },
      { name: 'Medium Armor' },
    ]);
  });

  it('accumulates resistances from multiple traits', () => {
    const race = makeRace({
      traits: [
        { name: 'Fire Resistance', description: 'You have resistance to fire.' },
        { name: 'Cold Resistance', description: 'You are resistant to cold.' },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.resistances).toEqual(['fire', 'cold']);
  });

  it('accumulates traits from both race and subrace', () => {
    const race = makeRace({
      traits: [
        { name: 'Draconic Ancestry', description: 'Ancestral power.' },
      ],
      subraces: [
        {
          name: 'Gold Dragon',
          racial_traits: [
            { name: 'Breath Weapon', description: 'Destructive energy.' },
          ],
        },
      ],
    });

    const result = computeRaceBuffs(race, makePlayerData(), '5e');

    expect(result.traits).toEqual([
      { name: 'Draconic Ancestry', description: 'Ancestral power.' },
      { name: 'Breath Weapon', description: 'Destructive energy.' },
    ]);
  });
});

// ── applyRaceBuffsToPlayerData ────────────────────────────────────

describe('applyRaceBuffsToPlayerData', () => {
  beforeEach(resetMocks);

  it('calls applyAbilityScoreIncreases with playerData.abilities and buffs.abilityScoreIncreases', () => {
    const playerData = makePlayerData();
    const buffs = {
      abilityScoreIncreases: [
        { name: 'Strength', amount: 2 },
        { name: 'Charisma', amount: 1 },
      ],
      proficiencies: [],
      languages: [],
      resistances: [],
      traits: [],
      speed: null,
      hitPointBonusPerLevel: 0,
      feats: [],
    };

    applyRaceBuffsToPlayerData(playerData, buffs);

    expect(buffApplier.applyAbilityScoreIncreases).toHaveBeenCalledWith(
      playerData.abilities,
      buffs.abilityScoreIncreases,
    );
  });

  it('calls mergeDeduplicated with playerData, languages key, and buffs.languages', () => {
    const playerData = makePlayerData();
    const buffs = {
      abilityScoreIncreases: [],
      proficiencies: [],
      languages: ['Common', 'Draconic'],
      resistances: [],
      traits: [],
      speed: null,
      hitPointBonusPerLevel: 0,
      feats: [],
    };

    applyRaceBuffsToPlayerData(playerData, buffs);

    expect(buffApplier.mergeDeduplicated).toHaveBeenCalledWith(
      playerData,
      'languages',
      buffs.languages,
    );
  });

  it('does not call mergeDeduplicated when languages array is empty', () => {
    const playerData = makePlayerData();
    const buffs = {
      abilityScoreIncreases: [],
      proficiencies: [],
      languages: [],
      resistances: [],
      traits: [],
      speed: null,
      hitPointBonusPerLevel: 0,
      feats: [],
    };

    applyRaceBuffsToPlayerData(playerData, buffs);

    expect(buffApplier.mergeDeduplicated).toHaveBeenCalledWith(
      playerData,
      'languages',
      [],
    );
  });

  it('calls applyAbilityScoreIncreases with correct arguments', () => {
    const playerData = makePlayerData();
    const buffs = {
      abilityScoreIncreases: [
        { name: 'Strength', amount: 2 },
      ],
      proficiencies: [],
      languages: [],
      resistances: [],
      traits: [],
      speed: null,
      hitPointBonusPerLevel: 0,
      feats: [],
    };

    applyRaceBuffsToPlayerData(playerData, buffs);

    expect(buffApplier.applyAbilityScoreIncreases).toHaveBeenCalledWith(
      playerData.abilities,
      [{ name: 'Strength', amount: 2 }],
    );
  });

  it('calls mergeDeduplicated with correct arguments', () => {
    const playerData = makePlayerData({ languages: ['Common'] });
    const buffs = {
      abilityScoreIncreases: [],
      proficiencies: [],
      languages: ['Draconic'],
      resistances: [],
      traits: [],
      speed: null,
      hitPointBonusPerLevel: 0,
      feats: [],
    };

    applyRaceBuffsToPlayerData(playerData, buffs);

    expect(buffApplier.mergeDeduplicated).toHaveBeenCalledWith(
      playerData,
      'languages',
      ['Draconic'],
    );
  });

  it('passes the exact abilities array reference to applyAbilityScoreIncreases', () => {
    const playerData = makePlayerData();
    const buffs = {
      abilityScoreIncreases: [],
      proficiencies: [],
      languages: [],
      resistances: [],
      traits: [],
      speed: null,
      hitPointBonusPerLevel: 0,
      feats: [],
    };

    applyRaceBuffsToPlayerData(playerData, buffs);

    const call = buffApplier.applyAbilityScoreIncreases.mock.calls[0];
    expect(call[0]).toBe(playerData.abilities);
  });

  it('passes the exact languages array reference to mergeDeduplicated', () => {
    const playerData = makePlayerData({ languages: ['Common'] });
    const buffs = {
      abilityScoreIncreases: [],
      proficiencies: [],
      languages: ['Draconic'],
      resistances: [],
      traits: [],
      speed: null,
      hitPointBonusPerLevel: 0,
      feats: [],
    };

    applyRaceBuffsToPlayerData(playerData, buffs);

    const call = buffApplier.mergeDeduplicated.mock.calls[0];
    expect(call[2]).toBe(buffs.languages);
  });

  it('ignores other buff properties not handled by applyRaceBuffsToPlayerData', () => {
    const playerData = makePlayerData();
    const buffs = {
      abilityScoreIncreases: [{ name: 'Strength', amount: 2 }],
      proficiencies: [{ name: 'Shield' }],
      languages: ['Common'],
      resistances: ['fire'],
      traits: [{ name: 'Darkvision', description: 'See in dark.' }],
      speed: 30,
      hitPointBonusPerLevel: 1,
    };

    applyRaceBuffsToPlayerData(playerData, buffs);

    // Only abilityScoreIncreases and languages should be applied
    expect(buffApplier.applyAbilityScoreIncreases).toHaveBeenCalled();
    expect(buffApplier.mergeDeduplicated).toHaveBeenCalled();
  });
});
