// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  });

  describe('rage expendable features', () => {
    const rageBonusAction = {
      name: 'Berserker Rage',
      description: 'You enter a rage.',
      automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage', resourceKey: 'ragePoints' },
    };

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
      const mockOnAttackClick = vi.fn();
      render(<CharBonusActions playerStats={createStats({ attacks: [bonusActionAttack] })} campaignName="test-campaign" onAttackClick={mockOnAttackClick} />);
      const damageElement = screen.getByText('1d4+3');
      fireEvent.click(damageElement);
      await waitFor(() => {
        expect(vi.mocked(addEntry)).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          type: 'roll',
          rollType: 'damage',
          name: 'Main Gauche',
          formula: '1d4+3',
          note: 'Direct damage roll (no target)',
        }));
      });
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
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === "_Hunter's Prey_choice") return 'Horde Breaker';
        if (key === '_Hunters_Prey_HordeBreaker_UsedRound') return 0;
        return null;
      });
      render(<CharBonusActions playerStats={createStats({ attacks: [hordeBreakerAttack], spellAbilities: { spells: [bonusActionSpell] } })} onAttackClick={mockOnAttackClick} campaignName="test" exhaustionPenalty={0} />);
      expect(screen.getByText('Horde Breaker')).toBeInTheDocument();
      const hitBonusElement = screen.getByText('+5');
      fireEvent.click(hitBonusElement);
      expect(mockOnAttackClick).toHaveBeenCalledWith(hordeBreakerAttack);
    });

  });

});
