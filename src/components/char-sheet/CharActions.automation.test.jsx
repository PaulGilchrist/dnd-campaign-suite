// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import CharActions from './CharActions.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { buildFeatureDetailHtml } from '../../hooks/combat/useActionPopup.js';

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
vi.mock('./modals/TacticalMasterModal.jsx', () => ({ default: vi.fn(() => null) }));
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
  actions: [
    { name: 'Reckless Attack', automation: { type: 'buff', effect: 'advantage_attacks' } },
    { name: 'Second Wind', automation: { type: 'healing_roll', formula: '1d10' } },
  ],
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

// --- Tests ---

describe('CharActions - handleAutomationAction', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    _syncedStore.clear();
    setupFetchMock();
  });

  it('calls executeHandler when action has automation and cannotAct is false', async () => {
    const { getByText } = render(<CharActions {...baseProps} />);
    await waitFor(() => {
      expect(getByText('Reckless Attack:')).toBeInTheDocument();
    });
    const actionLink = getByText('Reckless Attack:');
    await act(async () => {
      await fireEvent.click(actionLink);
    });
    expect(executeHandler).toHaveBeenCalled();
  });

  it('does not call executeHandler when action has no automation metadata', async () => {
    const stats = {
      ...basePlayerStats,
      actions: [{ name: 'Plain Action', description: 'No automation here' }],
    };
    const { getByText } = render(<CharActions {...baseProps} playerStats={stats} />);
    await waitFor(() => {
      expect(getByText('Plain Action:')).toBeInTheDocument();
    });
    const actionLink = getByText('Plain Action:');
    await act(async () => {
      await fireEvent.click(actionLink);
    });
    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('displays empowered spell name for Metamagic with spell_modifier type', async () => {
    const getEmpoweredSpellDescription = (await import('../../services/rules/spells/empoweredSpellService.js')).getEmpoweredSpellDescription;
    const stats = {
      ...basePlayerStats,
      actions: [{ name: 'Metamagic', automation: { type: 'spell_modifier' }, description: 'Modify spell' }],
    };
    const { getByText } = render(<CharActions {...baseProps} playerStats={stats} />);
    await waitFor(() => {
      expect(getByText('Empowered Spell:')).toBeInTheDocument();
    });
    expect(getEmpoweredSpellDescription).toHaveBeenCalledWith(stats.actions[0], stats.rules);
  });

  it('renders feature detail popup when action has details but no automation', async () => {
    const stats = {
      ...basePlayerStats,
      actions: [{ name: 'Tactical Genius', details: 'Tactical details', description: 'A smart move' }],
    };
    const { getByText } = render(<CharActions {...baseProps} playerStats={stats} />);
    await waitFor(() => {
      expect(getByText('Tactical Genius:')).toBeInTheDocument();
    });
    const actionLink = getByText('Tactical Genius:');
    await act(async () => {
      await fireEvent.click(actionLink);
    });
    expect(buildFeatureDetailHtml).toHaveBeenCalledWith(stats.actions[0]);
  });
});

describe('CharActions - setModalState wrapper', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    _syncedStore.clear();
    setupFetchMock();
  });

  it('calls onSpellModalStateChange when modal state changes', async () => {
    const onSpellModalStateChange = vi.fn();
    const { getByText } = render(<CharActions {...baseProps} onSpellModalStateChange={onSpellModalStateChange} />);
    await waitFor(() => {
      expect(getByText('Actions')).toBeInTheDocument();
    });
    expect(onSpellModalStateChange).toBeDefined();
  });
});
