import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharClassWizard from './char-class-wizard';
import storage from '../../../services/storage';

vi.mock('../../../services/storage', () => ({
  default: {
    getProperty: vi.fn(),
    setProperty: vi.fn(),
   },
}));

vi.mock('../../common/hidden-input', () => ({
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

const mockPlayerStats5e = {
  name: 'Test Wizard',
  level: 5,
  rules: '5e',
  class: {
    name: 'Wizard',
    class_levels: [
       { class_specific: { arcane_recovery_levels: 1 } },
       { class_specific: { arcane_recovery_levels: 1 } },
       { class_specific: { arcane_recovery_levels: 1 } },
       { class_specific: { arcane_recovery_levels: 1 } },
       { class_specific: { arcane_recovery_levels: 1 } },
     ],
   },
};

describe('CharClassWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getProperty.mockReturnValue(null);
   });

  it('should not render for 2024 rules', () => {
    const stats2024 = {
       ...mockPlayerStats5e,
      rules: '2024',
      class: { name: 'Wizard' },
     };
    
    const { container } = render(<CharClassWizard playerStats={stats2024} />);
    expect(container.firstChild).toBeNull();
   });

  it('should render arcane recovery for 5e', () => {
    render(<CharClassWizard playerStats={mockPlayerStats5e} />);
    
    expect(screen.getByText(/Arcane Recovery Levels/)).toBeInTheDocument();
   });

  it('should display max arcane recovery levels', () => {
    render(<CharClassWizard playerStats={mockPlayerStats5e} />);
    
    const div = screen.getByText((content, element) => element.textContent.includes('Arcane Recovery Levels'));
    expect(div.parentElement.textContent).toContain('1');
   });

  it('should toggle input visibility when clicked', () => {
    render(<CharClassWizard playerStats={mockPlayerStats5e} />);
    
    const clickable = screen.getByText((content, element) => element.textContent.includes('Arcane Recovery Levels')).parentElement;
    expect(screen.queryByTestId('hidden-input')).not.toBeInTheDocument();
    
    fireEvent.click(clickable);
    
    expect(screen.getByTestId('hidden-input')).toBeInTheDocument();
   });

  it('should toggle input visibility when keydown', () => {
    render(<CharClassWizard playerStats={mockPlayerStats5e} />);
    
    const clickable = screen.getByText((content, element) => element.textContent.includes('Arcane Recovery Levels')).parentElement;
    fireEvent.keyDown(clickable);
    
    expect(screen.getByTestId('hidden-input')).toBeInTheDocument();
   });

  it('should call storage.setProperty when value changes', () => {
    render(<CharClassWizard playerStats={mockPlayerStats5e} />);
    
    const clickable = screen.getByText((content, element) => element.textContent.includes('Arcane Recovery Levels')).parentElement;
    fireEvent.click(clickable);
    
    const input = screen.getByTestId('hidden-input');
    fireEvent.change(input, { target: { value: '0' } });
    
    expect(storage.setProperty).toHaveBeenCalledWith('Test Wizard', 'arcaneRecoveryLevels', '0');
   });

  it('should not render when class is not Wizard', () => {
    const nonWizard = {
       ...mockPlayerStats5e,
      rules: '5e',
      class: { name: 'Sorcerer', class_levels: [{ class_specific: {} }] },
     };
    
    const { container } = render(<CharClassWizard playerStats={nonWizard} />);
    expect(container.firstChild).toBeNull();
   });

  it('should show max/cur label', () => {
    render(<CharClassWizard playerStats={mockPlayerStats5e} />);
    
    expect(screen.getByText(/\(max\/cur\)/)).toBeInTheDocument();
   });

  it('should have tabIndex for accessibility', () => {
    render(<CharClassWizard playerStats={mockPlayerStats5e} />);
    
    const clickable = screen.getByText((content, element) => element.textContent.includes('Arcane Recovery Levels')).parentElement;
    expect(clickable).toHaveAttribute('tabIndex', '0');
   });

  it('should handle missing class_specific gracefully', () => {
    const statsNoCS = {
       ...mockPlayerStats5e,
      class: {
        name: 'Wizard',
        class_levels: [{}],
       },
     };
    
    render(<CharClassWizard playerStats={statsNoCS} />);
    
    expect(screen.getByText(/Arcane Recovery Levels/)).toBeInTheDocument();
   });

  it('should default arcane recovery levels to 0', () => {
    const statsNoLevels = {
       ...mockPlayerStats5e,
      class: {
        name: 'Wizard',
        class_levels: [{ class_specific: {} }],
       },
     };
    
    render(<CharClassWizard playerStats={statsNoLevels} />);
    
    const div = screen.getByText((content, element) => element.textContent.includes('Arcane Recovery Levels'));
    expect(div.parentElement.textContent).toContain('0');
   });

  it('should render HiddenInput initially', () => {
    render(<CharClassWizard playerStats={mockPlayerStats5e} />);
    
    expect(screen.getByTestId('hidden-value')).toBeInTheDocument();
   });
});
