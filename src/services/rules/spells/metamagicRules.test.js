// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
}));

vi.mock('../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn((abilities, name) => {
    const ability = abilities?.find((a) => a.name === name);
    return ability?.bonus || 0;
  }),
}));

// ── Imports ─────────────────────────────────────────────────────

import {
  METAMAGIC_EFFECTS,
  METAMAGIC_OPTIONS,
  getMetamagicCost,
  getPreCastOptions,
  getChaModifier,
  getMaxMetamagicPerSpell,
  isPreCastOption,
  hasArcaneApotheosis,
  computeMetamagicCost,
  getPsionicSpellsList,
  isPsionicSpell,
  hasPsionicSorcery,
} from './metamagicRules.js';

import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ─────────────────────────────────────────────────────

function makeStats(overrides = {}) {
  return {
    class: { name: 'Sorcerer' },
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

// ── METAMAGIC_EFFECTS ───────────────────────────────────────────

describe('METAMAGIC_EFFECTS', () => {
  it('exports all 8 metamagic effect identifiers as strings', () => {
    const expectedKeys = [
      'CAREFUL', 'DISTANT', 'EMPOWERED', 'EXTENDED',
      'HEIGHTENED', 'QUICKENED', 'SUBTLE', 'TWINNED',
    ];
    expect(Object.keys(METAMAGIC_EFFECTS)).toHaveLength(8);
    for (const key of expectedKeys) {
      expect(METAMAGIC_EFFECTS).toHaveProperty(key);
      expect(typeof METAMAGIC_EFFECTS[key]).toBe('string');
    }
  });
});

// ── METAMAGIC_OPTIONS ───────────────────────────────────────────

describe('METAMAGIC_OPTIONS', () => {
  it('exports 8 options with expected names, costs, and effects', () => {
    expect(METAMAGIC_OPTIONS).toHaveLength(8);
    const names = METAMAGIC_OPTIONS.map((o) => o.name);
    const expectedNames = [
      'Careful Spell', 'Distant Spell', 'Empowered Spell', 'Extended Spell',
      'Heightened Spell', 'Quickened Spell', 'Subtle Spell', 'Twinned Spell',
    ];
    for (const name of expectedNames) {
      expect(names).toContain(name);
    }
    const twinned = METAMAGIC_OPTIONS.find((o) => o.name === 'Twinned Spell');
    expect(twinned.cost).toBe('spell_level');
    const fixedOptions = METAMAGIC_OPTIONS.filter((o) => o.name !== 'Twinned Spell');
    for (const opt of fixedOptions) {
      expect(typeof opt.cost).toBe('number');
    }
    const empowered = METAMAGIC_OPTIONS.find((o) => o.name === 'Empowered Spell');
    const preCast = METAMAGIC_OPTIONS.filter((o) => o.effect !== empowered.effect);
    expect(preCast).toHaveLength(7);
  });
});

// ── getMetamagicCost ────────────────────────────────────────────

describe('getMetamagicCost', () => {
  it('returns the fixed cost when option cost is a number', () => {
    expect(getMetamagicCost({ cost: 1 }, 5)).toBe(1);
    expect(getMetamagicCost({ cost: 3 }, 10)).toBe(3);
  });

  it('returns spell level when option cost is spell_level', () => {
    expect(getMetamagicCost({ cost: 'spell_level' }, 3)).toBe(3);
    expect(getMetamagicCost({ cost: 'spell_level' }, 5)).toBe(5);
  });

  it('returns 1 when spell_level cost with zero, negative, or undefined spell level', () => {
    expect(getMetamagicCost({ cost: 'spell_level' }, 0)).toBe(1);
    expect(getMetamagicCost({ cost: 'spell_level' }, -2)).toBe(1);
    expect(getMetamagicCost({ cost: 'spell_level' }, undefined)).toBe(1);
  });
});

// ── getPreCastOptions ───────────────────────────────────────────

describe('getPreCastOptions', () => {
  it('returns empty array for invalid stats (null, no class, non-Sorcerer)', () => {
    expect(getPreCastOptions(null, 10, 1)).toEqual([]);
    expect(getPreCastOptions({}, 10, 1)).toEqual([]);
    expect(getPreCastOptions({ class: { name: 'Wizard' } }, 10, 1)).toEqual([]);
  });

  it('returns non-empty array for Sorcerer with resolved costs and affordability', () => {
    const result = getPreCastOptions(makeStats(), 10, 3);
    expect(result.length).toBeGreaterThan(0);
    for (const opt of result) {
      expect(opt).toHaveProperty('name');
      expect(opt).toHaveProperty('cost');
      expect(opt).toHaveProperty('effect');
      expect(opt).toHaveProperty('description');
      expect(opt).toHaveProperty('resolvedCost');
      expect(opt).toHaveProperty('affordable');
    }
  });

  it('marks options as affordable or unaffordable based on sorcery points', () => {
    const unaffordable = getPreCastOptions(makeStats(), 0, 1);
    for (const opt of unaffordable) {
      expect(opt.affordable).toBe(false);
    }
    const affordable = getPreCastOptions(makeStats(), 10, 1);
    for (const opt of affordable) {
      expect(opt.affordable).toBe(true);
    }
  });

  it('resolves Twinned Spell cost based on spell level but fixed costs stay constant', () => {
    const result1 = getPreCastOptions(makeStats(), 10, 1);
    const result3 = getPreCastOptions(makeStats(), 10, 3);
    const result5 = getPreCastOptions(makeStats(), 10, 5);
    const twinned1 = result1.find((o) => o.name === 'Twinned Spell');
    const twinned3 = result3.find((o) => o.name === 'Twinned Spell');
    const twinned5 = result5.find((o) => o.name === 'Twinned Spell');
    expect(twinned1.resolvedCost).toBe(1);
    expect(twinned3.resolvedCost).toBe(3);
    expect(twinned5.resolvedCost).toBe(5);
    const careful1 = result1.find((o) => o.name === 'Careful Spell');
    const careful3 = result3.find((o) => o.name === 'Careful Spell');
    const careful5 = result5.find((o) => o.name === 'Careful Spell');
    expect(careful1.resolvedCost).toBe(1);
    expect(careful3.resolvedCost).toBe(1);
    expect(careful5.resolvedCost).toBe(1);
  });

  it('does not include Empowered Spell in pre-cast options', () => {
    const result = getPreCastOptions(makeStats(), 10, 1);
    const empowered = result.find((o) => o.name === 'Empowered Spell');
    expect(empowered).toBeUndefined();
  });
});

// ── getChaModifier ──────────────────────────────────────────────

describe('getChaModifier', () => {
  it('returns 0 when stats is missing, abilities are missing, or Charisma is absent', () => {
    expect(getChaModifier(null)).toBe(0);
    expect(getChaModifier({})).toBe(0);
    expect(getChaModifier({ abilities: [] })).toBe(0);
    expect(getChaModifier({ abilities: [{ name: 'Strength', bonus: 3 }] })).toBe(0);
  });

  it('returns the Charisma modifier when present, clamping negatives to 0', () => {
    expect(getChaModifier({ abilities: [{ name: 'Charisma', bonus: 3 }] })).toBe(3);
    expect(getChaModifier({ abilities: [{ name: 'Charisma', bonus: 0 }] })).toBe(0);
    expect(getChaModifier({ abilities: [{ name: 'Charisma', bonus: -3 }] })).toBe(0);
  });
});

// ── getMaxMetamagicPerSpell ─────────────────────────────────────

describe('getMaxMetamagicPerSpell', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 1 for 5e ruleset regardless of level', () => {
    expect(getMaxMetamagicPerSpell({ rules: '5e', level: 1 }, 'player')).toBe(1);
    expect(getMaxMetamagicPerSpell({ rules: '5e', level: 20 }, 'player')).toBe(1);
  });

  it('returns 1 for 2024 ruleset below level 6', () => {
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 1 }, 'player')).toBe(1);
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 5 }, 'player')).toBe(1);
  });

  it('returns 1 for 2024 ruleset at or above level 6 without Innate Sorcery buff', () => {
    getRuntimeValue.mockReturnValue([]);
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 6 }, 'player')).toBe(1);
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 12 }, 'player')).toBe(1);
  });

  it('returns 2 for 2024 ruleset at or above level 6 with Innate Sorcery buff', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Innate Sorcery' }]);
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 6 }, 'player')).toBe(2);
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 12 }, 'player')).toBe(2);
  });

  it('returns 1 when stats is null', () => {
    expect(getMaxMetamagicPerSpell(null, 'player')).toBe(1);
  });

  it('calls getRuntimeValue with the player name and activeBuffs key', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Innate Sorcery' }]);
    getMaxMetamagicPerSpell({ rules: '2024', level: 6 }, 'Lyra');
    expect(getRuntimeValue).toHaveBeenCalledWith('Lyra', 'activeBuffs');
  });
});

