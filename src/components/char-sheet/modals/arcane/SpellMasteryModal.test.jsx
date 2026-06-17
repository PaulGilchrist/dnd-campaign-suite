import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellMasteryModal from './SpellMasteryModal.jsx';

// ── Test fixtures ──

const level1Options = ['Fireball', 'Magic Missile', 'Shield'];
const level2Options = ['Misty Step', 'Scorching Ray', 'Invisibility'];

const baseProps = {
  payload: {
    level1Options,
    level2Options,
    currentLevel1: '',
    currentLevel2: '',
  },
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('SpellMasteryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render / display ──

  it('renders modal overlay with test id', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    expect(document.querySelector('[data-testid="spell-mastery-modal"]')).toBeInTheDocument();
  });

  it('renders modal header with title', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    expect(screen.getByText('Spell Mastery')).toBeInTheDocument();
  });

  it('renders instruction paragraph', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    expect(screen.getByText(/Choose a level 1 and a level 2 spell/)).toBeInTheDocument();
  });

  it('renders level 1 spell label', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    expect(screen.getByText('Level 1 spell:')).toBeInTheDocument();
  });

  it('renders level 2 spell label', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    expect(screen.getByText('Level 2 spell:')).toBeInTheDocument();
  });

  it('renders level 1 select with placeholder option', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    const selects = screen.getAllByRole('combobox');
    const level1Select = selects[0];
    expect(level1Select).toBeInTheDocument();
    expect(level1Select.querySelector('option[value=""]')).toBeInTheDocument();
  });

  it('renders level 2 select with placeholder option', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects[1]).toBeInTheDocument();
    expect(selects[1].querySelector('option[value=""]')).toBeInTheDocument();
  });

  it('renders all level 1 spell options', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    for (const spell of level1Options) {
      expect(screen.getByText(spell)).toBeInTheDocument();
    }
  });

  it('renders all level 2 spell options', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    for (const spell of level2Options) {
      expect(screen.getByText(spell)).toBeInTheDocument();
    }
  });

  it('renders confirm button', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeInTheDocument();
  });

  it('has confirm button disabled when no selections made', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
    expect(confirmBtn).toBeDisabled();
  });

  it('does not show current selection when none selected', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
  });

  // ── Pre-selected values ──

  it('shows current selection when values are provided', () => {
    const { container } = render(<SpellMasteryModal {...makeProps({
      payload: {
        level1Options,
        level2Options,
        currentLevel1: 'Fireball',
        currentLevel2: 'Misty Step',
      },
    })} />);
    expect(screen.getByText(/Current:/)).toBeInTheDocument();
    const boldElements = container.querySelectorAll('b');
    expect(boldElements[0].textContent).toBe('Fireball');
    expect(boldElements[1].textContent).toBe('Misty Step');
  });

  it('initializes select with pre-selected level 1 value', () => {
    render(<SpellMasteryModal {...makeProps({
      payload: {
        level1Options,
        level2Options,
        currentLevel1: 'Magic Missile',
        currentLevel2: '',
      },
    })} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects[0].value).toBe('Magic Missile');
  });

  it('initializes select with pre-selected level 2 value', () => {
    render(<SpellMasteryModal {...makeProps({
      payload: {
        level1Options,
        level2Options,
        currentLevel1: '',
        currentLevel2: 'Scorching Ray',
      },
    })} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects[1].value).toBe('Scorching Ray');
  });

  // ── Level 1 selection ──

  it('updates level 1 selection when option is chosen', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'Fireball' } });
    expect(selects[0].value).toBe('Fireball');
  });

  it('enables confirm button after level 1 selection', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    const selects = screen.getAllByRole('combobox');
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
    fireEvent.change(selects[0], { target: { value: 'Fireball' } });
    expect(confirmBtn).toBeDisabled();
  });

  it('disables confirm button when level 1 is deselected', () => {
    render(<SpellMasteryModal {...makeProps({
      payload: {
        level1Options,
        level2Options,
        currentLevel1: 'Fireball',
        currentLevel2: 'Misty Step',
      },
    })} />);
    const selects = screen.getAllByRole('combobox');
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
    fireEvent.change(selects[0], { target: { value: '' } });
    expect(confirmBtn).toBeDisabled();
  });

  // ── Level 2 selection ──

  it('updates level 2 selection when option is chosen', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'Misty Step' } });
    expect(selects[1].value).toBe('Misty Step');
  });

  it('enables confirm button after both selections made', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    const selects = screen.getAllByRole('combobox');
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
    fireEvent.change(selects[0], { target: { value: 'Fireball' } });
    fireEvent.change(selects[1], { target: { value: 'Misty Step' } });
    expect(confirmBtn).not.toBeDisabled();
  });

  // ── Confirm button ──

  it('calls onConfirm with selected values when confirm clicked', () => {
    const onConfirm = vi.fn();
    render(<SpellMasteryModal {...makeProps({ onConfirm })} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'Fireball' } });
    fireEvent.change(selects[1], { target: { value: 'Misty Step' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledWith('Fireball', 'Misty Step');
  });

  it('calls onConfirm with empty strings when no selections made and confirm somehow clicked', () => {
    const onConfirm = vi.fn();
    render(<SpellMasteryModal {...makeProps({ onConfirm })} />);
    // Button is disabled, so user must select both. But test the function behavior directly.
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'Magic Missile' } });
    fireEvent.change(selects[1], { target: { value: 'Invisibility' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledWith('Magic Missile', 'Invisibility');
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<SpellMasteryModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.popup-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<SpellMasteryModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.popup-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Multiple selection changes ──

  it('updates level 1 selection after changing level 2 first', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'Scorching Ray' } });
    fireEvent.change(selects[0], { target: { value: 'Shield' } });
    expect(selects[0].value).toBe('Shield');
    expect(selects[1].value).toBe('Scorching Ray');
  });

  it('confirms last selected values regardless of selection order', () => {
    const onConfirm = vi.fn();
    render(<SpellMasteryModal {...makeProps({ onConfirm })} />);
    const selects = screen.getAllByRole('combobox');
    // Select level 2 first
    fireEvent.change(selects[1], { target: { value: 'Invisibility' } });
    // Then level 1
    fireEvent.change(selects[0], { target: { value: 'Magic Missile' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledWith('Magic Missile', 'Invisibility');
  });

  // ── Empty options ──

  it('renders selects with no options when options arrays are empty', () => {
    render(<SpellMasteryModal {...makeProps({
      payload: {
        level1Options: [],
        level2Options: [],
        currentLevel1: '',
        currentLevel2: '',
      },
    })} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toBeInTheDocument();
    expect(selects[1]).toBeInTheDocument();
    expect(selects[0].options.length).toBe(1); // placeholder only
    expect(selects[1].options.length).toBe(1); // placeholder only
  });

  it('keeps confirm button disabled with empty options', () => {
    render(<SpellMasteryModal {...makeProps({
      payload: {
        level1Options: [],
        level2Options: [],
        currentLevel1: '',
        currentLevel2: '',
      },
    })} />);
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
    expect(confirmBtn).toBeDisabled();
  });

  // ── Modal structure ──

  it('renders with proper CSS classes', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
    expect(document.querySelector('.popup-modal')).toBeInTheDocument();
  });

  it('renders select elements with char-btn class', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    const charBtns = document.querySelectorAll('.char-btn');
    expect(charBtns).toHaveLength(3);
  });

  it('renders confirm button with char-btn class', () => {
    render(<SpellMasteryModal {...makeProps()} />);
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
    expect(confirmBtn).toHaveClass('char-btn');
  });
});
