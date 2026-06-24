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
  it('exports all 8 metamagic effect identifiers', () => {
    const expectedKeys = [
      'CAREFUL',
      'DISTANT',
      'EMPOWERED',
      'EXTENDED',
      'HEIGHTENED',
      'QUICKENED',
      'SUBTLE',
      'TWINNED',
    ];
    for (const key of expectedKeys) {
      expect(METAMAGIC_EFFECTS).toHaveProperty(key);
      expect(typeof METAMAGIC_EFFECTS[key]).toBe('string');
    }
  });

  it('has exactly 8 effect keys', () => {
    const keys = Object.keys(METAMAGIC_EFFECTS);
    expect(keys).toHaveLength(8);
  });
});

// ── METAMAGIC_OPTIONS ───────────────────────────────────────────

describe('METAMAGIC_OPTIONS', () => {
  it('exports exactly 8 options', () => {
    expect(METAMAGIC_OPTIONS).toHaveLength(8);
  });

  it('exports options with all expected names', () => {
    const names = METAMAGIC_OPTIONS.map((o) => o.name);
    const expectedNames = [
      'Careful Spell',
      'Distant Spell',
      'Empowered Spell',
      'Extended Spell',
      'Heightened Spell',
      'Quickened Spell',
      'Subtle Spell',
      'Twinned Spell',
    ];
    for (const name of expectedNames) {
      expect(names).toContain(name);
    }
  });

  it('each option has name, cost, effect, and description properties', () => {
    for (const option of METAMAGIC_OPTIONS) {
      expect(option).toHaveProperty('name');
      expect(option).toHaveProperty('cost');
      expect(option).toHaveProperty('effect');
      expect(option).toHaveProperty('description');
    }
  });

  it('Twinned Spell costs spell_level and all others have fixed numeric costs', () => {
    const twinned = METAMAGIC_OPTIONS.find((o) => o.name === 'Twinned Spell');
    expect(twinned.cost).toBe('spell_level');

    const fixedOptions = METAMAGIC_OPTIONS.filter((o) => o.name !== 'Twinned Spell');
    for (const opt of fixedOptions) {
      expect(typeof opt.cost).toBe('number');
    }
  });

  it('Empowered Spell has effect value distinct from pre-cast options', () => {
    const empowered = METAMAGIC_OPTIONS.find((o) => o.name === 'Empowered Spell');
    const preCast = METAMAGIC_OPTIONS.filter((o) => o.effect !== empowered.effect);
    expect(preCast).toHaveLength(7);
  });
});

// ── getMetamagicCost ────────────────────────────────────────────

describe('getMetamagicCost', () => {
  it('returns the fixed cost when option cost is a number', () => {
    const option = { cost: 1 };
    expect(getMetamagicCost(option, 5)).toBe(1);
  });

  it('returns spell level when option cost is spell_level', () => {
    const option = { cost: 'spell_level' };
    expect(getMetamagicCost(option, 3)).toBe(3);
  });

  it('returns 1 when spell_level cost and spell level is 0', () => {
    const option = { cost: 'spell_level' };
    expect(getMetamagicCost(option, 0)).toBe(1);
  });

  it('returns 1 when spell_level cost and spell level is negative', () => {
    const option = { cost: 'spell_level' };
    expect(getMetamagicCost(option, -2)).toBe(1);
  });

  it('returns 1 when spell_level cost and spell level is undefined', () => {
    const option = { cost: 'spell_level' };
    expect(getMetamagicCost(option, undefined)).toBe(1);
  });
});

// ── getPreCastOptions ───────────────────────────────────────────