// ── isPreCastOption ─────────────────────────────────────────────

describe('isPreCastOption', () => {
  it('returns true for all pre-cast effect types', () => {
    expect(isPreCastOption({ effect: 'ally_auto_succeed_save' })).toBe(true);
    expect(isPreCastOption({ effect: 'double_range' })).toBe(true);
    expect(isPreCastOption({ effect: 'double_duration' })).toBe(true);
    expect(isPreCastOption({ effect: 'disadvantage_on_save' })).toBe(true);
    expect(isPreCastOption({ effect: 'cast_spell_as_bonus_action' })).toBe(true);
    expect(isPreCastOption({ effect: 'no_verbal_somatic' })).toBe(true);
    expect(isPreCastOption({ effect: 'target_two_creatures' })).toBe(true);
  });

  it('returns false for Empowered Spell and any non-pre-cast effect', () => {
    expect(isPreCastOption({ effect: 'reroll_damage_dice' })).toBe(false);
    expect(isPreCastOption({ effect: METAMAGIC_EFFECTS.EMPOWERED })).toBe(false);
  });
});

// ── hasArcaneApotheosis ─────────────────────────────────────────

describe('hasArcaneApotheosis', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns false when stats is null, missing automation, missing passives, or feature absent', () => {
    expect(hasArcaneApotheosis(null, 'player')).toBe(false);
    expect(hasArcaneApotheosis({}, 'player')).toBe(false);
    expect(hasArcaneApotheosis({ automation: { passives: [] } }, 'player')).toBe(false);
    expect(hasArcaneApotheosis({ automation: { passives: [{ name: 'Other Feature' }] } }, 'player')).toBe(false);
  });

  it('returns false when Arcane Apotheosis is present but no Innate Sorcery buff', () => {
    getRuntimeValue.mockReturnValue([]);
    const stats = { automation: { passives: [{ name: 'Arcane Apotheosis' }] } };
    expect(hasArcaneApotheosis(stats, 'player')).toBe(false);
  });

  it('throws when Arcane Apotheosis is present but getRuntimeValue returns undefined', () => {
    getRuntimeValue.mockReturnValue(undefined);
    const stats = { automation: { passives: [{ name: 'Arcane Apotheosis' }] } };
    expect(() => hasArcaneApotheosis(stats, 'player')).toThrow('Expected array, got undefined');
  });

  it('returns true when both Arcane Apotheosis and Innate Sorcery buff are present', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Innate Sorcery' }]);
    const stats = { automation: { passives: [{ name: 'Arcane Apotheosis' }] } };
    expect(hasArcaneApotheosis(stats, 'player')).toBe(true);
  });

  it('returns false when Innate Sorcery buff exists but Arcane Apotheosis passive does not', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Innate Sorcery' }]);
    const stats = { automation: { passives: [{ name: 'Other Feature' }] } };
    expect(hasArcaneApotheosis(stats, 'player')).toBe(false);
  });

  it('calls getRuntimeValue with the player name and activeBuffs key', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Innate Sorcery' }]);
    const stats = { automation: { passives: [{ name: 'Arcane Apotheosis' }] } };
    hasArcaneApotheosis(stats, 'Lyra');
    expect(getRuntimeValue).toHaveBeenCalledWith('Lyra', 'activeBuffs');
  });
});

