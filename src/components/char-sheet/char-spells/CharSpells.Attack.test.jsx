import { render, screen, fireEvent } from '@testing-library/react';
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

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
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
