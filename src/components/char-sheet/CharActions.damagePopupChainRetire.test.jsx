// @maintained-by-ai
// MA 2026-11-18 backlog (owner decision: auto-retire the damage-result popup at
// rider-chain mount). The committed-damage face (popupHtml.damageApplied — the
// hp_change row has ALREADY landed; the face is purely cosmetic) must never
// dwell as a "click to dismiss" `.popup-modal` under a top-most rider-chain
// overlay: every chain `.sp-overlay` (this sheet's chooser modals via the merged
// modal state, or a campaign save prompt armed via the pendingSavePrompts
// bucket — Shield Bash STR, poison, topple) intercepts pointer events, so the
// popup's Done is unclickable under it (playbook §2 OVERLAY DWELL DRAIN ORDER).
// CharActions retires the popup at chain mount — exactly the popup's own Done
// close (setPopupHtml(null), zero state, zero log). Both mount orders are
// reactive (popup-under-already-mounted chain AND chain-over-already-mounted
// popup). Riderless commits (no chooser, no save prompt) keep the popup and its
// normal Done/click dismissal; the staged Done-pending face (autoDamage, no
// damageApplied) is NEVER auto-closed — staged damage still only commits or
// honestly cancels. Harness follows CharActions.attackDwell.test.jsx.
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';

const _syncedStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getStore: vi.fn(() => _syncedStore),
  listeners: new Map(),
  useSyncedState: vi.fn((_, key, defaultValue) => {
    const hasValue = _syncedStore.has(key);
    const value = hasValue ? _syncedStore.get(key) : defaultValue;
    const setter = vi.fn((newValue) => {
      _syncedStore.set(key, newValue);
    });
    return [value, setter];
  }),
  useRuntimeValue: vi.fn((_, key) => {
    const hasValue = _syncedStore.has(key);
    return hasValue ? _syncedStore.get(key) : null;
  }),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null, setPopupHtml: vi.fn(), rollAttack: vi.fn(), rollDamage: vi.fn(), rollSkillCheck: vi.fn(), rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
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
  getAttackerTargetName: vi.fn(() => null),
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
  computeFeatRangeEffects: vi.fn(() => Promise.resolve({ rangeBonus: 5 })),
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

vi.mock('./modals/TacticalMasterModal.jsx', async () => {
  const { createTacticalMasterModalMock } = await import('./CharActions.test-utils.jsx');
  return createTacticalMasterModalMock();
});

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