// ── computeMetamagicCost ────────────────────────────────────────

describe('computeMetamagicCost', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns zero cost for empty selection', () => {
    expect(computeMetamagicCost([], [], {}, 'player')).toEqual({
      totalCost: 0, waivedName: null,
    });
  });

  it('returns total cost without waiver when no Arcane Apotheosis', () => {
    const options = [
      { name: 'Careful Spell', resolvedCost: 1 },
      { name: 'Distant Spell', resolvedCost: 1 },
    ];
    expect(
      computeMetamagicCost(['Careful Spell', 'Distant Spell'], options, {}, 'player'),
    ).toEqual({ totalCost: 2, waivedName: null });
  });

  it('returns total cost for single option without waiver', () => {
    const options = [{ name: 'Heightened Spell', resolvedCost: 3 }];
    expect(
      computeMetamagicCost(['Heightened Spell'], options, {}, 'player'),
    ).toEqual({ totalCost: 3, waivedName: null });
  });

  it('waives highest cost option when Arcane Apotheosis is active', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Innate Sorcery' }]);
    const options = [
      { name: 'Careful Spell', resolvedCost: 1 },
      { name: 'Heightened Spell', resolvedCost: 3 },
    ];
    const stats = { automation: { passives: [{ name: 'Arcane Apotheosis' }] } };
    const result = computeMetamagicCost(
      ['Careful Spell', 'Heightened Spell'], options, stats, 'player',
    );
    expect(result.totalCost).toBe(1);
    expect(result.waivedName).toBe('Heightened Spell');
  });

  it('waives the first highest-cost option when costs are tied', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Innate Sorcery' }]);
    const options = [
      { name: 'Heightened Spell', resolvedCost: 3 },
      { name: 'Quickened Spell', resolvedCost: 3 },
    ];
    const stats = { automation: { passives: [{ name: 'Arcane Apotheosis' }] } };
    const result = computeMetamagicCost(
      ['Heightened Spell', 'Quickened Spell'], options, stats, 'player',
    );
    expect(result.totalCost).toBe(3);
    expect(result.waivedName).toBe('Heightened Spell');
  });

  it('waives highest cost even when it is the only option', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Innate Sorcery' }]);
    const options = [{ name: 'Heightened Spell', resolvedCost: 3 }];
    const stats = { automation: { passives: [{ name: 'Arcane Apotheosis' }] } };
    const result = computeMetamagicCost(
      ['Heightened Spell'], options, stats, 'player',
    );
    expect(result.totalCost).toBe(0);
    expect(result.waivedName).toBe('Heightened Spell');
  });

  it('handles options with zero resolvedCost', () => {
    const options = [
      { name: 'Careful Spell', resolvedCost: 0 },
      { name: 'Heightened Spell', resolvedCost: 3 },
    ];
    expect(
      computeMetamagicCost(['Careful Spell', 'Heightened Spell'], options, {}, 'player'),
    ).toEqual({ totalCost: 3, waivedName: null });
  });

  it('defaults resolvedCost to 0 when option is not found in optionsList', () => {
    expect(
      computeMetamagicCost(['Unknown Spell'], [{ name: 'Careful Spell', resolvedCost: 1 }], {}, 'player'),
    ).toEqual({ totalCost: 0, waivedName: null });
  });
});

