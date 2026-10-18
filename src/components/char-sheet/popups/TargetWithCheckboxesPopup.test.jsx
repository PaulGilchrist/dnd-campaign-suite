// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TargetWithCheckboxesPopup from './TargetWithCheckboxesPopup.jsx';

// Covers ONLY TargetWithCheckboxesPopup's own UI lane: the two-step target →
// checkbox selection state machine (✓ single-target marker, per-target
// loadTargetData sync/async/reject handling, selection reset on target
// switch), checkbox multi-select toggle semantics, the two-gate confirm
// (target AND ≥1 selection), the 'Cast {title}' label default, and the exact
// { targetName, selections } payload mapping cb.selectionData. Base surface
// inherited from TargetPopupBase (Escape→onSkip, 'Spell' name fallback,
// subtitle composition) is not multiplied here — strongest pins live in
// MultiTargetCountPopup.test.jsx (skip once each) and MagicMissileTargetPopup.test.jsx
// ('Spell' full-line), pending a dedicated TargetPopupBase spec.

const mockSpell = { name: 'Dispel Magic', level: 3 };
const mockCreatureTargets = ['Goblin', 'Skeleton', 'Orc'];
const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();
const mockLoadTargetData = vi.fn();

// Checkbox labels are distinct from selectionData.name so rendered copy and
// payload fields are each attributable to exactly one source.
const effect = (id, name) => ({ id, label: `Remove ${name}`, selectionData: { type: 'buff', name } });

function makeProps(overrides = {}) {
  return {
    spell: mockSpell,
    creatureTargets: mockCreatureTargets,
    onConfirm: mockOnConfirm,
    onSkip: mockOnSkip,
    icon: 'fa-solid fa-ban',
    title: 'Remove Effects', // distinct from spell.name for copy attribution
    school: 'Abjuration',
    defaultLevel: 3,
    description: 'Choose effects to remove',
    confirmLabel: 'Cast',
    cancelLabel: 'Nope', // distinct from the 'Cancel' default
    loadTargetData: mockLoadTargetData,
    ...overrides,
  };
}

