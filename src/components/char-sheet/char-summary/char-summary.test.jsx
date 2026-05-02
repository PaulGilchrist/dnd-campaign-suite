import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSummary from './char-summary';
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

vi.mock('../common/use-popup', () => ({
  default: vi.fn(() => ({
    PopupElement: null,
    setPopupHtml: vi.fn(),
    showPopup: vi.fn(),
    })),
}));

vi.mock('../char-feats/char-feats', () => ({
  default: vi.fn(({ playerStats, showPopup }) => <div data-testid="char-feats">Feats: {playerStats.class.name}</div>),
}));

vi.mock('./char-hit-points', () => ({
  default: vi.fn(({ playerStats }) => <div data-testid="char-hit-points">HP: {playerStats.hitPoints}</div>),
}));

vi.mock('./char-gold', () => ({
  default: vi.fn(({ playerStats }) => <div data-testid="char-gold">Gold: {playerStats.inventory?.gold}</div>),
}));

vi.mock('./char-class-barbarian', () => ({ default: vi.fn(({ playerStats }) => <div data-testid="char-class-barbarian">{playerStats.class.name}</div>) }));
vi.mock('./char-class-bard', () => ({ default: vi.fn(({ playerStats }) => <div data-testid="char-class-bard">{playerStats.class.name}</div>) }));
vi.mock('./char-class-cleric', () => ({ default: vi.fn(({ playerStats }) => <div data-testid="char-class-cleric">{playerStats.class.name}</div>) }));
vi.mock('./char-class-druid', () => ({ default: vi.fn(({ playerStats }) => <div data-testid="char-class-druid">{playerStats.class.name}</div>) }));
vi.mock('./char-class-fighter', () => ({ default: vi.fn(({ playerStats }) => <div data-testid="char-class-fighter">{playerStats.class.name}</div>) }));
vi.mock('./char-class-monk', () => ({ default: vi.fn(({ playerStats }) => <div data-testid="char-class-monk">{playerStats.class.name}</div>) }));
vi.mock('./char-class-paladin', () => ({ default: vi.fn(({ playerStats }) => <div data-testid="char-class-paladin">{playerStats.class.name}</div>) }));
vi.mock('./char-class-ranger', () => ({ default: vi.fn(({ playerStats }) => <div data-testid="char-class-ranger">{playerStats.class.name}</div>) }));
vi.mock('./char-class-rogue', () => ({ default: vi.fn(({ playerStats }) => <div data-testid="char-class-rogue">{playerStats.class.name}</div>) }));
vi.mock('./char-class-sorcerer', () => ({ default: vi.fn(({ playerStats }) => <div data-testid="char-class-sorcerer">{playerStats.class.name}</div>) }));
vi.mock('./char-class-warlock', () => ({ default: vi.fn(({ playerStats }) => <div data-testid="char-class-warlock">{playerStats.class.name}</div>) }));
vi.mock('./char-class-wizard', () => ({ default: vi.fn(({ playerStats }) => <div data-testid="char-class-wizard">{playerStats.class.name}</div>) }));

vi.mock('../../../services/class-rules-2024', () => ({
  default: {
    getUnarmoredMovementIncrease: vi.fn(() => 0),
    },
}));

beforeEach(() => {
  vi.clearAllMocks();
  storage.getProperty.mockReturnValue(null);
  vi.spyOn(window, 'location', 'get').mockReturnValue({ hostname: 'localhost' });
  window.confirm = vi.fn(() => true);
});

const mockPlayerStats = {
  name: 'Test Character',
  level: 5,
  alignment: 'Lawful Good',
  armorClass: 15,
  armorClassFormula: '10 + 2 (Dex) + 3 (Shield)',
  hitPoints: 45,
  proficiency: 3,
  initiative: 2,
  race: {
    name: 'Human',
    subrace: { name: 'Mountain Dwarf', speed: 25 },
    speed: 30,
    type: 'Humanoid',
    },
  class: {
    name: 'Fighter',
    subclass: { name: 'Champion', type: 'martial' },
    class_levels: [
        {}, { extra_attacks: 1, second_wind: 1 },
        { extra_attacks: 1, second_wind: 1 },
        { extra_attacks: 1, second_wind: 1 },
        { extra_attacks: 1, second_wind: 2 },
      ],
    },
  inventory: { gold: 100 },
};

