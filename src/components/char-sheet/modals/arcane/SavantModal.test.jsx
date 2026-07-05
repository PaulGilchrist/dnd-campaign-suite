// @cleaned-by-ai
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
      expect(selects[0]).toHaveTextContent('-- Select a');
      expect(selects[1]).toHaveTextContent('-- Select a');
      spellOptions.forEach(spell => {
        const elements = screen.getAllByText(spell);
        expect(elements).toHaveLength(2);
      });
      expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Clear Selection' })).not.toBeInTheDocument();
    });

    it('renders labels for both spell selections', () => {
      render(<SavantModal {...makeProps()} />);
      expect(screen.getByText('Evocation spell 1:')).toBeInTheDocument();
      expect(screen.getByText('Evocation spell 2:')).toBeInTheDocument();
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
      expect(currentPara).toContainHTML('Sleep');
      expect(currentPara).toContainHTML('Web');
      expect(currentPara.textContent).toContain('and');
      const selects = document.querySelectorAll('select');
      expect(selects[0]).toHaveValue('Sleep');
      expect(selects[1]).toHaveValue('Web');
      expect(screen.getByRole('button', { name: 'Clear Selection' })).toBeInTheDocument();
    });

    it('renders without Current display when selectedSpells is undefined', () => {
      const props = makeProps({
        payload: {
          ...basePayload,
          selectedSpells: undefined,
        },
      });
      render(<SavantModal {...props} />);
      expect(screen.getByText('Evocation Savant')).toBeInTheDocument();
      expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
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
    `('Confirm $enabled when first="$first" and second="$second"', ({ first, second, enabled }) => {
      render(<SavantModal {...makeProps()} />);
      const selects = document.querySelectorAll('select');
      if (first) fireEvent.change(selects[0], { target: { value: first } });
      if (second) fireEvent.change(selects[1], { target: { value: second } });
      const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
      expect(confirmBtn).toHaveProperty('disabled', !enabled);
    });
  });

  describe('confirm', () => {
    it('calls onConfirm with the two selected spells', () => {
      const onConfirm = vi.fn();
      render(<SavantModal {...makeProps({ onConfirm })} />);
      const selects = document.querySelectorAll('select');
      fireEvent.change(selects[0], { target: { value: 'Sleep' } });
      fireEvent.change(selects[1], { target: { value: 'Web' } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
      expect(onConfirm).toHaveBeenCalledWith('Sleep', 'Web');
    });

    it('calls onConfirm with selected options in order', () => {
      const onConfirm = vi.fn();
      render(<SavantModal {...makeProps({ onConfirm })} />);
      const selects = document.querySelectorAll('select');
      fireEvent.change(selects[0], { target: { value: 'Burning Hands' } });
      fireEvent.change(selects[1], { target: { value: 'Charm Person' } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
      expect(onConfirm).toHaveBeenCalledWith('Burning Hands', 'Charm Person');
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
    });
  });
});