describe('TargetWithCheckboxesPopup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders header, spell brief, targets and button copy, with confirm gated off', () => {
    const { rerender } = render(<TargetWithCheckboxesPopup {...makeProps()} />);

    expect(screen.getByRole('heading', { name: 'Remove Effects' })).toBeInTheDocument();
    // Spell brief pinned as a full line; spell.name ≠ title so attribution is unambiguous.
    expect(screen.getByText('Dispel Magic').closest('p').textContent.replace(/\s+/g, ' ').trim())
      .toBe('Dispel Magic \u2014 Level 3 Abjuration');
    expect(screen.getByText('Choose effects to remove')).toBeInTheDocument();
    expect(screen.getByText('Target:')).toBeInTheDocument();
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('Skeleton')).toBeInTheDocument();
    expect(screen.getByText('Orc')).toBeInTheDocument();
    expect(screen.queryAllByText(/✓/)).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Cast' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Nope' })).toBeInTheDocument();

    // This popup's own label defaults: 'Cast {title}' and 'Cancel'.
    rerender(<TargetWithCheckboxesPopup {...makeProps({ confirmLabel: undefined, cancelLabel: undefined })} />);
    expect(screen.getByRole('button', { name: 'Cast Remove Effects' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('marks exactly one selected target, loads its list, and stays confirm-disabled until a checkbox is ticked', () => {
    mockLoadTargetData.mockImplementation((name) => (
      name === 'Goblin'
        ? [effect('g1', 'Blessing'), effect('g2', 'Shield')]
        : [effect('s1', 'Hex')]
    ));
    render(<TargetWithCheckboxesPopup {...makeProps()} />);
    const cast = screen.getByRole('button', { name: 'Cast' });

    fireEvent.click(screen.getByText('Goblin'));
    expect(screen.getByText('✓ Goblin')).toBeInTheDocument();
    expect(screen.queryAllByText(/✓/)).toHaveLength(1); // single-target marker only
    expect(mockLoadTargetData).toHaveBeenCalledWith('Goblin');
    expect(screen.getByText('Effects to remove from Goblin:')).toBeInTheDocument();
    expect(screen.getByText('Remove Blessing')).toBeInTheDocument();
    expect(screen.getByText('Remove Shield')).toBeInTheDocument();
    expect(cast).toBeDisabled(); // target selected but nothing ticked

    fireEvent.click(screen.getByText('Skeleton'));
    expect(screen.getByText('✓ Skeleton')).toBeInTheDocument();
    expect(screen.queryByText('✓ Goblin')).not.toBeInTheDocument();
    expect(mockLoadTargetData).toHaveBeenLastCalledWith('Skeleton');
    expect(screen.getByText('Effects to remove from Skeleton:')).toBeInTheDocument();
    expect(screen.queryByText('Remove Blessing')).not.toBeInTheDocument(); // per-target list swapped
    expect(cast).toBeDisabled();
  });

  it('toggles checkbox selections independently — multi-select, not radio', () => {
    mockLoadTargetData.mockReturnValue([effect('1', 'Blessing'), effect('2', 'Shield')]);
    render(<TargetWithCheckboxesPopup {...makeProps()} />);
    fireEvent.click(screen.getByText('Goblin'));

    const blessing = screen.getByText('Remove Blessing');
    const shield = screen.getByText('Remove Shield');
    const cast = screen.getByRole('button', { name: 'Cast' });

    fireEvent.click(blessing);
    expect(screen.getByText('✓ Remove Blessing')).toBeInTheDocument();
    expect(cast).not.toBeDisabled();

    fireEvent.click(shield);
    expect(screen.getByText('✓ Remove Blessing')).toBeInTheDocument(); // stays ticked
    expect(screen.getByText('✓ Remove Shield')).toBeInTheDocument();

    fireEvent.click(blessing);
    expect(screen.queryByText('✓ Remove Blessing')).not.toBeInTheDocument();
    expect(screen.getByText('✓ Remove Shield')).toBeInTheDocument(); // unchecking one spares the other
    expect(cast).not.toBeDisabled();

    fireEvent.click(shield);
    expect(screen.queryAllByText(/✓ Remove/)).toHaveLength(0);
    expect(cast).toBeDisabled(); // back to zero selections
  });

  it('confirms once with the exact payload — selectionData in click order — and resets on target switch', () => {
    mockLoadTargetData.mockImplementation((name) => (
      name === 'Goblin'
        ? [effect('1', 'Blessing'), effect('2', 'Shield'), effect('3', 'Haste')]
        : [effect('4', 'Hex')]
    ));
    render(<TargetWithCheckboxesPopup {...makeProps()} />);

    fireEvent.click(screen.getByText('Goblin'));
    // Click order differs from list order; payload must follow click order.
    fireEvent.click(screen.getByText('Remove Shield'));
    fireEvent.click(screen.getByText('Remove Blessing'));
    fireEvent.click(screen.getByRole('button', { name: 'Cast' }));

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).toHaveBeenCalledWith({
      targetName: 'Goblin',
      selections: [
        { type: 'buff', name: 'Shield' }, // selectionData, not label
        { type: 'buff', name: 'Blessing' },
      ],
    });
    expect(mockOnSkip).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Skeleton'));
    expect(screen.getByRole('button', { name: 'Cast' })).toBeDisabled(); // switch clears selections
    expect(screen.queryByText('✓ Hex')).not.toBeInTheDocument();
  });

  it('renders synced, async, and rejected loads — empty results show the default no-items copy', async () => {
    mockLoadTargetData.mockImplementation((name) => {
      if (name === 'Goblin') return undefined; // sync empty
      if (name === 'Skeleton') return Promise.resolve([effect('s1', 'Hex')]);
      return Promise.reject(new Error('load failed')); // Orc
    });
    render(<TargetWithCheckboxesPopup {...makeProps()} />);
    const cast = screen.getByRole('button', { name: 'Cast' });

    fireEvent.click(screen.getByText('Goblin'));
    expect(screen.getByText('No applicable effects found on this target')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Skeleton'));
    await waitFor(() => expect(screen.getByText('Remove Hex')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Orc'));
    await waitFor(() => expect(screen.getByText('No applicable effects found on this target')).toBeInTheDocument());
    expect(screen.queryByText('Remove Hex')).not.toBeInTheDocument();
    expect(cast).toBeDisabled(); // nothing confirmable across any load path
  });

  it('Cancel button fires onSkip exactly once', () => {
    // Escape→onSkip is TargetPopupBase surface, pinned with count semantics
    // in MultiTargetCountPopup.test.jsx — not duplicated here.
    render(<TargetWithCheckboxesPopup {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nope' }));
    expect(mockOnSkip).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });
});
