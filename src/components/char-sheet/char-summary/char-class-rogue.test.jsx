import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharClassRogue from './char-class-rogue';

const mockPlayerStats5e = {
  name: 'Test Rogue',
  level: 5,
  rules: '5e',
  class: {
    name: 'Rogue',
    expertise: ['Stealth', 'Deception'],
    class_levels: [
       { class_specific: { sneak_attack: { dice_count: 1, dice_value: 6 } } },
       { class_specific: { sneak_attack: { dice_count: 2, dice_value: 6 } } },
       { class_specific: { sneak_attack: { dice_count: 3, dice_value: 6 } } },
       { class_specific: { sneak_attack: { dice_count: 4, dice_value: 6 } } },
       { class_specific: { sneak_attack: { dice_count: 5, dice_value: 6 } } },
     ],
   },
};

const mockPlayerStats2024 = {
  name: 'Test Rogue 2024',
  level: 5,
  rules: '2024',
  class: {
    name: 'Rogue',
    expertise: ['Perception', 'Sleight of Hand'],
    class_levels: [
       { sneak_attack_num_d6: 1 },
       { sneak_attack_num_d6: 2 },
       { sneak_attack_num_d6: 3 },
       { sneak_attack_num_d6: 4 },
       { sneak_attack_num_d6: 5 },
     ],
   },
};

describe('CharClassRogue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
   });

  it('should render rogue class features', () => {
    render(<CharClassRogue playerStats={mockPlayerStats5e} />);
    
    expect(screen.getByText(/Sneak Attack Damage/)).toBeInTheDocument();
   });

   it('should display sneak attack damage (5e format)', () => {
      render(<CharClassRogue playerStats={mockPlayerStats5e} />);

      expect(screen.getByText(/Sneak Attack Damage/)).toBeInTheDocument();
      expect(screen.getByText('+5d6')).toBeInTheDocument();
    });

   it('should display sneak attack damage (2024 format)', () => {
      render(<CharClassRogue playerStats={mockPlayerStats2024} />);

      expect(screen.getByText('+5d6')).toBeInTheDocument();
    });

   it('should display expertise skills', () => {
      render(<CharClassRogue playerStats={mockPlayerStats5e} />);

      expect(screen.getByText(/Expertise:/)).toBeInTheDocument();
      expect(screen.getByText(/Stealth.*Deception/)).toBeInTheDocument();
    });

  it('should not display expertise when not defined', () => {
    const statsNoExpertise = {
       ...mockPlayerStats5e,
      class: {
        name: 'Rogue',
        class_levels: [{ class_specific: { sneak_attack: { dice_count: 1, dice_value: 6 } } }],
       },
     };
    
    render(<CharClassRogue playerStats={statsNoExpertise} />);
    
    expect(screen.queryByText(/Expertise/)).not.toBeInTheDocument();
   });

  it('should not render when class is not Rogue', () => {
    const nonRogue = {
       ...mockPlayerStats5e,
      class: {
        name: 'Fighter',
        fightingStyles: ['Defense'],
        class_levels: [{ class_specific: {} }],
       },
     };
    
    const { container } = render(<CharClassRogue playerStats={nonRogue} />);
    
    expect(container.firstChild).toBeNull();
   });

   it('should default sneak attack to 0d6 when not defined', () => {
      const statsNoSneak = {
         ...mockPlayerStats5e,
        class: {
          name: 'Rogue',
          class_levels: [{ class_specific: {} }],
         },
       };

      render(<CharClassRogue playerStats={statsNoSneak} />);

      expect(screen.getByText('+0d6')).toBeInTheDocument();
    });

   it('should handle 2024 rogue without sneak_attack_num_d6', () => {
      const stats2024NoSneak = {
         ...mockPlayerStats2024,
        class: {
          name: 'Rogue',
          class_levels: [{}],
         },
       };

      render(<CharClassRogue playerStats={stats2024NoSneak} />);

      expect(screen.getByText('+0d6')).toBeInTheDocument();
    });

  it('should handle missing class_levels gracefully', () => {
    const statsNoLevels = {
       ...mockPlayerStats5e,
      class: { name: 'Rogue' },
     };
    
    const { container } = render(<CharClassRogue playerStats={statsNoLevels} />);
    expect(container.firstChild).toBeNull();
   });

  it('should handle level out of bounds', () => {
    const statsOutBounds = {
       ...mockPlayerStats5e,
      level: 100,
     };
    
    const { container } = render(<CharClassRogue playerStats={statsOutBounds} />);
    expect(container.firstChild).toBeNull();
   });
});
