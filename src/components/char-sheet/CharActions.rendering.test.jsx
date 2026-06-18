// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';

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
    pendingRemoveCurse: null,
    handleRemoveCurseConfirm: vi.fn(),
    handleRemoveCurseSkip: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
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

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    quickRollPlayerSave: vi.fn(),
    saveDcBonus: 0,
  })),
}));

vi.mock('../../hooks/combat/useActionSpellMetamagic.js', () => ({
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

  describe('section headers and structure', () => {
    it('renders the Actions section header', () => {
      render(<CharActions playerStats={createStats()} />);
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('renders Base Actions section with empty actions list', () => {
      render(<CharActions playerStats={createStats({ actions: [] })} />);
      expect(screen.getByText('Base Actions:')).toBeInTheDocument();
    });

    it('renders CharBonusActions child component', () => {
      render(<CharActions playerStats={createStats({ bonusActions: [{ name: 'Cunning Action', description: 'Dash, Disengage, or Hide.' }] })} />);
      expect(screen.getByTestId('char-bonus-actions')).toBeInTheDocument();
    });

    it('renders column headers for attacks table', () => {
      render(<CharActions playerStats={createStats({ attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }] })} />);
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Range')).toBeInTheDocument();
      expect(screen.getByText('Hit')).toBeInTheDocument();
      expect(screen.getByText('Damage')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
    });
  });

  describe('attack rendering', () => {
    const baseAttack = {
      name: 'Longsword',
      range: 5,
      hitBonus: 5,
      damage: '1d8+3',
      damageType: 'Slashing',
      type: 'Action',
    };

    it('renders attack name, range, damage formula, and damage type', () => {
      render(<CharActions playerStats={createStats({ attacks: [baseAttack] })} />);
      expect(screen.getByText('Longsword')).toBeInTheDocument();
      expect(screen.getByText('5 ft.')).toBeInTheDocument();
      expect(screen.getByText('1d8+3')).toBeInTheDocument();
      expect(screen.getByText('Slashing')).toBeInTheDocument();
    });

    it('filters out non-Action type attacks from the list', () => {
      render(<CharActions playerStats={createStats({ attacks: [{ ...baseAttack, type: 'Bonus Action', name: 'Main Gauche' }] })} />);
      expect(screen.queryByText('Main Gauche')).not.toBeInTheDocument();
    });

    it('filters out Reaction type attacks from the list', () => {
      render(<CharActions playerStats={createStats({ attacks: [{ ...baseAttack, type: 'Reaction', name: 'Opportunity Attack' }] })} />);
      expect(screen.queryByText('Opportunity Attack')).not.toBeInTheDocument();
    });

    it('renders both Action and non-Action attacks in stats without filtering in the data layer', () => {
      // Verify that the component receives all attacks but only renders Action-type
      const stats = createStats({
        attacks: [
          { ...baseAttack },
          { ...baseAttack, type: 'Bonus Action', name: 'Secondary' },
        ],
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText('Longsword')).toBeInTheDocument();
      expect(screen.queryByText('Secondary')).not.toBeInTheDocument();
    });

    it('renders empty attacks list without crashing', () => {
      render(<CharActions playerStats={createStats({ attacks: [] })} />);
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });

  describe('hit bonus display', () => {
    const baseAttack = {
      name: 'Longsword',
      range: 5,
      hitBonus: 5,
      damage: '1d8+3',
      damageType: 'Slashing',
      type: 'Action',
    };

    it('displays the hit bonus value with sign prefix', () => {
      render(<CharActions playerStats={createStats({ attacks: [baseAttack] })} />);
      expect(screen.getByText('+5')).toBeInTheDocument();
    });

    it('subtracts exhaustion penalty from hit bonus', () => {
      render(<CharActions playerStats={createStats({ attacks: [baseAttack] })} exhaustionPenalty={2} />);
      expect(screen.getByText('+3')).toBeInTheDocument();
    });

    it('subtracts exhaustion penalty of 3 from hit bonus', () => {
      render(<CharActions playerStats={createStats({ attacks: [baseAttack] })} exhaustionPenalty={3} />);
      expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('applies stat--penalized class when exhaustionPenalty is greater than zero', () => {
      render(<CharActions playerStats={createStats({ attacks: [baseAttack] })} exhaustionPenalty={2} />);
      expect(document.querySelector('.stat--penalized')).toBeInTheDocument();
    });

    it('applies stat--penalized class when conditionAttackMode is disadvantage', () => {
      render(<CharActions playerStats={createStats({ attacks: [baseAttack] })} conditionAttackMode="disadvantage" exhaustionPenalty={0} />);
      expect(document.querySelector('.stat--penalized')).toBeInTheDocument();
    });

    it('does not apply stat--penalized class when exhaustionPenalty is zero and no disadvantage', () => {
      render(<CharActions playerStats={createStats({ attacks: [baseAttack] })} exhaustionPenalty={0} />);
      expect(document.querySelector('.stat--penalized')).not.toBeInTheDocument();
    });

    it('applies stat--penalized class when cannotAct is true', () => {
      render(<CharActions playerStats={createStats({ attacks: [baseAttack] })} cannotAct={true} />);
      expect(document.querySelector('.stat--penalized')).toBeInTheDocument();
    });

    it('computes negative hit bonus correctly with high exhaustion', () => {
      render(<CharActions playerStats={createStats({ attacks: [{ ...baseAttack, hitBonus: 1 }] })} exhaustionPenalty={4} />);
      expect(screen.getByText('-3')).toBeInTheDocument();
    });
  });

  describe('save DC display', () => {
    const saveDcAttack = {
      name: 'Witch Bolt',
      range: 60,
      saveDc: 14,
      saveType: 'CON',
      damage: '1d12',
      damageType: 'Lightning',
      type: 'Action',
    };

    it('displays save DC in DC X TYPE format', () => {
      render(<CharActions playerStats={createStats({ attacks: [saveDcAttack] })} />);
      expect(screen.getByText(/DC 14 CON/)).toBeInTheDocument();
    });

    it('does not display hit bonus column for save-based attacks', () => {
      render(<CharActions playerStats={createStats({ attacks: [saveDcAttack] })} />);
      expect(screen.queryByText('+5')).not.toBeInTheDocument();
    });

    it('displays damage and damage type for save-based attacks', () => {
      render(<CharActions playerStats={createStats({ attacks: [saveDcAttack] })} />);
      expect(screen.getByText('1d12')).toBeInTheDocument();
      expect(screen.getByText('Lightning')).toBeInTheDocument();
    });

    it('renders save DC for different save types', () => {
      render(<CharActions playerStats={createStats({ attacks: [{ ...saveDcAttack, saveDc: 13, saveType: 'STR' }] })} />);
      expect(screen.getByText(/DC 13 STR/)).toBeInTheDocument();
    });
  });

  describe('2024 rules mastery column', () => {
    const baseAttack = {
      name: 'Longsword',
      range: 5,
      hitBonus: 5,
      damage: '1d8+3',
      damageType: 'Slashing',
      type: 'Action',
    };

    it('shows Mastery column header for 2024 rules', () => {
      render(<CharActions playerStats={createStats({ rules: '2024', attacks: [baseAttack] })} />);
      expect(screen.getByText('Mastery')).toBeInTheDocument();
    });

    it('does not show Mastery column header for 5e rules', () => {
      render(<CharActions playerStats={createStats({ rules: '5e', attacks: [baseAttack] })} />);
      expect(screen.queryByText('Mastery')).not.toBeInTheDocument();
    });

    it('adds mastery-enabled class to attacks container for 2024 rules', () => {
      render(<CharActions playerStats={createStats({ rules: '2024', attacks: [baseAttack] })} />);
      expect(document.querySelector('.attacks.mastery-enabled')).toBeInTheDocument();
    });

    it('does not add mastery-enabled class for 5e rules', () => {
      render(<CharActions playerStats={createStats({ rules: '5e', attacks: [baseAttack] })} />);
      expect(document.querySelector('.attacks.mastery-enabled')).not.toBeInTheDocument();
    });
  });

  describe('cannotAct disabled state', () => {
    const baseAttack = {
      name: 'Longsword',
      range: 5,
      hitBonus: 5,
      damage: '1d8+3',
      damageType: 'Slashing',
      type: 'Action',
    };

    it('applies disabled-attack class when cannotAct is true', () => {
      render(<CharActions playerStats={createStats({ attacks: [baseAttack] })} cannotAct={true} />);
      expect(document.querySelector('.disabled-attack')).toBeInTheDocument();
    });

    it('renders Incapacitated label when cannotAct is true', () => {
      render(<CharActions playerStats={createStats({ attacks: [baseAttack] })} cannotAct={true} />);
      expect(screen.getByText('(Incapacitated)')).toBeInTheDocument();
    });

    it('does not show Incapacitated label when cannotAct is false', () => {
      render(<CharActions playerStats={createStats({ attacks: [baseAttack] })} cannotAct={false} />);
      expect(screen.queryByText('(Incapacitated)')).not.toBeInTheDocument();
    });

    it('does not show Incapacitated label when cannotAct is undefined', () => {
      render(<CharActions playerStats={createStats({ attacks: [baseAttack] })} />);
      expect(screen.queryByText('(Incapacitated)')).not.toBeInTheDocument();
    });
  });

  describe('action feature rendering', () => {
    it('renders action name with colon suffix', () => {
      const stats = createStats({
        actions: [{ name: 'Second Wind', description: 'Regain hit points.', details: 'Heal 1d10+1 HP.' }],
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText(/Second Wind:/)).toBeInTheDocument();
    });

    it('renders action description via dangerouslySetInnerHTML', () => {
      const stats = createStats({
        actions: [{ name: 'Second Wind', description: 'Regain hit points.', details: 'Heal 1d10+1 HP.' }],
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText('Regain hit points.')).toBeInTheDocument();
    });

    it('calls sanitizeHtml with the action description', async () => {
      const stats = createStats({
        actions: [{ name: 'Second Wind', description: 'Regain hit points.', details: 'Heal 1d10+1 HP.' }],
      });
      render(<CharActions playerStats={stats} />);
      const { sanitizeHtml } = await import('../../services/ui/sanitize.js');
      expect(sanitizeHtml).toHaveBeenCalledWith('Regain hit points.');
    });

    it('sanitizes XSS in action descriptions', async () => {
      const stats = createStats({
        actions: [{ name: 'XSS Test', description: '<script>alert("xss")</script>Test' }],
      });
      render(<CharActions playerStats={stats} />);
      const { sanitizeHtml } = await import('../../services/ui/sanitize.js');
      expect(sanitizeHtml).toHaveBeenCalledWith('<script>alert("xss")</script>Test');
    });

    it('does not render feature actions when actions array is empty', () => {
      render(<CharActions playerStats={createStats({ actions: [] })} />);
      expect(screen.queryByText(/Second Wind:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Rage:/)).not.toBeInTheDocument();
    });

    it('does not crash when spellAbilities is undefined', () => {
      render(<CharActions playerStats={createStats({ spellAbilities: undefined, attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }] })} />);
      expect(screen.getByText('Longsword')).toBeInTheDocument();
    });
  });

  describe('action clickable behavior', () => {
    it('renders action as clickable when it has details', () => {
      const stats = createStats({
        actions: [{ name: 'Second Wind', description: 'Regain hit points.', details: 'Heal 1d10+1 HP.' }],
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText(/Second Wind:/)).toHaveClass('clickable');
    });

    it('renders action as clickable when it has automation', async () => {
      const { hasAutomation } = await import('../../services/combat/automation/automationService.js');
      hasAutomation.mockReturnValue(true);
      const stats = createStats({
        actions: [{ name: 'Rage', description: 'Enter a rage.', automation: { type: 'combat_stance' } }],
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText(/Rage:/)).toHaveClass('clickable');
    });

    it('does not render action as clickable when it has no details and no automation', () => {
      const stats = createStats({
        actions: [{ name: 'Simple Action', description: 'A simple action.' }],
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText(/Simple Action:/)).not.toHaveClass('clickable');
    });

    it('calls buildFeatureDetailHtml when a clickable action with details is clicked', async () => {
      const stats = createStats({
        actions: [{ name: 'Test Feature', description: 'Test desc', details: 'Test details' }],
      });
      render(<CharActions playerStats={stats} />);
      const actionName = screen.getByText(/Test Feature:/);
      fireEvent.click(actionName);
      const { buildFeatureDetailHtml } = await import('../../hooks/combat/useActionPopup.js');
      expect(buildFeatureDetailHtml).toHaveBeenCalledWith(stats.actions[0]);
    });
  });

  describe('automation badges', () => {
    it('shows save DC badge for save_attack automation', async () => {
      const { hasAutomation } = await import('../../services/combat/automation/automationService.js');
      hasAutomation.mockImplementation((action) => action?.automation?.type === 'save_attack');
      const stats = createStats({
        actions: [{ name: 'Elemental Bane', description: 'Choose a creature.', automation: { type: 'save_attack', saveDc: 15, saveType: 'CON' } }],
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText('DC 15 CON')).toBeInTheDocument();
    });

    it('shows healing pool badge for healing_pool automation', async () => {
      const { hasAutomation } = await import('../../services/combat/automation/automationService.js');
      hasAutomation.mockImplementation((action) => action?.automation?.type === 'healing_pool');
      const stats = createStats({
        actions: [{ name: 'Life Stream', description: 'Heal a creature.', automation: { type: 'healing_pool', pool: 15 } }],
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText('Pool: 15 HP')).toBeInTheDocument();
    });

    it('shows damage badge for auto_effect automation with damage', async () => {
      const { hasAutomation } = await import('../../services/combat/automation/automationService.js');
      hasAutomation.mockImplementation((action) => action?.automation?.type === 'auto_effect');
      const stats = createStats({
        actions: [{ name: 'Thunderous Smite', description: 'Strike with thunder.', automation: { type: 'auto_effect', damage: '2d6', damageType: 'Thunder' } }],
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText('2d6 Thunder')).toBeInTheDocument();
    });

    it('does not show automation badges when hasAutomation returns false', async () => {
      const { hasAutomation } = await import('../../services/combat/automation/automationService.js');
      hasAutomation.mockReturnValue(false);
      const stats = createStats({
        actions: [{ name: 'Elemental Bane', description: 'Choose a creature.', automation: { type: 'save_attack', saveDc: 15, saveType: 'CON' } }],
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.queryByText('DC 15 CON')).not.toBeInTheDocument();
    });
  });

  describe('metamagic action display', () => {
    it('displays "Empowered Spell" for Metamagic action with spell_modifier automation', () => {
      const stats = createStats({
        actions: [{ name: 'Metamagic', description: 'Modify spells.', automation: { type: 'spell_modifier' } }],
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText(/Empowered Spell:/)).toBeInTheDocument();
    });

    it('does not rename non-Metamagic actions', () => {
      const stats = createStats({
        actions: [{ name: 'Rage', description: 'Enter a rage.', automation: { type: 'combat_stance' } }],
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText(/Rage:/)).toBeInTheDocument();
      expect(screen.queryByText(/Empowered Spell:/)).not.toBeInTheDocument();
    });
  });

  describe('rage expendable / restore', () => {
    it('shows Restore with Rage button when rage-expendable action is exhausted', async () => {
      const { hasAutomation } = await import('../../services/combat/automation/automationService.js');
      const { isExhausted } = await import('../../services/automation/handlers/combat/saveAttackHandler.js');
      hasAutomation.mockReturnValue(true);
      isExhausted.mockReturnValue(true);
      const stats = createStats({
        actions: [{ name: 'Rage', description: 'You enter a rage.', automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage' } }],
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText(/Restore with Rage/)).toBeInTheDocument();
    });

    it('does not show Restore with Rage when not rage-expendable', async () => {
      const { hasAutomation } = await import('../../services/combat/automation/automationService.js');
      const { isExhausted } = await import('../../services/automation/handlers/combat/saveAttackHandler.js');
      hasAutomation.mockReturnValue(true);
      isExhausted.mockReturnValue(true);
      const stats = createStats({
        actions: [{ name: 'Channel Divinity', description: 'Channel divine energy.', automation: { type: 'auto_effect', recharge: 'long_rest' } }],
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.queryByText(/Restore with Rage/)).not.toBeInTheDocument();
    });

    it('does not show Restore with Rage when not exhausted', async () => {
      const { hasAutomation } = await import('../../services/combat/automation/automationService.js');
      const { isExhausted } = await import('../../services/automation/handlers/combat/saveAttackHandler.js');
      hasAutomation.mockReturnValue(true);
      isExhausted.mockReturnValue(false);
      const stats = createStats({
        actions: [{ name: 'Rage', description: 'You enter a rage.', automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage' } }],
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.queryByText(/Restore with Rage/)).not.toBeInTheDocument();
    });
  });

  describe('combined rendering', () => {
    it('renders attacks, actions, and spells together', () => {
      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
        actions: [{ name: 'Second Wind', description: 'Regain hit points.', details: 'Heal 1d10+1 HP.' }],
        spellAbilities: { spells: [{ name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' }] },
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText('Longsword')).toBeInTheDocument();
      expect(screen.getByText(/Second Wind:/)).toBeInTheDocument();
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });

    it('renders both action attacks and action features together', () => {
      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
        actions: [{ name: 'Second Wind', description: 'Regain hit points.', details: 'Heal 1d10+1 HP.' }],
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText('Longsword')).toBeInTheDocument();
      expect(screen.getByText(/Second Wind:/)).toBeInTheDocument();
    });

    it('renders all three sections with empty arrays gracefully', () => {
      const stats = createStats({ attacks: [], actions: [], spellAbilities: { spells: [] } });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText('Actions')).toBeInTheDocument();
      expect(screen.getByText('Base Actions:')).toBeInTheDocument();
    });

    it('renders attack and spell with same name prioritizes attack', () => {
      const stats = createStats({
        attacks: [{ name: 'Fireball', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Fire', type: 'Action' }],
        spellAbilities: { spells: [{ name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' }] },
      });
      render(<CharActions playerStats={stats} />);
      // Attack should appear in the attacks table
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });
  });
});
