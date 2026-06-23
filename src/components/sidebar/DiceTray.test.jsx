// @improved-by-ai
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
    it('should render dice buttons', () => {
      render(<DiceTray onRoll={mockOnRoll} />);
      const btns = screen.queryAllByRole('button');
      expect(btns.length).toBeGreaterThan(0);
    });

    it('should display labels for all standard dice', () => {
      render(<DiceTray onRoll={mockOnRoll} />);
      const standardDice = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
      standardDice.forEach((label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });

    it('should set correct title attributes on dice buttons', () => {
      render(<DiceTray onRoll={mockOnRoll} />);
      const standardDice = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
      standardDice.forEach((label) => {
        const btn = screen.getByTitle(`Roll ${label}`);
        expect(btn).toHaveAttribute('title', `Roll ${label}`);
      });
    });

    it('should render exactly 7 dice buttons', () => {
      render(<DiceTray onRoll={mockOnRoll} />);
      const btns = screen.queryAllByRole('button');
      expect(btns.length).toBe(7);
    });

    it('should render SVG icons for d4, d8, d10, d12, d100 and Font Awesome icons for d6, d20', () => {
      render(<DiceTray onRoll={mockOnRoll} />);
      const d4Btn = screen.getByTitle('Roll d4').closest('button');
      expect(d4Btn.querySelector('svg')).toBeTruthy();

      const d8Btn = screen.getByTitle('Roll d8').closest('button');
      expect(d8Btn.querySelector('svg')).toBeTruthy();

      const d10Btn = screen.getByTitle('Roll d10').closest('button');
      expect(d10Btn.querySelector('svg')).toBeTruthy();

      const d12Btn = screen.getByTitle('Roll d12').closest('button');
      expect(d12Btn.querySelector('svg')).toBeTruthy();

      const d100Btn = screen.getByTitle('Roll d100').closest('button');
      expect(d100Btn.querySelector('svg')).toBeTruthy();

      const d6Btn = screen.getByTitle('Roll d6').closest('button');
      expect(d6Btn.querySelector('.fa-solid')).toBeTruthy();

      const d20Btn = screen.getByTitle('Roll d20').closest('button');
      expect(d20Btn.querySelector('.fa-solid')).toBeTruthy();
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

    it('should call onRoll with correct label for each die type', () => {
      render(<DiceTray onRoll={mockOnRoll} />);
      const diceLabels = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
      diceLabels.forEach((label) => {
        mockOnRoll.mockClear();
        screen.getByText(label).click();
        expect(mockOnRoll).toHaveBeenCalledTimes(1);
        expect(mockOnRoll).toHaveBeenCalledWith(expect.objectContaining({ label }));
      });
    });

    it('should pass a value between 1 and the die sides inclusive', () => {
      render(<DiceTray onRoll={mockOnRoll} />);
      screen.getByText('d4').click();
      const call = mockOnRoll.mock.calls[0][0];
      expect(call.value).toBeGreaterThanOrEqual(1);
      expect(call.value).toBeLessThanOrEqual(4);
    });

    it('should pass a value between 1 and 20 for d20', () => {
      render(<DiceTray onRoll={mockOnRoll} />);
      screen.getByText('d20').click();
      const call = mockOnRoll.mock.calls[0][0];
      expect(call.value).toBeGreaterThanOrEqual(1);
      expect(call.value).toBeLessThanOrEqual(20);
    });

    it('should pass a value between 1 and 100 for d100', () => {
      render(<DiceTray onRoll={mockOnRoll} />);
      screen.getByText('d100').click();
      const call = mockOnRoll.mock.calls[0][0];
      expect(call.value).toBeGreaterThanOrEqual(1);
      expect(call.value).toBeLessThanOrEqual(100);
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
    it('should render the popup overlay', () => {
      const { container } = render(<DicePopup result={mockResult} onClose={mockOnClose} />);
      expect(container.querySelector('.dice-tray-popup-overlay')).toBeTruthy();
    });

    it('should render the popup modal', () => {
      const { container } = render(<DicePopup result={mockResult} onClose={mockOnClose} />);
      expect(container.querySelector('.dice-tray-popup-modal')).toBeTruthy();
    });

    it('should display the result value', () => {
      render(<DicePopup result={mockResult} onClose={mockOnClose} />);
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('should display the result label', () => {
      render(<DicePopup result={mockResult} onClose={mockOnClose} />);
      expect(screen.getByText('d20')).toBeInTheDocument();
    });

    it('should display a dismiss message', () => {
      render(<DicePopup result={mockResult} onClose={mockOnClose} />);
      expect(screen.getByText('click anywhere to dismiss')).toBeInTheDocument();
    });

    it('should render the correct icon for d4', () => {
      const { container } = render(<DicePopup result={{ label: 'd4', value: 3 }} onClose={mockOnClose} />);
      const iconContainer = container.querySelector('.dice-tray-result-icon');
      expect(iconContainer.querySelector('svg')).toBeTruthy();
    });

    it('should render the correct icon for d6', () => {
      const { container } = render(<DicePopup result={{ label: 'd6', value: 5 }} onClose={mockOnClose} />);
      const iconContainer = container.querySelector('.dice-tray-result-icon');
      expect(iconContainer.querySelector('.fa-solid')).toBeTruthy();
    });

    it('should render the correct icon for d8', () => {
      const { container } = render(<DicePopup result={{ label: 'd8', value: 7 }} onClose={mockOnClose} />);
      const iconContainer = container.querySelector('.dice-tray-result-icon');
      expect(iconContainer.querySelector('svg')).toBeTruthy();
    });

    it('should render the correct icon for d10', () => {
      const { container } = render(<DicePopup result={{ label: 'd10', value: 8 }} onClose={mockOnClose} />);
      const iconContainer = container.querySelector('.dice-tray-result-icon');
      expect(iconContainer.querySelector('svg')).toBeTruthy();
    });

    it('should render the correct icon for d12', () => {
      const { container } = render(<DicePopup result={{ label: 'd12', value: 11 }} onClose={mockOnClose} />);
      const iconContainer = container.querySelector('.dice-tray-result-icon');
      expect(iconContainer.querySelector('svg')).toBeTruthy();
    });

    it('should render the correct icon for d20', () => {
      const { container } = render(<DicePopup result={{ label: 'd20', value: 20 }} onClose={mockOnClose} />);
      const iconContainer = container.querySelector('.dice-tray-result-icon');
      expect(iconContainer.querySelector('.fa-solid')).toBeTruthy();
    });

    it('should render the correct icon for d100', () => {
      const { container } = render(<DicePopup result={{ label: 'd100', value: 50 }} onClose={mockOnClose} />);
      const iconContainer = container.querySelector('.dice-tray-result-icon');
      expect(iconContainer.querySelector('svg')).toBeTruthy();
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