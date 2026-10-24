// @maintained-by-ai
// Consolidated: "calls executeHandler when action has automation" + "does not call executeHandler
// for plain actions" → 1 click-path test (asserts dispatch args and inert plain row).
// Removed: "feature detail popup for actions with details but no automation" — duplicated,
// stronger, in CharActions.automationHandler.test.jsx ("calls buildFeatureDetailHtml when
// action has details"). cannotAct guard also lives there.
// Strengthened: Metamagic display test now asserts the rendered ruleset description, not just
// the render; setModalState-wrapper test now verifies the onSpellModalStateChange prop actually
// receives modal-show events (it previously asserted only that the prop was defined).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import CharActions from './CharActions.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { getEmpoweredSpellDescription } from '../../services/rules/spells/empoweredSpellService.js';

// --- Mocks ---

const _syncedStore = new Map();

vi.mock('../../hooks/runtime/useSyncedState.js', () => ({
  useSyncedState: vi.fn((_, key, defaultValue) => {
    const hasValue = _syncedStore.has(key);
    const value = hasValue ? _syncedStore.get(key) : defaultValue;
    const setter = vi.fn((newValue) => {
      _syncedStore.set(key, typeof newValue === 'function' ? newValue(_syncedStore.get(key)) : newValue);
    });
    return [value, setter];
  }),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn((_, key) => _syncedStore.get(key)),
  getRuntimeValue: vi.fn((_, key) => _syncedStore.get(key)),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

vi.mock('../../services/character/featureCategories.js', () => ({
  getCategories: vi.fn(() => ({ featuresToIgnore: [] })),
}));

vi.mock('../../services/ui/spellSectionUtils.js', () => ({
  getActionSpellNames: vi.fn(() => new Set()),
}));

vi.mock('../../services/ui/formatUtils.js', () => ({
  formatRange: vi.fn((r) => r || '0'),
  signFormatter: new Intl.NumberFormat('en-US', { sign: 'always' }),
  getAttackSpellLevel: vi.fn(() => null),
}));

vi.mock('../../services/rules/core/spellDamageUtils.js', () => ({
  resolveSpellDamageAtLevel: vi.fn(() => null),
  isAutoHitSpell: vi.fn(() => false),
  resolveHealExpression: vi.fn(() => null),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollAbilityCheck: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn(() => '<p>Feature details</p>'),
}));

vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({ buildUpcastLevels: vi.fn(() => []) })),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 8, rolls: [4, 4] })),
}));

vi.mock('../../services/character/featRangeService.js', () => ({
  computeFeatRangeEffects: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn((action) => !!action?.automation),
}));

vi.mock('../../services/automation/common/buffToggle.js', () => ({
  toggleBuff: vi.fn(() => ({ wasActive: false })),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/automation/common/oncePerTurn.js', () => ({
  markOncePerTurn: vi.fn(() => Promise.resolve()),
}));

vi.mock('./CharActionModals.jsx', () => ({ default: vi.fn(() => null) }));
vi.mock('./CharActionSpellPopups.jsx', () => ({ default: vi.fn(() => null) }));
vi.mock('./CharBonusActions.jsx', () => ({ default: vi.fn(() => null) }));
vi.mock('./useCharActionModals.js', () => ({
  default: vi.fn(() => ({
    modalState: {},
    setModalState: vi.fn(),
    pendingDamage: null,
    resolveAttackDamage: vi.fn(),
    handleMasteryClose: vi.fn(),
    handleWeaponMasteryChoice: vi.fn(),
    handleWeaponKindMasteryClose: vi.fn(),
    handleDivineFuryDamageType: vi.fn(),
    handleDivineFurySkip: vi.fn(),
    handleGenericDamageTypeChoice: vi.fn(),
    handleGenericDamageTypeSkip: vi.fn(),
    handleDamageTypeModifierChoice: vi.fn(),
    handleDamageTypeModifierSkip: vi.fn(),
    handleEnhancedUnarmedChoice: vi.fn(),
    handleEnhancedUnarmedSkip: vi.fn(),
    handleFeatureChoiceConfirm: vi.fn(),
    handleFeatureChoiceSkip: vi.fn(),
    handleConstellationSelect: vi.fn(),
    combatSuperiorityModal: null,
    setCombatSuperiorityModal: vi.fn(),
    handleAttackRiderManeuverUse: vi.fn(),
    handleAttackRiderManeuverSkip: vi.fn(),
    handleCombatSuperiorityConfirm: vi.fn(),
    handleFlurryOfBlowsConfirm: vi.fn(),
    handleFlurryOfBlowsSkip: vi.fn(),
    handleOpenHandFromFlurryConfirm: vi.fn(),
    handleOpenHandFromFlurrySkip: vi.fn(),
  })),
}));

