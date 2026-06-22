// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ────────────────────────────────────────

vi.mock('../character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────

import { getClassFeatures } from '../character/classFeatures.js';

import {
  ALL_TRACKED_RESOURCES,
  computeTrackedResources,
  applyServerOverride,
  trackedResourcesToStoreEntries,
} from './trackedResources.js';

// ── Helpers ─────────────────────────────────────────────────────

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

// ── ALL_TRACKED_RESOURCES ───────────────────────────────────────

describe('ALL_TRACKED_RESOURCES', () => {
  it('is an array of tracked resource key strings', () => {
    expect(Array.isArray(ALL_TRACKED_RESOURCES)).toBe(true);
    expect(ALL_TRACKED_RESOURCES.every((k) => typeof k === 'string')).toBe(true);
  });

  it('contains all expected resource keys for core mechanics', () => {
    const expected = [
      'currentHitPoints',
      'hitPoints',
      'spell_slots_level_1',
      'spell_slots_level_9',
      'shortRestHitDice',
      'sorceryPoints',
      'bardicInspirationUses',
      'luckyPoints',
      'warlockPactMagic',
    ];
    for (const key of expected) {
      expect(ALL_TRACKED_RESOURCES).toContain(key);
    }
  });
  it('contains 40 tracked resources', () => {

    expect(ALL_TRACKED_RESOURCES).toHaveLength(40);
  });

  it('contains both casing variants for second wind', () => {
    expect(ALL_TRACKED_RESOURCES).toContain('secondWindUses');
    expect(ALL_TRACKED_RESOURCES).toContain('secondwindUses');
  });
});

// ── computeTrackedResources ─────────────────────────────────────

describe('computeTrackedResources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty object when playerStats is null', () => {
    expect(computeTrackedResources(null)).toEqual({});
  });

  it('returns empty object when playerStats is undefined', () => {
    expect(computeTrackedResources(undefined)).toEqual({});
  });

  // ── hitPoints ──

  it('sets hitPoints and currentHitPoints from playerStats.hitPoints', () => {
    const stats = basePlayerStats({ hitPoints: 35 });
    const result = computeTrackedResources(stats);
    expect(result.hitPoints).toEqual({ current: 35, max: 35 });
    expect(result.currentHitPoints).toEqual({ current: 35, max: 35 });
  });

  it('defaults hitPoints to 0 when not provided', () => {
    const result = computeTrackedResources(basePlayerStats());
    expect(result.hitPoints).toEqual({ current: 0, max: 0 });
    expect(result.currentHitPoints).toEqual({ current: 0, max: 0 });
  });

  // ── spell slots ──

  it('computes all 9 spell slot levels from spellAbilities', () => {
    const slotValues = {
      spell_slots_level_1: 4,
      spell_slots_level_2: 3,
      spell_slots_level_3: 3,
      spell_slots_level_4: 3,
      spell_slots_level_5: 2,
      spell_slots_level_6: 1,
      spell_slots_level_7: 1,
      spell_slots_level_8: 1,
      spell_slots_level_9: 1,
    };
    const stats = basePlayerStats({ spellAbilities: slotValues });
    const result = computeTrackedResources(stats);
    for (const [key, value] of Object.entries(slotValues)) {
      expect(result[key]).toEqual({ current: value, max: value });
    }
  });

  it('defaults all spell slots to 0 when spellAbilities is missing', () => {
    const result = computeTrackedResources(basePlayerStats());
    for (let level = 1; level <= 9; level++) {
      const key = `spell_slots_level_${level}`;
      expect(result[key]).toEqual({ current: 0, max: 0 });
    }
  });

  // ── shortRestHitDice ──

  it('sets shortRestHitDice from playerStats.level', () => {
    const result = computeTrackedResources(basePlayerStats({ level: 8 }));
    expect(result.shortRestHitDice).toEqual({ current: 8, max: 8 });
  });

  // ── sorceryPoints ──

  it('sets sorceryPoints from features.maxSorceryPoints', () => {
    getClassFeatures.mockReturnValue({ maxSorceryPoints: 5 });
    const result = computeTrackedResources(basePlayerStats());
    expect(result.sorceryPoints).toEqual({ current: 5, max: 5 });
  });

  it('defaults sorceryPoints to 0 when features is null', () => {
    getClassFeatures.mockReturnValue(null);
    const result = computeTrackedResources(basePlayerStats());
    expect(result.sorceryPoints).toEqual({ current: 0, max: 0 });
  });

  it('defaults sorceryPoints to 0 when features lacks maxSorceryPoints', () => {
    getClassFeatures.mockReturnValue({ otherProp: 10 });
    const result = computeTrackedResources(basePlayerStats());
    expect(result.sorceryPoints).toEqual({ current: 0, max: 0 });
  });

  // ── innateSorceryUses ──

  it('sets innateSorceryUses from features.maxInnateSorcery', () => {
    getClassFeatures.mockReturnValue({ maxInnateSorcery: 3 });
    const result = computeTrackedResources(basePlayerStats());
    expect(result.innateSorceryUses).toEqual({ current: 3, max: 3 });
  });

  it('defaults innateSorceryUses to 0 when features is null', () => {
    getClassFeatures.mockReturnValue(null);
    const result = computeTrackedResources(basePlayerStats());
    expect(result.innateSorceryUses).toEqual({ current: 0, max: 0 });
  });

  // ── focusPoints / kiPoints ──

  it('sets focusPoints and kiPoints from classLevel.focus_points', () => {
    const stats = basePlayerStats({
      class: { ...basePlayerStats().class, class_levels: [{ level: 5, focus_points: 2 }] },
    });
    const result = computeTrackedResources(stats);
    expect(result.focusPoints).toEqual({ current: 2, max: 2 });
    expect(result.kiPoints).toEqual({ current: 2, max: 2 });
  });

  it('falls back to features.maxFocusPoints when classLevel.focus_points is missing', () => {
    getClassFeatures.mockReturnValue({ maxFocusPoints: 4 });
    const stats = basePlayerStats({
      class: { ...basePlayerStats().class, class_levels: [{ level: 5 }] },
    });
    const result = computeTrackedResources(stats);
    expect(result.focusPoints).toEqual({ current: 4, max: 4 });
    expect(result.kiPoints).toEqual({ current: 4, max: 4 });
  });

  it('classLevel.focus_points takes priority over features.maxFocusPoints', () => {
    getClassFeatures.mockReturnValue({ maxFocusPoints: 4 });
    const stats = basePlayerStats({
      class: { ...basePlayerStats().class, class_levels: [{ level: 5, focus_points: 2 }] },
    });
    const result = computeTrackedResources(stats);
    expect(result.focusPoints).toEqual({ current: 2, max: 2 });
    expect(result.kiPoints).toEqual({ current: 2, max: 2 });
  });

  it('defaults focusPoints and kiPoints to 0 when neither source is available', () => {
    getClassFeatures.mockReturnValue(null);
    const stats = basePlayerStats({
      class: { ...basePlayerStats().class, class_levels: [{ level: 5 }] },
    });
    const result = computeTrackedResources(stats);
    expect(result.focusPoints).toEqual({ current: 0, max: 0 });
    expect(result.kiPoints).toEqual({ current: 0, max: 0 });
  });

  // ── channelDivinityCharges ──

  it('sets channelDivinityCharges from features.maxChannelDivinity', () => {
    getClassFeatures.mockReturnValue({ maxChannelDivinity: 2 });
    const result = computeTrackedResources(basePlayerStats());
    expect(result.channelDivinityCharges).toEqual({ current: 2, max: 2 });
  });

  // ── bardicInspirationUses ──

  it('sets bardicInspirationUses from Charisma ability bonus', () => {
    const stats = basePlayerStats({ abilities: [{ name: 'Charisma', bonus: 3 }] });
    const result = computeTrackedResources(stats);
    expect(result.bardicInspirationUses).toEqual({ current: 3, max: 3 });
  });

  it('defaults bardicInspirationUses to 0 when no Charisma ability', () => {
    const result = computeTrackedResources(basePlayerStats({ abilities: [] }));
    expect(result.bardicInspirationUses).toEqual({ current: 0, max: 0 });
  });

  // ── wildShapeUses ──

  it('sets wildShapeUses from features.maxWildShapeUses', () => {
    getClassFeatures.mockReturnValue({ maxWildShapeUses: 2 });
    const result = computeTrackedResources(basePlayerStats());
    expect(result.wildShapeUses).toEqual({ current: 2, max: 2 });
  });

  // ── secondWindUses / secondwindUses ──

  it('sets secondWindUses and secondwindUses from classLevel.second_wind (matching level)', () => {
    const stats = basePlayerStats({
      class: { ...basePlayerStats().class, class_levels: [{ level: 5, second_wind: 1 }] },
      level: 5,
    });
    const result = computeTrackedResources(stats);
    expect(result.secondWindUses).toEqual({ current: 1, max: 1 });
    expect(result.secondwindUses).toEqual({ current: 1, max: 1 });
  });

  it('defaults second wind uses to 0 when no matching class level', () => {
    const stats = basePlayerStats({
      class: { ...basePlayerStats().class, class_levels: [{ level: 3, second_wind: 1 }] },
      level: 5,
    });
    const result = computeTrackedResources(stats);
    expect(result.secondWindUses).toEqual({ current: 0, max: 0 });
  });

  // ── actionSurge (Fighter) ──

  describe('actionSurge', () => {
    it('5e: sets from class_specific.action_surges on matching class level', () => {
      getClassFeatures.mockReturnValue(null);
      const stats = basePlayerStats({
        rules: '5e',
        level: 7,
        class: { ...basePlayerStats().class, name: 'Fighter', class_levels: [{ level: 7, class_specific: { action_surges: 2 } }] },
      });
      const result = computeTrackedResources(stats);
      expect(result.actionSurgeUses).toEqual({ current: 2, max: 2 });
      expect(result.actionsurgeUses).toEqual({ current: 2, max: 2 });
    });

    it('2024: level >= 17 gives 2 action surges', () => {
      const stats = basePlayerStats({
        rules: '2024',
        class: { ...basePlayerStats().class, name: 'Fighter' },
        level: 17,
      });
      const result = computeTrackedResources(stats);
      expect(result.actionSurgeUses).toEqual({ current: 2, max: 2 });
    });

    it('2024: level >= 2 gives 1 action surge', () => {
      const stats = basePlayerStats({
        rules: '2024',
        class: { ...basePlayerStats().class, name: 'Fighter' },
        level: 5,
      });
      const result = computeTrackedResources(stats);
      expect(result.actionSurgeUses).toEqual({ current: 1, max: 1 });
    });

    it('2024: level < 2 gives 0 action surges', () => {
      const stats = basePlayerStats({
        rules: '2024',
        class: { ...basePlayerStats().class, name: 'Fighter' },
        level: 1,
      });
      const result = computeTrackedResources(stats);
      expect(result.actionSurgeUses).toEqual({ current: 0, max: 0 });
    });

    it('non-fighter has 0 action surges', () => {
      const stats = basePlayerStats({
        class: { ...basePlayerStats().class, name: 'Wizard' },
      });
      const result = computeTrackedResources(stats);
      expect(result.actionSurgeUses).toEqual({ current: 0, max: 0 });
    });
  });

  // ── ragePoints (Barbarian) ──

  describe('ragePoints', () => {
    it('5e: sets from class_specific.rage_count on matching class level', () => {
      const stats = basePlayerStats({
        rules: '5e',
        class: { ...basePlayerStats().class, name: 'Barbarian', class_levels: [{ level: 5, class_specific: { rage_count: 2 } }] },
      });
      const result = computeTrackedResources(stats);
      expect(result.ragePoints).toEqual({ current: 2, max: 2 });
    });

    it('2024: sets from classLevel.rages', () => {
      const stats = basePlayerStats({
        rules: '2024',
        class: { ...basePlayerStats().class, name: 'Barbarian', class_levels: [{ level: 5, rages: 3 }] },
      });
      const result = computeTrackedResources(stats);
      expect(result.ragePoints).toEqual({ current: 3, max: 3 });
    });

    it('non-barbarian has 0 rage points', () => {
      const stats = basePlayerStats({
        class: { ...basePlayerStats().class, name: 'Cleric' },
      });
      const result = computeTrackedResources(stats);
      expect(result.ragePoints).toEqual({ current: 0, max: 0 });
    });
  });

  // ── layOnHandsPool (Paladin) ──

  describe('layOnHandsPool', () => {
    it('sets pool to 5 * level for paladin', () => {
      const stats = basePlayerStats({
        class: { ...basePlayerStats().class, name: 'Paladin' },
        level: 5,
      });
      const result = computeTrackedResources(stats);
      expect(result.layOnHandsPool).toEqual({ current: 25, max: 25 });
    });

    it('level 0 paladin has 0 pool', () => {
      const stats = basePlayerStats({
        rules: '5e',
        class: { ...basePlayerStats().class, name: 'Paladin' },
        level: 0,
      });
      const result = computeTrackedResources(stats);
      expect(result.layOnHandsPool).toEqual({ current: 0, max: 0 });
    });

    it('non-paladin has 0 pool', () => {
      const stats = basePlayerStats({
        class: { ...basePlayerStats().class, name: 'Sorcerer' },
      });
      const result = computeTrackedResources(stats);
      expect(result.layOnHandsPool).toEqual({ current: 0, max: 0 });
    });
  });

  // ── superiorityDice (Battle Master Fighter) ──

  describe('superiorityDice', () => {
    it('5e: level >= 15 gives 6 dice', () => {
      const stats = basePlayerStats({
        rules: '5e',
        class: { ...basePlayerStats().class, name: 'Fighter', major: { name: 'Battle Master' } },
        level: 15,
        class_levels: [{ level: 15 }],
      });
      const result = computeTrackedResources(stats);
      expect(result.superiorityDice).toEqual({ current: 6, max: 6 });
    });

    it('5e: level >= 7 gives 5 dice', () => {
      const stats = basePlayerStats({
        rules: '5e',
        class: { ...basePlayerStats().class, name: 'Fighter', major: { name: 'Battle Master' } },
        level: 10,
        class_levels: [{ level: 10 }],
      });
      const result = computeTrackedResources(stats);
      expect(result.superiorityDice).toEqual({ current: 5, max: 5 });
    });

    it('5e: level < 7 gives 4 dice', () => {
      const stats = basePlayerStats({
        rules: '5e',
        class: { ...basePlayerStats().class, name: 'Fighter', major: { name: 'Battle Master' } },
        level: 5,
        class_levels: [{ level: 5 }],
      });
      const result = computeTrackedResources(stats);
      expect(result.superiorityDice).toEqual({ current: 4, max: 4 });
    });

    it('2024: Battle Master gives 4 dice at any level', () => {
      const stats = basePlayerStats({
        rules: '2024',
        class: { ...basePlayerStats().class, name: 'Fighter', major: { name: 'Battle Master' } },
        level: 5,
        class_levels: [{ level: 5 }],
      });
      const result = computeTrackedResources(stats);
      expect(result.superiorityDice).toEqual({ current: 4, max: 4 });
    });

    it('non-Battle Master Fighter has 0 dice', () => {
      const stats = basePlayerStats({
        rules: '5e',
        class: { ...basePlayerStats().class, name: 'Fighter', major: { name: 'Champion' } },
        level: 15,
        class_levels: [{ level: 15 }],
      });
      const result = computeTrackedResources(stats);
      expect(result.superiorityDice).toEqual({ current: 0, max: 0 });
    });
  });

  // ── psionicEnergy (Psi Warrior) ──

  describe('psionicEnergy', () => {
    it('sets when energy.required_major matches major class name', () => {
      const stats = basePlayerStats({
        class: {
          ...basePlayerStats().class,
          name: 'Fighter',
          major: { name: 'Psi Warrior' },
          subclass: { name: 'Psi Warrior' },
          class_levels: [{ level: 5, energy: { required_major: 'Psi Warrior', energy_die_num: 3 } }],
        },
      });
      const result = computeTrackedResources(stats);
      expect(result.psionicEnergy).toEqual({ current: 3, max: 3 });
    });

    it('does not match when subclass differs from major but energy matches subclass', () => {
      // Source uses `major?.name || subclass?.name` so when major is "Champion",
      // it short-circuits and never checks subclass
      const stats = basePlayerStats({
        class: {
          ...basePlayerStats().class,
          name: 'Fighter',
          major: { name: 'Champion' },
          subclass: { name: 'Psi Warrior' },
          class_levels: [{ level: 5, energy: { required_major: 'Psi Warrior', energy_die_num: 4 } }],
        },
      });
      const result = computeTrackedResources(stats);
      expect(result.psionicEnergy).toEqual({ current: 0, max: 0 });
    });

    it('defaults to 0 when energy required_major does not match', () => {
      const stats = basePlayerStats({
        class: {
          ...basePlayerStats().class,
          major: { name: 'Champion' },
          class_levels: [{ level: 5, energy: { required_major: 'Psi Warrior', energy_die_num: 3 } }],
        },
      });
      const result = computeTrackedResources(stats);
      expect(result.psionicEnergy).toEqual({ current: 0, max: 0 });
    });

    it('defaults to 0 when no energy on classLevel', () => {
      const stats = basePlayerStats({
        class: { ...basePlayerStats().class, major: { name: 'Psi Warrior' } },
      });
      const result = computeTrackedResources(stats);
      expect(result.psionicEnergy).toEqual({ current: 0, max: 0 });
    });
  });

  // ── arcaneRecoveryLevels ──

  describe('arcaneRecoveryLevels', () => {
    it('sets from features.arcaneRecoveryLevels', () => {
      getClassFeatures.mockReturnValue({ arcaneRecoveryLevels: 3 });
      const result = computeTrackedResources(basePlayerStats());
      expect(result.arcaneRecoveryLevels).toEqual({ current: 3, max: 3 });
    });

    it('defaults to 0 when not in features', () => {
      getClassFeatures.mockReturnValue(null);
      const result = computeTrackedResources(basePlayerStats());
      expect(result.arcaneRecoveryLevels).toEqual({ current: 0, max: 0 });
    });
  });

  // ── warlockPactMagic ──

  describe('warlockPactMagic', () => {
    it('5e: sets from class_specific.pact_slots on matching class level', () => {
      const stats = basePlayerStats({
        rules: '5e',
        class: { ...basePlayerStats().class, name: 'Warlock', class_levels: [{ level: 5, class_specific: { pact_slots: 2 } }] },
      });
      const result = computeTrackedResources(stats);
      expect(result.warlockPactMagic).toEqual({ current: 2, max: 2 });
    });

    it('2024: sets from classLevel.pact_slot_levels', () => {
      const stats = basePlayerStats({
        rules: '2024',
        class: { ...basePlayerStats().class, name: 'Warlock', class_levels: [{ level: 5, pact_slot_levels: 3 }] },
      });
      const result = computeTrackedResources(stats);
      expect(result.warlockPactMagic).toEqual({ current: 3, max: 3 });
    });

    it('non-warlock has 0 pact magic', () => {
      const stats = basePlayerStats({
        class: { ...basePlayerStats().class, name: 'Wizard' },
      });
      const result = computeTrackedResources(stats);
      expect(result.warlockPactMagic).toEqual({ current: 0, max: 0 });
    });
  });

  // ── sorcerousRestorationUses ──

  describe('sorcerousRestorationUses', () => {
    it('sets to 1 when automation.passives includes resource_restoration', () => {
      const stats = basePlayerStats({
        automation: { passives: [{ type: 'resource_restoration' }] },
      });
      const result = computeTrackedResources(stats);
      expect(result.sorcerousRestorationUses).toEqual({ current: 1, max: 1 });
    });

    it('defaults to 0 when no resource_restoration passive', () => {
      const stats = basePlayerStats({
        automation: { passives: [{ type: 'other_type' }] },
      });
      const result = computeTrackedResources(stats);
      expect(result.sorcerousRestorationUses).toEqual({ current: 0, max: 0 });
    });

    it('defaults to 0 when automation.passives is missing', () => {
      const result = computeTrackedResources(basePlayerStats());
      expect(result.sorcerousRestorationUses).toEqual({ current: 0, max: 0 });
    });

    it('defaults to 0 when automation is missing entirely', () => {
      const stats = basePlayerStats();
      delete stats.automation;
      const result = computeTrackedResources(stats);
      expect(result.sorcerousRestorationUses).toEqual({ current: 0, max: 0 });
    });
  });

  // ── uncannymetabolismUses ──

  describe('uncannymetabolismUses', () => {
    it('sets from features.uncannymetabolismUses', () => {
      getClassFeatures.mockReturnValue({ uncannymetabolismUses: 2 });
      const result = computeTrackedResources(basePlayerStats());
      expect(result.uncannymetabolismUses).toEqual({ current: 2, max: 2 });
    });

    it('defaults to 0 when not in features', () => {
      getClassFeatures.mockReturnValue(null);
      const result = computeTrackedResources(basePlayerStats());
      expect(result.uncannymetabolismUses).toEqual({ current: 0, max: 0 });
    });
  });

  // ── luckyPoints (Lucky feat) ──

  describe('luckyPoints', () => {
    it('sets from Lucky feat: 3 + floor(level/2)', () => {
      const stats = basePlayerStats({ feats: [{ name: 'Lucky' }], level: 6 });
      const result = computeTrackedResources(stats);
      expect(result.luckyPoints).toEqual({ current: 6, max: 6 });
    });

    it('is case-insensitive for feat name', () => {
      const stats = basePlayerStats({ feats: [{ name: 'lucky' }], level: 4 });
      const result = computeTrackedResources(stats);
      expect(result.luckyPoints).toEqual({ current: 5, max: 5 });
    });

    it('defaults to 0 when no Lucky feat', () => {
      const stats = basePlayerStats({ feats: [{ name: 'Alert' }] });
      const result = computeTrackedResources(stats);
      expect(result.luckyPoints).toEqual({ current: 0, max: 0 });
    });

    it('defaults to 0 when feats array is empty', () => {
      const stats = basePlayerStats({ feats: [] });
      const result = computeTrackedResources(stats);
      expect(result.luckyPoints).toEqual({ current: 0, max: 0 });
    });
  });

  // ── divineInterventionUses (Cleric) ──

  describe('divineInterventionUses', () => {
    it('sets to 1 for cleric level >= 10', () => {
      const stats = basePlayerStats({
        class: { ...basePlayerStats().class, name: 'Cleric' },
        level: 10,
      });
      const result = computeTrackedResources(stats);
      expect(result.divineInterventionUses).toEqual({ current: 1, max: 1 });
    });

    it('sets to 0 for cleric level < 10', () => {
      const stats = basePlayerStats({
        class: { ...basePlayerStats().class, name: 'Cleric' },
        level: 5,
      });
      const result = computeTrackedResources(stats);
      expect(result.divineInterventionUses).toEqual({ current: 0, max: 0 });
    });

    it('sets to 0 for non-cleric', () => {
      const stats = basePlayerStats({
        class: { ...basePlayerStats().class, name: 'Wizard' },
        level: 15,
      });
      const result = computeTrackedResources(stats);
      expect(result.divineInterventionUses).toEqual({ current: 0, max: 0 });
    });
  });

  // ── wholenessofbodyUses (Monk) ──

  describe('wholenessofbodyUses', () => {
    it('sets to 1 for monk level >= 6', () => {
      const stats = basePlayerStats({
        class: { ...basePlayerStats().class, name: 'Monk' },
        level: 6,
      });
      const result = computeTrackedResources(stats);
      expect(result.wholenessofbodyUses).toEqual({ current: 1, max: 1 });
    });

    it('sets to 0 for monk level < 6', () => {
      const stats = basePlayerStats({
        class: { ...basePlayerStats().class, name: 'Monk' },
        level: 3,
      });
      const result = computeTrackedResources(stats);
      expect(result.wholenessofbodyUses).toEqual({ current: 0, max: 0 });
    });

    it('sets to 0 for non-monk', () => {
      const stats = basePlayerStats({
        class: { ...basePlayerStats().class, name: 'Barbarian' },
        level: 10,
      });
      const result = computeTrackedResources(stats);
      expect(result.wholenessofbodyUses).toEqual({ current: 0, max: 0 });
    });
  });

  // ── warPriestUses (Cleric) ──

  describe('warPriestUses', () => {
    it('sets to wisdom bonus when bonus >= 1', () => {
      const stats = basePlayerStats({
        class: { ...basePlayerStats().class, name: 'Cleric' },
        abilities: [{ name: 'Wisdom', bonus: 3 }],
      });
      const result = computeTrackedResources(stats);
      expect(result.warPriestUses).toEqual({ current: 3, max: 3 });
    });

    it('defaults to 1 when wisdom bonus is 0', () => {
      const stats = basePlayerStats({
        class: { ...basePlayerStats().class, name: 'Cleric' },
        abilities: [{ name: 'Wisdom', bonus: 0 }],
      });
      const result = computeTrackedResources(stats);
      expect(result.warPriestUses).toEqual({ current: 1, max: 1 });
    });

    it('defaults to 1 when no Wisdom ability', () => {
      const stats = basePlayerStats({
        class: { ...basePlayerStats().class, name: 'Cleric' },
        abilities: [],
      });
      const result = computeTrackedResources(stats);
      expect(result.warPriestUses).toEqual({ current: 1, max: 1 });
    });

    it('caps negative wisdom bonus at 1', () => {
      const stats = basePlayerStats({
        class: { ...basePlayerStats().class, name: 'Cleric' },
        abilities: [{ name: 'Wisdom', bonus: -2 }],
      });
      const result = computeTrackedResources(stats);
      expect(result.warPriestUses).toEqual({ current: 1, max: 1 });
    });

    it('non-cleric still gets warPriestUses from Wisdom ability (no class check)', () => {
      // Source does not check class name for warPriestUses
      const stats = basePlayerStats({
        class: { ...basePlayerStats().class, name: 'Wizard' },
        abilities: [{ name: 'Wisdom', bonus: 5 }],
      });
      const result = computeTrackedResources(stats);
      expect(result.warPriestUses).toEqual({ current: 5, max: 5 });
    });
  });
});

