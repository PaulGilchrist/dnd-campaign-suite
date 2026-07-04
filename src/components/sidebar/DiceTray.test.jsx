// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DiceTray, { DicePopup } from './DiceTray.jsx';

describe('DiceTray', () => {
  const mockOnRoll = vi.fn();

  beforeEach(() => {
    mockOnRoll.mockClear();
  });

  describe('rendering', () => {
    it('should render dice buttons for all standard dice with labels and titles', () => {
      render(<DiceTray onRoll={mockOnRoll} />);
      const standardDice = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
      standardDice.forEach((label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
        expect(screen.getByTitle(`Roll ${label}`)).toBeInTheDocument();
      });
    });
  });

  describe('interaction', () => {
    it('should call onRoll with correct label and value when a die is clicked', () => {
      render(<DiceTray onRoll={mockOnRoll} />);
      screen.getByText('d20').click();
      expect(mockOnRoll).toHaveBeenCalledTimes(1);
      expect(mockOnRoll).toHaveBeenCalledWith(expect.objectContaining({ label: 'd20' }));
      expect(mockOnRoll).toHaveBeenCalledWith(expect.objectContaining({ value: expect.any(Number) }));
    });

    it('should pass a value between 1 and the die sides inclusive for each die type', () => {
      const diceLabels = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
      render(<DiceTray onRoll={mockOnRoll} />);
      diceLabels.forEach((label) => {
        mockOnRoll.mockClear();
        const btn = screen.getByTitle(`Roll ${label}`);
        btn.click();
        const call = mockOnRoll.mock.calls[0][0];
        const sides = parseInt(label.slice(1), 10);
        expect(call.value).toBeGreaterThanOrEqual(1);
        expect(call.value).toBeLessThanOrEqual(sides);
      });
    });
  });
});

describe('DicePopup', () => {
  const mockResult = { label: 'd20', value: 15 };
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  describe('rendering', () => {
    it('should render the popup overlay and modal', () => {
      const { container } = render(<DicePopup result={mockResult} onClose={mockOnClose} />);
      expect(container.querySelector('.dice-tray-popup-overlay')).toBeTruthy();
      expect(container.querySelector('.dice-tray-popup-modal')).toBeTruthy();
    });

    it('should display the result value and label', () => {
      render(<DicePopup result={mockResult} onClose={mockOnClose} />);
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('d20')).toBeInTheDocument();
    });

    it('should display a dismiss message', () => {
      render(<DicePopup result={mockResult} onClose={mockOnClose} />);
      expect(screen.getByText('click anywhere to dismiss')).toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    it('should call onClose when the overlay is clicked', () => {
      const { container } = render(<DicePopup result={mockResult} onClose={mockOnClose} />);
      const overlay = container.querySelector('.dice-tray-popup-overlay');
      fireEvent.click(overlay);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should NOT call onClose when the modal is clicked', () => {
      const { container } = render(<DicePopup result={mockResult} onClose={mockOnClose} />);
      const modal = container.querySelector('.dice-tray-popup-modal');
      fireEvent.click(modal);
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should call onClose when Escape key is pressed', () => {
      render(<DicePopup result={mockResult} onClose={mockOnClose} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should NOT call onClose for other key presses', () => {
      render(<DicePopup result={mockResult} onClose={mockOnClose} />);
      fireEvent.keyDown(document, { key: 'Enter' });
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should remove event listener on unmount', () => {
      const removeSpy = vi.spyOn(document, 'removeEventListener');
      const { unmount } = render(<DicePopup result={mockResult} onClose={mockOnClose} />);
      unmount();
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      removeSpy.mockRestore();
    });

    it('should not call onClose after unmount when Escape is pressed', () => {
      const { unmount } = render(<DicePopup result={mockResult} onClose={mockOnClose} />);
      unmount();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
});
