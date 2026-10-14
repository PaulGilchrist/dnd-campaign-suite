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

vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
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
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  useRuntimeValue: vi.fn(() => null),
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

vi.mock('./HexAbilityModal.jsx', () => ({
  default: vi.fn((props) => <div data-testid="hex-ability-modal"><button onClick={props.onCancel}>Cancel</button></div>),
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: vi.fn((props) => <div data-testid="secondary-target-modal">{props.title}</div>),
}));

vi.mock('./ArcaneVigorModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="arcane-vigor-modal">Arcane Vigor</div>),
}));

vi.mock('../../services/rules/core/spellDamageUtils.js', () => ({
  resolveSpellDamageAtLevel: vi.fn(() => null),
  isAutoHitSpell: vi.fn(() => false),
  resolveHealExpression: vi.fn(() => ''),
}));

vi.mock('../../services/ui/spellSectionUtils.js', () => ({
  getBonusActionSpellNames: vi.fn(() => new Set(['Shocking Grasp'])),
}));

vi.mock('../../services/character/featureCategories.js', () => ({
  getCategories: vi.fn(() => ({ featuresToIgnore: ['Spellcasting'] })),
}));



vi.mock('../../hooks/combat/useSpellPositionResolver.js', () => ({
  useSpellPositionResolver: vi.fn(() => ({ resolvePositions: vi.fn(), cachedPosRef: {} })),
}));

vi.mock('../../hooks/combat/useSpellCastExecutor.js', () => ({
  useSpellCastExecutor: vi.fn(() => ({ castAction: vi.fn() })),
}));

vi.mock('../../services/ui/formatUtils.js', () => ({
  formatRange: vi.fn((range) => range || ''),
  signFormatter: { format: (n) => (n >= 0 ? `+${n}` : `${n}`) },
  getAttackSpellLevel: vi.fn(() => null),
}));

