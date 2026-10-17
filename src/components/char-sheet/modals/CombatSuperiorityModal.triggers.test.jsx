// CombatSuperiorityModal — TRIGGERS lane. Owns the trigger-filtering seam:
// computeManeuverList predicate table, availableManeuvers override, prompt headers
// WITH attackContext / skillContext, lastAttack fallback, MN-014 group labels &
// hints, the onReopenSelection invoke/fallback/reject contracts, the use-maneuver
// reject half, and descriptions present (both modes).
//
// Ownership map (siblings own the rest — do NOT re-test here):
// .test.jsx ........... selection/use happy paths without context, toggling and
//                       confirm/clear/cancel, Select/Use headers w/o context.
// .runtime.test.jsx ... superiority-dice value semantics, no-dice notice + Close.
// .edge-cases ......... payload null/undefined, overlay containment, maxOptions 0/1,
//                       exact group ORDER, description omission, duplicates,
//                       known ∩ all cardinality, applied-result success swap (truthy).
// .mn003UseMode ....... use-mode reachability, Grant Attack null-resolve half.
//
// Trimmed from this file (ownership now noted above):
//  - standalone per-trigger filtering tests (melee/ranged/unarmed hit, miss,
//    damage-taken, straight-line, replace, no-trigger/any passthrough, attacker and
//    target identity mismatch — 15 executed cases) → consolidated into the 10-row
//    predicate table below; every row now pins the EXACT ordered radio list instead
//    of 2–3 spot checks, so each row covers its siblings' adversarial names too.
//  - 'does not call onConfirm when onReopenSelection resolves nothing' → subsumed
//    by the invoke test's exact zero-arg + onConfirm-not-called contract.
//  - mixed-label and dual-hint MN-014 cases → one test (plain heading AND both hints
//    in the same use-mode render).
//  - vacuity fix: the old override test asserted absence of 'Ki-Fueled Attack', a
//    name in NO input list; now asserts the unused allManeuvers entry is dropped.
//
// Conventions: fresh vi.fn per makeProps call; hoisted vi.mock of the runtime seam
// with afterEach mockReset().mockReturnValue(1) (never vi.spyOn on the real module,
// never restoreAllMocks/resetAllMocks — per base-lane recommendation); exact ordered
// arrays for rendered trigger lists; exact full-line strings over regex; same-object
// identity on the onConfirm fallback seed; role-scoped queries; waitFor/findBy — no
// bare setTimeout; no style-attribute selectors.

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import CombatSuperiorityModal from './CombatSuperiorityModal.jsx';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// Dice pin lives in the mocked module so this lane never touches the real runtime
// store; dice VALUE semantics are owned by .runtime.test.jsx. 1 > 0 keeps UseView
// ungated for every trigger scenario here.
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 1),
}));

afterEach(() => {
  vi.mocked(getRuntimeValue).mockReset().mockReturnValue(1);
});

// ── Fixtures / helpers ──

