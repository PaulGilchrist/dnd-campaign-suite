// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ShortRestButton from './ShortRestButton.jsx';

// ── Mocked modules ──

// ── Test fixtures ──

const mockOnClick = vi.fn();

// ── Tests ──

describe('ShortRestButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──

  describe('button content', () => {
    it('renders the button with icon, text, class, and title', () => {
      render(<ShortRestButton onClick={mockOnClick} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('char-btn');
      expect(button).toHaveAttribute('title');
      expect(button.getAttribute('title')).toContain('Short Rest');
      expect(button.getAttribute('title')).toContain('Hit Dice');
      expect(button.getAttribute('title')).toContain('short-rest resources');
      expect(screen.getByText('Short Rest')).toBeInTheDocument();
      const icon = button.querySelector('i');
      expect(icon).toHaveClass('fa-solid');
      expect(icon).toHaveClass('fa-bed');
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

    it('does not call onClick when it is not provided', () => {
      render(<ShortRestButton />);
      fireEvent.click(screen.getByRole('button'));
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });
});