// ── applyServerOverride ─────────────────────────────────────────

describe('applyServerOverride', () => {
  it('returns a shallow copy when serverData is null', () => {
    const computed = { hitPoints: { current: 10, max: 20 } };
    const result = applyServerOverride(computed, null);
    expect(result).toEqual(computed);
    expect(result).not.toBe(computed);
  });

  it('returns a shallow copy when serverData is undefined', () => {
    const computed = { hitPoints: { current: 10, max: 20 } };
    const result = applyServerOverride(computed, undefined);
    expect(result).toEqual(computed);
    expect(result).not.toBe(computed);
  });

  it('returns a shallow copy when serverData is a non-object primitive', () => {
    const computed = { hitPoints: { current: 10, max: 20 } };
    expect(applyServerOverride(computed, 42)).toEqual(computed);
    expect(applyServerOverride(computed, 'string')).toEqual(computed);
    expect(applyServerOverride(computed, [])).toEqual(computed);
  });

  it('overrides current value for known keys present in computed resources', () => {
    const computed = {
      hitPoints: { current: 20, max: 20 },
      sorceryPoints: { current: 5, max: 5 },
    };
    const result = applyServerOverride(computed, {
      hitPoints: 12,
      sorceryPoints: 3,
    });
    expect(result.hitPoints).toEqual({ current: 12, max: 20 });
    expect(result.sorceryPoints).toEqual({ current: 3, max: 5 });
  });

  it('does not override when serverValue is null', () => {
    const computed = { hitPoints: { current: 20, max: 20 } };
    const result = applyServerOverride(computed, { hitPoints: null });
    expect(result.hitPoints).toEqual({ current: 20, max: 20 });
  });

  it('does not override when serverValue is undefined', () => {
    const computed = { hitPoints: { current: 20, max: 20 } };
    const result = applyServerOverride(computed, { hitPoints: undefined });
    expect(result.hitPoints).toEqual({ current: 20, max: 20 });
  });

  it('overrides with 0 when serverValue is 0 (falsy but valid)', () => {
    const computed = { hitPoints: { current: 20, max: 20 } };
    const result = applyServerOverride(computed, { hitPoints: 0 });
    expect(result.hitPoints).toEqual({ current: 0, max: 20 });
  });

  it('ignores unknown keys not in ALL_TRACKED_RESOURCES', () => {
    const computed = { hitPoints: { current: 20, max: 20 } };
    const result = applyServerOverride(computed, { unknownKey: 99 });
    expect(result.unknownKey).toBeUndefined();
  });

  it('adds unknown keys that ARE in ALL_TRACKED_RESOURCES', () => {
    const computed = { hitPoints: { current: 20, max: 20 } };
    const result = applyServerOverride(computed, { kiPoints: 4 });
    expect(result.kiPoints).toEqual({ current: 4, max: 4 });
  });

  it('does not add unknown keys that are NOT in ALL_TRACKED_RESOURCES', () => {
    const computed = { hitPoints: { current: 20, max: 20 } };
    const result = applyServerOverride(computed, { someRandomKey: 10 });
    expect(result.someRandomKey).toBeUndefined();
  });

  it('preserves computed entries not overridden by serverData', () => {
    const computed = {
      hitPoints: { current: 20, max: 20 },
      sorceryPoints: { current: 5, max: 5 },
      kiPoints: { current: 3, max: 3 },
    };
    const result = applyServerOverride(computed, { hitPoints: 15 });
    expect(result.sorceryPoints).toEqual({ current: 5, max: 5 });
    expect(result.kiPoints).toEqual({ current: 3, max: 3 });
  });
});

