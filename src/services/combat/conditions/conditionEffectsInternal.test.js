// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest';
import {
  computeConditionEffects,
  saveModifierApplies,
} from './conditionEffects.js';

// ---------------------------------------------------------------------------
// saveModifierApplies — target validation
// ---------------------------------------------------------------------------

describe('saveModifierApplies — target validation', () => {
  const baseArgs = ['saving_throw', 'STR', false, false, false, false, null, []];

  it('returns true for valid target types when no other conditions apply', () => {
    expect(saveModifierApplies({ target: 'saving_throw' }, ...baseArgs)).toBe(true);
    expect(saveModifierApplies({ target: 'save' }, ...baseArgs)).toBe(true);
    expect(saveModifierApplies({ target: 'attack_roll' }, ...baseArgs)).toBe(true);
    expect(saveModifierApplies({ target: 'attack_rolls' }, ...baseArgs)).toBe(true);
    expect(
      saveModifierApplies({ target: 'attack_rolls_vs_unmounted_near_mount' }, ...baseArgs),
    ).toBe(true);
    expect(
      saveModifierApplies({ target: 'concentration_saving_throws' }, ...baseArgs),
    ).toBe(true);
    expect(saveModifierApplies({ target: 'death_saving_throws' }, ...baseArgs)).toBe(true);
  });

  it('returns false for unknown target types', () => {
    expect(saveModifierApplies({ target: 'unknown_target' }, ...baseArgs)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// saveModifierApplies — effect short-circuit paths
// ---------------------------------------------------------------------------

describe('saveModifierApplies — effect short-circuits', () => {
  const baseArgs = ['saving_throw', 'STR', false, false, false, false, null, []];

  const effectShortCircuits = [
    'replacement',
    'reliable_talent',
    'dex_jump',
    'restore_balance',
    'd20_floor_10',
    'no_advantage_against',
    'dark_ones_luck',
    'portent',
    'potent_cantrip',
    'soulstitch_spells',
  ];

  for (const effect of effectShortCircuits) {
    it(`returns true for effect "${effect}" regardless of other conditions`, () => {
      const modifier = { target: 'saving_throw', effect };
      expect(saveModifierApplies(modifier, ...baseArgs)).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// saveModifierApplies — creature_grappled_by_you
// ---------------------------------------------------------------------------

describe('saveModifierApplies — creature_grappled_by_you', () => {
  const modifier = { target: 'saving_throw', condition: 'creature_grappled_by_you' };
  const baseArgs = ['DEX', 'STR', false, false, false, false];

  it('returns true when active creature attacks a grappled target', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin', conditions: ['grappled'] },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [])).toBe(true);
  });

  it('returns true when grappled condition is stored as an object', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin', conditions: [{ key: 'grappled' }] },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [])).toBe(true);
  });

  it('returns true when grappled condition is mixed with other condition objects', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin', conditions: ['blinded', { key: 'grappled' }] },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [])).toBe(true);
  });

  it('returns false when target has no grappled condition', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin', conditions: ['blinded'] },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [])).toBe(false);
  });

  it('returns false when target has no conditions array', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin' },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [])).toBe(false);
  });

  it('returns false when combatContext is null', () => {
    expect(saveModifierApplies(modifier, ...baseArgs, null, [])).toBe(false);
  });

  it('returns false when combatContext has no creatures array', () => {
    expect(saveModifierApplies(modifier, ...baseArgs, {}, [])).toBe(false);
  });

  it('returns false when attackerName is null', () => {
    const combatContext = {
      creatures: [{ name: 'Goblin', conditions: ['grappled'] }],
      attackerName: null,
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [])).toBe(false);
  });

  it('falls back to attackerName when activeCreatureName is missing', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin', conditions: ['grappled'] },
      ],
      attackerName: 'Player',
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [])).toBe(true);
  });

  it('returns false when attacker creature has no targetName', () => {
    const combatContext = {
      creatures: [{ name: 'Player' }],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// saveModifierApplies — mounted_and_target_one_size_smaller
// ---------------------------------------------------------------------------

describe('saveModifierApplies — mounted_and_target_one_size_smaller', () => {
  const modifier = {
    target: 'attack_roll',
    condition: 'mounted_and_target_one_size_smaller',
  };
  const baseArgs = ['DEX', 'STR', false, false, false, false];

  it('returns true when mounted attacker strikes a one-size-smaller target within 5ft', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', isMounted: true, mountSize: 'Large', targetName: 'Goblin', rangeToTarget: 5 },
        { name: 'Goblin', size: 'Small' },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [])).toBe(true);
  });

  it('returns true when rangeToTarget is undefined (treated as within range)', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', isMounted: true, mountSize: 'Large', targetName: 'Goblin' },
        { name: 'Goblin', size: 'Small' },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [])).toBe(true);
  });

  it('returns false when attacker is not mounted', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', isMounted: false, targetName: 'Goblin' },
        { name: 'Goblin', size: 'Small' },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [])).toBe(false);
  });

  it('returns false when attacker is incapacitated', () => {
    const combatContext = {
      creatures: [
        {
          name: 'Player',
          isMounted: true,
          mountSize: 'Large',
          targetName: 'Goblin',
          rangeToTarget: 5,
          conditions: ['incapacitated'],
        },
        { name: 'Goblin', size: 'Small' },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [])).toBe(false);
  });

  it('returns false when incapacitated condition is stored as an object', () => {
    const combatContext = {
      creatures: [
        {
          name: 'Player',
          isMounted: true,
          mountSize: 'Large',
          targetName: 'Goblin',
          rangeToTarget: 5,
          conditions: [{ key: 'incapacitated' }],
        },
        { name: 'Goblin', size: 'Small' },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [])).toBe(false);
  });

  it('returns false when target is same size as mount', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', isMounted: true, mountSize: 'Medium', targetName: 'Orc', rangeToTarget: 5 },
        { name: 'Orc', size: 'Medium' },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [])).toBe(false);
  });

  it('returns false when target is larger than mount', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', isMounted: true, mountSize: 'Small', targetName: 'Ogre', rangeToTarget: 5 },
        { name: 'Ogre', size: 'Large' },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [])).toBe(false);
  });

  it('returns false when beyond 5ft range', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', isMounted: true, mountSize: 'Large', targetName: 'Goblin', rangeToTarget: 10 },
        { name: 'Goblin', size: 'Small' },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [])).toBe(false);
  });

  it('returns false when combatContext is null', () => {
    expect(saveModifierApplies(modifier, ...baseArgs, null, [])).toBe(false);
  });

  it('returns false when combatContext has no creatures array', () => {
    expect(saveModifierApplies(modifier, ...baseArgs, {}, [])).toBe(false);
  });

  it('returns false when attacker creature is not found', () => {
    const combatContext = {
      creatures: [{ name: 'Other', isMounted: true, mountSize: 'Large' }],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [])).toBe(false);
  });

  it('returns false when target creature is not found', () => {
    const combatContext = {
      creatures: [{ name: 'Player', isMounted: true, mountSize: 'Large', targetName: 'Missing' }],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [])).toBe(false);
  });

  it('returns false when mountSize is unrecognized', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', isMounted: true, mountSize: 'Unknown', targetName: 'Goblin', rangeToTarget: 5 },
        { name: 'Goblin', size: 'Small' },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [])).toBe(false);
  });

  it('returns false when target size is unrecognized', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', isMounted: true, mountSize: 'Large', targetName: 'Goblin', rangeToTarget: 5 },
        { name: 'Goblin', size: 'Unknown' },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// saveModifierApplies — condition-based boolean checks
// ---------------------------------------------------------------------------

describe('saveModifierApplies — condition-based boolean checks', () => {
  const fnArgs = ['saving_throw', 'STR', false, false, false, false, null, []];

  it('returns isRaging when condition is raging', () => {
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'raging' }, 'saving_throw', 'STR', true, false, false, false, null, [])).toBe(true);
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'raging' }, 'saving_throw', 'STR', false, false, false, false, null, [])).toBe(false);
  });

  it('returns shapeShiftActive when condition is shape_shift', () => {
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'shape_shift' }, 'saving_throw', 'STR', false, true, false, false, null, [])).toBe(true);
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'shape_shift' }, 'saving_throw', 'STR', false, false, false, false, null, [])).toBe(false);
  });

  it('returns isPeerlessAthlete when condition is peerless_athlete', () => {
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'peerless_athlete' }, 'saving_throw', 'STR', false, false, true, false, null, [])).toBe(true);
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'peerless_athlete' }, 'saving_throw', 'STR', false, false, false, false, null, [])).toBe(false);
  });

  it('populates peerlessAthleteAdvantageSkills from conditional_advantage with skills field', () => {
    const modifiers = [
      { target: 'ability_check', condition: 'peerless_athlete', effect: 'advantage', abilities: ['STR'], skills: ['Athletics'] },
      { target: 'ability_check', condition: 'peerless_athlete', effect: 'advantage', abilities: ['DEX'], skills: ['Acrobatics'] },
    ];
    const effects = computeConditionEffects([], modifiers, [], false, false, true);
    expect(effects.peerlessAthleteAdvantageSkills).toEqual(['Athletics', 'Acrobatics']);
  });

  it('does not populate abilityCheckAdvantageAbilities for peerless_athlete with skills field', () => {
    const modifiers = [
      { target: 'ability_check', condition: 'peerless_athlete', effect: 'advantage', abilities: ['STR'], skills: ['Athletics'] },
      { target: 'ability_check', condition: 'peerless_athlete', effect: 'advantage', abilities: ['DEX'], skills: ['Acrobatics'] },
    ];
    const effects = computeConditionEffects([], modifiers, [], false, false, true);
    expect(effects.abilityCheckAdvantageAbilities).toBeNull();
  });

  it('returns isLargeFormActive when condition is large_form_active', () => {
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'large_form_active' }, 'saving_throw', 'STR', false, false, false, true, null, [])).toBe(true);
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'large_form_active' }, 'saving_throw', 'STR', false, false, false, false, null, [])).toBe(false);
  });

  const alwaysTrueConditions = [
    'fiend_undead',
    'concentration_breaker',
    'pfeag_save_advantage',
  ];

  for (const condition of alwaysTrueConditions) {
    it(`returns true when condition is "${condition}"`, () => {
      expect(saveModifierApplies({ target: 'saving_throw', condition }, ...fnArgs)).toBe(true);
    });
  }

  it('returns isLivingLegendActive when condition is living_legend_active', () => {
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'living_legend_active' }, ...fnArgs, null, true, false, false, false)).toBe(true);
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'living_legend_active' }, ...fnArgs, null, false, false, false, false)).toBe(false);
  });

  it('returns isElderChampionActive when condition is elder_champion_active', () => {
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'elder_champion_active' }, ...fnArgs, null, false, true, false, false, false)).toBe(true);
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'elder_champion_active' }, ...fnArgs, null, false, false, false, false, false)).toBe(false);
  });

  it('returns isHolyAuraActive when condition is holy_aura_active', () => {
    expect(saveModifierApplies({ target: 'attack_roll', condition: 'holy_aura_active' }, ...fnArgs, null, false, false, false, true, false)).toBe(true);
    expect(saveModifierApplies({ target: 'attack_roll', condition: 'holy_aura_active' }, ...fnArgs, null, false, false, false, false, false)).toBe(false);
  });

  it('returns isProtectionFromPoisonActive when condition is protection_from_poison_active', () => {
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'protection_from_poison_active' }, ...fnArgs, null, false, false, false, false, true)).toBe(true);
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'protection_from_poison_active' }, ...fnArgs, null, false, false, false, false, false)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// saveModifierApplies — saveType-based conditions
// ---------------------------------------------------------------------------

