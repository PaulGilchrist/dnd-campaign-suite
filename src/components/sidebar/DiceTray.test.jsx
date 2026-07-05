// @cleaned-by-ai
// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DiceTray, { DicePopup } from './DiceTray.jsx';
import * as diceRoller from '../../services/dice/diceRoller.js';

describe('DiceTray', () => {
  const mockOnRoll = vi.fn();

  beforeEach(() => {
    mockOnRoll.mockClear();
  });

  it('calls onRoll with a result when a die button is clicked', () => {
    vi.spyOn(diceRoller, 'rollDie').mockReturnValue(7);
    render(<DiceTray onRoll={mockOnRoll} />);
    screen.getByTitle('Roll d20').click();
    expect(mockOnRoll).toHaveBeenCalledWith({ label: 'd20', value: 7 });
  });

  it('rolls the correct number of sides for each die type', () => {
    vi.spyOn(diceRoller, 'rollDie').mockImplementation((sides) => sides);
    render(<DiceTray onRoll={mockOnRoll} />);
    const diceLabels = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
    for (const label of diceLabels) {
      mockOnRoll.mockClear();
      screen.getByTitle(`Roll ${label}`).click();
      const sides = parseInt(label.slice(1), 10);
      expect(mockOnRoll).toHaveBeenCalledWith({ label, value: sides });
    }
  });
});

describe('DicePopup', () => {
  const mockResult = { label: 'd20', value: 15 };
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('renders the result value and label', () => {
    render(<DicePopup result={mockResult} onClose={mockOnClose} />);
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('d20')).toBeInTheDocument();
  });

  it('calls onClose when the overlay is clicked but not when the modal is clicked', () => {
    const { container } = render(<DicePopup result={mockResult} onClose={mockOnClose} />);
    const overlay = container.querySelector('.dice-tray-popup-overlay');
    const modal = container.querySelector('.dice-tray-popup-modal');
    fireEvent.click(overlay);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    mockOnClose.mockClear();
    fireEvent.click(modal);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    render(<DicePopup result={mockResult} onClose={mockOnClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose after unmounting', () => {
    const { unmount } = render(<DicePopup result={mockResult} onClose={mockOnClose} />);
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
