import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSummary from './CharSummary.jsx';
import storage from '../../../services/storage.js';

vi.mock('../../../services/storage.js', () => ({
  default: {
    getProperty: vi.fn(),
    setProperty: vi.fn(),
    },
}));

vi.mock('../../common/HiddenInput.jsx', () => ({
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

const setPopupHtmlMock = vi.fn();

vi.mock('../../../hooks/usePopup.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: setPopupHtmlMock,
    showPopup: vi.fn(),
  })),
}));

vi.mock('../char-feats/CharFeats.jsx', () => ({
  default: vi.fn(({ playerStats, showPopup }) => (
    <div data-testid="char-feats">
      Feats: {playerStats.class.name}
      <button onClick={() => showPopup({ name: 'Test Feat', desc: ['Test description'] })}>Trigger Popup</button>
    </div>
  )),
}));

vi.mock('./CharHitPoints.jsx', () => ({
  default: vi.fn(({ playerStats }) => <div data-testid="char-hit-points">HP: {playerStats.hitPoints}</div>),
}));

vi.mock('./CharGold.jsx', () => ({
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

vi.mock('../../../services/classRules2024.js', () => ({
  default: {
    getUnarmoredMovementIncrease: vi.fn(() => 0),
    getMartialArtsDie: vi.fn(() => 1),
    getFocusPoints: vi.fn(() => 0),
    getFavoredEnemy: vi.fn(() => 0),
    getDruidMaxWildShapeChallengeRating: vi.fn(() => 0),
    getDruidWildShapeUses: vi.fn(() => 0),
    getDruidBeastKnownForms: vi.fn(() => 0),
    getDruidBeastFlySpeed: vi.fn(() => false),
    getEldritchInvocations: vi.fn(() => 0),
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

  it('should calculate speed with Monk unarmored movement', () => {
    const monkStats = {
      ...mockPlayerStats,
      class: { name: 'Monk' },
      rules: '5e',
    };

    render(<CharSummary playerStats={monkStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByText(/Speed/)).toBeInTheDocument();
  });

  it('should calculate speed with Barbarian unarmored movement', () => {
    const barbarianStats = {
      ...mockPlayerStats,
      class: {
        name: 'Barbarian',
        class_levels: [
          { class_specific: { unarmored_movement: 10 } },
        ],
      },
      rules: '5e',
    };

    render(<CharSummary playerStats={barbarianStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByText(/Speed/)).toBeInTheDocument();
  });

  it('should show armor class formula popup on click', () => {
    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    const acElement = screen.getByText(/Armor Class/);
    fireEvent.click(acElement);

    expect(setPopupHtmlMock).toHaveBeenCalled();
  });

  it('should render Barbarian class component', () => {
    const barbarianStats = {
      ...mockPlayerStats,
      class: { name: 'Barbarian', subclass: null },
    };

    render(<CharSummary playerStats={barbarianStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByTestId('char-class-barbarian')).toBeInTheDocument();
  });

  it('should render Bard class component', () => {
    const bardStats = {
      ...mockPlayerStats,
      class: { name: 'Bard', subclass: null },
    };

    render(<CharSummary playerStats={bardStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByTestId('char-class-bard')).toBeInTheDocument();
  });

  it('should render Cleric class component', () => {
    const clericStats = {
      ...mockPlayerStats,
      class: { name: 'Cleric', subclass: null },
    };

    render(<CharSummary playerStats={clericStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByTestId('char-class-cleric')).toBeInTheDocument();
  });

  it('should render Druid class component', () => {
    const druidStats = {
      ...mockPlayerStats,
      class: { name: 'Druid', subclass: null },
    };

    render(<CharSummary playerStats={druidStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByTestId('char-class-druid')).toBeInTheDocument();
  });

  it('should render Paladin class component', () => {
    const paladinStats = {
      ...mockPlayerStats,
      class: { name: 'Paladin', subclass: null },
    };

    render(<CharSummary playerStats={paladinStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByTestId('char-class-paladin')).toBeInTheDocument();
  });

  it('should render Ranger class component', () => {
    const rangerStats = {
      ...mockPlayerStats,
      class: { name: 'Ranger', subclass: null },
    };

    render(<CharSummary playerStats={rangerStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByTestId('char-class-ranger')).toBeInTheDocument();
  });

  it('should render Rogue class component', () => {
    const rogueStats = {
       ...mockPlayerStats,
       class: {
         name: 'Rogue',
         subclass: null,
         class_levels: [{}, {}, {}, {}, { sneak_attack_num_d6: 4 }],
       },
    };

    render(<CharSummary playerStats={rogueStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByTestId('char-class-rogue')).toBeInTheDocument();
    });

  it('should render Warlock class component', () => {
    const warlockStats = {
      ...mockPlayerStats,
      class: { name: 'Warlock', subclass: null },
    };

    render(<CharSummary playerStats={warlockStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByTestId('char-class-warlock')).toBeInTheDocument();
  });

  it('should render Wizard class component', () => {
    const wizardStats = {
      ...mockPlayerStats,
      class: { name: 'Wizard', subclass: null },
    };

    render(<CharSummary playerStats={wizardStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByTestId('char-class-wizard')).toBeInTheDocument();
  });

  it('should render background when present', () => {
    const statsWithBackground = {
      ...mockPlayerStats,
      background: 'Noble',
    };

    render(<CharSummary playerStats={statsWithBackground} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByText(/Background/)).toBeInTheDocument();
  });

  it('should handle short rest hit dice toggle', () => {
    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    const hitDiceElement = screen.getByText(/Short Rest Hit Dice/);
    fireEvent.click(hitDiceElement);

    expect(screen.getByTestId('hidden-input')).toBeInTheDocument();
  });

  it('should update short rest hit dice value', () => {
    storage.getProperty.mockReturnValue(3);

    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    const hiddenValues = screen.getAllByTestId('hidden-value');
    expect(hiddenValues[0]).toHaveTextContent('3');
   });

  it('should not render short rest hit dice input when not toggled', () => {
    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.queryByTestId('hidden-input')).not.toBeInTheDocument();
  });

  it('should show feats popup with array description format', () => {
    const featsStats = {
      ...mockPlayerStats,
      feats: [
        { name: 'Great Weapon Master', desc: ['Bonus attack', 'Power attack'] },
      ],
    };

    render(<CharSummary playerStats={featsStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByTestId('char-feats')).toBeInTheDocument();
  });

  it('should show feats popup with string description format', () => {
    const featsStats = {
      ...mockPlayerStats,
      feats: [
        { name: 'Sharpshooter', description: 'No disadvantage on long range' },
      ],
    };

    render(<CharSummary playerStats={featsStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByTestId('char-feats')).toBeInTheDocument();
  });

  it('should show feat with benefits', () => {
    const featsStats = {
      ...mockPlayerStats,
      feats: [
        {
          name: 'Great Weapon Master',
          desc: ['Bonus attack'],
          benefits: [{ description: 'Power attack' }]
        },
      ],
    };

    render(<CharSummary playerStats={featsStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByTestId('char-feats')).toBeInTheDocument();
  });

  it('should show feat with prerequisites - level', () => {
    const featsStats = {
      ...mockPlayerStats,
      feats: [
        {
          name: 'Heavy Armor Master',
          desc: ['Reduces damage by 3'],
          prerequisites: { level: 4 }
        },
      ],
    };

    render(<CharSummary playerStats={featsStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByTestId('char-feats')).toBeInTheDocument();
  });

  it('should show feat with prerequisites - ability scores', () => {
    const featsStats = {
      ...mockPlayerStats,
      feats: [
        {
          name: 'Sharpshooter',
          desc: ['No disadvantage'],
          prerequisites: { ability_scores: [{ name: 'Dexterity', minimum: 13 }] }
        },
      ],
    };

    render(<CharSummary playerStats={featsStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByTestId('char-feats')).toBeInTheDocument();
  });

  it('should show Monk class component', () => {
    const monkStats = {
      ...mockPlayerStats,
      class: { name: 'Monk', subclass: null },
    };

    render(<CharSummary playerStats={monkStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByTestId('char-class-monk')).toBeInTheDocument();
  });

  it('should trigger feat popup with description', () => {
    const featsStats = {
      ...mockPlayerStats,
      feats: [
        { name: 'Great Weapon Master', desc: ['Bonus attack'] },
      ],
    };

    render(<CharSummary playerStats={featsStats} onDeleteCharacter={vi.fn()} />);

    // Click the button that triggers showPopup
    const triggerButton = screen.getByText('Trigger Popup');
    fireEvent.click(triggerButton);

    expect(setPopupHtmlMock).toHaveBeenCalled();
  });
});
