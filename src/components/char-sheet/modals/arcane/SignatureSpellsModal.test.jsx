// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SignatureSpellsModal from './SignatureSpellsModal.jsx';

// Signature Spells chooser modal internals: dropdown population, the two-distinct-
// spells confirm gate, and the exact write contract on onConfirm —
//   select + Confirm → onConfirm(spell1, spell2)
//   Clear Selection  → onConfirm(null, null)
// The caller popup seam (executeHandler → onSignatureSpellsSelected with the
// action/playerStats, close/remount behavior) is owned by
// CharSpecialActions.signatureSpellsPopup.test.jsx and deliberately not re-tested here.
// NOTE: the component uses inline styles (padding/opacity/width) — flagged here,
// not fixed from the test suite; move to a co-located CSS file if touched.

// ── Test fixtures ──

const level3Options = [
  'Bane',
  'Fireball',
  'Hypnotic Pattern',
  'Magic Missile',
  'Misty Step',
  'Shield',
];

// Fresh per call: every test gets pristine callbacks and its own payload, and
// partial payload overrides merge over the defaults (never silently backfilled
// with `??`, so selectedSpells: null/undefined reach the component as-is).
// There are no module-level mocks to mockReset in afterEach — the fresh-per-call
// makeProps makes resetAllMocks unnecessary.
function makeProps(overrides = {}) {
  const { payload: overridePayload, ...overrideCallbacks } = overrides;
  return {
    payload: {
      level3Options,
      selectedSpells: [],
      ...overridePayload,
    },
    onConfirm: overrideCallbacks.onConfirm ?? vi.fn(),
    onClose: overrideCallbacks.onClose ?? vi.fn(),
  };
}

// ── Tests ──

