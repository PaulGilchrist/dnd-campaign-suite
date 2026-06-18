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

    it('renders the modal title', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      expect(screen.getByText('Spell Mastery')).toBeInTheDocument();
    });

    it('renders the instruction paragraph explaining spell mastery', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      expect(screen.getByText(/Choose a level 1 and a level 2 spell/)).toBeInTheDocument();
    });

    it('renders labels for both level selects', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      expect(screen.getByText('Level 1 spell:')).toBeInTheDocument();
      expect(screen.getByText('Level 2 spell:')).toBeInTheDocument();
    });

    it('renders two select dropdowns', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      expect(document.querySelectorAll('select')).toHaveLength(2);
    });

    it('renders a Confirm Selection button', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeInTheDocument();
    });

    it('renders the overlay and modal CSS structure', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
      expect(document.querySelector('.popup-modal')).toBeInTheDocument();
    });

    it('renders selects and button with char-btn class', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Confirm Selection' })).toHaveClass('char-btn');
      document.querySelectorAll('select').forEach((select) => {
        expect(select).toHaveClass('char-btn');
      });
    });
  });

  // ── Placeholder options ──

  describe('placeholder options', () => {
    it('renders a placeholder option in the level 1 select with correct text', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      const selects = screen.getAllByRole('combobox');
      const placeholder = selects[0].querySelector('option[value=""]');
      expect(placeholder).toHaveTextContent('-- Select a level 1 spell --');
    });

    it('renders a placeholder option in the level 2 select with correct text', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      const selects = screen.getAllByRole('combobox');
      const placeholder = selects[1].querySelector('option[value=""]');
      expect(placeholder).toHaveTextContent('-- Select a level 2 spell --');
    });

    it('initializes selects with empty values when no pre-selection', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      const selects = screen.getAllByRole('combobox');
      expect(selects[0].value).toBe('');
      expect(selects[1].value).toBe('');
    });
  });

  // ── Spell options population ──

  describe('spell options population', () => {
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

    it('renders only placeholder when level 1 options array is empty', () => {
      render(<SpellMasteryModal {...makeProps({ payload: { level1Options: [], currentLevel1: '', currentLevel2: '' } })} />);
      const selects = screen.getAllByRole('combobox');
      expect(selects[0].options.length).toBe(1);
    });

    it('renders only placeholder when level 2 options array is empty', () => {
      render(<SpellMasteryModal {...makeProps({ payload: { level2Options: [], currentLevel1: '', currentLevel2: '' } })} />);
      const selects = screen.getAllByRole('combobox');
      expect(selects[1].options.length).toBe(1);
    });
  });

  // ── Confirm button disabled state ──

  describe('confirm button disabled state', () => {
    it('is disabled when no selections are made', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
    });

    it('is disabled when only level 1 is selected', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      const selects = screen.getAllByRole('combobox');
      const btn = screen.getByRole('button', { name: 'Confirm Selection' });
      fireEvent.change(selects[0], { target: { value: 'Fireball' } });
      expect(btn).toBeDisabled();
    });

    it('is disabled when only level 2 is selected', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      const selects = screen.getAllByRole('combobox');
      const btn = screen.getByRole('button', { name: 'Confirm Selection' });
      fireEvent.change(selects[1], { target: { value: 'Misty Step' } });
      expect(btn).toBeDisabled();
    });

    it('is disabled when level 1 selection reverts to empty', () => {
      render(<SpellMasteryModal {...makeProps({ payload: { level1Options, level2Options, currentLevel1: 'Fireball', currentLevel2: 'Misty Step' } })} />);
      const selects = screen.getAllByRole('combobox');
      const btn = screen.getByRole('button', { name: 'Confirm Selection' });
      expect(btn).not.toBeDisabled();
      fireEvent.change(selects[0], { target: { value: '' } });
      expect(btn).toBeDisabled();
    });

    it('is disabled when level 2 selection reverts to empty', () => {
      render(<SpellMasteryModal {...makeProps({ payload: { level1Options, level2Options, currentLevel1: 'Fireball', currentLevel2: 'Misty Step' } })} />);
      const selects = screen.getAllByRole('combobox');
      const btn = screen.getByRole('button', { name: 'Confirm Selection' });
      expect(btn).not.toBeDisabled();
      fireEvent.change(selects[1], { target: { value: '' } });
      expect(btn).toBeDisabled();
    });

    it('is disabled when options arrays are empty', () => {
      render(<SpellMasteryModal {...makeProps({ payload: { level1Options: [], level2Options: [], currentLevel1: '', currentLevel2: '' } })} />);
      expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
    });
  });

  // ── Confirm button enabled state ──

  describe('confirm button enabled state', () => {
    it('is enabled when both level 1 and level 2 are selected', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      const selects = screen.getAllByRole('combobox');
      const btn = screen.getByRole('button', { name: 'Confirm Selection' });
      fireEvent.change(selects[0], { target: { value: 'Fireball' } });
      fireEvent.change(selects[1], { target: { value: 'Misty Step' } });
      expect(btn).not.toBeDisabled();
    });

    it('becomes enabled after selecting both levels in order (1 then 2)', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      const selects = screen.getAllByRole('combobox');
      const btn = screen.getByRole('button', { name: 'Confirm Selection' });
      expect(btn).toBeDisabled();
      fireEvent.change(selects[0], { target: { value: 'Fireball' } });
      expect(btn).toBeDisabled();
      fireEvent.change(selects[1], { target: { value: 'Misty Step' } });
      expect(btn).not.toBeDisabled();
    });

    it('becomes enabled after selecting both levels in reverse order (2 then 1)', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      const selects = screen.getAllByRole('combobox');
      const btn = screen.getByRole('button', { name: 'Confirm Selection' });
      expect(btn).toBeDisabled();
      fireEvent.change(selects[1], { target: { value: 'Scorching Ray' } });
      expect(btn).toBeDisabled();
      fireEvent.change(selects[0], { target: { value: 'Shield' } });
      expect(btn).not.toBeDisabled();
    });
  });

  // ── Selection changes ──

  describe('selection changes', () => {
    it('updates level 1 select value when an option is chosen', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'Fireball' } });
      expect(selects[0].value).toBe('Fireball');
    });

    it('updates level 2 select value when an option is chosen', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[1], { target: { value: 'Misty Step' } });
      expect(selects[1].value).toBe('Misty Step');
    });

    it('allows changing level 1 selection after level 2 was already selected', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[1], { target: { value: 'Scorching Ray' } });
      fireEvent.change(selects[0], { target: { value: 'Shield' } });
      expect(selects[0].value).toBe('Shield');
      expect(selects[1].value).toBe('Scorching Ray');
    });

    it('allows changing level 2 selection after level 1 was already selected', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'Fireball' } });
      fireEvent.change(selects[1], { target: { value: 'Invisibility' } });
      expect(selects[0].value).toBe('Fireball');
      expect(selects[1].value).toBe('Invisibility');
    });

    it('updates to a different level 1 spell after an initial selection', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'Fireball' } });
      fireEvent.change(selects[0], { target: { value: 'Magic Missile' } });
      expect(selects[0].value).toBe('Magic Missile');
    });
  });

  // ── Pre-selected values ──

  describe('pre-selected values', () => {
    it('does not show current selection text when no values are pre-selected', () => {
      render(<SpellMasteryModal {...makeProps()} />);
      expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
    });

    it('shows current selection text when both values are pre-selected', () => {
      render(<SpellMasteryModal {...makeProps({ payload: { level1Options, level2Options, currentLevel1: 'Fireball', currentLevel2: 'Misty Step' } })} />);
      expect(screen.getByText(/Current:/)).toBeInTheDocument();
    });

    it('displays the pre-selected spell names in bold', () => {
      const { container } = render(<SpellMasteryModal {...makeProps({ payload: { level1Options, level2Options, currentLevel1: 'Fireball', currentLevel2: 'Misty Step' } })} />);
      const bolds = container.querySelectorAll('b');
      expect(bolds[0].textContent).toBe('Fireball');
      expect(bolds[1].textContent).toBe('Misty Step');
    });

    it('initializes select with pre-selected level 1 value', () => {
      render(<SpellMasteryModal {...makeProps({ payload: { level1Options, level2Options, currentLevel1: 'Magic Missile', currentLevel2: '' } })} />);
      const selects = screen.getAllByRole('combobox');
      expect(selects[0].value).toBe('Magic Missile');
    });

    it('initializes select with pre-selected level 2 value', () => {
      render(<SpellMasteryModal {...makeProps({ payload: { level1Options, level2Options, currentLevel1: '', currentLevel2: 'Scorching Ray' } })} />);
      const selects = screen.getAllByRole('combobox');
      expect(selects[1].value).toBe('Scorching Ray');
    });

    it('initializes selects with pre-selected values independently', () => {
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
      // Select level 2 first, then level 1
      fireEvent.change(selects[1], { target: { value: 'Invisibility' } });
      fireEvent.change(selects[0], { target: { value: 'Magic Missile' } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
      expect(onConfirm).toHaveBeenCalledWith('Magic Missile', 'Invisibility');
    });

    it('calls onConfirm with different spell combination', () => {
      const onConfirm = vi.fn();
      render(<SpellMasteryModal {...makeProps({ onConfirm })} />);
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'Shield' } });
      fireEvent.change(selects[1], { target: { value: 'Scorching Ray' } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
      expect(onConfirm).toHaveBeenCalledWith('Shield', 'Scorching Ray');
    });
  });

  // ── Overlay click behavior ──

  describe('close behavior', () => {
    it('calls onClose when clicking the overlay background', () => {
      const onClose = vi.fn();
      render(<SpellMasteryModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.popup-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when clicking inside the modal content', () => {
      const onClose = vi.fn();
      render(<SpellMasteryModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.popup-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
