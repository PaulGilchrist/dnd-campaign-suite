// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

vi.mock('./SpellDetailPopup.jsx', () => ({
  default: function SpellDetailPopup({ spell }) {
    return <div data-testid="spell-detail-popup">{spell?.name}</div>;
  },
}));

vi.mock('./UpcastPopup.jsx', () => ({
  default: function UpcastPopup() {
    return <div data-testid="upcast-popup">Upcast</div>;
  },
}));

vi.mock('../DiceRollResult.jsx', () => ({
  default: function DiceRollResult() {
    return <div data-testid="dice-roll-result">DiceRollResult</div>;
  },
}));

vi.mock('../common/Popup.jsx', () => ({
  default: function Popup({ children }) {
    return <div data-testid="popup">{children}</div>;
  },
}));

vi.mock('../popups/MultiTargetPopup.jsx', () => ({
  default: function MultiTargetPopup() {
    return <div data-testid="multi-target-popup">MultiTarget</div>;
  },
}));

vi.mock('../popups/AidTargetPopup.jsx', () => ({
  default: function AidTargetPopup() {
    return <div data-testid="aid-target-popup">Aid</div>;
  },
}));

vi.mock('../popups/HeroesFeastTargetPopup.jsx', () => ({
  default: function HeroesFeastTargetPopup() {
    return <div data-testid="heroes-feast-popup">HeroesFeast</div>;
  },
}));

vi.mock('../popups/GreaterRestorationPopup.jsx', () => ({
  default: function GreaterRestorationPopup() {
    return <div data-testid="greater-restoration-popup">GreaterRestoration</div>;
  },
}));

vi.mock('../popups/LesserRestorationPopup.jsx', () => ({
  default: function LesserRestorationPopup() {
    return <div data-testid="lesser-restoration-popup">LesserRestoration</div>;
  },
}));

vi.mock('../popups/RemoveCursePopup.jsx', () => ({
  default: function RemoveCursePopup() {
    return <div data-testid="remove-curse-popup">RemoveCurse</div>;
  },
}));

vi.mock('../popups/MageArmorTargetPopup.jsx', () => ({
  default: function MageArmorTargetPopup() {
    return <div data-testid="mage-armor-popup">MageArmor</div>;
  },
}));

vi.mock('../popups/ShieldOfFaithTargetPopup.jsx', () => ({
  default: function ShieldOfFaithTargetPopup() {
    return <div data-testid="shield-of-faith-popup">ShieldOfFaith</div>;
  },
}));

vi.mock('../popups/ProtectionFromEnergyTargetPopup.jsx', () => ({
  default: function ProtectionFromEnergyTargetPopup() {
    return <div data-testid="protection-from-energy-popup">ProtectionFromEnergy</div>;
  },
}));

vi.mock('../popups/ResistanceTargetPopup.jsx', () => ({
  default: function ResistanceTargetPopup() {
    return <div data-testid="resistance-popup">Resistance</div>;
  },
}));

vi.mock('../popups/MagicMissileTargetPopup.jsx', () => ({
  default: function MagicMissileTargetPopup() {
    return <div data-testid="magic-missile-popup">MagicMissile</div>;
  },
}));

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingMultiTarget: null,
    handleMultiTargetConfirm: vi.fn(),
    handleMultiTargetSkip: vi.fn(),
    pendingAid: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
    pendingHeroesFeast: null,
    handleHeroesFeastConfirm: vi.fn(),
    handleHeroesFeastSkip: vi.fn(),
    pendingGreaterRestoration: null,
    handleGreaterRestorationConfirm: vi.fn(),
    handleGreaterRestorationSkip: vi.fn(),
    pendingLesserRestoration: null,
    handleLesserRestorationConfirm: vi.fn(),
    handleLesserRestorationSkip: vi.fn(),
    pendingMageArmor: null,
    handleMageArmorConfirm: vi.fn(),
    handleMageArmorSkip: vi.fn(),
    pendingShieldOfFaith: null,
    handleShieldOfFaithConfirm: vi.fn(),
    handleShieldOfFaithSkip: vi.fn(),
    pendingProtectionFromEnergy: null,
    handleProtectionFromEnergyConfirm: vi.fn(),
    handleProtectionFromEnergySkip: vi.fn(),
    pendingResistance: null,
    handleResistanceConfirm: vi.fn(),
    handleResistanceSkip: vi.fn(),
    pendingRemoveCurse: null,
    handleRemoveCurseConfirm: vi.fn(),
    handleRemoveCurseSkip: vi.fn(),
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

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 8, rolls: [4, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 16, rolls: [4, 4, 4, 4], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 24, rolls: [6, 6, 6, 6], modifier: 0 })),
}));

vi.mock('../../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

vi.mock('../../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../../services/rules/spells/postCastRiderService.js', () => ({
  hasEmpoweredEvocation: vi.fn(() => false),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
  getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({ players: [], placedItems: [] })),
}));

