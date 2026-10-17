// CombatSuperiorityModal — RUNTIME-SEAM lane. Owns the getRuntimeValue read seam:
// every superiority-dice resolution path in computeHasSuperiorityDice and the view
// gating (or lack of it) that value feeds. Reads only — the component never writes
// the runtime store (the onConfirm prop is the write channel; its tuples are owned
// by mn003/edge-cases), pinned by the never-writes assertion below.
//
// Ownership map (siblings own the rest — do NOT re-test here):
// .test.jsx ........... selection/use happy paths, toggling & confirm/clear/cancel at
//                       maxOptions 3/5, Select/Use headers without context, "no maneuvers
//                       selected" prefix notice, onClose via Cancel, prompt filtering happy path.
// .runtime.test.jsx ... THIS FILE — exact runtime read (args, count, no writes), channel
//                       precedence vs _trackedResources, falsy/NaN gating, tracker shape
//                       guards, anonymous-playerStats short-circuit, selectionMode never
//                       gated, no-dice notice + Close, live-store rerender semantics.
// .triggers.test.jsx .. trigger predicates, MN-014 labels/hints, availableManeuvers
//                       override, prompt headers WITH contexts, lastAttack fallback,
//                       onReopenSelection invoke/fallback/reject, use-reject half.
// .edge-cases ......... payload null/undefined, overlay containment, maxOptions edges,
//                       group order, description omission, duplicates, intersection
//                       cardinality, applied-result swap (truthy resolve), same-reference
//                       confirm tuple in selection mode.
// .mn003UseMode ....... use-mode reachability, Grant Attack single-use tuple, null-resolve half.
//
// Trimmed from this file (ownership now noted above):
//  - standalone positive getRuntimeValue / _trackedResources-fallback one-offs → folded
//    into the precedence and fallback tables below (the '3' numeric-string row subsumes
//    the plain positive case, and pins Number() coercion at the seam as a bonus).
//  - selectionMode null-dice row → gating in selection mode is value-independent; null's
//    fall-through semantics are pinned by the fallback table, so one 0-dice row remains.
//
// Conventions: fresh vi.fn per makeProps call; hoisted module mock with
// afterEach mockReset().mockReturnValue() (not clearAllMocks) so impls never leak
// (mn003 lane fix adopted); findBy/role-scoped queries; exact pinned strings — no
// fixture-echo regexes; live mutable store for the rerender case; no setTimeout;
// no style-attribute selectors.

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import CombatSuperiorityModal from './CombatSuperiorityModal.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

afterEach(() => {
  vi.mocked(getRuntimeValue).mockReset().mockReturnValue(3);
  vi.mocked(setRuntimeValue).mockReset();
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

// Pinned copies of the component's exact gating sentences.
const USE_PROMPT = 'Choose a maneuver to use:';
const NO_DICE = 'No Superiority Dice remaining. Recharges on a Short or Long Rest.';

// Default props sit on the dice-available use-mode seam; each table overrides the
// dice value / playerStats it is pinning.
function makeProps(payloadOverrides = {}, propsOverrides = {}) {
  return {
    payload: {
      allManeuvers: BASE_MANEUVERS,
      maxOptions: 3,
      selectionMode: false,
      knownManeuvers: ['Ki-Fueled Attack'],
      playerStats: { name: 'TestCharacter' },
      ...payloadOverrides,
    },
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...propsOverrides,
  };
}

function renderModal(payloadOverrides = {}, propsOverrides = {}) {
  return render(<CombatSuperiorityModal {...makeProps(payloadOverrides, propsOverrides)} />);
}

// ── The exact runtime read ──

describe('CombatSuperiorityModal - runtime seam read contract', () => {
  it('reads superiorityDice once per render with exact args and never writes the store', () => {
    renderModal();
    expect(getRuntimeValue).toHaveBeenCalledTimes(1);
    expect(getRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'superiorityDice');
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(screen.getByText(USE_PROMPT)).toBeInTheDocument();
    expect(screen.queryByText(NO_DICE)).not.toBeInTheDocument();
  });

  it('re-reads the live store on every render — draining the last die swaps in the no-dice notice without remount', () => {
    const store = { TestCharacter: { superiorityDice: 1 } };
    vi.mocked(getRuntimeValue).mockImplementation((name, key) => store[name]?.[key]);
    const props = makeProps();
    const { rerender } = render(<CombatSuperiorityModal {...props} />);
    expect(screen.getByText(USE_PROMPT)).toBeInTheDocument();
    expect(getRuntimeValue).toHaveBeenCalledTimes(1);

    store.TestCharacter.superiorityDice = 0;
    rerender(<CombatSuperiorityModal {...props} />);
    expect(getRuntimeValue).toHaveBeenCalledTimes(2);
    expect(getRuntimeValue).toHaveBeenLastCalledWith('TestCharacter', 'superiorityDice');
    expect(screen.getByText(NO_DICE)).toBeInTheDocument();
    expect(screen.queryByText(USE_PROMPT)).not.toBeInTheDocument();
  });
});

// ── Channel precedence: a non-null runtime value beats _trackedResources ──

describe('CombatSuperiorityModal - runtime value takes precedence over _trackedResources', () => {
  // Tracker holds 7 dice in every row: any no-dice outcome proves the tracker was
  // shadowed by the runtime value (and any use view with a non-numeric-looking value
  // proves Number() coercion happened at the seam, not string truthiness).
  it.each([
    ['positive number 3', 3, true],
    ['numeric string "2"', '2', true],
    ['zero', 0, false],
    ['negative -2', -2, false],
    ['non-numeric string (NaN)', 'two', false],
  ])('resolves dice from the runtime value when it is %s', (_label, dice, hasDice) => {
    vi.mocked(getRuntimeValue).mockReturnValue(dice);
    renderModal({
      playerStats: { name: 'TestCharacter', _trackedResources: { superiorityDice: { current: 7 } } },
    });
    if (hasDice) {
      expect(screen.getByText(USE_PROMPT)).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Ki-Fueled Attack/ })).toBeInTheDocument();
    } else {
      expect(screen.getByText(NO_DICE)).toBeInTheDocument();
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    }
  });
});

