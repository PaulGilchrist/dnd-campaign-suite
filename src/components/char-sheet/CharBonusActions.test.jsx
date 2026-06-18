// @improved-by-ai
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

vi.mock('./DiceRollResult.jsx', () => ({
  default: vi.fn((props) => <div data-testid="dice-roll-result">{props.name || 'DiceRollResult'}</div>),
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="metamagic-popup">{props.spell?.name || 'MetamagicPopup'}</div>),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="spell-detail-popup">{props.spell?.name || 'SpellDetailPopup'}</div>),
}));

import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';
import { isExhausted } from '../../services/automation/handlers/combat/saveAttackHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getInnateSorceryBonus } from '../../services/combat/buffs/buffService.js';
import { showWeaponMasteryPopup } from '../../hooks/combat/useActionPopup.js';
import { sanitizeHtml } from '../../services/ui/sanitize.js';

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

describe('CharBonusActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('section visibility', () => {
    it('returns null when there are no bonus actions, attacks, spells, or horde breaker', () => {
      const stats = createStats({
        bonusActions: [],
        attacks: [
          { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
        ],
        spellAbilities: { spells: [] },
      });

      const { container } = render(<CharBonusActions playerStats={stats} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders section when bonusActions array has entries', () => {
      const stats = createStats({
        bonusActions: [{ name: 'Cunning Action', description: 'Dash, Hide, or Disengage.' }],
      });

      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });

    it('renders section when bonus action attacks exist', () => {
      const stats = createStats({
        attacks: [{ name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' }],
      });

      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });

    it('renders section when bonus action spells exist', () => {
      const stats = createStats({
        spellAbilities: {
          spells: [{ name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' }],
        },
      });

      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });
  });

  describe('bonus action attacks rendering', () => {
    const bonusActionAttack = {
      name: 'Main Gauche',
      range: 5,
      hitBonus: 5,
      damage: '1d4+3',
      damageType: 'Piercing',
      type: 'Bonus Action',
    };

    function renderBonusActionAttack(overrides = {}) {
      const stats = createStats({ attacks: [{ ...bonusActionAttack, ...overrides }] });
      return render(<CharBonusActions playerStats={stats} exhaustionPenalty={0} />);
    }

    it('displays the attack name, range, damage, and damage type', () => {
      const { container } = renderBonusActionAttack();
      expect(screen.getByText('Main Gauche')).toBeInTheDocument();
      expect(screen.getByText('5 ft.')).toBeInTheDocument();
      expect(screen.getByText('1d4+3')).toBeInTheDocument();
      expect(screen.getByText('Piercing')).toBeInTheDocument();
      expect(container.querySelector('.stat--penalized')).not.toBeInTheDocument();
    });

    it('displays the hit bonus with a plus sign', () => {
      renderBonusActionAttack();
      expect(screen.getByText('+5')).toBeInTheDocument();
    });

    it('applies exhaustion penalty to hit bonus display', () => {
      render(<CharBonusActions playerStats={createStats({ attacks: [bonusActionAttack] })} exhaustionPenalty={3} />);
      expect(screen.getByText('+2')).toBeInTheDocument();
      expect(document.querySelector('.stat--penalized')).toBeInTheDocument();
    });

    it('applies stat--penalized class when exhaustionPenalty > 0', () => {
      renderBonusActionAttack();
      render(<CharBonusActions playerStats={createStats({ attacks: [bonusActionAttack] })} exhaustionPenalty={2} />);
      expect(document.querySelector('.stat--penalized')).toBeInTheDocument();
    });

    it('applies stat--penalized class when conditionAttackMode is disadvantage', () => {
      render(<CharBonusActions playerStats={createStats({ attacks: [bonusActionAttack] })} conditionAttackMode="disadvantage" exhaustionPenalty={0} />);
      expect(document.querySelector('.stat--penalized')).toBeInTheDocument();
    });

    it('applies disabled-attack class when cannotAct is true', () => {
      render(<CharBonusActions playerStats={createStats({ attacks: [bonusActionAttack] })} cannotAct />);
      expect(document.querySelector('.disabled-attack')).toBeInTheDocument();
    });

    it('does not call onDamageClick when cannotAct is true', () => {
      const mockOnDamageClick = vi.fn();
      render(<CharBonusActions playerStats={createStats({ attacks: [bonusActionAttack] })} cannotAct onDamageClick={mockOnDamageClick} />);
      const damageElement = screen.getByText('1d4+3');
      fireEvent.click(damageElement);
      expect(mockOnDamageClick).not.toHaveBeenCalled();
    });
  });

  describe('bonus action attacks with save DC', () => {
    const saveDcAttack = {
      name: 'Cone of Cold',
      range: 60,
      saveDc: 14,
      saveType: 'CON',
      damage: '8d8',
      damageType: 'Cold',
      type: 'Bonus Action',
    };

    it('displays save DC instead of hit bonus', () => {
      getInnateSorceryBonus.mockReturnValue({ saveDcBonus: 0 });
      render(<CharBonusActions playerStats={createStats({ attacks: [saveDcAttack] })} />);
      expect(screen.getByText('DC 14 CON')).toBeInTheDocument();
      expect(screen.queryByText('+5')).not.toBeInTheDocument();
    });

    it('applies innate sorcery save DC bonus', () => {
      getInnateSorceryBonus.mockReturnValue({ saveDcBonus: 1 });
      render(<CharBonusActions playerStats={createStats({ attacks: [saveDcAttack] })} />);
      expect(screen.getByText('DC 15 CON')).toBeInTheDocument();
    });

    it('displays save DC for witch bolt style attack', () => {
      getInnateSorceryBonus.mockReturnValue({ saveDcBonus: 0 });
      const witchBolt = { ...saveDcAttack, name: 'Witch Bolt', saveDc: 13, saveType: 'STR', damage: '1d12', damageType: 'Lightning' };
      render(<CharBonusActions playerStats={createStats({ attacks: [witchBolt] })} />);
      expect(screen.getByText('DC 13 STR')).toBeInTheDocument();
    });
  });

  describe('bonus action spells rendering', () => {
    const bonusActionSpell = { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' };

    it('displays the spell name and range', () => {
      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [bonusActionSpell] } })} />);
      expect(screen.getByText('Shocking Grasp')).toBeInTheDocument();
      expect(screen.getByText('Touch')).toBeInTheDocument();
    });

    it('shows Utility as the spell type', () => {
      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [bonusActionSpell] } })} />);
      expect(screen.getByText('Utility')).toBeInTheDocument();
    });

    it('excludes unprepared spells', () => {
      const unprepared = { ...bonusActionSpell, name: 'Unprepared Spell', prepared: 'Unprepared' };
      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [unprepared] } })} />);
      expect(screen.queryByText('Unprepared Spell')).not.toBeInTheDocument();
    });

    it('includes Always-prepared spells', () => {
      const always = { ...bonusActionSpell, name: 'Always Prepared', prepared: 'Always' };
      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [always] } })} />);
      expect(screen.getByText('Always Prepared')).toBeInTheDocument();
    });

    it('only includes spells with bonus action casting times', () => {
      const spells = [
        { ...bonusActionSpell, name: 'Action Spell', casting_time: '1 action' },
        { ...bonusActionSpell, name: 'Reaction Spell', casting_time: '1 reaction' },
        { ...bonusActionSpell, name: 'Bonus Action Spell', casting_time: '1 bonus action' },
      ];
      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells } })} />);
      expect(screen.getByText('Bonus Action Spell')).toBeInTheDocument();
      expect(screen.queryByText('Action Spell')).not.toBeInTheDocument();
      expect(screen.queryByText('Reaction Spell')).not.toBeInTheDocument();
    });

    it('includes capitalized Bonus Action casting time', () => {
      const spell = { ...bonusActionSpell, name: 'Capitalized Bonus', casting_time: '1 Bonus Action' };
      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [spell] } })} />);
      expect(screen.getByText('Capitalized Bonus')).toBeInTheDocument();
    });

    it('includes lowercase bonus action casting time', () => {
      const spell = { ...bonusActionSpell, name: 'Lowercase Bonus', casting_time: 'bonus action' };
      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [spell] } })} />);
      expect(screen.getByText('Lowercase Bonus')).toBeInTheDocument();
    });

    it('excludes spells that share names with attacks', () => {
      const spell = { ...bonusActionSpell };
      const attack = { ...spell, name: 'Shocking Grasp', range: 'Touch', hitBonus: 5, damage: '1d8+3', damageType: 'Lightning', type: 'Bonus Action' };
      render(<CharBonusActions playerStats={createStats({ attacks: [attack], spellAbilities: { spells: [spell] } })} />);
      expect(screen.getByText('Shocking Grasp')).toBeInTheDocument();
    });
  });

  describe('bonus action descriptions rendering', () => {
    const bonusActionDesc = {
      name: 'Cunning Action',
      description: 'You can take a bonus action.',
      details: 'Dash, Hide, or Disengage.',
    };

    it('displays the bonus action name with colon', () => {
      render(<CharBonusActions playerStats={createStats({ bonusActions: [bonusActionDesc] })} />);
      expect(screen.getByText(/Cunning Action:/)).toBeInTheDocument();
    });

    it('displays the bonus action description text', () => {
      render(<CharBonusActions playerStats={createStats({ bonusActions: [bonusActionDesc] })} />);
      expect(screen.getByText(/You can take a bonus action/)).toBeInTheDocument();
    });

    it('renders clickable when the bonus action has details', () => {
      render(<CharBonusActions playerStats={createStats({ bonusActions: [bonusActionDesc] })} />);
      expect(screen.getByText(/Cunning Action:/)).toHaveClass('clickable');
    });

    it('renders non-clickable when there are no details and no automation', () => {
      const simple = { name: 'Simple Bonus', description: 'A simple bonus action without details.' };
      render(<CharBonusActions playerStats={createStats({ bonusActions: [simple] })} />);
      expect(screen.getByText(/Simple Bonus:/)).not.toHaveClass('clickable');
    });

    it('sanitizes HTML in descriptions', () => {
      const xss = { name: 'XSS Test', description: '<script>alert("xss")</script>Test' };
      render(<CharBonusActions playerStats={createStats({ bonusActions: [xss] })} />);
      expect(sanitizeHtml).toHaveBeenCalledWith('<script>alert("xss")</script>Test');
    });
  });

  describe('bonus action click behavior', () => {
    it('opens a popup when a bonus action with details is clicked', async () => {
      const stats = createStats({
        bonusActions: [{ name: 'Test Feature', description: 'Test description', details: 'Test details' }],
      });

      render(<CharBonusActions playerStats={stats} />);
      const actionName = screen.getByText(/Test Feature:/);
      fireEvent.click(actionName);

      await waitFor(() => {
        expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
      });
    });

    it('dismisses the popup when the overlay is clicked', async () => {
      const stats = createStats({
        bonusActions: [{ name: 'Dismiss Test', description: 'Test', details: 'Details' }],
      });

      render(<CharBonusActions playerStats={stats} />);
      const actionName = screen.getByText(/Dismiss Test:/);
      fireEvent.click(actionName);

      await waitFor(() => {
        expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
      });

      const popupOverlay = screen.getByTestId('popup-overlay');
      fireEvent.click(popupOverlay);

      expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
    });
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

    it('does not call onAutomationAction when the bonus action is exhausted', () => {
      hasAutomation.mockReturnValue(true);
      isExhausted.mockReturnValue(true);
      const onAutomationAction = vi.fn();
      const rageAction = {
        ...automatedBonusAction,
        name: 'Rage',
        description: 'You enter a rage.',
        automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage' },
      };
      render(<CharBonusActions playerStats={createStats({ bonusActions: [rageAction] })} onAutomationAction={onAutomationAction} />);
      const actionName = screen.getByText(/Rage:/);
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

    it('shows damage badge for automation with damage', () => {
      hasAutomation.mockImplementation((feature) => feature?.automation?.type === 'auto_effect');
      const stats = createStats({
        bonusActions: [{ name: 'Thunderous Smite', description: 'Strike with thunderous force.', automation: { type: 'auto_effect', damage: '2d6', damageType: 'Thunder' } }],
      });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText(/2d6 Thunder/)).toBeInTheDocument();
    });
  });

  describe('rage expendable features', () => {
    const rageBonusAction = {
      name: 'Rage',
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
        name: 'Channel Divinity',
        description: 'You channel divine energy.',
        automation: { type: 'auto_effect', recharge: 'long_rest' },
      };
      render(<CharBonusActions playerStats={createStats({ bonusActions: [nonRage] })} />);
      expect(screen.queryByText(/Restore with Rage/)).not.toBeInTheDocument();
    });

    it('restores rage and shows confirmation popup when Restore with Rage is clicked', async () => {
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

    it('shows error popup when no rage remaining to restore', async () => {
      hasAutomation.mockReturnValue(true);
      isExhausted.mockReturnValue(true);
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'ragePoints') return 0;
        return null;
      });

      render(<CharBonusActions playerStats={createStats({ bonusActions: [rageBonusAction] })} />);
      const restoreBtn = screen.getByText(/Restore with Rage/);
      fireEvent.click(restoreBtn);

      await waitFor(() => {
        expect(screen.getByText(/No Rage remaining/)).toBeInTheDocument();
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

    it('calls onDamageClick when damage is clicked', () => {
      const mockOnDamageClick = vi.fn();
      render(<CharBonusActions playerStats={createStats({ attacks: [bonusActionAttack] })} onDamageClick={mockOnDamageClick} />);
      const damageElement = screen.getByText('1d4+3');
      fireEvent.click(damageElement);
      expect(mockOnDamageClick).toHaveBeenCalledWith(bonusActionAttack);
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

    it('closes the spell detail popup when the overlay is clicked', async () => {
      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [bonusActionSpell] } })} />);
      const spellLink = screen.getByText('Shocking Grasp');
      fireEvent.click(spellLink);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();

      const popupOverlay = screen.getByTestId('popup-overlay');
      fireEvent.click(popupOverlay);

      expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
    });
  });

  describe('metamagic popup', () => {
    it('renders MetamagicPopup when pendingMetamagic is set', () => {
      useSpellMetamagicFlow.mockReturnValue({
        pendingMetamagic: { spellName: 'Fireball', spellLevel: 3, _currentSP: 5 },
        gateMetamagic: vi.fn(),
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
        pendingAid: null,
        handleAidConfirm: vi.fn(),
        handleAidSkip: vi.fn(),
        pendingGreaterRestoration: null,
        handleGreaterRestorationConfirm: vi.fn(),
        handleGreaterRestorationSkip: vi.fn(),
      });

      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [{ name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' }] } })} />);
      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
    });
  });

  describe('2024 rules rendering', () => {
    const bonusActionAttack = { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' };

    it('shows Mastery column header for 2024 rules with bonus action attacks', () => {
      render(<CharBonusActions playerStats={createStats({ rules: '2024', attacks: [bonusActionAttack] })} getWeaponMastery={() => null} />);
      const masteryHeaders = document.querySelectorAll('div b');
      const hasMasteryHeader = Array.from(masteryHeaders).some(el => el.textContent === 'Mastery');
      expect(hasMasteryHeader).toBe(true);
    });

    it('applies mastery-enabled class for 2024 rules', () => {
      render(<CharBonusActions playerStats={createStats({ rules: '2024', attacks: [bonusActionAttack] })} getWeaponMastery={() => null} />);
      expect(document.querySelector('.attacks.mastery-enabled')).toBeInTheDocument();
    });

    it('does not show Mastery column for 5e rules', () => {
      render(<CharBonusActions playerStats={createStats({ attacks: [bonusActionAttack] })} />);
      expect(screen.queryAllByText('Mastery')).toHaveLength(0);
    });

    it('does not show Mastery column for 2024 rules when there are no bonus action attacks', () => {
      render(<CharBonusActions playerStats={createStats({ rules: '2024', spellAbilities: { spells: [{ name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' }] } })} getWeaponMastery={() => null} />);
      const masteryHeaders = document.querySelectorAll('div b');
      const hasMasteryHeader = Array.from(masteryHeaders).some(el => el.textContent === 'Mastery');
      expect(hasMasteryHeader).toBe(false);
    });

    it('opens weapon mastery popup when a mastery cell is clicked', () => {
      const mockGetWeaponMastery = vi.fn(() => 'Piercing');
      render(<CharBonusActions playerStats={createStats({ rules: '2024', attacks: [bonusActionAttack] })} getWeaponMastery={mockGetWeaponMastery} />);
      const masteryCells = document.querySelectorAll('div.clickable');
      const lastMasteryCell = masteryCells[masteryCells.length - 1];
      fireEvent.click(lastMasteryCell);
      expect(showWeaponMasteryPopup).toHaveBeenCalledWith('Piercing', expect.any(Function));
    });
  });

  describe('section structure', () => {
    it('renders a horizontal rule before the Bonus Actions section', () => {
      render(<CharBonusActions playerStats={createStats({ bonusActions: [{ name: 'Test', description: 'Test desc', details: 'Test details' }] })} />);
      expect(document.querySelector('hr')).toBeInTheDocument();
    });

    it('renders Bonus Actions text with sectionHeader class', () => {
      render(<CharBonusActions playerStats={createStats({ bonusActions: [{ name: 'Test', description: 'Test desc', details: 'Test details' }] })} />);
      expect(screen.getByText('Bonus Actions')).toHaveClass('sectionHeader');
    });
  });

  describe('combined content rendering', () => {
    it('renders both bonus action attacks and bonus action descriptions together', () => {
      const stats = createStats({
        attacks: [{ name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' }],
        bonusActions: [{ name: 'Cunning Action', description: 'You can take a bonus action.', details: 'Dash, Hide, or Disengage.' }],
      });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Main Gauche')).toBeInTheDocument();
      expect(screen.getByText(/Cunning Action:/)).toBeInTheDocument();
    });

    it('renders both bonus action attacks and bonus action spells together', () => {
      const stats = createStats({
        attacks: [{ name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' }],
        spellAbilities: { spells: [{ name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' }] },
      });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Main Gauche')).toBeInTheDocument();
      expect(screen.getByText('Shocking Grasp')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles playerStats with undefined spellAbilities gracefully', () => {
      const stats = createStats({
        spellAbilities: undefined,
        attacks: [{ name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' }],
      });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Main Gauche')).toBeInTheDocument();
    });
  });
});
