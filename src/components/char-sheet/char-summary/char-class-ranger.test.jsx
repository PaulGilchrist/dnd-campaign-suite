import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharClassRanger from './char-class-ranger';
import classRules from '../../../services/class-rules-2024';

vi.mock('../../../services/class-rules-2024', () => ({
  default: {
    getFavoredEnemy: vi.fn(() => 3),
   },
}));

const mockPlayerStats5e = {
  name: 'Test Ranger',
  level: 5,
  rules: '5e',
  class: {
    name: 'Ranger',
    fightingStyles: ['Archery'],
    class_levels: [
       {}, {}, {}, {},
       { class_specific: { favored_enemy: 1, natural_explorer: 'Forest' } },
     ],
   },
};

const mockPlayerStats2024 = {
  name: 'Test Ranger 2024',
  level: 5,
  rules: '2024',
  class: {
    name: 'Ranger',
    fightingStyles: ['Archery'],
   },
};

describe('CharClassRanger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classRules.getFavoredEnemy.mockReturnValue(3);
   });

  it('should render ranger class features', () => {
    render(<CharClassRanger playerStats={mockPlayerStats5e} />);
    
    expect(screen.getByText(/Fighting Styles/)).toBeInTheDocument();
    expect(screen.getByText(/Extra Attacks/)).toBeInTheDocument();
    expect(screen.getByText(/Favored Enemies/)).toBeInTheDocument();
   });

  it('should display fighting styles for level > 1', () => {
    render(<CharClassRanger playerStats={mockPlayerStats5e} />);
    
    const stylesDiv = screen.getByText((content, element) => element.textContent.includes('Fighting Styles'));
    expect(stylesDiv.parentElement.textContent).toContain('Archery');
   });

  it('should not display fighting styles for level 1', () => {
    const statsLevel1 = {
       ...mockPlayerStats5e,
      level: 1,
      class: {
        name: 'Ranger',
        fightingStyles: ['Archery'],
       },
     };
    
    render(<CharClassRanger playerStats={statsLevel1} />);
    
    expect(screen.getByText(/Fighting Styles/)).toBeInTheDocument();
   });

  it('should display extra attacks for level > 4', () => {
    render(<CharClassRanger playerStats={mockPlayerStats5e} />);
    
    const extraDiv = screen.getByText((content, element) => element.textContent.includes('Extra Attacks'));
    expect(extraDiv.parentElement.textContent).toContain('1');
   });

  it('should display 0 extra attacks for level <= 4', () => {
    const statsLevel4 = {
       ...mockPlayerStats5e,
      level: 4,
      class: {
        name: 'Ranger',
        fightingStyles: ['Archery'],
       },
     };
    
    render(<CharClassRanger playerStats={statsLevel4} />);
    
    const extraDiv = screen.getByText((content, element) => element.textContent.includes('Extra Attacks'));
    expect(extraDiv.parentElement.textContent).toContain('0');
   });

  it('should display favored enemies count', () => {
    classRules.getFavoredEnemy.mockReturnValue(3);
    
    render(<CharClassRanger playerStats={mockPlayerStats5e} />);
    
    expect(screen.getByText(/Favored Enemies/)).toBeInTheDocument();
   });

  it('should not render when class is not Ranger', () => {
    const nonRanger = {
       ...mockPlayerStats5e,
      class: { name: 'Fighter', fightingStyles: ['Defense'] },
     };
    
    const { container } = render(<CharClassRanger playerStats={nonRanger} />);
    
    expect(container.firstChild).toBeNull();
   });

  it('should handle missing fighting styles', () => {
    const statsNoStyles = {
       ...mockPlayerStats5e,
      class: { name: 'Ranger' },
     };
    
    const { container } = render(<CharClassRanger playerStats={statsNoStyles} />);
    expect(container.firstChild).not.toBeNull();
   });

  it('should correctly determine if ruleset is 2024', () => {
    classRules.getFavoredEnemy.mockReturnValue(2);
    render(<CharClassRanger playerStats={mockPlayerStats2024} />);
    
    expect(screen.getByText(/Favored Enemies/)).toBeInTheDocument();
   });

  it('should call getFavoredEnemy with playerStats', () => {
    render(<CharClassRanger playerStats={mockPlayerStats5e} />);
    
    expect(classRules.getFavoredEnemy).toHaveBeenCalledWith(mockPlayerStats5e);
   });
});
