// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(),
}));

import { getClassFeatures } from '../character/classFeatures.js';

import { computeTrackedResources } from './trackedResources.js';

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

// ── tranceOfOrderUses ──
// CLA-364 BUG-A: no longer seeded — the tranceOfOrderHandler owns the
// null-as-available once-per-Long-Rest latch (warpingimplosionUses pattern).
// A grant-time 0-seed killed the free first use (charged 5 SP).

describe('tranceOfOrderUses', () => {
  it('is never seeded — null-as-available handler latch (CLA-364)', () => {
    const stats = basePlayerStats({
      automation: { bonusActions: [{ type: 'trance_of_order' }] },
    });
    const result = computeTrackedResources(stats);
    expect(result.tranceOfOrderUses).toBeUndefined();
  });

  it('is absent when no trance_of_order bonus action', () => {
    const stats = basePlayerStats({
      automation: { bonusActions: [{ type: 'other_type' }] },
    });
    const result = computeTrackedResources(stats);
    expect(result.tranceOfOrderUses).toBeUndefined();
  });

  it('is absent when automation.bonusActions is missing', () => {
    const stats = basePlayerStats({
      automation: {},
    });
    const result = computeTrackedResources(stats);
    expect(result.tranceOfOrderUses).toBeUndefined();
  });

  it('is absent when automation is missing entirely', () => {
    const stats = basePlayerStats();
    const result = computeTrackedResources(stats);
    expect(result.tranceOfOrderUses).toBeUndefined();
  });
});

// ── adrenalineRushUses ──

describe('adrenalineRushUses', () => {
  it('sets from proficiency when automation.specialActions includes bonus_action_dash', () => {
    const stats = basePlayerStats({
      automation: { specialActions: [{ effect: 'bonus_action_dash' }] },
      proficiency: 4,
    });
    const result = computeTrackedResources(stats);
    expect(result.adrenalineRushUses).toEqual({ current: 4, max: 4 });
  });

  it('defaults to 0 when no bonus_action_dash special action', () => {
    const stats = basePlayerStats({
      automation: { specialActions: [{ effect: 'other_effect' }] },
    });
    const result = computeTrackedResources(stats);
    expect(result.adrenalineRushUses).toEqual({ current: 0, max: 0 });
  });

  it('defaults to 0 when automation.specialActions is missing', () => {
    const stats = basePlayerStats({
      automation: {},
    });
    const result = computeTrackedResources(stats);
    expect(result.adrenalineRushUses).toEqual({ current: 0, max: 0 });
  });

  it('defaults to 0 when automation is missing entirely', () => {
    const stats = basePlayerStats();
    const result = computeTrackedResources(stats);
    expect(result.adrenalineRushUses).toEqual({ current: 0, max: 0 });
  });

  it('defaults proficiency to 0 when missing', () => {
    const stats = basePlayerStats({
      automation: { specialActions: [{ effect: 'bonus_action_dash' }] },
      proficiency: undefined,
    });
    const result = computeTrackedResources(stats);
    expect(result.adrenalineRushUses).toEqual({ current: 0, max: 0 });
  });
});

// ── darkOnesLuckUses (Fiend Patron Warlock) ──

describe('darkOnesLuckUses', () => {
  it('sets from max(1, charisma bonus) for Fiend patron warlock', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Warlock',
        major: { name: 'Fiend' },
        subclass: {},
        class_levels: [],
      },
      abilities: [{ name: 'Charisma', bonus: 3 }],
    });
    const result = computeTrackedResources(stats);
    expect(result.darkOnesLuckUses).toEqual({ current: 3, max: 3 });
  });

  it('sets from max(1, charisma bonus) for Fiend Patron warlock', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Warlock',
        major: { name: 'Fiend Patron' },
        subclass: {},
        class_levels: [],
      },
      abilities: [{ name: 'Charisma', bonus: 0 }],
    });
    const result = computeTrackedResources(stats);
    expect(result.darkOnesLuckUses).toEqual({ current: 1, max: 1 });
  });

  it('sets from max(1, charisma bonus) when subclass is Fiend', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Warlock',
        major: {},
        subclass: { name: 'Fiend' },
        class_levels: [],
      },
      abilities: [{ name: 'Charisma', bonus: 2 }],
    });
    const result = computeTrackedResources(stats);
    expect(result.darkOnesLuckUses).toEqual({ current: 2, max: 2 });
  });

  it('sets from max(1, charisma bonus) when subclass is Fiend Patron', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Warlock',
        major: {},
        subclass: { name: 'Fiend Patron' },
        class_levels: [],
      },
      abilities: [{ name: 'Charisma', bonus: 0 }],
    });
    const result = computeTrackedResources(stats);
    expect(result.darkOnesLuckUses).toEqual({ current: 1, max: 1 });
  });

  it('defaults to 0 for non-Fiend patron warlock', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Warlock',
        major: { name: 'Archfey' },
        subclass: {},
        class_levels: [],
      },
      abilities: [{ name: 'Charisma', bonus: 5 }],
    });
    const result = computeTrackedResources(stats);
    expect(result.darkOnesLuckUses).toEqual({ current: 0, max: 0 });
  });

  it('defaults to 0 for non-warlock', () => {
    const stats = basePlayerStats({
      class: { name: 'Wizard' },
      abilities: [{ name: 'Charisma', bonus: 5 }],
    });
    const result = computeTrackedResources(stats);
    expect(result.darkOnesLuckUses).toEqual({ current: 0, max: 0 });
  });
});