// ── Fallback channel: null/undefined consults _trackedResources ──

describe('CombatSuperiorityModal - _trackedResources fallback channel', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('falls through to the tracker when the runtime value is %s', (_label, dice) => {
    vi.mocked(getRuntimeValue).mockReturnValue(dice);
    renderModal({
      playerStats: { name: 'TestCharacter', _trackedResources: { superiorityDice: { current: 2 } } },
    });
    expect(screen.getByText(USE_PROMPT)).toBeInTheDocument();
    expect(screen.queryByText(NO_DICE)).not.toBeInTheDocument();
  });

  it.each([
    ['current 0', { superiorityDice: { current: 0 } }],
    ['current negative', { superiorityDice: { current: -5 } }],
    ['missing tracker', undefined],
    ['empty tracker', {}],
    ['null superiorityDice', { superiorityDice: null }],
    ['no current field', { superiorityDice: {} }],
  ])('gates the no-dice notice when the fallback tracker is %s', (_label, trackedResources) => {
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    renderModal({
      playerStats: { name: 'TestCharacter', _trackedResources: trackedResources },
    });
    expect(screen.getByText(NO_DICE)).toBeInTheDocument();
    expect(getRuntimeValue).toHaveBeenCalledTimes(1);
  });
});

// ── Anonymous playerStats short-circuit the store entirely ──

describe('CombatSuperiorityModal - anonymous playerStats never touch the store', () => {
  it.each([
    ['playerStats missing', undefined],
    ['name missing', {}],
    ['name null', { name: null }],
    ['name empty string', { name: '' }],
  ])('passes the dice gate without any runtime read when %s', (_label, playerStats) => {
    renderModal({ playerStats });
    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(screen.getByText(USE_PROMPT)).toBeInTheDocument();
    expect(screen.queryByText(NO_DICE)).not.toBeInTheDocument();
  });
});

// ── selectionMode is never gated by dice ──

describe('CombatSuperiorityModal - selectionMode bypasses dice gating', () => {
  it('renders the Select view unblocked at zero dice — the read happens but never gates', () => {
    vi.mocked(getRuntimeValue).mockReturnValue(0);
    renderModal({
      selectionMode: true,
      playerStats: { name: 'TestCharacter', _trackedResources: { superiorityDice: { current: 0 } } },
    });
    expect(screen.getByText('Combat Superiority — Select Maneuvers')).toBeInTheDocument();
    expect(screen.queryByText(NO_DICE)).not.toBeInTheDocument();
    // Seam still observed: selection mode reads the store, it is just never gated by it.
    expect(getRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'superiorityDice');
    expect(screen.getByRole('checkbox', { name: 'Trip Attack' })).toBeEnabled();
  });
});

// ── No-dice notice Close button ──

describe('CombatSuperiorityModal - no-dice notice Close', () => {
  it('Close is the only control in the no-dice notice and fires onClose exactly once', () => {
    const onClose = vi.fn();
    vi.mocked(getRuntimeValue).mockReturnValue(0);
    renderModal({}, { onClose });
    expect(screen.getByText(NO_DICE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Use Maneuver/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Manage Maneuvers/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
