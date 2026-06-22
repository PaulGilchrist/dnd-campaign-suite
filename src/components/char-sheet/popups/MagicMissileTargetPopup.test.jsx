// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MagicMissileTargetPopup from './MagicMissileTargetPopup.jsx';

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

  it('renders the popup title with bolt icon', () => {
    render(<MagicMissileTargetPopup {...makeProps()} />);
    expect(screen.getByText(/Distribute Magic Missiles/i)).toBeInTheDocument();
    const icon = document.querySelector('.fa-solid.fa-bolt');
    expect(icon).toBeInTheDocument();
  });

  it('displays spell name and missile count', () => {
    render(<MagicMissileTargetPopup {...makeProps()} />);
    expect(screen.getAllByText(/Magic Missile/i)[1]).toBeInTheDocument();
  });

  it('shows singular "Missile" when totalMissiles is 1', () => {
    render(<MagicMissileTargetPopup {...makeProps({ totalMissiles: 1 })} />);
    expect(screen.getByText(/1 Missile to Assign/)).toBeInTheDocument();
  });

  it('shows plural "Missiles" when totalMissiles > 1', () => {
    render(<MagicMissileTargetPopup {...makeProps({ totalMissiles: 5 })} />);
    expect(screen.getByText(/5 Missiles to Assign/)).toBeInTheDocument();
  });

  it('shows per-missile damage and type', () => {
    const { container } = render(<MagicMissileTargetPopup {...makeProps()} />);
    const inner = container.querySelector('.magic-missile-popup-inner');
    expect(inner.textContent).toContain('1d4 + 1');
    expect(inner.textContent).toContain('Force');
  });

  it('renders all creature targets', () => {
    render(<MagicMissileTargetPopup {...makeProps()} />);
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('Orc')).toBeInTheDocument();
    expect(screen.getByText('Bugbear')).toBeInTheDocument();
  });

  it('renders number inputs for each target', () => {
    render(<MagicMissileTargetPopup {...makeProps()} />);
    expect(screen.getAllByRole('spinbutton')).toHaveLength(3);
  });

  it('renders Cancel and Cast buttons', () => {
    render(<MagicMissileTargetPopup {...makeProps()} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cast All Missiles/i })).toBeInTheDocument();
  });

  it('renders with popup-overlay class', () => {
    render(<MagicMissileTargetPopup {...makeProps()} />);
    expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
  });

  // ── Initial state ──

  it('defaults all targets to 0', () => {
    render(<MagicMissileTargetPopup {...makeProps()} />);
    const inputs = screen.getAllByRole('spinbutton');
    inputs.forEach(input => expect(input).toHaveValue(0));
  });

  it('shows 0/3 total assigned initially', () => {
    const { container } = render(<MagicMissileTargetPopup {...makeProps()} />);
    const summary = container.querySelector('.magic-missile-summary');
    expect(summary.textContent).toContain('0');
    expect(summary.textContent).toContain('3');
  });

  it('disables cast button when missiles unassigned', () => {
    render(<MagicMissileTargetPopup {...makeProps()} />);
    const castButton = screen.getByRole('button', { name: /Cast All Missiles/i });
    expect(castButton).toBeDisabled();
  });

  it('does not call onConfirm when cast clicked with unassigned missiles', () => {
    const onConfirm = vi.fn();
    render(<MagicMissileTargetPopup {...makeProps({ onConfirm })} />);
    const castButton = screen.getByRole('button', { name: /Cast All Missiles/i });
    fireEvent.click(castButton);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // ── Current target highlighting ──

  it('marks current target with (Current) label', () => {
    render(<MagicMissileTargetPopup {...makeProps({ currentTargetName: 'Orc' })} />);
    expect(screen.getByText(/Orc \(Current\)/i)).toBeInTheDocument();
  });

  it('highlights current target row with CSS class', () => {
    const { container } = render(<MagicMissileTargetPopup {...makeProps({ currentTargetName: 'Bugbear' })} />);
    const rows = container.querySelectorAll('.magic-missile-target-row');
    const bugbearRow = Array.from(rows).find(row => row.textContent?.includes('Bugbear'));
    expect(bugbearRow).toHaveClass('magic-missile-current-target');
  });

  it('does not highlight any row when currentTargetName is undefined', () => {
    const { container } = render(<MagicMissileTargetPopup {...makeProps({ currentTargetName: undefined })} />);
    const rows = container.querySelectorAll('.magic-missile-target-row');
    rows.forEach(row => expect(row).not.toHaveClass('magic-missile-current-target'));
  });

  it('does not highlight any row when currentTargetName is not in the list', () => {
    const { container } = render(<MagicMissileTargetPopup {...makeProps({ currentTargetName: 'Unknown Creature' })} />);
    const rows = container.querySelectorAll('.magic-missile-target-row');
    rows.forEach(row => expect(row).not.toHaveClass('magic-missile-current-target'));
  });

  // ── currentTargetName auto-assigns missiles ──

  it('auto-assigns all missiles to currentTargetName on mount when its value is 0', () => {
    const { container } = render(<MagicMissileTargetPopup {...makeProps({ currentTargetName: 'Orc' })} />);
    const inputs = screen.getAllByRole('spinbutton');
    const orcIndex = creatureTargets.indexOf('Orc');
    const summary = container.querySelector('.magic-missile-summary');
    expect(inputs[orcIndex]).toHaveValue(3);
    expect(summary.textContent).toContain('3');
  });

  // ── Input validation ──

  it('updates total assigned when input changes', () => {
    const { container } = render(<MagicMissileTargetPopup {...makeProps()} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '2' } });
    const summary = container.querySelector('.magic-missile-summary');
    expect(summary.textContent).toContain('2');
    expect(summary.textContent).toContain('3');
  });

  it('prevents negative values', () => {
    const { container } = render(<MagicMissileTargetPopup {...makeProps()} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '-5' } });
    const summary = container.querySelector('.magic-missile-summary');
    expect(summary.textContent).toContain('0');
  });

  it('clamps values exceeding total missiles', () => {
    const { container } = render(<MagicMissileTargetPopup {...makeProps({ totalMissiles: 3 })} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '10' } });
    const summary = container.querySelector('.magic-missile-summary');
    expect(summary.textContent).toContain('3');
  });

  it('handles empty string input as 0', () => {
    const { container } = render(<MagicMissileTargetPopup {...makeProps()} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '' } });
    const summary = container.querySelector('.magic-missile-summary');
    expect(summary.textContent).toContain('0');
  });

  it('handles non-numeric input as 0', () => {
    const { container } = render(<MagicMissileTargetPopup {...makeProps()} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: 'abc' } });
    const summary = container.querySelector('.magic-missile-summary');
    expect(summary.textContent).toContain('0');
  });

  it('clamps numeric input to totalMissiles even when non-numeric fallback would apply', () => {
    const { container } = render(<MagicMissileTargetPopup {...makeProps({ totalMissiles: 2 })} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '99' } });
    const summary = container.querySelector('.magic-missile-summary');
    expect(summary.textContent).toContain('2');
  });

  // ── Cast button state ──

  it('enables cast button when all missiles assigned', () => {
    render(<MagicMissileTargetPopup {...makeProps()} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '2' } });
    fireEvent.change(inputs[1], { target: { value: '1' } });
    const castButton = screen.getByRole('button', { name: /Cast All Missiles/i });
    expect(castButton).not.toBeDisabled();
  });

  it('enables cast button when all missiles assigned to single target', () => {
    render(<MagicMissileTargetPopup {...makeProps()} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '3' } });
    const castButton = screen.getByRole('button', { name: /Cast All Missiles/i });
    expect(castButton).not.toBeDisabled();
  });

  it('disables cast button when only partial missiles assigned', () => {
    render(<MagicMissileTargetPopup {...makeProps()} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '1' } });
    const castButton = screen.getByRole('button', { name: /Cast All Missiles/i });
    expect(castButton).toBeDisabled();
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

  it('includes all creature targets in distribution even those with 0 missiles', () => {
    const onConfirm = vi.fn();
    render(<MagicMissileTargetPopup {...makeProps({ onConfirm })} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '3' } });
    const castButton = screen.getByRole('button', { name: /Cast All Missiles/i });
    fireEvent.click(castButton);
    const callArgs = onConfirm.mock.calls[0][0];
    expect(callArgs.distribution).toHaveProperty('Bugbear', 0);
    expect(callArgs.distribution).toHaveProperty('Orc', 0);
  });

  it('calls onSkip when Cancel button is clicked', () => {
    const onSkip = vi.fn();
    render(<MagicMissileTargetPopup {...makeProps({ onSkip })} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('calls onSkip when overlay is clicked', () => {
    const onSkip = vi.fn();
    render(<MagicMissileTargetPopup {...makeProps({ onSkip })} />);
    const overlay = document.querySelector('.popup-overlay');
    fireEvent.click(overlay);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('does not call onSkip when modal content is clicked', () => {
    const onSkip = vi.fn();
    render(<MagicMissileTargetPopup {...makeProps({ onSkip })} />);
    const modal = document.querySelector('.magic-missile-popup');
    fireEvent.click(modal);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('calls onSkip on Escape key', () => {
    const onSkip = vi.fn();
    render(<MagicMissileTargetPopup {...makeProps({ onSkip })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('does not call onSkip for non-Escape keys', () => {
    const onSkip = vi.fn();
    render(<MagicMissileTargetPopup {...makeProps({ onSkip })} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('does not call onSkip for other modifier keys', () => {
    const onSkip = vi.fn();
    render(<MagicMissileTargetPopup {...makeProps({ onSkip })} />);
    fireEvent.keyDown(document, { key: 'a' });
    expect(onSkip).not.toHaveBeenCalled();
  });

  // ── Edge cases ──

  it('renders with empty creature targets list', () => {
    render(<MagicMissileTargetPopup {...makeProps({ creatureTargets: [] })} />);
    expect(screen.getByRole('button', { name: /Cast All Missiles/i })).toBeInTheDocument();
    const inputs = screen.queryAllByRole('spinbutton');
    expect(inputs).toHaveLength(0);
  });

  it('shows 0/0 when totalMissiles is 0', () => {
    const { container } = render(<MagicMissileTargetPopup {...makeProps({ totalMissiles: 0 })} />);
    const summary = container.querySelector('.magic-missile-summary');
    expect(summary.textContent).toContain('0');
    expect(summary.textContent).toContain('0');
  });

  it('enables cast button when totalMissiles is 0 (nothing to assign)', () => {
    render(<MagicMissileTargetPopup {...makeProps({ totalMissiles: 0 })} />);
    const castButton = screen.getByRole('button', { name: /Cast All Missiles/i });
    expect(castButton).not.toBeDisabled();
  });

  it('calls onConfirm with creature targets all at 0 when totalMissiles is 0', () => {
    const onConfirm = vi.fn();
    render(<MagicMissileTargetPopup {...makeProps({ totalMissiles: 0, onConfirm })} />);
    const castButton = screen.getByRole('button', { name: /Cast All Missiles/i });
    fireEvent.click(castButton);
    expect(onConfirm).toHaveBeenCalledWith({
      distribution: { Goblin: 0, Orc: 0, Bugbear: 0 },
    });
  });

  it('handles null spell gracefully', () => {
    render(<MagicMissileTargetPopup {...makeProps({ spell: null })} />);
    expect(screen.getByText(/Spell/)).toBeInTheDocument();
  });

  it('handles spell with missing name gracefully', () => {
    render(<MagicMissileTargetPopup {...makeProps({ spell: {} })} />);
    expect(screen.getByText(/Spell/)).toBeInTheDocument();
  });

  // ── Keyboard listener cleanup ──

  it('removes keydown listener on unmount', () => {
    const removeListenerSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<MagicMissileTargetPopup {...makeProps()} />);
    unmount();
    expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  // ── currentTargetName re-render behavior ──

  it('does not override existing distribution when currentTargetName already has missiles', () => {
    const { container, rerender } = render(<MagicMissileTargetPopup {...makeProps()} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '2' } });
    rerender(<MagicMissileTargetPopup {...makeProps({ currentTargetName: 'Goblin' })} />);
    const summary = container.querySelector('.magic-missile-summary');
    expect(summary.textContent).toContain('2');
  });

  it('assigns missiles to new currentTargetName when it was at 0 and previous target already had missiles from auto-assign', () => {
    const { container, rerender } = render(<MagicMissileTargetPopup {...makeProps({ currentTargetName: 'Goblin' })} />);
    const inputs = screen.getAllByRole('spinbutton');
    const goblinIndex = creatureTargets.indexOf('Goblin');
    expect(inputs[goblinIndex]).toHaveValue(3);
    rerender(<MagicMissileTargetPopup {...makeProps({ currentTargetName: 'Bugbear', totalMissiles: 5 })} />);
    const bugbearIndex = creatureTargets.indexOf('Bugbear');
    expect(inputs[bugbearIndex]).toHaveValue(5);
    const summary = container.querySelector('.magic-missile-summary');
    expect(summary.textContent).toContain('5');
  });

  it('does not clear previous target when currentTargetName changes to a different target', () => {
    const { container, rerender } = render(<MagicMissileTargetPopup {...makeProps({ currentTargetName: 'Goblin' })} />);
    const inputs = screen.getAllByRole('spinbutton');
    const goblinIndex = creatureTargets.indexOf('Goblin');
    expect(inputs[goblinIndex]).toHaveValue(3);
    rerender(<MagicMissileTargetPopup {...makeProps({ currentTargetName: 'Orc', totalMissiles: 4 })} />);
    const orcIndex = creatureTargets.indexOf('Orc');
    expect(inputs[orcIndex]).toHaveValue(4);
    const summary = container.querySelector('.magic-missile-summary');
    expect(summary.textContent).toContain('7');
  });

  it('does not re-assign when currentTargetName changes to a target that already has missiles from user input', () => {
    const { container, rerender } = render(<MagicMissileTargetPopup {...makeProps()} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[1], { target: { value: '2' } });
    rerender(<MagicMissileTargetPopup {...makeProps({ currentTargetName: 'Orc', totalMissiles: 5 })} />);
    const orcIndex = creatureTargets.indexOf('Orc');
    expect(inputs[orcIndex]).toHaveValue(2);
    const summary = container.querySelector('.magic-missile-summary');
    expect(summary.textContent).toContain('2');
  });

  it('does not assign missiles when currentTargetName changes to a value not in creatureTargets list on re-render', () => {
    const { container, rerender } = render(<MagicMissileTargetPopup {...makeProps({ currentTargetName: 'Goblin' })} />);
    const inputs = screen.getAllByRole('spinbutton');
    const goblinIndex = creatureTargets.indexOf('Goblin');
    expect(inputs[goblinIndex]).toHaveValue(3);
    rerender(<MagicMissileTargetPopup {...makeProps({ currentTargetName: 'Unknown Creature' })} />);
    expect(inputs[goblinIndex]).toHaveValue(3);
    const summary = container.querySelector('.magic-missile-summary');
    expect(summary.textContent).toContain('3');
  });
});
