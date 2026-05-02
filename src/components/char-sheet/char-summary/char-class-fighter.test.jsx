import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharClassFighter from './char-class-fighter';

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
  name: 'Test Fighter',
  level: 5,
  class: {
    name: 'Fighter',
    fightingStyles: ['Defense', 'Dueling'],
    class_levels: [
        { extra_attacks: 0, second_wind: 1, weapon_mastery: undefined },
        { extra_attacks: 0, second_wind: 1, weapon_mastery: undefined },
        { extra_attacks: 1, second_wind: 1, weapon_mastery: undefined },
        { extra_attacks: 1, second_wind: 1, weapon_mastery: undefined },
        { extra_attacks: 1, second_wind: 2, weapon_mastery: 'Slashing' },
      ],
    },
};

const mockPlayerStatsWithEnergy = {
  name: 'Test Fighter Psi',
  level: 5,
  class: {
    name: 'Fighter',
    fightingStyles: ['Defense'],
    major: { name: 'Psi Warrior' },
    subclass: { name: 'Psi Warrior' },
    class_levels: [
        { extra_attacks: 0, second_wind: 1, weapon_mastery: undefined },
        { extra_attacks: 0, second_wind: 1, weapon_mastery: undefined },
        { extra_attacks: 1, second_wind: 1, weapon_mastery: undefined, energy: { required_major: 'Psi Warrior', energy_die_num: 4, energy_die_type: 6 } },
        { extra_attacks: 1, second_wind: 1, weapon_mastery: undefined, energy: { required_major: 'Psi Warrior', energy_die_num: 4, energy_die_type: 6 } },
        { extra_attacks: 1, second_wind: 2, weapon_mastery: 'Slashing', energy: { required_major: 'Psi Warrior', energy_die_num: 6, energy_die_type: 8 } },
      ],
    },
};

