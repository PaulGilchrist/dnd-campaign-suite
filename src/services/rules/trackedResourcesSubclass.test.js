import { describe, it, expect } from 'vitest';

import {
  computeTrackedResources,
  applyServerOverride,
} from './trackedResources.js';

function basePlayerStats(extra = {}) {
  return {
    level: 5,
    rules: '5e',
    class: { name: 'Wizard', class_levels: [], major: {}, subclass: {} },
    abilities: [],
    feats: [],
    ...extra,
  };
}

// ── _Star_Map_freeCastCount (Circle of the Stars Druid) ──

describe('_Star_Map_freeCastCount', () => {
  it('sets to max(wis bonus, 1) for Circle of the Stars druid level >= 3', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Druid',
        major: { name: 'Circle of the Stars' },
        subclass: {},
        class_levels: [],
      },
      abilities: [{ name: 'Wisdom', bonus: 3 }],
      level: 5,
    });
    const result = computeTrackedResources(stats);
    expect(result._Star_Map_freeCastCount).toEqual({ current: 3, max: 3 });
  });

  it('sets to max(wis bonus, 1) when subclass is Circle of the Stars', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Druid',
        major: {},
        subclass: { name: 'Circle of the Stars' },
        class_levels: [],
      },
      abilities: [{ name: 'Wisdom', bonus: 2 }],
      level: 3,
    });
    const result = computeTrackedResources(stats);
    expect(result._Star_Map_freeCastCount).toEqual({ current: 2, max: 2 });
  });

  it('defaults to 0 for Circle of the Stars druid level < 3', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Druid',
        major: { name: 'Circle of the Stars' },
        subclass: {},
        class_levels: [],
      },
      abilities: [{ name: 'Wisdom', bonus: 5 }],
      level: 2,
    });
    const result = computeTrackedResources(stats);
    expect(result._Star_Map_freeCastCount).toEqual({ current: 0, max: 0 });
  });

  it('defaults to 0 for non-Stars druid', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Druid',
        major: { name: 'Circle of the Moon' },
        subclass: {},
        class_levels: [],
      },
      abilities: [{ name: 'Wisdom', bonus: 5 }],
      level: 10,
    });
    const result = computeTrackedResources(stats);
    expect(result._Star_Map_freeCastCount).toEqual({ current: 0, max: 0 });
  });

  it('defaults to 0 for non-druid', () => {
    const stats = basePlayerStats({
      class: { name: 'Wizard' },
      abilities: [{ name: 'Wisdom', bonus: 5 }],
    });
    const result = computeTrackedResources(stats);
    expect(result._Star_Map_freeCastCount).toEqual({ current: 0, max: 0 });
  });

  it('defaults to 1 when wis bonus is undefined (optional chaining)', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Druid',
        major: { name: 'Circle of the Stars' },
        subclass: {},
        class_levels: [],
      },
      abilities: [{ name: 'Wisdom' }],
      level: 5,
    });
    const result = computeTrackedResources(stats);
    expect(result._Star_Map_freeCastCount).toEqual({ current: 1, max: 1 });
  });
});

// ── _Steps_of_the_Fey_freeCastCount (Archfey Patron Warlock) ──

