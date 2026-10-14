import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';

const _syncedStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getStore: vi.fn(() => _syncedStore),
  useSyncedState: vi.fn((_, key, defaultValue) => {
    const hasValue = _syncedStore.has(key);
    const value = hasValue ? _syncedStore.get(key) : defaultValue;
    const setter = vi.fn((newValue) => { _syncedStore.set(key, newValue); });
    return [value, setter];
  }),
  useRuntimeValue: vi.fn((_, key, _campaignName) => {
    const hasValue = _syncedStore.has(key);
    return hasValue ? _syncedStore.get(key) : null;
  }),
  listeners: new Map(),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null, setPopupHtml: vi.fn(), rollAttack: vi.fn(), rollDamage: vi.fn(),
    rollSkillCheck: vi.fn(), rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
  })),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
  collectWeaponMastery: vi.fn(() => ({ baseMastery: null, extraMasteries: [] })),
  evaluateAutoExpression: vi.fn(() => null),
}));

vi.mock('../../hooks/combat/useActionSpellMetamagic.js', () => ({
  useActionSpellMetamagic: vi.fn(() => ({
    pendingActionMetamagic: null, handleActionMetamagicConfirm: vi.fn(), handleActionMetamagicSkip: vi.fn(),
    handleActionSpellDamageClick: vi.fn(), handleSpellAttackClick: vi.fn(), handleSpellDamageClick: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn((entity) => {
    if (entity.details) return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    return null;
  }),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
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

vi.mock('../../services/automation/handlers/combat/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn(() => ({ saveDcBonus: 0 })),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
  getCurrentCombatRound: vi.fn(() => 1),
  getActiveCreatureName: vi.fn(() => 'TestCharacter'),
  loadCombatSummary: vi.fn(() => Promise.resolve({ lastAttack: null })),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve(null)),
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

vi.mock('../../services/rules/features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('./useInitiativeEffects.js', () => ({
  default: vi.fn(),
}));

vi.mock('./CharBonusActions.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-bonus-actions">CharBonusActions</div>),
}));

vi.mock('./CharActionModals.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-action-modals">CharActionModals</div>),
}));

vi.mock('./CharActionSpellPopups.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-action-spell-popups">CharActionSpellPopups</div>),
}));

vi.mock('./useCharActionModals.js', () => ({
  default: vi.fn(() => ({
    pendingDamage: null, modalState: {}, setModalState: vi.fn(),
    resolveAttackDamage: vi.fn(), handleMasteryClose: vi.fn(), handleWeaponMasteryChoice: vi.fn(),
    handleWeaponKindMasteryClose: vi.fn(), handleDivineFuryDamageType: vi.fn(), handleDivineFurySkip: vi.fn(),
    handleGenericDamageTypeChoice: vi.fn(), handleGenericDamageTypeSkip: vi.fn(),
    handleDamageTypeModifierChoice: vi.fn(), handleDamageTypeModifierSkip: vi.fn(),
    handleEnhancedUnarmedChoice: vi.fn(), handleEnhancedUnarmedSkip: vi.fn(),
    handleFeatureChoiceConfirm: vi.fn(), handleFeatureChoiceSkip: vi.fn(),
    handleConstellationSelect: vi.fn(),
    combatSuperiorityModal: null, setCombatSuperiorityModal: vi.fn(),
    handleCombatSuperiorityConfirm: vi.fn(), handleAttackRiderManeuverUse: vi.fn(), handleAttackRiderManeuverSkip: vi.fn(),
  })),
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="secondary-target-modal">SecondaryTargetModal</div>),
}));

vi.mock('./modals/TacticalMasterModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="tactical-master-modal">TacticalMasterModal</div>),
}));

vi.mock('../../services/automation/handlers/combat/weaponMasteryHandler.js', () => ({
  applyMasteryEffect: vi.fn(() => Promise.resolve()),
}));

vi.mock('./useAttackDamageResolution.js', () => ({
  normalizeAutoDamage: vi.fn((autoDamage) => ({ attack: autoDamage, ctxOverrides: {} })),
}));

vi.mock('../../services/automation/contextBuilder.js', () => ({
  buildAttackContext: vi.fn(() => Promise.resolve({ hitBonus: 5 })),
  buildAttackContextSync: vi.fn(() => ({ hitBonus: 5 })),
}));

const basePlayerStats = {
  name: 'TestCharacter', rules: '5e', level: 5, attacks: [], actions: [],
  spellAbilities: { spells: [], toHit: 5, saveDc: 13 },
  abilities: [{ name: 'STR', bonus: 3 }], proficiency: 3,
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

function mockRuntimeValues(buffs = [], conditions = []) {
  getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'activeBuffs') return buffs;
    if (key === 'hasteExtraActionUsed') return false;
    if (key === 'activeConditions') return conditions;
    return null;
  });
}

