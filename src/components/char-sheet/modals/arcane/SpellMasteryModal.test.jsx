// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SpellMasteryModal from './SpellMasteryModal.jsx';

// Spell Mastery chooser modal internals: dropdown population, the two-distinct-
// spells confirm gate, and the exact write contract on onConfirm —
//   select + Confirm → onConfirm(level1, level2)
//   Clear Selection  → onConfirm(null, null)
// The Current line and Clear button are payload-gated (currentLevel1 &&
// currentLevel2), never by local dropdown state. The open-routing seam
// (automation.type 'spell_mastery' → this modal with payload) is owned by
// CharSpecialActions.modals.test.jsx and the caller onClose wiring by
// CharSpecialActions.modalOnClose.arcane.test.jsx — deliberately not re-tested here.
// NOTE: the component uses inline styles (padding/opacity/width/margin) — flagged
// here, not fixed from the test suite; move to a co-located CSS file if touched.

// ── Test fixtures ──

const level1Options = ['Fireball', 'Magic Missile', 'Shield'];
const level2Options = ['Misty Step', 'Scorching Ray', 'Invisibility'];

// Fresh per call: every test gets pristine callbacks and its own payload, and
// partial payload overrides merge over the defaults (never silently backfilled
// with `??`, so null/undefined current levels reach the component as-is).
// Callbacks are fresh vi.fn per test and the modal has no module-level write
// path, so there is nothing to mockReset in afterEach — and clearAllMocks
// would not strip mockResolvedValue impls anyway.
function makeProps(overrides = {}) {
  const { payload: overridePayload, ...overrideCallbacks } = overrides;
  return {
    payload: {
      level1Options,
      level2Options,
      currentLevel1: '',
      currentLevel2: '',
      ...overridePayload,
    },
    onConfirm: overrideCallbacks.onConfirm ?? vi.fn(),
    onClose: overrideCallbacks.onClose ?? vi.fn(),
  };
}

// ── Tests ──

