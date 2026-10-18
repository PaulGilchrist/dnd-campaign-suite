// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ShortRestButton from './ShortRestButton.jsx';

describe('ShortRestButton', () => {
  it('renders an enabled "Short Rest" button with rest tooltip and dispatches onClick once', () => {
    const onClick = vi.fn();
    render(<ShortRestButton onClick={onClick} />);

    const button = screen.getByRole('button', { name: /short rest/i });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute(
      'title',
      'Short Rest: spend Hit Dice and restore short-rest resources'
    );

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
