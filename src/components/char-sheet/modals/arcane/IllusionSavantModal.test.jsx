// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import IllusionSavantModal from './IllusionSavantModal.jsx';

// ── Test fixtures ──

const illusionSpells = [
  'Disguise Self',
  'Silent Image',
  'Mirror Image',
  'Phantasmal Force',
];

const basePayload = {
  illusionOptions: illusionSpells,
  selectedSpells: [],
};

function makeProps(overrides) {
  return {
    payload: { ...basePayload, ...(overrides?.payload || {}) },
    onConfirm: overrides?.onConfirm ?? vi.fn(),
    onClose: overrides?.onClose ?? vi.fn(),
  };
}

// ── Tests ──

describe('IllusionSavantModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render ──

  it('renders the modal overlay with the correct test id', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    expect(document.querySelector('[data-testid="illusion-savant-modal"]')).toBeInTheDocument();
  });

  it('renders the modal title and description', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    expect(screen.getByText('Illusion Savant')).toBeInTheDocument();
    expect(screen.getByText(/Choose two Wizard spells from the Illusion school/)).toBeInTheDocument();
  });

  it('renders two spell select dropdowns with labels', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    expect(screen.getByText('Illusion spell 1:')).toBeInTheDocument();
    expect(screen.getByText('Illusion spell 2:')).toBeInTheDocument();
    expect(document.querySelectorAll('select')).toHaveLength(2);
  });

  it('populates each dropdown with all illusion options and a default placeholder', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    selects.forEach((select) => {
      expect(select.querySelector('option[value=""]')).toHaveTextContent(
        '-- Select an Illusion spell (level 2 or lower) --',
      );
      illusionSpells.forEach((spell) => {
        expect(select.querySelector(`option[value="${spell}"]`)).toBeInTheDocument();
      });
    });
  });

  it('renders Confirm Selection button', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeInTheDocument();
  });

  it('renders popup-overlay and popup-modal CSS classes', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
    expect(document.querySelector('.popup-modal')).toBeInTheDocument();
  });

  // ── Button disabled state ──

  it('disables the confirm button when no spells are selected', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('disables the confirm button when only one spell is selected', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Disguise Self' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('disables the confirm button when both spells are identical', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Disguise Self' } });
    fireEvent.change(selects[1], { target: { value: 'Disguise Self' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('enables the confirm button when two different spells are selected', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Disguise Self' } });
    fireEvent.change(selects[1], { target: { value: 'Silent Image' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeEnabled();
  });

  it('re-disables the confirm button when a selected spell reverts to empty', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Disguise Self' } });
    fireEvent.change(selects[1], { target: { value: 'Silent Image' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeEnabled();
    fireEvent.change(selects[1], { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  // ── Pre-selected spells ──

  it('displays the current selection when spells are pre-selected', () => {
    render(
      <IllusionSavantModal
        {...makeProps({ payload: { ...basePayload, selectedSpells: ['Disguise Self', 'Silent Image'] } })}
      />,
    );
    expect(screen.getByText(/Current:/)).toBeInTheDocument();
    expect(document.querySelector('.popup-modal b')).toHaveTextContent('Disguise Self');
    expect(document.querySelectorAll('.popup-modal b')[1]).toHaveTextContent('Silent Image');
  });

  it('does not display current selection text when no spells are pre-selected', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
  });

  it('does not display current selection text when selectedSpells is undefined', () => {
    render(<IllusionSavantModal {...makeProps({ payload: { ...basePayload, selectedSpells: undefined } })} />);
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
  });

  it('initializes both dropdowns with pre-selected values', () => {
    render(
      <IllusionSavantModal
        {...makeProps({ payload: { ...basePayload, selectedSpells: ['Disguise Self', 'Silent Image'] } })}
      />,
    );
    const selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('Disguise Self');
    expect(selects[1].value).toBe('Silent Image');
  });

  it('initializes both dropdowns with empty values when no pre-selected spells', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('');
  });

  it('initializes both dropdowns with empty values when selectedSpells is undefined', () => {
    render(<IllusionSavantModal {...makeProps({ payload: { ...basePayload, selectedSpells: undefined } })} />);
    const selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('');
  });

  // ── Spell selection changes ──

  it('updates the confirm button state when the first spell changes', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    const btn = screen.getByRole('button', { name: 'Confirm Selection' });
    fireEvent.change(selects[0], { target: { value: 'Disguise Self' } });
    expect(btn).toBeDisabled();
    fireEvent.change(selects[1], { target: { value: 'Silent Image' } });
    expect(btn).toBeEnabled();
  });

  it('updates the confirm button state when the second spell changes', () => {
    render(<IllusionSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    const btn = screen.getByRole('button', { name: 'Confirm Selection' });
    fireEvent.change(selects[1], { target: { value: 'Silent Image' } });
    expect(btn).toBeDisabled();
    fireEvent.change(selects[0], { target: { value: 'Disguise Self' } });
    expect(btn).toBeEnabled();
  });

  it('allows re-selecting a different spell after an initial selection', () => {
    const onConfirm = vi.fn();
    render(<IllusionSavantModal {...makeProps({ onConfirm })} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Disguise Self' } });
    fireEvent.change(selects[0], { target: { value: 'Silent Image' } });
    fireEvent.change(selects[1], { target: { value: 'Mirror Image' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledWith('Silent Image', 'Mirror Image');
  });

  // ── Confirm interaction ──

  it('calls onConfirm with both selected spells when confirm is clicked', () => {
    const onConfirm = vi.fn();
    render(<IllusionSavantModal {...makeProps({ onConfirm })} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Phantasmal Force' } });
    fireEvent.change(selects[1], { target: { value: 'Mirror Image' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledWith('Phantasmal Force', 'Mirror Image');
  });

  it('calls onConfirm with pre-selected values when confirm is clicked without changes', () => {
    const onConfirm = vi.fn();
    render(
      <IllusionSavantModal
        {...makeProps({ payload: { ...basePayload, selectedSpells: ['Silent Image', 'Mirror Image'] }, onConfirm })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledWith('Silent Image', 'Mirror Image');
  });

  it('does not call onConfirm when confirm is clicked but is disabled', () => {
    const onConfirm = vi.fn();
    render(<IllusionSavantModal {...makeProps({ onConfirm })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<IllusionSavantModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.popup-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<IllusionSavantModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.popup-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Edge cases ──

  it('renders selects with only the default option when illusionOptions is empty', () => {
    render(<IllusionSavantModal {...makeProps({ payload: { ...basePayload, illusionOptions: [] } })} />);
    const selects = document.querySelectorAll('select');
    expect(selects).toHaveLength(2);
    selects.forEach((select) => {
      expect(select.querySelectorAll('option')).toHaveLength(1);
      expect(select.querySelector('option')).toHaveTextContent(
        '-- Select an Illusion spell (level 2 or lower) --',
      );
    });
  });

  it('disables confirm when illusionOptions is empty', () => {
    render(<IllusionSavantModal {...makeProps({ payload: { ...basePayload, illusionOptions: [] } })} />);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('uses internal state for unknown pre-selected spells so confirm remains enabled', () => {
    const onConfirm = vi.fn();
    render(
      <IllusionSavantModal
        {...makeProps({ payload: { ...basePayload, selectedSpells: ['Unknown Spell', 'Another Unknown'] }, onConfirm })}
      />,
    );
    const selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('');
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledWith('Unknown Spell', 'Another Unknown');
  });
});