vi.mock('./useInitiativeEffects.js', () => ({ default: vi.fn() }));
vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({ default: vi.fn(() => null) }));
vi.mock('./modals/TacticalMasterModal.jsx', async () => {
  const { createTacticalMasterModalMock } = await import('./CharActions.test-utils.jsx');
  return createTacticalMasterModalMock({ render: false });
});
vi.mock('../../services/automation/handlers/combat/weaponMasteryHandler.js', () => ({
  applyMasteryEffect: vi.fn(() => Promise.resolve({})),
}));
vi.mock('./useAttackDamageResolution.js', () => ({
  normalizeAutoDamage: vi.fn((auto, _isCrit) => ({ attack: auto, ctxOverrides: {} })),
}));
vi.mock('../../hooks/combat/useSimpleDamageRoll.js', () => ({
  useSimpleDamageRoll: vi.fn(() => vi.fn()),
}));
vi.mock('../../hooks/combat/useSpellPositionResolver.js', () => ({
  useSpellPositionResolver: vi.fn(() => ({
    resolvePositions: vi.fn(() => Promise.resolve()),
    cachedPosRef: { current: null },
  })),
}));
vi.mock('../../hooks/combat/useSpellCastExecutor.js', () => ({
  useSpellCastExecutor: vi.fn(() => ({
    castAction: vi.fn(),
  })),
}));
vi.mock('../../services/combat/weaponMasteryUtils.js', () => ({
  getWeaponMastery: vi.fn(() => null),
}));
vi.mock('../../services/automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promise: Promise.resolve({ success: false }) })),
}));
vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn(() => ({ saveDcBonus: 0 })),
}));
vi.mock('../../services/automation/contextBuilder.js', () => ({
  buildAttackContext: vi.fn(() => Promise.resolve({})),
  buildAttackContextSync: vi.fn(() => ({})),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
  getAttackerTargetName: vi.fn(() => null),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
  getActiveCreatureName: vi.fn(() => 'TestCharacter'),
  loadCombatSummary: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(() => Promise.resolve({ type: 'popup', payload: 'Handled' })),
}));
vi.mock('../../services/rules/features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
}));
vi.mock('../../services/rules/features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));
vi.mock('../../services/rules/spells/empoweredSpellService.js', () => ({
  getEmpoweredSpellDescription: vi.fn(() => ''),
}));
vi.mock('../../hooks/combat/useActionSpellMetamagic.js', () => ({
  useActionSpellMetamagic: vi.fn(() => ({
    pendingActionMetamagic: null,
    handleActionMetamagicConfirm: vi.fn(),
    handleActionMetamagicSkip: vi.fn(),
    handleActionSpellDamageClick: vi.fn(),
    handleSpellAttackClick: vi.fn(),
  })),
}));
vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    gateMetamagic: vi.fn(),
  })),
}));

// --- Helpers ---

const originalFetch = global.fetch;

function setupFetchMock(actions = ['Hide', 'Dodge', 'Grapple']) {
  global.fetch = vi.fn((url) => {
    if (url === '/data/actions.json') {
      return Promise.resolve({ json: () => Promise.resolve(actions) });
    }
    return originalFetch(url);
  });
}