const dagger = { name: 'Dagger', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Action' };

const basePlayerStats = {
  name: 'TestCharacter', rules: '5e', level: 5, attacks: [dagger], actions: [],
  spellAbilities: { spells: [], toHit: 5, saveDc: 13 },
  abilities: [{ name: 'STR', bonus: 3 }], proficiency: 3,
};

// Committed-damage result face — the payload plainDamageHandler publishes AFTER
// the hp_change row (applyPopupApplyResult stamps damageApplied: true). The
// "… damage applied to Goblin — HP: 7 → 0 … click to dismiss / Done" popup.
const committedDamagePopup = {
  type: 'damage', name: 'Glaive', formula: '1d10+3', rolls: [4, 3], bonus: 0, modifier: 3,
  damageType: 'Slashing', targetName: 'Goblin', total: 7, adjustedTotal: 7,
  damageApplied: true, finalDamage: 7, targetOldHp: 7, targetCurrentHp: 0, targetMaxHp: 7,
};

// Staged Done-pending face (useLoggedDiceRollAttack buildPopupData) — damage
// NOT yet committed: autoDamage rides the Done dispatch, no damageApplied flag.
const stagedHitPopup = {
  rollType: 'attack', name: 'Glaive', hit: true, rolls: [19],
  targetAc: 15, targetName: 'Goblin', autoDamage: { name: 'Glaive', formula: '1d10+3', total: 7 },
};

// The Shield Bash rider's campaign save-prompt row (savePrompt.js
// buildPromptPayload shape, keyed by promptId in the pendingSavePrompts bucket).
const armedShieldBashPrompt = {
  'prompt-1': { promptId: 'prompt-1', campaignName: 'test-campaign', targetName: 'Goblin', attackerName: 'TestCharacter', saveType: 'STR', saveDc: 17, dcSuccess: false, sourceName: 'Shield Bash' },
};

// Charger/push-prone chooser props (CharActionModals AttackRiderModal host).
const riderChooser = { action: { name: 'Charge Attack' }, targetName: 'Goblin' };

function renderCharActions({ popupHtml = null, setPopupHtml = vi.fn(), spellModalState = {} } = {}) {
  globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
  return act(async () => render(
    <DiceRollContext.Provider value={{ popupHtml, setPopupHtml, _isShared: true }}>
      <CharActions playerStats={basePlayerStats} campaignName="test-campaign" spellModalState={spellModalState} />
    </DiceRollContext.Provider>
  ));
}

describe('CharActions committed-damage popup auto-retire at rider-chain mount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
  });

  it('committed-damage popup under an already-mounted sheet chooser overlay retires at mount', async () => {
    const setPopupHtml = vi.fn();
    await renderCharActions({ popupHtml: committedDamagePopup, setPopupHtml, spellModalState: { attackRiderModal: riderChooser } });
    expect(setPopupHtml).toHaveBeenCalledWith(null);
  });

  it('committed-damage popup under an already-armed campaign save prompt retires at mount', async () => {
    _syncedStore.set('pendingSavePrompts', armedShieldBashPrompt);
    const setPopupHtml = vi.fn();
    await renderCharActions({ popupHtml: committedDamagePopup, setPopupHtml });
    expect(setPopupHtml).toHaveBeenCalledWith(null);
  });

  it('chain arming OVER a dwelling committed-damage popup retires it (second mount order)', async () => {
    const setPopupHtml = vi.fn();
    const { rerender } = await renderCharActions({ popupHtml: committedDamagePopup, setPopupHtml });
    expect(setPopupHtml).not.toHaveBeenCalled();

    // Shield Bash rider arms the STR save prompt over the dwelling popup:
    // rerender surfaces the new pendingSavePrompts bucket value.
    _syncedStore.set('pendingSavePrompts', armedShieldBashPrompt);
    await act(async () => rerender(
      <DiceRollContext.Provider value={{ popupHtml: committedDamagePopup, setPopupHtml, _isShared: true }}>
        <CharActions playerStats={basePlayerStats} campaignName="test-campaign" spellModalState={{}} />
      </DiceRollContext.Provider>
    ));
    expect(setPopupHtml).toHaveBeenCalledWith(null);
  });

  it('riderless control commit (no chooser, no save prompt): the popup DWELLS untouched — Done/click dismissal intact', async () => {
    const setPopupHtml = vi.fn();
    await renderCharActions({ popupHtml: committedDamagePopup, setPopupHtml });
    expect(setPopupHtml).not.toHaveBeenCalled();
  });

  it('staged Done-pending face is NEVER auto-closed even with a chain overlay mounted (no silent void)', async () => {
    _syncedStore.set('pendingSavePrompts', armedShieldBashPrompt);
    const setPopupHtml = vi.fn();
    await renderCharActions({ popupHtml: stagedHitPopup, setPopupHtml, spellModalState: { attackRiderModal: riderChooser } });
    expect(setPopupHtml).not.toHaveBeenCalled();
  });

  it('an empty pendingSavePrompts bucket (drained chain) does not retire the committed popup', async () => {
    _syncedStore.set('pendingSavePrompts', {});
    const setPopupHtml = vi.fn();
    await renderCharActions({ popupHtml: committedDamagePopup, setPopupHtml });
    expect(setPopupHtml).not.toHaveBeenCalled();
  });

  it('the retire is a pure close: only setPopupHtml(null) fires — zero log rows, zero runtime writes', async () => {
    const logService = await import('../../services/ui/logService.js');
    const runtimeState = await import('../../hooks/runtime/useRuntimeState.js');
    _syncedStore.set('pendingSavePrompts', armedShieldBashPrompt);
    await renderCharActions({ popupHtml: committedDamagePopup, setPopupHtml: vi.fn() });
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });
});
