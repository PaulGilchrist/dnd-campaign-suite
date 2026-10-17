// CombatSuperiorityModal — BASE lane. Owns selection-mode headers/instructions, the
// initial render contract (exact group headings + role-scoped checkbox set), header
// variants per the shared ownership map, and the selection/use happy-path tuples.
//
// Ownership map (siblings own the rest — do NOT re-test here):
// .runtime.test.jsx ... superiority-dice resolution (getRuntimeValue / _trackedResources
//                       fallback / anonymous short-circuit), no-dice notice + its Close,
//                       selectionMode never gated by dice, live-store rerender semantics.
// .triggers.test.jsx .. trigger predicates & prompt filtering, availableManeuvers
//                       override, prompt headers WITH attackContext / skillContext,
//                       lastAttack fallback, onReopenSelection invoke / no-confirm /
//                       fallback-to-onConfirm / reject, use-reject half, MN-014
//                       labels/hints, descriptions present (both modes).
// .edge-cases ......... payload null/undefined, overlay containment, maxOptions 0/1 and
//                       over-cap seed dance, exact group ORDER, description omission,
//                       duplicates, known ∩ all intersection, applied-result swap (truthy
//                       resolve), seed same-reference identity.
// .mn003UseMode ....... use-mode reachability, Grant Attack single-use tuple,
//                       null-resolve half.
//
// Trimmed from this file (ownership now noted above):
//  - prompt-mode filtering happy path (old getRuntimeValue-spy describe) → triggers
//    owns trigger filtering and the Use-header-with-context; migrated this lane off
//    vi.spyOn + restoreAllMocks to the hoisted-mock + mockReset().mockReturnValue()
//    idiom per the runtime-lane recommendation (dice value semantics stay theirs).
//  - "no maneuvers selected" use-mode empty state (message / Close / no Use button) →
//    edge-cases pins the full sentence + button set; runtime covers no-dice gating.
//  - standalone Clear-button visibility show/hide pair → folded into the two selection
//    rendering cases below (unknown seed hides it, known seed shows it).
//  - use-mode radio count assertion → replaced by exact role-scoped name set.
//
// Conventions: fresh vi.fn per renderModal call; hoisted module mock with afterEach
// mockReset().mockReturnValue() (never spies on the real module, impls never leak);
// exact full-line strings over fixture-echo regexes; role-scoped queries; findBy flush
// after the async use-confirm seam; no setTimeout; no style-attribute selectors.

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import CombatSuperiorityModal from './CombatSuperiorityModal.jsx';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// Dice pin lives in the mocked module so this lane never touches the real runtime
// store; dice VALUE semantics are owned by .runtime.test.jsx.
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
}));

afterEach(() => {
  vi.mocked(getRuntimeValue).mockReset().mockReturnValue(3);
});

// ── Fixtures / pinned copy ──

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

// BASE_MANEUVERS as they appear in the DOM (ACTION_TYPE_ORDER grouping order).
const NAMES_IN_DOM_ORDER = [
  'Trip Attack', 'Disarming Attack', // Attack Riders (on hit — no miss triggers)
  'Ki-Fueled Attack',                // Bonus Actions
  'Evasive Footwork',                // Reactions
  'Kicking Attack',                  // Skill Checks
  'Pushing Attack', 'Rally',         // Movement
  'Grasping Vine',                   // Grant Attack
];

// Copies of the component's exact rendering sentences.
const SELECT_HEADER = 'Combat Superiority — Select Maneuvers';
const USE_HEADER = 'Combat Superiority — Choose Maneuver';
const USE_PROMPT = 'Choose a maneuver to use:';
const UNKNOWN_SUFFIX = '. You learn 3 at level 3, and gain more at levels 7, 10, and 15.';

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

// ── Selection mode: initial render contract ──

