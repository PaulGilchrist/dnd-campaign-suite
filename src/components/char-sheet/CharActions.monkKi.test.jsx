// @maintained-by-ai
// CharActions integration: monk Focus Point lane verified end-to-end by clicking the
// rendered feature rows on the sheet. The skip/spend/refuse decision matrix itself is
// unit-tested at the hook level (useCharActionsAutomation.test.js and
// useCharActionsAutomation.test.early-returns.js); this file pins only what only the
// component can prove: a real row click wires playerStats.specialActions, the
// cloak_of_shadows activeBuff, and the runtime store focusPoints write together.
//
// CLA-159: standalone 'Hand of Healing' ALWAYS charges 1 FP — the FP-free HoH
// exemption is only for HoH used AS PART of Flurry (bonusAttacksHandler lane,
// CLA-144/CLA-158). CLA-166: the row-click skip list is flurry rows only
// ('Flurry of Blows', 'Heightened Flurry of Blows').
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';
import { executeHandler } from '../../services/automation/index.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';

const _syncedStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
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
  hasAutomation: vi.fn(),
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

// Mount CharActions with one clickable auto_effect feature row and the given
// runtime state (stored focus points, activeBuffs) / specialActions / ruleset.
// Returns the DiceRollContext setPopupHtml spy so refusal popups are observable.
function mountCharActions({ actionName, specialActions = [], buffs = [], rules = '5e', focusPoints = 2 }) {
  getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'focusPoints') return focusPoints;
    if (key === 'activeBuffs') return buffs;
    return null;
  });

  const setPopupHtml = vi.fn();
  const playerStats = {
    name: 'TestCharacter',
    rules,
    level: 5,
    attacks: [],
    bonusActions: [],
    spellAbilities: { spells: [] },
    equipment: [],
    class: { class_levels: [{ level: 5, focus_points: 2 }] },
    actions: [{ name: actionName, description: 'Test action.', automation: { type: 'auto_effect' } }],
    ...(specialActions.length > 0 ? { specialActions: specialActions.map((name) => ({ name })) } : {}),
  };

  render(
    <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml }}>
      <CharActions playerStats={playerStats} campaignName="test-campaign" />
    </DiceRollContext.Provider>
  );
  return setPopupHtml;
}

async function clickActionRow(actionName) {
  await act(async () => { fireEvent.click(screen.getByText(`${actionName}:`)); });
}

describe('CharActions monk focus point lane (row-click integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
    hasAutomation.mockReturnValue(true);
    executeHandler.mockResolvedValue({ type: 'popup', payload: 'Action executed' });
  });

  // CLA-166 skip list vs CLA-159 charge: FP-free exemptions apply to flurry rows
  // ONLY; standalone Hand of Healing always charges 1 FP (from 2 to 1).
  it.each([
    { actionName: 'Flurry of Blows', exemption: 'Flurry of Healing and Harm', expectation: 'skips the focus point spend', specialActions: ['Flurry of Healing and Harm'], buffs: [], spendsFP: false },
    { actionName: 'Flurry of Blows', exemption: 'Cloak of Shadows', expectation: 'skips the focus point spend', specialActions: [], buffs: [{ effect: 'cloak_of_shadows' }], spendsFP: false },
    { actionName: 'Hand of Healing', exemption: 'Flurry of Healing and Harm', expectation: 'still spends 1 focus point (CLA-159)', specialActions: ['Flurry of Healing and Harm'], buffs: [], spendsFP: true },
    { actionName: 'Hand of Healing', exemption: 'Cloak of Shadows', expectation: 'still spends 1 focus point', specialActions: [], buffs: [{ effect: 'cloak_of_shadows' }], spendsFP: true },
  ])('clicking $actionName with $exemption active $expectation but always executes the action', async ({ actionName, specialActions, buffs, spendsFP }) => {
    mountCharActions({ actionName, specialActions, buffs });

    await clickActionRow(actionName);

    await waitFor(() => {
      expect(executeHandler).toHaveBeenCalled();
    });
    if (spendsFP) {
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'focusPoints', 1, 'test-campaign');
    } else {
      expect(setRuntimeValue).not.toHaveBeenCalledWith('TestCharacter', 'focusPoints', expect.any(Number), 'test-campaign');
    }
  });

  it('blocks a focus-spending row at 0 FP with a "No Focus Points remaining" popup for the 2024 ruleset', async () => {
    const setPopupHtml = mountCharActions({ actionName: 'Flurry of Blows', rules: '2024', focusPoints: 0 });

    await clickActionRow('Flurry of Blows');

    await waitFor(() => {
      expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('No Focus Points remaining'));
    });
    expect(executeHandler).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalledWith('TestCharacter', 'focusPoints', expect.any(Number), 'test-campaign');
  });
});
