import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SavantModal from './SavantModal.jsx';

// ── Test fixtures ──

const spellOptions = [
  'Burning Hands',
  'Charm Person',
  'Color Spray',
  'Detect Magic',
  'Disguise Self',
  'Enthrall',
  'Feather Fall',
  'Find Familiar',
  'Gust of Wind',
  'Hypnotic Pattern',
  'Identify',
  'Illusory Script',
  'Jump',
  'Longstrider',
  'Machete',
  'Protection from Evil and Good',
  'Silent Image',
  'Sleep',
  'Tasha\'s Caustic Brew',
  'Tenser\'s Floating Disk',
  'Tongues',
  'Unseen Servant',
  'Water Breathing',
  'Water Walk',
  'Web',
  'Whirlwind',
];

const basePayload = {
  school: 'Evocation',
  spellOptions,
  selectedSpells: [],
};

function makeProps(overrides) {
  return {
    payload: { ...basePayload, ...(overrides?.payload || {}) },
    onConfirm: overrides?.onConfirm || vi.fn(),
    onClose: overrides?.onClose || vi.fn(),
  };
}

// ── Tests ──

describe('SavantModal', () => {
  describe('initial render', () => {
    it('renders the modal overlay with the school name and description', () => {
      render(<SavantModal {...makeProps()} />);
      expect(screen.getByText('Evocation Savant')).toBeInTheDocument();
      expect(screen.getByText(/Choose two Wizard spells from the Evocation school/)).toBeInTheDocument();
    });

    it('renders two spell selection dropdowns with options and a disabled confirm button', () => {
      render(<SavantModal {...makeProps()} />);
      const selects = document.querySelectorAll('select');
      expect(selects).toHaveLength(2);
      // Verify each select has the placeholder option as first option
      expect(selects[0].options[0].textContent).toContain('-- Select a');
      expect(selects[1].options[0].textContent).toContain('-- Select a');
      // Verify all spell options are present in both dropdowns
      expect(selects[0].options.length).toBe(spellOptions.length + 1); // +1 for placeholder
      expect(selects[1].options.length).toBe(spellOptions.length + 1);
      expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Clear Selection' })).not.toBeInTheDocument();
    });

  });

  describe('existing selections', () => {
    it('shows current selections and pre-selects them in the dropdowns', () => {
      const props = makeProps({
        payload: {
          ...basePayload,
          selectedSpells: ['Sleep', 'Web'],
        },
      });
      render(<SavantModal {...props} />);
      const currentPara = screen.getByText(/Current:/).closest('p');
      expect(currentPara.textContent).toContain('Sleep');
      expect(currentPara.textContent).toContain('Web');
      expect(currentPara.textContent).toContain('and');
      const selects = document.querySelectorAll('select');
      expect(selects[0]).toHaveValue('Sleep');
      expect(selects[1]).toHaveValue('Web');
      expect(screen.getByRole('button', { name: 'Clear Selection' })).toBeInTheDocument();
    });

    it.each`
      selectedSpells     | description
      ${undefined}       | ${'undefined'}
      ${[]}              | ${'empty array'}
    `('renders without "Current:" display when selectedSpells is $description', ({ selectedSpells }) => {
      const props = makeProps({
        payload: {
          ...basePayload,
          selectedSpells,
        },
      });
      render(<SavantModal {...props} />);
      expect(screen.getByText('Evocation Savant')).toBeInTheDocument();
      expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
    });

    it('pre-selects a single existing spell in the first dropdown', () => {
      const props = makeProps({
        payload: {
          ...basePayload,
          selectedSpells: ['Sleep'],
        },
      });
      render(<SavantModal {...props} />);
      const selects = document.querySelectorAll('select');
      expect(selects[0]).toHaveValue('Sleep');
      expect(selects[1]).toHaveValue('');
      // Clear Selection appears when selectedSpells has any items
      expect(screen.getByRole('button', { name: 'Clear Selection' })).toBeInTheDocument();
    });
  });

  describe('selection behavior', () => {
    it.each`
      first        | second       | enabled
      ${''}        | ${''}        | ${false}
      ${'Sleep'}   | ${''}        | ${false}
      ${''}        | ${'Web'}     | ${false}
      ${'Sleep'}   | ${'Sleep'}   | ${false}
      ${'Sleep'}   | ${'Web'}     | ${true}
      ${'Web'}     | ${'Sleep'}   | ${true}
      ${'Burning Hands'} | ${'Burning Hands'} | ${false}
    `('Confirm is $enabled when first="$first" and second="$second"', ({ first, second, enabled }) => {
      render(<SavantModal {...makeProps()} />);
      const selects = document.querySelectorAll('select');
      if (first) fireEvent.change(selects[0], { target: { value: first } });
      if (second) fireEvent.change(selects[1], { target: { value: second } });
      const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
      if (enabled) {
        expect(confirmBtn).not.toBeDisabled();
      } else {
        expect(confirmBtn).toBeDisabled();
      }
    });
  });

  describe('confirm', () => {
    it('calls onConfirm with the two selected spells in order', () => {
      const onConfirm = vi.fn();
      render(<SavantModal {...makeProps({ onConfirm })} />);
      const selects = document.querySelectorAll('select');
      fireEvent.change(selects[0], { target: { value: 'Sleep' } });
      fireEvent.change(selects[1], { target: { value: 'Web' } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
      expect(onConfirm).toHaveBeenCalledWith('Sleep', 'Web');
    });

  });

  describe('clear selection', () => {
    it('calls onConfirm with null, null when Clear Selection is clicked', () => {
      const onConfirm = vi.fn();
      const props = makeProps({
        payload: {
          ...basePayload,
          selectedSpells: ['Sleep', 'Web'],
        },
        onConfirm,
      });
      render(<SavantModal {...props} />);
      fireEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));
      expect(onConfirm).toHaveBeenCalledWith(null, null);
    });

  });

  describe('overlay click to close', () => {
    it('calls onClose when clicking the overlay background', () => {
      const onClose = vi.fn();
      render(<SavantModal {...makeProps({ onClose })} />);
      const overlay = screen.getByTestId('evocation-savant-modal');
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when clicking inside the modal content', () => {
      const onClose = vi.fn();
      render(<SavantModal {...makeProps({ onClose })} />);
      const modalContent = document.querySelector('.popup-modal');
      fireEvent.click(modalContent);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('different schools', () => {
    it('renders correctly for Conjuration school', () => {
      const props = makeProps({
        payload: {
          school: 'Conjuration',
          spellOptions: ['Summon Animals', 'Melf\'s Acid Arrow'],
          selectedSpells: [],
        },
      });
      render(<SavantModal {...props} />);
      expect(screen.getByText('Conjuration Savant')).toBeInTheDocument();
      expect(screen.getByText('Conjuration spell 1:')).toBeInTheDocument();
      expect(screen.getByText(/Choose two Wizard spells from the Conjuration school/)).toBeInTheDocument();
      expect(screen.getByTestId('conjuration-savant-modal')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('renders with empty spellOptions list', () => {
      const props = makeProps({
        payload: {
          ...basePayload,
          spellOptions: [],
        },
      });
      render(<SavantModal {...props} />);
      expect(screen.getByText('Evocation Savant')).toBeInTheDocument();
      const selects = document.querySelectorAll('select');
      expect(selects[0].options.length).toBe(1); // placeholder only
      expect(selects[1].options.length).toBe(1);
    });
  });
});
