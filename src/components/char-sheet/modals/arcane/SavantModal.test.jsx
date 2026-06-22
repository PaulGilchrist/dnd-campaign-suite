// @improved-by-ai
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
  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders the modal overlay with the school name', () => {
      render(<SavantModal {...makeProps()} />);
      expect(screen.getByText('Evocation Savant')).toBeInTheDocument();
    });

    it('renders the modal with proper test id', () => {
      const { container } = render(<SavantModal {...makeProps()} />);
      expect(container.querySelector('[data-testid="evocation-savant-modal"]')).toBeInTheDocument();
    });

    it('renders the description text', () => {
      render(<SavantModal {...makeProps()} />);
      expect(screen.getByText(/Choose two Wizard spells from the Evocation school/)).toBeInTheDocument();
    });

    it('renders two spell selection dropdowns', () => {
      render(<SavantModal {...makeProps()} />);
      const selects = document.querySelectorAll('select');
      expect(selects).toHaveLength(2);
    });

    it('renders labels for both spell selections', () => {
      render(<SavantModal {...makeProps()} />);
      expect(screen.getByText('Evocation spell 1:')).toBeInTheDocument();
      expect(screen.getByText('Evocation spell 2:')).toBeInTheDocument();
    });

    it('renders the Confirm button', () => {
      render(<SavantModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeInTheDocument();
    });

    it('has the Confirm button disabled when no selections are made', () => {
      render(<SavantModal {...makeProps()} />);
      const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
      expect(confirmBtn).toBeDisabled();
    });

    it('renders empty option placeholders in both selects', () => {
      render(<SavantModal {...makeProps()} />);
      const selects = document.querySelectorAll('select');
      expect(selects[0]).toHaveTextContent('-- Select a');
      expect(selects[1]).toHaveTextContent('-- Select a');
    });

    it('renders all spell options in both dropdowns', () => {
      render(<SavantModal {...makeProps()} />);
      spellOptions.forEach(spell => {
        const elements = screen.getAllByText(spell);
        expect(elements).toHaveLength(2);
      });
    });

    it('does not show Clear Selection button when no existing selections', () => {
      render(<SavantModal {...makeProps()} />);
      expect(screen.queryByRole('button', { name: 'Clear Selection' })).not.toBeInTheDocument();
    });
  });

  // ── Existing selections display ──

  describe('existing selections', () => {
    it('shows current selections when provided', () => {
      const props = makeProps({
        payload: {
          ...basePayload,
          selectedSpells: ['Sleep', 'Fire Bolt'],
        },
      });
      render(<SavantModal {...props} />);
      const currentPara = screen.getByText(/Current:/).closest('p');
      expect(currentPara).toContainHTML('Sleep');
      expect(currentPara).toContainHTML('Fire Bolt');
    });

    it('shows "and" between the two current spell names', () => {
      const props = makeProps({
        payload: {
          ...basePayload,
          selectedSpells: ['Sleep', 'Fire Bolt'],
        },
      });
      render(<SavantModal {...props} />);
      const currentPara = screen.getByText(/Current:/).closest('p');
      expect(currentPara.textContent).toContain('and');
    });

    it('shows Clear Selection button when existing selections exist', () => {
      const props = makeProps({
        payload: {
          ...basePayload,
          selectedSpells: ['Sleep', 'Fire Bolt'],
        },
      });
      render(<SavantModal {...props} />);
      expect(screen.getByRole('button', { name: 'Clear Selection' })).toBeInTheDocument();
    });

    it('pre-selects existing spells in the dropdowns', () => {
      const props = makeProps({
        payload: {
          ...basePayload,
          selectedSpells: ['Sleep', 'Web'],
        },
      });
      render(<SavantModal {...props} />);
      const selects = document.querySelectorAll('select');
      expect(selects[0]).toHaveValue('Sleep');
      expect(selects[1]).toHaveValue('Web');
    });
  });

  // ── Selection behavior ──

  describe('selection behavior', () => {
    it('enables Confirm when two different spells are selected', () => {
      render(<SavantModal {...makeProps()} />);
      const selects = document.querySelectorAll('select');
      fireEvent.change(selects[0], { target: { value: 'Sleep' } });
      fireEvent.change(selects[1], { target: { value: 'Web' } });
      const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
      expect(confirmBtn).toBeEnabled();
    });

    it('keeps Confirm disabled when both selections are the same spell', () => {
      render(<SavantModal {...makeProps()} />);
      const selects = document.querySelectorAll('select');
      fireEvent.change(selects[0], { target: { value: 'Sleep' } });
      fireEvent.change(selects[1], { target: { value: 'Sleep' } });
      const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
      expect(confirmBtn).toBeDisabled();
    });

    it('keeps Confirm disabled when only first spell is selected', () => {
      render(<SavantModal {...makeProps()} />);
      const selects = document.querySelectorAll('select');
      fireEvent.change(selects[0], { target: { value: 'Sleep' } });
      const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
      expect(confirmBtn).toBeDisabled();
    });

    it('keeps Confirm disabled when only second spell is selected', () => {
      render(<SavantModal {...makeProps()} />);
      const selects = document.querySelectorAll('select');
      fireEvent.change(selects[1], { target: { value: 'Web' } });
      const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
      expect(confirmBtn).toBeDisabled();
    });

    it('disables Confirm when first spell is cleared after selection', () => {
      render(<SavantModal {...makeProps()} />);
      const selects = document.querySelectorAll('select');
      fireEvent.change(selects[0], { target: { value: 'Sleep' } });
      fireEvent.change(selects[1], { target: { value: 'Web' } });
      fireEvent.change(selects[0], { target: { value: '' } });
      const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
      expect(confirmBtn).toBeDisabled();
    });

    it('disables Confirm when second spell is cleared after selection', () => {
      render(<SavantModal {...makeProps()} />);
      const selects = document.querySelectorAll('select');
      fireEvent.change(selects[0], { target: { value: 'Sleep' } });
      fireEvent.change(selects[1], { target: { value: 'Web' } });
      fireEvent.change(selects[1], { target: { value: '' } });
      const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
      expect(confirmBtn).toBeDisabled();
    });
  });

  // ── Confirm button ──

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

  // ── Clear Selection button ──

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

  // ── Overlay interaction ──

  describe('overlay interaction', () => {
    it('calls onClose when clicking the overlay background', () => {
      const onClose = vi.fn();
      render(<SavantModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.popup-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the modal content', () => {
      const onClose = vi.fn();
      render(<SavantModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.popup-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Different schools ──

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

    it('renders correctly for Transmutation school', () => {
      const props = makeProps({
        payload: {
          school: 'Transmutation',
          spellOptions: ['Acid Splash', 'Shillelagh'],
          selectedSpells: [],
        },
      });
      render(<SavantModal {...props} />);
      expect(screen.getByText('Transmutation Savant')).toBeInTheDocument();
      expect(screen.getByText('Transmutation spell 1:')).toBeInTheDocument();
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('renders with undefined selectedSpells', () => {
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

    it('renders with empty selectedSpells array', () => {
      const props = makeProps({
        payload: {
          ...basePayload,
          selectedSpells: [],
        },
      });
      render(<SavantModal {...props} />);
      expect(screen.getByText('Evocation Savant')).toBeInTheDocument();
      expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
    });

    it('renders with empty spellOptions array', () => {
      const props = makeProps({
        payload: {
          ...basePayload,
          spellOptions: [],
        },
      });
      render(<SavantModal {...props} />);
      expect(screen.getByText('Evocation Savant')).toBeInTheDocument();
      const selects = document.querySelectorAll('select');
      // Should only have the default option, no spell options
      expect(selects[0]).not.toHaveTextContent('Burning Hands');
    });
  });
});
