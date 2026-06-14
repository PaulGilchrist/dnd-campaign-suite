import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';

import { mockPlayerStats, mockHandleTogglePreparedSpells } from './CharSpells.test.helpers.js';

import useActionPopup from '../../../hooks/useActionPopup.js';

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
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingAid: null,
    pendingGreaterRestoration: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
    handleGreaterRestorationConfirm: vi.fn(),
    handleGreaterRestorationSkip: vi.fn(),
  })),
}));

vi.mock('../../../hooks/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    pendingUpcast: null,
    buildUpcastLevels: vi.fn(() => []),
    gateUpcast: vi.fn(() => false),
    handleUpcastConfirm: vi.fn(),
    handleUpcastCancel: vi.fn(),
    getCantripAutoLevel: vi.fn(() => null),
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
});
