// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharBonusActions from './CharBonusActions.jsx';

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingAid: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
    pendingGreaterRestoration: null,
    handleGreaterRestorationConfirm: vi.fn(),
    handleGreaterRestorationSkip: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    buildUpcastLevels: vi.fn(() => []),
  })),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/automation/handlers/combat/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
  triggerPostCastRiderSaves: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/combat/useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 10),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn((_playerName, _campaignName) => ({ saveDcBonus: 0 })),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
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
    if (entity.details) {
      return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    }
    return null;
  }),
}));

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="metamagic-popup">{props.spell?.name || 'MetamagicPopup'}</div>),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="spell-detail-popup">{props.spell?.name || 'SpellDetailPopup'}</div>),
}));

import { hasAutomation } from '../../services/combat/automation/automationService.js';
import { isExhausted } from '../../services/automation/handlers/combat/saveAttackHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { showWeaponMasteryPopup } from '../../hooks/combat/useActionPopup.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';
import { addEntry } from '../../services/ui/logService.js';

const basePlayerStats = {
  name: 'TestCharacter',
  rules: '5e',
  level: 5,
  attacks: [],
  bonusActions: [],
  spellAbilities: { spells: [] },
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

describe('CharBonusActions - Interactive', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });


  describe('automation handling', () => {
    const automatedBonusAction = {
      name: 'War Priest',
      description: 'You can make one weapon attack as a bonus action.',
      automation: { type: 'bonus_action_attack', trigger: 'after_action' },
    };

    it('calls onAutomationAction when a bonus action with automation is clicked', () => {
      hasAutomation.mockReturnValue(true);
      const onAutomationAction = vi.fn();
      render(<CharBonusActions playerStats={createStats({ bonusActions: [automatedBonusAction] })} onAutomationAction={onAutomationAction} />);
      const actionName = screen.getByText(/War Priest:/);
      fireEvent.click(actionName);
      expect(onAutomationAction).toHaveBeenCalledWith(automatedBonusAction);
    });

    it('shows feature detail popup when bonus action has details but no automation', () => {
      hasAutomation.mockReturnValue(false);
      const mockSetPopupHtml = vi.fn();
      vi.mocked(useDiceRollPopup).mockReturnValue({ popupHtml: null, setPopupHtml: mockSetPopupHtml });
      const bonusActionDesc = { name: 'Cunning Action', description: 'You can take a bonus action.', details: 'Dash, Hide, or Disengage.' };
      render(<CharBonusActions playerStats={createStats({ bonusActions: [bonusActionDesc] })} />);
      const actionName = screen.getByText(/Cunning Action:/);
      fireEvent.click(actionName);
      expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Cunning Action'));
      expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Dash, Hide, or Disengage'));
    });

    it('does not call onAutomationAction when bonus action is exhausted', () => {
      hasAutomation.mockReturnValue(true);
      isExhausted.mockReturnValue(true);
      const onAutomationAction = vi.fn();
      const rageAction = {
        ...automatedBonusAction,
        name: 'Berserker Rage',
        description: 'You enter a rage.',
        automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage' },
      };
      render(<CharBonusActions playerStats={createStats({ bonusActions: [rageAction] })} onAutomationAction={onAutomationAction} />);
      const actionName = screen.getByText(/Berserker Rage:/);
      fireEvent.click(actionName);
      expect(onAutomationAction).not.toHaveBeenCalled();
    });

    it('shows healing pool badge for healing_pool automation type', () => {
      hasAutomation.mockImplementation((feature) => feature?.automation?.type === 'healing_pool');
      const stats = createStats({
        bonusActions: [{ name: 'Life Stream', description: 'Heal a creature.', automation: { type: 'healing_pool', pool: 15 } }],
      });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText(/Pool: 15 HP/)).toBeInTheDocument();
    });
  });

  describe('rage expendable features', () => {
    const rageBonusAction = {
      name: 'Berserker Rage',
      description: 'You enter a rage.',
      automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage', resourceKey: 'ragePoints' },
    };

    it('shows Restore with Rage button when rage-expendable and exhausted', () => {
      hasAutomation.mockReturnValue(true);
      isExhausted.mockReturnValue(true);
      render(<CharBonusActions playerStats={createStats({ bonusActions: [rageBonusAction] })} />);
      expect(screen.getByText(/Restore with Rage/)).toBeInTheDocument();
    });

    it('does not show Restore with Rage when not rage-expendable', () => {
      hasAutomation.mockReturnValue(true);
      isExhausted.mockReturnValue(true);
      const nonRage = {
        name: 'Divine Channel',
        description: 'You channel divine energy.',
        automation: { type: 'auto_effect', recharge: 'long_rest' },
      };
      render(<CharBonusActions playerStats={createStats({ bonusActions: [nonRage] })} />);
      expect(screen.queryByText(/Restore with Rage/)).not.toBeInTheDocument();
    });

    it('restores rage and updates runtime state when Restore with Rage is clicked', async () => {
      hasAutomation.mockReturnValue(true);
      isExhausted.mockReturnValue(true);
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        return null;
      });

      render(<CharBonusActions playerStats={createStats({ bonusActions: [rageBonusAction] })} />);
      const restoreBtn = screen.getByText(/Restore with Rage/);
      fireEvent.click(restoreBtn);

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalled();
      });
    });

  });

  describe('attack and damage click handlers', () => {
    const bonusActionAttack = { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' };

    it('calls onAttackClick when hit bonus is clicked', () => {
      const mockOnAttackClick = vi.fn();
      render(<CharBonusActions playerStats={createStats({ attacks: [bonusActionAttack] })} onAttackClick={mockOnAttackClick} exhaustionPenalty={0} />);
      const hitBonusElement = screen.getByText('+5');
      fireEvent.click(hitBonusElement);
      expect(mockOnAttackClick).toHaveBeenCalledWith(bonusActionAttack);
    });

    it('logs a simple damage roll when damage is clicked for to-hit bonus action attacks (no targeting or riders)', async () => {
      const mockSetPopupHtml = vi.fn();
      vi.mocked(useDiceRollPopup).mockReturnValue({ popupHtml: null, setPopupHtml: mockSetPopupHtml });

      render(<CharBonusActions playerStats={createStats({ attacks: [bonusActionAttack] })} campaignName="test-campaign" />);
      const damageElement = screen.getByText('1d4+3');
      fireEvent.click(damageElement);
      await act(async () => { await Promise.resolve(); });
      expect(vi.mocked(addEntry)).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        type: 'roll',
        rollType: 'damage',
        name: 'Main Gauche',
        formula: '1d4+3',
        note: 'Direct damage roll (no target)',
      }));
      expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
        type: 'damage',
        name: 'Main Gauche',
        formula: '1d4+3',
        note: 'Direct damage roll (no target)',
      }));
    });

    it('does not call handleSimpleDamageRoll when cannotAct is true', () => {
      render(<CharBonusActions playerStats={createStats({ attacks: [bonusActionAttack] })} campaignName="test-campaign" cannotAct />);
      const damageElement = screen.getByText('1d4+3');
      fireEvent.click(damageElement);
      expect(vi.mocked(addEntry)).not.toHaveBeenCalled();
    });
  });

  describe('spell detail popup', () => {
    const bonusActionSpell = { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' };

    it('opens spell detail popup when a bonus action spell is clicked', async () => {
      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [bonusActionSpell] } })} />);
      const spellLink = screen.getByText('Shocking Grasp');
      fireEvent.click(spellLink);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    });
  });

  describe('save DC attack resolve spell damage', () => {
    const saveDcAttack = {
      name: 'Cone of Cold',
      range: 60,
      saveDc: 14,
      saveType: 'CON',
      damage: '8d8',
      damageType: 'Cold',
      type: 'Bonus Action',
    };

    it('calls onResolveSpellDamage when save DC attack damage is clicked', () => {
      const mockOnResolveSpellDamage = vi.fn();
      render(<CharBonusActions playerStats={createStats({ attacks: [saveDcAttack] })} onResolveSpellDamage={mockOnResolveSpellDamage} />);
      const damageElement = screen.getByText('8d8');
      fireEvent.click(damageElement);
      expect(mockOnResolveSpellDamage).toHaveBeenCalledWith(saveDcAttack);
    });

    it('does not call onResolveSpellDamage when cannotAct is true', () => {
      const mockOnResolveSpellDamage = vi.fn();
      render(<CharBonusActions playerStats={createStats({ attacks: [saveDcAttack] })} onResolveSpellDamage={mockOnResolveSpellDamage} cannotAct />);
      const damageElement = screen.getByText('8d8');
      fireEvent.click(damageElement);
      expect(mockOnResolveSpellDamage).not.toHaveBeenCalled();
    });
  });

  describe('Horde Breaker click handlers', () => {
    const hordeBreakerAttack = {
      name: 'Horde Breaker',
      range: 30,
      hitBonus: 5,
      damage: '1d8+3',
      damageType: 'Piercing',
      type: 'Bonus Action',
      isHordeBreaker: true,
    };

    const bonusActionSpell = { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' };

    it('calls onAttackClick when Horde Breaker hit bonus is clicked', () => {
      const mockOnAttackClick = vi.fn();
      getRuntimeValue.mockReturnValueOnce(null)
        .mockReturnValueOnce('Horde Breaker')
        .mockReturnValueOnce(0)
        .mockReturnValue(null);
      render(<CharBonusActions playerStats={createStats({ attacks: [hordeBreakerAttack], spellAbilities: { spells: [bonusActionSpell] } })} onAttackClick={mockOnAttackClick} campaignName="test" exhaustionPenalty={0} />);
      expect(screen.getByText('Horde Breaker')).toBeInTheDocument();
      const hitBonusElement = screen.getByText(/\+[5-9]/);
      fireEvent.click(hitBonusElement);
      expect(mockOnAttackClick).toHaveBeenCalledWith(hordeBreakerAttack);
    });

    it('logs a simple damage roll when Horde Breaker damage is clicked (no targeting or riders)', async () => {
      const mockSetPopupHtml = vi.fn();
      vi.mocked(useDiceRollPopup).mockReturnValue({ popupHtml: null, setPopupHtml: mockSetPopupHtml });
      getRuntimeValue.mockReturnValueOnce(null)
        .mockReturnValueOnce('Horde Breaker')
        .mockReturnValueOnce(0)
        .mockReturnValue(null);
      render(<CharBonusActions playerStats={createStats({ attacks: [hordeBreakerAttack], spellAbilities: { spells: [bonusActionSpell] } })} campaignName="test" />);
      expect(screen.getByText('Horde Breaker')).toBeInTheDocument();
      const damageElement = screen.getByText('1d8+3');
      fireEvent.click(damageElement);
      await act(async () => { await Promise.resolve(); });
      expect(vi.mocked(addEntry)).toHaveBeenCalledWith('test', expect.objectContaining({
        type: 'roll',
        rollType: 'damage',
        name: 'Horde Breaker',
        formula: '1d8+3',
        note: 'Direct damage roll (no target)',
      }));
    });

    it('does not show Horde Breaker when cannotAct is true', () => {
      getRuntimeValue.mockReturnValueOnce(null)
        .mockReturnValueOnce('Horde Breaker')
        .mockReturnValueOnce(0)
        .mockReturnValue(null);
      const stats = createStats({ attacks: [hordeBreakerAttack], spellAbilities: { spells: [bonusActionSpell] } });
      render(<CharBonusActions playerStats={stats} cannotAct={true} campaignName="test" />);
      expect(screen.queryByText('Horde Breaker')).not.toBeInTheDocument();
    });

    it('does not show Horde Breaker when usedRound equals currentRound', () => {
      getRuntimeValue.mockReturnValueOnce(null)
        .mockReturnValueOnce('Horde Breaker')
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(1);
      const stats = createStats({ attacks: [hordeBreakerAttack], spellAbilities: { spells: [bonusActionSpell] } });
      render(<CharBonusActions playerStats={stats} campaignName="test" />);
      expect(screen.queryByText('Horde Breaker')).not.toBeInTheDocument();
    });

    it('applies exhaustion penalty to Horde Breaker hit bonus display', () => {
      const mockOnAttackClick = vi.fn();
      getRuntimeValue.mockReturnValueOnce(null)
        .mockReturnValueOnce('Horde Breaker')
        .mockReturnValueOnce(0)
        .mockReturnValue(null);
      render(<CharBonusActions playerStats={createStats({ attacks: [hordeBreakerAttack], spellAbilities: { spells: [bonusActionSpell] } })} campaignName="test" onAttackClick={mockOnAttackClick} exhaustionPenalty={2} />);
      expect(screen.getByText('+3')).toBeInTheDocument();
    });
  });

  describe('2024 rules - weapon mastery click', () => {
    const bonusActionAttack = { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' };

    it('opens weapon mastery popup when a mastery cell is clicked', () => {
      const mockGetWeaponMastery = vi.fn(() => 'Piercing');
      const mockOnAttackClick = vi.fn();
      render(<CharBonusActions playerStats={createStats({ rules: '2024', attacks: [bonusActionAttack] })} getWeaponMastery={mockGetWeaponMastery} onAttackClick={mockOnAttackClick} />);
      const clickableDivs = document.querySelectorAll('div.mastery-enabled > div.clickable');
      const masteryCell = clickableDivs[clickableDivs.length - 1];
      fireEvent.click(masteryCell);
      expect(showWeaponMasteryPopup).toHaveBeenCalledWith('Piercing', expect.any(Function));
    });
  });

  describe('rage restore with auto-generated resourceKey', () => {
    const rageBonusAction = {
      name: 'Berserker Rage',
      description: 'You enter a rage.',
      automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage' },
    };

    it('uses auto-generated resourceKey when resourceKey is not set', async () => {
      hasAutomation.mockReturnValue(true);
      isExhausted.mockReturnValue(true);
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        return null;
      });

      render(<CharBonusActions playerStats={createStats({ bonusActions: [rageBonusAction] })} />);
      const restoreBtn = screen.getByText(/Restore with Rage/);
      fireEvent.click(restoreBtn);

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'berserkerrageUses', 0, undefined);
      });
    });
  });
});
