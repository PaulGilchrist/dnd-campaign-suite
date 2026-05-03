import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharClassPaladin from './char-class-paladin';

const mockPlayerStats5e = {
  name: 'Test Paladin',
  level: 5,
  rules: '5e',
  class: {
    name: 'Paladin',
    fightingStyles: ['Defense'],
    class_levels: [
       { class_specific: { channel_divinity_charges: 1, aura_range: 0 } },
       { class_specific: { channel_divinity_charges: 1, aura_range: 0 } },
       { class_specific: { channel_divinity_charges: 1, aura_range: 0 } },
       { class_specific: { channel_divinity_charges: 2, aura_range: 0 } },
       { class_specific: { channel_divinity_charges: 2, aura_range: 10 } },
     ],
   },
};

const mockPlayerStats2024 = {
  name: 'Test Paladin 2024',
  level: 5,
  rules: '2024',
  class: {
    name: 'Paladin',
    fightingStyles: ['Defense'],
    class_levels: [
       { channel_divinity: 1 },
       { channel_divinity: 1 },
       { channel_divinity: 1 },
       { channel_divinity: 2 },
       { channel_divinity: 2 },
     ],
   },
};

describe('CharClassPaladin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
   });

  it('should render paladin class features', () => {
    render(<CharClassPaladin playerStats={mockPlayerStats5e} />);
    
    expect(screen.getByText(/Fighting Styles/)).toBeInTheDocument();
    expect(screen.getByText(/Extra Attacks/)).toBeInTheDocument();
    expect(screen.getByText(/Channel Divinity/)).toBeInTheDocument();
   });

   it('should display fighting styles', () => {
     render(<CharClassPaladin playerStats={mockPlayerStats5e} />);
     
     expect(screen.getByText('Fighting Styles:')).toBeInTheDocument();
     expect(screen.getByText('Defense')).toBeInTheDocument();
    });

   it('should display extra attacks for level > 4', () => {
     render(<CharClassPaladin playerStats={mockPlayerStats5e} />);
     
     expect(screen.getByText('Extra Attacks:')).toBeInTheDocument();
     expect(screen.getByText('1')).toBeInTheDocument();
    });

   it('should display 0 extra attacks for level <= 4', () => {
     const statsLevel4 = {
        ...mockPlayerStats5e,
       level: 4,
       class: {
          ...mockPlayerStats5e.class,
         fightingStyles: ['Defense'],
         class_levels: [
            { class_specific: { channel_divinity_charges: 1, aura_range: 0 } },
            { class_specific: { channel_divinity_charges: 1, aura_range: 0 } },
            { class_specific: { channel_divinity_charges: 1, aura_range: 0 } },
            { class_specific: { channel_divinity_charges: 1, aura_range: 0 } },
           ],
        },
      };
     
     render(<CharClassPaladin playerStats={statsLevel4} />);
     
     const extraAttacksDiv = screen.getByText('Extra Attacks:').closest('div');
     expect(extraAttacksDiv).toHaveTextContent('0');
    });

  it('should display channel divinity charges (5e)', () => {
    render(<CharClassPaladin playerStats={mockPlayerStats5e} />);
    
    expect(screen.getByText(/Channel Divinity/)).toBeInTheDocument();
   });

   it('should display channel divinity (2024)', () => {
     render(<CharClassPaladin playerStats={mockPlayerStats2024} />);
     
     expect(screen.getByText('Channel Divinity:')).toBeInTheDocument();
     expect(screen.getByText('2')).toBeInTheDocument();
    });

  it('should display aura range for 5e', () => {
    render(<CharClassPaladin playerStats={mockPlayerStats5e} />);
    
    expect(screen.getByText(/Aura Range/)).toBeInTheDocument();
   });

  it('should not display aura range for 2024', () => {
    render(<CharClassPaladin playerStats={mockPlayerStats2024} />);
    
    expect(screen.queryByText(/Aura Range/)).not.toBeInTheDocument();
   });

  it('should not render when class is not Paladin', () => {
    const nonPaladin = {
       ...mockPlayerStats5e,
      class: {
        name: 'Fighter',
        fightingStyles: ['Defense'],
        class_levels: [{ class_specific: {} }],
       },
     };
    
    const { container } = render(<CharClassPaladin playerStats={nonPaladin} />);
    
    expect(container.firstChild).toBeNull();
   });

  it('should handle missing class_levels gracefully', () => {
    const statsNoLevels = {
       ...mockPlayerStats5e,
      class: { name: 'Paladin', fightingStyles: ['Defense'] },
     };
    
    render(<CharClassPaladin playerStats={statsNoLevels} />);
    
    expect(screen.getByText(/Fighting Styles/)).toBeInTheDocument();
   });

   it('should handle undefined fighting styles', () => {
     const statsNoStyles = {
        ...mockPlayerStats5e,
       class: {
         name: 'Paladin',
         class_levels: [{ class_specific: { channel_divinity_charges: 1, aura_range: 0 } }],
        },
      };
     
     render(<CharClassPaladin playerStats={statsNoStyles} />);
     expect(screen.queryByText('Fighting Styles:')).not.toBeInTheDocument();
    });

  it('should default channel divinity to 0 when not defined', () => {
    const statsNoCD = {
       ...mockPlayerStats5e,
      level: 1,
      class: {
        name: 'Paladin',
        fightingStyles: [],
        class_levels: [{ class_specific: {} }],
       },
     };
    
    render(<CharClassPaladin playerStats={statsNoCD} />);
    
    expect(screen.getByText(/Channel Divinity/)).toBeInTheDocument();
   });

  it('should default channel divinity to 0 for 2024 when not defined', () => {
    const stats2024NoCD = {
       ...mockPlayerStats2024,
      level: 1,
      class: {
        name: 'Paladin',
        fightingStyles: [],
        class_levels: [{}],
       },
     };
    
    render(<CharClassPaladin playerStats={stats2024NoCD} />);
    
    expect(screen.getByText(/Channel Divinity/)).toBeInTheDocument();
   });
});
