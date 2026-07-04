// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
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

vi.mock('lodash', () => ({
  cloneDeep: vi.fn(obj => JSON.parse(JSON.stringify(obj))),
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

  describe('Exhaustion and conditions', () => {
    const baseProps = {
      playerStats: mockPlayerStats,
      handleTogglePreparedSpells: mockHandleTogglePreparedSpells,
    };

    function getSpellAbilitiesSection() {
      return screen.getByRole('heading', { name: 'Spells', level: 4 }).closest('.spell-abilities');
    }

    function getToHitSpan() {
      const section = getSpellAbilitiesSection();
      const spans = section.querySelectorAll('span');
      return spans[0];
    }

    function getModifierSpan() {
      const section = getSpellAbilitiesSection();
      const spans = section.querySelectorAll('span');
      return spans[1];
    }

    function getAttackLabel() {
      return screen.getByText(/Attack \(to hit\):/);
    }

    describe('cannotAct condition', () => {
      it('should apply disabled-attack and stat--penalized classes to the attack label when cannotAct is true', () => {
        render(<CharSpells {...baseProps} cannotAct />);

        const attackLabel = getAttackLabel();
        expect(attackLabel).toHaveClass('disabled-attack');
        expect(attackLabel).toHaveClass('stat--penalized');
      });

      it('should not call rollAttack when clicking the attack label with cannotAct true', () => {
        const mockRollAttack = vi.fn();
        useLoggedDiceRoll.mockImplementation(() => ({
          popupHtml: null,
          setPopupHtml: vi.fn(),
          rollAttack: mockRollAttack,
          rollDamage: vi.fn(),
          quickRollPlayerSave: vi.fn(),
        }));

        render(<CharSpells {...baseProps} cannotAct />);

        const attackLabel = getAttackLabel();
        fireEvent.click(attackLabel);

        expect(mockRollAttack).not.toHaveBeenCalled();
      });

      it('should call rollAttack when clicking the attack label without cannotAct', () => {
        const mockRollAttack = vi.fn();
        useLoggedDiceRoll.mockImplementation(() => ({
          popupHtml: null,
          setPopupHtml: vi.fn(),
          rollAttack: mockRollAttack,
          rollDamage: vi.fn(),
          quickRollPlayerSave: vi.fn(),
        }));

        render(<CharSpells {...baseProps} />);

        const attackLabel = getAttackLabel();
        fireEvent.click(attackLabel);

        expect(mockRollAttack).toHaveBeenCalled();
      });
    });

    describe('exhaustionPenalty', () => {
      it.each`
        penalty | expectedToHit | expectedModifier
        ${0}    | ${'+5'}       | ${'+3'}
        ${1}    | ${'+4'}       | ${'+2'}
        ${2}    | ${'+3'}       | ${'+1'}
        ${3}    | ${'+2'}       | ${'+0'}
        ${5}    | ${'+0'}       | ${'+-2'}
        ${6}    | ${'+-1'}      | ${'+-3'}
      `('should display correct to-hit and modifier with exhaustionPenalty of $penalty', ({ penalty, expectedToHit, expectedModifier }) => {
        render(<CharSpells {...baseProps} exhaustionPenalty={penalty} />);

        expect(getToHitSpan().textContent).toBe(expectedToHit);
        expect(getModifierSpan().textContent).toBe(expectedModifier);

        const attackLabel = getAttackLabel();
        const toHitSpan = getToHitSpan();
        const modifierSpan = getModifierSpan();

        if (penalty > 0) {
          expect(attackLabel).toHaveClass('stat--penalized');
          expect(toHitSpan).toHaveClass('stat--penalized');
          expect(modifierSpan).toHaveClass('stat--penalized');
        } else {
          expect(attackLabel).not.toHaveClass('stat--penalized');
          expect(toHitSpan).not.toHaveClass('stat--penalized');
          expect(modifierSpan).not.toHaveClass('stat--penalized');
        }
      });
    });

    describe('conditionAttackMode', () => {
      it.each`
        mode             | hasPenalizedClass
        ${'disadvantage'} | ${true}
        ${'normal'}       | ${false}
        ${undefined}      | ${false}
      `('should apply stat--penalized class when conditionAttackMode is $mode', ({ mode, hasPenalizedClass }) => {
        render(<CharSpells {...baseProps} conditionAttackMode={mode} />);

        const attackLabel = getAttackLabel();

        if (hasPenalizedClass) {
          expect(attackLabel).toHaveClass('stat--penalized');
        } else {
          expect(attackLabel).not.toHaveClass('stat--penalized');
        }
      });
    });
  });
});
