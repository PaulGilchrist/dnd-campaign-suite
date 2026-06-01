// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DiceTray from './DiceTray.jsx';

describe('DiceTray', () => {
  const mockOnRoll = vi.fn();

  it('should render 7 dice buttons', () => {
     render(<DiceTray onRoll={mockOnRoll} />);
     const btns = document.querySelectorAll('.dice-btn');
     expect(btns).toHaveLength(7);
   });

  it('should display labels for all standard dice', () => {
     render(<DiceTray onRoll={mockOnRoll} />);
     expect(screen.getByText('d4')).toBeInTheDocument();
     expect(screen.getByText('d6')).toBeInTheDocument();
     expect(screen.getByText('d8')).toBeInTheDocument();
     expect(screen.getByText('d10')).toBeInTheDocument();
     expect(screen.getByText('d12')).toBeInTheDocument();
     expect(screen.getByText('d20')).toBeInTheDocument();
     expect(screen.getByText('d100')).toBeInTheDocument();
   });
});
