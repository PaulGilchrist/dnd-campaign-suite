// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SingleTargetPopup from './SingleTargetPopup.jsx';

// Covers ONLY SingleTargetPopup's own UI lane: title/spell/target-row rendering,
// the single-select ✓ state machine with confirm gating, the `Cast ${title}`
// confirmLabel default, and the exact [name] confirm payload. Base surface
// inherited from TargetPopupBase (Escape→onSkip, 'Spell' name fallback,
// subtitle, Cancel→onSkip) is pinned in sibling popup specs (MetamagicPopup,
// MagicMissileTargetPopup, TargetWithCheckboxesPopup) — not multiplied here.

const mockSpell = { name: 'Burning Hands', level: 1 };
const mockCreatureTargets = ['Goblin', 'Skeleton', 'Orc'];
const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

// title, spell.name and confirmLabel are deliberately distinct so every
// rendered string is attributable to exactly one prop.
function makeProps(overrides = {}) {
  return {
    spell: mockSpell,
    creatureTargets: mockCreatureTargets,
    onConfirm: mockOnConfirm,
    onSkip: mockOnSkip,
    icon: 'fa-solid fa-fire',
    title: 'Choose a Target',
    description: 'Select a creature',
    confirmLabel: 'Cast',
    cancelLabel: 'Cancel',
    ...overrides,
  };
}

const castButton = () => screen.getByRole('button', { name: 'Cast' });

describe('SingleTargetPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the title heading, spell name, and every creature target row', () => {
    render(<SingleTargetPopup {...makeProps()} />);

    expect(screen.getByRole('heading', { name: 'Choose a Target' })).toBeInTheDocument();
    expect(screen.getByText('Burning Hands')).toBeInTheDocument();
    expect(screen.getByText('Target:')).toBeInTheDocument();
    expect(screen.getAllByText(/Goblin|Skeleton|Orc/)).toHaveLength(3);
  });

  it('defaults the confirm label to "Cast {title}" and starts disabled', () => {
    render(<SingleTargetPopup {...makeProps({ confirmLabel: undefined })} />);

    const cast = screen.getByRole('button', { name: 'Cast Choose a Target' });
    expect(cast).toBeInTheDocument();
    expect(cast).toBeDisabled();
  });

  it('single-selects a target, moves the ✓ marker on switch, and gates confirm', () => {
    render(<SingleTargetPopup {...makeProps()} />);

    // Nothing selected: no markers, confirm disabled, row clicks never confirm.
    expect(screen.getAllByText(/Goblin|Skeleton|Orc/).every(t => !t.textContent.includes('\u2713'))).toBe(true);
    expect(castButton()).toBeDisabled();

    fireEvent.click(screen.getByText('Goblin'));
    expect(screen.getByText('\u2713 Goblin')).toBeInTheDocument();
    expect(screen.queryByText('\u2713 Orc')).not.toBeInTheDocument();
    expect(castButton()).not.toBeDisabled();
    expect(mockOnConfirm).not.toHaveBeenCalled();

    // Switching selection: exactly one row carries the marker.
    fireEvent.click(screen.getByText('Orc'));
    expect(screen.getByText('\u2713 Orc')).toBeInTheDocument();
    expect(screen.getAllByText(/^\u2713/)).toHaveLength(1);
    expect(castButton()).not.toBeDisabled();
  });

  it('confirms once with the single-target payload and never skips', () => {
    render(<SingleTargetPopup {...makeProps()} />);

    fireEvent.click(screen.getByText('Orc'));
    fireEvent.click(castButton());

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).toHaveBeenCalledWith(['Orc']);
    expect(mockOnSkip).not.toHaveBeenCalled();
  });

  it('renders no target rows and keeps confirm disabled with an empty target list', () => {
    render(<SingleTargetPopup {...makeProps({ creatureTargets: [] })} />);

    expect(screen.getByText('Target:')).toBeInTheDocument();
    expect(screen.queryAllByText(/Goblin|Skeleton|Orc/)).toHaveLength(0);
    expect(castButton()).toBeDisabled();
  });
});
