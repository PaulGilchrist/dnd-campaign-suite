import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharGold from './char-gold.jsx';
import storage from '../../../services/storage.js';

vi.mock('../../../services/storage.js', () => ({
  default: {
    getProperty: vi.fn(),
    setProperty: vi.fn(),
   },
}));

vi.mock('../../common/hidden-input.jsx', () => ({
  default: vi.fn(({ value, showInput, handleInputToggle, handleValueChange }) => {
    if (showInput) {
      return (
         <input
           data-testid="hidden-input"
           type="number"
           value={value}
           onChange={(e) => handleValueChange(e.target.value)}
           onBlur={handleInputToggle}
         />
       );
     }
    return <span data-testid="hidden-value">{value}</span>;
   }),
}));

describe('CharGold', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getProperty.mockReturnValue(null);
   });

  const mockPlayerStats = {
    name: 'Test Character',
    inventory: { gold: 500 },
   };

  it('should render gold label', () => {
    render(<CharGold playerStats={mockPlayerStats} />);
    
    expect(screen.getByText(/Gold/)).toBeInTheDocument();
   });

  it('should render HiddenInput with initial value 0', () => {
    render(<CharGold playerStats={mockPlayerStats} />);
    
    expect(screen.getByTestId('hidden-value')).toBeInTheDocument();
   });

  it('should use stored gold value when available', () => {
    storage.getProperty.mockReturnValue(250);
    
    render(<CharGold playerStats={mockPlayerStats} />);
    
    expect(screen.getByTestId('hidden-value')).toHaveTextContent('250');
   });

   it('should toggle input visibility when clicked', () => {
     render(<CharGold playerStats={mockPlayerStats} />);
     
     const clickable = document.querySelector('.clickable');
     expect(screen.queryByTestId('hidden-input')).not.toBeInTheDocument();
     
     fireEvent.click(clickable);
     
     expect(screen.getByTestId('hidden-input')).toBeInTheDocument();
    });

   it('should toggle input visibility when keydown', () => {
     render(<CharGold playerStats={mockPlayerStats} />);
     
     const clickable = document.querySelector('.clickable');
     fireEvent.keyDown(clickable);
     
     expect(screen.getByTestId('hidden-input')).toBeInTheDocument();
    });

   it('should call storage.setProperty when gold value changes', () => {
     storage.getProperty.mockReturnValue(250);
     
     render(<CharGold playerStats={mockPlayerStats} />);
     
     const clickable = document.querySelector('.clickable');
     fireEvent.click(clickable);
     
     const input = screen.getByTestId('hidden-input');
     fireEvent.change(input, { target: { value: '1000' } });
     
     expect(storage.setProperty).toHaveBeenCalledWith('Test Character', 'gold', '1000');
    });

   it('should have tabIndex for accessibility', () => {
     render(<CharGold playerStats={mockPlayerStats} />);
     
     const clickable = document.querySelector('.clickable');
     expect(clickable).toHaveAttribute('tabIndex', '0');
    });

   it('should have clickable class', () => {
     render(<CharGold playerStats={mockPlayerStats} />);
     
     const clickable = document.querySelector('.clickable');
     expect(clickable).toHaveClass('clickable');
    });
});