describe('_Steps_of_the_Fey_freeCastCount', () => {
  it('sets to max(charisma bonus, 1) for Archfey Patron warlock with bonus action', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Warlock',
        major: {},
        subclass: { name: 'Archfey Patron' },
        class_levels: [],
      },
      abilities: [{ name: 'Charisma', bonus: 3 }],
      automation: { bonusActions: [{ type: 'steps_of_the_fey' }] },
    });
    const result = computeTrackedResources(stats);
    expect(result._Steps_of_the_Fey_freeCastCount).toEqual({ current: 3, max: 3 });
  });

  it('sets when major is Archfey Patron', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Warlock',
        major: { name: 'Archfey Patron' },
        subclass: {},
        class_levels: [],
      },
      abilities: [{ name: 'Charisma', bonus: 2 }],
      automation: { bonusActions: [{ type: 'steps_of_the_fey' }] },
    });
    const result = computeTrackedResources(stats);
    expect(result._Steps_of_the_Fey_freeCastCount).toEqual({ current: 2, max: 2 });
  });

  it('defaults to 0 when no steps_of_the_fey bonus action', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Warlock',
        major: { name: 'Archfey Patron' },
        subclass: {},
        class_levels: [],
      },
      abilities: [{ name: 'Charisma', bonus: 5 }],
      automation: { bonusActions: [{ type: 'other_type' }] },
    });
    const result = computeTrackedResources(stats);
    expect(result._Steps_of_the_Fey_freeCastCount).toEqual({ current: 0, max: 0 });
  });

  it('defaults to 0 for non-Archfey patron warlock', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Warlock',
        major: { name: 'Fiend' },
        subclass: {},
        class_levels: [],
      },
      abilities: [{ name: 'Charisma', bonus: 5 }],
      automation: { bonusActions: [{ type: 'steps_of_the_fey' }] },
    });
    const result = computeTrackedResources(stats);
    expect(result._Steps_of_the_Fey_freeCastCount).toEqual({ current: 0, max: 0 });
  });

  it('defaults to 0 for non-warlock', () => {
    const stats = basePlayerStats({
      class: { name: 'Wizard' },
      abilities: [{ name: 'Charisma', bonus: 5 }],
      automation: { bonusActions: [{ type: 'steps_of_the_fey' }] },
    });
    const result = computeTrackedResources(stats);
    expect(result._Steps_of_the_Fey_freeCastCount).toEqual({ current: 0, max: 0 });
  });

  it('defaults to 1 when charisma bonus is undefined (optional chaining)', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Warlock',
        major: {},
        subclass: { name: 'Archfey Patron' },
        class_levels: [],
      },
      abilities: [{ name: 'Charisma' }],
      automation: { bonusActions: [{ type: 'steps_of_the_fey' }] },
    });
    const result = computeTrackedResources(stats);
    expect(result._Steps_of_the_Fey_freeCastCount).toEqual({ current: 1, max: 1 });
  });
});

// ── tirelessUses (Ranger) ──

describe('tirelessUses', () => {
  it('sets to max(wis bonus, 1) for ranger level >= 10', () => {
    const stats = basePlayerStats({
      class: {
        name: 'Ranger',
        class_levels: [],
        major: {},
        subclass: {},
      },
      abilities: [{ name: 'Wisdom', bonus: 3 }],
      level: 12,
    });
    const result = computeTrackedResources(stats);
    expect(result.tirelessUses).toEqual({ current: 3, max: 3 });
  });

  it('caps at minimum 1 when wisdom bonus is 0', () => {
    const stats = basePlayerStats({
      class: {
        name: 'Ranger',
        class_levels: [],
        major: {},
        subclass: {},
      },
      abilities: [{ name: 'Wisdom', bonus: 0 }],
      level: 14,
    });
    const result = computeTrackedResources(stats);
    expect(result.tirelessUses).toEqual({ current: 1, max: 1 });
  });

  it('defaults to 0 for ranger level < 10', () => {
    const stats = basePlayerStats({
      class: {
        name: 'Ranger',
        class_levels: [],
        major: {},
        subclass: {},
      },
      abilities: [{ name: 'Wisdom', bonus: 5 }],
      level: 8,
    });
    const result = computeTrackedResources(stats);
    expect(result.tirelessUses).toEqual({ current: 0, max: 0 });
  });

  it('defaults to 0 for non-ranger', () => {
    const stats = basePlayerStats({
      class: { name: 'Fighter' },
      abilities: [{ name: 'Wisdom', bonus: 5 }],
      level: 15,
    });
    const result = computeTrackedResources(stats);
    expect(result.tirelessUses).toEqual({ current: 0, max: 0 });
  });
});

// ── naturesVeilUses (Ranger) ──

describe('naturesVeilUses', () => {
  it('sets to max(wis bonus, 1) for ranger level >= 14', () => {
    const stats = basePlayerStats({
      class: {
        name: 'Ranger',
        class_levels: [],
        major: {},
        subclass: {},
      },
      abilities: [{ name: 'Wisdom', bonus: 4 }],
      level: 14,
    });
    const result = computeTrackedResources(stats);
    expect(result.naturesVeilUses).toEqual({ current: 4, max: 4 });
  });

  it('caps at minimum 1 when wisdom bonus is 0', () => {
    const stats = basePlayerStats({
      class: {
        name: 'Ranger',
        class_levels: [],
        major: {},
        subclass: {},
      },
      abilities: [{ name: 'Wisdom', bonus: 0 }],
      level: 16,
    });
    const result = computeTrackedResources(stats);
    expect(result.naturesVeilUses).toEqual({ current: 1, max: 1 });
  });

  it('defaults to 0 for ranger level < 14', () => {
    const stats = basePlayerStats({
      class: {
        name: 'Ranger',
        class_levels: [],
        major: {},
        subclass: {},
      },
      abilities: [{ name: 'Wisdom', bonus: 5 }],
      level: 12,
    });
    const result = computeTrackedResources(stats);
    expect(result.naturesVeilUses).toEqual({ current: 0, max: 0 });
  });

  it('defaults to 0 for non-ranger', () => {
    const stats = basePlayerStats({
      class: { name: 'Druid' },
      abilities: [{ name: 'Wisdom', bonus: 5 }],
      level: 18,
    });
    const result = computeTrackedResources(stats);
    expect(result.naturesVeilUses).toEqual({ current: 0, max: 0 });
  });
});

