import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FlurryOfBlowsTargetPopup from './FlurryOfBlowsTargetPopup.jsx';

describe('FlurryOfBlowsTargetPopup', () => {
  const getSummaryText = (container) =>
    container.querySelector('.flurry-summary').textContent.trim();

  it('auto-assigns all attacks to current target on mount', () => {
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={['Goblin', 'Orc', 'Skeleton']}
        currentTargetName="Orc"
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs[1]).toHaveValue(3);
    expect(inputs[0]).toHaveValue(0);
    expect(inputs[2]).toHaveValue(0);
  });

  it('does not auto-assign when current target is not in the creature list', () => {
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={['Goblin', 'Orc']}
        currentTargetName="Unknown"
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs[0]).toHaveValue(0);
    expect(inputs[1]).toHaveValue(0);
  });

  it('allows changing distribution', () => {
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={['Goblin', 'Orc']}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '2' } });
    fireEvent.change(inputs[1], { target: { value: '1' } });

    expect(inputs[0]).toHaveValue(2);
    expect(inputs[1]).toHaveValue(1);
  });

  it('enables confirm button when all attacks are assigned and disables when not', () => {
    const { rerender } = render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={['Goblin', 'Orc']}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Strike All/ })).toBeDisabled();

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '2' } });
    fireEvent.change(inputs[1], { target: { value: '1' } });

    expect(screen.getByRole('button', { name: /Strike All/ })).not.toBeDisabled();

    rerender(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={['Goblin', 'Orc']}
        currentTargetName="Goblin"
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Strike All/ })).not.toBeDisabled();
  });

  it('updates assigned count summary as inputs change', () => {
    const { container } = render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={['Goblin', 'Orc']}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(getSummaryText(container)).toBe('Assigned: 0 / 3');

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '1' } });
    expect(getSummaryText(container)).toBe('Assigned: 1 / 3');

    fireEvent.change(inputs[1], { target: { value: '2' } });
    expect(getSummaryText(container)).toBe('Assigned: 3 / 3');
  });

  it('calls onConfirm with distribution when confirmed', () => {
    const onConfirm = vi.fn();
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={['Goblin', 'Orc']}
        onConfirm={onConfirm}
        onSkip={vi.fn()}
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '1' } });
    fireEvent.change(inputs[1], { target: { value: '2' } });

    fireEvent.click(screen.getByRole('button', { name: /Strike All/ }));

    expect(onConfirm).toHaveBeenCalledWith({
      distribution: { Goblin: 1, Orc: 2 },
    });
  });

  it('does not call onConfirm when not all attacks are assigned', () => {
    const onConfirm = vi.fn();
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={['Goblin', 'Orc']}
        onConfirm={onConfirm}
        onSkip={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Strike All/ }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onSkip when canceling via button or Escape key', () => {
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
  });

  it('clamps total assigned attacks across all targets', () => {
    const { container } = render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={2}
        creatureTargets={['Goblin', 'Orc', 'Skeleton']}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '1' } });
    fireEvent.change(inputs[1], { target: { value: '1' } });
    expect(getSummaryText(container)).toBe('Assigned: 2 / 2');

    fireEvent.change(inputs[0], { target: { value: '2' } });
    expect(getSummaryText(container)).toBe('Assigned: 2 / 2');
    expect(inputs[0]).toHaveValue(2);
    expect(inputs[1]).toHaveValue(0);
  });

  it('handles single attack with singular wording', () => {
    const { container } = render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={1}
        creatureTargets={['Goblin', 'Orc']}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByText(/1 Attack to Assign/)).toBeInTheDocument();
    expect(getSummaryText(container)).toBe('Assigned: 0 / 1');
  });

  it('auto-assigns to current target even with single attack', () => {
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={1}
        creatureTargets={['Goblin', 'Orc']}
        currentTargetName="Goblin"
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs[0]).toHaveValue(1);
    expect(inputs[1]).toHaveValue(0);
  });

  it('renders with empty creature targets', () => {
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={[]}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByText(/3 Attacks to Assign/)).toBeInTheDocument();
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
  });
});
