import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellMasteryModal from './SpellMasteryModal.jsx';

// ── Test fixtures ──

const level1Options = ['Fireball', 'Magic Missile', 'Shield'];
const level2Options = ['Misty Step', 'Scorching Ray', 'Invisibility'];

function makeProps(overrides = {}) {
  const { payload: overridePayload, ...overrideCallbacks } = overrides;
  return {
    payload: {
      level1Options: level1Options,
      level2Options: level2Options,
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render ──

  it('renders the modal overlay with title, instruction text, both level labels, two select dropdowns, and a Confirm Selection button', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    expect(document.querySelector('[data-testid="spell-mastery-modal"]')).toBeInTheDocument();
    expect(screen.getByText('Spell Mastery')).toBeInTheDocument();
    expect(screen.getByText(/Choose a level 1 and a level 2 spell/)).toBeInTheDocument();
    expect(screen.getByText('Level 1 spell:')).toBeInTheDocument();
    expect(screen.getByText('Level 2 spell:')).toBeInTheDocument();
    expect(document.querySelectorAll('select')).toHaveLength(2);
    const btn = screen.getByRole('button', { name: 'Confirm Selection' });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass('char-btn');
    document.querySelectorAll('select').forEach((select) => {
      expect(select).toHaveClass('char-btn');
    });
    const selects = screen.getAllByRole('combobox');
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('');
    expect(selects[0].querySelector('option[value=""]')).toHaveTextContent('-- Select a level 1 spell --');
    expect(selects[1].querySelector('option[value=""]')).toHaveTextContent('-- Select a level 2 spell --');
    for (const spell of [...level1Options, ...level2Options]) {
      expect(screen.getByText(spell)).toBeInTheDocument();
    }
  });

  // ── Empty options ──

  it('renders selects with only the default placeholder when option arrays are empty', () => {
    render(<SpellMasteryModal {...makeProps({ payload: { level1Options: [], level2Options: [], currentLevel1: '', currentLevel2: '' } })} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects[0].options.length).toBe(1);
    expect(selects[1].options.length).toBe(1);
  });

  // ── Confirm button disabled state ──

  it('disables the confirm button when no selections are made, when only one level is selected, and when the same spell is selected for both levels', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();

    const selects = screen.getAllByRole('combobox');
    const btn = screen.getByRole('button', { name: 'Confirm Selection' });
    fireEvent.change(selects[0], { target: { value: 'Fireball' } });
    expect(btn).toBeDisabled();
    fireEvent.change(selects[1], { target: { value: 'Misty Step' } });
    expect(btn).not.toBeDisabled();
    fireEvent.change(selects[0], { target: { value: '' } });
    expect(btn).toBeDisabled();

    cleanup();
    render(<SpellMasteryModal {...makeProps({ payload: { level1Options: ['Magic Missile', 'Shield'], level2Options: ['Magic Missile', 'Shield'], currentLevel1: '', currentLevel2: '' } })} />);
    const selects2 = screen.getAllByRole('combobox');
    const btn2 = screen.getByRole('button', { name: 'Confirm Selection' });
    fireEvent.change(selects2[0], { target: { value: 'Magic Missile' } });
    fireEvent.change(selects2[1], { target: { value: 'Magic Missile' } });
    expect(btn2).toBeDisabled();
  });

  // ── Pre-selected values ──

  it('shows current selection text with spell names and initializes selects with pre-selected values when both are provided', () => {
    render(<SpellMasteryModal {...makeProps({ payload: { level1Options, level2Options, currentLevel1: 'Fireball', currentLevel2: 'Misty Step' } })} />);
    expect(screen.getByText(/Current:/)).toBeInTheDocument();
    const bolds = document.querySelectorAll('[data-testid="spell-mastery-modal"] b');
    expect(bolds[0].textContent).toBe('Fireball');
    expect(bolds[1].textContent).toBe('Misty Step');
    const selects = screen.getAllByRole('combobox');
    expect(selects[0].value).toBe('Fireball');
    expect(selects[1].value).toBe('Misty Step');
  });

  // ── Confirm interaction ──

  it('calls onConfirm with selected or pre-selected values when confirm is clicked, regardless of selection order', async () => {
    const onConfirm = vi.fn();
    render(<SpellMasteryModal {...makeProps({ onConfirm })} />);
    const selects = screen.getAllByRole('combobox');
    await act(async () => {
      fireEvent.change(selects[0], { target: { value: 'Fireball' } });
      fireEvent.change(selects[1], { target: { value: 'Misty Step' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    });
    expect(onConfirm).toHaveBeenCalledWith('Fireball', 'Misty Step');
  });

  it('calls onConfirm with pre-selected values when confirm is clicked without changes', async () => {
    const onConfirm = vi.fn();
    render(<SpellMasteryModal {...makeProps({ payload: { level1Options, level2Options, currentLevel1: 'Magic Missile', currentLevel2: 'Invisibility' }, onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    });
    expect(onConfirm).toHaveBeenCalledWith('Magic Missile', 'Invisibility');
  });

  it('calls onConfirm with the last selected values regardless of selection order', async () => {
    const onConfirm = vi.fn();
    render(<SpellMasteryModal {...makeProps({ onConfirm })} />);
    const selects = screen.getAllByRole('combobox');
    await act(async () => {
      fireEvent.change(selects[1], { target: { value: 'Invisibility' } });
      fireEvent.change(selects[0], { target: { value: 'Magic Missile' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    });
    expect(onConfirm).toHaveBeenCalledWith('Magic Missile', 'Invisibility');
  });

  it('does not call onConfirm when confirm is clicked but is disabled', async () => {
    const onConfirm = vi.fn();
    render(<SpellMasteryModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // ── Clear Selection ──

  it('shows Clear Selection button only when both spells are pre-selected, and calls onConfirm with null, null when clicked', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    expect(screen.queryByText('Clear Selection')).not.toBeInTheDocument();
    cleanup();
    render(<SpellMasteryModal {...makeProps({ payload: { level1Options, level2Options, currentLevel1: 'Fireball', currentLevel2: '' } })} />);
    expect(screen.queryByText('Clear Selection')).not.toBeInTheDocument();
    cleanup();
    render(<SpellMasteryModal {...makeProps({ payload: { level1Options, level2Options, currentLevel1: '', currentLevel2: 'Misty Step' } })} />);
    expect(screen.queryByText('Clear Selection')).not.toBeInTheDocument();
    cleanup();
    render(<SpellMasteryModal {...makeProps({ payload: { level1Options, level2Options, currentLevel1: 'Fireball', currentLevel2: 'Misty Step' } })} />);
    expect(screen.getByText('Clear Selection')).toBeInTheDocument();
  });

  it('calls onConfirm with null, null when Clear Selection is clicked', async () => {
    const onConfirm = vi.fn();
    render(<SpellMasteryModal {...makeProps({ payload: { level1Options, level2Options, currentLevel1: 'Fireball', currentLevel2: 'Misty Step' }, onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Clear Selection'));
    });
    expect(onConfirm).toHaveBeenCalledWith(null, null);
  });

  // ── Overlay interaction ──

  it('calls onClose when the overlay background is clicked', () => {
    const onClose = vi.fn();
    render(<SpellMasteryModal {...makeProps({ onClose })} />);
    const overlay = document.querySelector('.popup-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when the inner modal is clicked', () => {
    const onClose = vi.fn();
    render(<SpellMasteryModal {...makeProps({ onClose })} />);
    const innerModal = document.querySelector('.popup-modal');
    fireEvent.click(innerModal);
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Edge cases ──

  it('renders selects with only the default option when option arrays are empty and both are pre-selected', () => {
    render(<SpellMasteryModal {...makeProps({ payload: { level1Options: [], level2Options: [], currentLevel1: 'Fireball', currentLevel2: 'Misty Step' } })} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects[0].options.length).toBe(1);
    expect(selects[1].options.length).toBe(1);
    expect(screen.getByText(/Current:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeEnabled();
  });
});
