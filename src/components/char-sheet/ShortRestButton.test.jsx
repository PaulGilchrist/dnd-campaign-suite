// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ShortRestButton from './ShortRestButton.jsx';

// ── Test fixtures ──

const mockOnClick = vi.fn();

// ── Tests ──

describe('ShortRestButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──

  describe('button content', () => {
    it('renders the button with "Short Rest" text', () => {
      render(<ShortRestButton onClick={mockOnClick} />);
      expect(screen.getByText('Short Rest')).toBeInTheDocument();
    });

    it('renders a bed icon inside the button', () => {
      render(<ShortRestButton onClick={mockOnClick} />);
      const button = screen.getByRole('button', { name: /Short Rest/i });
      const icon = button.querySelector('i');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('fa-solid');
      expect(icon).toHaveClass('fa-bed');
    });

    it('applies char-btn class to the button', () => {
      render(<ShortRestButton onClick={mockOnClick} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('char-btn');
    });

    it('includes a title describing the short rest effect', () => {
      render(<ShortRestButton onClick={mockOnClick} />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title');
      expect(button.getAttribute('title')).toContain('Short Rest');
      expect(button.getAttribute('title')).toContain('Hit Dice');
      expect(button.getAttribute('title')).toContain('short-rest resources');
    });
  });

  // ── Click behavior ──

  describe('on click', () => {
    it('calls onClick with the click event', () => {
      render(<ShortRestButton onClick={mockOnClick} />);
      fireEvent.click(screen.getByRole('button'));
      expect(mockOnClick).toHaveBeenCalledTimes(1);
      expect(mockOnClick).toHaveBeenCalledWith(expect.objectContaining({ type: 'click' }));
    });

    it('does not throw when onClick is not provided', () => {
      render(<ShortRestButton />);
      expect(() => {
        fireEvent.click(screen.getByRole('button'));
      }).not.toThrow();
    });

    it('does not call onClick when it is not provided', () => {
      render(<ShortRestButton />);
      fireEvent.click(screen.getByRole('button'));
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });
});