const basePlayerStats = {
  name: 'TestCharacter',
  level: 5,
  rules: '5e',
  abilities: [
    { name: 'Strength', bonus: 4, skills: [{ name: 'Athletics', bonus: 6 }] },
    { name: 'Dexterity', bonus: 2, skills: [{ name: 'Stealth', bonus: 4 }] },
    { name: 'Constitution', bonus: 1 },
    { name: 'Intelligence', bonus: 0 },
    { name: 'Wisdom', bonus: 0 },
    { name: 'Charisma', bonus: 3 },
  ],
  spellAbilities: { modifier: 3, toHit: 7, saveDc: 13 },
  proficiency: 3,
  attacks: [
    { name: 'Longsword', type: 'Action', hitBonus: 7, range: '5ft', damage: '1d8+4', damageType: 'Slashing' },
  ],
  actions: [],
  specialActions: [],
  class: { name: 'Fighter', class_levels: [{ level: 5, focus_points: 2 }] },
  feats: [],
  automation: {
    passives: [],
    specialActions: [],
    actions: [],
  },
};

const baseProps = {
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  exhaustionPenalty: 0,
  conditionEffects: {},
  cannotAct: false,
  mapName: null,
  characters: [],
  onBuffsChange: vi.fn(),
  onSpellModalStateChange: vi.fn(),
  spellModalState: {},
};

function statsWithActions(actions) {
  return { ...basePlayerStats, actions };
}

async function clickAction(getByText, name) {
  const actionLink = getByText(`${name}:`);
  await act(async () => {
    await fireEvent.click(actionLink);
  });
}

// --- Tests ---

describe('CharActions - feature action rows', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    _syncedStore.clear();
    setupFetchMock();
  });

  it('clicking an automation action dispatches executeHandler with it, while a plain action stays inert', async () => {
    const stats = statsWithActions([
      { name: 'Reckless Attack', automation: { type: 'buff', effect: 'advantage_attacks' } },
      { name: 'Plain Action', description: 'No automation here' },
    ]);
    const { getByText } = render(<CharActions {...baseProps} playerStats={stats} />);
    await waitFor(() => {
      expect(getByText('Reckless Attack:')).toBeInTheDocument();
      expect(getByText('Plain Action:')).toBeInTheDocument();
    });

    await clickAction(getByText, 'Reckless Attack');

    expect(executeHandler).toHaveBeenCalledTimes(1);
    expect(executeHandler).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Reckless Attack', automation: expect.objectContaining({ type: 'buff' }) }),
      stats,
      'test-campaign',
      null,
      [],
    );

    // Row without automation must never reach the automation engine.
    await clickAction(getByText, 'Plain Action');
    expect(executeHandler).toHaveBeenCalledTimes(1);
  });

  it('renders a spell_modifier Metamagic row as Empowered Spell with its ruleset description', async () => {
    getEmpoweredSpellDescription.mockReturnValue('Reroll damage dice.');
    const stats = statsWithActions([
      { name: 'Metamagic', automation: { type: 'spell_modifier' }, description: 'Modify spell' },
    ]);
    const { getByText, queryByText } = render(<CharActions {...baseProps} playerStats={stats} />);
    await waitFor(() => {
      expect(getByText('Empowered Spell:')).toBeInTheDocument();
    });

    // The row is renamed AND its description comes from the ruleset-aware service,
    // routed with the character's ruleset ('5e').
    expect(getByText('Reroll damage dice.')).toBeInTheDocument();
    expect(queryByText(/Modify spell/)).not.toBeInTheDocument();
    expect(getEmpoweredSpellDescription).toHaveBeenCalledWith(stats.actions[0], '5e');
  });

  it('syncs modal-show events to the parent via onSpellModalStateChange', async () => {
    const onSpellModalStateChange = vi.fn();
    render(<CharActions {...baseProps} onSpellModalStateChange={onSpellModalStateChange} />);
    await act(async () => { await Promise.resolve(); }); // flush mount effects (listener registration)

    const detail = { attackName: 'War Cry', rallyAmount: 5 };
    act(() => {
      window.dispatchEvent(new CustomEvent('rally-choice-modal-show', { detail }));
    });

    await waitFor(() => {
      expect(onSpellModalStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ rallyChoiceModal: detail })
      );
    });
  });
});
