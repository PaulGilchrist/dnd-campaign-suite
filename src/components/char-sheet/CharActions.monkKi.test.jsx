// @maintained-by-ai 2026-11-27
// CharActions monk Focus Point lane — component wiring only. The full
// skip/spend/refuse decision matrix is byte-pinned at the hook seam
// (useCharActionsAutomation.test.js 'Focus Point cost lane' +
// .test.early-returns.js). What ONLY the real mount can prove lives here:
// (1) a row click reaches the store with the component's OWN name/campaign
//     ('TestCharacter'/'test-campaign' — the hook seam uses TestFighter/'test-map');
// (2) playerStats.specialActions and the activeBuffs runtime read actually
//     thread into the hook (exempt Flurry spends nothing yet dispatches);
// (3) CLA-159 as amended by the HoH pre-spend-at-full-HP improve: standalone
//     'Hand of Healing' never pre-spends at row click (healingHandler
//     .performMonkHeal is the sole FP writer; the seam keeps only the
//     exhausted-pool gate);
// (4) an exhausted pool blocks the click end-to-end (popup + zero dispatch).
// The exemption skip list is flurry rows ONLY (CLA-166); the FP-free HoH
// exemption applies only to HoH inside Flurry (bonusAttacksHandler lane).
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

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn(() => ({ saveDcBonus: 0 })),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
  getAttackerTargetName: vi.fn(() => null),
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

// focusPoints writes only (other runtime lanes may legitimately write).
const focusWrites = () => setRuntimeValue.mock.calls.filter(([, key]) => key === 'focusPoints');

describe('CharActions monk focus point lane (row-click component wiring)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
    hasAutomation.mockReturnValue(true);
    executeHandler.mockResolvedValue({ type: 'popup', payload: 'Action executed' });
  });

  it('pre-spends exactly 1 Focus Point with the sheet-owned name/campaign before dispatching a Ki row', async () => {
    mountCharActions({ actionName: 'Flurry of Blows' });

    await clickActionRow('Flurry of Blows');

    await waitFor(() => {
      expect(executeHandler).toHaveBeenCalledTimes(1);
    });
    expect(focusWrites()).toEqual([['TestCharacter', 'focusPoints', 1, 'test-campaign']]);
  });

  // CLA-166 skip list vs CLA-159: exemptions apply to flurry rows ONLY. Proves
  // the two exemption feeds (playerStats.specialActions / activeBuffs runtime
  // read) survive the real mount: with 2 FP banked the click spends NOTHING and
  // still dispatches once. (Hook seam covers FP=0 and the
  // Heightened-Flurry/array-membership twin.)
  it.each([
    { exemption: 'Flurry of Healing and Harm', specialActions: ['Flurry of Healing and Harm'], buffs: [] },
    { exemption: 'Cloak of Shadows', specialActions: [], buffs: [{ effect: 'cloak_of_shadows' }] },
  ])('skips the spend for Flurry of Blows at FP=2 when $exemption is active, yet dispatches', async ({ specialActions, buffs }) => {
    mountCharActions({ actionName: 'Flurry of Blows', specialActions, buffs });

    await clickActionRow('Flurry of Blows');

    await waitFor(() => {
      expect(executeHandler).toHaveBeenCalledTimes(1);
    });
    expect(focusWrites()).toHaveLength(0);
  });

  it('never pre-spends for standalone Hand of Healing (commit lane is the sole FP writer)', async () => {
    // At FP=2 with NO exemption active: any spend here would have to come from
    // this seam, so a zero-write proves the CLA-159 retire, not a skip-list hit.
    mountCharActions({ actionName: 'Hand of Healing' });

    await clickActionRow('Hand of Healing');

    await waitFor(() => {
      expect(executeHandler).toHaveBeenCalledTimes(1);
    });
    expect(focusWrites()).toHaveLength(0);
  });

  it('blocks a focus-spending row at 0 FP with an exhausted-pool popup and zero dispatch', async () => {
    const setPopupHtml = mountCharActions({ actionName: 'Flurry of Blows', rules: '2024', focusPoints: 0 });

    await clickActionRow('Flurry of Blows');

    // Ruleset wording (5e/2024) is byte-pinned at the hook seam; shape only here.
    await waitFor(() => {
      expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('No Focus Points remaining'));
    });
    expect(executeHandler).not.toHaveBeenCalled();
    expect(focusWrites()).toHaveLength(0);
  });
});
