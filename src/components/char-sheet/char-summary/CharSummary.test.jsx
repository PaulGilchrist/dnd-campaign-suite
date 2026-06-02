import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSummary from './CharSummary.jsx';
import storage from '../../../services/storage.js';
import CharFeats from '../char-feats/CharFeats.jsx';

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

  it('should render short rest button on localhost', () => {
    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByTitle(/Short Rest/)).toBeInTheDocument();
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

  it('should open short rest modal on button click', () => {
    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    const shortRestBtn = screen.getByTitle(/Short Rest/);
    fireEvent.click(shortRestBtn);

    expect(screen.getByText(/Hit Dice/)).toBeInTheDocument();
    expect(screen.getByText(/Resources Restored/)).toBeInTheDocument();
  });

  it('should close short rest modal on cancel', () => {
    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    const shortRestBtn = screen.getByTitle(/Short Rest/);
    fireEvent.click(shortRestBtn);

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    expect(screen.queryByText(/Hit Dice/)).not.toBeInTheDocument();
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

  it('should render resistances', () => {
    const statsWithResistances = {
      ...mockPlayerStats,
      resistances: ['Fire', 'Cold'],
    };

    render(<CharSummary playerStats={statsWithResistances} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByText(/Resistances/)).toBeInTheDocument();
    expect(screen.getByText(/Fire/)).toBeInTheDocument();
    expect(screen.getByText(/Cold/)).toBeInTheDocument();
  });

  it('should render immunities', () => {
    const statsWithImmunities = {
      ...mockPlayerStats,
      immunities: ['Poison', 'Disease'],
    };

    render(<CharSummary playerStats={statsWithImmunities} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByText(/Immunities/)).toBeInTheDocument();
    const immunityDiv = screen.getByText(/Immunities:/).closest('div');
    expect(immunityDiv).toHaveTextContent('Poison');
    expect(immunityDiv).toHaveTextContent('Disease');
  });

  it('should render vulnerabilities', () => {
    const statsWithVulnerabilities = {
      ...mockPlayerStats,
      vulnerabilities: ['Radiant'],
    };

    render(<CharSummary playerStats={statsWithVulnerabilities} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByText(/Vulnerabilities/)).toBeInTheDocument();
    expect(screen.getByText(/Radiant/)).toBeInTheDocument();
  });

  it('should render senses', () => {
    const statsWithSenses = {
      ...mockPlayerStats,
      senses: [{ name: 'Darkvision', value: '60 ft' }],
    };

    render(<CharSummary playerStats={statsWithSenses} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByText(/Senses/)).toBeInTheDocument();
    expect(screen.getByText(/Darkvision 60 ft/)).toBeInTheDocument();
  });

  it('should render proficiencies', () => {
    const statsWithProficiencies = {
      ...mockPlayerStats,
      proficiencies: ['Light Armor', 'Simple Weapons'],
    };

    render(<CharSummary playerStats={statsWithProficiencies} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByText(/Proficiencies/)).toBeInTheDocument();
    expect(screen.getByText(/Light Armor, Simple Weapons/)).toBeInTheDocument();
  });

  it('should render languages', () => {
    const statsWithLanguages = {
      ...mockPlayerStats,
      languages: ['Common', 'Elvish'],
    };

    render(<CharSummary playerStats={statsWithLanguages} onDeleteCharacter={vi.fn()} />);

    expect(screen.getByText(/Languages/)).toBeInTheDocument();
    expect(screen.getByText(/Common, Elvish/)).toBeInTheDocument();
  });

  it('should show feat benefits HTML in popup', () => {
    const originalImpl = vi.mocked(CharFeats).getMockImplementation();
    vi.mocked(CharFeats).mockImplementation(({ showPopup }) => (
      <div data-testid="char-feats">
        <button onClick={() => showPopup({
          name: 'Feat with Benefits',
          desc: ['A test feat'],
          benefits: [{ description: 'Benefit the First' }, { description: 'Benefit the Second' }],
        })}>Trigger Popup</button>
      </div>
    ));

    render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

    fireEvent.click(screen.getByText('Trigger Popup'));

    expect(setPopupHtmlMock).toHaveBeenCalledWith(
      expect.stringContaining('<b>Benefits:</b><ul>')
    );
    expect(setPopupHtmlMock).toHaveBeenCalledWith(
      expect.stringContaining('<li>Benefit the First</li>')
    );
    expect(setPopupHtmlMock).toHaveBeenCalledWith(
      expect.stringContaining('<li>Benefit the Second</li>')
    );

    vi.mocked(CharFeats).mockImplementation(originalImpl);
  });

  describe('XP Tracking', () => {
    it('should show milestone suffix by default', () => {
      render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

      expect(screen.getByText(/Level 5/)).toBeInTheDocument();
      expect(screen.getByText(/\(milestone\)/)).toBeInTheDocument();
    });

    it('should show XP when xpMode is experience', () => {
      const xpStats = {
        ...mockPlayerStats,
        xp: 750,
        xpMode: 'experience',
      };

      render(<CharSummary playerStats={xpStats} onDeleteCharacter={vi.fn()} />);

      expect(screen.getByText(/Level 5/)).toBeInTheDocument();
      expect(screen.getByText(/750 XP/)).toBeInTheDocument();
      expect(screen.queryByText(/\(milestone\)/)).not.toBeInTheDocument();
    });

    it('should show 0 XP when in experience mode with no XP', () => {
      const xpStats = {
        ...mockPlayerStats,
        xp: 0,
        xpMode: 'experience',
        campaignName: 'test',
      };

      render(<CharSummary playerStats={xpStats} onDeleteCharacter={vi.fn()} />);

      expect(screen.getByText(/0 XP/)).toBeInTheDocument();
    });

    it('should show large XP values with locale formatting', () => {
      const xpStats = {
        ...mockPlayerStats,
        xp: 64000,
        xpMode: 'experience',
      };

      render(<CharSummary playerStats={xpStats} onDeleteCharacter={vi.fn()} />);

      expect(screen.getByText(/64,000 XP/)).toBeInTheDocument();
    });

    it('should open XP modal when level suffix is clicked in milestone mode', () => {
      render(<CharSummary playerStats={mockPlayerStats} onDeleteCharacter={vi.fn()} />);

      const suffixSpan = screen.getByText(/\(milestone\)/);
      fireEvent.click(suffixSpan);

      expect(screen.getByText(/Experience Points/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/\+100 or -50/)).toBeInTheDocument();
    });

    it('should open XP modal when level suffix is clicked in experience mode', () => {
      const xpStats = {
        ...mockPlayerStats,
        xp: 750,
        xpMode: 'experience',
      };

      render(<CharSummary playerStats={xpStats} onDeleteCharacter={vi.fn()} />);

      const suffixSpan = screen.getByText(/750 XP/);
      fireEvent.click(suffixSpan);

      expect(screen.getByText(/Experience Points/)).toBeInTheDocument();
    });

    it('should apply XP delta and call storage.setProperty on save', () => {
      const xpStats = {
        ...mockPlayerStats,
        xp: 750,
        xpMode: 'experience',
      };

      render(<CharSummary playerStats={xpStats} onDeleteCharacter={vi.fn()} />);

      const suffixSpan = screen.getByText(/750 XP/);
      fireEvent.click(suffixSpan);

      const input = screen.getByPlaceholderText(/\+100 or -50/);
      fireEvent.change(input, { target: { value: '100' } });

      const applyBtn = screen.getByText('Apply');
      fireEvent.click(applyBtn);

      expect(storage.setProperty).toHaveBeenCalledWith('Test Character', 'xp', 850, undefined);
    });

    it('should handle negative XP delta on save', () => {
      const xpStats = {
        ...mockPlayerStats,
        xp: 750,
        xpMode: 'experience',
      };

      render(<CharSummary playerStats={xpStats} onDeleteCharacter={vi.fn()} />);

      const suffixSpan = screen.getByText(/750 XP/);
      fireEvent.click(suffixSpan);

      const input = screen.getByPlaceholderText(/\+100 or -50/);
      fireEvent.change(input, { target: { value: '-50' } });

      const applyBtn = screen.getByText('Apply');
      fireEvent.click(applyBtn);

      expect(storage.setProperty).toHaveBeenCalledWith('Test Character', 'xp', 700, undefined);
    });

    it('should toggle milestone mode when checkbox is clicked in modal', () => {
      const xpStats = {
        ...mockPlayerStats,
        xp: 750,
        xpMode: 'experience',
      };

      render(<CharSummary playerStats={xpStats} onDeleteCharacter={vi.fn()} />);

      const suffixSpan = screen.getByText(/750 XP/);
      fireEvent.click(suffixSpan);

      const checkbox = screen.getByRole('checkbox', { name: /Milestone Leveling/ });
      expect(checkbox).not.toBeChecked();

      fireEvent.click(checkbox);

      expect(storage.setProperty).toHaveBeenCalledWith('Test Character', 'xpMode', 'milestone', undefined);
    });

    it('should uncheck milestone checkbox when in experience mode', () => {
      const xpStats = {
        ...mockPlayerStats,
        xp: 0,
        xpMode: 'experience',
      };

      render(<CharSummary playerStats={xpStats} onDeleteCharacter={vi.fn()} />);

      const suffixSpan = screen.getByText(/0 XP/);
      fireEvent.click(suffixSpan);

      const checkbox = screen.getByRole('checkbox', { name: /Milestone Leveling/ });
      expect(checkbox).not.toBeChecked();
    });
  });
});