describe('SignatureSpellsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render ──

  it('renders title, description, two labelled dropdowns populated with every option, and a disabled Confirm button with no Clear Selection', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
    expect(screen.getByText('Signature Spells')).toBeInTheDocument();
    expect(screen.getByText(/Choose two level 3 spells in your spellbook/)).toBeInTheDocument();
    expect(screen.getByText('Signature spell 1:')).toBeInTheDocument();
    expect(screen.getByText('Signature spell 2:')).toBeInTheDocument();
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear Selection' })).not.toBeInTheDocument();

    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);
    selects.forEach((select) => {
      expect(select).toHaveClass('char-btn');
      expect(select.value).toBe('');
      expect(select.querySelectorAll('option')).toHaveLength(level3Options.length + 1);
      expect(select.querySelector('option[value=""]')).toHaveTextContent('-- Select a level 3 spell --');
      level3Options.forEach((spell) => {
        expect(select.querySelector(`option[value="${spell}"]`)).toBeInTheDocument();
      });
    });

    const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
    expect(confirmBtn).toBeInTheDocument();
    expect(confirmBtn).toHaveClass('char-btn');
    expect(confirmBtn).toBeDisabled();
  });

  it('renders placeholder-only dropdowns when level3Options is empty', () => {
    render(<SignatureSpellsModal {...makeProps({ payload: { level3Options: [] } })} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);
    selects.forEach((select) => {
      expect(select.querySelectorAll('option')).toHaveLength(1);
      expect(select.querySelector('option')).toHaveTextContent('-- Select a level 3 spell --');
    });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  // ── Confirm gating (two distinct spells required) ──

  it('enables Confirm only for two distinct selections and stays inert while disabled', () => {
    const onConfirm = vi.fn();
    render(<SignatureSpellsModal {...makeProps({ onConfirm })} />);
    const selects = screen.getAllByRole('combobox');
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });

    fireEvent.change(selects[0], { target: { value: 'Shield' } });
    expect(confirmBtn).toBeDisabled();

    // duplicate selection is still blocked
    fireEvent.change(selects[1], { target: { value: 'Shield' } });
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(onConfirm).not.toHaveBeenCalled();

    // two distinct spells unlock Confirm
    fireEvent.change(selects[1], { target: { value: 'Magic Missile' } });
    expect(confirmBtn).toBeEnabled();

    // reverting either spell re-locks it
    fireEvent.change(selects[1], { target: { value: '' } });
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // ── Confirm submit — exact write contract ──

  it('calls onConfirm once with the selected pair in dropdown order', () => {
    const onConfirm = vi.fn();
    render(<SignatureSpellsModal {...makeProps({ onConfirm })} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'Shield' } });
    fireEvent.change(selects[0], { target: { value: 'Misty Step' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('Misty Step', 'Shield');
  });

  it('shows Current line and submits pre-selected values unchanged when Confirm is clicked without edits', () => {
    const onConfirm = vi.fn();
    render(
      <SignatureSpellsModal {...makeProps({ payload: { selectedSpells: ['Bane', 'Hypnotic Pattern'] }, onConfirm })} />,
    );
    expect(screen.getByText(/Current:/)).toBeInTheDocument();
    const bolds = document.querySelectorAll('[data-testid="signature-spells-modal"] b');
    expect(bolds[0].textContent).toBe('Bane');
    expect(bolds[1].textContent).toBe('Hypnotic Pattern');
    const selects = screen.getAllByRole('combobox');
    expect(selects[0].value).toBe('Bane');
    expect(selects[1].value).toBe('Hypnotic Pattern');
    expect(screen.getByRole('button', { name: 'Clear Selection' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('Bane', 'Hypnotic Pattern');
  });

  it('keeps Confirm enabled for unknown pre-selected spells and submits internal state verbatim', () => {
    const onConfirm = vi.fn();
    render(
      <SignatureSpellsModal {...makeProps({ payload: { selectedSpells: ['Unknown Spell', 'Another Unknown'] }, onConfirm })} />,
    );
    const selects = screen.getAllByRole('combobox');
    // not in the option list, so the DOM value falls back to empty…
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('');
    // …while internal state still holds them, so the write contract sends them out
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
    expect(confirmBtn).toBeEnabled();
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith('Unknown Spell', 'Another Unknown');
  });

  // ── Absent / partial pre-selections ──

  it.each([
    ['an empty array', []],
    ['undefined', undefined],
    ['null', null],
  ])('renders a fully unselected, Confirm-disabled modal when selectedSpells is %s', (_label, selectedSpells) => {
    render(<SignatureSpellsModal {...makeProps({ payload: { selectedSpells } })} />);
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear Selection' })).not.toBeInTheDocument();
    const selects = screen.getAllByRole('combobox');
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('');
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it.each([
    ['one real spell', ['Shield'], ['Shield', '']],
    ['a null first entry', [null, 'Shield'], ['', 'Shield']],
  ])('initializes dropdowns %s with empty slots, showing Current and Confirm disabled', (_label, selectedSpells, expectedValues) => {
    render(<SignatureSpellsModal {...makeProps({ payload: { selectedSpells } })} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects[0].value).toBe(expectedValues[0]);
    expect(selects[1].value).toBe(expectedValues[1]);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
    // any non-empty selectedSpells renders the Current line and the Clear button
    expect(screen.getByText(/Current:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear Selection' })).toBeInTheDocument();
  });

  // ── Clear Selection — fire-and-forget null,null ──

  it('Clear Selection emits null,null once without closing or resetting local state', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <SignatureSpellsModal {...makeProps({ payload: { selectedSpells: ['Shield', 'Magic Missile'] }, onConfirm, onClose })} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(null, null);
    expect(onClose).not.toHaveBeenCalled();
    // uncontrolled: local state keeps the pair until the caller remounts the modal
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenNthCalledWith(2, 'Shield', 'Magic Missile');
  });

  // ── Overlay / close lane ──

  it('overlay background click closes once and is otherwise inert', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<SignatureSpellsModal {...makeProps({ onConfirm, onClose })} />);
    fireEvent.click(screen.getByTestId('signature-spells-modal'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
  });

  it.each([
    ['the modal body', '.popup-modal'],
    ['a spell dropdown', 'select'],
  ])('clicks inside %s do not close the modal', (_label, selector) => {
    const onClose = vi.fn();
    const { container } = render(<SignatureSpellsModal {...makeProps({ onClose })} />);
    fireEvent.click(container.querySelector(selector));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
  });

  it('renders and survives an overlay click when onClose is omitted', () => {
    const props = makeProps();
    delete props.onClose;
    render(<SignatureSpellsModal {...props} />);
    expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('signature-spells-modal'));
    expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
  });
});
