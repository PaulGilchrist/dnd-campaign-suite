// @cleaned-by-ai
import { render, screen } from '@testing-library/react';
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
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
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
  resolveSpellDamageAtLevel: vi.fn(() => '8d6'),
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

  describe('attack rendering', () => {
    const baseAttack = {
      name: 'Longsword',
      range: 5,
      hitBonus: 5,
      damage: '1d8+3',
      damageType: 'Slashing',
      type: 'Action',
    };

    it.each([
      [{ exhaustionPenalty: 0, hitBonus: 5, expected: '+5', penalized: false }, 'no penalty'],
      [{ exhaustionPenalty: 2, hitBonus: 5, expected: '+3', penalized: true }, 'exhaustion penalty'],
      [{ exhaustionPenalty: 4, hitBonus: 1, expected: '-3', penalized: true }, 'negative hit bonus'],
      [{ conditionAttackMode: 'disadvantage', hitBonus: 5, expected: '+5', penalized: true }, 'disadvantage'],
    ])('computes hit bonus correctly (%s)', (opts, _label) => {
      render(<CharActions playerStats={createStats({ attacks: [{ ...baseAttack, hitBonus: opts.hitBonus }] })} exhaustionPenalty={opts.exhaustionPenalty} conditionAttackMode={opts.conditionAttackMode} />);
      expect(screen.getByText(opts.expected)).toBeInTheDocument();
      if (opts.exhaustionPenalty > 0 || opts.conditionAttackMode === 'disadvantage') {
        expect(screen.getByText(opts.expected)).toHaveClass('stat--penalized');
      }
    });

    it('applies disabled-attack class and Incapacitated label when cannotAct is true', () => {
      render(<CharActions playerStats={createStats({ attacks: [baseAttack] })} cannotAct={true} />);
      expect(screen.getByText('+5')).toHaveClass('disabled-attack');
      expect(screen.getByText('(Incapacitated)')).toBeInTheDocument();
    });

    it('renders save DC display for save-based attacks', () => {
      const saveDcAttack = {
        name: 'Witch Bolt',
        range: 60,
        saveDc: 14,
        saveType: 'CON',
        damage: '1d12',
        damageType: 'Lightning',
        type: 'Action',
      };
      render(<CharActions playerStats={createStats({ attacks: [saveDcAttack] })} />);
      expect(screen.getByText(/DC 14 CON/)).toBeInTheDocument();
      expect(screen.getByText('1d12')).toBeInTheDocument();
      expect(screen.getByText('Lightning')).toBeInTheDocument();
    });

    it('renders save DC with different save types', () => {
      const saveDcAttack = {
        name: 'Witch Bolt',
        range: 60,
        saveDc: 13,
        saveType: 'STR',
        damage: '1d12',
        damageType: 'Thunder',
        type: 'Action',
      };
      render(<CharActions playerStats={createStats({ attacks: [saveDcAttack] })} />);
      expect(screen.getByText(/DC 13 STR/)).toBeInTheDocument();
    });

    it('shows Mastery column for 2024 rules but not 5e', () => {
      const baseAttack = {
        name: 'Longsword',
        range: 5,
        hitBonus: 5,
        damage: '1d8+3',
        damageType: 'Slashing',
        type: 'Action',
      };
      render(<CharActions playerStats={createStats({ rules: '2024', attacks: [baseAttack] })} />);
      expect(screen.getByText('Mastery')).toBeInTheDocument();
    });

    it('hides Mastery column for 5e rules', () => {
      const baseAttack = {
        name: 'Longsword',
        range: 5,
        hitBonus: 5,
        damage: '1d8+3',
        damageType: 'Slashing',
        type: 'Action',
      };
      render(<CharActions playerStats={createStats({ rules: '5e', attacks: [baseAttack] })} />);
      expect(screen.queryByText('Mastery')).not.toBeInTheDocument();
    });
  });

  describe('action feature rendering', () => {
    it('renders action name with colon suffix, description, and clickable class when it has details', () => {
      const stats = createStats({
        actions: [{ name: 'Second Wind', description: 'Regain hit points.', details: 'Heal 1d10+1 HP.' }],
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText(/Second Wind:/)).toBeInTheDocument();
      expect(screen.getByText('Regain hit points.')).toBeInTheDocument();
      expect(screen.getByText(/Second Wind:/)).toHaveClass('clickable');
    });

    it('renders action as clickable when it has automation', async () => {
      const { hasAutomation } = await import('../../services/combat/automation/automationService.js');
      hasAutomation.mockReturnValue(true);
      const stats = createStats({
        actions: [{ name: 'Berserker Rage', description: 'Enter a rage.', automation: { type: 'combat_stance' } }],
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

    it('shows automation badges for save_attack, healing_pool, and auto_effect types', async () => {
      const { hasAutomation } = await import('../../services/combat/automation/automationService.js');
      hasAutomation.mockImplementation((action) => !!action?.automation);

      const stats = createStats({
        actions: [
          { name: 'Elemental Bane', description: 'Choose a creature.', automation: { type: 'save_attack', saveDc: 15, saveType: 'CON' } },
          { name: 'Life Stream', description: 'Heal a creature.', automation: { type: 'healing_pool', pool: 15 } },
          { name: 'Thunderous Smite', description: 'Strike with thunder.', automation: { type: 'auto_effect', damage: '2d6', damageType: 'Thunder' } },
        ],
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText('DC 15 CON')).toBeInTheDocument();
      expect(screen.getByText('Pool: 15 HP')).toBeInTheDocument();
      expect(screen.getByText('2d6 Thunder')).toBeInTheDocument();
    });

    it('displays "Empowered Spell" for Metamagic action with spell_modifier automation', async () => {
      const { hasAutomation } = await import('../../services/combat/automation/automationService.js');
      hasAutomation.mockReturnValue(true);
      const stats = createStats({
        actions: [{ name: 'Metamagic', description: 'Modify spells.', automation: { type: 'spell_modifier' } }],
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText(/Empowered Spell:/)).toBeInTheDocument();
    });
  });

  describe('rage expendable / restore', () => {
    it('shows Restore with Rage button when rage-expendable action is exhausted', async () => {
      const { hasAutomation } = await import('../../services/combat/automation/automationService.js');
      const { isExhausted } = await import('../../services/automation/handlers/combat/saveAttackHandler.js');
      hasAutomation.mockReturnValue(true);
      isExhausted.mockReturnValue(true);
      const stats = createStats({
        actions: [{ name: 'Berserker Rage', description: 'You enter a rage.', automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage' } }],
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText(/Restore with Rage/)).toBeInTheDocument();
    });

    it('does not show Restore with Rage when not rage-expendable or not exhausted', async () => {
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
  });
});