// ── trackedResourcesToStoreEntries ──────────────────────────────

describe('trackedResourcesToStoreEntries', () => {
  it('extracts current values from tracked resources', () => {
    const tracked = {
      hitPoints: { current: 20, max: 20 },
      sorceryPoints: { current: 3, max: 5 },
      kiPoints: { current: 0, max: 3 },
    };
    const result = trackedResourcesToStoreEntries(tracked);
    expect(result).toEqual({
      hitPoints: 20,
      sorceryPoints: 3,
      kiPoints: 0,
    });
  });

  it('returns empty object for empty input', () => {
    expect(trackedResourcesToStoreEntries({})).toEqual({});
  });

  it('handles negative current values', () => {
    const result = trackedResourcesToStoreEntries({
      hitPoints: { current: -5, max: 20 },
    });
    expect(result).toEqual({ hitPoints: -5 });
  });

  it('handles zero current values', () => {
    const result = trackedResourcesToStoreEntries({
      hitPoints: { current: 0, max: 20 },
    });
    expect(result).toEqual({ hitPoints: 0 });
  });

  it('preserves all keys from tracked resources', () => {
    const tracked = {
      hitPoints: { current: 10, max: 20 },
      spell_slots_level_1: { current: 2, max: 4 },
      spell_slots_level_2: { current: 1, max: 3 },
    };
    const result = trackedResourcesToStoreEntries(tracked);
    expect(Object.keys(result).sort()).toEqual([
      'hitPoints',
      'spell_slots_level_1',
      'spell_slots_level_2',
    ]);
  });
});
