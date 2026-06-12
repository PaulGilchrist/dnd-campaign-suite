import { render, screen } from '@testing-library/react';
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
});