import { hasAutomation } from '../../services/combat/automation/automationService.js';
import { getRuntimeValue, setRuntimeValue, useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { setTempHp } from '../../services/automation/handlers/buffs/tempHpService.js';

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
      vi.mocked(hasAutomation).mockReturnValue(true);
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

    it('renders rage-expendable bonus action as clickable regardless of rage exhaustion', () => {
      vi.mocked(hasAutomation).mockReturnValue(true);
      render(<CharBonusActions playerStats={createStats({ bonusActions: [rageBonusAction] })} />);
      expect(screen.getByText(/Berserker Rage:/)).toHaveClass('clickable');
    });

    it('dispatches automation on click when rage is exhausted (handler manages rage)', () => {
      vi.mocked(hasAutomation).mockReturnValue(true);
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        return null;
      });

      const mockOnAutomationAction = vi.fn();
      render(<CharBonusActions playerStats={createStats({ bonusActions: [rageBonusAction] })} onAutomationAction={mockOnAutomationAction} />);
      const actionName = screen.getByText(/Berserker Rage:/);
      fireEvent.click(actionName);

      expect(mockOnAutomationAction).toHaveBeenCalledWith(rageBonusAction);
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

  describe('bolstering treat', () => {
    it.each([
      { label: 'hasBolsteringTreat is true', bolsteringTreat: 2, chefBolsteringTreats: 0, shouldShow: true },
      { label: 'hasChefBolsteringTreats is true', bolsteringTreat: 0, chefBolsteringTreats: 1, shouldShow: true },
      { label: 'both counts are 0', bolsteringTreat: 0, chefBolsteringTreats: 0, shouldShow: false },
    ])('shows Eat Bolstering Treat when $label', ({ bolsteringTreat, chefBolsteringTreats, shouldShow }) => {
      useRuntimeValue.mockImplementation((name, key) => {
        if (key === 'bolsteringTreat') return bolsteringTreat;
        if (key === 'chefBolsteringTreats') return chefBolsteringTreats;
        if (key === 'activeBuffs') return null;
        if (key === 'poisonDoses') return 0;
        return null;
      });
      getRuntimeValue.mockReturnValue(null);
      const stats = createStats({ level: 5, bonusActions: [{ name: 'TestFeature', description: 'test' }] });
      render(<CharBonusActions playerStats={stats} campaignName="test" />);
      if (shouldShow) {
        expect(screen.getByText(/Eat Bolstering Treat:/)).toBeInTheDocument();
      } else {
        expect(screen.queryByText(/Eat Bolstering Treat:/)).not.toBeInTheDocument();
      }
    });

    it('calls setTempHp and decrements treat count when clicked', async () => {
      useRuntimeValue.mockImplementation((name, key) => {
        if (key === 'bolsteringTreat') return 2;
        if (key === 'chefBolsteringTreats') return 0;
        if (key === 'activeBuffs') return null;
        if (key === 'poisonDoses') return 0;
        return null;
      });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'bolsteringTreat') return 2;
        return null;
      });
      const stats = createStats({ level: 5, abilities: [{ name: 'Wisdom', bonus: 3 }], bonusActions: [{ name: 'TestFeature', description: 'test' }] });
      render(<CharBonusActions playerStats={stats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Eat Bolstering Treat:/));
      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'bolsteringTreat', 1, 'test');
      });
    });

    it('does not call setTempHp when cannotAct is true', () => {
      useRuntimeValue.mockImplementation((name, key) => {
        if (key === 'bolsteringTreat') return 2;
        if (key === 'chefBolsteringTreats') return 0;
        if (key === 'activeBuffs') return null;
        if (key === 'poisonDoses') return 0;
        return null;
      });
      getRuntimeValue.mockReturnValue(null);
      const stats = createStats({ level: 5, bonusActions: [{ name: 'TestFeature', description: 'test' }] });
      render(<CharBonusActions playerStats={stats} campaignName="test" cannotAct={true} />);
      fireEvent.click(screen.getByText(/Eat Bolstering Treat:/));
      expect(vi.mocked(setTempHp)).not.toHaveBeenCalled();
    });
  });

  describe('apply poison', () => {
    const poisonStatsFactory = (poisonDoses) => {
      const stats = createStats({
        name: 'PoisonCharacter',
        abilities: [
          { name: 'Dexterity', bonus: 3 },
          { name: 'Intelligence', bonus: 1 },
        ],
        proficiency: 3,
        automation: { bonusActions: [{ type: 'apply_poison', name: 'Apply Poison' }] },
        bonusActions: [{ name: 'TestFeature', description: 'test' }],
      });
      useRuntimeValue.mockImplementation((name, key) => {
        if (key === 'poisonDoses') return poisonDoses;
        if (key === 'bolsteringTreat') return 0;
        if (key === 'chefBolsteringTreats') return 0;
        if (key === 'activeBuffs') return null;
        return null;
      });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'poisonDoses') return poisonDoses;
        return null;
      });
      return stats;
    };

    it.each([
      { label: 'hasApplyPoison and poisonDoses > 0', poisonDoses: 3, shouldShow: true },
      { label: 'poisonDoses is 0', poisonDoses: 0, shouldShow: false },
    ])('shows Apply Poison when $label', ({ poisonDoses, shouldShow }) => {
      const stats = poisonStatsFactory(poisonDoses);
      render(<CharBonusActions playerStats={stats} campaignName="test" />);
      if (shouldShow) {
        expect(screen.getByText(/Apply Poison:/)).toBeInTheDocument();
      } else {
        expect(screen.queryByText(/Apply Poison:/)).not.toBeInTheDocument();
      }
    });

    it('does not show Apply Poison when cannotAct is true', () => {
      const stats = poisonStatsFactory(3, false);
      render(<CharBonusActions playerStats={stats} campaignName="test" cannotAct={true} />);
      expect(screen.queryByText(/Apply Poison:/)).not.toBeInTheDocument();
    });

    it('decrements poisonDoses and sets poisonedWeaponsActive when clicked', async () => {
      const stats = poisonStatsFactory(2);
      render(<CharBonusActions playerStats={stats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Apply Poison:/));
      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('PoisonCharacter', 'poisonDoses', 1, 'test');
        expect(setRuntimeValue).toHaveBeenCalledWith('PoisonCharacter', 'poisonedWeaponsActive', true, 'test');
      });
    });

    it('logs apply poison entry', async () => {
      const stats = poisonStatsFactory(1);
      render(<CharBonusActions playerStats={stats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Apply Poison:/));
      await waitFor(() => {
        expect(addEntry).toHaveBeenCalledWith('test', expect.objectContaining({
          type: 'ability_use',
          abilityName: 'Apply Poison',
        }));
      });
    });
  });

  describe('sacred weapon buff on hit bonus', () => {
    const createBuffsMock = (hasSacredWeapon) => {
      return vi.fn((name, key) => {
        if (key === 'activeBuffs') return hasSacredWeapon ? [{ effect: 'sacred_weapon' }] : null;
        return null;
      });
    };

    const baseStats = {
      abilities: [{ name: 'Charisma', bonus: 4 }],
      exhaustionPenalty: 0,
    };

    it.each([
      { label: 'adds bonus for melee attacks', weaponType: 'melee', expectedHit: /\+9/, hasBuff: true },
      { label: 'does not add bonus for ranged attacks', weaponType: 'ranged', expectedHit: /\+5/, hasBuff: true },
      { label: 'adds bonus for unarmed attacks', weaponType: 'unarmed', expectedHit: /\+9/, hasBuff: true },
      { label: 'does not add bonus when buff is inactive', weaponType: 'melee', expectedHit: /\+5/, hasBuff: false },
    ])('sacred weapon $label', ({ weaponType, expectedHit, hasBuff }) => {
      getRuntimeValue.mockImplementation(createBuffsMock(hasBuff));
      const stats = createStats({
        ...baseStats,
        attacks: [{ name: 'Rapier', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Piercing', type: 'Bonus Action', weaponType }],
      });
      render(<CharBonusActions playerStats={stats} exhaustionPenalty={0} />);
      expect(screen.getByText(expectedHit)).toBeInTheDocument();
    });
  });

});
