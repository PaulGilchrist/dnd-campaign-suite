import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharClassSorcerer from './char-class-sorcerer';
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
  name: 'Test Sorcerer',
  level: 5,
  rules: '5e',
  class: {
    name: 'Sorcerer',
    class_levels: [
       { class_specific: { sorcery_points: 0, metamagic_known: 0, creating_spell_slots: [] } },
       { class_specific: { sorcery_points: 0, metamagic_known: 0, creating_spell_slots: [] } },
       { class_specific: { sorcery_points: 2, metamagic_known: 2, creating_spell_slots: [{ sorcery_point_cost: 2 }] } },
       { class_specific: { sorcery_points: 3, metamagic_known: 2, creating_spell_slots: [{ sorcery_point_cost: 2 }, { sorcery_point_cost: 3 }] } },
       { class_specific: { sorcery_points: 4, metamagic_known: 3, creating_spell_slots: [{ sorcery_point_cost: 2 }, { sorcery_point_cost: 3 }, { sorcery_point_cost: 4 }] } },
     ],
   },
};

const mockPlayerStats2024 = {
  name: 'Test Sorcerer 2024',
  level: 5,
  rules: '2024',
  class: {
    name: 'Sorcerer',
    class_levels: [
       { sorcery_points: 0 },
       { sorcery_points: 0 },
       { sorcery_points: 2 },
       { sorcery_points: 3 },
       { sorcery_points: 4 },
     ],
   },
};

describe('CharClassSorcerer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getProperty.mockReturnValue(null);
   });

  it('should render sorcery points label (5e)', () => {
    render(<CharClassSorcerer playerStats={mockPlayerStats5e} />);
    
    expect(screen.getByText(/Sorcery Points/)).toBeInTheDocument();
   });

   it('should render metamagic known label (5e)', () => {
     render(<CharClassSorcerer playerStats={mockPlayerStats5e} />);
     
     expect(screen.getByText(/Metamagic Known/)).toBeInTheDocument();
    });

   it('should display spell slot costs for 5e', () => {
     render(<CharClassSorcerer playerStats={mockPlayerStats5e} />);
     
     expect(screen.getByText(/Spell Slot \(level 1-5\) Costs/)).toBeInTheDocument();
    });

   it('should display max sorcery points (5e)', () => {
      render(<CharClassSorcerer playerStats={mockPlayerStats5e} />);

      expect(screen.getByText(/Sorcery Points:/)).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });

   it('should display metamagic known value (5e)', () => {
      render(<CharClassSorcerer playerStats={mockPlayerStats5e} />);

      expect(screen.getByText(/Metamagic Known:/)).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

   it('should calculate sorcery points for level 3 (2024)', () => {
      const statsLevel3 = {
         ...mockPlayerStats2024,
        level: 3,
        class: { name: 'Sorcerer', class_levels: [{}, {}, { sorcery_points: 2 }] },
       };

      render(<CharClassSorcerer playerStats={statsLevel3} />);

      expect(screen.getByText(/Sorcery Points:/)).toBeInTheDocument();
      const clickable = document.querySelector('.clickable');
      expect(clickable.textContent).toContain('2/2');
    });

   it('should calculate metamagic known for level 10 (2024)', () => {
      const statsLevel10 = {
         ...mockPlayerStats2024,
        level: 10,
        class: { name: 'Sorcerer', class_levels: Array(10).fill({ sorcery_points: 8 }) },
       };

      render(<CharClassSorcerer playerStats={statsLevel10} />);

      expect(screen.getByText(/Metamagic Known:/)).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });

   it('should calculate metamagic known for level 17 (2024)', () => {
      const statsLevel17 = {
         ...mockPlayerStats2024,
        level: 17,
        class: { name: 'Sorcerer', class_levels: Array(17).fill({ sorcery_points: 20 }) },
       };

      render(<CharClassSorcerer playerStats={statsLevel17} />);

      expect(screen.getByText(/Metamagic Known:/)).toBeInTheDocument();
      expect(screen.getByText('6')).toBeInTheDocument();
    });

  it('should not display spell slot costs for 2024', () => {
    render(<CharClassSorcerer playerStats={mockPlayerStats2024} />);
    
    expect(screen.queryByText(/Spell Slot \(level 1-5\) Costs/)).not.toBeInTheDocument();
   });

   it('should toggle input visibility when clicked', () => {
     render(<CharClassSorcerer playerStats={mockPlayerStats5e} />);
     
     const clickable = document.querySelector('.clickable');
     expect(screen.queryByTestId('hidden-input')).not.toBeInTheDocument();
     
     fireEvent.click(clickable);
     
     expect(screen.getByTestId('hidden-input')).toBeInTheDocument();
    });

  it('should render HiddenInput with correct initial value', () => {
    render(<CharClassSorcerer playerStats={mockPlayerStats5e} />);
    
    expect(screen.getByTestId('hidden-value')).toBeInTheDocument();
   });

   it('should call storage.setProperty when sorcery points change', () => {
     render(<CharClassSorcerer playerStats={mockPlayerStats5e} />);
     
     const clickable = document.querySelector('.clickable');
     fireEvent.click(clickable);
     
     const input = screen.getByTestId('hidden-input');
     fireEvent.change(input, { target: { value: '2' } });
     
     expect(storage.setProperty).toHaveBeenCalledWith('Test Sorcerer', 'sorceryPoints', '2');
    });

  it('should not render when class is not Sorcerer', () => {
    const nonSorcerer = {
       ...mockPlayerStats5e,
      class: {
        name: 'Wizard',
        class_levels: [{ class_specific: {} }],
       },
     };
    
    const { container } = render(<CharClassSorcerer playerStats={nonSorcerer} />);
    
    expect(container.firstChild).toBeNull();
   });

  it('should show max/cur label', () => {
    render(<CharClassSorcerer playerStats={mockPlayerStats5e} />);
    
    expect(screen.getByText(/\(max\/cur\)/)).toBeInTheDocument();
   });

  it('should handle missing class_levels gracefully', () => {
    const statsNoLevels = {
       ...mockPlayerStats5e,
      class: { name: 'Sorcerer' },
     };
    
    const { container } = render(<CharClassSorcerer playerStats={statsNoLevels} />);
    expect(container.firstChild).not.toBeNull();
   });

   it('should handle level under 3 metamagic (2024)', () => {
     const statsLevel1 = {
        ...mockPlayerStats2024,
       level: 1,
       class: { name: 'Sorcerer', class_levels: [{ sorcery_points: 0 }] },
      };
     
     render(<CharClassSorcerer playerStats={statsLevel1} />);
     
     const clickable = document.querySelector('.clickable');
     expect(clickable.textContent).toContain('0');
    });
});
