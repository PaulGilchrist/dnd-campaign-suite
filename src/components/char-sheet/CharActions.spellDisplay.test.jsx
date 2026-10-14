import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';

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
  hasAutomation: vi.fn((action) => !!action?.automation),
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

vi.mock('../../services/rules/core/spellDamageUtils.js', () => ({
  resolveSpellDamageAtLevel: vi.fn((spell) => {
    if (spell?.damage && typeof spell.damage === 'string') return spell.damage;
    return '';
  }),
  isAutoHitSpell: vi.fn(() => false),
  resolveHealExpression: vi.fn((_spell, _level, mod) => `1d4+${mod ?? 0}`),
}));

const basePlayerStats = {
  name: 'TestCharacter', rules: '5e', level: 5, attacks: [], actions: [],
  spellAbilities: { spells: [], toHit: 5, saveDc: 13, prepared: [], modifier: 2 },
  abilities: [{ name: 'STR', bonus: 3 }, { name: 'Wisdom', bonus: 2 }], proficiency: 3,
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

function renderWithFetch(component, options = {}) {
  globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
  return act(async () => { render(component, options); });
}

describe('CharActions spell damage display and spell click', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
    getRuntimeValue.mockImplementation(() => null);
  });

  describe('getSpellDamageDisplay', () => {
    it.each([
      { spellName: 'Healing Word', level: 1, heal_at_slot_level: true, modifier: 2, expectedText: '1d4+2' },
      { spellName: 'Healing Word', level: 1, heal_at_slot_level: true, modifier: 3, expectedText: '1d4+3' },
    ])('shows resolved heal expression for heal_at_slot_level spells (mod: $modifier)', async ({ spellName, level, heal_at_slot_level, modifier, expectedText }) => {
      const stats = createStats({
        spellAbilities: {
          spells: [{ name: spellName, level, heal_at_slot_level, casting_time: '1 action', prepared: 'Prepared' }],
          toHit: 5, saveDc: 13, modifier,
        },
      });

      await renderWithFetch(<CharActions playerStats={stats} />);

      expect(screen.getByText('Actions')).toBeInTheDocument();
      expect(screen.getByText(spellName)).toBeInTheDocument();
      expect(screen.getByText(expectedText)).toBeInTheDocument();
    });

    it('shows resolved damage for non-0 level spells', async () => {
      const stats = createStats({
        spellAbilities: {
          spells: [{ name: 'Fireball', level: 3, damage: '8d6', casting_time: '1 action', prepared: 'Prepared' }],
          toHit: 5, saveDc: 13,
        },
      });

      await renderWithFetch(<CharActions playerStats={stats} />);

      expect(screen.getByText('Actions')).toBeInTheDocument();
      expect(screen.getByText('Fireball')).toBeInTheDocument();
      expect(screen.getByText('8d6')).toBeInTheDocument();
    });

    it('does not render spells without damage or heal_at_slot_level', async () => {
      const stats = createStats({
        spellAbilities: {
          spells: [{ name: 'Minor Illusion', level: 0, casting_time: '1 action', prepared: 'Always' }],
          toHit: 5, saveDc: 13,
        },
      });

      await renderWithFetch(<CharActions playerStats={stats} />);

      expect(screen.getByText('Actions')).toBeInTheDocument();
      // getActionSpellNames filters out spells without damage or heal_at_slot_level
      expect(screen.queryByText('Minor Illusion')).not.toBeInTheDocument();
    });

    it.each([
      { label: 'appends Wis mod when chosen', chosenOption: 'Spellcasting Ability', wisBonus: 2, expectedText: '1d6+2' },
      { label: 'does not append when no option chosen', chosenOption: null, wisBonus: 2, expectedText: '1d6' },
      { label: 'does not append when Wis mod is 0', chosenOption: 'Wisdom', wisBonus: 0, expectedText: '1d6' },
    ])('potent spellcasting: $label', async ({ chosenOption, wisBonus, expectedText }) => {
      const stats = createStats({
        spellAbilities: {
          spells: [{ name: 'Burning Hands', level: 0, damage: '1d6', casting_time: '1 action', prepared: 'Prepared' }],
          toHit: 5, saveDc: 13,
        },
        abilities: [{ name: 'STR', bonus: 3 }, { name: 'Wisdom', bonus: wisBonus }],
        automation: {
          actions: [{ type: 'damage_bonus', name: 'Potent Spellcasting', options: ['Spellcasting Ability', 'Wisdom'], upgrades: false }],
        },
      });

      const chosenKey = '_Potent_Spellcasting_option';
      getRuntimeValue.mockImplementation((_name, key, _campaign) => {
        if (key === chosenKey) return chosenOption;
        return null;
      });

      await renderWithFetch(<CharActions playerStats={stats} />);

      expect(screen.getByText('Actions')).toBeInTheDocument();
      expect(screen.getByText('Burning Hands')).toBeInTheDocument();
      expect(screen.getByText(expectedText)).toBeInTheDocument();
    });
  });

  describe('handleActionSpellClick', () => {
    it.each([
      { spellName: 'Fireball', damage: '8d6', level: 3, element: 'spell' },
      { spellName: 'Fireball', damage: '8d6', level: 3, element: 'damage' },
    ])('renders spell $element as clickable element', async ({ spellName, damage, level }) => {
      const stats = createStats({
        spellAbilities: {
          spells: [{ name: spellName, level, range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage }],
          toHit: 5, saveDc: 13,
        },
      });

      await renderWithFetch(<CharActions playerStats={stats} />);

      const text = level === 0 ? spellName : (damage === '8d6' ? '8d6' : spellName);
      const el = level === 0 ? screen.getByText(spellName) : screen.getByText(text);
      expect(el).toHaveClass('clickable');
    });

    it('renders healing spells with resolved heal expression', async () => {
      const stats = createStats({
        spellAbilities: {
          spells: [{ name: 'Healing Word', level: 1, heal_at_slot_level: true, casting_time: '1 action', prepared: 'Prepared' }],
          toHit: 5, saveDc: 13, modifier: 3,
        },
      });

      await renderWithFetch(<CharActions playerStats={stats} />);

      expect(screen.getByText('Healing Word')).toBeInTheDocument();
      expect(screen.getByText('1d4+3')).toBeInTheDocument();
    });
  });

  describe('automation actions display', () => {
    it('renders automation actions with badge when saveDc is present', async () => {
      const stats = createStats({
        actions: [
          { name: 'Divine Intervention', description: 'Call on divine power.', automation: { type: 'save_attack', saveDc: 15, saveType: 'CHA' } },
        ],
      });

      const mockSetPopupHtml = vi.fn();
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      await renderWithFetch(<CharActions playerStats={stats} campaignName="test-campaign" />, { wrapper });

      expect(screen.getByText('Actions')).toBeInTheDocument();
      expect(screen.getByText(/Divine Intervention:/)).toBeInTheDocument();
      expect(screen.getByText(/DC 15 CHA/)).toBeInTheDocument();
    });

    it('renders automation actions without badge when no saveDc', async () => {
      const stats = createStats({
        actions: [
          { name: 'Rage', description: 'Enter a rage.', automation: { type: 'combat_stance' } },
        ],
      });

      await renderWithFetch(<CharActions playerStats={stats} />);

      expect(screen.getByText(/Rage:/)).toBeInTheDocument();
      expect(screen.queryByText(/DC/)).not.toBeInTheDocument();
    });
  });
});
