import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SingleTargetPopup from './SingleTargetPopup.jsx';

const mockSpell = { name: 'Burning Hands', level: 1 };
const mockCreatureTargets = ['Goblin', 'Skeleton', 'Orc'];
const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

function makeProps(overrides = {}) {
  return {
    spell: mockSpell,
    creatureTargets: mockCreatureTargets,
    onConfirm: mockOnConfirm,
    onSkip: mockOnSkip,
    icon: 'fa-solid fa-fire',
    title: 'Burning Hands',
    school: 'Evocation',
    defaultLevel: 1,
    description: 'Select a target',
    confirmLabel: 'Cast',
    cancelLabel: 'Cancel',
    ...overrides,
  };
}

describe('SingleTargetPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──

  it('renders the popup overlay, modal, and header with icon', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
    expect(document.querySelector('.popup-modal')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Burning Hands' })).toBeInTheDocument();
  });

  it('renders spell name and level/school subtitle', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    const spellName = document.querySelector('.metamagic-spell-name');
    expect(spellName).toHaveTextContent('Burning Hands');
    expect(spellName).toHaveTextContent('Level 1');
    expect(spellName).toHaveTextContent('Evocation');
  });

  it('renders the description when provided', () => {
    render(<SingleTargetPopup {...makeProps({ description: 'Pick one creature' })} />);
    expect(screen.getByText('Pick one creature')).toBeInTheDocument();
  });

  it('renders creature targets in the target selection list', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('Skeleton')).toBeInTheDocument();
    expect(screen.getByText('Orc')).toBeInTheDocument();
  });

  it('renders a target label with strong text', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    expect(screen.getByText('Target:')).toBeInTheDocument();
  });

  // ── Confirm/Cancel button labels ──

  it('uses custom confirmLabel when provided', () => {
    render(<SingleTargetPopup {...makeProps({ confirmLabel: 'Cast Spell' })} />);
    expect(screen.getByText('Cast Spell')).toBeInTheDocument();
  });

  it('uses default confirmLabel "Cast {title}" when confirmLabel is not provided', () => {
    render(<SingleTargetPopup {...makeProps({ confirmLabel: undefined })} />);
    expect(screen.getByText('Cast Burning Hands')).toBeInTheDocument();
  });

  it('uses custom cancelLabel when provided', () => {
    render(<SingleTargetPopup {...makeProps({ cancelLabel: 'Nope' })} />);
    expect(screen.getByText('Nope')).toBeInTheDocument();
  });

  it('uses default cancelLabel "Cancel" when cancelLabel is not provided', () => {
    render(<SingleTargetPopup {...makeProps({ cancelLabel: undefined })} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  // ── Confirm button state ──

  it('disables confirm button when no target is selected', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    expect(screen.getByText('Cast')).toBeDisabled();
  });

  it('enables confirm button after selecting a target', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    const goblinRow = screen.getByText('Goblin').closest('div');
    fireEvent.click(goblinRow);
    expect(screen.getByText('Cast')).not.toBeDisabled();
  });

   it('keeps selection persistent (no deselect mechanism in single-target popup)', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    // Select a target first
    const goblinRow = screen.getByText(/Goblin/).closest('div');
    fireEvent.click(goblinRow);
    expect(screen.getByText('Cast')).not.toBeDisabled();
    // The component manages its own state internally; there is no way to deselect
    // once a target is chosen. The checkmark persists.
    expect(screen.getByText(/Goblin/).textContent).toContain('\u2713');
  });

  // ── Target selection ──

   it('shows checkmark (✓) for the selected target', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    const goblinRow = screen.getByText(/Goblin/).closest('div');
    fireEvent.click(goblinRow);
    expect(screen.getByText(/Goblin/).textContent).toContain('\u2713');
  });

  it('updates selection to a different target', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    const goblinRow = screen.getByText(/Goblin/).closest('div');
    const orcRow = screen.getByText(/Orc/).closest('div');

    fireEvent.click(goblinRow);
    expect(screen.getByText(/Goblin/).textContent).toContain('\u2713');
    expect(screen.getByText(/Orc/).textContent).not.toContain('\u2713');

    fireEvent.click(orcRow);
    expect(screen.getByText(/Orc/).textContent).toContain('\u2713');
    expect(screen.getByText(/Goblin/).textContent).not.toContain('\u2713');
  });

   it('renders selectable rows with cursor pointer style', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    // The creature target divs should be clickable (onClick handler)
    const goblinRow = screen.getByText(/Goblin/).closest('div');
    expect(goblinRow).toHaveStyle({ cursor: 'pointer' });
  });

  // ── Confirm behavior ──

   it('calls onConfirm with an array containing the selected target name', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    const orcRow = screen.getByText(/Orc/).closest('div');
    fireEvent.click(orcRow);
    fireEvent.click(screen.getByText('Cast'));
    expect(mockOnConfirm).toHaveBeenCalledWith(['Orc']);
  });

  it('does not call onConfirm when clicking confirm without selecting a target', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    fireEvent.click(screen.getByText('Cast'));
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  // ── Skip behavior ──

  it('calls onSkip when Cancel button is clicked', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnSkip).toHaveBeenCalledTimes(1);
  });

  it('calls onSkip when clicking the overlay background', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    const overlay = document.querySelector('.popup-overlay');
    fireEvent.click(overlay);
    expect(mockOnSkip).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onSkip when clicking inside the modal content', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    const modal = document.querySelector('.popup-modal');
    fireEvent.click(modal);
    expect(mockOnSkip).not.toHaveBeenCalled();
  });

  it('calls onSkip when Escape key is pressed', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnSkip).toHaveBeenCalledTimes(1);
  });

  it('does not call onSkip for non-Escape key presses', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(mockOnSkip).not.toHaveBeenCalled();
  });

  // ── Edge cases ──

  it('renders with empty creature targets list', () => {
    render(<SingleTargetPopup {...makeProps({ creatureTargets: [] })} />);
    expect(screen.getByText('Cast')).toBeInTheDocument();
    expect(screen.getByText('Target:')).toBeInTheDocument();
    // No creature names should appear
    expect(screen.queryByText('Goblin')).not.toBeInTheDocument();
  });

  it('renders with null spell gracefully', () => {
    render(<SingleTargetPopup {...makeProps({ spell: null })} />);
    expect(document.querySelector('.metamagic-spell-name strong')).toHaveTextContent('Spell');
  });

  it('renders with missing spell name gracefully', () => {
    render(<SingleTargetPopup {...makeProps({ spell: {} })} />);
    expect(document.querySelector('.metamagic-spell-name strong')).toHaveTextContent('Spell');
  });

  it('shows default level and school when spell has no level/school', () => {
    render(<SingleTargetPopup {...makeProps({ spell: {}, defaultLevel: 3 })} />);
    const spellName = document.querySelector('.metamagic-spell-name');
    expect(spellName).toHaveTextContent('Level 3');
  });

  it('uses provided defaultLevel when spell has no level', () => {
    render(<SingleTargetPopup {...makeProps({ spell: {}, defaultLevel: 5, school: 'Necromancy' })} />);
    const spellName = document.querySelector('.metamagic-spell-name');
    expect(spellName).toHaveTextContent('Level 5');
    expect(spellName).toHaveTextContent('Necromancy');
  });

   it('renders the scrollable target list container', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    const scrollContainer = document.querySelector('[style*="200px"]');
    expect(scrollContainer).toBeInTheDocument();
    expect(scrollContainer).toHaveStyle({ maxHeight: '200px' });
  });
});
