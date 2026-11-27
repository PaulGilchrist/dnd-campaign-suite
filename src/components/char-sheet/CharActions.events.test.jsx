// @maintained-by-ai 2026-11-27
// Pins CharActions' window event-bus contract at the component seam (via
// useCharActionsEventListeners + the inline CLA-230 listener): popup HTML
// formatting copy, modal-show events → modalState routing (incl. the
// potent-spellcasting → secondaryTargetModal consumer, whose producer side is
// pinned in useLoggedDiceRollDamage.potent-spell.test.js), the damage_type_choice
// popup armed through DiceRollContext (choice rolls once, latches usedKey with
// the component's OWN campaignName, clears; live skip only clears), CLA-230
// moonlight-step-restore → automation dispatch, and full listener teardown on
// unmount. The listener add/remove ledger, reopen/stack and post-unmount
// silences for damage-type-choice/skip are pinned stronger at the hook seam in
// useCharActionsEventListeners.cleanup.test.jsx — not restated here.
// Mock hygiene (run2 #1825/#1842 canon): the REAL useSyncedState.js runs
// against the mocked useRuntimeState.js primitives (no mirrored store
// re-implementation; the phantom `useSyncedState` export previously mocked ON
// useRuntimeState.js is removed — that module does not export it).
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { executeHandler } from '../../services/automation/index.js';

const CAMPAIGN = 'test-campaign';

// Shared backing Map: the real useSyncedState.js reads/writes it through the
// mocked getStore/setRuntimeValue primitives; the mocked useCharActionModals
// setModalState records its latest argument here as a sentinel capture.
const _syncedStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getStore: vi.fn(() => _syncedStore),
  useRuntimeValue: vi.fn((_, key, _campaignName) => {
    const hasValue = _syncedStore.has(key);
    return hasValue ? _syncedStore.get(key) : null;
  }),
  listeners: new Map(),
}));

const { diceRollDefaults } = vi.hoisted(() => ({
  diceRollDefaults: () => ({
    popupHtml: null, setPopupHtml: vi.fn(), rollAttack: vi.fn(), rollDamage: vi.fn(),
    rollSkillCheck: vi.fn(), rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
  }),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => diceRollDefaults()),
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

// Complete against CharActions.jsx's actual destructuring (run2 #1826/#1843
// class): every key the component pulls is present. setModalState records its
// latest argument into the store sentinel so bus-routing tests can observe it.
vi.mock('./useCharActionModals.js', () => ({
  default: vi.fn(() => ({
    pendingDamage: null,
    modalState: {},
    setModalState: vi.fn((state) => {
      _syncedStore.set('modalState', state);
    }),
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
    handleCombatSuperiorityConfirm: vi.fn(),
    handleAttackRiderManeuverUse: vi.fn(),
    handleAttackRiderManeuverSkip: vi.fn(),
    handleFlurryOfBlowsConfirm: vi.fn(),
    handleFlurryOfBlowsSkip: vi.fn(),
    handleOpenHandFromFlurryConfirm: vi.fn(),
    handleOpenHandFromFlurrySkip: vi.fn(),
  })),
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="secondary-target-modal">SecondaryTargetModal</div>),
}));

vi.mock('./modals/TacticalMasterModal.jsx', async () => {
  const { createTacticalMasterModalMock } = await import('./CharActions.test-utils.jsx');
  return createTacticalMasterModalMock();
});

vi.mock('../../services/automation/handlers/combat/weaponMasteryHandler.js', () => ({
  applyMasteryEffect: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promise: Promise.resolve({ success: false }) })),
}));

vi.mock('./useAttackDamageResolution.js', () => ({
  normalizeAutoDamage: vi.fn((autoDamage) => ({ attack: autoDamage, ctxOverrides: {} })),
}));

vi.mock('../../services/automation/contextBuilder.js', () => ({
  buildAttackContext: vi.fn(() => Promise.resolve({ hitBonus: 5 })),
  buildAttackContextSync: vi.fn(() => ({ hitBonus: 5 })),
}));

vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

const basePlayerStats = {
  name: 'TestCharacter', rules: '5e', level: 5, attacks: [], actions: [],
  spellAbilities: { spells: [], toHit: 5, saveDc: 13 },
  abilities: [{ name: 'STR', bonus: 3 }], proficiency: 3,
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

// Flat info shape as produced by automationInfoBuilder/resource.js and collected
// into playerStats.automation.actions (CLA-230 moonlight-step-restore source).
const poolAction = {
  type: 'resource_pool',
  name: 'Moonlight Step',
  description: 'Teleport 60 feet.',
  resource: 'moonlightStepUses',
  uses_expression: 'WIS modifier',
  conversion: 'spell_slot_to_moonlight_step',
  conversionRate: 'level_2_plus',
};

function renderWithWrapper(component, wrapper) {
  return act(async () => render(component, { wrapper }));
}

function makeWrapper(mockSetPopupHtml, popupHtmlValue = null) {
  return ({ children }) => (
    <DiceRollContext.Provider value={{ popupHtml: popupHtmlValue, setPopupHtml: mockSetPopupHtml }}>
      {children}
    </DiceRollContext.Provider>
  );
}

// Render CharActions with a fresh rollDamage spy wired through useLoggedDiceRoll
// and (optionally) a staged popup in DiceRollContext. Returns the rollDamage spy
// plus unmount so cleanup lanes can tear the tree down.
async function renderWithDiceRoll(mockSetPopupHtml, popupHtmlValue = null, campaignName = CAMPAIGN) {
  const mockRollDamage = vi.fn();
  useLoggedDiceRoll.mockReturnValue({
    ...diceRollDefaults(), popupHtml: popupHtmlValue, setPopupHtml: mockSetPopupHtml, rollDamage: mockRollDamage,
  });
  const view = await renderWithWrapper(
    <CharActions playerStats={createStats()} campaignName={campaignName} />,
    makeWrapper(mockSetPopupHtml, popupHtmlValue)
  );
  return { rollDamage: mockRollDamage, unmount: view.unmount };
}

function flush() {
  return act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

function dispatchCustomEvent(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  _syncedStore.clear();
  // clearAllMocks does NOT drop mockReturnValue overrides — re-seed the shared
  // dice-roll fixture so per-test seams cannot leak (run2 #1825 class).
  useLoggedDiceRoll.mockReturnValue(diceRollDefaults());
  globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
});

describe('CharActions popup events → popup HTML formatting', () => {
  it.each([
    {
      name: 'maximized healing popup with roll info (both annotation branches)',
      event: 'healing-popup',
      detail: { targetName: 'Ally2', healingName: 'Cure Wounds', rollInfo: '2d4+3', maximizeHealingDice: true, popupText: 'Maximized healing' },
      expected: '<b>Cure Wounds</b> on Ally2 [2d4+3] (maximized)<br/><br/>Maximized healing',
    },
    {
      name: 'plain healing popup without roll info',
      event: 'healing-popup',
      detail: { targetName: 'Ally3', healingName: 'Lay on Hands', rollInfo: null, maximizeHealingDice: false, popupText: 'Heals wounds' },
      expected: '<b>Lay on Hands</b> on Ally3<br/><br/>Heals wounds',
    },
    {
      name: 'damage popup with roll info',
      event: 'damage-popup',
      detail: { targetName: 'Goblin', spellName: 'Fire Bolt', popupText: 'Deals fire damage', rollInfo: '5+4' },
      expected: '<b>Fire Bolt</b> on Goblin [5+4]<br/><br/>Deals fire damage',
    },
    {
      name: 'damage popup without roll info',
      event: 'damage-popup',
      detail: { targetName: 'Skeleton', spellName: 'Ray of Frost', popupText: 'Deals cold damage', rollInfo: null },
      expected: '<b>Ray of Frost</b> on Skeleton<br/><br/>Deals cold damage',
    },
  ])('$name', async ({ event, detail, expected }) => {
    const mockSetPopupHtml = vi.fn();
    await renderWithWrapper(<CharActions playerStats={createStats()} />, makeWrapper(mockSetPopupHtml));

    dispatchCustomEvent(event, detail);

    await waitFor(() => {
      expect(mockSetPopupHtml).toHaveBeenCalledWith(expected);
    });
    expect(mockSetPopupHtml).toHaveBeenCalledTimes(1);
  });
});

describe('CharActions modal-show events → setModalState passthrough', () => {
  it.each([
    { eventName: 'inspiring-smite-pending', detail: { attackName: 'Longsword', bonusDamage: '1d6' }, modalKey: 'inspiringSmiteModal' },
    { eventName: 'soulstitch-modal-show', detail: { spells: ['Magic Missile', 'Shield'] }, modalKey: 'soulstitchSpellsModal' },
    // CLA-037 bridge from postCastRiderService — consumer side pinned only here.
    { eventName: 'bewitching-modal-show', detail: { targetName: 'Goblin', rider: 'bewitching' }, modalKey: 'stepsOfTheFeyTauntModal' },
    { eventName: 'sweeping-attack-modal-show', detail: { attackName: 'Greatsword', targets: ['Goblin', 'Orc'] }, modalKey: 'sweepingAttackTargetModal' },
    { eventName: 'bait-and-switch-modal-show', detail: { attackName: 'Shortsword', options: ['Attack', 'Disengage'] }, modalKey: 'baitAndSwitchChoiceModal' },
    { eventName: 'commander-strike-modal-show', detail: { attackName: 'Longbow', allyName: 'Rogue' }, modalKey: 'commanderStrikeChoiceModal' },
    { eventName: 'rally-choice-modal-show', detail: { attackName: 'War Cry', rallyAmount: 5 }, modalKey: 'rallyChoiceModal' },
    // bug-power-of-the-wilds-row-inert: Special-Actions grid bridges its
    // combat_stance chooser (Power of the Wilds Falcon/Lion/Ram) to this tree.
    { eventName: 'combat-stance-modal-show', detail: { action: { name: 'Power of the Wilds' }, playerStats: { name: 'TestCharacter' }, campaignName: 'test' }, modalKey: 'combatStanceModal' },
  ])('$eventName sets $modalKey with the event detail', async ({ eventName, detail, modalKey }) => {
    await renderWithWrapper(<CharActions playerStats={createStats()} />, makeWrapper(vi.fn()));

    dispatchCustomEvent(eventName, detail);

    await waitFor(() => {
      expect(_syncedStore.get('modalState')).toEqual(
        expect.objectContaining({ [modalKey]: detail })
      );
    });
  });

  // Producer side (the save-damage dispatch) is pinned in
  // useLoggedDiceRollDamage.potent-spell.test.js; this is the only consumer pin.
  // The mocked combat context has no creatures, so ally targets map to empty.
  it('potent-spellcasting-temp-hp opens the secondary-target modal with a default confirm label', async () => {
    await renderWithWrapper(<CharActions playerStats={createStats()} />, makeWrapper(vi.fn()));

    dispatchCustomEvent('potent-spellcasting-temp-hp', {
      title: 'Potent Spellcasting', tempHp: 5, campaignName: CAMPAIGN, attackerName: 'TestCharacter',
    });

    await waitFor(() => {
      expect(_syncedStore.get('modalState')).toEqual(expect.objectContaining({
        secondaryTargetModal: expect.objectContaining({
          title: 'Potent Spellcasting',
          confirmLabel: 'Grant Temp HP',
          targets: [],
        }),
      }));
    });
  });
});

describe('CharActions damage_type_choice popup armed through DiceRollContext', () => {
  const choicePopup = {
    type: 'damage_type_choice',
    bonusFormula: '1d6',
    bonusRolls: [3],
    bonusTotal: 3,
    usedKey: 'test_key',
    currentRound: 1,
    targetName: 'Goblin',
    attackerName: 'TestCharacter',
    name: 'Blessed Strikes',
  };

  it('choice rolls the bonus once, latches usedKey with the component campaignName, clears the popup; live skip only clears', async () => {
    const mockSetPopupHtml = vi.fn();
    const { rollDamage: mockRollDamage } = await renderWithDiceRoll(mockSetPopupHtml, choicePopup);

    dispatchCustomEvent('damage-type-choice', { chosenType: 'Radiant' });

    await waitFor(() => {
      expect(mockSetPopupHtml).toHaveBeenCalledWith(null);
    });
    expect(mockRollDamage).toHaveBeenCalledTimes(1);
    expect(mockRollDamage).toHaveBeenCalledWith({
      name: 'Blessed Strikes', formula: '1d6', total: 3, rolls: [3], modifier: 0,
      context: expect.objectContaining({ damageType: 'Radiant', targetName: 'Goblin', attackerName: 'TestCharacter' }),
    });
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'test_key', 1, CAMPAIGN);

    // Skip while a popup is still armed: dismisses without rolling or latching.
    // (No-active-popup and post-unmount silences are ledger-pinned at the hook
    // seam in useCharActionsEventListeners.cleanup.test.jsx.)
    dispatchCustomEvent('damage-type-skip');

    await waitFor(() => {
      expect(mockSetPopupHtml).toHaveBeenCalledTimes(2);
    });
    expect(mockSetPopupHtml).toHaveBeenNthCalledWith(2, null);
    expect(mockRollDamage).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
  });
});

