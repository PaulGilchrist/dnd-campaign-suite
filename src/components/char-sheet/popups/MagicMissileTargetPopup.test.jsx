import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MagicMissileTargetPopup from './MagicMissileTargetPopup.jsx';

function getTextContent(container, tag) {
  const el = container.querySelector(tag);
  return el ? el.textContent : '';
}

describe('MagicMissileTargetPopup', () => {
  const baseProps = {
    spell: { name: 'Magic Missile', level: 1 },
    playerStats: { name: 'Test Wizard' },
    campaignName: 'test-campaign',
    totalMissiles: 3,
    missileDamage: '1d4 + 1',
    creatureTargets: ['Goblin', 'Orc', 'Bugbear'],
    onConfirm: vi.fn(),
    onSkip: vi.fn(),
  };

  it('renders the popup title and spell name', () => {
    render(<MagicMissileTargetPopup {...baseProps} />);
    expect(screen.getByText(/Distribute Magic Missiles/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Magic Missile/i)[1]).toBeInTheDocument();
  });

  it('shows the correct missile count', () => {
    const { container } = render(<MagicMissileTargetPopup {...baseProps} totalMissiles={5} />);
    expect(getTextContent(container, '.metamagic-spell-name')).toContain('5 Missile');
  });

  it('shows per-missile damage', () => {
    const { container } = render(<MagicMissileTargetPopup {...baseProps} />);
    expect(getTextContent(container, '.magic-missile-popup-inner')).toContain('1d4 + 1');
    expect(getTextContent(container, '.magic-missile-popup-inner')).toContain('Force');
  });

  it('renders all creature targets', () => {
    render(<MagicMissileTargetPopup {...baseProps} />);
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('Orc')).toBeInTheDocument();
    expect(screen.getByText('Bugbear')).toBeInTheDocument();
  });

  it('renders number inputs for each target', () => {
    render(<MagicMissileTargetPopup {...baseProps} />);
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(3);
  });

  it('shows correct total assigned (0/3 initially)', () => {
    const { container } = render(<MagicMissileTargetPopup {...baseProps} />);
    expect(getTextContent(container, '.magic-missile-summary')).toContain('0');
    expect(getTextContent(container, '.magic-missile-summary')).toContain('3');
  });

  it('updates total assigned when input changes', () => {
    const { container } = render(<MagicMissileTargetPopup {...baseProps} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '2' } });
    expect(getTextContent(container, '.magic-missile-summary')).toContain('2');
    expect(getTextContent(container, '.magic-missile-summary')).toContain('3');
  });

  it('prevents negative values', () => {
    const { container } = render(<MagicMissileTargetPopup {...baseProps} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '-5' } });
    expect(getTextContent(container, '.magic-missile-summary')).toContain('0');
  });

  it('prevents exceeding total missiles', () => {
    const { container } = render(<MagicMissileTargetPopup {...baseProps} totalMissiles={3} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '10' } });
    expect(getTextContent(container, '.magic-missile-summary')).toContain('3');
  });

  it('enables cast button when all missiles assigned', () => {
    render(<MagicMissileTargetPopup {...baseProps} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '2' } });
    fireEvent.change(inputs[1], { target: { value: '1' } });
    const castButton = screen.getByRole('button', { name: /Cast All Missiles/i });
    expect(castButton).not.toBeDisabled();
  });

  it('disables cast button when missiles unassigned', () => {
    render(<MagicMissileTargetPopup {...baseProps} />);
    const castButton = screen.getByRole('button', { name: /Cast All Missiles/i });
    expect(castButton).toBeDisabled();
  });

  it('calls onConfirm with distribution when cast clicked', () => {
    render(<MagicMissileTargetPopup {...baseProps} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '2' } });
    fireEvent.change(inputs[1], { target: { value: '1' } });
    const castButton = screen.getByRole('button', { name: /Cast All Missiles/i });
    fireEvent.click(castButton);
    expect(baseProps.onConfirm).toHaveBeenCalledWith({
      distribution: { 'Goblin': 2, 'Orc': 1, 'Bugbear': 0 },
    });
  });

  it('calls onSkip when cancel clicked', () => {
    render(<MagicMissileTargetPopup {...baseProps} />);
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);
    expect(baseProps.onSkip).toHaveBeenCalled();
  });

  it('calls onSkip on Escape key', () => {
    render(<MagicMissileTargetPopup {...baseProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(baseProps.onSkip).toHaveBeenCalled();
  });

  it('marks current target with (Current) label', () => {
    render(<MagicMissileTargetPopup {...baseProps} currentTargetName="Orc" />);
    expect(screen.getByText(/Orc \(Current\)/i)).toBeInTheDocument();
  });

  it('highlights current target row', () => {
    const { container } = render(<MagicMissileTargetPopup {...baseProps} currentTargetName="Bugbear" />);
    const rows = container.querySelectorAll('.magic-missile-target-row');
    const bugbearRow = Array.from(rows).find(row => row.textContent?.includes('Bugbear'));
    expect(bugbearRow).toHaveClass('magic-missile-current-target');
  });

  it('defaults all targets to 0', () => {
    render(<MagicMissileTargetPopup {...baseProps} />);
    const inputs = screen.getAllByRole('spinbutton');
    inputs.forEach(input => {
      expect(input).toHaveValue(0);
    });
  });
});
