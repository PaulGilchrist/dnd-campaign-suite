// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SingleResistanceSelectionModal from './SingleResistanceSelectionModal.jsx';

// Resistance-application internals (store writes, latches, logging) are owned by
// services/automation/handlers/class-warlock/fiendishResilienceHandler.test.js —
// this file covers only the modal UI lane: rendering, radio semantics, exact
// confirm payload, dismiss paths, and result-screen transitions.

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-warlock/fiendishResilienceHandler.js', () => ({
  applyTypeChoice: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as fiendishResilienceHandler from '../../../services/automation/handlers/class-warlock/fiendishResilienceHandler.js';

// ── Test fixtures ──

const baseAction = {
  name: 'Fiendish Resilience',
  automation: {
    type: 'choice',
    damageTypes: ['Acid', 'Fire', 'Cold'],
  },
};

const basePlayerStats = {
  name: 'Warlock1',
  level: 5,
  hitPoints: 30,
};

const defaultProps = {
  action: baseAction,
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...defaultProps, ...(overrides || {}) };
}

const DEFAULT_DAMAGE_TYPES = [
  'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning',
  'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant',
  'Slashing', 'Thunder',
];

const mockSuccessResult = {
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Fiendish Resilience',
    description: 'Fiendish Resilience: Acid selected. You gain resistance to Acid damage.',
  },
};

// ── Helpers ──

// Radio accessible names may carry a trailing "(current)" marker, so match by prefix.
function selectDamageType(type) {
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(type) }));
}

function checkedRadios() {
  return screen.queryAllByRole('radio', { checked: true });
}

// ── Tests ──