describe('SpellMasteryModal', () => {
  // ── Initial render ──

  it('renders title, rules text, two labelled dropdowns populated with every option, and a disabled Confirm button with no Current line and no Clear Selection', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    expect(screen.getByTestId('spell-mastery-modal')).toBeInTheDocument();
    expect(screen.getByText('Spell Mastery')).toBeInTheDocument();
    expect(screen.getByText(/Choose a level 1 and a level 2 spell/)).toBeInTheDocument();
    expect(screen.getByText('Level 1 spell:')).toBeInTheDocument();
    expect(screen.getByText('Level 2 spell:')).toBeInTheDocument();
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear Selection' })).not.toBeInTheDocument();

    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('');
    expect([...selects[0].options].map(o => o.value)).toEqual(['', ...level1Options]);
    expect([...selects[1].options].map(o => o.value)).toEqual(['', ...level2Options]);
    selects.forEach((select) => {
      expect(select).toHaveClass('char-btn');
    });
    expect(selects[0].querySelector('option[value=""]')).toHaveTextContent('-- Select a level 1 spell --');
    expect(selects[1].querySelector('option[value=""]')).toHaveTextContent('-- Select a level 2 spell --');

    const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
    expect(confirmBtn).toHaveClass('char-btn');
    expect(confirmBtn).toBeDisabled();
  });

  // ── Selection gating + submit — exact write contract ──

  // Each row sets both dropdowns (firing in reverse order to pin both change
  // handlers on every row), asserts gating, clicks Confirm, and asserts either
  // the exact submitted pair or total inertness. The shared-options row covers
  // the duplicate-spell lock (the default fixtures are disjoint, so a duplicate
  // is only reachable with overlapping lists). Pending edits never surface the
  // payload-gated Current line or Clear button.
  it.each([
    { first: '', second: '', enabled: false },
    { first: 'Fireball', second: '', enabled: false },
    { first: '', second: 'Misty Step', enabled: false },
    { first: 'Magic Missile', second: 'Invisibility', enabled: true },
    { level1Options: ['Magic Missile', 'Shield'], level2Options: ['Magic Missile', 'Shield'], first: 'Magic Missile', second: 'Magic Missile', enabled: false },
  ])('gates Confirm and submit on first="$first" second="$second"', (row) => {
    const props = makeProps({ payload: { level1Options: row.level1Options ?? level1Options, level2Options: row.level2Options ?? level2Options } });
    render(<SpellMasteryModal {...props} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: row.second } });
    fireEvent.change(selects[0], { target: { value: row.first } });

    const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
    fireEvent.click(confirmBtn);
    if (row.enabled) {
      expect(confirmBtn).toBeEnabled();
      expect(props.onConfirm).toHaveBeenCalledTimes(1);
      expect(props.onConfirm).toHaveBeenCalledWith(row.first, row.second);
    } else {
      expect(confirmBtn).toBeDisabled();
      expect(props.onConfirm).not.toHaveBeenCalled();
    }
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear Selection' })).not.toBeInTheDocument();
  });

  it('re-disables Confirm when a valid pair reverts to a placeholder or duplicate', () => {
    const shared = ['Magic Missile', 'Shield'];
    const props = makeProps({ payload: { level1Options: shared, level2Options: shared } });
    render(<SpellMasteryModal {...props} />);
    const selects = screen.getAllByRole('combobox');
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });

    fireEvent.change(selects[0], { target: { value: 'Magic Missile' } });
    fireEvent.change(selects[1], { target: { value: 'Shield' } });
    expect(confirmBtn).toBeEnabled();

    fireEvent.change(selects[1], { target: { value: 'Magic Missile' } });
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(confirmBtn);

    fireEvent.change(selects[1], { target: { value: '' } });
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(confirmBtn);

    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  // ── Pre-selected values ──

  it('initializes dropdowns from pre-selected values, pins the payload-derived Current line, and submits edited local state', () => {
    const props = makeProps({ payload: { currentLevel1: 'Fireball', currentLevel2: 'Misty Step' } });
    render(<SpellMasteryModal {...props} />);
    expect(screen.getByText(/Current:/)).toBeInTheDocument();
    const bolds = document.querySelectorAll('[data-testid="spell-mastery-modal"] b');
    expect([...bolds].map(b => b.textContent)).toEqual(['Fireball', 'Misty Step']);
    const selects = screen.getAllByRole('combobox');
    expect(selects[0].value).toBe('Fireball');
    expect(selects[1].value).toBe('Misty Step');
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Clear Selection' })).toBeInTheDocument();

    // Current line is payload-derived — editing the dropdowns never rewrites it
    fireEvent.change(selects[0], { target: { value: 'Shield' } });
    expect(screen.getByText(/Current:/).textContent).toContain('Fireball');
    expect(props.onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith('Shield', 'Misty Step');
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it.each([
    ['level 1 only', 'Fireball', ''],
    ['level 2 only', '', 'Misty Step'],
  ])('hides the Current line and Clear button and locks Confirm when pre-selections are %s', (_label, currentLevel1, currentLevel2) => {
    render(<SpellMasteryModal {...makeProps({ payload: { currentLevel1, currentLevel2 } })} />);
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear Selection' })).not.toBeInTheDocument();
    const selects = screen.getAllByRole('combobox');
    expect(selects[0].value).toBe(currentLevel1);
    expect(selects[1].value).toBe(currentLevel2);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  // ── Empty option lists ──

  it('renders placeholder-only dropdowns and keeps Confirm inert when option lists are empty', () => {
    const props = makeProps({ payload: { level1Options: [], level2Options: [] } });
    render(<SpellMasteryModal {...props} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);
    selects.forEach((select, i) => {
      expect(select.querySelectorAll('option')).toHaveLength(1);
      expect(select.querySelector('option')).toHaveTextContent(`-- Select a level ${i + 1} spell --`);
    });
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('keeps Confirm enabled and submits unknown pre-selected strings verbatim even when the option lists are empty', () => {
    const props = makeProps({ payload: { level1Options: [], level2Options: [], currentLevel1: 'Fireball', currentLevel2: 'Misty Step' } });
    render(<SpellMasteryModal {...props} />);
    const selects = screen.getAllByRole('combobox');
    // not in the option list, so the DOM value falls back to empty…
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('');
    // …while internal state still holds them, so the write contract sends them out
    expect(screen.getByText(/Current:/)).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
    expect(confirmBtn).toBeEnabled();
    fireEvent.click(confirmBtn);
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith('Fireball', 'Misty Step');
  });

  // ── Clear Selection — fire-and-forget null,null ──

  it('Clear Selection emits null,null once without closing or resetting local state', () => {
    const props = makeProps({ payload: { currentLevel1: 'Fireball', currentLevel2: 'Misty Step' } });
    render(<SpellMasteryModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith(null, null);
    expect(props.onClose).not.toHaveBeenCalled();
    // uncontrolled: local state keeps the pair until the caller remounts the modal
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
    expect(confirmBtn).toBeEnabled();
    fireEvent.click(confirmBtn);
    expect(props.onConfirm).toHaveBeenNthCalledWith(2, 'Fireball', 'Misty Step');
  });

  // ── Overlay / close lane ──

  // Overlay closes (via the overlay onClick's closest('.popup-modal') guard);
  // clicks inside the modal bubble up but are inert. Neither path may ever
  // touch onConfirm — writing is button-only.
  it.each([
    { target: '.popup-overlay', expectClose: true },
    { target: '.popup-modal', expectClose: false },
    { target: 'select', expectClose: false },
  ])('clicking $target with a pending selection never submits and closes=$expectClose', ({ target, expectClose }) => {
    const props = makeProps();
    const { container } = render(<SpellMasteryModal {...props} />);
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Fireball' } });

    fireEvent.click(container.querySelector(target));
    if (expectClose) {
      expect(props.onClose).toHaveBeenCalledTimes(1);
    } else {
      expect(props.onClose).not.toHaveBeenCalled();
    }
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(screen.getByTestId('spell-mastery-modal')).toBeInTheDocument();
  });

  it('renders and survives an overlay click when onClose is omitted', () => {
    const props = makeProps();
    delete props.onClose;
    render(<SpellMasteryModal {...props} />);
    expect(screen.getByTestId('spell-mastery-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('spell-mastery-modal'));
    expect(screen.getByTestId('spell-mastery-modal')).toBeInTheDocument();
  });
});