// ── gloriousDefenseUses (Paladin) ──

describe('gloriousDefenseUses', () => {
  it('sets from max(charisma bonus, 1) for paladin', () => {
    const stats = basePlayerStats({
      class: { name: 'Paladin' },
      abilities: [{ name: 'Charisma', bonus: 3 }],
    });
    const result = computeTrackedResources(stats);
    expect(result.gloriousDefenseUses).toEqual({ current: 3, max: 3 });
  });

  it('caps at minimum 1 for paladin with 0 charisma', () => {
    const stats = basePlayerStats({
      class: { name: 'Paladin' },
      abilities: [{ name: 'Charisma', bonus: 0 }],
    });
    const result = computeTrackedResources(stats);
    expect(result.gloriousDefenseUses).toEqual({ current: 1, max: 1 });
  });

  it('defaults to 0 for non-paladin', () => {
    const stats = basePlayerStats({
      class: { name: 'Cleric' },
      abilities: [{ name: 'Charisma', bonus: 5 }],
    });
    const result = computeTrackedResources(stats);
    expect(result.gloriousDefenseUses).toEqual({ current: 0, max: 0 });
  });
});

// ── naturalRecoverySlots (Druid) ──

describe('naturalRecoverySlots', () => {
  it('sets to floor(level/2) for druid', () => {
    const stats = basePlayerStats({
      class: { name: 'Druid' },
      level: 7,
    });
    const result = computeTrackedResources(stats);
    expect(result.naturalRecoverySlots).toEqual({ current: 3, max: 3 });
  });

  it('sets to floor(level/2) for druid at level 5', () => {
    const stats = basePlayerStats({
      class: { name: 'Druid' },
      level: 5,
    });
    const result = computeTrackedResources(stats);
    expect(result.naturalRecoverySlots).toEqual({ current: 2, max: 2 });
  });

  it('defaults to 0 for non-druid', () => {
    const stats = basePlayerStats({
      class: { name: 'Wizard' },
    });
    const result = computeTrackedResources(stats);
    expect(result.naturalRecoverySlots).toEqual({ current: 0, max: 0 });
  });
});

// ── arcaneWardMax / arcaneWardHp (Wizard) ──

