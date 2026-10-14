import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MagicMissileTargetPopup from './MagicMissileTargetPopup.jsx';

// ── Helpers ──

function summaryContains(assigned, total) {
  return (content, element) =>
    element !== null &&
    element.tagName.toLowerCase() === 'div' &&
    element.classList.contains('magic-missile-summary') &&
    element.textContent.includes(`${assigned}`) &&
    element.textContent.includes(`${total}`);
}

// ── Test fixtures ──

const baseSpell = {
  name: 'Magic Missile',
  level: 1,
};

const creatureTargets = ['Goblin', 'Orc', 'Bugbear'];

function makeProps(overrides = {}) {
  return {
    spell: baseSpell,
    playerStats: { name: 'Test Wizard' },
    campaignName: 'test-campaign',
    totalMissiles: 3,
    missileDamage: '1d4 + 1',
    creatureTargets,
    onConfirm: vi.fn(),
    onSkip: vi.fn(),
    ...overrides,
  };
}

// ── Tests ──

describe('MagicMissileTargetPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Default rendering ──

  it('renders the popup with title, spell name, missile count, damage info, creature targets, inputs, and buttons', () => {
    render(<MagicMissileTargetPopup {...makeProps()} />);
    expect(screen.getByText(/Distribute Magic Missiles/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Magic Missile/i)[1]).toBeInTheDocument();
    expect(screen.getByText(/3 Missiles to Assign/)).toBeInTheDocument();
    expect(screen.getByText(/1d4 \+ 1/)).toBeInTheDocument();
    expect(screen.getByText(/Force damage/)).toBeInTheDocument();
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('Orc')).toBeInTheDocument();
    expect(screen.getByText('Bugbear')).toBeInTheDocument();
    expect(screen.getAllByRole('spinbutton')).toHaveLength(3);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cast All Missiles/i })).toBeInTheDocument();
  });

  it('shows singular "Missile" when totalMissiles is 1', () => {
    render(<MagicMissileTargetPopup {...makeProps({ totalMissiles: 1 })} />);
    expect(screen.getByText(/1 Missile to Assign/)).toBeInTheDocument();
  });

  // ── Initial state ──

  it('defaults all targets to 0 with disabled cast button', () => {
    render(<MagicMissileTargetPopup {...makeProps()} />);
    const inputs = screen.getAllByRole('spinbutton');
    inputs.forEach(input => expect(input).toHaveValue(0));
    expect(screen.getByText(summaryContains(0, 3))).toBeInTheDocument();
    const castButton = screen.getByRole('button', { name: /Cast All Missiles/i });
    expect(castButton).toBeDisabled();
  });

  // ── Current target highlighting ──

  it('marks current target with (Current) label', () => {
    render(<MagicMissileTargetPopup {...makeProps({ currentTargetName: 'Orc' })} />);
    expect(screen.getByText(/Orc \(Current\)/i)).toBeInTheDocument();
  });

  it('does not highlight any row when currentTargetName is not in the list', () => {
    render(<MagicMissileTargetPopup {...makeProps({ currentTargetName: 'Unknown Creature' })} />);
    creatureTargets.forEach(name => {
      expect(screen.getByText(name)).toBeInTheDocument();
      expect(screen.queryByText(new RegExp(`${name} \\(Current\\)`))).not.toBeInTheDocument();
    });
  });

  // ── currentTargetName auto-assigns missiles ──

  it('auto-assigns all missiles to currentTargetName on mount when its value is 0', () => {
    render(<MagicMissileTargetPopup {...makeProps({ currentTargetName: 'Orc' })} />);
    const inputs = screen.getAllByRole('spinbutton');
    const orcIndex = creatureTargets.indexOf('Orc');
    expect(inputs[orcIndex]).toHaveValue(3);
    expect(screen.getByText(summaryContains(3, 3))).toBeInTheDocument();
  });

  // ── Input validation ──

  it('updates total assigned when input changes', () => {
    render(<MagicMissileTargetPopup {...makeProps()} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '2' } });
    expect(screen.getByText(summaryContains(2, 3))).toBeInTheDocument();
  });

  it('prevents negative, empty, non-numeric, and clamps values exceeding total missiles', () => {
    render(<MagicMissileTargetPopup {...makeProps()} />);
    const inputs = screen.getAllByRole('spinbutton');

    fireEvent.change(inputs[0], { target: { value: '-5' } });
    expect(screen.getByText(summaryContains(0, 3))).toBeInTheDocument();

    fireEvent.change(inputs[0], { target: { value: '' } });
    expect(screen.getByText(summaryContains(0, 3))).toBeInTheDocument();

    fireEvent.change(inputs[0], { target: { value: 'abc' } });
    expect(screen.getByText(summaryContains(0, 3))).toBeInTheDocument();

    fireEvent.change(inputs[0], { target: { value: '99' } });
    expect(inputs[0]).toHaveValue(3);
    expect(screen.getByText(summaryContains(3, 3))).toBeInTheDocument();
  });

  // ── Cast button state ──

  it.each`
    assigned  | expectedDisabled
    ${0}      | ${true}
    ${1}      | ${true}
    ${3}      | ${false}
  `('cast button is $expectedDisabled when $assigned of 3 missiles assigned', ({ assigned, expectedDisabled }) => {
    render(<MagicMissileTargetPopup {...makeProps()} />);
    const inputs = screen.getAllByRole('spinbutton');
    if (assigned > 0) {
      fireEvent.change(inputs[0], { target: { value: String(assigned) } });
    }
    const castButton = screen.getByRole('button', { name: /Cast All Missiles/i });
    if (expectedDisabled) {
      expect(castButton).toBeDisabled();
    } else {
      expect(castButton).not.toBeDisabled();
    }
  });

  // ── Confirm / skip callbacks ──

  it('calls onConfirm with distribution when all missiles assigned and cast clicked', () => {
    const onConfirm = vi.fn();
    render(<MagicMissileTargetPopup {...makeProps({ onConfirm })} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '2' } });
    fireEvent.change(inputs[1], { target: { value: '1' } });
    const castButton = screen.getByRole('button', { name: /Cast All Missiles/i });
    fireEvent.click(castButton);
    expect(onConfirm).toHaveBeenCalledWith({
      distribution: { Goblin: 2, Orc: 1, Bugbear: 0 },
    });
  });

  it('calls onSkip when Cancel button or Escape key triggers skip', () => {
    const onSkip = vi.fn();
    render(<MagicMissileTargetPopup {...makeProps({ onSkip })} />);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onSkip).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onSkip).toHaveBeenCalledTimes(2);
  });

  // ── Edge cases ──

  it('renders with empty creature targets', () => {
    render(<MagicMissileTargetPopup {...makeProps({ creatureTargets: [] })} />);
    expect(screen.getByRole('button', { name: /Cast All Missiles/i })).toBeInTheDocument();
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
  });

  it('handles zero missiles: shows 0/0, enables cast, and confirms with all zeros', () => {
    const onConfirm = vi.fn();
    render(<MagicMissileTargetPopup {...makeProps({ totalMissiles: 0, onConfirm })} />);
    expect(screen.getByText(summaryContains(0, 0))).toBeInTheDocument();
    const castButton = screen.getByRole('button', { name: /Cast All Missiles/i });
    expect(castButton).not.toBeDisabled();
    fireEvent.click(castButton);
    expect(onConfirm).toHaveBeenCalledWith({
      distribution: { Goblin: 0, Orc: 0, Bugbear: 0 },
    });
  });

  it('handles null or missing spell name gracefully', () => {
    const { rerender } = render(<MagicMissileTargetPopup {...makeProps({ spell: null })} />);
    expect(screen.getByText(/Spell/)).toBeInTheDocument();
    rerender(<MagicMissileTargetPopup {...makeProps({ spell: {} })} />);
    expect(screen.getByText(/Spell/)).toBeInTheDocument();
  });

  // ── currentTargetName re-render behavior ──

  it.each([
    { desc: 'preserves existing distribution when currentTarget has missiles', initial: {}, rerender: { currentTargetName: 'Goblin' }, idx: 0, val: 2, setupInput: 0, setupVal: '2' },
    { desc: 'assigns missiles to new currentTarget when it was at 0', initial: { currentTargetName: 'Goblin' }, rerender: { currentTargetName: 'Bugbear', totalMissiles: 5 }, idx: 2, val: 5, setupInput: null, setupVal: null },
    { desc: 'does not clear previous target when currentTarget changes', initial: { currentTargetName: 'Goblin' }, rerender: { currentTargetName: 'Orc', totalMissiles: 4 }, idx: 1, val: 4, setupInput: null, setupVal: null },
    { desc: 'does not re-assign when currentTarget already has missiles', initial: {}, rerender: { currentTargetName: 'Orc', totalMissiles: 5 }, idx: 1, val: 2, setupInput: 1, setupVal: '2' },
    { desc: 'does not assign when currentTarget is not in creatureTargets', initial: { currentTargetName: 'Goblin' }, rerender: { currentTargetName: 'Unknown Creature' }, idx: 0, val: 3, setupInput: null, setupVal: null },
  ])('when currentTargetName changes: $desc', ({ initial, rerender: rerenderProps, idx, val, setupInput, setupVal }) => {
    const { rerender } = render(<MagicMissileTargetPopup {...makeProps({ ...initial })} />);

    if (setupInput !== null) {
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[setupInput], { target: { value: setupVal } });
    }

    rerender(<MagicMissileTargetPopup {...makeProps({ ...rerenderProps })} />);
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs[idx]).toHaveValue(val);
  });
});
