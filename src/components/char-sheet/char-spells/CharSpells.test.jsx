import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';

// Mock the usePopup hook
vi.mock('../../../hooks/useActionPopup.js', () => ({
  default: vi.fn(),
}));

// Mock the useLoggedDiceRoll hook
vi.mock('../../../hooks/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
  })),
}));

// Mock useMetamagic hook
vi.mock('../../../hooks/useMetamagic.js', () => {
  const mockFn = () => ({
    currentSP: 10,
    maxSP: 10,
    spendSorceryPoints: vi.fn(),
    logMetamagic: vi.fn(),
    saveLastDamageEvent: vi.fn(),
    getLastDamageEvent: vi.fn(() => null),
    clearLastDamageEvent: vi.fn(),
  });
  mockFn.getCurrentSorceryPoints = vi.fn(() => 10);
  mockFn.getMaxSorceryPoints = vi.fn(() => 10);
  return { default: mockFn, getCurrentSorceryPoints: mockFn.getCurrentSorceryPoints, getMaxSorceryPoints: mockFn.getMaxSorceryPoints };
});

// Mock MetamagicPopup component
vi.mock('../MetamagicPopup.jsx', () => ({
  default: function MockMetamagicPopup({ onConfirm, onSkip }) {
    return (
      <div data-testid="metamagic-popup">
        <button data-testid="mock-confirm" onClick={() => onConfirm({ options: [], totalCost: 0, twinTarget: null })}>
          Mock Confirm
        </button>
        <button data-testid="mock-skip" onClick={onSkip}>
          Mock Skip
        </button>
      </div>
    );
  },
}));

// Mock sanitizeHtml
vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

// Mock the CharSpellSlots component
vi.mock('./CharSpellSlots.jsx', () => ({
  default: function MockCharSpellSlots() {
    return <div data-testid="char-spell-slots">Spell Slots</div>;
    },
}));

// Mock lodash cloneDeep
vi.mock('lodash', () => ({
  cloneDeep: vi.fn(obj => JSON.parse(JSON.stringify(obj))),
}));

import useActionPopup from '../../../hooks/useActionPopup.js';
import useLoggedDiceRoll from '../../../hooks/useLoggedDiceRoll.js';

const mockPlayerStats = {
  name: 'Test Character',
  rules: '5e (default)',
  spellAbilities: {
    toHit: 5,
    modifier: 3,
    saveDc: 13,
    cantrips_known: 3,
    prepared_spells: 5,
    maxPreparedSpells: 5,
    spell_slots_level_1: 4,
    spell_slots_level_2: 3,
    spells: [
      {
        name: 'Fireball',
        level: 3,
        casting_time: '1 action',
        range: '150 feet',
        duration: 'Instantaneous',
        components: ['V', 'S', 'M'],
        damage: {
          damage_at_slot_level: {
               '3': '8d6',
               },
          damage_type: 'Fire',
          },
        prepared: 'Prepared',
          },
        {
        name: 'Magic Missile',
        level: 1,
        casting_time: '1 action',
        range: '120 feet',
        duration: 'Instantaneous',
        components: ['V', 'S'],
        damage: {
          damage_at_slot_level: {
               '1': '1d4+1',
               },
          damage_type: 'Force',
          },
        prepared: 'Always',
          },
        {
        name: 'Light',
        level: 0,
        casting_time: '1 action',
        range: 'Touch',
        duration: '10 minutes',
        components: ['V', 'M'],
        prepared: 'Always',
      },
         ],
       },
};

const mockHandleTogglePreparedSpells = vi.fn();