describe('getPreCastOptions', () => {
  it('returns empty array when stats is null', () => {
    expect(getPreCastOptions(null, 10, 1)).toEqual([]);
  });

  it('returns empty array when stats has no class', () => {
    expect(getPreCastOptions({}, 10, 1)).toEqual([]);
  });

  it('returns empty array for non-Sorcerer class', () => {
    expect(getPreCastOptions({ class: { name: 'Wizard' } }, 10, 1)).toEqual([]);
  });

  it('returns non-empty array for Sorcerer', () => {
    const result = getPreCastOptions(makeStats({ class: { name: 'Sorcerer' } }), 10, 1);
    expect(result.length).toBeGreaterThan(0);
  });

  it('each returned option has name, cost, effect, description, resolvedCost, and affordable', () => {
    const result = getPreCastOptions(makeStats(), 10, 3);
    for (const opt of result) {
      expect(opt).toHaveProperty('name');
      expect(opt).toHaveProperty('cost');
      expect(opt).toHaveProperty('effect');
      expect(opt).toHaveProperty('description');
      expect(opt).toHaveProperty('resolvedCost');
      expect(opt).toHaveProperty('affordable');
    }
  });

  it('marks options as unaffordable when sorcery points are insufficient', () => {
    const result = getPreCastOptions(makeStats(), 0, 1);
    for (const opt of result) {
      expect(opt.affordable).toBe(false);
    }
  });

  it('marks options as affordable when sorcery points are sufficient', () => {
    const result = getPreCastOptions(makeStats(), 10, 1);
    for (const opt of result) {
      expect(opt.affordable).toBe(true);
    }
  });

  it('resolves Twinned Spell cost based on spell level', () => {
    const result = getPreCastOptions(makeStats(), 10, 3);
    const twinned = result.find((o) => o.name === 'Twinned Spell');
    expect(twinned.resolvedCost).toBe(3);
  });

  it('resolves fixed-cost options independently of spell level', () => {
    const result1 = getPreCastOptions(makeStats(), 10, 1);
    const result3 = getPreCastOptions(makeStats(), 10, 3);
    const result5 = getPreCastOptions(makeStats(), 10, 5);
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
  it('returns 0 when stats is null', () => {
    expect(getChaModifier(null)).toBe(0);
  });

  it('returns 0 when stats has no abilities', () => {
    expect(getChaModifier({})).toBe(0);
  });

  it('returns 0 when abilities array is empty', () => {
    expect(getChaModifier({ abilities: [] })).toBe(0);
  });

  it('returns 0 when Charisma ability is missing', () => {
    expect(getChaModifier({ abilities: [{ name: 'Strength', bonus: 3 }] })).toBe(0);
  });

  it('returns the Charisma modifier when present', () => {
    const stats = { abilities: [{ name: 'Charisma', bonus: 3 }] };
    expect(getChaModifier(stats)).toBe(3);
  });

  it('returns 0 when Charisma bonus is negative (clamped)', () => {
    const stats = { abilities: [{ name: 'Charisma', bonus: -3 }] };
    expect(getChaModifier(stats)).toBe(0);
  });

  it('returns 0 when Charisma bonus is exactly 0', () => {
    const stats = { abilities: [{ name: 'Charisma', bonus: 0 }] };
    expect(getChaModifier(stats)).toBe(0);
  });
});

// ── getMaxMetamagicPerSpell ─────────────────────────────────────

describe('getMaxMetamagicPerSpell', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 1 for 5e ruleset regardless of level', () => {
    expect(getMaxMetamagicPerSpell({ rules: '5e', level: 1 }, 'player')).toBe(1);
    expect(getMaxMetamagicPerSpell({ rules: '5e', level: 10 }, 'player')).toBe(1);
    expect(getMaxMetamagicPerSpell({ rules: '5e', level: 20 }, 'player')).toBe(1);
  });

  it('returns 1 for 2024 ruleset below level 6', () => {
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 1 }, 'player')).toBe(1);
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 5 }, 'player')).toBe(1);
  });

  it('returns 1 for 2024 ruleset at level 6 without Innate Sorcery buff', () => {
    getRuntimeValue.mockReturnValue([]);
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 6 }, 'player')).toBe(1);
  });

  it('returns 2 for 2024 ruleset at level 6 with Innate Sorcery buff', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Innate Sorcery' }]);
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 6 }, 'player')).toBe(2);
  });

  it('returns 2 for 2024 ruleset above level 6 with Innate Sorcery buff', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Innate Sorcery' }]);
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 12 }, 'player')).toBe(2);
  });

  it('returns 1 for 2024 ruleset above level 6 without Innate Sorcery buff', () => {
    getRuntimeValue.mockReturnValue([]);
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 12 }, 'player')).toBe(1);
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
  it('returns true for Careful Spell effect', () => {
    expect(isPreCastOption({ effect: 'ally_auto_succeed_save' })).toBe(true);
  });

  it('returns true for Distant Spell effect', () => {
    expect(isPreCastOption({ effect: 'double_range' })).toBe(true);
  });

  it('returns true for Extended Spell effect', () => {
    expect(isPreCastOption({ effect: 'double_duration' })).toBe(true);
  });

  it('returns true for Heightened Spell effect', () => {
    expect(isPreCastOption({ effect: 'disadvantage_on_save' })).toBe(true);
  });

  it('returns true for Quickened Spell effect', () => {
    expect(isPreCastOption({ effect: 'cast_spell_as_bonus_action' })).toBe(true);
  });

  it('returns true for Subtle Spell effect', () => {
    expect(isPreCastOption({ effect: 'no_verbal_somatic' })).toBe(true);
  });

  it('returns true for Twinning Spell effect', () => {
    expect(isPreCastOption({ effect: 'target_two_creatures' })).toBe(true);
  });

  it('returns false for Empowered Spell effect', () => {
    expect(isPreCastOption({ effect: 'reroll_damage_dice' })).toBe(false);
  });

  it('returns false for any unknown effect matching empowered', () => {
    expect(isPreCastOption({ effect: METAMAGIC_EFFECTS.EMPOWERED })).toBe(false);
  });
});