vi.mock('../../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 0 })),
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
    vi.clearAllMocks();
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
    }));
  });

  describe('Save-based spells', () => {
    it('should show save info in effect text for save-based spells with dc_success "negates"', () => {
      const statsWithSaveSpell = {
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
                  '0': '1d8',
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

      renderCharSpells({ playerStats: statsWithSaveSpell });

      expect(screen.getByText('1d8 Radiant (DEX negates)')).toBeInTheDocument();
    });

    it('should show half for save-based spells with dc_success "half"', () => {
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

      renderCharSpells({ playerStats: statsWithSaveSpell });

      expect(screen.getByText('8d6 Fire (DEX half)')).toBeInTheDocument();
    });

    it('should show negates for non-DEX save types with dc_success "none"', () => {
      const statsWithWISSave = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Wisdom Save Spell',
              level: 2,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Instantaneous',
              components: ['V'],
              damage: {
                damage_at_slot_level: {
                  '2': '2d10',
                },
                damage_type: 'Psychic',
              },
              dc: {
                dc_type: 'WIS',
                dc_success: 'none',
              },
              prepared: 'Prepared',
            },
          ],
        },
      };

      renderCharSpells({ playerStats: statsWithWISSave });

      expect(screen.getByText('2d10 Psychic (WIS negates)')).toBeInTheDocument();
    });

    it('should call rollDamage with save context when a save-based spell effect cell is clicked', async () => {
      const mockRollDamage = vi.fn();
      useLoggedDiceRoll.mockImplementation(() => ({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollAttack: vi.fn(),
        rollDamage: mockRollDamage,
        quickRollPlayerSave: vi.fn(),
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
                  '0': '1d8',
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

      renderCharSpells({ playerStats: statsWithSaveSpell });

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

    it('should call rollDamage with save context for level 3 save spells', async () => {
      const mockRollDamage = vi.fn();
      useLoggedDiceRoll.mockImplementation(() => ({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollAttack: vi.fn(),
        rollDamage: mockRollDamage,
        quickRollPlayerSave: vi.fn(),
      }));

      const statsWithSaveSpell = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          saveDc: 15,
          spells: [
            {
              name: 'Lightning Bolt',
              level: 3,
              casting_time: '1 action',
              range: '150 feet',
              duration: 'Instantaneous',
              components: ['V', 'S'],
              damage: {
                damage_at_slot_level: {
                  '3': '8d6',
                },
                damage_type: 'Lightning',
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

      renderCharSpells({ playerStats: statsWithSaveSpell });

      const effectCell = screen.getByText('8d6 Lightning (DEX half)');
      fireEvent.click(effectCell);

      await waitFor(() => {
        expect(mockRollDamage).toHaveBeenCalled();
      });
      const args = mockRollDamage.mock.calls[0];
      expect(args[0]).toBe('Lightning Bolt');
      expect(args[5]).toMatchObject({
        dc: 15,
        dcType: 'DEX',
        dcSuccess: 'half',
        saveDc: 15,
        saveType: 'DEX',
      });
    });

    it('should include statusEffects in rollDamage context when spell has status_effects', async () => {
      const mockRollDamage = vi.fn();
      useLoggedDiceRoll.mockImplementation(() => ({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollAttack: vi.fn(),
        rollDamage: mockRollDamage,
        quickRollPlayerSave: vi.fn(),
      }));

      const statsWithStatusEffects = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          saveDc: 13,
          spells: [
            {
              name: 'Hypnotic Pattern',
              level: 3,
              casting_time: '1 action',
              range: '60 feet',
              duration: 'Concentration, up to 1 minute',
              components: ['S', 'M'],
              damage: {
                damage_at_slot_level: {
                  '3': '3d8',
                },
                damage_type: 'Psychic',
              },
              dc: {
                dc_type: 'WIS',
                dc_success: 'none',
              },
              status_effects: ['Fascinated'],
              prepared: 'Prepared',
            },
          ],
        },
      };

      renderCharSpells({ playerStats: statsWithStatusEffects });

      const effectCell = screen.getByText('3d8 Psychic (WIS negates)');
      fireEvent.click(effectCell);

      await waitFor(() => {
        expect(mockRollDamage).toHaveBeenCalled();
      });
      const args = mockRollDamage.mock.calls[0];
      expect(args[5].statusEffects).toEqual(['Fascinated']);
    });

    it('should not show clickable class on effect cell when spell has no damage', () => {
      const statsWithUtilitySpell = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
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

      renderCharSpells({ playerStats: statsWithUtilitySpell });

      const table = screen.getByRole('table');
      const effectCell = table.querySelector('tbody tr td:nth-child(6)');
      expect(effectCell.classList.contains('clickable')).toBe(false);
    });

    it('should show effect as "Utility" when spell has no damage object', () => {
      const statsWithNoDamage = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Prestidigation',
              level: 0,
              casting_time: '1 action',
              range: '10 feet',
              duration: '1 hour',
              components: ['V', 'S'],
              prepared: 'Always',
            },
          ],
        },
      };

      renderCharSpells({ playerStats: statsWithNoDamage });

      const table = screen.getByRole('table');
      const effectCell = table.querySelector('tbody tr td:nth-child(6)');
      expect(effectCell.textContent).toBe('Utility');
    });

    it('should show effect as "Utility" when spell has damage object with no damage values', () => {
      const statsWithEmptyDamage = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Empty Damage Spell',
              level: 1,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Instantaneous',
              components: ['V'],
              damage: {
                damage_at_slot_level: {},
                damage_type: 'Fire',
              },
              prepared: 'Prepared',
            },
          ],
        },
      };

      renderCharSpells({ playerStats: statsWithEmptyDamage });

      const table = screen.getByRole('table');
      const effectCell = table.querySelector('tbody tr td:nth-child(6)');
      expect(effectCell.textContent).toBe('Utility');
    });
  });
});
