// @maintained-by-ai
// Internal lane: the direct predicate matrix of saveModifierApplies and the
// loop/skip/guard contract of applySaveModifiers — the ONLY faces the engine
// censuses cannot reach: combatContext pairs (this is the only test file in
// the family that drives combatContext), caller-supplied saveType/abilityName
// (compute passes saveType:null), short-circuit-before-gate ordering, and
// ctx-flag mirrors. Per-te/per-modifier fold math is owned by
// conditionEffectsCompute.test.js (#1000 folded()/exact diff); dispatch order
// over the te registry lives in conditionEffects.test.js (#998); restore-
// balance net-mode + its CLA-295 compute row live in restoreBalance.test.js.
//
// old → new map (all 61 old its):
//   target validation (2)                → gate truth-table it.each — ALL 12
//     SAVE_GATE_TARGETS + unknown (old table silently omitted ability_check,
//     check, d20, performance_checks, deception_performance_checks)
//   effect short-circuits loop (9)     → short-circuit it.each over the REAL
//     SAVE_ALWAYS_APPLIES_EFFECTS (7), each with impossible context (unknown
//     target + non-matching condition) so short-circuit is falsifiable and
//     not confusable with the fallback. d20_floor_10 / no_advantage_against
//     CUT from this table: they are NOT in the always-set — old test passed
//     via target-gate + fallback for the wrong reason (honest-title #910);
//     their fold bytes are compute #1000 :96.
//   CLA-295 test (1)                     → restore_balance it.each (all false);
//     its applySaveModifiers leg asserted undefined on a field the module
//     never writes (vacuous #842) → replaced by a real skip-row inside the
//     applySaveModifiers exact-fold test.
//   creature_grappled_by_you (10) + grappling_target (3) → grapple-pair
//     it.each (full row set + condition-parity rows for grappling_target —
//     both conditions dispatch the same grappledTargetActive handler)
//   mounted_and_target_one_size_smaller (13) → size-order it.each (+1 row
//     pinning the || 'Medium' mountSize default)
//   condition-based boolean checks (12) → ctx-flag mirror it.each (+ trance
//     pre-gate and elder_champion_attacker / powerful_build_grapple_escape /
//     remarkable_athlete_athletics rows — mirrors absent from the old file)
//   saveType-based (3) + magic (4) + keyword matching (5, incl. final-
//     fallback dupe of the gate table's first row) → fall-through it.each
//   first_round_target_no_turn (9)     → initiative-order it.each (+2 rows
//     for target_hasnt_taken_turn, the round-free sibling predicate)
//   applySaveModifiers (0 direct)        → exact-fold + guard tests.
import { describe, it, expect } from 'vitest';
import { saveModifierApplies, applySaveModifiers } from './conditionEffectsInternal.js';

// Verbatim-fixture helper: every row below is hand-derived from the source
// dispatch order (#993); zero mocks, pure helper, exact I/O (#952).
const applies = (modifier, ctx = {}) => saveModifierApplies({ modifier, saveType: null, abilityName: null, ...ctx });

// ---------------------------------------------------------------------------
// Gate truth-tables: never-applies / always-applies short-circuits run
// BEFORE the target gate; unknown targets die at the gate.
// ---------------------------------------------------------------------------