describe('CharSpells', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
         }));
        });

  it('should not render anything when spellAbilities is not present', () => {
    const statsWithoutSpells = { name: 'Test Character' };

    const { container } = render(
        <CharSpells
          playerStats={statsWithoutSpells}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    expect(container.querySelector('.spell-popup-parent')).not.toBeInTheDocument();
    });

  it('should not render anything when spells array is empty', () => {
    const statsWithEmptySpells = {
      name: 'Test Character',
      spellAbilities: {
        spells: [],
          },
        };

    const { container } = render(
        <CharSpells
          playerStats={statsWithEmptySpells}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    expect(container.querySelector('.spell-popup-parent')).not.toBeInTheDocument();
    });

  it('should render spell abilities section', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    const spellsElements = screen.getAllByText(/Spells/);
    expect(spellsElements.length).toBeGreaterThan(0);
        });

  it('should display attack to hit value', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    expect(screen.getByText(/Attack \(to hit\):/)).toBeInTheDocument();
       });

  it('should display modifier value', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    expect(screen.getByText(/Modifier:/)).toBeInTheDocument();
       });

  it('should display save DC value', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    expect(screen.getByText(/Save DC:/)).toBeInTheDocument();
       });

  it('should display cantrips known count', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    expect(screen.getByText(/Cantrips Known:/)).toBeInTheDocument();
    });

  it('should display prepared spells count', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    expect(screen.getByText(/Prepared Spells:/)).toBeInTheDocument();
    });

  it('should display max prepared spells', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    expect(screen.getByText(/Max Prepared:/)).toBeInTheDocument();
    });

  it('should render CharSpellSlots component', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    expect(screen.getByTestId('char-spell-slots')).toBeInTheDocument();
    });

  it('should render spell table headers', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    expect(screen.getByText('Spell')).toBeInTheDocument();
    expect(screen.getByText('Level')).toBeInTheDocument();
    expect(screen.getByText('Prepared')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Range')).toBeInTheDocument();
    expect(screen.getByText('Effect')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    });

  it('should render spell names in the table', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    expect(screen.getByText('Fireball')).toBeInTheDocument();
    expect(screen.getByText('Magic Missile')).toBeInTheDocument();
    expect(screen.getByText('Light')).toBeInTheDocument();
    });

  it('should display Cantrip for level 0 spells', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    expect(screen.getByText('Cantrip')).toBeInTheDocument();
    });

  it('should display spell level for non-cantrip spells', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

     // Level 3 for Fireball
    const levelCells = screen.getAllByText('3');
    expect(levelCells.length).toBeGreaterThan(0);
    });

  it('should show Always prepared for spells with prepared=Always', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    const alwaysElements = screen.getAllByText('Always');
    expect(alwaysElements.length).toBeGreaterThan(0);
       });

  it('should show checkbox for Prepared spells', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    });

  it('should call handleTogglePreparedSpells when checkbox is clicked', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    const checkbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(checkbox);

    expect(mockHandleTogglePreparedSpells).toHaveBeenCalled();
    });

