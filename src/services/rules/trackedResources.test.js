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
import {
  ALL_TRACKED_RESOURCES,
  computeTrackedResources,
  applyServerOverride,
  trackedResourcesToStoreEntries,
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

// ── ALL_TRACKED_RESOURCES ───────────────────────────────────────

describe('ALL_TRACKED_RESOURCES', () => {
  it('is an array of tracked resource key strings', () => {
    expect(Array.isArray(ALL_TRACKED_RESOURCES)).toBe(true);
    expect(ALL_TRACKED_RESOURCES.every((k) => typeof k === 'string')).toBe(true);
  });

  it('contains all expected resource keys for core mechanics', () => {
    const expected = [
      'currentHitPoints', 'hitPoints', 'spell_slots_level_1', 'spell_slots_level_9',
      'shortRestHitDice', 'sorceryPoints', 'bardicInspirationUses', 'luckyPoints', 'warlockPactMagic',
    ];
    for (const key of expected) expect(ALL_TRACKED_RESOURCES).toContain(key);
  });

  it('contains both casing variants for second wind', () => {
    expect(ALL_TRACKED_RESOURCES).toContain('secondWindUses');
    expect(ALL_TRACKED_RESOURCES).toContain('secondwindUses');
  });
});

// ── computeTrackedResources ─────────────────────────────────────

describe('computeTrackedResources', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty object when playerStats is null', () => {
    expect(computeTrackedResources(null)).toEqual({});
  });

  it('sets hitPoints and currentHitPoints from playerStats.hitPoints', () => {
    const result = computeTrackedResources(basePlayerStats({ hitPoints: 35 }));
    expect(result.hitPoints).toEqual({ current: 35, max: 35 });
    expect(result.currentHitPoints).toEqual({ current: 35, max: 35 });
  });

  it('computes all 9 spell slot levels from spellAbilities', () => {
    const slotValues = { spell_slots_level_1: 4, spell_slots_level_2: 3, spell_slots_level_3: 3, spell_slots_level_4: 3, spell_slots_level_5: 2, spell_slots_level_6: 1, spell_slots_level_7: 1, spell_slots_level_8: 1, spell_slots_level_9: 1 };
    const result = computeTrackedResources(basePlayerStats({ spellAbilities: slotValues }));
    for (const [key, value] of Object.entries(slotValues)) expect(result[key]).toEqual({ current: value, max: value });
  });

  it('sets shortRestHitDice from playerStats.level', () => {
    expect(computeTrackedResources(basePlayerStats({ level: 8 })).shortRestHitDice).toEqual({ current: 8, max: 8 });
  });

  it('sets sorceryPoints from features.maxSorceryPoints', () => {
    getClassFeatures.mockReturnValue({ maxSorceryPoints: 5 });
    expect(computeTrackedResources(basePlayerStats()).sorceryPoints).toEqual({ current: 5, max: 5 });
  });

  it('sets innateSorceryUses from features.maxInnateSorcery', () => {
    getClassFeatures.mockReturnValue({ maxInnateSorcery: 3 });
    expect(computeTrackedResources(basePlayerStats()).innateSorceryUses).toEqual({ current: 3, max: 3 });
  });

  it('sets focusPoints/kiPoints from classLevel.focus_points or falls back to features.maxFocusPoints', () => {
    getClassFeatures.mockReturnValue({ maxFocusPoints: 4 });
    let result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, class_levels: [{ level: 5, focus_points: 2 }] } }));
    expect(result.focusPoints).toEqual({ current: 2, max: 2 });
    expect(result.kiPoints).toEqual({ current: 2, max: 2 });
    result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, class_levels: [{ level: 5 }] } }));
    expect(result.focusPoints).toEqual({ current: 4, max: 4 });
    expect(result.kiPoints).toEqual({ current: 4, max: 4 });
  });

  it('sets channelDivinityCharges from features.maxChannelDivinity', () => {
    getClassFeatures.mockReturnValue({ maxChannelDivinity: 2 });
    expect(computeTrackedResources(basePlayerStats()).channelDivinityCharges).toEqual({ current: 2, max: 2 });
  });

  it('sets bardicInspirationUses from Charisma bonus for Bard class', () => {
    let result = computeTrackedResources(basePlayerStats({ class: { name: 'Bard', class_levels: [], major: {}, subclass: {} }, abilities: [{ name: 'Charisma', bonus: 3 }] }));
    expect(result.bardicInspirationUses).toEqual({ current: 3, max: 3 });
    result = computeTrackedResources(basePlayerStats({ class: { name: 'Bard', class_levels: [], major: {}, subclass: {} }, abilities: [] }));
    expect(result.bardicInspirationUses).toEqual({ current: 0, max: 0 });
  });

  it('sets wildShapeUses from features.maxWildShapeUses', () => {
    getClassFeatures.mockReturnValue({ maxWildShapeUses: 2 });
    expect(computeTrackedResources(basePlayerStats()).wildShapeUses).toEqual({ current: 2, max: 2 });
  });

  it('sets secondWindUses/secondwindUses from classLevel.second_wind matching level', () => {
    let result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, class_levels: [{ level: 5, second_wind: 1 }] }, level: 5 }));
    expect(result.secondWindUses).toEqual({ current: 1, max: 1 });
    expect(result.secondwindUses).toEqual({ current: 1, max: 1 });
    result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, class_levels: [{ level: 3, second_wind: 1 }] }, level: 5 }));
    expect(result.secondWindUses).toEqual({ current: 0, max: 0 });
    expect(result.secondwindUses).toEqual({ current: 0, max: 0 });
  });

  describe('actionSurge (Fighter)', () => {
    it('5e: sets from class_specific.action_surges on matching class level', () => {
      getClassFeatures.mockReturnValue(null);
      const result = computeTrackedResources(basePlayerStats({ rules: '5e', level: 7, class: { ...basePlayerStats().class, name: 'Fighter', class_levels: [{ level: 7, class_specific: { action_surges: 2 } }] } }));
      expect(result.actionSurgeUses).toEqual({ current: 2, max: 2 });
      expect(result.actionsurgeUses).toEqual({ current: 2, max: 2 });
    });

    it('2024: level >= 17 gives 2, >= 2 gives 1, < 2 gives 0', () => {
      const make = (lvl) => basePlayerStats({ rules: '2024', class: { ...basePlayerStats().class, name: 'Fighter' }, level: lvl });
      expect(computeTrackedResources(make(17)).actionSurgeUses).toEqual({ current: 2, max: 2 });
      expect(computeTrackedResources(make(5)).actionSurgeUses).toEqual({ current: 1, max: 1 });
      expect(computeTrackedResources(make(1)).actionSurgeUses).toEqual({ current: 0, max: 0 });
    });

    it('non-fighter has 0 action surges', () => {
      expect(computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Wizard' } })).actionSurgeUses).toEqual({ current: 0, max: 0 });
    });
  });

  describe('ragePoints (Barbarian)', () => {
    it('5e: sets from class_specific.rage_count; 2024: sets from classLevel.rages', () => {
      let result = computeTrackedResources(basePlayerStats({ rules: '5e', class: { ...basePlayerStats().class, name: 'Barbarian', class_levels: [{ level: 5, class_specific: { rage_count: 2 } }] } }));
      expect(result.ragePoints).toEqual({ current: 2, max: 2 });
      result = computeTrackedResources(basePlayerStats({ rules: '2024', class: { ...basePlayerStats().class, name: 'Barbarian', class_levels: [{ level: 5, rages: 3 }] } }));
      expect(result.ragePoints).toEqual({ current: 3, max: 3 });
    });

    it('2024: defaults rages to 0 when missing; non-barbarian has 0', () => {
      let result = computeTrackedResources(basePlayerStats({ rules: '2024', class: { ...basePlayerStats().class, name: 'Barbarian', class_levels: [{ level: 5 }] } }));
      expect(result.ragePoints).toEqual({ current: 0, max: 0 });
      result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Cleric' } }));
      expect(result.ragePoints).toEqual({ current: 0, max: 0 });
    });
  });

  describe('layOnHandsPool (Paladin)', () => {
    it('sets pool to 5 * level for paladin', () => {
      expect(computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Paladin' }, level: 5 })).layOnHandsPool).toEqual({ current: 25, max: 25 });
    });

    it('defaults level to 0; non-paladin has 0', () => {
      let result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Paladin' }, level: undefined })).layOnHandsPool;
      expect(result).toEqual({ current: 0, max: 0 });
      result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Sorcerer' } })).layOnHandsPool;
      expect(result).toEqual({ current: 0, max: 0 });
    });
  });

  describe('superiorityDice (Battle Master Fighter)', () => {
    it('5e: level >= 15 gives 6, >= 7 gives 5, < 7 gives 4', () => {
      const make = (lvl) => basePlayerStats({ rules: '5e', class: { ...basePlayerStats().class, name: 'Fighter', major: { name: 'Battle Master' } }, level: lvl, class_levels: [{ level: lvl }] });
      expect(computeTrackedResources(make(15)).superiorityDice).toEqual({ current: 6, max: 6 });
      expect(computeTrackedResources(make(10)).superiorityDice).toEqual({ current: 5, max: 5 });
      expect(computeTrackedResources(make(5)).superiorityDice).toEqual({ current: 4, max: 4 });
    });

    it('2024: uses classLevel.superiority_dice', () => {
      const make = (lvl, dice) => basePlayerStats({ rules: '2024', class: { ...basePlayerStats().class, name: 'Fighter', major: { name: 'Battle Master' }, class_levels: [{ level: lvl, superiority_dice: dice }] }, level: lvl });
      expect(computeTrackedResources(make(5, 4)).superiorityDice).toEqual({ current: 4, max: 4 });
      expect(computeTrackedResources(make(10, 5)).superiorityDice).toEqual({ current: 5, max: 5 });
      expect(computeTrackedResources(make(15, 6)).superiorityDice).toEqual({ current: 6, max: 6 });
      expect(computeTrackedResources(make(2, 0)).superiorityDice).toEqual({ current: 0, max: 0 });
    });

    it('non-Battle Master Fighter has 0; Superior Technique style gets 1', () => {
      let result = computeTrackedResources(basePlayerStats({ rules: '5e', class: { ...basePlayerStats().class, name: 'Fighter', major: { name: 'Champion' } }, level: 15, class_levels: [{ level: 15 }] })).superiorityDice;
      expect(result).toEqual({ current: 0, max: 0 });
      result = computeTrackedResources(basePlayerStats({ rules: '5e', class: { ...basePlayerStats().class, name: 'Fighter', major: { name: 'Champion' }, fightingStyles: ['Superior Technique'] }, level: 5, class_levels: [{ level: 5 }] })).superiorityDice;
      expect(result).toEqual({ current: 1, max: 1 });
    });
  });

  describe('psionicEnergy (Psi Warrior)', () => {
    it('sets when energy.required_major matches major or subclass name', () => {
      let result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Fighter', major: { name: 'Psi Warrior' }, subclass: { name: 'Psi Warrior' }, class_levels: [{ level: 5, energy: { required_major: 'Psi Warrior', energy_die_num: 3 } }] } })).psionicEnergy;
      expect(result).toEqual({ current: 3, max: 3 });
      result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Fighter', major: {}, subclass: { name: 'Psi Warrior' }, class_levels: [{ level: 5, energy: { required_major: 'Psi Warrior', energy_die_num: 2 } }] } })).psionicEnergy;
      expect(result).toEqual({ current: 2, max: 2 });
    });

    it('defaults to 0 when energy required_major does not match / missing / no energy', () => {
      let result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, major: { name: 'Champion' }, class_levels: [{ level: 5, energy: { required_major: 'Psi Warrior', energy_die_num: 3 } }] } })).psionicEnergy;
      expect(result).toEqual({ current: 0, max: 0 });
      result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, major: { name: 'Psi Warrior' } } })).psionicEnergy;
      expect(result).toEqual({ current: 0, max: 0 });
      result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Fighter', major: { name: 'Psi Warrior' }, subclass: { name: 'Psi Warrior' }, class_levels: [{ level: 5, energy: { required_major: 'Psi Warrior' } }] } })).psionicEnergy;
      expect(result).toEqual({ current: 0, max: 0 });
    });
  });

  it('sets arcaneRecoveryLevels from features.arcaneRecoveryLevels', () => {
    getClassFeatures.mockReturnValue({ arcaneRecoveryLevels: 3 });
    expect(computeTrackedResources(basePlayerStats()).arcaneRecoveryLevels).toEqual({ current: 3, max: 3 });
  });

  describe('warlockPactMagic', () => {
    it('5e: sets from class_specific.pact_slots; 2024: sets from classLevel.pact_slot_levels', () => {
      let result = computeTrackedResources(basePlayerStats({ rules: '5e', class: { ...basePlayerStats().class, name: 'Warlock', class_levels: [{ level: 5, class_specific: { pact_slots: 2 } }] } })).warlockPactMagic;
      expect(result).toEqual({ current: 2, max: 2 });
      result = computeTrackedResources(basePlayerStats({ rules: '2024', class: { ...basePlayerStats().class, name: 'Warlock', class_levels: [{ level: 5, pact_slot_levels: 3 }] } })).warlockPactMagic;
      expect(result).toEqual({ current: 3, max: 3 });
    });

    it('non-warlock has 0; 2024 defaults pact_slot_levels to 0 when missing', () => {
      let result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Wizard' } })).warlockPactMagic;
      expect(result).toEqual({ current: 0, max: 0 });
      result = computeTrackedResources(basePlayerStats({ rules: '2024', class: { ...basePlayerStats().class, name: 'Warlock', class_levels: [{ level: 5 }] } })).warlockPactMagic;
      expect(result).toEqual({ current: 0, max: 0 });
    });
  });

  it('sets sorcerousRestorationUses from resource_restoration passive', () => {
    let result = computeTrackedResources(basePlayerStats({ automation: { passives: [{ type: 'resource_restoration' }] } })).sorcerousRestorationUses;
    expect(result).toEqual({ current: 1, max: 1 });
    result = computeTrackedResources(basePlayerStats({ automation: { passives: [{ type: 'other_type' }] } })).sorcerousRestorationUses;
    expect(result).toEqual({ current: 0, max: 0 });
  });

  it('sets uncannymetabolismUses from features.uncannymetabolismUses', () => {
    getClassFeatures.mockReturnValue({ uncannymetabolismUses: 2 });
    expect(computeTrackedResources(basePlayerStats()).uncannymetabolismUses).toEqual({ current: 2, max: 2 });
  });

  describe('luckyPoints (Lucky feat)', () => {
    it('sets from proficiency when Lucky feat present; case-insensitive', () => {
      let result = computeTrackedResources(basePlayerStats({ feats: ['Lucky'], proficiency: 3 })).luckyPoints;
      expect(result).toEqual({ current: 3, max: 3 });
      result = computeTrackedResources(basePlayerStats({ feats: ['lucky'], proficiency: 4 })).luckyPoints;
      expect(result).toEqual({ current: 4, max: 4 });
    });

    it('defaults to 0 when no Lucky feat / null proficiency / null feats / undefined feats / null-undefined in feats', () => {
      let result = computeTrackedResources(basePlayerStats({ feats: ['Alert'] })).luckyPoints;
      expect(result).toEqual({ current: 0, max: 0 });
      result = computeTrackedResources(basePlayerStats({ feats: ['Lucky'], proficiency: undefined })).luckyPoints;
      expect(result).toEqual({ current: 0, max: 0 });
      result = computeTrackedResources(basePlayerStats({ feats: null })).luckyPoints;
      expect(result).toEqual({ current: 0, max: 0 });
      result = computeTrackedResources(basePlayerStats({ feats: undefined })).luckyPoints;
      expect(result).toEqual({ current: 0, max: 0 });
      result = computeTrackedResources(basePlayerStats({ feats: [null, 'Alert', undefined] })).luckyPoints;
      expect(result).toEqual({ current: 0, max: 0 });
    });
  });

  describe('divineInterventionUses (Cleric)', () => {
    it('sets to 1 for cleric level >= 10; 0 for level < 10; 0 for non-cleric', () => {
      let result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Cleric' }, level: 10 })).divineInterventionUses;
      expect(result).toEqual({ current: 1, max: 1 });
      result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Cleric' }, level: 5 })).divineInterventionUses;
      expect(result).toEqual({ current: 0, max: 0 });
      result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Wizard' }, level: 15 })).divineInterventionUses;
      expect(result).toEqual({ current: 0, max: 0 });
    });
  });

  describe('wholenessofbodyUses (Monk)', () => {
    it('sets to 1 for monk level >= 6; 0 for level < 6; 0 for non-monk', () => {
      let result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Monk' }, level: 6 })).wholenessofbodyUses;
      expect(result).toEqual({ current: 1, max: 1 });
      result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Monk' }, level: 3 })).wholenessofbodyUses;
      expect(result).toEqual({ current: 0, max: 0 });
      result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Barbarian' }, level: 10 })).wholenessofbodyUses;
      expect(result).toEqual({ current: 0, max: 0 });
    });
  });

  describe('warPriestUses (Cleric)', () => {
    it('sets to wisdom bonus when >= 1; defaults to 1 when 0/negative/missing', () => {
      let result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Cleric' }, abilities: [{ name: 'Wisdom', bonus: 3 }] })).warPriestUses;
      expect(result).toEqual({ current: 3, max: 3 });
      result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Cleric' }, abilities: [{ name: 'Wisdom', bonus: 0 }] })).warPriestUses;
      expect(result).toEqual({ current: 1, max: 1 });
      result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Cleric' }, abilities: [{ name: 'Wisdom', bonus: -2 }] })).warPriestUses;
      expect(result).toEqual({ current: 1, max: 1 });
      result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Cleric' }, abilities: [] })).warPriestUses;
      expect(result).toEqual({ current: 1, max: 1 });
    });
  });

  describe('arcaneWard (Wizard)', () => {
    it('sets arcaneWardMax/arcaneWardHp when arcane_ward passive exists', () => {
      let result = computeTrackedResources(basePlayerStats({ automation: { passives: [{ type: 'arcane_ward' }] }, level: 6, abilities: [{ name: 'Intelligence', bonus: 3 }] }));
      expect(result.arcaneWardMax).toEqual({ current: 15, max: 15 });
      expect(result.arcaneWardHp).toEqual({ current: 15, max: 15 });
      result = computeTrackedResources(basePlayerStats({ automation: { passives: [{ type: 'passive_rule', effect: 'arcane_ward' }] }, level: 4, abilities: [{ name: 'Intelligence', bonus: 2 }] }));
      expect(result.arcaneWardMax).toEqual({ current: 10, max: 10 });
    });

    it('defaults to 0 when no arcane_ward passive', () => {
      const result = computeTrackedResources(basePlayerStats({ automation: { passives: [{ type: 'other_type' }] }, level: 6 }));
      expect(result.arcaneWardMax).toEqual({ current: 0, max: 0 });
      expect(result.arcaneWardHp).toEqual({ current: 0, max: 0 });
    });
  });

  describe('mysticArcanum (Warlock)', () => {
    it('sets mystic arcunum levels from features.arcanumLevels', () => {
      getClassFeatures.mockReturnValue({ arcanumLevels: { level6: 1, level7: 1, level8: 1, level9: 1 } });
      const result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Warlock' } }));
      expect(result.mysticArcanumLevel6).toEqual({ current: 1, max: 1 });
      expect(result.mysticArcanumLevel7).toEqual({ current: 1, max: 1 });
      expect(result.mysticArcanumLevel8).toEqual({ current: 1, max: 1 });
      expect(result.mysticArcanumLevel9).toEqual({ current: 1, max: 1 });
    });

    it('does not set mystic arcunum keys when arcanumLevels missing or non-warlock', () => {
      getClassFeatures.mockReturnValue(null);
      let result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Warlock' } }));
      expect(result.mysticArcanumLevel6).toBeUndefined();
      getClassFeatures.mockReturnValue({ arcanumLevels: { level6: 1 } });
      result = computeTrackedResources(basePlayerStats());
      expect(result.mysticArcanumLevel6).toBeUndefined();
    });
  });

  describe('tranceOfOrderUses', () => {
    // CLA-364 BUG-A: no longer seeded — handler-owned null-as-available latch.
    it('is never seeded (CLA-364: null-as-available handler latch)', () => {
      let result = computeTrackedResources(basePlayerStats({ automation: { bonusActions: [{ type: 'trance_of_order' }] } })).tranceOfOrderUses;
      expect(result).toBeUndefined();
      result = computeTrackedResources(basePlayerStats({ automation: { bonusActions: [{ type: 'other_type' }] } })).tranceOfOrderUses;
      expect(result).toBeUndefined();
    });
  });

  describe('darkOnesLuck (Warlock - Fiend Patron)', () => {
    it('sets from Charisma bonus for Fiend patron (major/subclass/Fiend Patron major/subclass)', () => {
      const tests = [
        { major: { name: 'Fiend' }, bonus: 3, expected: 3 },
        { subclass: { name: 'Fiend' }, bonus: 2, expected: 2 },
        { major: { name: 'Fiend Patron' }, bonus: 4, expected: 4 },
        { subclass: { name: 'Fiend Patron' }, bonus: 5, expected: 5 },
      ];
      for (const t of tests) {
        const cls = { ...basePlayerStats().class, name: 'Warlock', ...t };
        const result = computeTrackedResources(basePlayerStats({ class: cls, abilities: [{ name: 'Charisma', bonus: t.bonus }] })).darkOnesLuckUses;
        expect(result).toEqual({ current: t.expected, max: t.expected });
      }
    });

    it('defaults to 0 for non-Fiend patron; minimum of 1 when charisma bonus is 0', () => {
      let result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Warlock', major: { name: 'Archfey' } }, abilities: [{ name: 'Charisma', bonus: 3 }] })).darkOnesLuckUses;
      expect(result).toEqual({ current: 0, max: 0 });
      result = computeTrackedResources(basePlayerStats({ class: { ...basePlayerStats().class, name: 'Warlock', major: { name: 'Fiend' } }, abilities: [{ name: 'Charisma', bonus: 0 }] })).darkOnesLuckUses;
      expect(result).toEqual({ current: 1, max: 1 });
    });
  });

  describe('adrenalineRushUses', () => {
    it('sets from proficiency when specialActions includes bonus_action_dash; 0 otherwise', () => {
      let result = computeTrackedResources(basePlayerStats({ automation: { specialActions: [{ effect: 'bonus_action_dash' }] }, proficiency: 4 })).adrenalineRushUses;
      expect(result).toEqual({ current: 4, max: 4 });
      result = computeTrackedResources(basePlayerStats({ automation: { specialActions: [{ effect: 'other_effect' }] }, proficiency: 4 })).adrenalineRushUses;
      expect(result).toEqual({ current: 0, max: 0 });
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

  it('overrides current value for known keys; preserves un-overridden entries', () => {
    const computed = { hitPoints: { current: 20, max: 20 }, sorceryPoints: { current: 5, max: 5 }, kiPoints: { current: 3, max: 3 } };
    const result = applyServerOverride(computed, { hitPoints: 12, sorceryPoints: 3 });
    expect(result.hitPoints).toEqual({ current: 12, max: 20 });
    expect(result.sorceryPoints).toEqual({ current: 3, max: 5 });
    expect(result.kiPoints).toEqual({ current: 3, max: 3 });
  });

  it('does not override when serverValue is null; overrides with 0 (falsy but valid)', () => {
    expect(applyServerOverride({ hitPoints: { current: 20, max: 20 } }, { hitPoints: null }).hitPoints).toEqual({ current: 20, max: 20 });
    expect(applyServerOverride({ hitPoints: { current: 20, max: 20 } }, { hitPoints: 0 }).hitPoints).toEqual({ current: 0, max: 20 });
  });

  it('adds a new tracked resource when serverData has a known key not in computed', () => {
    const result = applyServerOverride({ hitPoints: { current: 20, max: 20 } }, { sorceryPoints: 3 });
    expect(result.hitPoints).toEqual({ current: 20, max: 20 });
    expect(result.sorceryPoints).toEqual({ current: 3, max: 3 });
  });

  it('ignores unknown keys not in ALL_TRACKED_RESOURCES', () => {
    expect(applyServerOverride({ hitPoints: { current: 20, max: 20 } }, { unknownKey: 99 }).unknownKey).toBeUndefined();
  });
});

// ── trackedResourcesToStoreEntries ──────────────────────────────

describe('trackedResourcesToStoreEntries', () => {
  it('extracts current values from tracked resources', () => {
    const tracked = { hitPoints: { current: 20, max: 20 }, sorceryPoints: { current: 3, max: 5 }, kiPoints: { current: 0, max: 3 } };
    expect(trackedResourcesToStoreEntries(tracked)).toEqual({ hitPoints: 20, sorceryPoints: 3, kiPoints: 0 });
  });

  it('returns empty object for empty input', () => {
    expect(trackedResourcesToStoreEntries({})).toEqual({});
  });
});