describe('arcaneWard', () => {
  it('sets ward HP to 2*level + int mod when arcane_ward passive exists', () => {
    const stats = basePlayerStats({
      class: { name: 'Wizard' },
      abilities: [
        { name: 'Intelligence', bonus: 3 },
        { name: 'Charisma', bonus: 2 },
      ],
      automation: { passives: [{ type: 'arcane_ward' }] },
      level: 6,
    });
    const result = computeTrackedResources(stats);
    const expectedWardHP = (2 * 6) + 3;
    expect(result.arcaneWardMax).toEqual({ current: expectedWardHP, max: expectedWardHP });
    expect(result.arcaneWardHp).toEqual({ current: expectedWardHP, max: expectedWardHP });
  });

  it('sets ward HP with passive_rule type', () => {
    const stats = basePlayerStats({
      class: { name: 'Wizard' },
      abilities: [{ name: 'Intelligence', bonus: 4 }],
      automation: { passives: [{ type: 'passive_rule', effect: 'arcane_ward' }] },
      level: 8,
    });
    const result = computeTrackedResources(stats);
    const expectedWardHP = (2 * 8) + 4;
    expect(result.arcaneWardMax).toEqual({ current: expectedWardHP, max: expectedWardHP });
    expect(result.arcaneWardHp).toEqual({ current: expectedWardHP, max: expectedWardHP });
  });

  it('defaults to 0 when no arcane_ward passive', () => {
    const stats = basePlayerStats({
      class: { name: 'Wizard' },
      abilities: [{ name: 'Intelligence', bonus: 5 }],
      automation: { passives: [{ type: 'other_passive' }] },
    });
    const result = computeTrackedResources(stats);
    expect(result.arcaneWardMax).toEqual({ current: 0, max: 0 });
    expect(result.arcaneWardHp).toEqual({ current: 0, max: 0 });
  });

  it('defaults to 0 when automation.passives is missing', () => {
    const stats = basePlayerStats({
      class: { name: 'Wizard' },
      automation: {},
    });
    const result = computeTrackedResources(stats);
    expect(result.arcaneWardMax).toEqual({ current: 0, max: 0 });
    expect(result.arcaneWardHp).toEqual({ current: 0, max: 0 });
  });

  it('defaults int mod to 0 when Intelligence ability is missing', () => {
    const stats = basePlayerStats({
      class: { name: 'Wizard' },
      abilities: [{ name: 'Charisma', bonus: 2 }],
      automation: { passives: [{ type: 'arcane_ward' }] },
      level: 6,
    });
    const result = computeTrackedResources(stats);
    const expectedWardHP = (2 * 6) + 0;
    expect(result.arcaneWardMax).toEqual({ current: expectedWardHP, max: expectedWardHP });
    expect(result.arcaneWardHp).toEqual({ current: expectedWardHP, max: expectedWardHP });
  });
});

// ── mysticArcanumLevel6-9 (Warlock) ──

describe('mysticArcanum', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets arcanum levels from features.arcanumLevels', () => {
    getClassFeatures.mockReturnValue({
      arcanumLevels: { level6: 1, level7: 1, level8: 1, level9: 1 },
    });
    const stats = basePlayerStats({
      rules: '5e',
      class: { name: 'Warlock' },
    });
    const result = computeTrackedResources(stats);
    expect(result.mysticArcanumLevel6).toEqual({ current: 1, max: 1 });
    expect(result.mysticArcanumLevel7).toEqual({ current: 1, max: 1 });
    expect(result.mysticArcanumLevel8).toEqual({ current: 1, max: 1 });
    expect(result.mysticArcanumLevel9).toEqual({ current: 1, max: 1 });
  });

  it('defaults to 0 when arcanumLevels has missing levels', () => {
    getClassFeatures.mockReturnValue({
      arcanumLevels: { level6: 1, level7: 0 },
    });
    const stats = basePlayerStats({
      rules: '5e',
      class: { name: 'Warlock' },
    });
    const result = computeTrackedResources(stats);
    expect(result.mysticArcanumLevel6).toEqual({ current: 1, max: 1 });
    expect(result.mysticArcanumLevel7).toEqual({ current: 0, max: 0 });
    expect(result.mysticArcanumLevel8).toEqual({ current: 0, max: 0 });
    expect(result.mysticArcanumLevel9).toEqual({ current: 0, max: 0 });
  });

  it('does not set arcanum keys for non-warlock', () => {
    getClassFeatures.mockReturnValue(null);
    const stats = basePlayerStats({
      class: { name: 'Wizard' },
    });
    const result = computeTrackedResources(stats);
    expect(result.mysticArcanumLevel6).toBeUndefined();
    expect(result.mysticArcanumLevel7).toBeUndefined();
    expect(result.mysticArcanumLevel8).toBeUndefined();
    expect(result.mysticArcanumLevel9).toBeUndefined();
  });

  it('handles arcanumLevels with undefined level values', () => {
    getClassFeatures.mockReturnValue({
      arcanumLevels: { level6: undefined, level7: null },
    });
    const stats = basePlayerStats({
      rules: '5e',
      class: { name: 'Warlock' },
    });
    const result = computeTrackedResources(stats);
    expect(result.mysticArcanumLevel6).toEqual({ current: 0, max: 0 });
    expect(result.mysticArcanumLevel7).toEqual({ current: 0, max: 0 });
  });
});

// ── healinglightPool (Celestial Patron Warlock) ──