describe('CharActions moonlight-step-restore bus event — CLA-230', () => {
  it('dispatches the resource_pool conversion automation when the bus event fires', async () => {
    const stats = createStats({ automation: { actions: [poolAction], passives: [] } });
    await renderWithWrapper(<CharActions playerStats={stats} />, makeWrapper(vi.fn()));

    dispatchCustomEvent('moonlight-step-restore');

    await waitFor(() => {
      expect(executeHandler).toHaveBeenCalledTimes(1);
    });
    const [action, statsArg] = executeHandler.mock.calls[0];
    expect(action).toEqual(expect.objectContaining({ name: 'Moonlight Step', automation: poolAction }));
    expect(statsArg).toEqual(stats);
  });

  it('is a no-op when the character has no spell_slot_to_moonlight_step automation', async () => {
    const stats = createStats({ automation: { actions: [], passives: [] } });
    await renderWithWrapper(<CharActions playerStats={stats} />, makeWrapper(vi.fn()));

    dispatchCustomEvent('moonlight-step-restore');
    await flush();

    expect(executeHandler).not.toHaveBeenCalled();
  });
});

describe('CharActions event listener cleanup on unmount', () => {
  it('stops responding to bus events (hook + inline CLA-230) after unmount', async () => {
    const mockSetPopupHtml = vi.fn();
    const stats = createStats({ automation: { actions: [poolAction], passives: [] } });
    const { unmount } = await renderWithWrapper(
      <CharActions playerStats={stats} />, makeWrapper(mockSetPopupHtml)
    );
    expect(screen.getByText('Actions')).toBeInTheDocument();

    unmount();

    dispatchCustomEvent('healing-popup', { targetName: 'Ally1', healingName: 'Healing Word', rollInfo: '7+3', popupText: 'stale' });
    dispatchCustomEvent('damage-popup', { targetName: 'Goblin', spellName: 'Fire Bolt', popupText: 'stale' });
    dispatchCustomEvent('rally-choice-modal-show', { rallyAmount: 5 });
    dispatchCustomEvent('moonlight-step-restore');
    await flush();

    expect(mockSetPopupHtml).not.toHaveBeenCalled();
    expect(_syncedStore.get('modalState')).toBeUndefined();
    expect(executeHandler).not.toHaveBeenCalled();
  });
});
