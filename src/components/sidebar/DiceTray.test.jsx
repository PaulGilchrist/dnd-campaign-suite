// @improved-by-ai
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DiceTray from './DiceTray.jsx';

describe('DiceTray', () => {
  const mockOnRoll = vi.fn();

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
  });
});