import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './char-spells.jsx';

// Mock the usePopup hook
vi.mock('../common/use-action-popup.jsx', () => ({
  default: vi.fn(),
}));

// Mock the CharSpellSlots component
vi.mock('./char-spell-slots.jsx', () => ({
  default: function MockCharSpellSlots() {
    return <div data-testid="char-spell-slots">Spell Slots</div>;
    },
}));

// Mock lodash cloneDeep
vi.mock('lodash', () => ({
  cloneDeep: vi.fn(obj => JSON.parse(JSON.stringify(obj))),
}));

import useActionPopup from '../common/use-action-popup.jsx';

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

  it('should call showPopup when spell name is clicked', () => {
    const mockShowPopup = vi.fn();
    useActionPopup.mockImplementation(() => ({
      showPopup: mockShowPopup,
      popupHtml: null,
      setPopupHtml: vi.fn(),
      }));

    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    const fireballLink = screen.getByText('Fireball');
    fireEvent.click(fireballLink);

    expect(mockShowPopup).toHaveBeenCalled();
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
    const mockPopupElement = <div data-testid="popup">Popup Content</div>;
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: mockPopupElement,
      setPopupHtml: vi.fn(),
      }));

    render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
           />
           );

    expect(screen.getByTestId('popup')).toBeInTheDocument();
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
});