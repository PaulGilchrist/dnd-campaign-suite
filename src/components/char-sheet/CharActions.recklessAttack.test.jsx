// @maintained-by-ai 2026-11-27
// Integration lane: renders the real CharActions (real useCharActionsAttackHandlers)
// and presses the real attack row to verify the Reckless Attack / Brutal Strike
// chooser is reached through the component's own wiring (props → hook deps →
// setModalState fan-out to parent, campaignName/playerStats.name threading).
// Mode selection, latch semantics, rider selection and the confirm/cancel flows
// are covered by useCharActionsAttackHandlers*.test.js — CharActionModals is
// mocked here, so confirm clicks live in that lane, not this one.
// Mock hygiene (events-lane recipe, run2 #1853): the REAL useSyncedState.js
// runs against the mocked useRuntimeState.js primitives (getStore/
// setRuntimeValue/listeners) — no mirrored useSyncedState re-implementation.
// All hook-return mocks match the component's own destructuring; vi.clearAllMocks
// suffices (every mock returns constant objects, no per-test re-seeding).
import { render, waitFor, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { toggleBuff } from '../../services/automation/common/buffToggle.js';
import { endFriendsOnHostileAction } from '../../services/rules/features/friendsService.js';

// --- Shared mock infrastructure ---

// Single backing Map for every characterKey: the real useSyncedState.js and the
// mocked useRuntimeValue/getRuntimeValue primitives all read/write it, so
// seeding a key here is visible to both store lanes.
const _syncedStore = new Map();
const _setModalState = vi.fn();
const _rollAttack = vi.fn();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_, key) => _syncedStore.get(key)),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getStore: vi.fn(() => _syncedStore),
  useRuntimeValue: vi.fn((_, key) => (_syncedStore.has(key) ? _syncedStore.get(key) : null)),
  listeners: new Map(),
}));

vi.mock('../../services/character/featureCategories.js', () => ({
  getCategories: vi.fn(() => ({ featuresToIgnore: [] })),
}));

vi.mock('../../services/ui/spellSectionUtils.js', () => ({
  getActionSpellNames: vi.fn(() => new Set()),
}));

vi.mock('../../services/ui/formatUtils.js', () => ({
  formatRange: vi.fn((r) => r || '0'),
  formatWeaponRange: vi.fn((a) => (a?.range ? String(a.range) : '0')),
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
    rollAttack: _rollAttack,
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
  hasAutomation: vi.fn(() => false),
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
    setModalState: _setModalState,
    pendingDamage: null,
    resolveAttackDamage: vi.fn(),
    resumeAttackPipeline: vi.fn(),
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
  useSpellCastExecutor: vi.fn(() => ({ castAction: vi.fn() })),
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
  getActiveCreatureName: vi.fn(() => 'TestFighter'),
  loadCombatSummary: vi.fn(() => Promise.resolve(null)),
  getCurrentCombatRound: vi.fn(() => 1),
  getCombatSummary: vi.fn(() => null),
}));
vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(() => Promise.resolve(null)),
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
    pendingMetamagic: null, gateMetamagic: vi.fn(), handleConfirm: vi.fn(), handleSkip: vi.fn(),
    pendingAid: null, handleAidConfirm: vi.fn(), handleAidSkip: vi.fn(),
    pendingGreaterRestoration: null, handleGreaterRestorationConfirm: vi.fn(), handleGreaterRestorationSkip: vi.fn(),
    pendingRemoveCurse: null, handleRemoveCurseConfirm: vi.fn(), handleRemoveCurseSkip: vi.fn(),
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
  name: 'TestFighter',
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

const RECKLESS_SPECIAL_ACTION = {
  effect: 'advantage_attacks_advantage_against',
  trigger: 'first_attack_of_turn',
};

// The chooser reads only playerStats.automation.{specialActions,passives}.
function statsWithReckless({ passives = [] } = {}) {
  return {
    ...basePlayerStats,
    automation: { ...basePlayerStats.automation, passives, specialActions: [RECKLESS_SPECIAL_ACTION] },
  };
}

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

async function renderAndClickLongsword(props) {
  const utils = render(<CharActions {...baseProps} {...props} />);
  await waitFor(() => expect(utils.getByText('Longsword')).toBeInTheDocument());
  await act(async () => { fireEvent.click(utils.getByText('Longsword')); });
  return utils;
}

