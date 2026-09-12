// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { saveModifierApplies, applySaveModifiers } from './conditionEffectsInternal.js';

// ---------------------------------------------------------------------------
// saveModifierApplies — target validation
// ---------------------------------------------------------------------------

describe('saveModifierApplies — target validation', () => {

  it('returns true for valid target types when no other conditions apply', () => {
    expect(saveModifierApplies({ modifier: { target: 'saving_throw' }, saveType: 'saving_throw', abilityName: 'STR' })).toBe(true);
    expect(saveModifierApplies({ modifier: { target: 'save' }, saveType: 'saving_throw', abilityName: 'STR' })).toBe(true);
    expect(saveModifierApplies({ modifier: { target: 'attack_roll' }, saveType: 'saving_throw', abilityName: 'STR' })).toBe(true);
    expect(saveModifierApplies({ modifier: { target: 'attack_rolls' }, saveType: 'saving_throw', abilityName: 'STR' })).toBe(true);
    expect(
      saveModifierApplies({ modifier: { target: 'attack_rolls_vs_unmounted_near_mount' }, saveType: 'saving_throw', abilityName: 'STR' }),
    ).toBe(true);
    expect(
      saveModifierApplies({ modifier: { target: 'concentration_saving_throws' }, saveType: 'saving_throw', abilityName: 'STR' }),
    ).toBe(true);
    expect(saveModifierApplies({ modifier: { target: 'death_saving_throws' }, saveType: 'saving_throw', abilityName: 'STR' })).toBe(true);
  });

  it('returns false for unknown target types', () => {
    expect(saveModifierApplies({ modifier: { target: 'unknown_target' }, saveType: 'saving_throw', abilityName: 'STR' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// saveModifierApplies — effect short-circuit paths
// ---------------------------------------------------------------------------

describe('saveModifierApplies — effect short-circuits', () => {

  const effectShortCircuits = [
    'replacement',
    'reliable_talent',
    'dex_jump',
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
      expect(saveModifierApplies({ modifier, saveType: 'saving_throw', abilityName: 'STR' })).toBe(true);
    });
  }

  it('CLA-295: rejects restore_balance modifiers (reaction spend only, never passive)', () => {
    expect(saveModifierApplies({ modifier: { target: 'd20', effect: 'restore_balance' }, saveType: 'saving_throw', abilityName: 'STR' })).toBe(false);
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', effect: 'restore_balance' }, saveType: 'saving_throw', abilityName: 'STR' })).toBe(false);
    expect(saveModifierApplies({ modifier: { target: 'attack_roll', effect: 'restore_balance' }, saveType: 'saving_throw', abilityName: 'STR' })).toBe(false);
    const effects = {};
    applySaveModifiers({ effects, modifiers: [
      { source: 'Restore Balance', target: 'd20', condition: '', effect: 'restore_balance' },
      { source: 'Restore Balance', target: 'saving_throw', condition: '', effect: 'restore_balance' },
    ] });
    expect(effects.restoreBalance).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// saveModifierApplies — creature_grappled_by_you
// ---------------------------------------------------------------------------

describe('saveModifierApplies — creature_grappled_by_you', () => {
  const modifier = { target: 'saving_throw', condition: 'creature_grappled_by_you' };

  it('returns true when active creature attacks a grappled target', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin', conditions: ['grappled'] },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(true);
  });

  it('returns true when grappled condition is stored as an object', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin', conditions: [{ key: 'grappled' }] },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(true);
  });

  it('returns true when grappled condition is mixed with other condition objects', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin', conditions: ['blinded', { key: 'grappled' }] },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(true);
  });

  it('returns false when target has no grappled condition', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin', conditions: ['blinded'] },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(false);
  });

  it('returns false when target has no conditions array', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin' },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(false);
  });

  it('returns false when combatContext is null', () => {
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR' })).toBe(false);
  });

  it('returns false when combatContext has no creatures array', () => {
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext: {} })).toBe(false);
  });

  it('returns false when attackerName is null', () => {
    const combatContext = {
      creatures: [{ name: 'Goblin', conditions: ['grappled'] }],
      attackerName: null,
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(false);
  });

  it('falls back to attackerName when activeCreatureName is missing', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin', conditions: ['grappled'] },
      ],
      attackerName: 'Player',
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(true);
  });

  it('returns false when attacker creature has no targetName', () => {
    const combatContext = {
      creatures: [{ name: 'Player' }],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// saveModifierApplies — grappling_target
// ---------------------------------------------------------------------------

describe('saveModifierApplies — grappling_target', () => {
  const modifier = { target: 'attack_roll', condition: 'grappling_target', effect: 'advantage' };

  it('returns true when attacker has grappled target (5e Grappler feat)', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin', conditions: ['grappled'] },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(true);
  });

  it('returns false when target is not grappled', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin', conditions: ['blinded'] },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(false);
  });

  it('returns false when combatContext is null', () => {
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR' })).toBe(false);
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

  it('returns true when mounted attacker strikes a one-size-smaller target within 5ft', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', isMounted: true, mountSize: 'Large', targetName: 'Goblin', rangeToTarget: 5 },
        { name: 'Goblin', size: 'Small' },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(true);
  });

  it('returns true when rangeToTarget is undefined (treated as within range)', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', isMounted: true, mountSize: 'Large', targetName: 'Goblin' },
        { name: 'Goblin', size: 'Small' },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(true);
  });

  it('returns false when attacker is not mounted', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', isMounted: false, targetName: 'Goblin' },
        { name: 'Goblin', size: 'Small' },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(false);
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
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(false);
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
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(false);
  });

  it('returns false when target is same size as mount', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', isMounted: true, mountSize: 'Medium', targetName: 'Orc', rangeToTarget: 5 },
        { name: 'Orc', size: 'Medium' },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(false);
  });

  it('returns false when target is larger than mount', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', isMounted: true, mountSize: 'Small', targetName: 'Ogre', rangeToTarget: 5 },
        { name: 'Ogre', size: 'Large' },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(false);
  });

  it('returns false when beyond 5ft range', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', isMounted: true, mountSize: 'Large', targetName: 'Goblin', rangeToTarget: 10 },
        { name: 'Goblin', size: 'Small' },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(false);
  });

  it('returns false when combatContext is null', () => {
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR' })).toBe(false);
  });

  it('returns false when combatContext has no creatures array', () => {
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext: {} })).toBe(false);
  });

  it('returns false when attacker creature is not found', () => {
    const combatContext = {
      creatures: [{ name: 'Other', isMounted: true, mountSize: 'Large' }],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(false);
  });

  it('returns false when target creature is not found', () => {
    const combatContext = {
      creatures: [{ name: 'Player', isMounted: true, mountSize: 'Large', targetName: 'Missing' }],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(false);
  });

  it('returns false when mountSize is unrecognized', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', isMounted: true, mountSize: 'Unknown', targetName: 'Goblin', rangeToTarget: 5 },
        { name: 'Goblin', size: 'Small' },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(false);
  });

  it('returns false when target size is unrecognized', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', isMounted: true, mountSize: 'Large', targetName: 'Goblin', rangeToTarget: 5 },
        { name: 'Goblin', size: 'Unknown' },
      ],
      activeCreatureName: 'Player',
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// saveModifierApplies — condition-based boolean checks
// ---------------------------------------------------------------------------

describe('saveModifierApplies — condition-based boolean checks', () => {

  it('returns isRaging when condition is raging', () => {
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'raging' }, saveType: 'saving_throw', abilityName: 'STR', isRaging: true })).toBe(true);
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'raging' }, saveType: 'saving_throw', abilityName: 'STR' })).toBe(false);
  });

  it('returns shapeShiftActive when condition is shape_shift', () => {
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'shape_shift' }, saveType: 'saving_throw', abilityName: 'STR', shapeShiftActive: true })).toBe(true);
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'shape_shift' }, saveType: 'saving_throw', abilityName: 'STR' })).toBe(false);
  });

  it('returns isPeerlessAthlete when condition is peerless_athlete', () => {
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'peerless_athlete' }, saveType: 'saving_throw', abilityName: 'STR', isPeerlessAthlete: true })).toBe(true);
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'peerless_athlete' }, saveType: 'saving_throw', abilityName: 'STR' })).toBe(false);
  });

  it('returns isLargeFormActive when condition is large_form_active', () => {
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'large_form_active' }, saveType: 'saving_throw', abilityName: 'STR', isLargeFormActive: true })).toBe(true);
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'large_form_active' }, saveType: 'saving_throw', abilityName: 'STR' })).toBe(false);
  });

  const alwaysTrueConditions = [
    'fiend_undead',
    'concentration_breaker',
    'pfeag_save_advantage',
  ];

  for (const condition of alwaysTrueConditions) {
    it(`returns true when condition is "${condition}"`, () => {
      expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition }, saveType: 'saving_throw', abilityName: 'STR' })).toBe(true);
    });
  }

  it('returns isLivingLegendActive when condition is living_legend_active', () => {
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'living_legend_active' }, saveType: 'saving_throw', abilityName: 'STR', isLivingLegendActive: true, holyAuraTargets: false })).toBe(true);
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'living_legend_active' }, saveType: 'saving_throw', abilityName: 'STR', holyAuraTargets: false })).toBe(false);
  });

  it('returns isElderChampionActive when condition is elder_champion_active', () => {
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'elder_champion_active' }, saveType: 'saving_throw', abilityName: 'STR', isElderChampionActive: true, holyAuraTargets: false })).toBe(true);
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'elder_champion_active' }, saveType: 'saving_throw', abilityName: 'STR', holyAuraTargets: false })).toBe(false);
  });

  it('returns true when attackerName is in holyAuraTargets for holy_aura_active', () => {
    expect(saveModifierApplies({ modifier: { target: 'attack_roll', condition: 'holy_aura_active' }, saveType: 'saving_throw', abilityName: 'STR', attackerName: 'Player', holyAuraTargets: ['Player', 'Ally'] })).toBe(true);
    expect(saveModifierApplies({ modifier: { target: 'attack_roll', condition: 'holy_aura_active' }, saveType: 'saving_throw', abilityName: 'STR', attackerName: 'Player', holyAuraTargets: ['Ally', 'Enemy'] })).toBe(false);
  });

  it('returns isProtectionFromPoisonActive when condition is protection_from_poison_active', () => {
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'protection_from_poison_active' }, saveType: 'saving_throw', abilityName: 'STR', holyAuraTargets: false, isProtectionFromPoisonActive: true })).toBe(true);
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'protection_from_poison_active' }, saveType: 'saving_throw', abilityName: 'STR', holyAuraTargets: false })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// saveModifierApplies — saveType-based conditions
// ---------------------------------------------------------------------------

