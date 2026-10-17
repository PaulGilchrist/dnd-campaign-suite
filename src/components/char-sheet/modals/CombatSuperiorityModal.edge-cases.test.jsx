// CombatSuperiorityModal — EDGE-CASE lane. Renders only; no runtime-store writes.
//
// Ownership map (siblings own the rest — do NOT re-test here):
// .test.jsx ........... selection/use happy paths, toggling & confirm/clear/cancel at
//                       maxOptions 3/5, Select-header & Use-header without context,
//                       "no maneuvers selected" prefix notice, onClose via Cancel.
// .runtime.test.jsx ... superiority-dice resolution (getRuntimeValue / _trackedResources
//                       fallback / missing playerStats), no-dice notice + its Close button.
// .triggers.test.jsx .. trigger predicates, MN-014 group labels & hints, availableManeuvers
//                       override, prompt headers WITH attackContext (both modes), skillContext
//                       equivalence, lastAttack fallback, onReopenSelection invoke/fallback/
//                       reject, handleUseManeuver reject, descriptions present (both modes).
// .mn003UseMode ....... use-mode reachability, Grant Attack single-use confirm.
//
// This lane owns edge cases only:
//  - null/undefined payload renders nothing
//  - overlay containment (clicks on background/content never dismiss)
//  - maxOptions 0 and 1; seeded selection ABOVE maxOptions (over-cap guard dance)
//  - exact action-type group ORDER (siblings check membership only)
//  - description OMISSION branch (missing / empty-string) in both views
//  - duplicate maneuver names share one selection; confirm sends the name once
//  - known ∩ allManeuvers intersection cardinality in use mode
//  - applied-result-view transition after a RESOLVED use (the success half of the state
//    machine — triggers covers only the reject half "no Done"; mn003 resolves null)
//
// Trimmed from this file (ownership now noted above):
//  - prompt-mode header variants → triggers.test.jsx (Choose/Use w/ attackContext) +
//    test.jsx (Select/Use w/o context) — every variant there, deleted here.
//  - use-maneuver reject & onReopenSelection reject → triggers.test.jsx (identical
//    scenarios with stricter objectContaining message match; old reopen test also had a
//    never-awaited waitFor). Deleted.
//  - "missing prop" null-payload row → same code path as payload=undefined, merged.
//  - "no maneuvers empty state" variant 1 → folded into the it.each below as the
//    empty-knownManeuvers row (test.jsx owns the prefix match; this lane pins the
//    FULL sentence — new exactness).
//
// Conventions: fresh vi.fn per makeProps call; afterEach restoreAllMocks (not
// clearAllMocks) so spy impls never leak; findBy idiom for the async applied screen;
// role-scoped queries; same-object identity on the pass-through seed array.
// FLAGGED (component, not fixed): inline styles throughout SpOverlay/SelectionGroupCheckbox/
// ManeuverRadioItem/SelectionView/UseView violate the no-inline-styles convention — tests
// deliberately avoid style-attribute selectors so the migration to CSS classes stays cheap.

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import CombatSuperiorityModal from './CombatSuperiorityModal.jsx';

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

// BASE_MANEUVERS as they appear in the DOM (ACTION_TYPE_ORDER grouping order).
const NAMES_IN_DOM_ORDER = [
  'Trip Attack', 'Disarming Attack', // Attack Riders (on hit — no miss triggers)
  'Ki-Fueled Attack',                // Bonus Actions
  'Evasive Footwork',                // Reactions
  'Kicking Attack',                  // Skill Checks
  'Pushing Attack', 'Rally',         // Movement
  'Grasping Vine',                   // Grant Attack
];

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

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Null/undefined payload ──

describe('CombatSuperiorityModal - null/undefined payload', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('renders nothing when payload is %s', (_label, payloadValue) => {
    render(
      <CombatSuperiorityModal
        payload={payloadValue}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(document.body.textContent).toBe('');
  });
});

// ── Overlay containment ──

