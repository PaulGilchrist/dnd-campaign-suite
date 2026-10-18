// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FlurryOfBlowsTargetPopup from './FlurryOfBlowsTargetPopup.jsx';

describe('FlurryOfBlowsTargetPopup', () => {
  const getSummaryText = () =>
    screen.getByText(/^Assigned:/).textContent.replace(/\s+/g, ' ').trim();

  it('auto-assigns all attacks to the current target on mount', () => {
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={['Goblin', 'Orc', 'Skeleton']}
        currentTargetName="Orc"
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    // Current-target marker is part of the accessible label name.
    expect(screen.getByRole('spinbutton', { name: 'Orc (Current)' })).toHaveValue(3);
    expect(screen.getByRole('spinbutton', { name: 'Goblin' })).toHaveValue(0);
    expect(screen.getByRole('spinbutton', { name: 'Skeleton' })).toHaveValue(0);
    expect(getSummaryText()).toBe('Assigned: 3 / 3');
    expect(screen.getByRole('button', { name: 'Strike All' })).not.toBeDisabled();
  });

  it('assigns nothing when the current target is not among the creature targets', () => {
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={2}
        creatureTargets={['Goblin', 'Orc']}
        currentTargetName="Unknown"
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    // No "(Current)" marker on any target (positive leg pinned in mount test).
    expect(screen.getByRole('spinbutton', { name: 'Goblin' })).toHaveValue(0);
    expect(screen.getByRole('spinbutton', { name: 'Orc' })).toHaveValue(0);
    expect(screen.queryByRole('spinbutton', { name: /\(Current\)/ })).not.toBeInTheDocument();
    expect(getSummaryText()).toBe('Assigned: 0 / 2');
    expect(screen.getByRole('button', { name: 'Strike All' })).toBeDisabled();
  });

  it('tracks manual distribution in the summary and enables Strike All once all attacks are assigned', () => {
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={['Goblin', 'Orc']}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    const strikeAll = screen.getByRole('button', { name: 'Strike All' });
    expect(getSummaryText()).toBe('Assigned: 0 / 3');
    expect(strikeAll).toBeDisabled();

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Goblin' }), { target: { value: '2' } });
    expect(getSummaryText()).toBe('Assigned: 2 / 3');
    expect(strikeAll).toBeDisabled();

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Orc' }), { target: { value: '1' } });
    expect(getSummaryText()).toBe('Assigned: 3 / 3');
    expect(screen.getByRole('spinbutton', { name: 'Goblin' })).toHaveValue(2);
    expect(screen.getByRole('spinbutton', { name: 'Orc' })).toHaveValue(1);
    expect(strikeAll).not.toBeDisabled();
  });

  it('clamps over-allocation by reducing targets listed after the edited one', () => {
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={2}
        creatureTargets={['Goblin', 'Orc', 'Skeleton']}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Goblin' }), { target: { value: '1' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Orc' }), { target: { value: '1' } });
    expect(getSummaryText()).toBe('Assigned: 2 / 2');

    // Bumping Goblin to 2 overflows: excess is clawed back from later rows.
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Goblin' }), { target: { value: '2' } });
    expect(screen.getByRole('spinbutton', { name: 'Goblin' })).toHaveValue(2);
    expect(screen.getByRole('spinbutton', { name: 'Orc' })).toHaveValue(0);
    expect(screen.getByRole('spinbutton', { name: 'Skeleton' })).toHaveValue(0);
    expect(getSummaryText()).toBe('Assigned: 2 / 2');
  });

  it('confirms with the exact distribution payload', () => {
    const onConfirm = vi.fn();
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={['Goblin', 'Orc']}
        onConfirm={onConfirm}
        onSkip={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Goblin' }), { target: { value: '1' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Orc' }), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Strike All' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      distribution: { Goblin: 1, Orc: 2 },
    });
  });

  it('calls onSkip from the Cancel button and the Escape key', () => {
    const onSkip = vi.fn();
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={['Goblin']}
        onConfirm={vi.fn()}
        onSkip={onSkip}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onSkip).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onSkip).toHaveBeenCalledTimes(2);
  });

  it('uses singular copy for a single attack and plural copy otherwise', () => {
    const { unmount } = render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={1}
        creatureTargets={['Goblin', 'Orc']}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    // Copy lives across a <strong>, so pin its two text parts.
    expect(screen.getByText('Heightened Flurry of Blows')).toBeInTheDocument();
    expect(screen.getByText(/^— 1 Attack to Assign$/)).toBeInTheDocument();
    expect(screen.getByText(/Assign all 1 attack across targets:/)).toBeInTheDocument();
    expect(getSummaryText()).toBe('Assigned: 0 / 1');
    unmount();

    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={['Goblin']}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByText(/^— 3 Attacks to Assign$/)).toBeInTheDocument();
    expect(screen.getByText(/Assign all 3 attacks across targets:/)).toBeInTheDocument();
  });

  it('renders no target inputs but keeps the plural copy and disabled confirm when targets are empty', () => {
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={[]}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    expect(screen.getByText(/^— 3 Attacks to Assign$/)).toBeInTheDocument();
    expect(getSummaryText()).toBe('Assigned: 0 / 3');
    expect(screen.getByRole('button', { name: 'Strike All' })).toBeDisabled();
  });
});