// ── stonecunningUses (Dwarf) ──

describe('stonecunningUses', () => {
  it('sets from proficiency when race has Stonecunning trait with automation', () => {
    const stats = basePlayerStats({
      race: {
        traits: [{ name: 'Stonecunning', automation: true }],
      },
      proficiency: 4,
    });
    const result = computeTrackedResources(stats);
    expect(result.stonecunningUses).toEqual({ current: 4, max: 4 });
  });

  it('defaults to 0 when no Stonecunning trait', () => {
    const stats = basePlayerStats({
      race: { traits: [{ name: 'Darkvision' }] },
      proficiency: 4,
    });
    const result = computeTrackedResources(stats);
    expect(result.stonecunningUses).toEqual({ current: 0, max: 0 });
  });

  it('defaults to 0 when Stonecunning trait has no automation', () => {
    const stats = basePlayerStats({
      race: { traits: [{ name: 'Stonecunning', automation: false }] },
      proficiency: 4,
    });
    const result = computeTrackedResources(stats);
    expect(result.stonecunningUses).toEqual({ current: 0, max: 0 });
  });

  it('defaults to 0 when race is missing', () => {
    const stats = basePlayerStats();
    const result = computeTrackedResources(stats);
    expect(result.stonecunningUses).toEqual({ current: 0, max: 0 });
  });

  it('defaults proficiency to 0 when missing', () => {
    const stats = basePlayerStats({
      race: { traits: [{ name: 'Stonecunning', automation: true }] },
      proficiency: undefined,
    });
    const result = computeTrackedResources(stats);
    expect(result.stonecunningUses).toEqual({ current: 0, max: 0 });
  });
});

// ── stonesEnduranceUses (Hill Dwarf) ──

describe('stonesEnduranceUses', () => {
  it('sets from proficiency when subrace has Stone Endurance trait with automation', () => {
    const stats = basePlayerStats({
      race: {
        subrace: {
          traits: [{ name: "Stone's Endurance", automation: true }],
        },
      },
      proficiency: 4,
    });
    const result = computeTrackedResources(stats);
    expect(result.stonesEnduranceUses).toEqual({ current: 4, max: 4 });
  });

  it('defaults to 0 when no Stone Endurance trait', () => {
    const stats = basePlayerStats({
      race: {
        subrace: { traits: [{ name: 'Hill Giant Compatibility' }] },
      },
      proficiency: 4,
    });
    const result = computeTrackedResources(stats);
    expect(result.stonesEnduranceUses).toEqual({ current: 0, max: 0 });
  });

  it('defaults to 0 when subrace is missing', () => {
    const stats = basePlayerStats({
      race: { traits: [] },
      proficiency: 4,
    });
    const result = computeTrackedResources(stats);
    expect(result.stonesEnduranceUses).toEqual({ current: 0, max: 0 });
  });

  it('defaults proficiency to 0 when missing', () => {
    const stats = basePlayerStats({
      race: { subrace: { traits: [{ name: "Stone's Endurance", automation: true }] } },
      proficiency: undefined,
    });
    const result = computeTrackedResources(stats);
    expect(result.stonesEnduranceUses).toEqual({ current: 0, max: 0 });
  });
});

// ── stormsThunderUses (Hill Dwarf) ──

describe('stormsThunderUses', () => {
  it('sets from proficiency when subrace has Storm Thunder trait with automation', () => {
    const stats = basePlayerStats({
      race: {
        subrace: {
          traits: [{ name: "Storm's Thunder", automation: true }],
        },
      },
      proficiency: 3,
    });
    const result = computeTrackedResources(stats);
    expect(result.stormsThunderUses).toEqual({ current: 3, max: 3 });
  });

  it('defaults to 0 when no Storm Thunder trait', () => {
    const stats = basePlayerStats({
      race: {
        subrace: { traits: [{ name: 'Other Trait' }] },
      },
      proficiency: 3,
    });
    const result = computeTrackedResources(stats);
    expect(result.stormsThunderUses).toEqual({ current: 0, max: 0 });
  });

  it('defaults to 0 when subrace is missing', () => {
    const stats = basePlayerStats({
      race: { traits: [] },
      proficiency: 3,
    });
    const result = computeTrackedResources(stats);
    expect(result.stormsThunderUses).toEqual({ current: 0, max: 0 });
  });

  it('defaults proficiency to 0 when missing', () => {
    const stats = basePlayerStats({
      race: { subrace: { traits: [{ name: "Storm's Thunder", automation: true }] } },
      proficiency: undefined,
    });
    const result = computeTrackedResources(stats);
    expect(result.stormsThunderUses).toEqual({ current: 0, max: 0 });
  });
});

