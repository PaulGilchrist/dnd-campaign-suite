// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TargetWithTypePopup from './TargetWithTypePopup.jsx';

// Covers ONLY TargetWithTypePopup's own UI lane: the two-list single-select
// state machine (target ✓ and damage-type ✓ move independently within their
// lists), the two-gate confirm (target AND damage type), the 'Cast {title}'
// label default computed by this component, and the exact
// { targetName, damageType } payload. Base surface inherited from
// TargetPopupBase (Escape→onSkip, 'Spell' name fallback, subtitle, the
// 'Cancel' fallback that base re-supplies) is not pinned here — strongest
// skip pins live in MultiTargetCountPopup.test.jsx, pending a dedicated
// TargetPopupBase spec. Rows are clickable <div>s with no roles; getByText
// is honest there.

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

  it('selects one target at a time, leaves confirm gated until a damage type joins, and fires nothing on row clicks', () => {
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
    expect(screen.getByRole('button', { name: 'Nope' })).not.toBeDisabled();
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

  it('confirms once with the exact { targetName, damageType } payload', () => {
    const props = makeProps();
    render(<TargetWithTypePopup {...props} />);

    fireEvent.click(screen.getByText('Ally2'));
    fireEvent.click(screen.getByText('Fire'));
    fireEvent.click(screen.getByRole('button', { name: 'Cast' }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith({ targetName: 'Ally2', damageType: 'Fire' });
    expect(props.onSkip).not.toHaveBeenCalled();
  });

  it('Cancel button fires onSkip exactly once', () => {
    // Escape→onSkip is TargetPopupBase surface, pinned with count semantics
    // in MultiTargetCountPopup.test.jsx — not duplicated here.
    const props = makeProps();
    render(<TargetWithTypePopup {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Nope' }));
    expect(props.onSkip).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('styles via scoped classes, keeping only dynamic selection colors inline (no-inline-styles convention)', () => {
    const { container } = render(<TargetWithTypePopup {...makeProps()} />);

    // Both sections keep the shared family token styled by MetamagicPopup.css
    // (loaded via TargetPopupBase); the second section's static 16px gap is a
    // class, not an inline style.
    const sections = container.querySelectorAll('.metamagic-twin-target');
    expect(sections).toHaveLength(2);
    expect(sections[0].getAttribute('style')).toBeNull();
    expect(sections[1].classList.contains('target-with-type-section-spaced')).toBe(true);
    expect(sections[1].getAttribute('style')).toBeNull();

    // Scrollable list containers are fully class-based.
    const lists = container.querySelectorAll('.target-with-type-list');
    expect(lists).toHaveLength(2);
    for (const list of lists) expect(list.getAttribute('style')).toBeNull();

    // Option rows: static decoration lives in the class; the inline style attr
    // carries ONLY the two dynamic (isSelected-derived) declarations.
    const rows = container.querySelectorAll('.target-with-type-option');
    expect(rows).toHaveLength(creatureTargets.length + damageTypes.length);
    for (const row of rows) {
      const inline = row.getAttribute('style') || '';
      expect(inline).toMatch(/background-color/i);
      expect(inline).toMatch(/border/i);
      expect(inline).not.toMatch(/padding|margin|cursor|border-radius|max-height|overflow/i);
    }

    // Selecting a row changes only its dynamic inline values (green highlight
    // trio stays intact); statics never re-enter the attr.
    fireEvent.click(screen.getByText('Ally1'));
    const selectedStyle = screen.getByText('✓ Ally1').closest('.target-with-type-option').getAttribute('style') || '';
    expect(selectedStyle).toMatch(/rgba\(76,\s*175,\s*80,\s*0\.3\)/);
    // jsdom serializes #4CAF50 as rgb(76, 175, 80) — accept either canonical form.
    expect(selectedStyle).toMatch(/border:\s*1px solid\s+(#4caf50|rgb\(76,\s*175,\s*80\))/i);
  });
});