// ── hasArcaneApotheosis ─────────────────────────────────────────

describe('hasArcaneApotheosis', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns false when stats is null', () => {
    expect(hasArcaneApotheosis(null, 'player')).toBe(false);
  });

  it('returns false when no automation section', () => {
    expect(hasArcaneApotheosis({}, 'player')).toBe(false);
  });

  it('returns false when no passives', () => {
    expect(hasArcaneApotheosis({ automation: { passives: [] } }, 'player')).toBe(false);
  });

  it('returns false when Arcane Apotheosis passive is absent', () => {
    const stats = { automation: { passives: [{ name: 'Other Feature' }] } };
    expect(hasArcaneApotheosis(stats, 'player')).toBe(false);
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
      totalCost: 0,
      waivedName: null,
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
      ['Careful Spell', 'Heightened Spell'],
      options,
      stats,
      'player',
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
      ['Heightened Spell', 'Quickened Spell'],
      options,
      stats,
      'player',
    );
    expect(result.totalCost).toBe(3);
    expect(result.waivedName).toBe('Heightened Spell');
  });

  it('waives highest cost even when it is the only option', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Innate Sorcery' }]);
    const options = [{ name: 'Heightened Spell', resolvedCost: 3 }];
    const stats = { automation: { passives: [{ name: 'Arcane Apotheosis' }] } };
    const result = computeMetamagicCost(
      ['Heightened Spell'],
      options,
      stats,
      'player',
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

  it('throws when passives is null', () => {
    expect(() => getPsionicSpellsList({ automation: { passives: null } })).toThrow('Expected array, got null');
  });

  it('throws when passives is undefined', () => {
    expect(() => getPsionicSpellsList({ automation: { passives: undefined } })).toThrow('Expected array, got undefined');
  });

  it('returns empty array when no psionic_spells_list passive exists', () => {
    const stats = { automation: { passives: [{ type: 'other' }] } };
    expect(getPsionicSpellsList(stats)).toEqual([]);
  });

  it('throws when stats is null', () => {
    expect(() => getPsionicSpellsList(null)).toThrow('Expected array, got undefined');
  });

  it('throws when stats has no automation', () => {
    expect(() => getPsionicSpellsList({})).toThrow('Expected array, got undefined');
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
});

// ── isPsionicSpell ──────────────────────────────────────────────

describe('isPsionicSpell', () => {
  it('returns false for null spell name', () => {
    expect(isPsionicSpell({}, null)).toBe(false);
  });

  it('returns false for undefined spell name', () => {
    expect(isPsionicSpell({}, undefined)).toBe(false);
  });

  it('returns false for empty string spell name', () => {
    expect(isPsionicSpell({}, '')).toBe(false);
  });

  it('returns true when spell is in psionic list', () => {
    const stats = {
      automation: {
        passives: [{ type: 'psionic_spells_list', psionicSpells: ['Bolt'] }],
      },
    };
    expect(isPsionicSpell(stats, 'Bolt')).toBe(true);
  });

  it('returns false when spell is not in psionic list', () => {
    const stats = {
      automation: {
        passives: [{ type: 'psionic_spells_list', psionicSpells: ['Bolt'] }],
      },
    };
    expect(isPsionicSpell(stats, 'Fireball')).toBe(false);
  });

  it('returns false when stats has no psionic spells', () => {
    expect(isPsionicSpell({ automation: { passives: [] } }, 'Bolt')).toBe(false);
  });
});

// ── hasPsionicSorcery ───────────────────────────────────────────

describe('hasPsionicSorcery', () => {
  it('returns true when psionic_sorcery passive exists', () => {
    const stats = { automation: { passives: [{ type: 'psionic_sorcery' }] } };
    expect(hasPsionicSorcery(stats)).toBe(true);
  });

  it('returns false when no psionic_sorcery passive exists', () => {
    const stats = { automation: { passives: [{ type: 'other' }] } };
    expect(hasPsionicSorcery(stats)).toBe(false);
  });

  it('returns false when passives is empty', () => {
    expect(hasPsionicSorcery({ automation: { passives: [] } })).toBe(false);
  });

  it('throws when passives is null', () => {
    expect(() => hasPsionicSorcery({ automation: { passives: null } })).toThrow('Expected array, got null');
  });

  it('throws when passives is undefined', () => {
    expect(() => hasPsionicSorcery({ automation: { passives: undefined } })).toThrow('Expected array, got undefined');
  });

  it('throws when stats is null', () => {
    expect(() => hasPsionicSorcery(null)).toThrow('Expected array, got undefined');
  });

  it('throws when stats has no automation', () => {
    expect(() => hasPsionicSorcery({})).toThrow('Expected array, got undefined');
  });

  it('returns true when psionic_sorcery exists among other passives', () => {
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
});
