// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MagicMissileTargetPopup from './MagicMissileTargetPopup.jsx';

describe('MagicMissileTargetPopup', () => {
  const targets = ['Goblin', 'Orc', 'Bugbear'];

  const getSummaryText = () =>
    screen.getByText(/^Assigned:/).textContent.replace(/\s+/g, ' ').trim();

  // Copy lives across a <strong>, so pin the whole paragraph from its strong node.
  const lineText = (strongText) =>
    screen.getByText(strongText).closest('p').textContent.replace(/\s+/g, ' ').trim();

  const popup = (props = {}) => (
    <MagicMissileTargetPopup
      spell={{ name: 'Magic Missile', level: 1 }}
      totalMissiles={3}
      missileDamage="1d4 + 1"
      creatureTargets={targets}
      onConfirm={vi.fn()}
      onSkip={vi.fn()}
      {...props}
    />
  );

  it('renders the spell brief, one labelled row per target, and a disabled cast when nothing is assigned', () => {
    const { rerender } = render(popup());

    expect(screen.getByRole('heading', { name: /Distribute Magic Missiles/i })).toBeInTheDocument();
    expect(lineText('Magic Missile')).toBe('Magic Missile — 3 Missiles to Assign');
    expect(lineText('1d4 + 1')).toBe('Each missile deals 1d4 + 1 Force damage. Assign all 3 missiles across targets:');
    expect(screen.getAllByRole('spinbutton')).toHaveLength(3);
    expect(screen.getByRole('spinbutton', { name: 'Goblin' })).toHaveValue(0);
    expect(screen.getByRole('spinbutton', { name: 'Orc' })).toHaveValue(0);
    expect(screen.getByRole('spinbutton', { name: 'Bugbear' })).toHaveValue(0);
    // No "(Current)" marker when no current target is passed (positive leg pinned below).
    expect(screen.queryAllByText(/\(Current\)/)).toHaveLength(0);
    expect(getSummaryText()).toBe('Assigned: 0 / 3');
    expect(screen.getByRole('button', { name: 'Cast All Missiles' })).toBeDisabled();

    // Missing spell name falls back to "Spell"; singular copy at 1 missile.
    rerender(popup({ spell: null, totalMissiles: 1 }));
    expect(lineText('Spell')).toBe('Spell — 1 Missile to Assign');
    expect(lineText('1d4 + 1')).toBe('Each missile deals 1d4 + 1 Force damage. Assign all 1 missile across targets:');
    expect(getSummaryText()).toBe('Assigned: 0 / 1');
  });

  it('auto-assigns all missiles to the current target on mount', () => {
    render(popup({ currentTargetName: 'Orc' }));

    // Current-target marker is part of the accessible label name.
    expect(screen.getByRole('spinbutton', { name: 'Orc (Current)' })).toHaveValue(3);
    expect(screen.getByRole('spinbutton', { name: 'Goblin' })).toHaveValue(0);
    expect(screen.getByRole('spinbutton', { name: 'Bugbear' })).toHaveValue(0);
    expect(getSummaryText()).toBe('Assigned: 3 / 3');
    expect(screen.getByRole('button', { name: 'Cast All Missiles' })).not.toBeDisabled();
  });

  it('assigns nothing and disables cast when the current target is not among the targets', () => {
    render(popup({ currentTargetName: 'Unknown Creature' }));

    expect(screen.getByRole('spinbutton', { name: 'Goblin' })).toHaveValue(0);
    expect(screen.getByRole('spinbutton', { name: 'Orc' })).toHaveValue(0);
    expect(screen.getByRole('spinbutton', { name: 'Bugbear' })).toHaveValue(0);
    expect(screen.queryByRole('spinbutton', { name: /\(Current\)/ })).not.toBeInTheDocument();
    expect(getSummaryText()).toBe('Assigned: 0 / 3');
    expect(screen.getByRole('button', { name: 'Cast All Missiles' })).toBeDisabled();
  });

  it('clamps invalid input, tracks the total in the summary, and confirms once with the exact payload', () => {
    const onConfirm = vi.fn();
    render(popup({ onConfirm }));

    const goblin = screen.getByRole('spinbutton', { name: 'Goblin' });
    const cast = screen.getByRole('button', { name: 'Cast All Missiles' });

    // Negative, empty, and non-numeric input all clamp to 0.
    for (const invalid of ['-5', '', 'abc']) {
      fireEvent.change(goblin, { target: { value: invalid } });
      expect(goblin).toHaveValue(0);
      expect(getSummaryText()).toBe('Assigned: 0 / 3');
    }
    expect(cast).toBeDisabled();

    // Over-total input clamps to the max; the full assignment enables cast.
    fireEvent.change(goblin, { target: { value: '99' } });
    expect(goblin).toHaveValue(3);
    expect(getSummaryText()).toBe('Assigned: 3 / 3');
    expect(cast).not.toBeDisabled();

    // Partial distribution re-disables until every missile is assigned.
    fireEvent.change(goblin, { target: { value: '2' } });
    expect(getSummaryText()).toBe('Assigned: 2 / 3');
    expect(cast).toBeDisabled();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Orc' }), { target: { value: '1' } });
    expect(goblin).toHaveValue(2);
    expect(screen.getByRole('spinbutton', { name: 'Orc' })).toHaveValue(1);
    expect(getSummaryText()).toBe('Assigned: 3 / 3');

    fireEvent.click(screen.getByRole('button', { name: 'Cast All Missiles' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      distribution: { Goblin: 2, Orc: 1, Bugbear: 0 },
    });
  });

  it('preserves assigned rows, auto-assigns the full total to a newly-selected zero row, and ignores unknown current targets', () => {
    const { rerender } = render(popup());
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Goblin' }), { target: { value: '2' } });

    // Making a non-zero row current preserves its manual allocation.
    rerender(popup({ currentTargetName: 'Goblin' }));
    expect(screen.getByRole('spinbutton', { name: 'Goblin (Current)' })).toHaveValue(2);
    expect(getSummaryText()).toBe('Assigned: 2 / 3');

    // A newly-selected zero row receives the FULL total even while earlier
    // rows hold missiles — the 5 / 3 summary keeps cast disabled until fixed.
    rerender(popup({ currentTargetName: 'Orc' }));
    expect(screen.getByRole('spinbutton', { name: 'Goblin' })).toHaveValue(2);
    expect(screen.getByRole('spinbutton', { name: 'Orc (Current)' })).toHaveValue(3);
    expect(screen.getByRole('spinbutton', { name: 'Bugbear' })).toHaveValue(0);
    expect(getSummaryText()).toBe('Assigned: 5 / 3');
    expect(screen.getByRole('button', { name: 'Cast All Missiles' })).toBeDisabled();

    // An unknown current target changes nothing and earns no marker.
    rerender(popup({ currentTargetName: 'Unknown Creature' }));
    expect(screen.queryByRole('spinbutton', { name: /\(Current\)/ })).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Goblin' })).toHaveValue(2);
    expect(screen.getByRole('spinbutton', { name: 'Orc' })).toHaveValue(3);
    expect(screen.getByRole('spinbutton', { name: 'Bugbear' })).toHaveValue(0);
  });

  it('calls onSkip from the Cancel button and the Escape key', () => {
    const onSkip = vi.fn();
    render(popup({ onSkip }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onSkip).toHaveBeenCalledTimes(1);

    // The component registers a document keydown guard for Escape.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onSkip).toHaveBeenCalledTimes(2);
  });

  it('renders no target rows and keeps cast disabled when creature targets are empty', () => {
    render(popup({ creatureTargets: [] }));

    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    expect(getSummaryText()).toBe('Assigned: 0 / 3');
    expect(screen.getByRole('button', { name: 'Cast All Missiles' })).toBeDisabled();
  });
});
