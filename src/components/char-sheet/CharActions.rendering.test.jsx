import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';

vi.mock('../../hooks/useSpellMetamagicFlow.js', () => ({
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

vi.mock('../../hooks/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    buildUpcastLevels: vi.fn(() => []),
  })),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
  collectWeaponMastery: vi.fn(() => ({ baseMastery: null, extraMasteries: [] })),
  evaluateAutoExpression: vi.fn(() => null),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/automation/handlers/combat/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js', () => ({
  onSpellSelected: vi.fn(),
}));

vi.mock('../../hooks/useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 10),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn((_playerName, _campaignName) => ({ saveDcBonus: 0 })),
}));

vi.mock('../../hooks/useRuntimeState.js', () => ({
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

vi.mock('../../hooks/useActionPopup.js', () => ({
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

vi.mock('./EmpoweredSpellPopup.jsx', () => ({
  default: vi.fn((_props) => <div data-testid="empowered-spell-popup">EmpoweredSpellPopup</div>),
}));

vi.mock('./CharBonusActions.jsx', () => ({
  default: vi.fn((_props) => <div data-testid="char-bonus-actions">CharBonusActions</div>),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
  getCurrentCombatRound: vi.fn(() => 1),
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
}));

vi.mock('../../hooks/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    quickRollPlayerSave: vi.fn(),
    saveDcBonus: 0,
  })),
}));

vi.mock('../../hooks/useActionSpellMetamagic.js', () => ({
  useActionSpellMetamagic: vi.fn(() => ({
    pendingActionMetamagic: null,
    handleActionMetamagicConfirm: vi.fn(),
    handleActionMetamagicSkip: vi.fn(),
    handleActionSpellDamageClick: vi.fn(),
    handleSpellAttackClick: vi.fn(),
    handleSpellDamageClick: vi.fn(),
  })),
}));

const basePlayerStats = {
  name: 'TestCharacter',
  rules: '5e',
  level: 5,
  attacks: [],
  actions: [],
  spellAbilities: { spells: [] },
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

describe('CharActions rendering', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve([]),
    });
  });

  describe('section headers', () => {
    it('should render Actions header', async () => {
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('should render Base Actions section', async () => {
      const stats = createStats({ actions: [] });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Base Actions:')).toBeInTheDocument();
    });

    it('should render CharBonusActions child component', async () => {
      const stats = createStats({ bonusActions: [{ name: 'Cunning Action', description: 'Dash, Disengage, or Hide.' }] });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByTestId('char-bonus-actions')).toBeInTheDocument();
    });
  });

  describe('attack rendering', () => {
    it('should render attacks section with headers', async () => {
      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Range')).toBeInTheDocument();
      expect(screen.getByText('Hit')).toBeInTheDocument();
      expect(screen.getByText('Damage')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
    });

    it('should render attack name, range, damage, and damage type', async () => {
      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Longsword')).toBeInTheDocument();
      expect(screen.getByText('5 ft.')).toBeInTheDocument();
      expect(screen.getByText('1d8+3')).toBeInTheDocument();
      expect(screen.getByText('Slashing')).toBeInTheDocument();
    });

    it('should skip non-Action attacks', async () => {
      const stats = createStats({
        attacks: [{ name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.queryByText('Main Gauche')).not.toBeInTheDocument();
    });

    it('should skip Reaction attacks from action list', async () => {
      const stats = createStats({
        attacks: [{ name: 'Opportunity Attack', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Reaction' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.queryByText('Opportunity Attack')).not.toBeInTheDocument();
    });

    it('should show Mastery column for 2024 rules', async () => {
      const stats = createStats({
        rules: '2024',
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Mastery')).toBeInTheDocument();
    });

    it('should not show Mastery column for 5e rules', async () => {
      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.queryByText('Mastery')).not.toBeInTheDocument();
    });

    it('should apply mastery-enabled class for 2024 rules', async () => {
      const stats = createStats({
        rules: '2024',
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const attacksDiv = document.querySelector('.attacks.mastery-enabled');
      expect(attacksDiv).toBeInTheDocument();
    });
  });

  describe('hit bonus display', () => {
    it('should display hit bonus for attack without save DC', async () => {
      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} exhaustionPenalty={0} />); });
      expect(screen.getByText('+5')).toBeInTheDocument();
    });

    it('should apply exhaustion penalty to hit bonus', async () => {
      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} exhaustionPenalty={2} />); });
      expect(screen.getByText('+3')).toBeInTheDocument();
    });

    it('should show correct hit bonus with exhaustion penalty 3', async () => {
      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} exhaustionPenalty={3} />); });
      expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('should apply stat--penalized class when exhaustionPenalty > 0', async () => {
      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} exhaustionPenalty={2} />); });
      expect(document.querySelector('.stat--penalized')).toBeInTheDocument();
    });

    it('should apply stat--penalized class when conditionAttackMode is disadvantage', async () => {
      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} conditionAttackMode="disadvantage" exhaustionPenalty={0} />); });
      expect(document.querySelector('.stat--penalized')).toBeInTheDocument();
    });

    it('should not apply stat--penalized class when exhaustionPenalty is 0 and no disadvantage', async () => {
      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} exhaustionPenalty={0} />); });
      expect(document.querySelector('.stat--penalized')).not.toBeInTheDocument();
    });
  });

  describe('save DC display', () => {
    it('should display save DC instead of hit bonus when attack has saveDc', async () => {
      const stats = createStats({
        attacks: [{ name: 'Witch Bolt', range: 60, saveDc: 14, saveType: 'CON', damage: '1d12', damageType: 'Lightning', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText(/DC 14 CON/)).toBeInTheDocument();
    });

    it('should apply innate sorcery save DC bonus', async () => {
      const { getInnateSorceryBonus } = await import('../../services/combat/buffs/buffService.js');
      getInnateSorceryBonus.mockReturnValue({ saveDcBonus: 1 });
      const stats = createStats({
        attacks: [{ name: 'Witch Bolt', range: 60, saveDc: 14, saveType: 'CON', damage: '1d12', damageType: 'Lightning', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText(/DC 15 CON/)).toBeInTheDocument();
    });

    it('should render save DC display for action attacks with saveDc', async () => {
      const stats = createStats({
        attacks: [{ name: 'Witch Bolt', range: 60, saveDc: 13, saveType: 'STR', damage: '1d12', damageType: 'Lightning', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText(/DC 13 STR/)).toBeInTheDocument();
    });

    it('should render action attack with save DC correctly', async () => {
      const stats = createStats({
        attacks: [{ name: 'Witch Bolt', range: 60, saveDc: 13, saveType: 'STR', damage: '1d12', damageType: 'Lightning', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText(/DC 13 STR/)).toBeInTheDocument();
      expect(screen.getByText('1d12')).toBeInTheDocument();
      expect(screen.getByText('Lightning')).toBeInTheDocument();
    });

    it('should not show hit bonus for save-based spell attacks', async () => {
      const stats = createStats({
        attacks: [{ name: 'Witch Bolt', range: 60, saveDc: 13, saveType: 'STR', damage: '1d12', damageType: 'Lightning', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.queryByText('+5')).not.toBeInTheDocument();
    });
  });

  describe('action rendering', () => {
    it('should render action names from playerStats.actions', async () => {
      const stats = createStats({
        actions: [{ name: 'Second Wind', description: 'Regain hit points.', details: 'Heal 1d10+1 HP.' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText(/Second Wind:/)).toBeInTheDocument();
    });

    it('should render action descriptions with sanitized HTML', async () => {
      const stats = createStats({
        actions: [{ name: 'Second Wind', description: 'Regain hit points.', details: 'Heal 1d10+1 HP.' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const { sanitizeHtml } = await import('../../services/ui/sanitize.js');
      expect(sanitizeHtml).toHaveBeenCalledWith('Regain hit points.');
    });

    it('should sanitize HTML in action descriptions', async () => {
      const stats = createStats({
        actions: [{ name: 'XSS Test', description: '<script>alert("xss")</script>Test' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const { sanitizeHtml } = await import('../../services/ui/sanitize.js');
      expect(sanitizeHtml).toHaveBeenCalledWith('<script>alert("xss")</script>Test');
    });

    it('should render action as clickable when details exist', async () => {
      const stats = createStats({
        actions: [{ name: 'Second Wind', description: 'Regain hit points.', details: 'Heal 1d10+1 HP.' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText(/Second Wind:/)).toHaveClass('clickable');
    });

    it('should render action as clickable when it has automation', async () => {
      const { hasAutomation } = await import('../../services/combat/automation/automationService.js');
      hasAutomation.mockReturnValue(true);
      const stats = createStats({
        actions: [{ name: 'Rage', description: 'Enter a rage.', automation: { type: 'combat_stance' } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText(/Rage:/)).toHaveClass('clickable');
    });

    it('should not render action as clickable when no details and no automation', async () => {
      const stats = createStats({
        actions: [{ name: 'Simple Action', description: 'A simple action.' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText(/Simple Action:/)).not.toHaveClass('clickable');
    });

    it('should call buildFeatureDetailHtml when action with details is clicked', async () => {
      const stats = createStats({
        actions: [{ name: 'Test Feature', description: 'Test desc', details: 'Test details' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Test Feature:/);
      await act(async () => { fireEvent.click(actionName); });
      const { buildFeatureDetailHtml } = await import('../../hooks/useActionPopup.js');
      expect(buildFeatureDetailHtml).toHaveBeenCalledWith(stats.actions[0]);
    });
  });

  describe('automation badges', () => {
    it('should show save DC badge for automation with saveDc', async () => {
      const { hasAutomation } = await import('../../services/combat/automation/automationService.js');
      hasAutomation.mockImplementation((action) => action?.automation?.type === 'save_attack');
      const stats = createStats({
        actions: [{ name: 'Elemental Bane', description: 'Choose a creature.', automation: { type: 'save_attack', saveDc: 15, saveType: 'CON' } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('DC 15 CON')).toBeInTheDocument();
    });

    it('should show healing pool badge for healing_pool automation', async () => {
      const { hasAutomation } = await import('../../services/combat/automation/automationService.js');
      hasAutomation.mockImplementation((action) => action?.automation?.type === 'healing_pool');
      const stats = createStats({
        actions: [{ name: 'Life Stream', description: 'Heal a creature.', automation: { type: 'healing_pool', pool: 15 } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Pool: 15 HP')).toBeInTheDocument();
    });

    it('should show damage badge for automation with damage', async () => {
      const { hasAutomation } = await import('../../services/combat/automation/automationService.js');
      hasAutomation.mockImplementation((action) => action?.automation?.type === 'auto_effect');
      const stats = createStats({
        actions: [{ name: 'Thunderous Smite', description: 'Strike with thunder.', automation: { type: 'auto_effect', damage: '2d6', damageType: 'Thunder' } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('2d6 Thunder')).toBeInTheDocument();
    });
  });

  describe('metamagic display', () => {
    it('should display "Empowered Spell" for Metamagic action with spell_modifier automation', async () => {
      const stats = createStats({
        actions: [{ name: 'Metamagic', description: 'Modify spells.', automation: { type: 'spell_modifier' } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText(/Empowered Spell:/)).toBeInTheDocument();
    });
  });

  describe('rage expendable / restore', () => {
    it('should show Restore with Rage button when rage-expendable action is exhausted', async () => {
      const { hasAutomation } = await import('../../services/combat/automation/automationService.js');
      const { isExhausted } = await import('../../services/automation/handlers/combat/saveAttackHandler.js');
      hasAutomation.mockReturnValue(true);
      isExhausted.mockReturnValue(true);
      const stats = createStats({
        actions: [{ name: 'Rage', description: 'You enter a rage.', automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage' } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText(/Restore with Rage/)).toBeInTheDocument();
    });

    it('should not show Restore with Rage when not rage-expendable', async () => {
      const { hasAutomation } = await import('../../services/combat/automation/automationService.js');
      const { isExhausted } = await import('../../services/automation/handlers/combat/saveAttackHandler.js');
      hasAutomation.mockReturnValue(true);
      isExhausted.mockReturnValue(true);
      const stats = createStats({
        actions: [{ name: 'Channel Divinity', description: 'Channel divine energy.', automation: { type: 'auto_effect', recharge: 'long_rest' } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.queryByText(/Restore with Rage/)).not.toBeInTheDocument();
    });
  });

  describe('cannotAct styling', () => {
    it('should apply disabled-attack class when cannotAct is true', async () => {
      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} cannotAct={true} />); });
      expect(document.querySelector('.disabled-attack')).toBeInTheDocument();
    });

    it('should show Incapacitated label when cannotAct is true', async () => {
      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} cannotAct={true} />); });
      expect(screen.getByText('(Incapacitated)')).toBeInTheDocument();
    });
  });

  describe('empty/null safety', () => {
    it('should handle empty attacks array', async () => {
      const stats = createStats({ attacks: [] });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('should handle empty actions array', async () => {
      const stats = createStats({ actions: [] });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('should handle empty spellAbilities gracefully', async () => {
      const stats = createStats({ spellAbilities: { spells: [] } });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('should handle playerStats with undefined spellAbilities gracefully', async () => {
      const stats = createStats({ spellAbilities: undefined, attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }] });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Longsword')).toBeInTheDocument();
    });

    it('should render with empty attacks and actions', async () => {
      const stats = createStats({ attacks: [], actions: [], spellAbilities: { spells: [] } });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Actions')).toBeInTheDocument();
      expect(screen.getByText('Base Actions:')).toBeInTheDocument();
    });
  });

  describe('combined rendering', () => {
    it('should render action attacks, spells, and action features together', async () => {
      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
        actions: [{ name: 'Second Wind', description: 'Regain hit points.', details: 'Heal 1d10+1 HP.' }],
        spellAbilities: { spells: [{ name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Longsword')).toBeInTheDocument();
      expect(screen.getByText(/Second Wind:/)).toBeInTheDocument();
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });

    it('should render both action attacks and action features together', async () => {
      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
        actions: [{ name: 'Second Wind', description: 'Regain hit points.', details: 'Heal 1d10+1 HP.' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Longsword')).toBeInTheDocument();
      expect(screen.getByText(/Second Wind:/)).toBeInTheDocument();
    });
  });
});