describe('CombatSuperiorityModal - selection mode initial render', () => {
  it.each([
    ['maxOptions 3 (default)', 3],
    ['maxOptions 5', 5],
  ])('renders the Select header, unknown-maneuver instruction, and counter at %s', (_label, maxOptions) => {
    renderModal({ selectionMode: true, maxOptions });
    expect(screen.getByText(SELECT_HEADER)).toBeInTheDocument();
    expect(screen.getByText(`Choose up to ${maxOptions} maneuvers${UNKNOWN_SUFFIX}`)).toBeInTheDocument();
    expect(screen.getByText(`0/${maxOptions} selected`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear Selection' })).not.toBeInTheDocument();
    // Fresh unknown seed: nothing checked, nothing blocked, confirm disabled.
    NAMES_IN_DOM_ORDER.forEach(name => {
      const cb = screen.getByRole('checkbox', { name });
      expect(cb).not.toBeChecked();
      expect(cb).toBeEnabled();
    });
    expect(screen.getAllByRole('checkbox')).toHaveLength(NAMES_IN_DOM_ORDER.length);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('groups maneuvers under exact action-type headings covering the full set', () => {
    renderModal({ selectionMode: true });
    expect(screen.getAllByRole('heading', { level: 4 }).map(h => h.textContent)).toEqual([
      'Attack Riders (on hit)',
      'Bonus Actions',
      'Reactions',
      'Skill Checks',
      'Movement',
      'Grant Attack',
    ]);
    NAMES_IN_DOM_ORDER.forEach(name => {
      expect(screen.getByRole('checkbox', { name })).toBeInTheDocument();
    });
  });

  it('shows the known-count instruction sentence and reveals the Clear button once maneuvers are known', () => {
    renderModal({ selectionMode: true, knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'] });
    expect(screen.getByText(/Your known maneuvers: 2\. You can know up to 3\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear Selection' })).toBeInTheDocument();
    expect(screen.getByText('2/3 selected')).toBeInTheDocument();
  });
});

// ── Primary action gate (both modes) ──

describe('CombatSuperiorityModal - primary action with no selection', () => {
  it.each([
    ['Confirm Selection', { selectionMode: true }, 'checkbox', 'Trip Attack'],
    ['Use Maneuver', { selectionMode: false, knownManeuvers: ['Ki-Fueled Attack'] }, 'radio', 'Ki-Fueled Attack'],
  ])('%s is disabled at zero selection, never invokes onConfirm, and lifts once one is picked', (_label, modePayload, role, pickName) => {
    const onConfirm = vi.fn();
    renderModal(modePayload, { onConfirm });
    const action = screen.getByRole('button', { name: _label });
    expect(action).toBeDisabled();

    fireEvent.click(action);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole(role, { name: new RegExp(pickName) }));
    expect(screen.getByRole('button', { name: _label })).toBeEnabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

// ── Selection mode: toggling and invokers ──

describe('CombatSuperiorityModal - selection behavior and invokers', () => {
  it('toggles maneuvers through the counter and blocks every unselected row at cap', () => {
    renderModal({ selectionMode: true });
    const trip = screen.getByRole('checkbox', { name: 'Trip Attack' });

    fireEvent.click(trip);
    expect(trip).toBeChecked();
    expect(screen.getByText('1/3 selected')).toBeInTheDocument();

    fireEvent.click(trip);
    expect(trip).not.toBeChecked();
    expect(screen.getByText('0/3 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Trip Attack' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Disarming Attack' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ki-Fueled Attack' }));
    expect(screen.getByText('3/3 selected')).toBeInTheDocument();
    // Exact full-set guard at cap (edge-cases owns the over-cap and 0/1 dances).
    NAMES_IN_DOM_ORDER.filter(n => !['Trip Attack', 'Disarming Attack', 'Ki-Fueled Attack'].includes(n)).forEach(name => {
      expect(screen.getByRole('checkbox', { name })).toBeDisabled();
    });

    // Deselecting a selected row at cap stays possible and re-opens the gate.
    fireEvent.click(trip);
    expect(screen.getByText('2/3 selected')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Evasive Footwork' })).toBeEnabled();
  });

  it('confirm submits the selection tuple in click order, clear re-emits it empty', () => {
    const onConfirm = vi.fn();
    renderModal({ selectionMode: true, knownManeuvers: ['Ki-Fueled Attack'] }, { onConfirm });
    const evasive = screen.getByRole('checkbox', { name: 'Evasive Footwork' });
    expect(evasive).not.toBeChecked(); // known seed pre-checks only Ki-Fueled Attack

    fireEvent.click(evasive);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(['Ki-Fueled Attack', 'Evasive Footwork'], null);

    fireEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(onConfirm).toHaveBeenLastCalledWith([], null);
  });

  it('Cancel is the only dismissal control in the Select view and fires onClose exactly once', () => {
    const onClose = vi.fn();
    renderModal({ selectionMode: true, knownManeuvers: ['Ki-Fueled Attack'] }, { onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ── Use mode ──

describe('CombatSuperiorityModal - use mode', () => {
  it('renders the use header, prompt sentence, and exactly the known maneuver radios', () => {
    renderModal({ selectionMode: false, knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'] });
    expect(screen.getByText(USE_HEADER)).toBeInTheDocument();
    expect(screen.getByText(USE_PROMPT)).toBeInTheDocument();
    expect(screen.queryByText(SELECT_HEADER)).not.toBeInTheDocument();
    // Exact radio set: known ∩ visible groups, name + hint in the accessible name.
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: /Ki-Fueled Attack/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Pushing Attack/ })).toBeInTheDocument();
  });

  it('radio selection is exclusive — clicking one unchecks the other', () => {
    renderModal({ selectionMode: false, knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'] });
    const ki = screen.getByRole('radio', { name: /Ki-Fueled Attack/ });
    const pushing = screen.getByRole('radio', { name: /Pushing Attack/ });
    expect(ki).not.toBeChecked();
    expect(pushing).not.toBeChecked();

    fireEvent.click(ki);
    expect(ki).toBeChecked();
    expect(pushing).not.toBeChecked();

    fireEvent.click(pushing);
    expect(ki).not.toBeChecked();
    expect(pushing).toBeChecked();
  });

  it('Use Maneuver invokes onConfirm(null, name) once and survives the resolve flush', async () => {
    const onConfirm = vi.fn();
    renderModal({ selectionMode: false, knownManeuvers: ['Ki-Fueled Attack'] }, { onConfirm });
    fireEvent.click(screen.getByRole('radio', { name: /Ki-Fueled Attack/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Use Maneuver' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(null, 'Ki-Fueled Attack');

    // Plain-vi.fn resolves undefined: the applied swap requires a truthy result
    // (null-pin owned by mn003, truthy swap by edge-cases), so UseView survives
    // the awaited seam with no Done button.
    await screen.findByRole('radio', { name: /Ki-Fueled Attack/ });
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });
});