describe('CombatSuperiorityModal - overlay clicks never dismiss', () => {
  it('clicking the overlay background or modal content does not close; inner clicks apply', () => {
    const onClose = vi.fn();
    renderModal({ selectionMode: true }, { onClose });
    const overlay = document.querySelector('.sp-overlay');
    const modal = document.querySelector('.sp-modal');
    expect(overlay).toBeTruthy();
    expect(modal).toBeTruthy();

    fireEvent.click(modal);
    fireEvent.click(overlay);
    expect(onClose).not.toHaveBeenCalled();

    // Interaction inside the modal applies normally and still does not dismiss
    // (Cancel is the only dismissal control in this view — see .test.jsx).
    fireEvent.click(screen.getByRole('checkbox', { name: 'Trip Attack' }));
    expect(screen.getByRole('checkbox', { name: 'Trip Attack' })).toBeChecked();
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ── maxOptions = 0 ──

describe('CombatSuperiorityModal - maxOptions zero', () => {
  it('disables every maneuver checkbox and blocks confirm when maxOptions is 0', () => {
    renderModal({ selectionMode: true, maxOptions: 0 });
    NAMES_IN_DOM_ORDER.forEach(name => {
      const cb = screen.getByRole('checkbox', { name });
      expect(cb).toBeDisabled();
      expect(cb).not.toBeChecked();
    });
    expect(screen.getByText('0/0 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Selection/ })).toBeDisabled();
  });
});

// ── maxOptions = 1 ──

describe('CombatSuperiorityModal - maxOptions one', () => {
  it('allows selecting exactly one, disables all others, and re-enables on deselect', () => {
    renderModal({ selectionMode: true, maxOptions: 1 });
    const trip = screen.getByRole('checkbox', { name: 'Trip Attack' });

    fireEvent.click(trip);
    expect(trip).toBeChecked();
    expect(trip).not.toBeDisabled();
    expect(screen.getByText('1/1 selected')).toBeInTheDocument();
    NAMES_IN_DOM_ORDER.filter(n => n !== 'Trip Attack').forEach(name => {
      expect(screen.getByRole('checkbox', { name })).toBeDisabled();
    });

    // The selected one stays toggleable off; everything re-enables below cap.
    fireEvent.click(trip);
    expect(trip).not.toBeChecked();
    expect(screen.getByText('0/1 selected')).toBeInTheDocument();
    NAMES_IN_DOM_ORDER.forEach(name => {
      expect(screen.getByRole('checkbox', { name })).not.toBeDisabled();
    });
  });
});

// ── Action type ordering (siblings assert membership, never order) ──

describe('CombatSuperiorityModal - action type ordering', () => {
  it('renders action-type group headings in ACTION_TYPE_ORDER exactly', () => {
    renderModal({ selectionMode: true });
    const headings = screen.getAllByRole('heading', { level: 4 }).map(h => h.textContent);
    expect(headings).toEqual([
      'Attack Riders (on hit)',
      'Bonus Actions',
      'Reactions',
      'Skill Checks',
      'Movement',
      'Grant Attack',
    ]);
  });
});

// ── Description omission branch (triggers covers presence, not omission) ──

describe('CombatSuperiorityModal - description omission branch', () => {
  const DESC = 'Prone the target.';

  it.each([
    ['selection mode', { selectionMode: true }],
    ['use mode', { selectionMode: false, knownManeuvers: ['Trip Attack', 'Silent Maneuver', 'Blank Maneuver'] }],
  ])('renders a description block only for non-empty descriptions — %s', (_label, modePayload) => {
    renderModal({
      allManeuvers: [
        { name: 'Trip Attack', actionType: 'bonus_action', description: DESC },
        { name: 'Silent Maneuver', actionType: 'movement' },
        { name: 'Blank Maneuver', actionType: 'reaction', description: '' },
      ],
      ...modePayload,
    });
    // Item structure in both views: <label>[input, flexDiv[name div (+ desc div)]].
    const itemBody = name => screen.getByText(name).closest('label').lastElementChild;
    const withDesc = itemBody('Trip Attack');
    expect(withDesc).toHaveTextContent(DESC);
    expect(withDesc.children).toHaveLength(2);
    expect(itemBody('Silent Maneuver').children).toHaveLength(1);
    expect(itemBody('Blank Maneuver').children).toHaveLength(1);
  });
});

// ── knownManeuvers pre-selected in selection state ──

describe('CombatSuperiorityModal - knownManeuvers pre-selected', () => {
  const PRE_ALL = [
    { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
    { name: 'Pushing Attack', actionType: 'movement' },
    { name: 'Evasive Footwork', actionType: 'reaction' },
  ];
  const PRE_KNOWN = ['Ki-Fueled Attack', 'Pushing Attack'];

  it('seeds checkboxes from knownManeuvers and allows toggling them off', () => {
    renderModal({ selectionMode: true, allManeuvers: PRE_ALL, knownManeuvers: PRE_KNOWN });
    expect(screen.getByRole('checkbox', { name: 'Ki-Fueled Attack' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Pushing Attack' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Evasive Footwork' })).not.toBeChecked();
    expect(screen.getByText('2/3 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Ki-Fueled Attack' }));
    expect(screen.getByRole('checkbox', { name: 'Ki-Fueled Attack' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Pushing Attack' })).toBeChecked();
    expect(screen.getByText('1/3 selected')).toBeInTheDocument();
  });

  it('confirm submits the untouched seeded selection (same array reference)', () => {
    const onConfirm = vi.fn();
    renderModal(
      { selectionMode: true, allManeuvers: PRE_ALL, knownManeuvers: PRE_KNOWN },
      { onConfirm },
    );
    fireEvent.click(screen.getByRole('button', { name: /Confirm Selection/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(PRE_KNOWN, null);
    // Seed array flows through untouched — no copy, no reorder.
    expect(onConfirm.mock.calls[0][0]).toBe(PRE_KNOWN);
  });

  it('guards an over-cap seeded selection: deselect always, re-add only below cap', () => {
    renderModal({
      selectionMode: true,
      maxOptions: 2,
      allManeuvers: [
        { name: 'A', actionType: 'bonus_action' },
        { name: 'B', actionType: 'movement' },
        { name: 'C', actionType: 'reaction' },
        { name: 'D', actionType: 'skill_check' },
      ],
      knownManeuvers: ['A', 'B', 'C', 'D'],
    });
    // Seeded above cap: counter shows the truth, confirm stays enabled (no clamp).
    expect(screen.getByText('4/2 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Selection/ })).toBeEnabled();

    // Deselect C — unselected at/over cap means it cannot be re-added yet.
    fireEvent.click(screen.getByRole('checkbox', { name: 'C' }));
    expect(screen.getByRole('checkbox', { name: 'C' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'C' })).toBeDisabled();
    expect(screen.getByText('3/2 selected')).toBeInTheDocument();

    // Deselecting remains possible at or above cap (selected rows are never blocked).
    fireEvent.click(screen.getByRole('checkbox', { name: 'D' }));
    expect(screen.getByText('2/2 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'A' }));
    expect(screen.getByText('1/2 selected')).toBeInTheDocument();

    // Below cap, C re-enables and can be re-added; unselected rows re-enable too.
    expect(screen.getByRole('checkbox', { name: 'C' })).toBeEnabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'C' }));
    expect(screen.getByRole('checkbox', { name: 'C' })).toBeChecked();
    expect(screen.getByText('2/2 selected')).toBeInTheDocument();

    // Back at cap: selected rows (B, C) stay enabled, unselected rows (A, D) are blocked.
    expect(screen.getByRole('checkbox', { name: 'C' })).not.toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'B' })).not.toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'A' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'D' })).toBeDisabled();
  });
});

// ── Duplicate maneuver names ──

describe('CombatSuperiorityModal - duplicate maneuver names', () => {
  it('shares one selection across duplicate names; confirm sends the name once', () => {
    const onConfirm = vi.fn();
    renderModal(
      {
        selectionMode: true,
        allManeuvers: [
          { name: 'Same Name', actionType: 'bonus_action' },
          { name: 'Same Name', actionType: 'movement' },
        ],
      },
      { onConfirm },
    );
    const dups = screen.getAllByRole('checkbox', { name: 'Same Name' });
    expect(dups).toHaveLength(2);

    fireEvent.click(dups[0]);
    // Selection is keyed by NAME — both duplicate rows reflect the single selection.
    expect(dups[0]).toBeChecked();
    expect(dups[1]).toBeChecked();
    expect(screen.getByText('1/3 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Confirm Selection/ }));
    expect(onConfirm).toHaveBeenCalledWith(['Same Name'], null);

    // Toggling off via the other row deselects both.
    fireEvent.click(dups[1]);
    expect(dups[0]).not.toBeChecked();
    expect(dups[1]).not.toBeChecked();
    expect(screen.getByText('0/3 selected')).toBeInTheDocument();
  });
});

// ── No-maneuvers empty state (use mode) ──

describe('CombatSuperiorityModal - no maneuvers empty state', () => {
  it.each([
    ['knownManeuvers is empty', []],
    ['knownManeuvers match nothing in allManeuvers', ['Nonexistent Maneuver']],
  ])('shows the full select-first notice when %s', (_label, knownManeuvers) => {
    const onClose = vi.fn();
    renderModal({ selectionMode: false, knownManeuvers }, { onClose });
    expect(screen.getByText('No maneuvers selected. Use Combat Superiority again to select your maneuvers.')).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Use Maneuver/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ── Known ∩ allManeuvers filtering in use mode ──

describe('CombatSuperiorityModal - known maneuver intersection in use mode', () => {
  it('shows exactly the maneuvers both known AND listed in allManeuvers', () => {
    renderModal({
      selectionMode: false,
      knownManeuvers: ['Ki-Fueled Attack', 'Unknown Maneuver'],
      allManeuvers: [
        { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
        { name: 'Known But Not Listed', actionType: 'reaction' },
      ],
    });
    expect(screen.getByRole('radio', { name: /Ki-Fueled Attack/ })).toBeInTheDocument();
    expect(screen.queryByText('Unknown Maneuver')).not.toBeInTheDocument();
    expect(screen.queryByText('Known But Not Listed')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(1);
  });
});

// ── Applied result view (success half of the use flow) ──

describe('CombatSuperiorityModal - applied result view after resolved use', () => {
  it('swaps the use list for the result view and closes via Done', async () => {
    const onClose = vi.fn();
    const result = { payload: { name: 'Ki-Fueled Attack', description: 'Take an additional bonus action move.' } };
    const onConfirm = vi.fn().mockResolvedValue(result);
    renderModal(
      { selectionMode: false, knownManeuvers: ['Ki-Fueled Attack'] },
      { onConfirm, onClose },
    );
    fireEvent.click(screen.getByRole('radio', { name: /Ki-Fueled Attack/ }));
    fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));

    const done = await screen.findByRole('button', { name: 'Done' });
    expect(screen.getByText('Ki-Fueled Attack')).toBeInTheDocument();
    expect(screen.getByText('Take an additional bonus action move.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Use Maneuver/ })).not.toBeInTheDocument();

    fireEvent.click(done);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
