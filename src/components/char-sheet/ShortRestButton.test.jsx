import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ShortRestButton from './ShortRestButton.jsx';

// ── Tests ──

describe('ShortRestButton', () => {
  // ── Rendering ──

  it('renders the button with correct text', () => {
    render(<ShortRestButton onClick={vi.fn()} />);
    expect(screen.getByText('Short Rest')).toBeInTheDocument();
  });

  it('renders a bed icon inside the button', () => {
    render(<ShortRestButton onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: /Short Rest/i });
    const icon = button.querySelector('i');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('fa-solid');
    expect(icon).toHaveClass('fa-bed');
  });

  it('applies char-btn class to the button', () => {
    render(<ShortRestButton onClick={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('char-btn');
  });

  it('includes a title describing the short rest effect', () => {
    render(<ShortRestButton onClick={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title');
    expect(button.getAttribute('title')).toContain('Short Rest');
    expect(button.getAttribute('title')).toContain('Hit Dice');
    expect(button.getAttribute('title')).toContain('short-rest');
  });

  // ── Click behavior ──

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<ShortRestButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('passes the click event to onClick', () => {
    const onClick = vi.fn();
    render(<ShortRestButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0][0]).toBeDefined();
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
    // No error thrown
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
