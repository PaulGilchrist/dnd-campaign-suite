import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TargetWithTypePopup from './TargetWithTypePopup.jsx';

// ── Test fixtures ──

const baseSpell = {
  name: 'Protection from Energy',
  level: 1,
};

const creatureTargets = ['Ally1', 'Ally2', 'Ally3'];
const damageTypes = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'];

function makeProps(overrides = {}) {
  return {
    spell: baseSpell,
    creatureTargets,
    damageTypes,
    onConfirm: vi.fn(),
    onSkip: vi.fn(),
    icon: 'fa-solid fa-shield',
    title: 'Protection from Energy',
    school: 'Abjuration',
    defaultLevel: 1,
    description: 'Select a target and damage type',
    confirmLabel: 'Cast',
    cancelLabel: 'Cancel',
    ...overrides,
  };
}

// ── Tests ──

describe('TargetWithTypePopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──

  it('renders the popup overlay, modal, and header with icon', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
    expect(document.querySelector('.popup-modal')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Protection from Energy' })).toBeInTheDocument();
  });

  it('renders spell name and level/school subtitle', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    const spellName = document.querySelector('.metamagic-spell-name');
    expect(spellName).toHaveTextContent('Protection from Energy');
    expect(spellName).toHaveTextContent('Level 1');
    expect(spellName).toHaveTextContent('Abjuration');
  });

  it('renders the description when provided', () => {
    render(<TargetWithTypePopup {...makeProps({ description: 'Pick target and damage type' })} />);
    expect(screen.getByText('Pick target and damage type')).toBeInTheDocument();
  });

  it('renders creature targets in the target selection list', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    expect(screen.getByText(/Ally1/)).toBeInTheDocument();
    expect(screen.getByText(/Ally2/)).toBeInTheDocument();
    expect(screen.getByText(/Ally3/)).toBeInTheDocument();
  });

  it('renders damage types in the damage type selection list', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    expect(screen.getByText('Acid')).toBeInTheDocument();
    expect(screen.getByText('Cold')).toBeInTheDocument();
    expect(screen.getByText('Fire')).toBeInTheDocument();
    expect(screen.getByText('Lightning')).toBeInTheDocument();
    expect(screen.getByText('Thunder')).toBeInTheDocument();
  });

  it('renders a target label with strong text', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    expect(screen.getByText('Target:')).toBeInTheDocument();
  });

  it('renders a damage type label with strong text', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    expect(screen.getByText('Damage Type:')).toBeInTheDocument();
  });

  // ── Confirm/Cancel button labels ──

  it('uses custom confirmLabel when provided', () => {
    render(<TargetWithTypePopup {...makeProps({ confirmLabel: 'Cast Spell' })} />);
    expect(screen.getByText('Cast Spell')).toBeInTheDocument();
  });

  it('uses default confirmLabel "Cast {title}" when confirmLabel is not provided', () => {
    render(<TargetWithTypePopup {...makeProps({ confirmLabel: undefined })} />);
    expect(screen.getByText('Cast Protection from Energy')).toBeInTheDocument();
  });

  it('uses custom cancelLabel when provided', () => {
    render(<TargetWithTypePopup {...makeProps({ cancelLabel: 'Nope' })} />);
    expect(screen.getByText('Nope')).toBeInTheDocument();
  });

  it('uses default cancelLabel "Cancel" when cancelLabel is not provided', () => {
    render(<TargetWithTypePopup {...makeProps({ cancelLabel: undefined })} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  // ── Confirm button state ──

  it('disables confirm button when no target is selected', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    expect(screen.getByText('Cast')).toBeDisabled();
  });

  it('disables confirm button when target selected but no damage type', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    const allyRow = screen.getByText(/Ally1/).closest('div');
    fireEvent.click(allyRow);
    expect(screen.getByText('Cast')).toBeDisabled();
  });

  it('disables confirm button when damage type selected but no target', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    const acidRow = screen.getByText('Acid').closest('div');
    fireEvent.click(acidRow);
    expect(screen.getByText('Cast')).toBeDisabled();
  });

  it('enables confirm button after selecting both target and damage type', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    const allyRow = screen.getByText(/Ally1/).closest('div');
    const acidRow = screen.getByText('Acid').closest('div');
    fireEvent.click(allyRow);
    fireEvent.click(acidRow);
    expect(screen.getByText('Cast')).not.toBeDisabled();
  });

  // ── Target selection ──

  it('shows checkmark (✓) for the selected target', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    const allyRow = screen.getByText(/Ally1/).closest('div');
    fireEvent.click(allyRow);
    expect(allyRow.textContent).toContain('\u2713');
  });

  it('shows checkmark (✓) for the selected damage type', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    const acidRow = screen.getByText('Acid').closest('div');
    fireEvent.click(acidRow);
    expect(acidRow.textContent).toContain('\u2713');
  });

  it('updates target selection to a different target', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    const ally1Row = screen.getByText(/Ally1/).closest('div');
    const ally2Row = screen.getByText(/Ally2/).closest('div');

    fireEvent.click(ally1Row);
    expect(ally1Row.textContent).toContain('\u2713');
    expect(ally2Row.textContent).not.toContain('\u2713');

    fireEvent.click(ally2Row);
    expect(ally2Row.textContent).toContain('\u2713');
    expect(ally1Row.textContent).not.toContain('\u2713');
  });

  it('updates damage type selection to a different damage type', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    const acidRow = screen.getByText('Acid').closest('div');
    const coldRow = screen.getByText('Cold').closest('div');

    fireEvent.click(acidRow);
    expect(acidRow.textContent).toContain('\u2713');
    expect(coldRow.textContent).not.toContain('\u2713');

    fireEvent.click(coldRow);
    expect(coldRow.textContent).toContain('\u2713');
    expect(acidRow.textContent).not.toContain('\u2713');
  });

  it('updates target selection independently of damage type selection', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    const ally1Row = screen.getByText(/Ally1/).closest('div');
    const acidRow = screen.getByText('Acid').closest('div');
    const ally2Row = screen.getByText(/Ally2/).closest('div');

    // Select target and damage type
    fireEvent.click(ally1Row);
    fireEvent.click(acidRow);
    expect(ally1Row.textContent).toContain('\u2713');
    expect(acidRow.textContent).toContain('\u2713');

    // Change target only, damage type should still be selected
    fireEvent.click(ally2Row);
    expect(ally2Row.textContent).toContain('\u2713');
    expect(ally1Row.textContent).not.toContain('\u2713');
    expect(acidRow.textContent).toContain('\u2713');
  });

  it('updates damage type selection independently of target selection', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    const ally1Row = screen.getByText(/Ally1/).closest('div');
    const acidRow = screen.getByText('Acid').closest('div');
    const coldRow = screen.getByText('Cold').closest('div');

    // Select target and damage type
    fireEvent.click(ally1Row);
    fireEvent.click(acidRow);
    expect(ally1Row.textContent).toContain('\u2713');
    expect(acidRow.textContent).toContain('\u2713');

    // Change damage type only, target should still be selected
    fireEvent.click(coldRow);
    expect(coldRow.textContent).toContain('\u2713');
    expect(acidRow.textContent).not.toContain('\u2713');
    expect(ally1Row.textContent).toContain('\u2713');
  });

  it('renders selectable rows with cursor pointer style', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    const allyRow = screen.getByText(/Ally1/).closest('div');
    expect(allyRow).toHaveStyle({ cursor: 'pointer' });
  });

  // ── Confirm behavior ──

  it('calls onConfirm with { targetName, damageType } when both are selected', () => {
    const onConfirm = vi.fn();
    render(<TargetWithTypePopup {...makeProps({ onConfirm })} />);
    const allyRow = screen.getByText(/Ally1/).closest('div');
    const fireRow = screen.getByText('Fire').closest('div');
    fireEvent.click(allyRow);
    fireEvent.click(fireRow);
    fireEvent.click(screen.getByText('Cast'));
    expect(onConfirm).toHaveBeenCalledWith({ targetName: 'Ally1', damageType: 'Fire' });
  });

  it('does not call onConfirm when clicking confirm without selecting a target', () => {
    const onConfirm = vi.fn();
    render(<TargetWithTypePopup {...makeProps({ onConfirm })} />);
    const acidRow = screen.getByText('Acid').closest('div');
    fireEvent.click(acidRow);
    fireEvent.click(screen.getByText('Cast'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not call onConfirm when clicking confirm without selecting a damage type', () => {
    const onConfirm = vi.fn();
    render(<TargetWithTypePopup {...makeProps({ onConfirm })} />);
    const allyRow = screen.getByText(/Ally1/).closest('div');
    fireEvent.click(allyRow);
    fireEvent.click(screen.getByText('Cast'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // ── Skip behavior ──

  it('calls onSkip when Cancel button is clicked', () => {
    const onSkip = vi.fn();
    render(<TargetWithTypePopup {...makeProps({ onSkip })} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('calls onSkip when clicking the overlay background', () => {
    const onSkip = vi.fn();
    render(<TargetWithTypePopup {...makeProps({ onSkip })} />);
    const overlay = document.querySelector('.popup-overlay');
    fireEvent.click(overlay);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onSkip when clicking inside the modal content', () => {
    const onSkip = vi.fn();
    render(<TargetWithTypePopup {...makeProps({ onSkip })} />);
    const modal = document.querySelector('.popup-modal');
    fireEvent.click(modal);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('calls onSkip when Escape key is pressed', () => {
    const onSkip = vi.fn();
    render(<TargetWithTypePopup {...makeProps({ onSkip })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('does not call onSkip for non-Escape key presses', () => {
    const onSkip = vi.fn();
    render(<TargetWithTypePopup {...makeProps({ onSkip })} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onSkip).not.toHaveBeenCalled();
  });

  // ── Edge cases ──

  it('renders with empty creature targets list', () => {
    render(<TargetWithTypePopup {...makeProps({ creatureTargets: [] })} />);
    expect(screen.getByText('Cast')).toBeInTheDocument();
    expect(screen.getByText('Target:')).toBeInTheDocument();
    expect(screen.getByText('Damage Type:')).toBeInTheDocument();
    // No creature names should appear
    expect(screen.queryByText('Ally1')).not.toBeInTheDocument();
  });

  it('renders with empty damage types list', () => {
    render(<TargetWithTypePopup {...makeProps({ damageTypes: [] })} />);
    expect(screen.getByText('Cast')).toBeInTheDocument();
    expect(screen.getByText('Target:')).toBeInTheDocument();
    expect(screen.getByText('Damage Type:')).toBeInTheDocument();
    // No damage type names should appear
    expect(screen.queryByText('Acid')).not.toBeInTheDocument();
  });

  it('renders with both empty lists', () => {
    render(<TargetWithTypePopup {...makeProps({ creatureTargets: [], damageTypes: [] })} />);
    expect(screen.getByText('Cast')).toBeInTheDocument();
    expect(screen.getByText('Target:')).toBeInTheDocument();
    expect(screen.getByText('Damage Type:')).toBeInTheDocument();
    expect(screen.getByText('Cast')).toBeDisabled();
  });

  it('renders with null spell gracefully', () => {
    render(<TargetWithTypePopup {...makeProps({ spell: null })} />);
    expect(document.querySelector('.metamagic-spell-name strong')).toHaveTextContent('Spell');
  });

  it('renders with missing spell name gracefully', () => {
    render(<TargetWithTypePopup {...makeProps({ spell: {} })} />);
    expect(document.querySelector('.metamagic-spell-name strong')).toHaveTextContent('Spell');
  });

  it('shows default level and school when spell has no level/school', () => {
    render(<TargetWithTypePopup {...makeProps({ spell: {}, defaultLevel: 3 })} />);
    const spellName = document.querySelector('.metamagic-spell-name');
    expect(spellName).toHaveTextContent('Level 3');
  });

  it('uses provided defaultLevel when spell has no level', () => {
    render(<TargetWithTypePopup {...makeProps({ spell: {}, defaultLevel: 5, school: 'Necromancy' })} />);
    const spellName = document.querySelector('.metamagic-spell-name');
    expect(spellName).toHaveTextContent('Level 5');
    expect(spellName).toHaveTextContent('Necromancy');
  });

  it('renders scrollable target list container with maxHeight 200px', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    const scrollContainers = document.querySelectorAll('[style*="200px"]');
    expect(scrollContainers).toHaveLength(2);
    scrollContainers.forEach(container => {
      expect(container).toHaveStyle({ maxHeight: '200px' });
    });
  });

  it('renders both sections with metamagic-twin-target className', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    const twinTargets = document.querySelectorAll('.metamagic-twin-target');
    expect(twinTargets).toHaveLength(2);
  });

  it('renders damage type section with marginTop 16px relative to target section', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    const twinTargets = document.querySelectorAll('.metamagic-twin-target');
    expect(twinTargets[1]).toHaveStyle({ marginTop: '16px' });
  });

  // ── Selection persistence ──

  it('keeps both selections persistent after selecting both', () => {
    render(<TargetWithTypePopup {...makeProps()} />);
    const allyRow = screen.getByText(/Ally1/).closest('div');
    const acidRow = screen.getByText('Acid').closest('div');

    fireEvent.click(allyRow);
    fireEvent.click(acidRow);

    expect(allyRow.textContent).toContain('\u2713');
    expect(acidRow.textContent).toContain('\u2713');
  });

  // ── Confirm callback with specific values ──

  it('calls onConfirm with the second target and second damage type chosen', () => {
    const onConfirm = vi.fn();
    render(<TargetWithTypePopup {...makeProps({ onConfirm })} />);
    const ally2Row = screen.getByText(/Ally2/).closest('div');
    const coldRow = screen.getByText('Cold').closest('div');
    fireEvent.click(ally2Row);
    fireEvent.click(coldRow);
    fireEvent.click(screen.getByText('Cast'));
    expect(onConfirm).toHaveBeenCalledWith({ targetName: 'Ally2', damageType: 'Cold' });
  });
});