// ── preserveLifePool (Life Domain Cleric) ──

describe('preserveLifePool', () => {
  it('sets pool to 5 * level for Life Domain cleric', () => {
    const stats = basePlayerStats({
      class: {
        name: 'Cleric',
        major: { name: 'Life Domain' },
        subclass: {},
        class_levels: [],
      },
      level: 5,
    });
    const result = computeTrackedResources(stats);
    expect(result.preserveLifePool).toEqual({ current: 25, max: 25 });
  });

  it('sets pool when subclass is Life Domain', () => {
    const stats = basePlayerStats({
      class: {
        name: 'Cleric',
        major: {},
        subclass: { name: 'Life Domain' },
        class_levels: [],
      },
      level: 8,
    });
    const result = computeTrackedResources(stats);
    expect(result.preserveLifePool).toEqual({ current: 40, max: 40 });
  });

  it('defaults to 0 for non-Life Domain cleric', () => {
    const stats = basePlayerStats({
      class: {
        name: 'Cleric',
        major: { name: 'War Domain' },
        subclass: {},
        class_levels: [],
      },
      level: 10,
    });
    const result = computeTrackedResources(stats);
    expect(result.preserveLifePool).toEqual({ current: 0, max: 0 });
  });

  it('defaults to 0 for non-cleric', () => {
    const stats = basePlayerStats({
      class: { name: 'Paladin' },
      level: 5,
    });
    const result = computeTrackedResources(stats);
    expect(result.preserveLifePool).toEqual({ current: 0, max: 0 });
  });

  it('defaults level to 0 when missing for Life Domain cleric', () => {
    const stats = basePlayerStats({
      class: {
        name: 'Cleric',
        major: { name: 'Life Domain' },
        subclass: {},
        class_levels: [],
      },
      level: undefined,
    });
    const result = computeTrackedResources(stats);
    expect(result.preserveLifePool).toEqual({ current: 0, max: 0 });
  });
});

// ── applyServerOverride - unknown key in ALL_TRACKED_RESOURCES ──

describe('applyServerOverride - unknown key in ALL_TRACKED_RESOURCES', () => {
  it('adds new tracked resource keys not in computed resources', () => {
    const computed = {
      hitPoints: { current: 20, max: 20 },
    };
    const result = applyServerOverride(computed, {
      sorceryPoints: 3,
    });
    expect(result.hitPoints).toEqual({ current: 20, max: 20 });
    expect(result.sorceryPoints).toEqual({ current: 3, max: 3 });
  });

  it('does not add unknown keys not in ALL_TRACKED_RESOURCES', () => {
    const computed = {
      hitPoints: { current: 20, max: 20 },
    };
    const result = applyServerOverride(computed, {
      totallyUnknownKey: 99,
    });
    expect(result.hitPoints).toEqual({ current: 20, max: 20 });
    expect(result.totallyUnknownKey).toBeUndefined();
  });

  it('does not add when serverValue is null for new tracked key', () => {
    const computed = {
      hitPoints: { current: 20, max: 20 },
    };
    const result = applyServerOverride(computed, {
      sorceryPoints: null,
    });
    expect(result.hitPoints).toEqual({ current: 20, max: 20 });
    expect(result.sorceryPoints).toBeUndefined();
  });

  it('adds new tracked resource with 0 value', () => {
    const computed = {
      hitPoints: { current: 20, max: 20 },
    };
    const result = applyServerOverride(computed, {
      kiPoints: 0,
    });
    expect(result.kiPoints).toEqual({ current: 0, max: 0 });
  });

  it('handles serverData that is not an object', () => {
    const computed = { hitPoints: { current: 10, max: 20 } };
    const result = applyServerOverride(computed, 'not an object');
    expect(result).toEqual(computed);
    expect(result).not.toBe(computed);
  });

  it('handles serverData that is null', () => {
    const computed = { hitPoints: { current: 10, max: 20 } };
    const result = applyServerOverride(computed, null);
    expect(result).toEqual(computed);
    expect(result).not.toBe(computed);
  });
});
