import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharClassMonk from './char-class-monk';

// Mock the storage service
vi.mock('../../../services/storage', () => ({
  default: {
    getProperty: vi.fn(),
    setProperty: vi.fn(),
    },
}));

// Mock HiddenInput component
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

// Mock classRules (2024)
vi.mock('../../../services/class-rules-2024', () => ({
  default: {
    getMartialArtsDie: vi.fn(),
    getFocusPoints: vi.fn(),
    getUnarmoredMovementIncrease: vi.fn(),
    },
}));

import storage from '../../../services/storage';
import classRules from '../../../services/class-rules-2024';

const mockPlayerStats = {
  name: 'Test Monk',
  level: 5,
  abilities: [
       { name: 'Strength', bonus: 2 },
       { name: 'Dexterity', bonus: 3 },
       { name: 'Constitution', bonus: 1 },
       { name: 'Intelligence', bonus: 0 },
       { name: 'Wisdom', bonus: 4 },
       { name: 'Charisma', bonus: -1 },
     ],
  proficiency: 3,
  class: {
    name: 'Monk',
    class_levels: [
         { martial_arts_die: 4, extra_attacks: 0, focus_points: 2, unarmored_movement_increase: 0 },
         { martial_arts_die: 4, extra_attacks: 0, focus_points: 3, unarmored_movement_increase: 0 },
         { martial_arts_die: 6, extra_attacks: 1, focus_points: 3, unarmored_movement_increase: 10 },
         { martial_arts_die: 6, extra_attacks: 1, focus_points: 4, unarmored_movement_increase: 10 },
         { martial_arts_die: 8, extra_attacks: 1, focus_points: 5, unarmored_movement_increase: 15 },
       ],
     },
};

describe('CharClassMonk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getProperty.mockReturnValue(null);
    
    classRules.getMartialArtsDie.mockReturnValue(8);
    classRules.getFocusPoints.mockReturnValue(5);
    classRules.getUnarmoredMovementIncrease.mockReturnValue(15);
    });

  it('should not render when class is not Monk', () => {
    const nonMonkStats = {
        ...mockPlayerStats,
      class: {
        name: 'Wizard',
        class_levels: [{ martial_arts_die: 4, extra_attacks: 0, focus_points: 0, unarmored_movement_increase: 0 }],
         },
       };

    render(<CharClassMonk playerStats={nonMonkStats} />);

    expect(screen.queryByText(/Martial Arts Die:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Focus Points:/)).not.toBeInTheDocument();
    });

  it('should not render when level is 1 or less', () => {
    const lowLevelStats = {
        ...mockPlayerStats,
      level: 1,
      };

    render(<CharClassMonk playerStats={lowLevelStats} />);

    expect(screen.queryByText(/Martial Arts Die:/)).not.toBeInTheDocument();
    });

  it('should render monk class features', () => {
    render(<CharClassMonk playerStats={mockPlayerStats} />);

    expect(screen.getByText(/Martial Arts Die:/)).toBeInTheDocument();
    expect(screen.getByText(/Extra Attacks:/)).toBeInTheDocument();
    expect(screen.getByText(/Focus Points:/)).toBeInTheDocument();
    expect(screen.getByText(/Focus Save DC:/)).toBeInTheDocument();
    expect(screen.getByText(/Unarmored Movement:/)).toBeInTheDocument();
    });

  it('should display martial arts die', () => {
    render(<CharClassMonk playerStats={mockPlayerStats} />);

    const martialArtsDiv = screen.getByText(/Martial Arts Die:/).parentElement;
    expect(martialArtsDiv.textContent).toContain('d8');
    });

  it('should display extra attacks value', () => {
    render(<CharClassMonk playerStats={mockPlayerStats} />);

    const extraAttacksDiv = screen.getByText(/Extra Attacks:/).parentElement;
    expect(extraAttacksDiv.textContent).toContain('1');
    });

  it('should display focus points', () => {
    render(<CharClassMonk playerStats={mockPlayerStats} />);

    const focusPointsDiv = screen.getByText(/Focus Points:/).parentElement;
    expect(focusPointsDiv.textContent).toContain('5');
    });

  it('should display focus save DC calculated from wisdom bonus and proficiency', () => {
    render(<CharClassMonk playerStats={mockPlayerStats} />);

    const saveDcDiv = screen.getByText(/Focus Save DC:/).parentElement;
    // DC = 8 + wisdom.bonus (4) + proficiency (3) = 15
    expect(saveDcDiv.textContent).toContain('15');
    });

  it('should display unarmored movement increase', () => {
    render(<CharClassMonk playerStats={mockPlayerStats} />);

    const movementDiv = screen.getByText(/Unarmored Movement:/).parentElement;
    expect(movementDiv.textContent).toContain('+15 ft.');
    });

  it('should toggle input visibility when focus points div is clicked', () => {
    render(<CharClassMonk playerStats={mockPlayerStats} />);

    const focusPointsDiv = screen.getByText(/Focus Points:/).parentElement;
    fireEvent.click(focusPointsDiv);

    expect(screen.getByTestId('hidden-input')).toBeInTheDocument();
    });

  it('should call storage.setProperty when focus points value changes', () => {
    render(<CharClassMonk playerStats={mockPlayerStats} />);

    const focusPointsDiv = screen.getByText(/Focus Points:/).parentElement;
    fireEvent.click(focusPointsDiv);

    const input = screen.getByTestId('hidden-input');
    fireEvent.change(input, { target: { value: '3' } });

    expect(storage.setProperty).toHaveBeenCalledWith(
         'Test Monk',
         'focusPoints',
         '3'
       );
     });

  it('should use stored focus points when available', () => {
    storage.getProperty.mockReturnValue(3);

    render(<CharClassMonk playerStats={mockPlayerStats} />);

    expect(screen.getByTestId('hidden-value')).toHaveTextContent('3');
    });

  it('should show max/cur label', () => {
    render(<CharClassMonk playerStats={mockPlayerStats} />);

    expect(screen.getByText(/max\/cur/)).toBeInTheDocument();
    });

  it('should call classRules functions', () => {
    render(<CharClassMonk playerStats={mockPlayerStats} />);

    expect(classRules.getMartialArtsDie).toHaveBeenCalled();
    expect(classRules.getFocusPoints).toHaveBeenCalled();
    expect(classRules.getUnarmoredMovementIncrease).toHaveBeenCalled();
    });

  it('should display focus save DC with different wisdom bonus', () => {
    const statsWithDifferentWisdom = {
         ...mockPlayerStats,
      abilities: [
           { name: 'Strength', bonus: 2 },
           { name: 'Dexterity', bonus: 3 },
           { name: 'Constitution', bonus: 1 },
           { name: 'Intelligence', bonus: 0 },
           { name: 'Wisdom', bonus: 2 },
           { name: 'Charisma', bonus: -1 },
         ],
       };

    render(<CharClassMonk playerStats={statsWithDifferentWisdom} />);

    const saveDcDiv = screen.getByText(/Focus Save DC:/).parentElement;
    // DC = 8 + wisdom.bonus (2) + proficiency (3) = 13
    expect(saveDcDiv.textContent).toContain('13');
     });
});