describe('healinglightPool', () => {
  it('sets pool to 1 + level for Celestial Patron warlock', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Warlock',
        major: { name: 'Celestial Patron' },
        subclass: {},
        class_levels: [],
      },
      level: 5,
    });
    const result = computeTrackedResources(stats);
    expect(result.healinglightPool).toEqual({ current: 6, max: 6 });
  });

  it('sets pool to 1 + level when subclass is Celestial Patron', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Warlock',
        major: {},
        subclass: { name: 'Celestial Patron' },
        class_levels: [],
      },
      level: 3,
    });
    const result = computeTrackedResources(stats);
    expect(result.healinglightPool).toEqual({ current: 4, max: 4 });
  });

  it('defaults to 0 for non-Celestial patron warlock', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Warlock',
        major: { name: 'Fiend' },
        subclass: {},
        class_levels: [],
      },
    });
    const result = computeTrackedResources(stats);
    expect(result.healinglightPool).toEqual({ current: 0, max: 0 });
  });

  it('defaults to 0 for non-warlock', () => {
    const stats = basePlayerStats({
      class: { name: 'Cleric' },
    });
    const result = computeTrackedResources(stats);
    expect(result.healinglightPool).toEqual({ current: 0, max: 0 });
  });

  it('defaults level to 0 when missing for Celestial Patron', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Warlock',
        major: { name: 'Celestial Patron' },
        subclass: {},
        class_levels: [],
      },
      level: undefined,
    });
    const result = computeTrackedResources(stats);
    expect(result.healinglightPool).toEqual({ current: 1, max: 1 });
  });
});

// ── favoredEnemyUses (Ranger) ──

describe('favoredEnemyUses', () => {
  it('sets to max(1, favoredEnemyValue) from class level', () => {
    const stats = basePlayerStats({
      class: {
        name: 'Ranger',
        class_levels: [{ level: 5, favored_enemy: 2 }],
        major: {},
        subclass: {},
      },
    });
    const result = computeTrackedResources(stats);
    expect(result.favoredEnemyUses).toEqual({ current: 2, max: 2 });
  });

  it('caps at minimum 1 when favoredEnemyValue is 0', () => {
    const stats = basePlayerStats({
      class: {
        name: 'Ranger',
        class_levels: [{ level: 5, favored_enemy: 0 }],
        major: {},
        subclass: {},
      },
    });
    const result = computeTrackedResources(stats);
    expect(result.favoredEnemyUses).toEqual({ current: 1, max: 1 });
  });

  it('defaults to 1 even when no matching class level', () => {
    const stats = basePlayerStats({
      class: {
        name: 'Ranger',
        class_levels: [{ level: 3, favored_enemy: 2 }],
        major: {},
        subclass: {},
      },
      level: 5,
    });
    const result = computeTrackedResources(stats);
    expect(result.favoredEnemyUses).toEqual({ current: 1, max: 1 });
  });

  it('defaults to 1 for non-ranger', () => {
    const stats = basePlayerStats({
      class: { name: 'Fighter' },
    });
    const result = computeTrackedResources(stats);
    expect(result.favoredEnemyUses).toEqual({ current: 1, max: 1 });
  });
});

// ── moonlightStepUses (Circle of the Moon Druid) ──

describe('moonlightStepUses', () => {
  it('sets to max(wis bonus, 1) for Circle of the Moon druid', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Druid',
        major: { name: 'Circle of the Moon' },
        subclass: {},
        class_levels: [],
      },
      abilities: [{ name: 'Wisdom', bonus: 3 }],
    });
    const result = computeTrackedResources(stats);
    expect(result.moonlightStepUses).toEqual({ current: 3, max: 3 });
  });

  it('sets to max(wis bonus, 1) when subclass is Circle of the Moon', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Druid',
        major: {},
        subclass: { name: 'Circle of the Moon' },
        class_levels: [],
      },
      abilities: [{ name: 'Wisdom', bonus: 2 }],
    });
    const result = computeTrackedResources(stats);
    expect(result.moonlightStepUses).toEqual({ current: 2, max: 2 });
  });

  it('defaults to 1 when wis bonus is undefined (optional chaining)', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Druid',
        major: { name: 'Circle of the Moon' },
        subclass: {},
        class_levels: [],
      },
      abilities: [{ name: 'Wisdom' }],
    });
    const result = computeTrackedResources(stats);
    expect(result.moonlightStepUses).toEqual({ current: 1, max: 1 });
  });

  it('defaults to 0 for non-Moon druid', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Druid',
        major: { name: 'Circle of the Land' },
        subclass: {},
        class_levels: [],
      },
      abilities: [{ name: 'Wisdom', bonus: 5 }],
    });
    const result = computeTrackedResources(stats);
    expect(result.moonlightStepUses).toEqual({ current: 0, max: 0 });
  });

  it('defaults to 0 for non-druid', () => {
    const stats = basePlayerStats({
      class: { name: 'Wizard' },
      abilities: [{ name: 'Wisdom', bonus: 5 }],
    });
    const result = computeTrackedResources(stats);
    expect(result.moonlightStepUses).toEqual({ current: 0, max: 0 });
  });
});