describe('CharActions sacred weapon and 2024 mastery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
    getRuntimeValue.mockImplementation(() => null);
    hasAutomation.mockImplementation(() => false);
  });

  describe('sacred weapon hit bonus calculation', () => {
    it('adds Charisma bonus to melee attack hit bonus when sacred weapon buff is active', async () => {
      mockRuntimeValues([{ effect: 'sacred_weapon' }]);

      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action', weaponType: 'melee' }],
        abilities: [
          { name: 'STR', bonus: 3 },
          { name: 'Charisma', bonus: 4 },
        ],
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });

      expect(screen.getByText('+9')).toBeInTheDocument();
    });

    it('does not add sacred weapon bonus for ranged attacks', async () => {
      mockRuntimeValues([{ effect: 'sacred_weapon' }]);

      const stats = createStats({
        attacks: [{ name: 'Shortbow', range: 80, hitBonus: 5, damage: '1d6+3', damageType: 'Piercing', type: 'Action', weaponType: 'ranged' }],
        abilities: [
          { name: 'DEX', bonus: 3 },
          { name: 'Charisma', bonus: 4 },
        ],
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });

      expect(screen.getByText('+5')).toBeInTheDocument();
    });

    it('does not add sacred weapon bonus when buff not active', async () => {
      mockRuntimeValues([], []);

      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action', weaponType: 'melee' }],
        abilities: [
          { name: 'STR', bonus: 3 },
          { name: 'Charisma', bonus: 4 },
        ],
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });

      expect(screen.getByText('+5')).toBeInTheDocument();
    });

    it('shows hit bonus title with sacred weapon breakdown when applicable', async () => {
      mockRuntimeValues([{ effect: 'sacred_weapon' }]);

      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action', weaponType: 'melee' }],
        abilities: [
          { name: 'STR', bonus: 3 },
          { name: 'Charisma', bonus: 4 },
        ],
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });

      const hitEl = screen.getByText('+9');
      expect(hitEl).toHaveAttribute('title', 'Base: +5, Sacred Weapon: +4');
    });

    it('uses minimum 1 for Charisma bonus in sacred weapon', async () => {
      mockRuntimeValues([{ effect: 'sacred_weapon' }]);

      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action', weaponType: 'melee' }],
        abilities: [
          { name: 'STR', bonus: 3 },
          { name: 'Charisma', bonus: -2 },
        ],
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });

      expect(screen.getByText('+6')).toBeInTheDocument();
    });

    it('computes effective hit with both sacred weapon and exhaustion penalty', async () => {
      mockRuntimeValues([{ effect: 'sacred_weapon' }]);

      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action', weaponType: 'melee' }],
        abilities: [
          { name: 'STR', bonus: 3 },
          { name: 'Charisma', bonus: 4 },
        ],
      });

      await act(async () => { render(<CharActions playerStats={stats} exhaustionPenalty={2} />); });

      // Base 5 + sacred weapon 4 = 9, minus exhaustion 2 = 7
      expect(screen.getByText('+7')).toBeInTheDocument();
    });
  });

  describe('2024 rules mastery column', () => {
    it('renders mastery column for 2024 rules attacks', async () => {
      mockRuntimeValues();

      const stats = createStats({
        rules: '2024',
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
        automation: { passives: [{ type: 'weapon_kind_mastery' }] },
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });

      expect(screen.getByText('Mastery')).toBeInTheDocument();
    });
  });

  describe('ability check for attacks with save DC', () => {
    it('shows save DC column instead of hit bonus for attacks with saveDc', async () => {
      mockRuntimeValues();

      const stats = createStats({
        attacks: [{ name: 'Witch Bolt', range: 60, saveDc: 14, saveType: 'CON', damage: '1d12', damageType: 'Lightning', type: 'Action' }],
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });

      expect(screen.getByText(/DC 14 CON/)).toBeInTheDocument();
      expect(screen.queryByText('+5')).not.toBeInTheDocument();
    });
  });

  describe('penalized stat classes', () => {
    const createStats = (overrides = {}) => ({
      ...basePlayerStats,
      attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      ...overrides,
    });

    const penalizedCases = [
      { name: 'exhaustionPenalty > 0', props: { exhaustionPenalty: 2 }, expectedText: '+3', expectedClass: 'stat--penalized' },
      { name: 'conditionAttackMode=disadvantage', props: { conditionAttackMode: 'disadvantage' }, expectedText: '+5', expectedClass: 'stat--penalized' },
    ];

    for (const { name, props, expectedText, expectedClass } of penalizedCases) {
      it(`applies ${expectedClass} when ${name}`, async () => {
        const stats = createStats(props);
        await act(async () => { render(<CharActions playerStats={stats} {...props} />); });
        expect(screen.getByText(expectedText)).toHaveClass(expectedClass);
      });
    }

    it('applies disabled-attack class when cannotAct is true', async () => {
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} cannotAct={true} />); });
      expect(screen.getByText('+5')).toHaveClass('disabled-attack');
    });

    it('applies both stat--penalized and disabled-attack classes when cannotAct and exhaustionPenalty', async () => {
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} cannotAct={true} exhaustionPenalty={2} />); });
      const cell = screen.getByText('+3');
      expect(cell).toHaveClass('stat--penalized');
      expect(cell).toHaveClass('disabled-attack');
    });

    it('applies stat--penalized when both exhaustionPenalty and conditionAttackMode are set', async () => {
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} exhaustionPenalty={1} conditionAttackMode="disadvantage" />); });
      expect(screen.getByText('+4')).toHaveClass('stat--penalized');
    });
  });
});
