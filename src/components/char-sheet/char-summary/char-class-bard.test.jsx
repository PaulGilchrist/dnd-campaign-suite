import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharClassBard from './char-class-bard';

// Mock the storage service
vi.mock('../../../services/storage', () => ({
  default: {
    getProperty: vi.fn(),
    setProperty: vi.fn(),
    },
}));

// Mock the classRules service
vi.mock('../../../services/class-rules', () => ({
  default: {
    getHighestSubclassLevel: vi.fn(),
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
import classRules from '../../../services/class-rules';

const mockPlayerStats = {
  name: 'Test Character',
  level: 5,
  rules: '5e',
  class: {
    name: 'Bard',
    subclass: null,
    expertise: ['Deception', 'Persuasion'],
    class_levels: [
        { class_specific: { bardic_inspiration_die: 4, song_of_rest_die: 4, magical_secrets_max_5: 0 } },
        { class_specific: { bardic_inspiration_die: 4, song_of_rest_die: 4, magical_secrets_max_5: 0 } },
        { class_specific: { bardic_inspiration_die: 4, song_of_rest_die: 4, magical_secrets_max_5: 0 } },
        { class_specific: { bardic_inspiration_die: 4, song_of_rest_die: 4, magical_secrets_max_5: 0 } },
        { class_specific: { bardic_inspiration_die: 4, song_of_rest_die: 4, magical_secrets_max_5: 0 } },
      ],
    },
  abilities: [
     { name: 'Charisma', bonus: 3 },
    ],
};

describe('CharClassBard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getProperty.mockReturnValue(null);
    classRules.getHighestSubclassLevel.mockReturnValue({ subclass_specific: {} });
    });

  it('should render bard class features', () => {
    render(<CharClassBard playerStats={mockPlayerStats} />);

    expect(screen.getByText(/Bardic Inspiration Die:/)).toBeInTheDocument();
    expect(screen.getByText(/Uses:/)).toBeInTheDocument();
    });

  it('should display bardic inspiration die value', () => {
    render(<CharClassBard playerStats={mockPlayerStats} />);

    const bardicDieDiv = screen.getByText(/Bardic Inspiration Die:/).parentElement;
    expect(bardicDieDiv.textContent).toContain('d4');
    });

  it('should display song of rest die for 5e rules', () => {
    render(<CharClassBard playerStats={mockPlayerStats} />);

    expect(screen.getByText(/Song of Rest Die:/)).toBeInTheDocument();
    const songOfRestDiv = screen.getByText(/Song of Rest Die:/).parentElement;
    expect(songOfRestDiv.textContent).toContain('d4');
    });

  it('should display magical secrets count for 5e rules', () => {
    render(<CharClassBard playerStats={mockPlayerStats} />);

    expect(screen.getByText(/Magical Secrets:/)).toBeInTheDocument();
    });

  it('should display expertise when level > 2', () => {
    render(<CharClassBard playerStats={mockPlayerStats} />);

    expect(screen.getByText(/Expertise:/)).toBeInTheDocument();
    expect(screen.getByText(/Deception/)).toBeInTheDocument();
    expect(screen.getByText(/Persuasion/)).toBeInTheDocument();
    });

  it('should not render when class is not Bard', () => {
    const nonBardStats = {
        ...mockPlayerStats,
      class: {
        name: 'Wizard',
        class_levels: [],
        },
      };

    render(<CharClassBard playerStats={nonBardStats} />);

    expect(screen.queryByText(/Bardic Inspiration Die:/)).not.toBeInTheDocument();
    });

  it('should not show song of rest die for 2024 rules', () => {
    const stats2024 = {
        ...mockPlayerStats,
      rules: '2024',
      class: {
          ...mockPlayerStats.class,
        class_levels: [
            { bardic_die: 4 },
            { bardic_die: 4 },
            { bardic_die: 4 },
            { bardic_die: 4 },
            { bardic_die: 4 },
          ],
        },
      };

    render(<CharClassBard playerStats={stats2024} />);

    expect(screen.queryByText(/Song of Rest Die:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Magical Secrets:/)).not.toBeInTheDocument();
    });

  it('should use bardic_die for 2024 rules', () => {
    const stats2024 = {
        ...mockPlayerStats,
      rules: '2024',
      class: {
          ...mockPlayerStats.class,
        class_levels: [
            { bardic_die: 6 },
            { bardic_die: 6 },
            { bardic_die: 6 },
            { bardic_die: 6 },
            { bardic_die: 6 },
          ],
        },
      };

    render(<CharClassBard playerStats={stats2024} />);

    const bardicDieDiv = screen.getByText(/Bardic Inspiration Die:/).parentElement;
    expect(bardicDieDiv.textContent).toContain('d6');
    });

  it('should toggle input visibility when uses div is clicked', () => {
    render(<CharClassBard playerStats={mockPlayerStats} />);

    const usesElement = screen.getByText(/Uses:/);
    fireEvent.click(usesElement);

    expect(screen.getByTestId('hidden-input')).toBeInTheDocument();
    });

  it('should call storage.setProperty when bardic inspiration uses value changes', () => {
    render(<CharClassBard playerStats={mockPlayerStats} />);

    const usesElement = screen.getByText(/Uses:/);
    fireEvent.click(usesElement);

    const input = screen.getByTestId('hidden-input');
    fireEvent.change(input, { target: { value: '2' } });

    expect(storage.setProperty).toHaveBeenCalledWith(
        'Test Character',
        'bardicInspirationUses',
        '2'
      );
    });

  it('should use stored bardic inspiration uses when available', () => {
    storage.getProperty.mockReturnValue(2);

    render(<CharClassBard playerStats={mockPlayerStats} />);

    expect(screen.getByTestId('hidden-value')).toHaveTextContent('2');
    });

  it('should not show expertise when level <= 2', () => {
    const lowLevelStats = {
        ...mockPlayerStats,
      level: 2,
      };

    render(<CharClassBard playerStats={lowLevelStats} />);

    expect(screen.queryByText(/Expertise:/)).not.toBeInTheDocument();
    });

  it('should show max/cur label', () => {
    render(<CharClassBard playerStats={mockPlayerStats} />);

    expect(screen.getByText(/max\/cur/)).toBeInTheDocument();
    });

  it('should handle Lore subclass magical secrets', () => {
    classRules.getHighestSubclassLevel.mockReturnValue({
       subclass_specific: { additional_magical_secrets_max_lvl: 2 },
      });

    const loreStats = {
        ...mockPlayerStats,
      level: 3,
      class: {
          ...mockPlayerStats.class,
        subclass: { name: 'Lore' },
        },
      };

    render(<CharClassBard playerStats={loreStats} />);

    expect(screen.getByText(/Magical Secrets:/)).toBeInTheDocument();
    });

  it('should not show extra attacks for level <= 5', () => {
    render(<CharClassBard playerStats={mockPlayerStats} />);

    expect(screen.queryByText(/Extra Attacks:/)).not.toBeInTheDocument();
    });

  it('should show extra attacks for level > 5 in 5e rules', () => {
    const highLevelStats = {
        ...mockPlayerStats,
      level: 6,
      class: {
          ...mockPlayerStats.class,
        class_levels: [
            { class_specific: { bardic_inspiration_die: 4, song_of_rest_die: 4, magical_secrets_max_5: 0 } },
            { class_specific: { bardic_inspiration_die: 4, song_of_rest_die: 4, magical_secrets_max_5: 0 } },
            { class_specific: { bardic_inspiration_die: 4, song_of_rest_die: 4, magical_secrets_max_5: 0 } },
            { class_specific: { bardic_inspiration_die: 4, song_of_rest_die: 4, magical_secrets_max_5: 0 } },
            { class_specific: { bardic_inspiration_die: 4, song_of_rest_die: 4, magical_secrets_max_5: 0 } },
            { class_specific: { bardic_inspiration_die: 4, song_of_rest_die: 4, magical_secrets_max_5: 0 } },
          ],
        },
      };

    render(<CharClassBard playerStats={highLevelStats} />);

    expect(screen.getByText(/Extra Attacks:/)).toBeInTheDocument();
    const extraAttacksDiv = screen.getByText(/Extra Attacks:/).parentElement;
    expect(extraAttacksDiv.textContent).toContain('1');
    });

  it('should not show extra attacks for 2024 rules', () => {
    const stats2024 = {
        ...mockPlayerStats,
      level: 6,
      rules: '2024',
      class: {
          ...mockPlayerStats.class,
        class_levels: [
            { bardic_die: 4 },
            { bardic_die: 4 },
            { bardic_die: 4 },
            { bardic_die: 4 },
            { bardic_die: 4 },
            { bardic_die: 4 },
          ],
        },
      };

    render(<CharClassBard playerStats={stats2024} />);

    expect(screen.queryByText(/Extra Attacks:/)).not.toBeInTheDocument();
    });
});