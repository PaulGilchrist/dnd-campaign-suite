// @improved-by-ai
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';

import { mockPlayerStats, mockHandleTogglePreparedSpells } from './CharSpells.test.helpers.js';

import useActionPopup from '../../../hooks/combat/useActionPopup.js';
import useLoggedDiceRoll from '../../../hooks/combat/useLoggedDiceRoll.js';

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  })),
}));

vi.mock('../../../hooks/combat/useMetamagic.js', () => {
  const mockFn = () => ({
    currentSP: 10,
    maxSP: 10,
    spendSorceryPoints: vi.fn(),
    logMetamagic: vi.fn(),
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

const baseProps = {
  playerStats: mockPlayerStats,
  handleTogglePreparedSpells: mockHandleTogglePreparedSpells,
  campaignName: 'test-campaign',
};

function renderCharSpells(props = {}) {
  return render(<CharSpells {...baseProps} {...props} />);
}

describe('CharSpells', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
    }));
  });

  describe('Spell attack to-hit', () => {
    it('should render the spell attack to-hit label', () => {
      renderCharSpells();
      expect(screen.getByText(/Attack \(to hit\):/)).toBeInTheDocument();
    });

    it('should not call rollAttack when cannotAct is true', () => {
      const mockRollAttack = vi.fn();
      useLoggedDiceRoll.mockImplementation(() => ({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollAttack: mockRollAttack,
        rollDamage: vi.fn(),
        quickRollPlayerSave: vi.fn(),
      }));

      renderCharSpells({ cannotAct: true });

      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      fireEvent.click(attackLabel);

      expect(mockRollAttack).not.toHaveBeenCalled();
    });

    it('should call rollAttack with correct arguments for a non-sorcerer', () => {
      const mockRollAttack = vi.fn();
      useLoggedDiceRoll.mockImplementation(() => ({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollAttack: mockRollAttack,
        rollDamage: vi.fn(),
        quickRollPlayerSave: vi.fn(),
      }));

      renderCharSpells();

      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      fireEvent.click(attackLabel);

      expect(mockRollAttack).toHaveBeenCalledWith('Spell Attack', 5, expect.any(Object));
    });

    it('should subtract exhaustion penalty from rollAttack to-hit value', () => {
      const mockRollAttack = vi.fn();
      useLoggedDiceRoll.mockImplementation(() => ({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollAttack: mockRollAttack,
        rollDamage: vi.fn(),
        quickRollPlayerSave: vi.fn(),
      }));

      renderCharSpells({ exhaustionPenalty: 2 });

      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      fireEvent.click(attackLabel);

      expect(mockRollAttack).toHaveBeenCalledWith('Spell Attack', 3, expect.any(Object));
    });

    it.each`
      mode             | expectedMode
      ${'disadvantage'} | ${'disadvantage'}
      ${'advantage'}    | ${'advantage'}
    `('should pass forcedMode when conditionAttackMode is $mode', ({ mode, expectedMode }) => {
      const mockRollAttack = vi.fn();
      useLoggedDiceRoll.mockImplementation(() => ({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollAttack: mockRollAttack,
        rollDamage: vi.fn(),
        quickRollPlayerSave: vi.fn(),
      }));

      renderCharSpells({ conditionAttackMode: mode });

      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      fireEvent.click(attackLabel);

      expect(mockRollAttack).toHaveBeenCalledWith('Spell Attack', expect.any(Number), expect.objectContaining({ forcedMode: expectedMode }));
    });
  });

  describe('Spell attack with sorcerer metamagic', () => {
    it('should show metamagic popup when sorcerer clicks spell attack', () => {
      const statsWithSorcerer = {
        ...mockPlayerStats,
        class: { name: 'Sorcerer' },
      };

      renderCharSpells({ playerStats: statsWithSorcerer });

      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      fireEvent.click(attackLabel);

      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
    });

    it('should not show metamagic popup for non-sorcerer clicking spell attack', () => {
      const mockRollAttack = vi.fn();
      useLoggedDiceRoll.mockImplementation(() => ({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollAttack: mockRollAttack,
        rollDamage: vi.fn(),
        quickRollPlayerSave: vi.fn(),
      }));

      renderCharSpells();

      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      fireEvent.click(attackLabel);

      expect(screen.queryByTestId('metamagic-popup')).not.toBeInTheDocument();
      expect(mockRollAttack).toHaveBeenCalled();
    });

    it('should dismiss metamagic popup when sorcerer confirms spell attack metamagic', async () => {
      const statsWithSorcerer = {
        ...mockPlayerStats,
        class: { name: 'Sorcerer' },
      };

      renderCharSpells({ playerStats: statsWithSorcerer });

      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      await act(async () => {
        fireEvent.click(attackLabel);
      });

      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();

      await act(async () => {
        const confirmButton = screen.getByTestId('mock-confirm');
        fireEvent.click(confirmButton);
      });

      expect(screen.queryByTestId('metamagic-popup')).not.toBeInTheDocument();
    });
  });

  describe('Spell detail popup', () => {
    it('should show spell detail popup when spell name is clicked', () => {
      renderCharSpells();

      const lightLink = screen.getByText('Light');
      fireEvent.click(lightLink);

      expect(screen.getByText('Cast Spell')).toBeInTheDocument();
    });

    it('should close spell detail popup when close button is clicked', () => {
      renderCharSpells();

      const lightLink = screen.getByText('Light');
      fireEvent.click(lightLink);

      expect(screen.getByText('Cast Spell')).toBeInTheDocument();

      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);

      expect(screen.queryByText('Cast Spell')).not.toBeInTheDocument();
    });
  });

  describe('Cantrip damage display', () => {
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
              casting_time: '1 turn',
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

      renderCharSpells({ playerStats: statsWithCantripDamage });

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
              casting_time: '1 turn',
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

      renderCharSpells({ playerStats: statsWithCantripDamage });

      expect(screen.getByText('1d10 Fire')).toBeInTheDocument();
    });

    it('should use the first damage level for non-cantrips regardless of player level', () => {
      const statsWithLevelSpell = {
        ...mockPlayerStats,
        level: 11,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Scorching Ray',
              level: 2,
              casting_time: '1 turn',
              range: '120 feet',
              duration: 'Instantaneous',
              components: ['V', 'S'],
              damage: {
                damage_at_slot_level: {
                  '2': '3d6',
                  '5': '4d6',
                },
                damage_type: 'Fire',
              },
              prepared: 'Always',
            },
          ],
        },
      };

      renderCharSpells({ playerStats: statsWithLevelSpell });

      expect(screen.getByText('3d6 Fire')).toBeInTheDocument();
    });

    it('should use damage_at_character_level when damage_at_slot_level is absent', () => {
      const statsWithCharacterLevelDamage = {
        ...mockPlayerStats,
        level: 11,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Custom Spell',
              level: 1,
              casting_time: '1 turn',
              range: '60 feet',
              duration: 'Instantaneous',
              components: ['V'],
              damage: {
                damage_at_character_level: {
                  '1': '2d6',
                  '5': '3d6',
                },
                damage_type: 'Acid',
              },
              prepared: 'Always',
            },
          ],
        },
      };

      renderCharSpells({ playerStats: statsWithCharacterLevelDamage });

      expect(screen.getByText('2d6 Acid')).toBeInTheDocument();
    });

    it('should display damage with save DC info for spells with a save DC', () => {
      const statsWithSaveDc = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Cone of Cold',
              level: 2,
              casting_time: '1 turn',
              range: '60 feet',
              duration: 'Instantaneous',
              components: ['V', 'S', 'M'],
              damage: {
                damage_at_slot_level: {
                  '2': '3d8',
                },
                damage_type: 'Cold',
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

      renderCharSpells({ playerStats: statsWithSaveDc });

      expect(screen.getByText('3d8 Cold (DEX half)')).toBeInTheDocument();
    });

    it('should display negates for spell save DC with negates success', () => {
      const statsWithNegates = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Frostbite',
              level: 0,
              casting_time: '1 turn',
              range: '60 feet',
              duration: 'Instantaneous',
              components: ['V', 'S'],
              damage: {
                damage_at_slot_level: {
                  '1': '1d6',
                },
                damage_type: 'Cold',
              },
              dc: {
                dc_type: 'CON',
                dc_success: 'negates',
              },
              prepared: 'Always',
            },
          ],
        },
      };

      renderCharSpells({ playerStats: statsWithNegates });

      expect(screen.getByText('1d6 Cold (CON negates)')).toBeInTheDocument();
    });
  });

  describe('Spell attack with null/undefined values', () => {
    it('should render spell attack when toHit is zero', () => {
      const statsWithZeroToHit = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          toHit: 0,
        },
      };

      renderCharSpells({ playerStats: statsWithZeroToHit });

      expect(screen.getByText('+0')).toBeInTheDocument();
    });
  });
});