it('should show spell detail popup when spell name is clicked', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    const fireballLink = screen.getByText('Fireball');
    fireEvent.click(fireballLink);

    // Spell detail popup should show with Cast button
    expect(screen.getByText('Cast Spell')).toBeInTheDocument();
  });

  it('should filter spells when toggle prepared filter is clicked', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

     // Click the Prepared header to filter
    const preparedHeader = screen.getByText('Prepared');
    fireEvent.click(preparedHeader);

        // After filtering, only prepared spells should be shown
        // Fireball is 'Prepared', Magic Missile and Light are 'Always'
        // So Fireball should still be visible
    expect(screen.getByText('Fireball')).toBeInTheDocument();
    });

  it('should sort spells by level when level header is clicked', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

     // Click the Level header to sort
    const levelHeader = screen.getByText('Level');
    fireEvent.click(levelHeader);

     // Spells should still be visible after sorting
    expect(screen.getByText('Fireball')).toBeInTheDocument();
    });

  it('should sort spells by name when spell header is clicked', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

     // Click the Spell header to sort
    const spellHeader = screen.getByText('Spell');
    fireEvent.click(spellHeader);

     // Spells should still be visible after sorting
    expect(screen.getByText('Fireball')).toBeInTheDocument();
    });

  it('should display casting time with abbreviations', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
            );

         // '1 action' should be replaced with ' A' - check the table cell content
    const tableCells = screen.getAllByText(/A$/);
    expect(tableCells.length).toBeGreaterThan(0);
       });

  it('should display duration with abbreviations', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

       // 'Instantaneous' should be replaced with 'Instant'
    const instantElements = screen.getAllByText('Instant');
    expect(instantElements.length).toBeGreaterThan(0);
       });

  it('should display damage effect for spells with damage', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

     // Fireball has damage
    expect(screen.getByText('8d6 Fire')).toBeInTheDocument();
    });

  it('should display Utility for spells without damage', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

     // Light has no damage, should show Utility
    expect(screen.getByText('Utility')).toBeInTheDocument();
    });

  it('should display concentration note when spell has concentration', () => {
    const statsWithConcentration = {
      ...mockPlayerStats,
      spellAbilities: {
        ...mockPlayerStats.spellAbilities,
        spells: [
          {
            name: 'Calm Emotions',
            level: 1,
            casting_time: '1 action',
            range: '60 feet',
            duration: 'Concentration, up to 1 minute',
            components: ['V', 'S'],
            concentration: true,
            prepared: 'Prepared',
              },
             ],
           },
         };

    render(
        <CharSpells
          playerStats={statsWithConcentration}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

       // Notes show "Con, V/S" - check for Con in the notes
    expect(screen.getByText(/Con,/)).toBeInTheDocument();
       });

  it('should display ritual note when spell has ritual', () => {
    const statsWithRitual = {
      ...mockPlayerStats,
      spellAbilities: {
        ...mockPlayerStats.spellAbilities,
        spells: [
          {
            name: 'Detect Magic',
            level: 1,
            casting_time: '1 action',
            range: 'Self',
            duration: 'Concentration, up to 10 minutes',
            components: ['V', 'S'],
            ritual: true,
            prepared: 'Prepared',
              },
             ],
           },
         };

    render(
        <CharSpells
          playerStats={statsWithRitual}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

       // Notes show "Ritual, V/S" - check for Ritual in the notes
    expect(screen.getByText(/Ritual,/)).toBeInTheDocument();
       });

  it('should display components note', () => {
    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

      // Fireball has components ['V', 'S', 'M'] which should be joined as 'V/S/M'
    expect(screen.getByText('V/S/M')).toBeInTheDocument();
    });

  it('should render PopupElement in the container', () => {
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: { type: 'd20', name: 'Test', rolls: [1, 2], bonus: 3 },
      setPopupHtml: vi.fn(),
    }));

    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
    });

  it('should default cantrips_known to 0 when not provided', () => {
    const statsWithoutCantrips = {
      ...mockPlayerStats,
      spellAbilities: {
        ...mockPlayerStats.spellAbilities,
        cantrips_known: undefined,
          },
        };

    render(
        <CharSpells
          playerStats={statsWithoutCantrips}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    expect(screen.getByText(/Cantrips Known:/)).toBeInTheDocument();
    });

  it('should default prepared_spells to All when not provided', () => {
    const statsWithoutPrepared = {
      ...mockPlayerStats,
      spellAbilities: {
        ...mockPlayerStats.spellAbilities,
        prepared_spells: undefined,
        spells_known: undefined,
          },
         };

    const { container } = render(
         <CharSpells
          playerStats={statsWithoutPrepared}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

      // Check that "Prepared Spells:" label exists
    expect(screen.getByText(/Prepared Spells:/)).toBeInTheDocument();
      // Check that "All" is displayed in the spell-abilities section
    const spellAbilitiesDiv = container.querySelector('.spell-abilities');
    expect(spellAbilitiesDiv.textContent).toContain('All');
     });

  it('should default maxPreparedSpells to All when not provided', () => {
    const statsWithoutMaxPrepared = {
      ...mockPlayerStats,
      spellAbilities: {
        ...mockPlayerStats.spellAbilities,
        maxPreparedSpells: undefined,
          },
          };

    const { container } = render(
         <CharSpells
          playerStats={statsWithoutMaxPrepared}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

       // Check that "Max Prepared:" label exists
    expect(screen.getByText(/Max Prepared:/)).toBeInTheDocument();
       // Check that "All" is displayed in the spell-abilities section
    const spellAbilitiesDiv = container.querySelector('.spell-abilities');
    expect(spellAbilitiesDiv.textContent).toContain('All');
     });

  it('should render damage_at_character_level effect', () => {
    const statsWithCharLevelDamage = {
      ...mockPlayerStats,
      spellAbilities: {
        ...mockPlayerStats.spellAbilities,
        spells: [
          ...mockPlayerStats.spellAbilities.spells,
          {
            name: 'Fire Bolt',
            level: 0,
            casting_time: '1 action',
            range: '120 feet',
            duration: 'Instantaneous',
            components: ['V', 'S'],
            damage: {
              damage_at_character_level: {
                '1': '1d10',
              },
              damage_type: 'Fire',
            },
            prepared: 'Always',
          },
        ],
      },
    };

    render(
      <CharSpells
        playerStats={statsWithCharLevelDamage}
        handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
      />
    );

    // Spell with damage_at_character_level should show that damage
    expect(screen.getByText('1d10 Fire')).toBeInTheDocument();
  });

  it('should show save info in effect text for save-based spells', () => {
    const statsWithSaveSpell = {
      ...mockPlayerStats,
      spellAbilities: {
        ...mockPlayerStats.spellAbilities,
        spells: [
          ...mockPlayerStats.spellAbilities.spells,
          {
            name: 'Sacred Flame',
            level: 0,
            casting_time: '1 action',
            range: '60 feet',
            duration: 'Instantaneous',
            components: ['V', 'S'],
            damage: {
              damage_at_slot_level: {
                '1': '1d8',
              },
              damage_type: 'Radiant',
            },
            dc: {
              dc_type: 'DEX',
              dc_success: 'none',
            },
            prepared: 'Always',
          },
        ],
      },
    };

    render(
      <CharSpells
        playerStats={statsWithSaveSpell}
        handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
      />
    );

    expect(screen.getByText('1d8 Radiant (DEX negates)')).toBeInTheDocument();
  });

  it('should show half for save-based spells with dc_success half', () => {
    const statsWithSaveSpell = {
      ...mockPlayerStats,
      spellAbilities: {
        ...mockPlayerStats.spellAbilities,
        spells: [
          ...mockPlayerStats.spellAbilities.spells,
          {
            name: 'Fireball',
            level: 3,
            casting_time: '1 action',
            range: '150 feet',
            duration: 'Instantaneous',
            components: ['V', 'S', 'M'],
            damage: {
              damage_at_slot_level: {
                '3': '8d6',
              },
              damage_type: 'Fire',
            },
            dc: {
              dc_type: 'DEX',
              dc_success: 'half',
            },
            prepared: 'Prepared',
          },
        ],
      },
    };

    render(
      <CharSpells
        playerStats={statsWithSaveSpell}
        handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
      />
    );

    expect(screen.getByText('8d6 Fire (DEX half)')).toBeInTheDocument();
  });

  it('should call rollDamage with save context for save-based spells', async () => {
    const mockRollDamage = vi.fn();
    useLoggedDiceRoll.mockImplementation(() => ({
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAttack: vi.fn(),
      rollDamage: mockRollDamage,
    }));

    const statsWithSaveSpell = {
      ...mockPlayerStats,
      spellAbilities: {
        ...mockPlayerStats.spellAbilities,
        saveDc: 14,
        spells: [
          {
            name: 'Sacred Flame',
            level: 0,
            casting_time: '1 action',
            range: '60 feet',
            duration: 'Instantaneous',
            components: ['V', 'S'],
            damage: {
              damage_at_slot_level: {
                '1': '1d8',
              },
              damage_type: 'Radiant',
            },
            dc: {
              dc_type: 'DEX',
              dc_success: 'none',
            },
            prepared: 'Always',
          },
        ],
      },
    };

    render(
      <CharSpells
        playerStats={statsWithSaveSpell}
        handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
      />
    );

    const effectCell = screen.getByText('1d8 Radiant (DEX negates)');
    fireEvent.click(effectCell);

    await waitFor(() => {
      expect(mockRollDamage).toHaveBeenCalled();
    });
    const args = mockRollDamage.mock.calls[0];
    expect(args[0]).toBe('Sacred Flame');
    expect(args[5]).toMatchObject({
      dc: 14,
      dcType: 'DEX',
      dcSuccess: 'none',
      saveDc: 14,
      saveType: 'DEX',
      attackerName: 'Test Character',
    });
  });

  it('should exclude non-prepared spells when filter is active', () => {
    const statsWithNonPrepared = {
      ...mockPlayerStats,
      spellAbilities: {
        ...mockPlayerStats.spellAbilities,
        spells: [
          ...mockPlayerStats.spellAbilities.spells,
          {
            name: 'Vicious Mockery',
            level: 0,
            casting_time: '1 action',
            range: '60 feet',
            duration: 'Instantaneous',
            components: ['V'],
            prepared: '',  // Empty string - not 'Always' or 'Prepared'
          },
        ],
      },
    };

    render(
      <CharSpells
        playerStats={statsWithNonPrepared}
        handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
      />
    );

    // Vicious Mockery should be visible initially
    expect(screen.getByText('Vicious Mockery')).toBeInTheDocument();

    // Click the Prepared header to filter
    const preparedHeader = screen.getByText('Prepared');
    fireEvent.click(preparedHeader);

    // Vicious Mockery should be filtered out (prepared is empty string)
    expect(screen.queryByText('Vicious Mockery')).not.toBeInTheDocument();

    // Prepared/Always spells should still be visible
    expect(screen.getByText('Fireball')).toBeInTheDocument();
    expect(screen.getByText('Magic Missile')).toBeInTheDocument();
    expect(screen.getByText('Light')).toBeInTheDocument();
  });

  it('should toggle filter back to show all spells', () => {
    const statsWithNonPrepared = {
      ...mockPlayerStats,
      spellAbilities: {
        ...mockPlayerStats.spellAbilities,
        spells: [
          ...mockPlayerStats.spellAbilities.spells,
          {
            name: 'Vicious Mockery',
            level: 0,
            casting_time: '1 action',
            range: '60 feet',
            duration: 'Instantaneous',
            components: ['V'],
            prepared: '',
          },
        ],
      },
    };

    render(
      <CharSpells
        playerStats={statsWithNonPrepared}
        handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
      />
    );

    // First click filters, second click shows all
    const preparedHeader = screen.getByText('Prepared');
    fireEvent.click(preparedHeader);
    fireEvent.click(preparedHeader);

    // Vicious Mockery should be visible again after toggling filter off
    expect(screen.getByText('Vicious Mockery')).toBeInTheDocument();
  });
});

const mockPlayerStats2024 = {
  name: 'Test Character',
  rules: '2024',
  spellAbilities: {
    toHit: 5,
    modifier: 3,
    saveDc: 13,
    cantrips_known: 3,
    prepared_spells: 5,
    maxPreparedSpells: 5,
    spell_slots_level_1: 4,
    spell_slots_level_2: 3,
    spells: [
      {
        name: 'Fireball',
        level: 3,
        casting_time: '1 action',
        range: '150 feet',
        duration: 'Instantaneous',
        components: ['V', 'S', 'M'],
        damage: {
          damage_at_slot_level: {
               '3': '8d6',
               },
          damage_type: 'Fire',
          },
        prepared: 'Prepared',
          },
        {
        name: 'Magic Missile',
        level: 1,
        casting_time: '1 action',
        range: '120 feet',
        duration: 'Instantaneous',
        components: ['V', 'S'],
        damage: {
          damage_at_slot_level: {
               '1': '1d4+1',
               },
          damage_type: 'Force',
          },
        prepared: 'Always',
          },
        {
        name: 'Light',
        level: 0,
        casting_time: '1 action',
        range: 'Touch',
        duration: '10 minutes',
        components: ['V', 'M'],
        prepared: 'Always',
      },
       ],
     },
};

describe('CharSpells - 2024 ruleset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
    }));
  });

  it('should hide the Prepared column header for 2024 characters', () => {
    render(
        <CharSpells playerStats={mockPlayerStats2024} />
        );

    expect(screen.queryByText('Prepared')).not.toBeInTheDocument();
    });

  it('should hide Prepared Spells and Max Prepared labels for 2024 characters', () => {
    render(
        <CharSpells playerStats={mockPlayerStats2024} />
        );

    expect(screen.queryByText(/Prepared Spells:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Max Prepared:/)).not.toBeInTheDocument();
    });

  it('should not show checkboxes for 2024 characters', () => {
    render(
        <CharSpells playerStats={mockPlayerStats2024} />
        );

    const checkboxes = screen.queryAllByRole('checkbox');
    expect(checkboxes).toHaveLength(0);
    });

  it('should still render spell names for 2024 characters', () => {
    render(
        <CharSpells playerStats={mockPlayerStats2024} />
        );

    expect(screen.getByText('Fireball')).toBeInTheDocument();
    expect(screen.getByText('Magic Missile')).toBeInTheDocument();
    expect(screen.getByText('Light')).toBeInTheDocument();
    });

  it('should still render spell table headers except Prepared for 2024', () => {
    render(
        <CharSpells playerStats={mockPlayerStats2024} />
        );

    expect(screen.getByText('Spell')).toBeInTheDocument();
    expect(screen.getByText('Level')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Range')).toBeInTheDocument();
    expect(screen.getByText('Effect')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    });
});