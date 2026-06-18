// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DivinationSavantModal from './DivinationSavantModal.jsx';

// ── Test fixtures ──

const divinationSpells = [
  'Identify',
  'Nystul\'s Magic Aura',
  'Secret Page',
  'Detect Thoughts',
  'Comprehend Languages',
  'Augury',
  'Silent Image',
  'Minor Illusion',
];

const basePayload = {
  divinationOptions: divinationSpells,
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

describe('DivinationSavantModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render ──

  it('renders the modal overlay with the correct test id', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    expect(document.querySelector('[data-testid="divination-savant-modal"]')).toBeInTheDocument();
  });

  it('renders the modal title and description', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    expect(screen.getByText('Divination Savant')).toBeInTheDocument();
    expect(screen.getByText(/Choose two Wizard spells from the Divination school/)).toBeInTheDocument();
  });

  it('renders two spell select dropdowns with labels', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    expect(screen.getByText('Divination spell 1:')).toBeInTheDocument();
    expect(screen.getByText('Divination spell 2:')).toBeInTheDocument();
    expect(document.querySelectorAll('select')).toHaveLength(2);
  });

  it('populates each dropdown with all divination options and a default placeholder', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    selects.forEach((select) => {
      expect(select.querySelector('option[value=""]')).toHaveTextContent(
        '-- Select a Divination spell (level 2 or lower) --',
      );
      divinationSpells.forEach((spell) => {
        expect(select.querySelector(`option[value="${spell}"]`)).toBeInTheDocument();
      });
    });
  });

  it('renders Confirm Selection button', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeInTheDocument();
  });

  it('renders popup-overlay and popup-modal CSS classes', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
    expect(document.querySelector('.popup-modal')).toBeInTheDocument();
  });

  // ── Button disabled state ──

  it('disables the confirm button when no spells are selected', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('disables the confirm button when only one spell is selected', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Identify' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('disables the confirm button when both spells are identical', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Identify' } });
    fireEvent.change(selects[1], { target: { value: 'Identify' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('enables the confirm button when two different spells are selected', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Identify' } });
    fireEvent.change(selects[1], { target: { value: 'Augury' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeEnabled();
  });

  it('re-disables the confirm button when a selected spell reverts to empty', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Identify' } });
    fireEvent.change(selects[1], { target: { value: 'Augury' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeEnabled();
    fireEvent.change(selects[1], { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  // ── Pre-selected spells ──

  it('displays the current selection when spells are pre-selected', () => {
    render(
      <DivinationSavantModal
        {...makeProps({ payload: { ...basePayload, selectedSpells: ['Secret Page', 'Silent Image'] } })}
      />,
    );
    expect(screen.getByText(/Current:/)).toBeInTheDocument();
    expect(document.querySelector('.popup-modal b')).toHaveTextContent('Secret Page');
    expect(document.querySelectorAll('.popup-modal b')[1]).toHaveTextContent('Silent Image');
  });

  it('does not display current selection text when no spells are pre-selected', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
  });

  it('does not display current selection text when selectedSpells is undefined', () => {
    render(<DivinationSavantModal {...makeProps({ payload: { ...basePayload, selectedSpells: undefined } })} />);
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
  });

  it('initializes both dropdowns with pre-selected values', () => {
    render(
      <DivinationSavantModal
        {...makeProps({ payload: { ...basePayload, selectedSpells: ['Secret Page', 'Silent Image'] } })}
      />,
    );
    const selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('Secret Page');
    expect(selects[1].value).toBe('Silent Image');
  });

  it('initializes both dropdowns with empty values when no pre-selected spells', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('');
  });

  it('initializes both dropdowns with empty values when selectedSpells is undefined', () => {
    render(<DivinationSavantModal {...makeProps({ payload: { ...basePayload, selectedSpells: undefined } })} />);
    const selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('');
  });

  // ── Spell selection changes ──

  it('updates the confirm button state when the first spell changes', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    const btn = screen.getByRole('button', { name: 'Confirm Selection' });
    fireEvent.change(selects[0], { target: { value: 'Identify' } });
    expect(btn).toBeDisabled();
    fireEvent.change(selects[1], { target: { value: 'Augury' } });
    expect(btn).toBeEnabled();
  });

  it('updates the confirm button state when the second spell changes', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    const btn = screen.getByRole('button', { name: 'Confirm Selection' });
    fireEvent.change(selects[1], { target: { value: 'Augury' } });
    expect(btn).toBeDisabled();
    fireEvent.change(selects[0], { target: { value: 'Identify' } });
    expect(btn).toBeEnabled();
  });

  it('allows re-selecting a different spell after an initial selection', () => {
    const onConfirm = vi.fn();
    render(<DivinationSavantModal {...makeProps({ onConfirm })} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Identify' } });
    fireEvent.change(selects[0], { target: { value: 'Augury' } });
    fireEvent.change(selects[1], { target: { value: 'Secret Page' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledWith('Augury', 'Secret Page');
  });

  // ── Confirm interaction ──

  it('calls onConfirm with both selected spells when confirm is clicked', () => {
    const onConfirm = vi.fn();
    render(<DivinationSavantModal {...makeProps({ onConfirm })} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Identify' } });
    fireEvent.change(selects[1], { target: { value: 'Augury' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledWith('Identify', 'Augury');
  });

  it('calls onConfirm with pre-selected values when confirm is clicked without changes', () => {
    const onConfirm = vi.fn();
    render(
      <DivinationSavantModal
        {...makeProps({ payload: { ...basePayload, selectedSpells: ['Augury', 'Secret Page'] }, onConfirm })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledWith('Augury', 'Secret Page');
  });

  it('does not call onConfirm when confirm is clicked but is disabled', () => {
    const onConfirm = vi.fn();
    render(<DivinationSavantModal {...makeProps({ onConfirm })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<DivinationSavantModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.popup-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<DivinationSavantModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.popup-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Edge cases ──

  it('renders selects with only the default option when divinationOptions is empty', () => {
    render(<DivinationSavantModal {...makeProps({ payload: { ...basePayload, divinationOptions: [] } })} />);
    const selects = document.querySelectorAll('select');
    expect(selects).toHaveLength(2);
    selects.forEach((select) => {
      expect(select.querySelectorAll('option')).toHaveLength(1);
      expect(select.querySelector('option')).toHaveTextContent(
        '-- Select a Divination spell (level 2 or lower) --',
      );
    });
  });

  it('disables confirm when divinationOptions is empty', () => {
    render(<DivinationSavantModal {...makeProps({ payload: { ...basePayload, divinationOptions: [] } })} />);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('uses internal state for unknown pre-selected spells so confirm remains enabled', () => {
    const onConfirm = vi.fn();
    render(
      <DivinationSavantModal
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
