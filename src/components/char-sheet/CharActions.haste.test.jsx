import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null, setPopupHtml: vi.fn(), rollAttack: vi.fn(), rollDamage: vi.fn(), quickRollPlayerSave: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null, gateMetamagic: vi.fn(), handleConfirm: vi.fn(), handleSkip: vi.fn(),
    pendingAid: null, handleAidConfirm: vi.fn(), handleAidSkip: vi.fn(),
    pendingGreaterRestoration: null, handleGreaterRestorationConfirm: vi.fn(), handleGreaterRestorationSkip: vi.fn(),
    pendingRemoveCurse: null, handleRemoveCurseConfirm: vi.fn(), handleRemoveCurseSkip: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({ buildUpcastLevels: vi.fn(() => []) })),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false), collectWeaponMastery: vi.fn(() => ({ baseMastery: null, extraMasteries: [] })), evaluateAutoExpression: vi.fn(() => null),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/automation/handlers/combat/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn(() => ({ saveDcBonus: 0 })),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null), getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn((entity) => {
    if (entity.details) return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    return null;
  }),
}));

vi.mock('./DiceRollResult.jsx', () => ({
  default: vi.fn(() => <div data-testid="dice-roll-result">DiceRollResult</div>),
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: vi.fn(() => <div data-testid="metamagic-popup">MetamagicPopup</div>),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn(() => <div data-testid="spell-detail-popup">SpellDetailPopup</div>),
}));

vi.mock('./EmpoweredSpellPopup.jsx', () => ({
  default: vi.fn(() => <div data-testid="empowered-spell-popup">EmpoweredSpellPopup</div>),
}));

vi.mock('./CharBonusActions.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-bonus-actions">CharBonusActions</div>),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })), getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn((name) => ({ baseName: name })),
}));

vi.mock('../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({ maxFocusPoints: 2 })),
}));

vi.mock('../../services/character/featRangeService.js', () => ({
  computeFeatRangeEffects: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [3, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 10, rolls: [3, 2, 3, 2], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 48, rolls: [6, 6, 6, 6, 6, 6, 6, 6], modifier: 0 })),
}));

vi.mock('../../hooks/combat/useActionSpellMetamagic.js', () => ({
  useActionSpellMetamagic: vi.fn(() => ({
    pendingActionMetamagic: null, handleActionMetamagicConfirm: vi.fn(), handleActionMetamagicSkip: vi.fn(),
    handleActionSpellDamageClick: vi.fn(), handleSpellAttackClick: vi.fn(), handleSpellDamageClick: vi.fn(),
  })),
}));

import CharActions from './CharActions.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const basePlayerStats = {
  name: 'TestCharacter', rules: '5e', level: 5, attacks: [], actions: [], spellAbilities: { spells: [] },
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

