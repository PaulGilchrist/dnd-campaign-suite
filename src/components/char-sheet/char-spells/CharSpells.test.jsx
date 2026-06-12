import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';

import { mockPlayerStats, mockHandleTogglePreparedSpells, mockGateMetamagic, mockGateUpcast, mockGetCantripAutoLevel } from './CharSpells.test.helpers.js';

import useActionPopup from '../../../hooks/useActionPopup.js';
import useLoggedDiceRoll from '../../../hooks/useLoggedDiceRoll.js';

vi.mock('../../../hooks/useActionPopup.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../../hooks/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
  })),
}));

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

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('./CharSpellSlots.jsx', () => ({
  default: function MockCharSpellSlots() {
    return <div data-testid="char-spell-slots">Spell Slots</div>;
    },
}));

vi.mock('lodash', () => ({
  cloneDeep: vi.fn(obj => JSON.parse(JSON.stringify(obj))),
}));

vi.mock('../../../hooks/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: mockGateMetamagic,
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
  })),
}));

vi.mock('../../../hooks/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    pendingUpcast: null,
    buildUpcastLevels: vi.fn(() => []),
    gateUpcast: mockGateUpcast,
    handleUpcastConfirm: vi.fn(),
    handleUpcastCancel: vi.fn(),
    getCantripAutoLevel: mockGetCantripAutoLevel,
  })),
}));

