import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import IllusionSavantModal from './IllusionSavantModal.jsx';

// ── Test fixtures ──

const illusionOptions = [
  'Disguise Self',
  'Silent Image',
  'Mirror Image',
  'Phantasmal Force',
];

const basePayload = {
  illusionOptions,
  selectedSpells: [],
};

const baseProps = {
  payload: basePayload,
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('IllusionSavantModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render / display ──

  it('renders modal overlay with test id', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    expect(document.querySelector('[data-testid="illusion-savant-modal"]')).toBeInTheDocument();
  });

  it('renders modal title "Illusion Savant"', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    expect(screen.getByText('Illusion Savant')).toBeInTheDocument();
  });

  it('renders description paragraph about the feature', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    expect(screen.getByText(/Choose two Wizard spells from the Illusion school/)).toBeInTheDocument();
  });

  it('renders two spell select dropdowns', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    expect(selects).toHaveLength(2);
  });

  it('renders label for first spell selection', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    expect(screen.getByText('Illusion spell 1:')).toBeInTheDocument();
  });

  it('renders label for second spell selection', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    expect(screen.getByText('Illusion spell 2:')).toBeInTheDocument();
  });

  it('renders Confirm button', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeInTheDocument();
  });

  it('renders default option text in selects', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    const firstOptions = selects[0].querySelectorAll('option');
    expect(firstOptions[0]).toHaveTextContent('-- Select an Illusion spell (level 2 or lower) --');
  });

  it('renders all illusion options in first select', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    const firstOptions = selects[0].querySelectorAll('option');
    illusionOptions.forEach((spell, i) => {
      expect(firstOptions[i + 1]).toHaveTextContent(spell);
    });
  });

  it('renders all illusion options in second select', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    const secondOptions = selects[1].querySelectorAll('option');
    illusionOptions.forEach((spell, i) => {
      expect(secondOptions[i + 1]).toHaveTextContent(spell);
    });
  });

  it('is disabled when no spells selected', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  // ── Pre-selected spells display ──

  it('shows current selection when spells are pre-selected', () => {
    render(<IllusionSavantModal {...makeProps({ payload: { ...basePayload, selectedSpells: ['Disguise Self', 'Silent Image'] } })} />);
    expect(screen.getByText(/Current:/)).toBeInTheDocument();
    expect(document.querySelector('.popup-modal b')).toHaveTextContent('Disguise Self');
    expect(document.querySelectorAll('.popup-modal b')[1]).toHaveTextContent('Silent Image');
  });

  it('does not show current selection when no spells pre-selected', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
  });

  // ── Spell selection ──

  it('selects a spell from first dropdown', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    const firstSelect = document.querySelectorAll('select')[0];
    fireEvent.change(firstSelect, { target: { value: 'Disguise Self' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('selects a spell from second dropdown', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    const secondSelect = document.querySelectorAll('select')[1];
    fireEvent.change(secondSelect, { target: { value: 'Mirror Image' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('enables confirm when both spells are selected', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Disguise Self' } });
    fireEvent.change(selects[1], { target: { value: 'Silent Image' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeEnabled();
  });

  it('disables confirm when spells are the same', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Disguise Self' } });
    fireEvent.change(selects[1], { target: { value: 'Disguise Self' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('disables confirm when second spell reverts to default', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Disguise Self' } });
    fireEvent.change(selects[1], { target: { value: 'Silent Image' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeEnabled();
    fireEvent.change(selects[1], { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  // ── Confirm interaction ──

  it('calls onConfirm with selected spells when confirm is clicked', () => {
    const onConfirm = vi.fn();
    render(<IllusionSavantModal {...makeProps({ onConfirm })} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Phantasmal Force' } });
    fireEvent.change(selects[1], { target: { value: 'Mirror Image' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledWith('Phantasmal Force', 'Mirror Image');
  });

  it('calls onConfirm with empty first spell when second has a value', () => {
    const onConfirm = vi.fn();
    render(<IllusionSavantModal {...makeProps({ onConfirm })} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Disguise Self' } });
    fireEvent.change(selects[1], { target: { value: 'Silent Image' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledWith('Disguise Self', 'Silent Image');
  });

  // ── Pre-selected spells state ──

  it('initializes first select with pre-selected value', () => {
    render(<IllusionSavantModal {...makeProps({ payload: { ...basePayload, selectedSpells: ['Disguise Self', 'Silent Image'] } })} />);
    const selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('Disguise Self');
  });

  it('initializes second select with pre-selected value', () => {
    render(<IllusionSavantModal {...makeProps({ payload: { ...basePayload, selectedSpells: ['Disguise Self', 'Silent Image'] } })} />);
    const selects = document.querySelectorAll('select');
    expect(selects[1].value).toBe('Silent Image');
  });

  it('initializes selects with empty strings when no pre-selected spells', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('');
  });

  it('initializes selects with empty strings when selectedSpells is undefined', () => {
    render(<IllusionSavantModal {...makeProps({ payload: { ...basePayload, selectedSpells: undefined } })} />);
    const selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('');
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<IllusionSavantModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.popup-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<IllusionSavantModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.popup-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Modal CSS classes ──

  it('renders with popup-overlay class', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
  });

  it('renders with popup-modal class', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    expect(document.querySelector('.popup-modal')).toBeInTheDocument();
  });

  // ── Changing selection after confirm ──

  it('updates first spell selection after changing', () => {
    const onConfirm = vi.fn();
    render(<IllusionSavantModal {...makeProps({ onConfirm })} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Disguise Self' } });
    fireEvent.change(selects[0], { target: { value: 'Silent Image' } });
    fireEvent.change(selects[1], { target: { value: 'Mirror Image' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledWith('Silent Image', 'Mirror Image');
  });

  it('disables confirm when second spell changed to match first', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Disguise Self' } });
    fireEvent.change(selects[1], { target: { value: 'Disguise Self' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  // ── Empty illusion options ──

  it('renders selects with only default option when no illusion options', () => {
    render(<IllusionSavantModal {...makeProps({ payload: { illusionOptions: [], selectedSpells: [] } })} />);
    const selects = document.querySelectorAll('select');
    expect(selects).toHaveLength(2);
  });

  it('shows confirm disabled when no options available', () => {
    render(<IllusionSavantModal {...makeProps({ payload: { illusionOptions: [], selectedSpells: [] } })} />);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });
});
