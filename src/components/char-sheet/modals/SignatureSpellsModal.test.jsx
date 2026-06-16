import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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

const basePayload = {
  level3Options,
  selectedSpells: [],
};

function makePayload(overrides) {
  return { ...basePayload, ...(overrides || {}) };
}

// ── Tests ──

describe('SignatureSpellsModal', () => {
  // ── Initial render / display ──

  it('renders modal overlay with test id', () => {
    render(<SignatureSpellsModal payload={makePayload()} onClose={() => {}} />);
    expect(document.querySelector('[data-testid="signature-spells-modal"]')).toBeInTheDocument();
  });

  it('renders modal header with title', () => {
    render(<SignatureSpellsModal payload={makePayload()} onClose={() => {}} />);
    expect(screen.getByText('Signature Spells')).toBeInTheDocument();
  });

  it('renders instructional paragraph', () => {
    render(<SignatureSpellsModal payload={makePayload()} onClose={() => {}} />);
    expect(screen.getByText(/Choose two level 3 spells in your spellbook/)).toBeInTheDocument();
  });

  it('renders two select dropdowns for spell selection', () => {
    render(<SignatureSpellsModal payload={makePayload()} onClose={() => {}} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);
  });

  it('renders labels for both spell selects', () => {
    render(<SignatureSpellsModal payload={makePayload()} onClose={() => {}} />);
    expect(screen.getByText('Signature spell 1:')).toBeInTheDocument();
    expect(screen.getByText('Signature spell 2:')).toBeInTheDocument();
  });

  it('renders confirm button', () => {
    render(<SignatureSpellsModal payload={makePayload()} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeInTheDocument();
  });

  it('renders default option in each select', () => {
    render(<SignatureSpellsModal payload={makePayload()} onClose={() => {}} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toContainHTML('<option value="">-- Select a level 3 spell --</option>');
    expect(selects[1]).toContainHTML('<option value="">-- Select a level 3 spell --</option>');
  });

  it('renders all level 3 options in each select', () => {
    render(<SignatureSpellsModal payload={makePayload()} onClose={() => {}} />);
    const selects = screen.getAllByRole('combobox');
    level3Options.forEach(spell => {
      expect(selects[0]).toContainElement(selects[0].querySelector(`option[value="${spell}"]`));
      expect(selects[1]).toContainElement(selects[1].querySelector(`option[value="${spell}"]`));
    });
  });

  // ── Existing selection display ──

  it('shows current selection when selectedSpells has values', () => {
    render(<SignatureSpellsModal payload={makePayload({ selectedSpells: ['Shield', 'Magic Missile'] })} onClose={() => {}} />);
    expect(screen.getByText(/Current:/)).toBeInTheDocument();
    const currentParagraph = screen.getByText(/Current:/).closest('p');
    expect(currentParagraph.textContent).toContain('Shield');
    expect(currentParagraph.textContent).toContain('Magic Missile');
  });

  it('does not show current selection when selectedSpells is empty', () => {
    render(<SignatureSpellsModal payload={makePayload({ selectedSpells: [] })} onClose={() => {}} />);
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
  });

  it('does not show current selection when selectedSpells is undefined', () => {
    render(<SignatureSpellsModal payload={makePayload({ selectedSpells: undefined })} onClose={() => {}} />);
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
  });

  it('selects existing spells in dropdowns when pre-selected', () => {
    render(<SignatureSpellsModal payload={makePayload({ selectedSpells: ['Shield', 'Magic Missile'] })} onClose={() => {}} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects[0].value).toBe('Shield');
    expect(selects[1].value).toBe('Magic Missile');
  });

  it('shows empty values in dropdowns when no pre-selected spells', () => {
    render(<SignatureSpellsModal payload={makePayload({ selectedSpells: [] })} onClose={() => {}} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects[0].value).toBe('');
    expect(selects[1].value).toBe('');
  });

  // ── Select interaction ──

  it('updates first select value on change', () => {
    render(<SignatureSpellsModal payload={makePayload()} onClose={() => {}} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'Shield' } });
    expect(selects[0].value).toBe('Shield');
  });

  it('updates second select value on change', () => {
    render(<SignatureSpellsModal payload={makePayload()} onClose={() => {}} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'Magic Missile' } });
    expect(selects[1].value).toBe('Magic Missile');
  });

  // ── Confirm button disabled state ──

  it('disables confirm button when first spell not selected', () => {
    render(<SignatureSpellsModal payload={makePayload()} onClose={() => {}} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'Magic Missile' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('disables confirm button when second spell not selected', () => {
    render(<SignatureSpellsModal payload={makePayload()} onClose={() => {}} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'Shield' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('disables confirm button when both spells are the same', () => {
    render(<SignatureSpellsModal payload={makePayload()} onClose={() => {}} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'Shield' } });
    fireEvent.change(selects[1], { target: { value: 'Shield' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('enables confirm button when both spells are selected and different', () => {
    render(<SignatureSpellsModal payload={makePayload()} onClose={() => {}} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'Shield' } });
    fireEvent.change(selects[1], { target: { value: 'Magic Missile' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeEnabled();
  });

  // ── Confirm button interaction ──

  it('calls onConfirm with selected spells when confirm clicked', () => {
    const onConfirm = vi.fn();
    render(<SignatureSpellsModal payload={makePayload()} onConfirm={onConfirm} onClose={() => {}} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'Shield' } });
    fireEvent.change(selects[1], { target: { value: 'Magic Missile' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledWith('Shield', 'Magic Missile');
  });

  it('does not call onConfirm when confirm button is disabled', () => {
    const onConfirm = vi.fn();
    render(<SignatureSpellsModal payload={makePayload()} onConfirm={onConfirm} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<SignatureSpellsModal payload={makePayload()} onClose={onClose} />);
    fireEvent.click(document.querySelector('.popup-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<SignatureSpellsModal payload={makePayload()} onClose={onClose} />);
    fireEvent.click(document.querySelector('.popup-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── CSS classes ──

  it('renders with popup-overlay class', () => {
    render(<SignatureSpellsModal payload={makePayload()} onClose={() => {}} />);
    expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
  });

  it('renders with popup-modal class', () => {
    render(<SignatureSpellsModal payload={makePayload()} onClose={() => {}} />);
    expect(document.querySelector('.popup-modal')).toBeInTheDocument();
  });

  it('select elements have char-btn class', () => {
    render(<SignatureSpellsModal payload={makePayload()} onClose={() => {}} />);
    const selects = screen.getAllByRole('combobox');
    selects.forEach(select => {
      expect(select).toHaveClass('char-btn');
    });
  });

  it('confirm button has char-btn class', () => {
    render(<SignatureSpellsModal payload={makePayload()} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toHaveClass('char-btn');
  });
});