describe('saveModifierApplies — saveType-based conditions', () => {

  it('returns true when charmed condition matches charmed saveType', () => {
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'charmed' }, saveType: 'charmed', abilityName: 'STR' })).toBe(true);
  });

  it('returns true when frightened condition matches frightened saveType', () => {
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'frightened' }, saveType: 'frightened', abilityName: 'STR' })).toBe(true);
  });

  it('returns true when poison condition matches poison saveType', () => {
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'poison' }, saveType: 'poison', abilityName: 'STR' })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// saveModifierApplies — magic condition with abilities
// ---------------------------------------------------------------------------

describe('saveModifierApplies — magic condition', () => {

  it('returns true when abilities array is empty', () => {
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'magic', abilities: [] }, saveType: 'DEX', abilityName: 'DEX' })).toBe(true);
  });

  it('returns true when abilityName matches an ability in the list', () => {
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'magic', abilities: ['DEX', 'WIS'] }, saveType: 'DEX', abilityName: 'DEX' })).toBe(true);
  });

  it('returns false when abilityName does not match any ability', () => {
    expect(
      saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'magic', abilities: ['DEX', 'WIS'] }, saveType: 'CON', abilityName: 'STR' }),
    ).toBe(false);
  });

  it('returns false when abilityName is null and abilities list is non-empty', () => {
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'magic', abilities: ['DEX'] }, saveType: 'saving_throw', abilityName: null })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// saveModifierApplies — first_round_target_no_turn
// ---------------------------------------------------------------------------