describe('CharActions haste extra action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
  });

  describe('Haste section rendering', () => {
    it('should not show Haste Extra Action section when haste is not active', async () => {
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.queryByText('Haste Extra Action')).not.toBeInTheDocument();
    });

    it('should show Haste Extra Action section when haste is active', async () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'haste', name: 'Haste' }];
        return null;
      });
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Haste Extra Action')).toBeInTheDocument();
    });

    it('should show Attack, Dash, Disengage, Hide, Use an Object actions', async () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'haste', name: 'Haste' }];
        return null;
      });
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Attack')).toBeInTheDocument();
      expect(screen.getByText('Dash')).toBeInTheDocument();
      expect(screen.getByText('Disengage')).toBeInTheDocument();
      expect(screen.getByText('Hide')).toBeInTheDocument();
      expect(screen.getByText('Use an Object')).toBeInTheDocument();
    });

    it('should show Melee/Ranged type for Attack and Special for others', async () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'haste', name: 'Haste' }];
        return null;
      });
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Melee/Ranged')).toBeInTheDocument();
      const specialTypes = screen.getAllByText('Special');
      expect(specialTypes.length).toBe(4);
    });
  });

  describe('Haste section with 2024 rules', () => {
    it('should show no Mastery column for 5e rules in haste section', async () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'haste', name: 'Haste' }];
        return null;
      });
      const stats = createStats({ rules: '5e' });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.queryByText('Mastery')).not.toBeInTheDocument();
    });
  });

  describe('Haste state handling', () => {
    it('should show disabled-attack class for haste actions when haste already used', async () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'haste', name: 'Haste' }];
        if (key === 'hasteExtraActionUsed') return true;
        return null;
      });
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const disabledEls = document.querySelectorAll('.disabled-attack');
      expect(disabledEls.length).toBeGreaterThanOrEqual(5);
    });

    it('should not apply disabled-attack class when cannotAct is true (handled in click handler, not class)', async () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'haste', name: 'Haste' }];
        return null;
      });
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} cannotAct={true} />); });
      const hasteDisabled = document.querySelectorAll('.disabled-attack');
      expect(hasteDisabled.length).toBe(0);
      expect(screen.getByText('Haste Extra Action')).toBeInTheDocument();
    });
  });

  describe('Haste attack click', () => {
    it('should call setRuntimeValue and show popup when Attack is clicked', async () => {
      const mockSetPopupHtml = vi.fn();
      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(), quickRollPlayerSave: vi.fn(),
      });
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'haste', name: 'Haste' }];
        return null;
      });
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} />); });

      const attackBtn = screen.getByText('Attack');
      await act(async () => { fireEvent.click(attackBtn); });

      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'hasteExtraActionUsed', true, undefined);
      expect(mockSetPopupHtml).toHaveBeenCalledWith({
        type: 'automation_info',
        name: 'Haste',
        description: 'Haste extra action: Attack (one weapon attack only).',
      });
    });

    it('should not call setRuntimeValue when cannotAct is true', async () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'haste', name: 'Haste' }];
        return null;
      });
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} cannotAct={true} />); });

      const attackBtn = screen.getByText('Attack');
      await act(async () => { fireEvent.click(attackBtn); });

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should not call setRuntimeValue when haste already used this turn (click handler returns early)', async () => {
      const mockSetPopupHtml = vi.fn();
      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(), quickRollPlayerSave: vi.fn(),
      });
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'haste', name: 'Haste' }];
        if (key === 'hasteExtraActionUsed') return true;
        return null;
      });
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} />); });

      const attackBtn = screen.getByText('Attack');
      await act(async () => { fireEvent.click(attackBtn); });

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
    });
  });

  describe('Haste non-attack actions', () => {
    it.each(['Dash', 'Disengage', 'Hide', 'Use an Object'])('should handle haste %s action click', async (actionName) => {
      const mockSetPopupHtml = vi.fn();
      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(), quickRollPlayerSave: vi.fn(),
      });
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'haste', name: 'Haste' }];
        return null;
      });
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} />); });

      const btn = screen.getByText(actionName);
      await act(async () => { fireEvent.click(btn); });

      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'hasteExtraActionUsed', true, undefined);
      expect(mockSetPopupHtml).toHaveBeenCalledWith({
        type: 'automation_info', name: 'Haste',
        description: `Haste extra action: ${actionName}.`,
      });
    });

    it('should not handle haste Dash when cannotAct is true', async () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'haste', name: 'Haste' }];
        return null;
      });
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} cannotAct={true} />); });

      const dashBtn = screen.getByText('Dash');
      await act(async () => { fireEvent.click(dashBtn); });

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should not handle haste Dash when haste already used this turn (click returns early)', async () => {
      const mockSetPopupHtml = vi.fn();
      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(), quickRollPlayerSave: vi.fn(),
      });
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'haste', name: 'Haste' }];
        if (key === 'hasteExtraActionUsed') return true;
        return null;
      });
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} />); });

      const dashBtn = screen.getByText('Dash');
      await act(async () => { fireEvent.click(dashBtn); });

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
    });
  });
});
