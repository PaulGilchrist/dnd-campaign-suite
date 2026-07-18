import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FlurryOfBlowsTargetPopup from './FlurryOfBlowsTargetPopup.jsx';

describe('FlurryOfBlowsTargetPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders creature targets with number inputs', () => {
    const creatureTargets = ['Goblin', 'Orc', 'Skeleton'];
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={creatureTargets}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByText(/Distribute Flurry of Blows Attacks/)).toBeTruthy();
    expect(screen.getByText(/3 Attacks to Assign/)).toBeTruthy();
    expect(screen.getByText(/Goblin/)).toBeTruthy();
    expect(screen.getByText(/Orc/)).toBeTruthy();
    expect(screen.getByText(/Skeleton/)).toBeTruthy();

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(3);
    expect(inputs[0]).toHaveValue(0);
    expect(inputs[1]).toHaveValue(0);
    expect(inputs[2]).toHaveValue(0);
  });

  it('auto-assigns all attacks to current target on mount', () => {
    const creatureTargets = ['Goblin', 'Orc', 'Skeleton'];
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={creatureTargets}
        currentTargetName="Orc"
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    // Orc (index 1) should have 3, others should have 0
    expect(inputs[1]).toHaveValue(3);
    expect(inputs[0]).toHaveValue(0);
    expect(inputs[2]).toHaveValue(0);
  });

  it('shows current target indicator', () => {
    const creatureTargets = ['Goblin', 'Orc', 'Skeleton'];
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={creatureTargets}
        currentTargetName="Skeleton"
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByText('Skeleton (Current)')).toBeTruthy();
  });

  it('allows changing distribution', () => {
    const creatureTargets = ['Goblin', 'Orc'];
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={creatureTargets}
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

  it('enables confirm button when all attacks are assigned', () => {
    const creatureTargets = ['Goblin', 'Orc'];
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={creatureTargets}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '2' } });
    fireEvent.change(inputs[1], { target: { value: '1' } });

    const confirmBtn = screen.getByRole('button', { name: /Strike All/ });
    expect(confirmBtn).not.toBeDisabled();
  });

  it('disables confirm button when not all attacks are assigned', () => {
    const creatureTargets = ['Goblin', 'Orc'];
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={creatureTargets}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: /Strike All/ });
    expect(confirmBtn).toBeDisabled();
  });

  it('shows assigned count summary', () => {
    const creatureTargets = ['Goblin', 'Orc'];
    const { container } = render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={creatureTargets}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(container.textContent).toContain('Assigned:');

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '1' } });
    expect(container.textContent).toContain('1 / 3');

    fireEvent.change(inputs[1], { target: { value: '2' } });
    expect(container.textContent).toContain('3 / 3');
  });

  it('calls onConfirm with distribution when confirmed', async () => {
    const creatureTargets = ['Goblin', 'Orc'];
    const onConfirm = vi.fn();
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={creatureTargets}
        onConfirm={onConfirm}
        onSkip={vi.fn()}
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '1' } });
    fireEvent.change(inputs[1], { target: { value: '2' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Strike All/ }));
    });

    expect(onConfirm).toHaveBeenCalledWith({
      distribution: { Goblin: 1, Orc: 2 },
    });
  });

  it('calls onSkip when cancel is clicked', async () => {
    const onSkip = vi.fn();
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={['Goblin']}
        onConfirm={vi.fn()}
        onSkip={onSkip}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });

    expect(onSkip).toHaveBeenCalled();
  });

  it('calls onSkip when overlay background is clicked', async () => {
    const onSkip = vi.fn();
    const { container } = render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={['Goblin']}
        onConfirm={vi.fn()}
        onSkip={onSkip}
      />
    );

    await act(async () => {
      fireEvent.click(container.querySelector('.popup-overlay'));
    });

    expect(onSkip).toHaveBeenCalled();
  });

  it('clamps input values between 0 and totalAttacks', () => {
    const creatureTargets = ['Goblin'];
    render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={3}
        creatureTargets={creatureTargets}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '10' } });
    expect(input).toHaveValue(3);

    fireEvent.change(input, { target: { value: '-5' } });
    expect(input).toHaveValue(0);
  });

  it('clamps total assigned attacks across all targets', () => {
    const creatureTargets = ['Goblin', 'Orc', 'Skeleton'];
    const { container } = render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={2}
        creatureTargets={creatureTargets}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '1' } });
    fireEvent.change(inputs[1], { target: { value: '1' } });
    expect(container.textContent).toContain('2 / 2');

    fireEvent.change(inputs[0], { target: { value: '2' } });
    expect(container.textContent).toContain('2 / 2');
    expect(inputs[0]).toHaveValue(2);
    expect(inputs[1]).toHaveValue(0);
  });

  it('handles single attack', () => {
    const creatureTargets = ['Goblin', 'Orc'];
    const { container } = render(
      <FlurryOfBlowsTargetPopup
        totalAttacks={1}
        creatureTargets={creatureTargets}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByText(/1 Attack to Assign/)).toBeTruthy();
    expect(container.textContent).toContain('Assigned:');
    expect(container.textContent).toContain('0 / 1');
  });
});
