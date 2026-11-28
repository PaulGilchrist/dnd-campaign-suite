// @maintained-by-ai 2026-11-28
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TargetWithTypePopup from './TargetWithTypePopup.jsx';

// Covers ONLY TargetWithTypePopup's own UI lane: the two-list single-select
// state machine (target ✓ and damage-type ✓ move independently within their
// lists), the two-gate confirm (target AND damage type), the 'Cast {title}'
// and cancelLabel pass-throughs computed by this component, and the exact
// { targetName, damageType } payload. Base surface inherited from
// TargetPopupBase (Escape→onSkip, cancel-click→onSkip, 'Spell' name
// fallback, subtitle, 'Confirm'/'Cancel' defaults) is pinned in
// TargetPopupBase.test.jsx — describe blocks "keydown guard (:10-16,
// Escape-only)" and "action buttons and content slots (:30-39)". Visual
// styling (class names, inline highlight colors) is presentation, not
// behavior: selection feedback is pinned via the ✓ marker instead.
// Rows are clickable <div>s with no roles; getByText is honest there.

// ── Fixtures (copy distinct per source for attribution) ──

const mockSpell = { name: 'Protection from Energy', level: 2 };
const creatureTargets = ['Ally1', 'Ally2', 'Ally3'];
const damageTypes = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'];

function makeProps(overrides = {}) {
  return {
    spell: mockSpell,
    creatureTargets,
    damageTypes,
    onConfirm: vi.fn(),
    onSkip: vi.fn(),
    icon: 'fa-solid fa-shield',
    title: 'Ward the Company', // distinct from spell.name for copy attribution
    school: 'Abjuration',
    defaultLevel: 2,
    description: 'Pick an ally and an energy to ward',
    confirmLabel: 'Cast',
    cancelLabel: 'Nope', // distinct from the 'Cancel' default
    ...overrides,
  };
}

describe('TargetWithTypePopup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders section labels, both lists, and button copy with confirm gated off', () => {
    const { rerender } = render(<TargetWithTypePopup {...makeProps()} />);

    expect(screen.getByRole('heading', { name: 'Ward the Company' })).toBeInTheDocument();
    expect(screen.getByText('Target:')).toBeInTheDocument();
    expect(screen.getByText('Damage Type:')).toBeInTheDocument();
    for (const name of creatureTargets) expect(screen.getByText(name)).toBeInTheDocument();
    for (const type of damageTypes) expect(screen.getByText(type)).toBeInTheDocument();
    expect(screen.queryAllByText(/✓/)).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Nope' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cast' })).toBeDisabled(); // neither leg selected

    // This popup's own fallback expression `Cast ${title}` (base would render
    // 'Confirm' if it broke, so this pin is attributable).
    rerender(<TargetWithTypePopup {...makeProps({ confirmLabel: undefined })} />);
    expect(screen.getByRole('button', { name: 'Cast Ward the Company' })).toBeInTheDocument();
  });

  it('selects one target at a time, leaving confirm gated while the damage-type leg is unmet', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    const cast = screen.getByRole('button', { name: 'Cast' });

    fireEvent.click(screen.getByText('Ally1'));
    expect(screen.getByText('✓ Ally1')).toBeInTheDocument();
    expect(screen.queryAllByText(/✓/)).toHaveLength(1); // single-target marker only
    expect(cast).toBeDisabled(); // target leg met, damage-type gate still open

    fireEvent.click(screen.getByText('Ally2'));
    expect(screen.getByText('✓ Ally2')).toBeInTheDocument();
    expect(screen.queryByText('✓ Ally1')).not.toBeInTheDocument(); // marker moved, not duplicated
    expect(screen.queryAllByText(/✓/)).toHaveLength(1);
    expect(cast).toBeDisabled();
  });

  it('selects one damage type at a time, enabling confirm only when the target leg also holds', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    const cast = screen.getByRole('button', { name: 'Cast' });

    fireEvent.click(screen.getByText('Acid'));
    expect(screen.getByText('✓ Acid')).toBeInTheDocument();
    expect(cast).toBeDisabled(); // damage-type leg met, target gate still open

    fireEvent.click(screen.getByText('Ally1'));
    expect(cast).not.toBeDisabled(); // both legs selected
    expect(screen.getByText('✓ Ally1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cold'));
    expect(screen.getByText('✓ Cold')).toBeInTheDocument();
    expect(screen.queryByText('✓ Acid')).not.toBeInTheDocument(); // type marker moved
    expect(screen.getByText('✓ Ally1')).toBeInTheDocument(); // target selection survives
    expect(screen.queryAllByText(/✓/)).toHaveLength(2); // exactly one ✓ per list
    expect(cast).not.toBeDisabled();
  });

  it('confirms once with the exact { targetName, damageType } payload, and the cancel pass-through fires onSkip without a second confirm', () => {
    const props = makeProps();
    render(<TargetWithTypePopup {...props} />);

    fireEvent.click(screen.getByText('Ally2'));
    fireEvent.click(screen.getByText('Fire'));
    fireEvent.click(screen.getByRole('button', { name: 'Cast' }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith({ targetName: 'Ally2', damageType: 'Fire' });
    expect(props.onSkip).not.toHaveBeenCalled();

    // onSkip wiring is this component's pass-through (base's click→onSkip
    // semantics are pinned in TargetPopupBase.test.jsx); the distinct
    // 'Nope' label also proves cancelLabel reaches base untouched.
    fireEvent.click(screen.getByRole('button', { name: 'Nope' }));
    expect(props.onSkip).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledTimes(1); // cancel never re-confirms
  });
});