const BASE_MANEUVERS = [
  { name: 'Trip Attack', actionType: 'attack_rider' },
  { name: 'Pushing Attack', actionType: 'movement' },
  { name: 'Disarming Attack', actionType: 'attack_rider' },
  { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
  { name: 'Evasive Footwork', actionType: 'reaction' },
  { name: 'Kicking Attack', actionType: 'skill_check' },
  { name: 'Rally', actionType: 'movement' },
  { name: 'Grasping Vine', actionType: 'grant_attack' },
];

const PLAYER_STATS = { name: 'TestChar' };

// Pinned component copy.
const SELECT_HEADER = 'Combat Superiority — Select Maneuvers';
const CHOOSE_HEADER = 'Combat Superiority — Choose Maneuver';
const USE_HEADER = 'Combat Superiority — Use Maneuver';
const EMPTY_NOTICE = 'No maneuvers selected. Use Combat Superiority again to select your maneuvers.';

function makeProps(payloadOverrides = {}, propsOverrides = {}) {
  return {
    payload: { allManeuvers: BASE_MANEUVERS, maxOptions: 3, knownManeuvers: [], ...payloadOverrides },
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...propsOverrides,
  };
}

function renderModal(payloadOverrides = {}, propsOverrides = {}) {
  return render(<CombatSuperiorityModal {...makeProps(payloadOverrides, propsOverrides)} />);
}

// Maneuver names exactly as rendered (each row's <strong>), in DOM order —
// exact ordered arrays over spot-check presence helpers.
function namesInDomOrder() {
  return Array.from(document.querySelectorAll('strong')).map(el => el.textContent);
}

function headingsInDomOrder() {
  return screen.getAllByRole('heading', { level: 4 }).map(h => h.textContent);
}

// ── availableManeuvers override ──

describe('CombatSuperiorityModal - availableManeuvers override', () => {
  it('returns availableManeuvers verbatim, dropping every unused allManeuvers entry', () => {
    renderModal({
      allManeuvers: [{ name: 'Trip Attack', actionType: 'attack_rider' }],
      knownManeuvers: ['Available Only', 'Also Available'],
      availableManeuvers: [
        { name: 'Available Only', actionType: 'bonus_action' },
        { name: 'Also Available', actionType: 'reaction' },
      ],
      selectionMode: false,
    });
    expect(headingsInDomOrder()).toEqual(['Bonus Actions', 'Reactions']);
    expect(namesInDomOrder()).toEqual(['Available Only', 'Also Available']);
    expect(screen.queryByText('Trip Attack')).not.toBeInTheDocument();
  });

  it.each([
    ['use mode intersects the override with knownManeuvers at render', false, ['Ki-Fueled Attack']],
    ['selection mode shows every override entry unfiltered', true, ['Ki-Fueled Attack', 'Unknown Maneuver']],
  ])('%s', (_label, selectionMode, expectedNames) => {
    renderModal({
      allManeuvers: [],
      knownManeuvers: ['Ki-Fueled Attack'],
      availableManeuvers: [
        { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
        { name: 'Unknown Maneuver', actionType: 'reaction' },
      ],
      selectionMode,
    });
    const role = selectionMode ? 'checkbox' : 'radio';
    expectedNames.forEach(name => expect(screen.getByRole(role, { name: new RegExp(name) })).toBeInTheDocument());
    const hidden = selectionMode ? [] : ['Unknown Maneuver'];
    hidden.forEach(name => expect(screen.queryByText(name)).not.toBeInTheDocument());
  });

  it.each([
    ['an empty array', []],
    ['null', null],
    ['undefined', undefined],
  ])('falls back to allManeuvers when availableManeuvers is %s', (_label, val) => {
    renderModal({
      selectionMode: false,
      knownManeuvers: ['Ki-Fueled Attack'],
      availableManeuvers: val,
    });
    // Fallback + known-filter in one exact list: BASE entry survives, nothing else.
    expect(namesInDomOrder()).toEqual(['Ki-Fueled Attack']);
  });
});

// ── MN-014: trigger-contextual labels & hints ──

describe('CombatSuperiorityModal - MN-014 trigger-contextual labels', () => {
  it.each([
    ['attack_roll_miss rider', { name: 'Precision Attack', actionType: 'attack_rider', trigger: 'attack_roll_miss' },
      { hit: false, weaponType: 'melee', attackerName: 'TestChar' }, 'Attack Riders (on miss)', '— on miss', 'Attack Riders (on hit)'],
    ['weapon_attack_hit rider', { name: 'Menacing Attack', actionType: 'attack_rider', trigger: 'weapon_attack_hit' },
      { hit: true, weaponType: 'melee', attackerName: 'TestChar' }, 'Attack Riders (on hit)', '— on hit', 'Attack Riders (on miss)'],
    ['melee_attack_miss rider also counts as miss', { name: 'Retaliatory Rider', actionType: 'attack_rider', trigger: 'melee_attack_miss' },
      { hit: false, weaponType: 'melee', targetName: 'TestChar' }, 'Attack Riders (on miss)', '— on miss', 'Attack Riders (on hit)'],
  ])('labels a %s offer group with its own trigger header and hint', (_label, rider, attackContext, header, hint, absentHeader) => {
    renderModal({
      allManeuvers: [],
      knownManeuvers: [rider.name],
      availableManeuvers: [rider],
      selectionMode: false,
      attackContext,
    });
    expect(headingsInDomOrder()).toEqual([header]);
    expect(screen.queryByText(absentHeader)).not.toBeInTheDocument();
    expect(screen.getByText(hint)).toBeInTheDocument();
    expect(namesInDomOrder()).toEqual([rider.name]);
  });

  it('labels a mixed-trigger group plain "Attack Riders" while each row keeps its own hint', () => {
    renderModal({
      allManeuvers: [],
      knownManeuvers: ['Precision Attack', 'Trip Attack'],
      availableManeuvers: [
        { name: 'Precision Attack', actionType: 'attack_rider', trigger: 'attack_roll_miss' },
        { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
      ],
      selectionMode: false,
      attackContext: { hit: false, weaponType: 'melee', attackerName: 'TestChar' },
    });
    // Group heading is neutral even in the miss modal; hints reflect each OWN trigger
    // (the MN-014 bug: Precision Attack shown as "on hit").
    expect(headingsInDomOrder()).toEqual(['Attack Riders']);
    expect(screen.getByText('— on miss')).toBeInTheDocument();
    expect(screen.getByText('— on hit')).toBeInTheDocument();
    expect(namesInDomOrder()).toEqual(['Precision Attack', 'Trip Attack']);
  });
});

// ── Prompt-mode trigger filtering ──

// One shared fixture exercises the whole TRIGGER_PREDICATES table; every row pins the
// EXACT ordered radio list, so each row also proves the other triggers' exclusions.
const TRIGGER_FIXTURE = [
  { name: 'Melee Hit Rider', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
  { name: 'Wild Strike', actionType: 'attack_rider', trigger: 'weapon_attack_hit' },
  { name: 'Miss Rider', actionType: 'attack_rider', trigger: 'attack_roll_miss' },
  { name: 'Replace Rider', actionType: 'attack_rider', trigger: 'replace_attack' },
  { name: 'Any Bonus', actionType: 'bonus_action', trigger: 'any' },
  { name: 'Free Bonus', actionType: 'bonus_action', trigger: null },
  { name: 'Flanker', actionType: 'bonus_action', trigger: 'melee_attack_straight_line' },
  { name: 'Melee Miss Guard', actionType: 'reaction', trigger: 'melee_attack_miss' },
  { name: 'Melee Damage Guard', actionType: 'reaction', trigger: 'melee_damage_taken' },
];
const KNOWN_ALL = TRIGGER_FIXTURE.map(m => m.name);

describe('CombatSuperiorityModal - prompt-mode trigger filtering', () => {
  it.each([
    ['attackContext, selection mode', { attackContext: { hit: true, weaponType: 'melee', attackerName: 'TestChar' } }, true, CHOOSE_HEADER, SELECT_HEADER],
    ['attackContext, use mode', { attackContext: { hit: true, weaponType: 'melee', attackerName: 'TestChar' } }, false, USE_HEADER, CHOOSE_HEADER],
    ['skillContext, selection mode', { skillContext: { skill: 'Athletics' } }, true, CHOOSE_HEADER, SELECT_HEADER],
    ['skillContext, use mode', { skillContext: { skill: 'Athletics' } }, false, USE_HEADER, CHOOSE_HEADER],
  ])('%s renders the prompt header and not its sibling', (_label, contextPayload, selectionMode, header, absentHeader) => {
    renderModal({
      selectionMode,
      knownManeuvers: selectionMode ? [] : ['Ki-Fueled Attack'],
      playerStats: PLAYER_STATS,
      ...contextPayload,
    });
    expect(screen.getByText(header)).toBeInTheDocument();
    expect(screen.queryByText(absentHeader)).not.toBeInTheDocument();
  });

  it.each([
    ['melee hit — hit riders, passthrough, straight-line', { hit: true, weaponType: 'melee', attackerName: 'TestChar' },
      ['Melee Hit Rider', 'Wild Strike', 'Any Bonus', 'Free Bonus', 'Flanker']],
    ['ranged hit — weapon_attack_hit only, melee riders and Flanker drop', { hit: true, weaponType: 'ranged', attackerName: 'TestChar' },
      ['Wild Strike', 'Any Bonus', 'Free Bonus']],
    ['unarmed strike counts as melee for hit riders and Flanker', { hit: true, isUnarmedStrike: true, attackerName: 'TestChar' },
      ['Melee Hit Rider', 'Wild Strike', 'Any Bonus', 'Free Bonus', 'Flanker']],
    ['miss — only the miss rider plus passthrough', { hit: false, attackerName: 'TestChar' },
      ['Miss Rider', 'Any Bonus', 'Free Bonus']],
    ['defender melee miss — both target-scoped guards', { hit: false, weaponType: 'melee', targetName: 'TestChar' },
      ['Any Bonus', 'Free Bonus', 'Melee Miss Guard', 'Melee Damage Guard']],
    ['defender unarmed, no hit flag — melee_damage_taken survives, melee_attack_miss needs hit:false', { weaponType: null, isUnarmedStrike: true, targetName: 'TestChar' },
      ['Any Bonus', 'Free Bonus', 'Melee Damage Guard']],
    ['straight-line — Flanker only, hit predicates fail on undefined hit', { weaponType: 'melee', attackerName: 'TestChar' },
      ['Any Bonus', 'Free Bonus', 'Flanker']],
    ['replace_attack fires only on explicit replacingAttack', { replacingAttack: true, attackerName: 'TestChar' },
      ['Replace Rider', 'Any Bonus', 'Free Bonus']],
    ['attacker identity mismatch — attacker-scoped triggers all drop', { hit: true, weaponType: 'melee', attackerName: 'OtherChar' },
      ['Any Bonus', 'Free Bonus']],
    ['target identity mismatch — target-scoped guards both drop', { weaponType: 'melee', targetName: 'OtherChar' },
      ['Any Bonus', 'Free Bonus']],
  ])('filters by predicate table (%s)', (_label, attackContext, expectedNames) => {
    renderModal({
      allManeuvers: TRIGGER_FIXTURE,
      knownManeuvers: KNOWN_ALL,
      selectionMode: false,
      attackContext,
      playerStats: PLAYER_STATS,
    });
    expect(namesInDomOrder()).toEqual(expectedNames);
  });

  it('shows the empty notice when the prompt filter excludes every known maneuver', () => {
    renderModal({
      allManeuvers: [{ name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' }],
      knownManeuvers: ['Trip Attack'],
      selectionMode: false,
      attackContext: { hit: true, weaponType: 'ranged', attackerName: 'TestChar' },
      playerStats: PLAYER_STATS,
    });
    expect(screen.getByText(EMPTY_NOTICE)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(1);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});

// ── lastAttack fallback ──
// The lastAttack branch of computeManeuverList runs ONLY in prompt mode with a null
// attackContext, so every case here rides the skillContext-driven prompt lane (a
// non-prompt render filter-blindly keeps all known maneuvers and ignores lastAttack).
// Trigger carriers live in rendered groups (shouldShowUseGroup hides attack_rider and
// skill_check groups in use mode) or their exclusion would be vacuous.

describe('CombatSuperiorityModal - lastAttack fallback', () => {
  it('constructs effectiveAttack from lastAttack when attackContext is null', () => {
    renderModal({
      allManeuvers: [
        { name: 'Trip Attack', actionType: 'bonus_action', trigger: 'melee_weapon_attack_hit' },
        { name: 'Miss Rider', actionType: 'bonus_action', trigger: 'attack_roll_miss' },
      ],
      knownManeuvers: ['Trip Attack', 'Miss Rider'],
      selectionMode: false,
      attackContext: null,
      lastAttack: { hit: true, weaponType: 'melee', attackerName: 'TestChar' },
      playerStats: PLAYER_STATS,
      skillContext: { skill: 'Athletics' },
    });
    // Reconstructed ctx carries hit:true + melee — miss trigger stays filtered out.
    expect(namesInDomOrder()).toEqual(['Trip Attack']);
  });

  it('defaults missing lastAttack fields so every defaulted value fails its predicate', () => {
    // weaponType→null kills the melee hit predicate, replacingAttack→false kills
    // replace_attack; a defaulted null attackerName would drop the explicit-name
    // rider below, so lastAttack supplies the matching name.
    renderModal({
      allManeuvers: [
        { name: 'Any Trigger Maneuver', actionType: 'bonus_action', trigger: 'any' },
        { name: 'Melee Hit Maneuver', actionType: 'bonus_action', trigger: 'melee_weapon_attack_hit' },
        { name: 'Replace Attack Maneuver', actionType: 'bonus_action', trigger: 'replace_attack' },
      ],
      knownManeuvers: ['Any Trigger Maneuver', 'Melee Hit Maneuver', 'Replace Attack Maneuver'],
      selectionMode: false,
      attackContext: null,
      lastAttack: { hit: true, attackerName: 'TestChar' },
      playerStats: PLAYER_STATS,
      skillContext: { skill: 'Athletics' },
    });
    expect(namesInDomOrder()).toEqual(['Any Trigger Maneuver']);
  });

  it('prefers attackContext over lastAttack when both are present', () => {
    renderModal({
      allManeuvers: [
        { name: 'Melee Maneuver', actionType: 'bonus_action', trigger: 'melee_weapon_attack_hit' },
        { name: 'Ranged Maneuver', actionType: 'bonus_action', trigger: 'attack_roll_miss' },
      ],
      knownManeuvers: ['Melee Maneuver', 'Ranged Maneuver'],
      selectionMode: false,
      attackContext: { hit: true, weaponType: 'melee', attackerName: 'TestChar' },
      lastAttack: { hit: true, weaponType: 'ranged', attackerName: 'TestChar' },
      playerStats: PLAYER_STATS,
    });
    // From attackContext (ranged would win under lastAttack): miss trigger fails.
    expect(namesInDomOrder()).toEqual(['Melee Maneuver']);
  });

  const fallbackManeuvers = [
    { name: 'Melee Hit Maneuver', actionType: 'bonus_action', trigger: 'melee_weapon_attack_hit' },
    { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
  ];

  it.each([
    ['null — trigger-blind known filter keeps both', null, undefined, ['Melee Hit Maneuver', 'Ki-Fueled Attack']],
    ['empty object — defaulted null attacker fails every trigger', {}, undefined, ['Ki-Fueled Attack']],
    ['partial object — defaulted weaponType:null fails the melee hit predicate', { attackerName: 'TestChar' }, PLAYER_STATS, ['Ki-Fueled Attack']],
  ])('falls back to knownManeuvers filtering when lastAttack is %s', (_label, lastAttack, pStats, expectedNames) => {
    renderModal({
      allManeuvers: fallbackManeuvers,
      knownManeuvers: ['Melee Hit Maneuver', 'Ki-Fueled Attack'],
      selectionMode: false,
      attackContext: null,
      lastAttack,
      playerStats: pStats,
      skillContext: { skill: 'Athletics' },
    });
    expect(namesInDomOrder()).toEqual(expectedNames);
  });
});

// ── onReopenSelection callback ──

describe('CombatSuperiorityModal - onReopenSelection', () => {
  it('invokes onReopenSelection with no args, keeping the Use list open without confirming or closing', async () => {
    const onReopenSelection = vi.fn().mockResolvedValue(undefined);
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    renderModal({ knownManeuvers: ['Ki-Fueled Attack'], selectionMode: false }, { onReopenSelection, onConfirm, onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Manage Maneuvers' }));
    await vi.waitFor(() => expect(onReopenSelection).toHaveBeenCalledWith());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: /Ki-Fueled Attack/ })).toBeInTheDocument();
  });

  it('falls back to onConfirm with the untouched seed array (same identity) when onReopenSelection is absent', () => {
    const known = ['Ki-Fueled Attack', 'Pushing Attack'];
    const onConfirm = vi.fn();
    renderModal({
      knownManeuvers: known,
      selectionMode: false,
    }, { onConfirm, onClose: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: 'Manage Maneuvers' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(known, null);
    expect(onConfirm.mock.calls[0][0]).toBe(known);
  });

  it('logs the exact error and holds the Use list open when onReopenSelection rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);
    const err = new Error('fail');
    const onReopenSelection = vi.fn().mockRejectedValue(err);
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    renderModal({ knownManeuvers: ['Ki-Fueled Attack'], selectionMode: false }, { onReopenSelection, onConfirm, onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Manage Maneuvers' }));
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('[CombatSuperiorityModal] Reopen selection failed:', err);
    });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: /Ki-Fueled Attack/ })).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});

// ── handleUseManeuver reject half ──

describe('CombatSuperiorityModal - handleUseManeuver error', () => {
  it('logs the exact error, keeps the radio selection armed, and never swaps in the result view', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);
    const err = new Error('use failed');
    const onConfirm = vi.fn().mockRejectedValue(err);
    const onClose = vi.fn();
    renderModal({ knownManeuvers: ['Ki-Fueled Attack'], selectionMode: false }, { onConfirm, onClose });
    fireEvent.click(screen.getByRole('radio', { name: /Ki-Fueled Attack/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Use Maneuver' }));
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('[CombatSuperiorityModal] Use maneuver failed:', err);
    });
    expect(onConfirm).toHaveBeenCalledWith(null, 'Ki-Fueled Attack');
    expect(onClose).not.toHaveBeenCalled();
    // applied state never set: UseView survives with the selection intact, no Done.
    expect(screen.getByRole('radio', { name: /Ki-Fueled Attack/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Use Maneuver' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});

// ── Maneuver description rendering ──

describe('CombatSuperiorityModal - maneuver descriptions', () => {
  it.each([
    ['selection mode', true],
    ['use mode', false],
  ])('renders the maneuver description verbatim under its name in %s', (_label, selectionMode) => {
    // bonus_action renders in both views (shouldShowUseGroup hides attack_rider and
    // skill_check groups in non-prompt use mode).
    renderModal({
      allManeuvers: [{ name: 'Trip Attack', actionType: 'bonus_action', description: 'Prone the target.' }],
      knownManeuvers: selectionMode ? [] : ['Trip Attack'],
      selectionMode,
    });
    expect(screen.getByText('Trip Attack')).toBeInTheDocument();
    expect(screen.getByText('Prone the target.')).toBeInTheDocument();
    expect(screen.getByRole(selectionMode ? 'checkbox' : 'radio', { name: /Trip Attack/ })).toBeInTheDocument();
  });
});