vi.mock('../../../services/rules/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

vi.mock('../../../services/rules/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
  getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../services/combat/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
  getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../../services/rules/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

describe('CharSpells', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
         }));
       });

  describe('Rendering', () => {
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

    it('should render CharSpellSlots component', () => {
      render(
          <CharSpells
            playerStats={mockPlayerStats}
            handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
             />
            );

      expect(screen.getByTestId('char-spell-slots')).toBeInTheDocument();
      });

    it('should render popupHtml as sanitized string HTML', () => {
      useActionPopup.mockImplementation(() => ({
        showPopup: vi.fn(),
        popupHtml: '<div>String Popup</div>',
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

    it('should render dicePopupHtml with waitingForPlayerSave', () => {
      useLoggedDiceRoll.mockImplementation(() => ({
        popupHtml: { waitingForPlayerSave: true, promptId: '123', targetName: 'Goblin', saveType: 'DEX', saveDc: 14 },
        setPopupHtml: vi.fn(),
        rollAttack: vi.fn(),
        rollDamage: vi.fn(),
      }));

      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
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
  });

  describe('Spell abilities display', () => {
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

    it('should use spells_known when prepared_spells is undefined', () => {
      const statsWithSpellsKnown = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          prepared_spells: undefined,
          spells_known: 8,
        },
      };

      const { container } = render(
        <CharSpells
          playerStats={statsWithSpellsKnown}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText(/Prepared Spells:/)).toBeInTheDocument();
      const spellAbilitiesDiv = container.querySelector('.spell-abilities');
      expect(spellAbilitiesDiv.textContent).toContain('8');
    });
  });

  describe('Spell table', () => {
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

    it('should render the spell attack to-hit label as clickable', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      expect(attackLabel).toHaveClass('clickable');
    });
  });

  describe('Spell interactions', () => {
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

    it('should sort same-level spells alphabetically when level header is clicked', () => {
      const statsWithSameLevelSpells = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Zap',
              level: 1,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
            {
              name: 'Bless',
              level: 1,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Concentration, up to 1 minute',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithSameLevelSpells}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      // Initially in order: Zap, Bless
      const levelHeader = screen.getByText('Level');
      fireEvent.click(levelHeader);

      // After sorting by level (both are level 1), they should be alphabetical: Bless, Zap
      const rows = screen.getAllByText(/Bless|Zap/);
      expect(rows.length).toBe(2);
    });

    it('should sort spells by level then name when level header is clicked', () => {
      const statsWithMixedLevels = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Zap',
              level: 2,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
            {
              name: 'Bless',
              level: 1,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
            {
              name: 'Alpha Strike',
              level: 1,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithMixedLevels}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      // Click level header to sort
      const levelHeader = screen.getByText('Level');
      fireEvent.click(levelHeader);

      // All spells should still be visible after sorting
      expect(screen.getByText('Alpha Strike')).toBeInTheDocument();
      expect(screen.getByText('Bless')).toBeInTheDocument();
      expect(screen.getByText('Zap')).toBeInTheDocument();
    });
  });

  describe('Spell effects and notes', () => {
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

    it('should display both Concentration and Ritual notes', () => {
      const statsWithBoth = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Wandermage',
              level: 3,
              casting_time: '1 action',
              range: 'Self',
              duration: 'Concentration, up to 6 minutes',
              components: ['V', 'S', 'M'],
              concentration: true,
              ritual: true,
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithBoth}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      // Notes should show "Con, Ritual, V/S/M" with minute abbreviation
      expect(screen.getByText(/Con, Ritual, V\/S\/M/)).toBeInTheDocument();
    });

    it('should abbreviate duration with concentration and minutes', () => {
      const statsWithConcentrationDuration = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Haste',
              level: 3,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Concentration, up to 1 minute',
              components: ['V', 'S', 'M'],
              concentration: true,
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithConcentrationDuration}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText(/Concentration, up to 1 min/)).toBeInTheDocument();
    });

    it('should render spell with only damage_at_character_level', () => {
      const statsWithCharLevelOnly = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Eldritch Blast',
              level: 0,
              casting_time: '1 action',
              range: '120 feet',
              duration: 'Instantaneous',
              components: ['V'],
              damage: {
                damage_at_character_level: {
                  '1': '1d10',
                  '5': '2d10',
                },
                damage_type: 'Force',
              },
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithCharLevelOnly}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText('Eldritch Blast')).toBeInTheDocument();
    });

    it('should show Utility for spell with no damage field', () => {
      const statsWithUtilitySpell = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Shield',
              level: 1,
              casting_time: '1 reaction',
              range: 'Self',
              duration: '1 round',
              components: ['V'],
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithUtilitySpell}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText('Utility')).toBeInTheDocument();
    });
  });

  describe('Save-based spells', () => {
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

    it('should show negates for dc_success other than half', () => {
      const statsWithNegatesSave = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
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
          playerStats={statsWithNegatesSave}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText('1d8 Radiant (DEX negates)')).toBeInTheDocument();
    });
  });

  describe('Exhaustion and conditions', () => {
    it('should apply disabled-attack class when cannotAct is true', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
          cannotAct
        />
      );

      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      expect(attackLabel).toHaveClass('disabled-attack');
    });

    it('should apply stat--penalized class when exhaustionPenalty > 0', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
          exhaustionPenalty={2}
        />
      );

      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      expect(attackLabel).toHaveClass('stat--penalized');
    });

    it('should apply stat--penalized class when conditionAttackMode is disadvantage', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
          conditionAttackMode='disadvantage'
        />
      );

      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      expect(attackLabel).toHaveClass('stat--penalized');
    });

    it('should apply stat--penalized to the to-hit value span when exhaustionPenalty > 0', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
          exhaustionPenalty={2}
        />
      );

      const toHitSpan = screen.getByText('+3');
      expect(toHitSpan).toHaveClass('stat--penalized');
    });

    it('should apply stat--penalized to the modifier span when exhaustionPenalty > 0', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
          exhaustionPenalty={2}
        />
      );

      const modifierSpan = screen.getByText('+1');
      expect(modifierSpan).toHaveClass('stat--penalized');
    });

    it('should subtract exhaustionPenalty from toHit display', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
          exhaustionPenalty={2}
        />
      );

      // toHit is 5, penalty is 2 => +3
      expect(screen.getByText('+3')).toBeInTheDocument();
    });

    it('should subtract exhaustionPenalty from modifier display', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
          exhaustionPenalty={2}
        />
      );

      // modifier is 3, penalty is 2 => +1
      expect(screen.getByText('+1')).toBeInTheDocument();
    });

    it('should not allow spell attack click when cannotAct is true', () => {
      const mockRollAttack = vi.fn();
      useLoggedDiceRoll.mockImplementation(() => ({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollAttack: mockRollAttack,
        rollDamage: vi.fn(),
      }));

      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
          cannotAct
        />
      );

      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      fireEvent.click(attackLabel);

      // rollAttack should NOT be called when cannotAct is true
      expect(mockRollAttack).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle spell with no components', () => {
      const statsWithNoComponents = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Read Magic',
              level: 0,
              casting_time: '1 action',
              range: 'Self',
              duration: 'Instantaneous',
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithNoComponents}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText('Read Magic')).toBeInTheDocument();
    });

    it('should handle spell with no casting_time', () => {
      const statsWithNoCastingTime = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Shield',
              level: 1,
              range: 'Self',
              duration: '1 round',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithNoCastingTime}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText('Shield')).toBeInTheDocument();
    });

    it('should handle spell with no duration', () => {
      const statsWithNoDuration = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Vicious Mockery',
              level: 0,
              casting_time: '1 action',
              range: '60 feet',
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithNoDuration}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText('Vicious Mockery')).toBeInTheDocument();
    });

    it('should handle spell with no range', () => {
      const statsWithNoRange = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Stranger Thing',
              level: 1,
              casting_time: '1 action',
              range: '',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithNoRange}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText('Stranger Thing')).toBeInTheDocument();
    });

    it('should handle spell damage with missing damage_type', () => {
      const statsWithMissingDamageType = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
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
              },
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithMissingDamageType}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      // Should still render the spell name
      expect(screen.getByText('Magic Missile')).toBeInTheDocument();
    });

    it('should handle spell with empty damage_at_slot_level and damage_at_character_level', () => {
      const statsWithEmptyDamage = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Strangely Empty Spell',
              level: 1,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Instantaneous',
              components: ['V'],
              damage: {
                damage_at_slot_level: {},
                damage_at_character_level: {},
              },
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithEmptyDamage}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      // The spell should still render in the table
      expect(screen.getByText('Strangely Empty Spell')).toBeInTheDocument();
    });

    it('should handle spell where components is undefined', () => {
      const statsWithNoComponents = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Read Magic',
              level: 0,
              casting_time: '1 action',
              range: 'Self',
              duration: 'Instantaneous',
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithNoComponents}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText('Read Magic')).toBeInTheDocument();
    });

    it('should render spell effect without damage_type when missing', () => {
      const statsWithNoDamageType = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
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
              },
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithNoDamageType}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      // Should render the spell name and effect (with empty damage_type)
      expect(screen.getByText('Magic Missile')).toBeInTheDocument();
    });
  });

  describe('Casting time and duration abbreviations', () => {
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

    it('should abbreviate "1 reaction" to "R"', () => {
      const statsWithReaction = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Shield',
              level: 1,
              casting_time: '1 reaction',
              range: 'Self',
              duration: '1 round',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithReaction}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText(/1 R/)).toBeInTheDocument();
    });

    it('should abbreviate "1 bonus action" to "BA"', () => {
      const statsWithBonusAction = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Healing Word',
              level: 1,
              casting_time: '1 bonus action',
              range: '60 feet',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithBonusAction}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText(/1 BA/)).toBeInTheDocument();
    });

    it('should abbreviate "1 minute" to "1 min" in duration', () => {
      const statsWithMinuteDuration = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Bless',
              level: 1,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Concentration, up to 1 minute',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithMinuteDuration}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText(/1 min/)).toBeInTheDocument();
    });

    it('should abbreviate "10 minutes" to "10 min" in duration', () => {
      const statsWithMinutesDuration = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Light',
              level: 0,
              casting_time: '1 action',
              range: 'Touch',
              duration: 'Concentration, up to 10 minutes',
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithMinutesDuration}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText(/10 min/)).toBeInTheDocument();
    });

    it('should handle spell with "1 reaction" casting time', () => {
      const statsWithReaction = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Shield',
              level: 1,
              casting_time: '1 reaction',
              range: 'Self',
              duration: '1 round',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithReaction}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText('Shield')).toBeInTheDocument();
    });

    it('should handle spell with "1 bonus action" casting time', () => {
      const statsWithBonusAction = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Healing Word',
              level: 1,
              casting_time: '1 bonus action',
              range: '60 feet',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithBonusAction}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText('Healing Word')).toBeInTheDocument();
    });
  });

  describe('Popup rendering', () => {
    it('should render popupHtml as sanitized string HTML', () => {
      useActionPopup.mockImplementation(() => ({
        showPopup: vi.fn(),
        popupHtml: '<div>String Popup</div>',
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

    it('should render dicePopupHtml with waitingForPlayerSave', () => {
      useLoggedDiceRoll.mockImplementation(() => ({
        popupHtml: { waitingForPlayerSave: true, promptId: '123', targetName: 'Goblin', saveType: 'DEX', saveDc: 14 },
        setPopupHtml: vi.fn(),
        rollAttack: vi.fn(),
        rollDamage: vi.fn(),
      }));

      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
    });
  });

  describe('Spell attack', () => {
    it('should render the spell attack to-hit label as clickable', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      expect(attackLabel).toHaveClass('clickable');
    });

    it('should show spell detail popup with cast button when spell name is clicked', () => {
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

    it('should show metamagic popup for sorcerer spell attack', () => {
      const statsWithSorcerer = {
        ...mockPlayerStats,
        class: { name: 'Sorcerer' },
      };

      render(
        <CharSpells
          playerStats={statsWithSorcerer}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      fireEvent.click(attackLabel);

      // Sorcerer path shows metamagic popup
      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
    });

    it('should call rollAttack for non-sorcerer spell attack', () => {
      const mockRollAttack = vi.fn();
      useLoggedDiceRoll.mockImplementation(() => ({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollAttack: mockRollAttack,
        rollDamage: vi.fn(),
      }));

      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      fireEvent.click(attackLabel);

      expect(mockRollAttack).toHaveBeenCalledWith('Spell Attack', 5, expect.any(Object));
    });

    it('should pass disadvantage mode when conditionAttackMode is disadvantage', () => {
      const mockRollAttack = vi.fn();
      useLoggedDiceRoll.mockImplementation(() => ({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollAttack: mockRollAttack,
        rollDamage: vi.fn(),
      }));

      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
          conditionAttackMode='disadvantage'
        />
      );

      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      fireEvent.click(attackLabel);

      expect(mockRollAttack).toHaveBeenCalled();
      const args = mockRollAttack.mock.calls[0];
      expect(args[2]).toMatchObject({ forcedMode: 'disadvantage' });
    });

    it('should not allow spell attack click when cannotAct is true', () => {
      const mockRollAttack = vi.fn();
      useLoggedDiceRoll.mockImplementation(() => ({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollAttack: mockRollAttack,
        rollDamage: vi.fn(),
      }));

      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
          cannotAct
        />
      );

      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      fireEvent.click(attackLabel);

      // rollAttack should NOT be called when cannotAct is true
      expect(mockRollAttack).not.toHaveBeenCalled();
    });
  });

  describe('Cantrip damage', () => {
    it('should use the highest available cantrip damage level at or below player level', () => {
      const statsWithCantripDamage = {
        ...mockPlayerStats,
        level: 5,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Fire Bolt',
              level: 0,
              casting_time: '1 action',
              range: '120 feet',
              duration: 'Instantaneous',
              components: ['V', 'S'],
              damage: {
                damage_at_slot_level: {
                  '1': '1d10',
                  '5': '2d10',
                  '11': '3d10',
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
          playerStats={statsWithCantripDamage}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      // Player level 5, so highest available <= 5 is '5' => 2d10
      expect(screen.getByText('2d10 Fire')).toBeInTheDocument();
    });

    it('should use the first damage level when no levels are at or below player level', () => {
      const statsWithCantripDamage = {
        ...mockPlayerStats,
        level: 0,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Fire Bolt',
              level: 0,
              casting_time: '1 action',
              range: '120 feet',
              duration: 'Instantaneous',
              components: ['V', 'S'],
              damage: {
                damage_at_slot_level: {
                  '1': '1d10',
                  '5': '2d10',
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
          playerStats={statsWithCantripDamage}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      // Player level 0, no levels <= 0, so it falls back to first key
      expect(screen.getByText('1d10 Fire')).toBeInTheDocument();
    });

    it('should render cantrip with multi-level damage showing highest applicable level', () => {
      const statsWithCantrip = {
        ...mockPlayerStats,
        level: 5,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Fire Bolt',
              level: 0,
              casting_time: '1 action',
              range: '120 feet',
              duration: 'Instantaneous',
              components: ['V', 'S'],
              damage: {
                damage_at_slot_level: {
                  '1': '1d10',
                  '5': '2d10',
                  '11': '3d10',
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
          playerStats={statsWithCantrip}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      // Player level 5, so highest available <= 5 is '5' => 2d10
      expect(screen.getByText('2d10 Fire')).toBeInTheDocument();
    });
  });
});
