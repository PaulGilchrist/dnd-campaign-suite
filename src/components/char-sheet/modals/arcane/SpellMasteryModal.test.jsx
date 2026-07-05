// @cleaned-by-ai
// @improved-by-ai
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
  const { payload: overridePayload, ...overrideCallbacks } = overrides || {};
  return {
    payload: { ...baseProps.payload, ...(overridePayload || {}) },
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

  describe('initial render', () => {
    it('renders the modal overlay with the correct test id', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      expect(document.querySelector('[data-testid="spell-mastery-modal"]')).toBeInTheDocument();
    });

    it('renders the modal title, instruction text, and both level labels', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      expect(screen.getByText('Spell Mastery')).toBeInTheDocument();
      expect(screen.getByText(/Choose a level 1 and a level 2 spell/)).toBeInTheDocument();
      expect(screen.getByText('Level 1 spell:')).toBeInTheDocument();
      expect(screen.getByText('Level 2 spell:')).toBeInTheDocument();
    });

    it('renders two select dropdowns and a Confirm Selection button', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      expect(document.querySelectorAll('select')).toHaveLength(2);
      expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeInTheDocument();
    });

    it('renders elements with char-btn class', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Confirm Selection' })).toHaveClass('char-btn');
      document.querySelectorAll('select').forEach((select) => {
        expect(select).toHaveClass('char-btn');
      });
    });
  });

  // ── Placeholder options ──

  describe('placeholder options', () => {
    it('renders placeholder options with correct text and initializes selects with empty values', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      const selects = screen.getAllByRole('combobox');
      expect(selects[0].value).toBe('');
      expect(selects[1].value).toBe('');
      expect(selects[0].querySelector('option[value=""]')).toHaveTextContent('-- Select a level 1 spell --');
      expect(selects[1].querySelector('option[value=""]')).toHaveTextContent('-- Select a level 2 spell --');
    });
  });

  // ── Spell options population ──

  describe('spell options population', () => {
    it('renders all level 1 and level 2 spell options', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      for (const spell of [...level1Options, ...level2Options]) {
        expect(screen.getByText(spell)).toBeInTheDocument();
      }
    });

    it('renders only placeholder when options arrays are empty', () => {
      render(<SpellMasteryModal {...makeProps({ payload: { level1Options: [], level2Options: [], currentLevel1: '', currentLevel2: '' } })} />);
      const selects = screen.getAllByRole('combobox');
      expect(selects[0].options.length).toBe(1);
      expect(selects[1].options.length).toBe(1);
    });
  });

  // ── Confirm button disabled state ──

  describe('confirm button disabled state', () => {
    it('is disabled when no selections are made', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
    });

    it('is disabled when only one level is selected', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      const selects = screen.getAllByRole('combobox');
      const btn = screen.getByRole('button', { name: 'Confirm Selection' });
      fireEvent.change(selects[0], { target: { value: 'Fireball' } });
      expect(btn).toBeDisabled();
      fireEvent.change(selects[1], { target: { value: 'Misty Step' } });
      expect(btn).not.toBeDisabled();
      fireEvent.change(selects[0], { target: { value: '' } });
      expect(btn).toBeDisabled();
    });

    it('is disabled when the same spell is selected for both levels', () => {
      render(<SpellMasteryModal {...makeProps({ payload: { level1Options: ['Magic Missile', 'Shield'], level2Options: ['Magic Missile', 'Shield'], currentLevel1: '', currentLevel2: '' } })} />);
      const selects = screen.getAllByRole('combobox');
      const btn = screen.getByRole('button', { name: 'Confirm Selection' });
      fireEvent.change(selects[0], { target: { value: 'Magic Missile' } });
      fireEvent.change(selects[1], { target: { value: 'Magic Missile' } });
      expect(btn).toBeDisabled();
    });
  });

  // ── Pre-selected values ──

  describe('pre-selected values', () => {
    it('does not show current selection text when no values are pre-selected', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
    });

    it('shows current selection text with spell names when both values are pre-selected', () => {
      const { container } = render(<SpellMasteryModal {...makeProps({ payload: { level1Options, level2Options, currentLevel1: 'Fireball', currentLevel2: 'Misty Step' } })} />);
      expect(screen.getByText(/Current:/)).toBeInTheDocument();
      const bolds = container.querySelectorAll('b');
      expect(bolds[0].textContent).toBe('Fireball');
      expect(bolds[1].textContent).toBe('Misty Step');
    });

    it('initializes selects with pre-selected values', () => {
      render(<SpellMasteryModal {...makeProps({ payload: { level1Options, level2Options, currentLevel1: 'Shield', currentLevel2: 'Invisibility' } })} />);
      const selects = screen.getAllByRole('combobox');
      expect(selects[0].value).toBe('Shield');
      expect(selects[1].value).toBe('Invisibility');
    });
  });

  // ── Confirm interaction ──

  describe('confirm interaction', () => {
    it('calls onConfirm with selected values when confirm is clicked', () => {
      const onConfirm = vi.fn();
      render(<SpellMasteryModal {...makeProps({ onConfirm })} />);
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'Fireball' } });
      fireEvent.change(selects[1], { target: { value: 'Misty Step' } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
      expect(onConfirm).toHaveBeenCalledWith('Fireball', 'Misty Step');
    });

    it('calls onConfirm with pre-selected values without user interaction', () => {
      const onConfirm = vi.fn();
      render(<SpellMasteryModal {...makeProps({ payload: { level1Options, level2Options, currentLevel1: 'Magic Missile', currentLevel2: 'Invisibility' }, onConfirm })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
      expect(onConfirm).toHaveBeenCalledWith('Magic Missile', 'Invisibility');
    });

    it('calls onConfirm with the last selected values regardless of selection order', () => {
      const onConfirm = vi.fn();
      render(<SpellMasteryModal {...makeProps({ onConfirm })} />);
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[1], { target: { value: 'Invisibility' } });
      fireEvent.change(selects[0], { target: { value: 'Magic Missile' } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
      expect(onConfirm).toHaveBeenCalledWith('Magic Missile', 'Invisibility');
    });
  });

  // ── Clear Selection ──

  describe('clear selection', () => {
    it('does not show Clear Selection button when no selection exists', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      expect(screen.queryByText('Clear Selection')).not.toBeInTheDocument();
    });

    it('shows Clear Selection button when both spells are pre-selected', () => {
      render(<SpellMasteryModal {...makeProps({ payload: { level1Options, level2Options, currentLevel1: 'Fireball', currentLevel2: 'Misty Step' } })} />);
      expect(screen.getByText('Clear Selection')).toBeInTheDocument();
    });

    it('does not show Clear Selection button when only one level is pre-selected', () => {
      render(<SpellMasteryModal {...makeProps({ payload: { level1Options, level2Options, currentLevel1: 'Fireball', currentLevel2: '' } })} />);
      expect(screen.queryByText('Clear Selection')).not.toBeInTheDocument();
      render(<SpellMasteryModal {...makeProps({ payload: { level1Options, level2Options, currentLevel1: '', currentLevel2: 'Misty Step' } })} />);
      expect(screen.queryByText('Clear Selection')).not.toBeInTheDocument();
    });

    it('calls onConfirm with null, null when Clear Selection is clicked', () => {
      const onConfirm = vi.fn();
      render(<SpellMasteryModal {...makeProps({ payload: { level1Options, level2Options, currentLevel1: 'Fireball', currentLevel2: 'Misty Step' }, onConfirm })} />);
      fireEvent.click(screen.getByText('Clear Selection'));
      expect(onConfirm).toHaveBeenCalledWith(null, null);
    });
  });
});
