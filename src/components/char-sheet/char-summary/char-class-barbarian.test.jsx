import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharClassBarbarian from './char-class-barbarian';

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

import storage from '../../../services/storage';

const mockPlayerStats = {
  name: 'Test Character',
  level: 5,
  class: {
    name: 'Barbarian',
    class_levels: [
        { rages: 2, extra_attacks: 0, rage_damage: 2 },
        { rages: 2, extra_attacks: 0, rage_damage: 2 },
        { rages: 3, extra_attacks: 0, rage_damage: 2 },
        { rages: 3, extra_attacks: 0, rage_damage: 2 },
        { rages: 4, extra_attacks: 1, rage_damage: 2 },
      ],
    },
};

describe('CharClassBarbarian', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getProperty.mockReturnValue(null);
    });

  it('should render barbarian class features', () => {
    render(<CharClassBarbarian playerStats={mockPlayerStats} />);

    expect(screen.getByText(/Extra Attacks:/)).toBeInTheDocument();
    expect(screen.getByText(/Rage Points:/)).toBeInTheDocument();
    expect(screen.getByText(/Rage Damage Bonus:/)).toBeInTheDocument();
    expect(screen.getByText(/Weapon Mastery:/)).toBeInTheDocument();
    });

  it('should display extra attacks value', () => {
    render(<CharClassBarbarian playerStats={mockPlayerStats} />);

    const extraAttacksDiv = screen.getByText(/Extra Attacks:/).parentElement;
    expect(extraAttacksDiv.textContent).toContain('1');
    });

  it('should display rage damage bonus', () => {
    render(<CharClassBarbarian playerStats={mockPlayerStats} />);

    const rageDamageDiv = screen.getByText(/Rage Damage Bonus:/).parentElement;
    expect(rageDamageDiv.textContent).toContain('2');
    });

  it('should display max rage points from class level', () => {
    render(<CharClassBarbarian playerStats={mockPlayerStats} />);

    const ragePointsDiv = screen.getByText(/Rage Points:/).parentElement;
    expect(ragePointsDiv.textContent).toContain('4');
    });

  it('should not render when class is not Barbarian', () => {
    const nonBarbarianStats = {
        ...mockPlayerStats,
      level: 1,
      class: {
        name: 'Wizard',
        class_levels: [{ rages: 0, extra_attacks: 0, rage_damage: 0, weapon_mastery: undefined }],
         },
       };

    render(<CharClassBarbarian playerStats={nonBarbarianStats} />);

    expect(screen.queryByText(/Extra Attacks:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rage Points:/)).not.toBeInTheDocument();
    });

  it('should toggle input visibility when rage points div is clicked', () => {
    render(<CharClassBarbarian playerStats={mockPlayerStats} />);

    const ragePointsDiv = screen.getByText(/Rage Points:/).parentElement;
    fireEvent.click(ragePointsDiv);

    expect(screen.getByTestId('hidden-input')).toBeInTheDocument();
    });

  it('should call storage.setProperty when rage points value changes', () => {
    render(<CharClassBarbarian playerStats={mockPlayerStats} />);

    const ragePointsDiv = screen.getByText(/Rage Points:/).parentElement;
    fireEvent.click(ragePointsDiv);

    const input = screen.getByTestId('hidden-input');
    fireEvent.change(input, { target: { value: '3' } });

    expect(storage.setProperty).toHaveBeenCalledWith(
        'Test Character',
        'ragePoints',
        '3'
      );
    });

  it('should use stored rage points when available', () => {
    storage.getProperty.mockReturnValue(2);

    render(<CharClassBarbarian playerStats={mockPlayerStats} />);

    expect(screen.getByTestId('hidden-value')).toHaveTextContent('2');
    });

  it('should handle missing class levels gracefully', () => {
    const incompleteStats = {
          ...mockPlayerStats,
      level: 1,
      class: {
          ...mockPlayerStats.class,
        class_levels: [
             { rages: 2, extra_attacks: 0, rage_damage: 2, weapon_mastery: undefined },
           ],
        },
      };

    render(<CharClassBarbarian playerStats={incompleteStats} />);

    expect(screen.getByText(/Extra Attacks:/)).toBeInTheDocument();
    });

  it('should display N/A for weapon mastery when not defined', () => {
    const statsWithoutWeaponMastery = {
        ...mockPlayerStats,
      class: {
          ...mockPlayerStats.class,
        class_levels: [
            { rages: 2, extra_attacks: 0, rage_damage: 2, weapon_mastery: undefined },
          ],
        },
      level: 1,
      };

    render(<CharClassBarbarian playerStats={statsWithoutWeaponMastery} />);

    const weaponMasteryDiv = screen.getByText(/Weapon Mastery:/).parentElement;
    expect(weaponMasteryDiv.textContent).toContain('N/A');
    });

  it('should display weapon mastery when defined', () => {
    const statsWithWeaponMastery = {
        ...mockPlayerStats,
      class: {
          ...mockPlayerStats.class,
        class_levels: [
            { rages: 2, extra_attacks: 0, rage_damage: 2, weapon_mastery: 'Slashing' },
          ],
        },
      level: 1,
      };

    render(<CharClassBarbarian playerStats={statsWithWeaponMastery} />);

    const weaponMasteryDiv = screen.getByText(/Weapon Mastery:/).parentElement;
    expect(weaponMasteryDiv.textContent).toContain('Slashing');
    });

  it('should show max/cur label', () => {
    render(<CharClassBarbarian playerStats={mockPlayerStats} />);

    expect(screen.getByText(/max\/cur/)).toBeInTheDocument();
    });
});