function recklessModalOpens() {
  return _setModalState.mock.calls
    .map(c => c[0]?.recklessAttackModal)
    .filter(Boolean);
}

// --- Tests ---

describe('CharActions — Reckless Attack / Brutal Strike chooser wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _syncedStore.clear();
    setupFetchMock();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('pressing the Longsword row with the reckless feature opens the full chooser once and fans it to the parent', async () => {
    const onSpellModalStateChange = vi.fn();
    await renderAndClickLongsword({
      playerStats: statsWithReckless(),
      onSpellModalStateChange,
    });

    // Full chooser opens exactly once, carrying the clicked attack, and the
    // parent sheet receives the same modal state through the fan-out wrapper.
    const opens = recklessModalOpens();
    expect(opens).toHaveLength(1);
    expect(opens[0]).toEqual(expect.objectContaining({
      mode: 'full',
      attack: expect.objectContaining({ name: 'Longsword' }),
    }));
    expect(onSpellModalStateChange).toHaveBeenCalledTimes(1);
    expect(onSpellModalStateChange).toHaveBeenCalledWith(expect.objectContaining({
      recklessAttackModal: expect.objectContaining({ mode: 'full' }),
    }));
    // Prop threading at the seam: playerStats.name + the campaignName prop
    // reach the per-press hostile-action lane with real values.
    expect(endFriendsOnHostileAction).toHaveBeenCalledTimes(1);
    expect(endFriendsOnHostileAction).toHaveBeenCalledWith('TestFighter', 'test-campaign');
    // The chooser owns the attack: no roll and no reckless buff before confirm.
    expect(_rollAttack).not.toHaveBeenCalled();
    expect(toggleBuff).not.toHaveBeenCalled();
  });

  it('pressing the Longsword row while cannotAct refuses before any commit — no chooser, roll, buff or hostile-action end', async () => {
    const onSpellModalStateChange = vi.fn();
    await renderAndClickLongsword({
      playerStats: statsWithReckless(),
      cannotAct: true,
      onSpellModalStateChange,
    });

    expect(recklessModalOpens()).toHaveLength(0);
    expect(onSpellModalStateChange).not.toHaveBeenCalled();
    // The refusal happens before the committed-press side effects.
    expect(endFriendsOnHostileAction).not.toHaveBeenCalled();
    expect(_rollAttack).not.toHaveBeenCalled();
    expect(toggleBuff).not.toHaveBeenCalled();
  });

  it('pressing the Longsword row while reckless is active routes to the brutalOnly chooser with a rider payload', async () => {
    const passives = [{
      name: 'Improved Brutal Strike',
      type: 'attack_rider',
      trigger: 'strength_attack_hit_after_reckless',
      damageExpression: '2d6',
      options: [{ name: 'Staggering Blow', effect: 'disadvantage_on_next_save' }],
      maxEffects: 1,
    }];
    // Runtime store reports the reckless buff already active on the character.
    _syncedStore.set('activeBuffs', [{ effect: 'advantage_attacks_advantage_against' }]);

    await renderAndClickLongsword({ playerStats: statsWithReckless({ passives }) });

    // Routing/mode is this seam; exact rider selection is pinned at the hook
    // seam (.improvedBrutalStrike/.brutalGate) — assert the payload SHAPE here.
    const opens = recklessModalOpens();
    expect(opens).toHaveLength(1);
    expect(opens[0]).toEqual(expect.objectContaining({
      mode: 'brutalOnly',
      hasBrutalStrike: true,
      riderName: expect.any(String),
      brutalStrikeOptions: expect.any(Array),
      attack: expect.objectContaining({ name: 'Longsword' }),
    }));
    // The chooser owns the attack: no roll until confirm.
    expect(_rollAttack).not.toHaveBeenCalled();
  });

  it('pressing the Longsword row without the reckless feature bypasses the chooser and rolls directly', async () => {
    // basePlayerStats carries NO reckless specialAction — the negative control
    // proving the chooser interception is conditional on feature presence.
    await renderAndClickLongsword();

    expect(recklessModalOpens()).toHaveLength(0);
    await waitFor(() => expect(_rollAttack).toHaveBeenCalledTimes(1));
  });
});
