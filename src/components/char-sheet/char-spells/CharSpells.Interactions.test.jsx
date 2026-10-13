// @improved-by-ai
// @cleaned-by-ai
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';
import * as helpers from './CharSpells.test-utils.js';

const { useSpellMetamagicFlow } = vi.hoisted(() => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    gateMetamagic: vi.fn(),
  })),
}));

let mockRollAttack = vi.fn();
let mockRollDamage = vi.fn();

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => []),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: mockRollAttack,
    rollDamage: mockRollDamage,
    quickRollPlayerSave: vi.fn(),
  })),
}));

vi.mock('../../../hooks/combat/useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 3),
  getMaxSorceryPoints: vi.fn(() => 6),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow,
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

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue(null),
  getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue({ players: [], placedItems: [] }),
}));

vi.mock('../../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
    rangeToFeet: vi.fn(() => null),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 0 })),
}));

vi.mock('./SpellDetailPopup.jsx', () => ({
  default: function SpellDetailPopup({ spell }) {
    return <div data-testid="spell-detail-popup">{spell?.name}</div>;
  },
}));

vi.mock('./CharSpellSlots.jsx', () => ({
  default: function CharSpellSlots() {
    return <div data-testid="char-spell-slots">Spell Slots</div>;
  },
}));

vi.mock('../popups/MetamagicPopup.jsx', () => ({
  default: function MetamagicPopup() {
    return <div data-testid="metamagic-popup">Metamagic</div>;
  },
}));

vi.mock('../popups/MultiTargetPopup.jsx', () => ({
  default: function MultiTargetPopup() {
    return <div data-testid="multi-target-popup">MultiTarget</div>;
  },
}));

vi.mock('../popups/MultiTargetCountPopup.jsx', () => ({
  default: function MultiTargetCountPopup() {
    return <div data-testid="aid-target-popup">Aid</div>;
  },
}));

vi.mock('../popups/TargetWithCheckboxesPopup.jsx', () => ({
  default: function TargetWithCheckboxesPopup() {
    return <div data-testid="greater-restoration-popup">GreaterRestoration</div>;
  },
}));

vi.mock('../popups/SingleTargetPopup.jsx', () => ({
  default: function SingleTargetPopup() {
    return <div data-testid="mage-armor-popup">MageArmor</div>;
  },
}));

vi.mock('../popups/TargetWithTypePopup.jsx', () => ({
  default: function TargetWithTypePopup() {
    return <div data-testid="protection-from-energy-popup">ProtectionFromEnergy</div>;
  },
}));

vi.mock('../popups/MagicMissileTargetPopup.jsx', () => ({
  default: function MagicMissileTargetPopup() {
    return <div data-testid="magic-missile-popup">MagicMissile</div>;
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

const basePlayerStats = helpers.mockPlayerStats;
const mockHandleTogglePreparedSpells = vi.fn();
const baseProps = { playerStats: basePlayerStats, campaignName: 'test', handleTogglePreparedSpells: mockHandleTogglePreparedSpells };

function renderWithProps(props) {
  return render(<CharSpells {...baseProps} {...props} />);
}

describe('CharSpells - Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRollAttack.mockClear();
    mockRollDamage.mockClear();
  });

  describe('spell attack click behavior', () => {
    it('does not call rollAttack when cannotAct is true', () => {
      renderWithProps({ cannotAct: true });
      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      fireEvent.click(attackLabel);

      expect(mockRollAttack).not.toHaveBeenCalled();
    });

    it.each`
      exhaustionPenalty | conditionAttackMode | expectedToHit | expectedForcedMode
      ${0}              | ${undefined}        | ${5}          | ${undefined}
      ${1}              | ${undefined}        | ${4}          | ${undefined}
      ${0}              | ${'disadvantage'}   | ${5}          | ${'disadvantage'}
    `('calls rollAttack with toHit=$expectedToHit and forcedMode=$expectedForcedMode (exhaustion=$exhaustionPenalty, condition=$conditionAttackMode)', ({ exhaustionPenalty, conditionAttackMode, expectedToHit, expectedForcedMode }) => {
      renderWithProps({ exhaustionPenalty, conditionAttackMode });
      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      fireEvent.click(attackLabel);

      expect(mockRollAttack).toHaveBeenCalledWith(
        'Spell Attack',
        expectedToHit,
        expect.objectContaining({ forcedMode: expectedForcedMode })
      );
    });

    it('applies both exhaustion penalty and conditionAttackMode together', () => {
      renderWithProps({ exhaustionPenalty: 2, conditionAttackMode: 'disadvantage' });
      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      fireEvent.click(attackLabel);

      expect(mockRollAttack).toHaveBeenCalledWith(
        'Spell Attack',
        3,
        { forcedMode: 'disadvantage' }
      );
    });
  });

  describe('spell row click behavior', () => {
    it('renders checkbox unchecked for spells with empty prepared string', () => {
      const spell = {
        name: 'Unprepared Spell',
        level: 1,
        casting_time: '1 turn',
        range: 'Self',
        duration: 'Instantaneous',
        components: ['V'],
        prepared: '',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
    });
  });
});
