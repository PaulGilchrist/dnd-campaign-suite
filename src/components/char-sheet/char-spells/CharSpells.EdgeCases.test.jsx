import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';

import { mockPlayerStats, mockHandleTogglePreparedSpells } from './CharSpells.test.helpers.js';

import useActionPopup from '../../../hooks/combat/useActionPopup.js';

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
  })),
}));

vi.mock('../../../hooks/combat/useMetamagic.js', () => {
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

vi.mock('../popups/MetamagicPopup.jsx', () => ({
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

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
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

vi.mock('../../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    pendingUpcast: null,
    buildUpcastLevels: vi.fn(() => []),
    gateUpcast: vi.fn(() => false),
    handleUpcastConfirm: vi.fn(),
    handleUpcastCancel: vi.fn(),
    getCantripAutoLevel: vi.fn(() => null),
  })),
}));

vi.mock('../../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
  getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
  getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../../services/rules/combat/rangeValidation.js', () => ({
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
});