// ── getPsionicSpellsList ────────────────────────────────────────

describe('getPsionicSpellsList', () => {
  it('returns psionic spells list when found', () => {
    const stats = {
      automation: {
        passives: [{ type: 'psionic_spells_list', psionicSpells: ['Bolt', 'Shield'] }],
      },
    };
    expect(getPsionicSpellsList(stats)).toEqual(['Bolt', 'Shield']);
  });

  it('returns empty array when no psionic_spells_list passive exists', () => {
    const stats = { automation: { passives: [{ type: 'other' }] } };
    expect(getPsionicSpellsList(stats)).toEqual([]);
  });

  it('skips passives without psionicSpells array', () => {
    const stats = {
      automation: {
        passives: [
          { type: 'psionic_spells_list' },
          { type: 'psionic_spells_list', psionicSpells: ['Magic'] },
        ],
      },
    };
    expect(getPsionicSpellsList(stats)).toEqual(['Magic']);
  });

  it('throws when passives is null, undefined, stats is null, or stats has no automation', () => {
    expect(() => getPsionicSpellsList({ automation: { passives: null } })).toThrow('Expected array, got null');
    expect(() => getPsionicSpellsList({ automation: { passives: undefined } })).toThrow('Expected array, got undefined');
    expect(() => getPsionicSpellsList(null)).toThrow('Expected array, got undefined');
    expect(() => getPsionicSpellsList({})).toThrow('Expected array, got undefined');
  });
});

// ── isPsionicSpell ──────────────────────────────────────────────

describe('isPsionicSpell', () => {
  it('returns false for null, undefined, or empty string spell names', () => {
    expect(isPsionicSpell({}, null)).toBe(false);
    expect(isPsionicSpell({}, undefined)).toBe(false);
    expect(isPsionicSpell({}, '')).toBe(false);
  });

  it('returns true when spell is in psionic list, false otherwise', () => {
    const stats = {
      automation: {
        passives: [{ type: 'psionic_spells_list', psionicSpells: ['Bolt'] }],
      },
    };
    expect(isPsionicSpell(stats, 'Bolt')).toBe(true);
    expect(isPsionicSpell(stats, 'Fireball')).toBe(false);
  });

  it('returns false when stats has no psionic spells', () => {
    expect(isPsionicSpell({ automation: { passives: [] } }, 'Bolt')).toBe(false);
  });
});

// ── hasPsionicSorcery ───────────────────────────────────────────

describe('hasPsionicSorcery', () => {
  it('returns true when psionic_sorcery passive exists among other passives', () => {
    expect(hasPsionicSorcery({ automation: { passives: [{ type: 'psionic_sorcery' }] } })).toBe(true);
    const stats = {
      automation: {
        passives: [
          { type: 'other' },
          { type: 'psionic_sorcery' },
          { type: 'another' },
        ],
      },
    };
    expect(hasPsionicSorcery(stats)).toBe(true);
  });

  it('returns false when psionic_sorcery passive does not exist or passives is empty', () => {
    expect(hasPsionicSorcery({ automation: { passives: [{ type: 'other' }] } })).toBe(false);
    expect(hasPsionicSorcery({ automation: { passives: [] } })).toBe(false);
  });

  it('throws when passives is null, undefined, stats is null, or stats has no automation', () => {
    expect(() => hasPsionicSorcery({ automation: { passives: null } })).toThrow('Expected array, got null');
    expect(() => hasPsionicSorcery({ automation: { passives: undefined } })).toThrow('Expected array, got undefined');
    expect(() => hasPsionicSorcery(null)).toThrow('Expected array, got undefined');
    expect(() => hasPsionicSorcery({})).toThrow('Expected array, got undefined');
  });
});