describe('CharSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getProperty.mockReturnValue(null);
    });

  it('should render character name', () => {
    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByText('Test Character')).toBeInTheDocument();
    });

  it('should display race name', () => {
    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByText(/Mountain Dwarf/)).toBeInTheDocument();
    });

   it('should display class name', () => {
     render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

     expect(screen.getByTestId('char-class-fighter')).toBeInTheDocument();
     });

  it('should display level', () => {
    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByText(/Level 5/)).toBeInTheDocument();
    });

   it('should display alignment', () => {
     render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

     expect(screen.getByText(/Lawful Good/)).toBeInTheDocument();
     });

  it('should render armor class', () => {
    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByText(/Armor Class/)).toBeInTheDocument();
    });

  it('should render hit points component', () => {
    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByTestId('char-hit-points')).toBeInTheDocument();
    });

  it('should render speed', () => {
    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByText(/Speed/)).toBeInTheDocument();
    });

  it('should render gold component', () => {
    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByTestId('char-gold')).toBeInTheDocument();
    });

  it('should render proficiency bonus', () => {
    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByText(/Proficiency/)).toBeInTheDocument();
    });

  it('should render initiative', () => {
    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByText(/Initiative/)).toBeInTheDocument();
    });

  it('should render inspiration checkbox', () => {
    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByText(/Inspiration/)).toBeInTheDocument();
    });

  it('should render short rest hit dice', () => {
    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByText(/Short Rest Hit Dice/)).toBeInTheDocument();
    });

  it('should render feats component', () => {
    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByTestId('char-feats')).toBeInTheDocument();
    });

  it('should render delete button when on localhost', () => {
    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByTitle('Delete Character')).toBeInTheDocument();
    });

  it('should not render delete button when not on localhost', () => {
    vi.spyOn(window, 'location', 'get').mockReturnValue({ hostname: 'example.com' });
    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.queryByTitle('Delete Character')).not.toBeInTheDocument();
    });

  it('should call onDeleteCharacter when delete is confirmed', () => {
    const mockDelete = vi.fn();
    window.confirm = vi.fn(() => true);

    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={mockDelete} />);

    fireEvent.click(screen.getByTitle('Delete Character'));

    expect(mockDelete).toHaveBeenCalledWith('Test Character');
    });

  it('should not call onDeleteCharacter when delete is not confirmed', () => {
    const mockDelete = vi.fn();
    window.confirm = vi.fn(() => false);

    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={mockDelete} />);

    fireEvent.click(screen.getByTitle('Delete Character'));

    expect(mockDelete).not.toHaveBeenCalled();
    });

  it('should show character name only when no subrace', () => {
    const statsNoSubrace = {
        ...mockPlayerStats,
      race: { name: 'Tiefling', speed: 30, type: 'Humanoid' },
      };

    render(<CharSummary playerStats={statsNoSubrace} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByText(/Tiefling/)).toBeInTheDocument();
    });

  it('should toggle inspiration checkbox', () => {
    storage.getProperty.mockReturnValue(false);

    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    const checkbox = document.querySelector('input[type="checkbox"]');
    expect(checkbox).not.toBeChecked();

    fireEvent.change(checkbox, { target: { checked: true } });
    expect(checkbox).toBeChecked();
    });

  it('should show stored inspiration value', () => {
    storage.getProperty.mockReturnValue(true);

    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    const checkbox = document.querySelector('input[type="checkbox"]');
    expect(checkbox).toBeChecked();
    });
});
