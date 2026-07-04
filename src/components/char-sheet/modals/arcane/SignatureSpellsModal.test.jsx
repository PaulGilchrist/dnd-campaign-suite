// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SignatureSpellsModal from './SignatureSpellsModal.jsx';

// ── Test fixtures ──

const level3Options = [
  'Armor of Agathys',
  'Bane',
  'Burning Hands',
  'Crown of Madness',
  'Disguise Self',
  'Dissonant Whispers',
  'Ensnaring Strike',
  'Fear',
  'Feather Fall',
  'Hellish Rebuke',
  'Hidden Speech',
  'Hypnotic Pattern',
  'Illusory Demand',
  'Magic Missile',
  'Melfs Acid Arrow',
  'Misty Step',
  'Phantasmal Force',
  'Protection from Energy',
  'Ray of Enfeeblement',
  'Shield',
  'Silent Image',
  'Sleep',
  'Spike Growth',
  'Tasha Caustic Brew',
  'Tongues',
  'Web',
];

const baseProps = {
  payload: { level3Options, selectedSpells: [] },
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

describe('SignatureSpellsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render ──

  it('renders the modal overlay with the correct test id', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    expect(document.querySelector('[data-testid="signature-spells-modal"]')).toBeInTheDocument();
  });

  it('renders the modal title and description', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    expect(screen.getByText('Signature Spells')).toBeInTheDocument();
    expect(screen.getByText(/Choose two level 3 spells in your spellbook/)).toBeInTheDocument();
  });

  it('renders two spell select dropdowns with labels', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    expect(screen.getByText('Signature spell 1:')).toBeInTheDocument();
    expect(screen.getByText('Signature spell 2:')).toBeInTheDocument();
    expect(document.querySelectorAll('select')).toHaveLength(2);
  });

  it('populates each dropdown with all level 3 options and a default placeholder', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    selects.forEach((select) => {
      expect(select.querySelector('option[value=""]')).toHaveTextContent(
        '-- Select a level 3 spell --',
      );
      level3Options.forEach((spell) => {
        expect(select.querySelector(`option[value="${spell}"]`)).toBeInTheDocument();
      });
    });
  });

  it('renders Confirm Selection button', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeInTheDocument();
  });

  it('renders popup-overlay and popup-modal CSS classes', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
    expect(document.querySelector('.popup-modal')).toBeInTheDocument();
  });

  it('renders selects with char-btn class', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    selects.forEach((select) => {
      expect(select).toHaveClass('char-btn');
    });
  });

  it('renders confirm button with char-btn class', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toHaveClass('char-btn');
  });

  // ── Button disabled state ──

  it('disables the confirm button when no spells are selected', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('disables the confirm button when only the first spell is selected', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Shield' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('disables the confirm button when only the second spell is selected', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[1], { target: { value: 'Magic Missile' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('disables the confirm button when both spells are identical', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Shield' } });
    fireEvent.change(selects[1], { target: { value: 'Shield' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('enables the confirm button when two different spells are selected', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Shield' } });
    fireEvent.change(selects[1], { target: { value: 'Magic Missile' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeEnabled();
  });

  it('re-disables the confirm button when a selected spell reverts to empty', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    const btn = screen.getByRole('button', { name: 'Confirm Selection' });
    fireEvent.change(selects[0], { target: { value: 'Shield' } });
    fireEvent.change(selects[1], { target: { value: 'Magic Missile' } });
    expect(btn).toBeEnabled();
    fireEvent.change(selects[1], { target: { value: '' } });
    expect(btn).toBeDisabled();
  });

  // ── Pre-selected spells ──

  it('displays the current selection when spells are pre-selected', () => {
    render(
      <SignatureSpellsModal {...makeProps({ payload: { selectedSpells: ['Shield', 'Magic Missile'] } })} />,
    );
    expect(screen.getByText(/Current:/)).toBeInTheDocument();
    expect(document.querySelector('.popup-modal b')).toHaveTextContent('Shield');
    expect(document.querySelectorAll('.popup-modal b')[1]).toHaveTextContent('Magic Missile');
  });

  it('does not display current selection text when no spells are pre-selected', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
  });

  it('does not display current selection text when selectedSpells is undefined', () => {
    render(<SignatureSpellsModal {...makeProps({ payload: { selectedSpells: undefined } })} />);
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
  });

  it('does not display current selection text when selectedSpells is null', () => {
    render(<SignatureSpellsModal {...makeProps({ payload: { selectedSpells: null } })} />);
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
  });

  it('initializes both dropdowns with pre-selected values', () => {
    render(
      <SignatureSpellsModal {...makeProps({ payload: { selectedSpells: ['Shield', 'Magic Missile'] } })} />,
    );
    const selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('Shield');
    expect(selects[1].value).toBe('Magic Missile');
  });

  it('initializes both dropdowns with empty values when no pre-selected spells', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('');
  });

  it('initializes both dropdowns with empty values when selectedSpells is undefined', () => {
    render(<SignatureSpellsModal {...makeProps({ payload: { selectedSpells: undefined } })} />);
    const selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('');
  });

  it('initializes both dropdowns with empty values when selectedSpells is null', () => {
    render(<SignatureSpellsModal {...makeProps({ payload: { selectedSpells: null } })} />);
    const selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('');
  });

  it('initializes dropdowns with empty values when selectedSpells has fewer than 2 entries', () => {
    render(<SignatureSpellsModal {...makeProps({ payload: { selectedSpells: ['Shield'] } })} />);
    const selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('Shield');
    expect(selects[1].value).toBe('');
  });

  // ── Spell selection changes ──

  it('updates the confirm button state when the first spell changes', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    const btn = screen.getByRole('button', { name: 'Confirm Selection' });
    fireEvent.change(selects[0], { target: { value: 'Shield' } });
    expect(btn).toBeDisabled();
    fireEvent.change(selects[1], { target: { value: 'Magic Missile' } });
    expect(btn).toBeEnabled();
  });

  it('updates the confirm button state when the second spell changes', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    const btn = screen.getByRole('button', { name: 'Confirm Selection' });
    fireEvent.change(selects[1], { target: { value: 'Magic Missile' } });
    expect(btn).toBeDisabled();
    fireEvent.change(selects[0], { target: { value: 'Shield' } });
    expect(btn).toBeEnabled();
  });

  it('allows re-selecting a different spell after an initial selection', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Shield' } });
    fireEvent.change(selects[0], { target: { value: 'Magic Missile' } });
    fireEvent.change(selects[1], { target: { value: 'Bane' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeEnabled();
  });

  // ── Confirm interaction ──

  it('calls onConfirm with both selected spells when confirm is clicked', () => {
    const onConfirm = vi.fn();
    render(<SignatureSpellsModal {...makeProps({ onConfirm })} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Shield' } });
    fireEvent.change(selects[1], { target: { value: 'Magic Missile' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledWith('Shield', 'Magic Missile');
  });

  it('calls onConfirm with pre-selected values when confirm is clicked without changes', () => {
    const onConfirm = vi.fn();
    render(
      <SignatureSpellsModal {...makeProps({ payload: { selectedSpells: ['Bane', 'Hellish Rebuke'] }, onConfirm })} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledWith('Bane', 'Hellish Rebuke');
  });

  it('does not call onConfirm when confirm is clicked but is disabled', () => {
    const onConfirm = vi.fn();
    render(<SignatureSpellsModal {...makeProps({ onConfirm })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // ── Edge cases ──

  it('renders selects with only the default option when level3Options is empty', () => {
    render(<SignatureSpellsModal {...makeProps({ payload: { level3Options: [] } })} />);
    const selects = document.querySelectorAll('select');
    expect(selects).toHaveLength(2);
    selects.forEach((select) => {
      expect(select.querySelectorAll('option')).toHaveLength(1);
      expect(select.querySelector('option')).toHaveTextContent('-- Select a level 3 spell --');
    });
  });

  it('disables confirm when level3Options is empty', () => {
    render(<SignatureSpellsModal {...makeProps({ payload: { level3Options: [] } })} />);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('uses internal state for unknown pre-selected spells so confirm remains enabled', () => {
    const onConfirm = vi.fn();
    render(
      <SignatureSpellsModal
        {...makeProps({ payload: { selectedSpells: ['Unknown Spell', 'Another Unknown'] }, onConfirm })}
      />,
    );
    const selects = document.querySelectorAll('select');
    // Unknown spells don't exist as options, so the select value reverts to empty
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('');
    // But internal state still holds them, so confirm is enabled
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledWith('Unknown Spell', 'Another Unknown');
  });

  it('handles selectedSpells with null entries', () => {
    render(<SignatureSpellsModal {...makeProps({ payload: { selectedSpells: [null, 'Shield'] } })} />);
    const selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('Shield');
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });
});