describe('SingleResistanceSelectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header, instruction, and exactly the provided damage-type radios, none pre-selected', () => {
    render(<SingleResistanceSelectionModal {...defaultProps} />);
    expect(screen.getByText('Fiendish Resilience')).toBeInTheDocument();
    expect(screen.getByText(/Choose one damage type/)).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: /Acid/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Fire/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Cold/ })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Poison/ })).not.toBeInTheDocument();
    expect(checkedRadios()).toHaveLength(0);
  });

  it('shows the current type in the instruction, option marker, and button label when existingType is set', () => {
    const actionWithExisting = { ...baseAction, existingType: 'Fire' };
    render(<SingleResistanceSelectionModal {...makeProps({ action: actionWithExisting })} />);
    expect(screen.getByText(/Change damage type \(currently Fire\)/)).toBeInTheDocument();
    expect(screen.getByText('(current)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change Damage Type' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose Damage Type' })).not.toBeInTheDocument();
  });

  it('falls back to the full default damage-type list and generic title when action provides neither', () => {
    render(<SingleResistanceSelectionModal {...makeProps({ action: null })} />);
    expect(screen.getByText('Resistance Selection')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(DEFAULT_DAMAGE_TYPES.length);
    DEFAULT_DAMAGE_TYPES.forEach(type => {
      expect(screen.getByRole('radio', { name: type })).toBeInTheDocument();
    });
  });

  it('renders no options and keeps apply inert when damageTypes is an empty array (does not fall back to defaults)', () => {
    render(<SingleResistanceSelectionModal {...makeProps({ action: { name: 'Fiendish Resilience', automation: { damageTypes: [] } } })} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    const applyButton = screen.getByRole('button', { name: 'Choose Damage Type' });
    expect(applyButton).toBeDisabled();
    fireEvent.click(applyButton);
    expect(fiendishResilienceHandler.applyTypeChoice).not.toHaveBeenCalled();
  });

  it('title prop overrides the action name in the header', () => {
    render(<SingleResistanceSelectionModal {...makeProps({ title: 'Elemental Resistance' })} />);
    expect(screen.getByText('Elemental Resistance')).toBeInTheDocument();
    expect(screen.queryByText('Fiendish Resilience')).not.toBeInTheDocument();
  });

  it('enforces single selection and enables apply only after a type is chosen', () => {
    render(<SingleResistanceSelectionModal {...defaultProps} />);
    const applyButton = screen.getByRole('button', { name: 'Choose Damage Type' });

    // Inert before selection: disabled button never triggers the handler.
    expect(applyButton).toBeDisabled();
    fireEvent.click(applyButton);
    expect(fiendishResilienceHandler.applyTypeChoice).not.toHaveBeenCalled();

    // First selection checks exactly one radio and enables the button.
    selectDamageType('Acid');
    expect(checkedRadios()).toHaveLength(1);
    expect(screen.getByRole('radio', { name: /Acid/ })).toBeChecked();
    expect(applyButton).toBeEnabled();

    // Re-selection is exclusive — including over the existing type.
    selectDamageType('Fire');
    expect(checkedRadios()).toHaveLength(1);
    expect(screen.getByRole('radio', { name: /Fire/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Acid/ })).not.toBeChecked();
  });

  it('applies the selection by calling applyTypeChoice with the exact action, stats, campaign, and type', async () => {
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue(mockSuccessResult);
    render(<SingleResistanceSelectionModal {...defaultProps} />);
    selectDamageType('Acid');
    fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
    expect(fiendishResilienceHandler.applyTypeChoice).toHaveBeenCalledWith(
      baseAction,
      basePlayerStats,
      'test-campaign',
      'Acid',
    );
  });

  it('routes through onConfirm instead of applyTypeChoice when onConfirm is provided', () => {
    const onConfirm = vi.fn();
    render(<SingleResistanceSelectionModal {...makeProps({ onConfirm })} />);
    selectDamageType('Fire');
    fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
    expect(onConfirm).toHaveBeenCalledWith('Fire');
    expect(fiendishResilienceHandler.applyTypeChoice).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('replaces the selection UI with the result screen after a successful apply, closed by Done', async () => {
    const onClose = vi.fn();
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue(mockSuccessResult);
    render(<SingleResistanceSelectionModal {...makeProps({ onClose })} />);
    selectDamageType('Acid');
    fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));

    await screen.findByRole('button', { name: 'Done' });
    expect(screen.getByText('Fiendish Resilience: Acid selected. You gain resistance to Acid damage.')).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose Damage Type' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays on the selection screen when applyTypeChoice resolves without a result', async () => {
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue(null);
    render(<SingleResistanceSelectionModal {...defaultProps} />);
    selectDamageType('Acid');
    fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
    await screen.findByRole('button', { name: 'Choose Damage Type' });
    expect(screen.getByRole('button', { name: 'Choose Damage Type' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<SingleResistanceSelectionModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('styles via scoped classes, keeping only dynamic selection colors inline (no-inline-styles convention)', () => {
    // fix#313 recipe pin: statics from the former inline styles on the container,
    // option label, radio input, and "(current)" marker (:30/:36/:39/:77-era) now
    // live in SingleResistanceSelectionModal.css (exact-value migration); the only
    // lawful inline is the selection-derived background/border on option labels
    // (dynamic-data exception).
    render(<SingleResistanceSelectionModal {...makeProps({ action: { ...baseAction, existingType: 'Fire' } })} />);

    const list = document.querySelector('.single-resistance-types');
    expect(list).toBeTruthy();
    expect(list.getAttribute('style')).toBeNull();

    const rows = list.querySelectorAll('.single-resistance-option');
    expect(rows).toHaveLength(3);
    const inputs = list.querySelectorAll('.single-resistance-input');
    expect(inputs).toHaveLength(3);

    // Rows at rest: inline attr carries ONLY background/border — no statics
    // (display/padding/margin/cursor/border-radius are class-owned).
    for (const row of rows) {
      const inline = row.getAttribute('style') || '';
      expect(inline).toMatch(/background/i);
      expect(inline).toMatch(/border/i);
      expect(inline).not.toMatch(/display|padding|margin|cursor|border-radius/i);
    }
    // Whole-body census at rest: exactly the three option labels are inline-styled.
    expect(document.querySelectorAll('.sp-body [style]')).toHaveLength(3);

    // Static-only sites are style-free.
    for (const input of inputs) expect(input.getAttribute('style')).toBeNull();
    const current = list.querySelector('.single-resistance-current');
    expect(current).toBeTruthy();
    expect(current.textContent).toBe('(current)');
    expect(current.getAttribute('style')).toBeNull();

    // Selecting flips only dynamic inline values: link-colored solid border on the
    // chosen row; the untouched Cold row stays transparent.
    selectDamageType('Acid');
    const acidRow = screen.getByText('Acid').closest('.single-resistance-option');
    expect(acidRow.getAttribute('style') || '').toMatch(/var\(--color-link\)/);
    const coldRow = screen.getByText('Cold').closest('.single-resistance-option');
    expect(coldRow.getAttribute('style') || '').toMatch(/transparent/);
    expect(document.querySelectorAll('.sp-body [style]')).toHaveLength(3);
  });
});