// ── cosmicomenUses (Circle of the Stars Druid) ──

describe('cosmicomenUses', () => {
  it('sets to max(wis bonus, 1) for Circle of the Stars druid level >= 6', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Druid',
        major: { name: 'Circle of the Stars' },
        subclass: {},
        class_levels: [],
      },
      abilities: [{ name: 'Wisdom', bonus: 3 }],
      level: 8,
    });
    const result = computeTrackedResources(stats);
    expect(result.cosmicomenUses).toEqual({ current: 3, max: 3 });
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
      level: 6,
    });
    const result = computeTrackedResources(stats);
    expect(result.cosmicomenUses).toEqual({ current: 2, max: 2 });
  });

  it('defaults to 0 for Circle of the Stars druid level < 6', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Druid',
        major: { name: 'Circle of the Stars' },
        subclass: {},
        class_levels: [],
      },
      abilities: [{ name: 'Wisdom', bonus: 5 }],
      level: 4,
    });
    const result = computeTrackedResources(stats);
    expect(result.cosmicomenUses).toEqual({ current: 0, max: 0 });
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
    expect(result.cosmicomenUses).toEqual({ current: 0, max: 0 });
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
      level: 8,
    });
    const result = computeTrackedResources(stats);
    expect(result.cosmicomenUses).toEqual({ current: 1, max: 1 });
  });
});

// ── featsOfChaosUses (Wild Magic Sorcerer) ──

describe('featsOfChaosUses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets to 1 for Wild Magic Sorcery in 2024', () => {
    const stats = basePlayerStats({
      rules: '2024',
      class: {
        name: 'Sorcerer',
        subclass: { name: 'Wild Magic Sorcery' },
        class_levels: [],
        major: {},
      },
    });
    const result = computeTrackedResources(stats);
    expect(result.featsOfChaosUses).toEqual({ current: 1, max: 1 });
  });

  it('sets to 1 for Wild Magic Sorcery in 5e when automation.specialActions includes feats_of_chaos', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Sorcerer',
        subclass: { name: 'Wild Magic Sorcery' },
        class_levels: [],
        major: {},
      },
      automation: { specialActions: [{ type: 'feats_of_chaos' }] },
    });
    const result = computeTrackedResources(stats);
    expect(result.featsOfChaosUses).toEqual({ current: 1, max: 1 });
  });

  it('sets to 1 when automation.specialActions includes feats_of_chaos', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Sorcerer',
        subclass: { name: 'Other Magic' },
        class_levels: [],
        major: {},
      },
      automation: { specialActions: [{ type: 'feats_of_chaos' }] },
    });
    const result = computeTrackedResources(stats);
    expect(result.featsOfChaosUses).toEqual({ current: 1, max: 1 });
  });

  it('sets to 1 when automation.passives includes feats_of_chaos', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Sorcerer',
        subclass: { name: 'Other Magic' },
        class_levels: [],
        major: {},
      },
      automation: { passives: [{ type: 'feats_of_chaos' }] },
    });
    const result = computeTrackedResources(stats);
    expect(result.featsOfChaosUses).toEqual({ current: 1, max: 1 });
  });

  it('defaults to 0 for non-Wild Magic sorcerer', () => {
    const stats = basePlayerStats({
      rules: '5e',
      class: {
        name: 'Sorcerer',
        subclass: { name: 'Storm Sorcery' },
        class_levels: [],
        major: {},
      },
    });
    const result = computeTrackedResources(stats);
    expect(result.featsOfChaosUses).toEqual({ current: 0, max: 0 });
  });

  it('defaults to 0 for non-sorcerer', () => {
    const stats = basePlayerStats({
      class: { name: 'Wizard' },
    });
    const result = computeTrackedResources(stats);
    expect(result.featsOfChaosUses).toEqual({ current: 0, max: 0 });
  });
});


