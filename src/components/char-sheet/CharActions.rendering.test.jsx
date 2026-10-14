// Removed: "renders the section header" (subsumed by incapacitated test)
// Removed: "renders attack names from playerStats.attacks" (subset of "renders multiple attacks")
// Removed: "renders base actions list after fetch completes" (specific case of "renders actions returned from actions.json")
// Removed: "renders an empty base actions list" (no unique behavioral coverage)
// Removed: "does not add mastery-enabled class for 5e rules" (subsumed by "without weapon_kind_mastery passive" test)
// Removed: "does not trigger attack when cannotAct is true" (covered by CharActions.grapple.test.jsx)
// Rewrote: "renders actions returned from actions.json" — removed brittle fetch URL assertion
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const _syncedStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getStore: vi.fn(() => _syncedStore),
  useSyncedState: vi.fn((_, key, defaultValue) => {
    const hasValue = _syncedStore.has(key);
    const value = hasValue ? _syncedStore.get(key) : defaultValue;
    const setter = vi.fn((newValue) => {
      _syncedStore.set(key, typeof newValue === 'function' ? newValue(value) : newValue);
    });
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

describe('CharActions - Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
    getRuntimeValue.mockImplementation(() => null);
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve(['Hide', 'Dash', 'Disengage', 'Dodge', 'Grapple']) });
  });

  describe('section header and incapacitated state', () => {
    it('renders "(Incapacitated)" label when cannotAct is true', async () => {
      await act(async () => { render(<CharActions playerStats={createStats()} cannotAct={true} />); });
      expect(screen.getByText('(Incapacitated)')).toBeInTheDocument();
    });

    it('does not render "(Incapacitated)" when cannotAct is false', async () => {
      await act(async () => { render(<CharActions playerStats={createStats()} cannotAct={false} />); });
      expect(screen.queryByText('(Incapacitated)')).not.toBeInTheDocument();
    });
  });

  describe('attacks rendering', () => {
    it('renders multiple attacks', async () => {
      const stats = createStats({
        attacks: [
          { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
          { name: 'Shortbow', range: 80, hitBonus: 5, damage: '1d6+3', damageType: 'Piercing', type: 'Action' },
        ],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Longsword')).toBeInTheDocument();
      expect(screen.getByText('Shortbow')).toBeInTheDocument();
    });
  });

  describe('base actions from actions.json', () => {
    it('renders actions returned from actions.json when the list differs', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve(['Dash', 'Disengage']) });
      await act(async () => { render(<CharActions playerStats={createStats()} />); });
      await waitFor(() => {
        expect(screen.getByText(/Dash/)).toBeInTheDocument();
        expect(screen.getByText(/Disengage/)).toBeInTheDocument();
        expect(screen.queryByText(/Hide/)).not.toBeInTheDocument();
      });
    });
  });

  describe('weapon mastery column for 2024 rules', () => {
    it('adds mastery-enabled class when 2024 rules and weapon_kind_mastery passive exists', async () => {
      const stats2024 = createStats({
        rules: '2024',
        automation: {
          ...basePlayerStats.automation,
          passives: [{ type: 'weapon_kind_mastery' }],
        },
      });
      await act(async () => { render(<CharActions playerStats={stats2024} />); });
      const container = screen.getByText('Actions').closest('.char-actions');
      const attacksDiv = container?.querySelector('.attacks');
      expect(attacksDiv?.className).toContain('mastery-enabled');
    });

    it('does not add mastery-enabled class without weapon_kind_mastery passive', async () => {
      const statsNoMastery = createStats({
        rules: '2024',
        automation: { passives: [] },
      });
      await act(async () => { render(<CharActions playerStats={statsNoMastery} />); });
      const container = screen.getByText('Actions').closest('.char-actions');
      const attacksDiv = container?.querySelector('.attacks');
      expect(attacksDiv?.className).not.toContain('mastery-enabled');
    });
  });

  describe('attack click handlers', () => {
    it('calls rollAttack when an attack name is clicked', async () => {
      const mockRollAttack = vi.fn();
      const { default: useLoggedDiceRoll } = await import('../../hooks/combat/useLoggedDiceRoll.js');
      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: vi.fn(), rollAttack: mockRollAttack, rollDamage: vi.fn(),
        rollSkillCheck: vi.fn(), rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
      });

      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });
      const attackLink = screen.getByText('Longsword');
      await act(async () => { fireEvent.click(attackLink); });
      expect(mockRollAttack).toHaveBeenCalled();
    });

    it('calls endFriendsOnHostileAction and endInvisibilityOnHostileAction on attack click', async () => {
      const mockRollAttack = vi.fn();
      const { default: useLoggedDiceRoll } = await import('../../hooks/combat/useLoggedDiceRoll.js');
      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: vi.fn(), rollAttack: mockRollAttack, rollDamage: vi.fn(),
        rollSkillCheck: vi.fn(), rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
      });

      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });
      const attackLink = screen.getByText('Longsword');
      await act(async () => { fireEvent.click(attackLink); });

      const { endFriendsOnHostileAction } = await import('../../services/rules/features/friendsService.js');
      const { endInvisibilityOnHostileAction } = await import('../../services/rules/features/invisibilityService.js');
      expect(endFriendsOnHostileAction).toHaveBeenCalledWith('TestCharacter', undefined);
      expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestCharacter', undefined);
    });
  });

});

describe('CharActions - Action Feature Details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
    getRuntimeValue.mockImplementation(() => null);
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
  });

  it('renders action with details as clickable', async () => {
    const stats = createStats({
      actions: [{ name: 'TestAction', details: 'Some details', description: 'A description', automation: null }],
    });
    await act(async () => { render(<CharActions playerStats={stats} />); });
    expect(screen.getByText(/TestAction:/)).toHaveClass('clickable');
  });

  it('renders action without details or automation as non-clickable', async () => {
    const stats = createStats({
      actions: [{ name: 'PlainAction', description: 'Plain description' }],
    });
    await act(async () => { render(<CharActions playerStats={stats} />); });
    expect(screen.getByText(/PlainAction:/)).not.toHaveClass('clickable');
  });
});
