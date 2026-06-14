import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';

import { mockPlayerStats, mockHandleTogglePreparedSpells } from './CharSpells.test.helpers.js';

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
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingAid: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
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
});
