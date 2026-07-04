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
    it('should call onRoll with correct label and value range when a die is clicked', () => {
      const diceLabels = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
      render(<DiceTray onRoll={mockOnRoll} />);
      diceLabels.forEach((label) => {
        mockOnRoll.mockClear();
        const btn = screen.getByTitle(`Roll ${label}`);
        btn.click();
        const call = mockOnRoll.mock.calls[0][0];
        const sides = parseInt(label.slice(1), 10);
        expect(call.label).toBe(label);
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
    it('should render the popup overlay, modal, result details, and dismiss message', () => {
      const { container } = render(<DicePopup result={mockResult} onClose={mockOnClose} />);
      expect(container.querySelector('.dice-tray-popup-overlay')).toBeTruthy();
      expect(container.querySelector('.dice-tray-popup-modal')).toBeTruthy();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('d20')).toBeInTheDocument();
      expect(screen.getByText('click anywhere to dismiss')).toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    it('should call onClose when the overlay is clicked but not when the modal is clicked', () => {
      const { container } = render(<DicePopup result={mockResult} onClose={mockOnClose} />);
      const overlay = container.querySelector('.dice-tray-popup-overlay');
      const modal = container.querySelector('.dice-tray-popup-modal');
      fireEvent.click(overlay);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
      mockOnClose.mockClear();
      fireEvent.click(modal);
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should call onClose when Escape key is pressed but not for other keys', () => {
      render(<DicePopup result={mockResult} onClose={mockOnClose} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
      mockOnClose.mockClear();
      fireEvent.keyDown(document, { key: 'Enter' });
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should not call onClose after unmount when Escape is pressed', () => {
      const { unmount } = render(<DicePopup result={mockResult} onClose={mockOnClose} />);
      unmount();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
});