describe('CharClassFighter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getProperty.mockReturnValue(null);
   });

  it('should not render when class is not Fighter', () => {
    const nonFighterStats = {
       ...mockPlayerStats,
      class: {
        name: 'Wizard',
        class_levels: [{ extra_attacks: 0, second_wind: 0 }],
        },
      };

    render(<CharClassFighter playerStats={nonFighterStats} />);

    expect(screen.queryByText(/Fighting Styles:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Extra Attacks:/)).not.toBeInTheDocument();
   });

  it('should render fighter class features', () => {
    render(<CharClassFighter playerStats={mockPlayerStats} />);

    expect(screen.getByText(/Fighting Styles:/)).toBeInTheDocument();
    expect(screen.getByText(/Extra Attacks:/)).toBeInTheDocument();
    expect(screen.getByText(/Weapon Mastery:/)).toBeInTheDocument();
    expect(screen.getByText(/Second Wind:/)).toBeInTheDocument();
   });

  it('should display fighting styles', () => {
    render(<CharClassFighter playerStats={mockPlayerStats} />);

    const stylesDiv = screen.getByText(/Fighting Styles:/).parentElement;
    expect(stylesDiv.textContent).toContain('Defense');
    expect(stylesDiv.textContent).toContain('Dueling');
   });

  it('should display N/A for fighting styles when not defined', () => {
    const statsWithoutStyles = {
       ...mockPlayerStats,
      class: {
        ...mockPlayerStats.class,
        fightingStyles: undefined,
        },
      };

    render(<CharClassFighter playerStats={statsWithoutStyles} />);

    const stylesDiv = screen.getByText(/Fighting Styles:/).parentElement;
    expect(stylesDiv.textContent).toContain('N/A');
   });

  it('should display extra attacks value', () => {
    render(<CharClassFighter playerStats={mockPlayerStats} />);

    const extraAttacksDiv = screen.getByText(/Extra Attacks:/).parentElement;
    expect(extraAttacksDiv.textContent).toContain('1');
   });

  it('should display weapon mastery value', () => {
    render(<CharClassFighter playerStats={mockPlayerStats} />);

    const weaponMasteryDiv = screen.getByText(/Weapon Mastery:/).parentElement;
    expect(weaponMasteryDiv.textContent).toContain('Slashing');
   });

  it('should display second wind uses', () => {
    render(<CharClassFighter playerStats={mockPlayerStats} />);

    const secondWindDiv = screen.getByText(/Second Wind:/).parentElement;
    expect(secondWindDiv.textContent).toContain('2');
   });

  it('should toggle input visibility when second wind div is clicked', () => {
    render(<CharClassFighter playerStats={mockPlayerStats} />);

    const secondWindDiv = screen.getByText(/Second Wind:/).parentElement;
    fireEvent.click(secondWindDiv);

    expect(screen.getByTestId('hidden-input')).toBeInTheDocument();
   });

  it('should call storage.setProperty when second wind value changes', () => {
    render(<CharClassFighter playerStats={mockPlayerStats} />);

    const secondWindDiv = screen.getByText(/Second Wind:/).parentElement;
    fireEvent.click(secondWindDiv);

    const input = screen.getByTestId('hidden-input');
    fireEvent.change(input, { target: { value: '1' } });

    expect(storage.setProperty).toHaveBeenCalledWith(
        'Test Fighter',
        'secondWindUses',
        '1'
      );
    });

  it('should use stored second wind uses when available', () => {
    storage.getProperty.mockReturnValue(1);

    render(<CharClassFighter playerStats={mockPlayerStats} />);

    expect(screen.getByTestId('hidden-value')).toHaveTextContent('1');
   });

  it('should render psionic energy section when fighter has Psi Warrior subclass', () => {
    render(<CharClassFighter playerStats={mockPlayerStatsWithEnergy} />);

    expect(screen.getByText(/Psionic Energy \(Psi Warrior\):/)).toBeInTheDocument();
    expect(screen.getByText(/Energy Dice:/)).toBeInTheDocument();
    expect(screen.getByText(/Energy Die Type:/)).toBeInTheDocument();
   });

  it('should not render psionic energy section when fighter does not have Psi Warrior subclass', () => {
    render(<CharClassFighter playerStats={mockPlayerStats} />);

    expect(screen.queryByText(/Psionic Energy/)).not.toBeInTheDocument();
   });

  it('should toggle psionic energy input visibility when clicked', () => {
    render(<CharClassFighter playerStats={mockPlayerStatsWithEnergy} />);

    const energyDiv = screen.getByText(/Energy Dice:/).parentElement;
    fireEvent.click(energyDiv);

    expect(screen.getAllByTestId('hidden-input').length).toBeGreaterThanOrEqual(1);
    });

  it('should call storage.setProperty when psionic energy value changes', () => {
    render(<CharClassFighter playerStats={mockPlayerStatsWithEnergy} />);

    const energyDiv = screen.getByText(/Energy Dice:/).parentElement;
    fireEvent.click(energyDiv);

    const inputs = screen.getAllByTestId('hidden-input');
    const input = inputs[inputs.length - 1];
    fireEvent.change(input, { target: { value: '3' } });

    expect(storage.setProperty).toHaveBeenCalledWith(
        'Test Fighter Psi',
        'psionicEnergy',
        '3'
      );
    });

  it('should display energy die type', () => {
    render(<CharClassFighter playerStats={mockPlayerStatsWithEnergy} />);

    const dieTypeDiv = screen.getByText(/Energy Die Type:/).parentElement;
    expect(dieTypeDiv.textContent).toContain('d8');
   });

  it('should return null when class level is not found', () => {
    const statsWithoutClassLevel = {
       ...mockPlayerStats,
      level: 100,
     };

    const { container } = render(<CharClassFighter playerStats={statsWithoutClassLevel} />);

    expect(container.firstChild).toBeNull();
   });

  it('should show cur/max label for second wind', () => {
    render(<CharClassFighter playerStats={mockPlayerStats} />);

    expect(screen.getByText(/cur\/max/)).toBeInTheDocument();
   });
});