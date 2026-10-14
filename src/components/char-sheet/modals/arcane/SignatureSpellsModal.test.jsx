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

function makeProps(overrides = {}) {
  const { payload: overridePayload, ...overrideCallbacks } = overrides;
  return {
    payload: {
      level3Options: level3Options,
      selectedSpells: [],
      ...overridePayload,
    },
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

  it('renders the modal overlay with title, description, and two spell dropdowns', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    expect(document.querySelector('[data-testid="signature-spells-modal"]')).toBeInTheDocument();
    expect(screen.getByText('Signature Spells')).toBeInTheDocument();
    expect(screen.getByText(/Choose two level 3 spells in your spellbook/)).toBeInTheDocument();
    expect(screen.getByText('Signature spell 1:')).toBeInTheDocument();
    expect(screen.getByText('Signature spell 2:')).toBeInTheDocument();
    expect(document.querySelectorAll('select')).toHaveLength(2);
  });

  it('populates each dropdown with all level 3 options and a default placeholder', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    expect(selects).toHaveLength(2);
    selects.forEach((select) => {
      expect(select.querySelector('option[value=""]')).toHaveTextContent('-- Select a level 3 spell --');
      level3Options.forEach((spell) => {
        expect(select.querySelector(`option[value="${spell}"]`)).toBeInTheDocument();
      });
    });
  });

  // ── Button disabled state ──

  it('disables the confirm button when no spells are selected', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('disables the confirm button when only one spell is selected', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Shield' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
    fireEvent.change(selects[1], { target: { value: 'Magic Missile' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeEnabled();
    // Reverting either spell disables again
    fireEvent.change(selects[1], { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('disables the confirm button when both spells are identical', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Shield' } });
    fireEvent.change(selects[1], { target: { value: 'Shield' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  // ── Pre-selected spells ──

  it('displays and initializes dropdowns with pre-selected spells', () => {
    render(
      <SignatureSpellsModal {...makeProps({ payload: { selectedSpells: ['Shield', 'Magic Missile'] } })} />,
    );
    expect(screen.getByText(/Current:/)).toBeInTheDocument();
    expect(document.querySelector('.popup-modal b')).toHaveTextContent('Shield');
    expect(document.querySelectorAll('.popup-modal b')[1]).toHaveTextContent('Magic Missile');
    const selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('Shield');
    expect(selects[1].value).toBe('Magic Missile');
  });

  it('does not display current selection when selectedSpells is empty, undefined, or null', () => {
    // empty array
    render(<SignatureSpellsModal {...makeProps({ payload: { selectedSpells: [] } })} />);
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
    let selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('');

    // undefined
    render(<SignatureSpellsModal {...makeProps({ payload: { selectedSpells: undefined } })} />);
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
    selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('');

    // null
    render(<SignatureSpellsModal {...makeProps({ payload: { selectedSpells: null } })} />);
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
    selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('');
  });

  it('handles partial pre-selected spells (fewer than 2)', () => {
    render(<SignatureSpellsModal {...makeProps({ payload: { selectedSpells: ['Shield'] } })} />);
    const selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('Shield');
    expect(selects[1].value).toBe('');
  });

  it('handles null entries in selectedSpells array', () => {
    render(<SignatureSpellsModal {...makeProps({ payload: { selectedSpells: [null, 'Shield'] } })} />);
    const selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('Shield');
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  // ── Clear Selection button ──

  it('shows a Clear Selection button when there are pre-selected spells', () => {
    render(
      <SignatureSpellsModal {...makeProps({ payload: { selectedSpells: ['Shield', 'Magic Missile'] } })} />,
    );
    expect(screen.getByRole('button', { name: 'Clear Selection' })).toBeInTheDocument();
  });

  it('does not show a Clear Selection button when no spells are pre-selected', () => {
    render(<SignatureSpellsModal {...makeProps()} />);
    expect(screen.queryByRole('button', { name: 'Clear Selection' })).not.toBeInTheDocument();
  });

  it('calls onConfirm with null,null when Clear Selection is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <SignatureSpellsModal {...makeProps({ payload: { selectedSpells: ['Shield', 'Magic Missile'] }, onConfirm })} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));
    expect(onConfirm).toHaveBeenCalledWith(null, null);
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

  // ── Overlay interaction ──

  it('calls onClose when the overlay background is clicked', () => {
    const onClose = vi.fn();
    render(<SignatureSpellsModal {...makeProps({ onClose })} />);
    const overlay = document.querySelector('.popup-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when the inner modal is clicked', () => {
    const onClose = vi.fn();
    render(<SignatureSpellsModal {...makeProps({ onClose })} />);
    const innerModal = document.querySelector('.popup-modal');
    fireEvent.click(innerModal);
    expect(onClose).not.toHaveBeenCalled();
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

  it('calls onConfirm with null,null on Clear Selection without re-rendering the component', () => {
    const onConfirm = vi.fn();
    render(
      <SignatureSpellsModal {...makeProps({ payload: { selectedSpells: ['Shield', 'Magic Missile'] }, onConfirm })} />,
    );
    // Clear the selection — onConfirm is called but component does not re-render
    fireEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));
    expect(onConfirm).toHaveBeenCalledWith(null, null);
    // Internal state still holds the original values since there's no re-render
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeEnabled();
  });
});