describe('saveModifierApplies — short-circuits, target gate, fall-through', () => {

  // restore_balance is reaction-spend-only, never a passive modifier (CLA-295).
  it.each([
    [{ target: 'd20' }],
    [{ target: 'saving_throw' }],
    [{ target: 'attack_roll' }],
    [{ target: 'saving_throw', condition: 'raging' }],
  ])('restore_balance never applies: %o', (modifier) => {
    expect(applies({ ...modifier, effect: 'restore_balance' })).toBe(false);
  });

  // Short-circuit proof: even with an unknown target AND a condition that
  // would otherwise return false, the always-set wins (pre-gate ordering).
  it.each([
    ['replacement'], ['reliable_talent'], ['dex_jump'], ['dark_ones_luck'],
    ['portent'], ['potent_cantrip'], ['soulstitch_spells'],
  ])('effect %s short-circuits true past the gate and all conditions', (effect) => {
    expect(applies({ target: 'not_a_gate_target', condition: 'raging', effect })).toBe(true);
  });

  // Full SAVE_GATE_TARGETS census — every listed target passes with no
  // condition; anything else dies at the gate.
  it.each([
    ['saving_throw', true], ['save', true], ['attack_roll', true], ['attack_rolls', true],
    ['attack_rolls_vs_unmounted_near_mount', true], ['concentration_saving_throws', true],
    ['death_saving_throws', true], ['ability_check', true], ['check', true], ['d20', true],
    ['performance_checks', true], ['deception_performance_checks', true],
    ['unknown_target', false],
  ])('target gate: %s → %s', (target, expected) => {
    expect(applies({ target })).toBe(expected);
  });

  // Post-gate fall-through: keywords are suppressed, caller saveType/
  // conditionSet/abilityName open or block (faces compute never produces).
  it.each([
    ['charmed + matching saveType applies', { target: 'saving_throw', condition: 'charmed' }, { saveType: 'charmed' }, true],
    ['frightened + matching saveType applies', { target: 'saving_throw', condition: 'frightened' }, { saveType: 'frightened' }, true],
    ['poison + matching saveType applies', { target: 'saving_throw', condition: 'poison' }, { saveType: 'poison' }, true],
    ['charmed + non-matching saveType falls through to keyword block', { target: 'saving_throw', condition: 'charmed' }, { saveType: 'DEX' }, false],
    ['condition present in conditions set applies, beating an ability mismatch', { target: 'saving_throw', condition: 'rage', abilities: ['DEX'] }, { conditions: ['rage'], abilityName: 'STR' }, true],
    ['condition absent from conditions set falls through to abilities', { target: 'saving_throw', condition: 'rage', abilities: ['STR'] }, { conditions: ['blinded'], abilityName: 'DEX' }, false],
    ['magic applies when abilities empty', { target: 'saving_throw', condition: 'magic', abilities: [] }, {}, true],
    ['magic applies on ability match', { target: 'saving_throw', condition: 'magic', abilities: ['DEX', 'WIS'] }, { abilityName: 'DEX' }, true],
    ['magic blocks on ability mismatch', { target: 'saving_throw', condition: 'magic', abilities: ['DEX', 'WIS'] }, { abilityName: 'CON' }, false],
    ['magic blocks when abilityName null but abilities listed', { target: 'saving_throw', condition: 'magic', abilities: ['DEX'] }, {}, false],
    ['bare abilities apply on match', { target: 'saving_throw', abilities: ['STR', 'DEX'] }, { abilityName: 'STR' }, true],
    ['bare abilities apply generically when abilityName null (contrast magic)', { target: 'saving_throw', abilities: ['STR', 'DEX'] }, {}, true],
    ['bare abilities block on mismatch', { target: 'saving_throw', abilities: ['STR'] }, { abilityName: 'DEX' }, false],
    ['no condition, no abilities: gate pass is the final fallback', { target: 'saving_throw' }, {}, true],
  ])('fall-through: %s', (_name, modifier, ctx, expected) => {
    expect(applies(modifier, ctx)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// combatContext predicates — reachable ONLY through this direct lane
// (no sibling test file in the family passes combatContext).
// ---------------------------------------------------------------------------

// Shared fixtures: Player attacking Goblin, Goblin's conditions vary.
const ctxVs = (goblinConditions) => ({
  combatContext: {
    creatures: [
      { name: 'Player', targetName: 'Goblin' },
      { name: 'Goblin', ...(goblinConditions === undefined ? {} : { conditions: goblinConditions }) },
    ],
    activeCreatureName: 'Player',
  },
});

describe('saveModifierApplies — combatContext: grapple pair', () => {
  it.each([
    ['string grappled', ['grappled'], true],
    ['object condition {key}', [{ key: 'grappled' }], true],
    ['mixed conditions', ['blinded', { key: 'grappled' }], true],
    ['other condition only', ['blinded'], false],
    ['no conditions array', undefined, false],
  ])('creature_grappled_by_you vs target with %s → %s', (_name, conditions, expected) => {
    expect(applies({ target: 'saving_throw', condition: 'creature_grappled_by_you' }, ctxVs(conditions))).toBe(expected);
  });

  // grappling_target dispatches the same handler — parity rows.
  it('grappling_target has grapple-pair parity', () => {
    expect(applies({ target: 'attack_roll', condition: 'grappling_target', effect: 'advantage' }, ctxVs(['grappled']))).toBe(true);
    expect(applies({ target: 'attack_roll', condition: 'grappling_target', effect: 'advantage' }, ctxVs(['blinded']))).toBe(false);
  });

  it.each([
    ['no combatContext', undefined],
    ['combatContext without creatures', {}],
    ['attacker name unresolvable', { creatures: [{ name: 'Goblin', conditions: ['grappled'] }], attackerName: null }],
    ['attacker has no targetName', { creatures: [{ name: 'Player' }], activeCreatureName: 'Player' }],
  ])('grapple pair unresolved: %s → false', (_name, combatContext) => {
    expect(applies({ target: 'saving_throw', condition: 'creature_grappled_by_you' }, { combatContext })).toBe(false);
  });

  it('falls back to attackerName when activeCreatureName is missing', () => {
    const combatContext = {
      creatures: [{ name: 'Player', targetName: 'Goblin' }, { name: 'Goblin', conditions: ['grappled'] }],
      attackerName: 'Player',
    };
    expect(applies({ target: 'saving_throw', condition: 'creature_grappled_by_you' }, { combatContext })).toBe(true);
  });
});

describe('saveModifierApplies — combatContext: mounted_and_target_one_size_smaller', () => {
  const mod = { target: 'attack_roll', condition: 'mounted_and_target_one_size_smaller' };
  const mounted = (attacker, targetName = 'Goblin', targetSize = 'Small') => ({
    combatContext: {
      creatures: [{ name: 'Player', targetName, ...attacker }, { name: targetName, size: targetSize }],
      activeCreatureName: 'Player',
    },
  });

  it.each([
    ['Large mount vs Small target at 5ft', mounted({ isMounted: true, mountSize: 'Large', rangeToTarget: 5 }), true],
    ['rangeToTarget undefined counts as in range', mounted({ isMounted: true, mountSize: 'Large' }), true],
    ['mountSize omitted defaults to Medium vs Small', mounted({ isMounted: true }), true],
    ['not mounted', mounted({ isMounted: false, mountSize: 'Large' }), false],
    ['incapacitated (string) blocks', mounted({ isMounted: true, mountSize: 'Large', rangeToTarget: 5, conditions: ['incapacitated'] }), false],
    ['incapacitated (object) blocks', mounted({ isMounted: true, mountSize: 'Large', rangeToTarget: 5, conditions: [{ key: 'incapacitated' }] }), false],
    ['same size', mounted({ isMounted: true, mountSize: 'Medium' }, 'Orc', 'Medium'), false],
    ['target larger than mount', mounted({ isMounted: true, mountSize: 'Small' }, 'Ogre', 'Large'), false],
    ['beyond 5ft', mounted({ isMounted: true, mountSize: 'Large', rangeToTarget: 10 }), false],
    ['unrecognized mountSize', mounted({ isMounted: true, mountSize: 'Unknown', rangeToTarget: 5 }), false],
    ['unrecognized target size', mounted({ isMounted: true, mountSize: 'Large', rangeToTarget: 5 }, 'Goblin', 'Unknown'), false],
  ])('%s → %s', (_name, ctx, expected) => {
    expect(applies(mod, ctx)).toBe(expected);
  });

  it.each([
    ['no combatContext', undefined],
    ['combatContext without creatures', {}],
    ['attacker not in initiative', { creatures: [{ name: 'Other', isMounted: true, mountSize: 'Large' }], activeCreatureName: 'Player' }],
    ['target not in initiative', { creatures: [{ name: 'Player', isMounted: true, mountSize: 'Large', targetName: 'Missing' }], activeCreatureName: 'Player' }],
  ])('unresolved: %s → false', (_name, combatContext) => {
    expect(applies(mod, { combatContext })).toBe(false);
  });
});

describe('saveModifierApplies — combatContext: initiative order', () => {
  const firstRound = { target: 'saving_throw', condition: 'first_round_target_no_turn' };
  const order = (round, creatures) => ({ combatContext: { ...(round ? { round } : {}), creatures } });
  const right = [{ name: 'Player', targetName: 'Goblin' }, { name: 'Goblin' }];
  const left = [{ name: 'Goblin' }, { name: 'Player', targetName: 'Goblin' }];

  it.each([
    ['round 1, target to the right', order(1, right), true],
    ['round 1, target to the left', order(1, left), false],
    ['target at same index (self)', order(1, [{ name: 'Player', targetName: 'Player' }]), false],
    ['round 2 never fires', order(2, right), false],
    ['round missing defaults to round 1', order(null, right), true],
    ['unresolvable attacker defaults true', order(1, [{ name: 'Player' }]), true],
    ['no combatContext', undefined, false],
    ['combatContext without creatures', {}, false],
  ])('first_round_target_no_turn: %s → %s', (_name, ctx, expected) => {
    expect(applies(firstRound, { ...ctx, attackerName: ctx ? 'Player' : undefined })).toBe(expected);
  });

  // Round-free sibling: same index math, no round===1 gate.
  it('target_hasnt_taken_turn keeps firing past round 1', () => {
    const mod = { target: 'saving_throw', condition: 'target_hasnt_taken_turn' };
    expect(applies(mod, { ...order(2, right), attackerName: 'Player' })).toBe(true);
    expect(applies(mod, { ...order(2, left), attackerName: 'Player' })).toBe(false);
  });

  // attackerName lives on the options object, not combatContext, for these.
  it('attackerName missing falls through the index math (defaults true)', () => {
    expect(applies(firstRound, order(1, right))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Ctx-flag mirrors: condition key ⇄ caller boolean, plus the always-true
// and list-membership conditions. trance_of_order_active is a PRE-gate
// mirror — true even for a target outside SAVE_GATE_TARGETS.
// ---------------------------------------------------------------------------

describe('saveModifierApplies — ctx-flag mirrors', () => {
  it.each([
    ['raging', 'isRaging'],
    ['shape_shift', 'shapeShiftActive'],
    ['peerless_athlete', 'isPeerlessAthlete'],
    ['large_form_active', 'isLargeFormActive'],
    ['living_legend_active', 'isLivingLegendActive'],
    ['elder_champion_active', 'isElderChampionActive'],
    ['elder_champion_attacker', 'isElderChampionAttackerActive'],
    ['protection_from_poison_active', 'isProtectionFromPoisonActive'],
    ['powerful_build_grapple_escape', 'hasPowerfulBuild'],
  ])('%s mirrors %s both ways', (condition, flag) => {
    expect(applies({ target: 'saving_throw', condition }, { [flag]: true })).toBe(true);
    expect(applies({ target: 'saving_throw', condition })).toBe(false);
  });

  it('trance_of_order_active applies pre-gate', () => {
    expect(applies({ target: 'not_a_gate_target', condition: 'trance_of_order_active' }, { isTranceOfOrderActive: true })).toBe(true);
    expect(applies({ target: 'not_a_gate_target', condition: 'trance_of_order_active' })).toBe(false);
  });

  it('holy_aura_active gates on attackerName membership', () => {
    const mod = { target: 'attack_roll', condition: 'holy_aura_active' };
    expect(applies(mod, { attackerName: 'Player', holyAuraTargets: ['Player', 'Ally'] })).toBe(true);
    expect(applies(mod, { attackerName: 'Player', holyAuraTargets: ['Ally', 'Enemy'] })).toBe(false);
  });

  it.each([
    ['fiend_undead'], ['concentration_breaker'], ['pfeag_save_advantage'], ['remarkable_athlete_athletics'],
  ])('%s is always true', (condition) => {
    expect(applies({ target: 'saving_throw', condition })).toBe(true);
  });

  it('peerless_athlete ability filter', () => {
    const mod = { target: 'saving_throw', condition: 'peerless_athlete', abilities: ['STR'] };
    expect(applies(mod, { isPeerlessAthlete: true, abilityName: 'STR' })).toBe(true);
    expect(applies(mod, { isPeerlessAthlete: true, abilityName: 'DEX' })).toBe(false);
    expect(applies(mod, { isPeerlessAthlete: true })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applySaveModifiers — loop contract: gate-skip, target-skip, accumulation,
// effect-applier dispatch, and guards. Fold bytes per effect live in the
// compute census (#1000); exact diff here is the helper's own args.
// ---------------------------------------------------------------------------

describe('applySaveModifiers', () => {
  it('folds applicable modifiers exactly; skips gated and unknown-target ones', () => {
    const effects = {};
    applySaveModifiers({
      effects,
      modifiers: [
        { source: 'Bless', target: 'saving_throw', effect: 'advantage' },
        { source: 'Agony', target: 'saving_throw', effect: 'disadvantage' },
        { source: 'Frenzy', target: 'attack_rolls', effect: 'advantage' },
        { source: 'Portent', target: 'd20', effect: 'portent' },
        { source: 'Luck', target: 'd20', effect: 'stroke_of_luck' },
        { source: 'Bard', target: 'd20', effect: 'bardic_inspiration' },
        { source: 'Restore Balance', target: 'saving_throw', effect: 'restore_balance' },
        { source: 'Junk', target: 'not_a_gate_target', effect: 'advantage' },
      ],
    });
    expect(effects).toEqual({
      saveAdvantageCount: 1,
      saveDisadvantageCount: 1,
      attackAdvantageCount: 1,
      portent: true,
      strokeOfLuck: true,
      bardicInspiration: true,
    });
  });

  it('accumulates repeated applicable effects', () => {
    const effects = {};
    applySaveModifiers({
      effects,
      modifiers: [
        { target: 'saving_throw', effect: 'advantage' },
        { target: 'saving_throw', effect: 'advantage' },
        { target: 'd20', effect: 'portent' },
        { target: 'd20', effect: 'portent' },
      ],
    });
    expect(effects).toEqual({ saveAdvantageCount: 2, portent: true });
  });

  it('guards: no options, empty modifiers, and a modifier-less entry', () => {
    const untouched = {};
    expect(() => applySaveModifiers()).not.toThrow();
    expect(() => applySaveModifiers({ effects: untouched, modifiers: [] })).not.toThrow();
    expect(untouched).toEqual({});
    expect(() => saveModifierApplies({})).toThrow(TypeError);
  });
});