describe('saveModifierApplies — first_round_target_no_turn', () => {
  const modifier = { target: 'saving_throw', condition: 'first_round_target_no_turn' };

  it('returns true on round 1 when target has lower or equal initiative (to the right)', () => {
    const combatContext = {
      round: 1,
      creatures: [
        { name: 'Ally', targetName: 'Goblin' },
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin' },
      ],
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext, attackerName: 'Player' })).toBe(true);
  });

  it('returns false on round 1 when target has higher initiative (to the left)', () => {
    const combatContext = {
      round: 1,
      creatures: [
        { name: 'Goblin' },
        { name: 'Player', targetName: 'Goblin' },
      ],
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext, attackerName: 'Player' })).toBe(false);
  });

  it('returns false when target has same initiative as attacker (same index)', () => {
    const combatContext = {
      round: 1,
      creatures: [
        { name: 'Player', targetName: 'Player' },
      ],
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext, attackerName: 'Player' })).toBe(false);
  });

  it('returns false on round 2', () => {
    const combatContext = {
      round: 2,
      creatures: [
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin' },
      ],
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext, attackerName: 'Player' })).toBe(false);
  });

  it('returns false when combatContext is null', () => {
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', attackerName: 'Player' })).toBe(false);
  });

  it('returns false when combatContext has no creatures', () => {
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext: {}, attackerName: 'Player' })).toBe(false);
  });

  it('returns true when round is missing (defaults to 1) and target is to the right', () => {
    const combatContext = {
      creatures: [
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin' },
      ],
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext, attackerName: 'Player' })).toBe(true);
  });

  it('returns true when targetName is missing', () => {
    const combatContext = {
      round: 1,
      creatures: [
        { name: 'Player' },
      ],
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext, attackerName: 'Player' })).toBe(true);
  });

  it('returns true when attackerName is missing', () => {
    const combatContext = {
      round: 1,
      creatures: [
        { name: 'Player', targetName: 'Goblin' },
        { name: 'Goblin' },
      ],
    };
    expect(saveModifierApplies({ modifier, saveType: 'DEX', abilityName: 'STR', combatContext })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// saveModifierApplies — condition keyword matching
// ---------------------------------------------------------------------------

describe('saveModifierApplies — condition keyword matching', () => {
  it('returns true when modifier.condition is in the conditions set', () => {
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'rage' }, saveType: 'saving_throw', abilityName: 'STR', conditions: ['rage'] })).toBe(true);
  });

  it('returns false when modifier.condition is not in conditions set and no abilities match', () => {
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', condition: 'rage', abilities: ['STR'] }, saveType: 'saving_throw', abilityName: 'DEX' })).toBe(false);
  });

  it('returns true when abilityName matches modifier.abilities', () => {
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', abilities: ['STR', 'DEX'] }, saveType: 'saving_throw', abilityName: 'STR' })).toBe(true);
  });

  it('returns true when abilityName is null and modifier has abilities', () => {
    expect(saveModifierApplies({ modifier: { target: 'saving_throw', abilities: ['STR', 'DEX'] }, saveType: 'saving_throw', abilityName: null })).toBe(true);
  });

  it('returns true as final fallback when nothing else matches', () => {
    expect(saveModifierApplies({ modifier: { target: 'saving_throw' }, saveType: 'saving_throw', abilityName: 'STR' })).toBe(true);
  });
});