describe('saveModifierApplies — saveType-based conditions', () => {
  const baseArgs = ['STR', 'STR', false, false, false, false, null, []];

  it('returns true when charmed condition matches charmed saveType', () => {
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'charmed' }, 'charmed', ...baseArgs.slice(1))).toBe(true);
  });

  it('returns true when frightened condition matches frightened saveType', () => {
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'frightened' }, 'frightened', ...baseArgs.slice(1))).toBe(true);
  });

  it('returns true when poison condition matches poison saveType', () => {
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'poison' }, 'poison', ...baseArgs.slice(1))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// saveModifierApplies — magic condition with abilities
// ---------------------------------------------------------------------------

describe('saveModifierApplies — magic condition', () => {
  const baseArgs = ['DEX', 'DEX', false, false, false, false, null, []];

  it('returns true when abilities array is empty', () => {
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'magic', abilities: [] }, ...baseArgs)).toBe(true);
  });

  it('returns true when abilityName matches an ability in the list', () => {
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'magic', abilities: ['DEX', 'WIS'] }, ...baseArgs)).toBe(true);
  });

  it('returns false when abilityName does not match any ability', () => {
    expect(
      saveModifierApplies({ target: 'saving_throw', condition: 'magic', abilities: ['DEX', 'WIS'] }, 'CON', 'STR', false, false, false, false, null, []),
    ).toBe(false);
  });

  it('returns false when abilityName is null and abilities list is non-empty', () => {
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'magic', abilities: ['DEX'] }, 'saving_throw', null, false, false, false, false, null, [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// saveModifierApplies — first_round_target_no_turn
// ---------------------------------------------------------------------------

describe('saveModifierApplies — first_round_target_no_turn', () => {
  const modifier = { target: 'saving_throw', condition: 'first_round_target_no_turn' };
  const baseArgs = ['DEX', 'STR', false, false, false, false];

  it('returns true on round 1 when target has lower or equal initiative (to the right)', () => {
    const combatContext = {
      round: 1,
      creatures: [
        { name: 'Ally', targetName: 'Goblin' },
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin' },
      ],
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [], 'Player')).toBe(true);
  });

  it('returns false on round 1 when target has higher initiative (to the left)', () => {
    const combatContext = {
      round: 1,
      creatures: [
        { name: 'Goblin' },
        { name: 'Player', targetName: 'Goblin' },
      ],
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [], 'Player')).toBe(false);
  });

  it('returns false when target has same initiative as attacker (same index)', () => {
    const combatContext = {
      round: 1,
      creatures: [
        { name: 'Player', targetName: 'Player' },
      ],
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [], 'Player')).toBe(false);
  });

  it('returns false on round 2', () => {
    const combatContext = {
      round: 2,
      creatures: [
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin' },
      ],
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [], 'Player')).toBe(false);
  });

  it('returns false when combatContext is null', () => {
    expect(saveModifierApplies(modifier, ...baseArgs, null, [], 'Player')).toBe(false);
  });

  it('returns false when combatContext has no creatures', () => {
    expect(saveModifierApplies(modifier, ...baseArgs, {}, [], 'Player')).toBe(false);
  });

  it('returns true when round is missing (defaults to 1) and target is to the right', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin' },
      ],
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [], 'Player')).toBe(true);
  });

  it('returns true when targetName is missing', () => {
    const combatContext = {
      round: 1,
      creatures: [
        { name: 'Player' },
      ],
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [], 'Player')).toBe(true);
  });

  it('returns true when attackerName is missing', () => {
    const combatContext = {
      round: 1,
      creatures: [
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin' },
      ],
    };
    expect(saveModifierApplies(modifier, ...baseArgs, combatContext, [], null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// saveModifierApplies — condition keyword matching
// ---------------------------------------------------------------------------

describe('saveModifierApplies — condition keyword matching', () => {
  it('returns true when modifier.condition is in the conditions set', () => {
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'rage' }, 'saving_throw', 'STR', false, false, false, false, null, ['rage'])).toBe(true);
  });

  it('returns false when modifier.condition is not in conditions set and no abilities match', () => {
    expect(saveModifierApplies({ target: 'saving_throw', condition: 'rage', abilities: ['STR'] }, 'saving_throw', 'DEX', false, false, false, false, null, [])).toBe(false);
  });

  it('returns true when abilityName matches modifier.abilities', () => {
    expect(saveModifierApplies({ target: 'saving_throw', abilities: ['STR', 'DEX'] }, 'saving_throw', 'STR', false, false, false, false, null, [])).toBe(true);
  });

  it('returns true when abilityName is null and modifier has abilities', () => {
    expect(saveModifierApplies({ target: 'saving_throw', abilities: ['STR', 'DEX'] }, 'saving_throw', null, false, false, false, false, null, [])).toBe(true);
  });

  it('returns true as final fallback when nothing else matches', () => {
    expect(saveModifierApplies({ target: 'saving_throw' }, 'saving_throw', 'STR', false, false, false, false, null, [])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeConditionEffects — save modifiers via saveType matching
// ---------------------------------------------------------------------------

describe('computeConditionEffects — saveType-based modifier conditions', () => {
  it('applies charmed advantage when charmed condition is active', () => {
    const modifiers = [{ target: 'saving_throw', condition: 'charmed', effect: 'advantage' }];
    const result = computeConditionEffects(['charmed'], modifiers);
    expect(result.saveAdvantage).toContain('charmed');
  });

  it('applies charmed disadvantage when charmed condition is active', () => {
    const modifiers = [{ target: 'saving_throw', condition: 'charmed', effect: 'disadvantage' }];
    const result = computeConditionEffects(['charmed'], modifiers);
    expect(result.saveDisadvantage).toContain('charmed');
  });

  it('applies frightened disadvantage when frightened condition is active', () => {
    const modifiers = [{ target: 'saving_throw', condition: 'frightened', effect: 'disadvantage' }];
    const result = computeConditionEffects(['frightened'], modifiers);
    expect(result.saveDisadvantage).toContain('frightened');
  });

  it('applies poisoned advantage when poisoned condition is active', () => {
    const modifiers = [{ target: 'saving_throw', condition: 'poison', effect: 'advantage' }];
    const result = computeConditionEffects(['poisoned'], modifiers);
    expect(result.saveAdvantage).toContain('poisoned');
  });

  it('applies poisoned disadvantage when poisoned condition is active', () => {
    const modifiers = [{ target: 'saving_throw', condition: 'poison', effect: 'disadvantage' }];
    const result = computeConditionEffects(['poisoned'], modifiers);
    expect(result.saveDisadvantage).toContain('poisoned');
  });

  it('applies against_spell advantage', () => {
    const modifiers = [{ target: 'saving_throw', condition: 'against_spell', effect: 'advantage' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.saveAdvantage).toContain('against_spell');
  });

  it('applies against_spell disadvantage', () => {
    const modifiers = [{ target: 'saving_throw', condition: 'against_spell', effect: 'disadvantage' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.saveDisadvantage).toContain('against_spell');
  });

  it('tracks per-ability saveAdvantageAbilities for magic condition with abilities', () => {
    const modifiers = [{ target: 'saving_throw', condition: 'magic', effect: 'advantage', abilities: ['DEX'] }];
    const result = computeConditionEffects([], modifiers);
    expect(result.saveAdvantageAbilities).toContain('DEX');
  });

  it('tracks per-ability saveDisadvantageAbilities for magic condition with abilities', () => {
    const modifiers = [{ target: 'saving_throw', condition: 'magic', effect: 'disadvantage', abilities: ['CON', 'WIS'] }];
    const result = computeConditionEffects([], modifiers);
    expect(result.saveDisadvantageAbilities).toContain('CON');
    expect(result.saveDisadvantageAbilities).toContain('WIS');
  });

  it('skips visible_effect modifiers when incapacitated', () => {
    const modifiers = [
      { target: 'saving_throw', effect: 'advantage', condition: 'visible_effect' },
      { target: 'saving_throw', effect: 'advantage' },
    ];
    const result = computeConditionEffects(['incapacitated'], modifiers);
    // visible_effect is filtered, but the plain advantage still applies
    expect(result.saveAdvantageCount).toBe(1);
  });

  it('includes visible_effect modifiers when not incapacitated', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'advantage', condition: 'visible_effect' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.saveAdvantageCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeConditionEffects — targetEffects
// ---------------------------------------------------------------------------

describe('computeConditionEffects — targetEffects', () => {
  it('increments targetAdvantageCount for distracting_strike_advantage', () => {
    const result = computeConditionEffects([], [], [{ effect: 'distracting_strike_advantage' }]);
    expect(result.targetAdvantageCount).toBe(1);
  });

  it('increments attackDisadvantageCount for disadvantage_next_attack', () => {
    const result = computeConditionEffects([], [], [{ effect: 'disadvantage_next_attack' }]);
    expect(result.attackDisadvantageCount).toBe(1);
  });

  it('increments attackDisadvantageCount for goad', () => {
    const result = computeConditionEffects([], [], [{ effect: 'goad' }]);
    expect(result.attackDisadvantageCount).toBe(1);
  });

  it('increments attackAdvantageCount for next_attack_advantage without vexTarget', () => {
    const result = computeConditionEffects([], [], [{ effect: 'next_attack_advantage' }]);
    expect(result.attackAdvantageCount).toBe(1);
  });

  it('sets vexAdvantageTargets for next_attack_advantage with vexTarget', () => {
    const result = computeConditionEffects([], [], [{ effect: 'next_attack_advantage', vexTarget: 'Goblin' }]);
    expect(result.vexAdvantageTargets).toContain('Goblin');
  });

  it('increments targetDisadvantageCount for escape_the_horde', () => {
    const result = computeConditionEffects([], [], [{ effect: 'escape_the_horde' }]);
    expect(result.targetDisadvantageCount).toBe(1);
  });

  it('increments targetDisadvantageCount for multiattack_defense', () => {
    const result = computeConditionEffects([], [], [{ effect: 'multiattack_defense' }]);
    expect(result.targetDisadvantageCount).toBe(1);
  });

  it('sets riderSaveDisadvantage and saveDisadvantageCount for disadvantage_on_next_save', () => {
    const result = computeConditionEffects([], [], [{ effect: 'disadvantage_on_next_save' }]);
    expect(result.riderSaveDisadvantage).toBe(true);
    expect(result.saveDisadvantageCount).toBe(1);
  });

  it('sets abilityCheckDisadvantage for disadvantage_perception_checks', () => {
    const result = computeConditionEffects([], [], [{ effect: 'disadvantage_perception_checks' }]);
    expect(result.abilityCheckDisadvantage).toBe(true);
  });

  it('sets riderCannotOpportunityAttack when noOpportunityAttacks is true', () => {
    const result = computeConditionEffects([], [], [{ noOpportunityAttacks: true }]);
    expect(result.riderCannotOpportunityAttack).toBe(true);
  });

  it('sets riderNoReactions for no_reactions effect', () => {
    const result = computeConditionEffects([], [], [{ effect: 'no_reactions' }]);
    expect(result.riderNoReactions).toBe(true);
  });

  it('adds speedReduction for speed_reduction effect', () => {
    const result = computeConditionEffects([], [], [{ effect: 'speed_reduction', value: 15 }]);
    expect(result.speedReduction).toBe(15);
  });

  it('sets pushEffect and pushDistance for push effect', () => {
    const result = computeConditionEffects([], [], [{ effect: 'push', value: 10 }]);
    expect(result.pushEffect).toBe(true);
    expect(result.pushDistance).toBe(10);
  });

  it('sets riderAttackBonus and damage info for damage_bonus effect', () => {
    const result = computeConditionEffects([], [], [{ effect: 'damage_bonus', value: 5, damageExpression: '2d6', damageType: 'fire' }]);
    expect(result.riderAttackBonus).toBe(5);
    expect(result.riderDamageExpression).toBe('2d6');
    expect(result.riderDamageType).toBe('fire');
  });

  it('sets pushEffect, pushDistance, and proneEffect for prone_and_push', () => {
    const result = computeConditionEffects([], [], [{ effect: 'prone_and_push', value: 5 }]);
    expect(result.pushEffect).toBe(true);
    expect(result.pushDistance).toBe(5);
    expect(result.proneEffect).toBe(true);
  });

  it('sets saveType/saveDc/saveAbility/conditionToApply/conditionDuration for save-based effect', () => {
    const result = computeConditionEffects([], [], [{ saveType: 'DEX', condition: 'prone', saveDc: 15, saveAbility: 'DEX' }]);
    expect(result.saveType).toBe('DEX');
    expect(result.saveDc).toBe(15);
    expect(result.saveAbility).toBe('DEX');
    expect(result.conditionToApply).toBe('prone');
    expect(result.conditionDuration).toBe('until_start_of_next_turn');
  });

  it('sets repeatingSave when repeatingSave is true on effect', () => {
    const result = computeConditionEffects([], [], [{ saveType: 'DEX', condition: 'prone', repeatingSave: true }]);
    expect(result.repeatingSave).toBe(true);
  });

  it('sets massFear fields for mass_fear effect', () => {
    const result = computeConditionEffects([], [], [{ effect: 'mass_fear', saveType: 'WIS', saveDc: 13, condition: 'frightened', range: '30_ft' }]);
    expect(result.saveType).toBe('WIS');
    expect(result.saveDc).toBe(13);
    expect(result.conditionToApply).toBe('frightened');
    expect(result.massFearRange).toBe('30_ft');
  });

  it('sets damageDoubled for death_strike effect', () => {
    const result = computeConditionEffects([], [], [{ effect: 'death_strike', damageDoubled: true }]);
    expect(result.damageDoubled).toBe(true);
  });

  it('sets riderCannotOpportunityAttack for no_opportunity_attacks without saveType', () => {
    const result = computeConditionEffects([], [], [{ effect: 'no_opportunity_attacks' }]);
    expect(result.riderCannotOpportunityAttack).toBe(true);
  });

  it('sets hurlThroughHell fields for incapacitated effect with saveType', () => {
    const result = computeConditionEffects([], [], [{ effect: 'incapacitated', saveType: 'WIS', saveDc: 15 }]);
    expect(result.saveType).toBe('WIS');
    expect(result.conditionToApply).toBe('incapacitated');
    expect(result.hurlThroughHell).toBe(true);
  });

  it('sets powerWordStun fields for power_word_stun_repeat_save', () => {
    const result = computeConditionEffects([], [], [{ effect: 'power_word_stun_repeat_save' }]);
    expect(result.saveType).toBe('CON');
    expect(result.conditionToApply).toBe('stunned');
    expect(result.repeatingSave).toBe(true);
    expect(result.powerWordStun).toBe(true);
  });

  it('sets sleepRepeatSave fields for sleep_repeat_save', () => {
    const result = computeConditionEffects([], [], [{ effect: 'sleep_repeat_save' }]);
    expect(result.saveType).toBe('WIS');
    expect(result.conditionToApply).toBe('unconscious');
    expect(result.repeatingSave).toBe(true);
    expect(result.sleepRepeatSave).toBe(true);
  });

  it('sets slowRepeatSave for slow_repeat_save', () => {
    const result = computeConditionEffects([], [], [{ effect: 'slow_repeat_save' }]);
    expect(result.saveType).toBe('WIS');
    expect(result.repeatingSave).toBe(true);
    expect(result.slowRepeatSave).toBe(true);
  });

  it('sets stinkingCloudRepeatSave for stinking_cloud_repeat_save', () => {
    const result = computeConditionEffects([], [], [{ effect: 'stinking_cloud_repeat_save' }]);
    expect(result.saveType).toBe('CON');
    expect(result.conditionToApply).toBe('poisoned');
    expect(result.stinkingCloudRepeatSave).toBe(true);
  });

  it('sets webRepeatSave for web_repeat_save', () => {
    const result = computeConditionEffects([], [], [{ effect: 'web_repeat_save' }]);
    expect(result.saveType).toBe('DEX');
    expect(result.conditionToApply).toBe('restrained');
    expect(result.webRepeatSave).toBe(true);
  });

  it('sets targetAdvantageCount and attackDisadvantageCount for clairvoyant_combatant', () => {
    const result = computeConditionEffects([], [], [
      { effect: 'clairvoyant_combatant', attackerAdvantage: true, defenderDisadvantage: true },
    ]);
    expect(result.targetAdvantageCount).toBe(1);
    expect(result.attackDisadvantageCount).toBe(1);
  });

  it('sets all foresight fields for foresight effect', () => {
    const result = computeConditionEffects([], [], [{ effect: 'foresight' }]);
    expect(result.attackAdvantageCount).toBe(1);
    expect(result.saveAdvantageCount).toBe(1);
    expect(result.abilityCheckAdvantage).toBe(true);
    expect(result.targetDisadvantageCount).toBe(1);
  });

  it('sets hexSaveDisadvantage fields for hex_save_disadvantage', () => {
    const result = computeConditionEffects([], [], [{ effect: 'hex_save_disadvantage', ability: 'CON' }]);
    expect(result.hexSaveDisadvantage).toBe(true);
    expect(result.hexSaveDisadvantageAbility).toBe('CON');
    expect(result.saveDisadvantageCount).toBe(1);
  });

  it('sets strCheckDisadvantage and rayOfEnfeebleDamageReduction for ray_of_enfeeble_debuff', () => {
    const result = computeConditionEffects([], [], [{ effect: 'ray_of_enfeeble_debuff', strCheckDisadvantage: true, rayOfEnfeebleDamageReduction: true }]);
    expect(result.strCheckDisadvantage).toBe(true);
    expect(result.rayOfEnfeebleDamageReduction).toBe(true);
  });

  it('sets cleaveAttack fields for cleave effect', () => {
    const result = computeConditionEffects([], [], [{ effect: 'cleave', target: 'Goblin', source: 'Player' }]);
    expect(result.cleaveAttack).toBe(true);
    expect(result.cleaveTarget).toBe('Goblin');
    expect(result.cleaveSource).toBe('Player');
  });

  it('sets nickExtraAttack fields for nick effect', () => {
    const result = computeConditionEffects([], [], [{ effect: 'nick', target: 'Goblin', source: 'Player' }]);
    expect(result.nickExtraAttack).toBe(true);
    expect(result.nickTarget).toBe('Goblin');
    expect(result.nickSource).toBe('Player');
  });

  it('sets topple fields for topple effect', () => {
    const result = computeConditionEffects([], [], [{ effect: 'topple', saveType: 'CON', saveDc: 14 }]);
    expect(result.toppleEffect).toBe(true);
    expect(result.saveType).toBe('CON');
    expect(result.saveDc).toBe(14);
    expect(result.saveAbility).toBe('CON');
    expect(result.conditionToApply).toBe('prone');
  });

  it('adds acPenalty for ac_penalty effect', () => {
    const result = computeConditionEffects([], [], [{ effect: 'ac_penalty', value: 3 }]);
    expect(result.acPenalty).toBe(3);
  });

  it('sets slowDexSaveDisadvantage and saveDisadvantage for dex_save_disadvantage', () => {
    const result = computeConditionEffects([], [], [{ effect: 'dex_save_disadvantage' }]);
    expect(result.slowDexSaveDisadvantage).toBe(true);
    expect(result.saveDisadvantage).toContain('dex');
  });

  it('adds to targetAdvantageCount for crusher_enhanced_critical', () => {
    const result = computeConditionEffects([], [], [{ effect: 'crusher_enhanced_critical' }]);
    expect(result.targetAdvantageCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeConditionEffects — applySaveModifiers effects via computeConditionEffects
// ---------------------------------------------------------------------------

describe('computeConditionEffects — applied modifier effects', () => {
  it('increments attackAdvantageCount for attack_rolls advantage', () => {
    const modifiers = [{ target: 'attack_rolls', effect: 'advantage' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.attackAdvantageCount).toBe(1);
  });

  it('increments attackDisadvantageCount for attack_rolls disadvantage', () => {
    const modifiers = [{ target: 'attack_rolls', effect: 'disadvantage' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.attackDisadvantageCount).toBe(1);
  });

  it('sets autoRerollForSaves for reroll effect on saving_throw', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'reroll', condition: 'favored_enemy' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.autoRerollForSaves).toBe(true);
    expect(result.autoRerollForChecks).toBe(false);
    expect(result.autoRerollCondition).toBe('favored_enemy');
  });

  it('sets autoRerollForChecks for reroll effect on d20 target', () => {
    const modifiers = [{ target: 'd20', effect: 'reroll', condition: 'halfling_lucky' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.autoRerollForSaves).toBe(false);
    expect(result.autoRerollForChecks).toBe(true);
    expect(result.autoRerollCondition).toBe('halfling_lucky');
  });

  it('sets autoRerollBonus when bonusExpression is provided', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'reroll', bonusExpression: '+5' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.autoRerollBonus).toBe('+5');
  });

  it('sets strSaveReplace for replacement effect with STR and saving_throw target', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'replacement', saveType: 'STR' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.strSaveReplace).toBe(true);
  });

  it('sets strCheckReplace for replacement effect with STR and check target', () => {
    const modifiers = [{ target: 'check', effect: 'replacement', saveType: 'STR' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.strCheckReplace).toBe(true);
  });

  it('sets tacticalMind and tacticalMindBonus for tactical_mind effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'tactical_mind', bonusExpression: 'int_level' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.tacticalMind).toBe(true);
    expect(result.tacticalMindBonus).toBe('int_level');
  });

  it('sets wisCheckReplace and wisCheckReplaceAbilities for wis_replacement effect', () => {
    const modifiers = [{ target: 'check', effect: 'wis_replacement', abilities: ['CHA'] }];
    const result = computeConditionEffects([], modifiers);
    expect(result.wisCheckReplace).toBe(true);
    expect(result.wisCheckReplaceAbilities).toEqual(['CHA']);
  });

  it('sets reliableTalent for reliable_talent effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'reliable_talent' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.reliableTalent).toBe(true);
  });

  it('sets strokeOfLuck for stroke_of_luck effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'stroke_of_luck' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.strokeOfLuck).toBe(true);
  });

  it('sets luckyAdvantage for lucky_point with advantage effectType', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'lucky_point', effectType: 'advantage' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.luckyAdvantage).toBe(true);
  });

  it('sets luckyDisadvantage for lucky_point with disadvantage effectType', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'lucky_point', effectType: 'disadvantage' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.luckyDisadvantage).toBe(true);
  });

  it('sets modifyD20Roll fields for modify_d20_roll effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'modify_d20_roll', diceExpression: '2d6', canBeBonusOrPenalty: true }];
    const result = computeConditionEffects([], modifiers);
    expect(result.modifyD20Roll).toBe(true);
    expect(result.modifyD20RollDice).toBe('2d6');
    expect(result.modifyD20RollCanBeBonusOrPenalty).toBe(true);
  });

  it('defaults modifyD20RollDice to 2d4 when diceExpression is missing', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'modify_d20_roll' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.modifyD20RollDice).toBe('2d4');
  });

  it('sets restoreBalance for restore_balance effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'restore_balance' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.restoreBalance).toBe(true);
  });

  it('sets d20Floor10 for d20_floor_10 effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'd20_floor_10' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.d20Floor10).toBe(true);
  });

  it('sets noAdvantageAgainst for no_advantage_against effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'no_advantage_against' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.noAdvantageAgainst).toBe(true);
  });

  it('sets darkOnesLuck for dark_ones_luck effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'dark_ones_luck' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.darkOnesLuck).toBe(true);
  });

  it('sets portent for portent effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'portent' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.portent).toBe(true);
  });

  it('sets improvedIllusions for improved_illusions effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'improved_illusions' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.improvedIllusions).toBe(true);
  });

  it('sets illusoryReality for illusory_reality effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'illusory_reality' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.illusoryReality).toBe(true);
  });

  it('sets potentCantrip for potent_cantrip effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'potent_cantrip' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.potentCantrip).toBe(true);
  });

  it('sets soulstitchSpells for soulstitch_spells effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'soulstitch_spells' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.soulstitchSpells).toBe(true);
  });

  it('sets passWithoutTraceBonus with default of 10 when bonusExpression is missing', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'pass_without_trace' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.passWithoutTraceBonus).toBe('10');
  });

  it('sets passWithoutTraceBonus from bonusExpression when provided', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'pass_without_trace', bonusExpression: '+5' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.passWithoutTraceBonus).toBe('+5');
  });

  it('sets strCheckDisadvantage for str_check_disadvantage effect', () => {
    const modifiers = [{ target: 'check', effect: 'str_check_disadvantage' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.strCheckDisadvantage).toBe(true);
  });

  it('sets rayOfEnfeebleDamageReduction for ray_of_enfeeble_damage_reduction effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'ray_of_enfeeble_damage_reduction' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.rayOfEnfeebleDamageReduction).toBe(true);
  });

  it('increments saveDisadvantageCount for save disadvantage without abilities', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'disadvantage' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.saveDisadvantageCount).toBe(1);
  });

  it('increments saveAdvantageCount for save advantage without abilities', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'advantage' }];
    const result = computeConditionEffects([], modifiers);
    expect(result.saveAdvantageCount).toBe(1);
  });

  it('tracks per-ability saveDisadvantageAbilities when modifier has abilities and no abilityName', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'disadvantage', abilities: ['CON', 'WIS'] }];
    const result = computeConditionEffects([], modifiers);
    expect(result.saveDisadvantageAbilities).toEqual(['CON', 'WIS']);
    expect(result.saveDisadvantageCount).toBe(0);
  });
});
