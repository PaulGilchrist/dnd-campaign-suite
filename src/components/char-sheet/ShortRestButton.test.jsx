import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ShortRestButton from './ShortRestButton.jsx';

describe('ShortRestButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a button with the correct label text', () => {
    render(<ShortRestButton onClick={vi.fn()} />);

    const button = screen.getByRole('button', { name: /short rest/i });
    expect(button).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<ShortRestButton onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: /short rest/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
