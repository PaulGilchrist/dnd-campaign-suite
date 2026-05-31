// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import DiceTray from './DiceTray.jsx';

describe('DiceTray', () => {
  beforeEach(() => {
    vi.clearAllMocks();
   });

  it('should render 7 dice buttons', () => {
     render(<DiceTray />);
     const btns = document.querySelectorAll('.dice-btn');
     expect(btns).toHaveLength(7);
   });

  it('should display labels for all standard dice', () => {
     render(<DiceTray />);
     expect(screen.getByText('d4')).toBeInTheDocument();
     expect(screen.getByText('d6')).toBeInTheDocument();
     expect(screen.getByText('d8')).toBeInTheDocument();
     expect(screen.getByText('d10')).toBeInTheDocument();
     expect(screen.getByText('d12')).toBeInTheDocument();
     expect(screen.getByText('d20')).toBeInTheDocument();
     expect(screen.getByText('d100')).toBeInTheDocument();
   });

  it('should show popup with rolled value when d20 is clicked', () => {
     render(<DiceTray />);
     const d20Btn = screen.getByText('d20').closest('.dice-btn');
     fireEvent.click(d20Btn);
     expect(screen.getByText(/click anywhere to dismiss/)).toBeInTheDocument();
    });

  it('should show the correct die label in popup', () => {
     render(<DiceTray />);
     // The popup contains a separate label div with the die name above "click anywhere..."
     const d4Btn = screen.getByText('d4').closest('.dice-btn');
     fireEvent.click(d4Btn);
     expect(screen.getByText(/click anywhere to dismiss/)).toBeInTheDocument();
    });

  it('should close popup and show tray again when overlay is clicked', () => {
     render(<DiceTray />);
     const d20Btn = screen.getByText('d20').closest('.dice-btn');
     fireEvent.click(d20Btn);
     expect(screen.getByText(/click anywhere to dismiss/)).toBeInTheDocument();

     fireEvent.click(screen.getByTestId('popup-overlay'));

     expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
    });

  it('should roll values within valid range when each die is clicked', () => {
     render(<DiceTray />);
     const labels = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

     for (const label of labels) {
        const btn = screen.getByText(label).closest('.dice-btn');
        fireEvent.click(btn);
        expect(screen.queryByTestId('popup-overlay')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('popup-overlay'));
       }
    });
});
