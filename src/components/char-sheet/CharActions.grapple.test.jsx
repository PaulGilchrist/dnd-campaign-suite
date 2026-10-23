// @maintained-by-ai
// CharActions grapple CLICK integration — owns only the component wiring lane:
// span click → useCharActionsBaseActions invoked with the component's props/mocks →
// observable popup + runtime-store write. All handleGrappleAction internals
// (already-grappled guard, contest resolution, monk-Dex, JoAT/advantage stacking,
// STR-mod fallbacks, log text) are owned by useCharActionsGrappleAction.test.js and
// useCharActionsBaseActions.grapple-contest-math.test.js; the Grapple-clickable-span
// contract is owned by CharActions.baseActions.test.jsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';

const _syncedStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getStore: vi.fn(() => _syncedStore),
  useSyncedState: vi.fn((_, key, defaultValue) => {
    const hasValue = _syncedStore.has(key);
    const value = hasValue ? _syncedStore.get(key) : defaultValue;
    const setter = vi.fn((newValue) => {
      _syncedStore.set(key, newValue);
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

// Realistic grapple stats: listed Athletics skill total +6 (STR 3 + prof 3).
const basePlayerStats = {
  name: 'TestCharacter', rules: '5e', level: 5, attacks: [], actions: [],
  spellAbilities: { spells: [], toHit: 5, saveDc: 13 },
  abilities: [{ name: 'Strength', bonus: 3, skills: [{ name: 'Athletics', bonus: 6 }] }],
  skillProficiencies: ['Athletics'], proficiency: 3,
};

// NPC target with only a STR mod resolvable → contest auto-resolves vs Athletics.
function npcTarget(name, strBonus) {
  return { name, conditions: [], type: 'npc', computedStats: { abilities: [{ name: 'Strength', bonus: strBonus }] } };
}

// Renders CharActions (base-actions loaded via mocked fetch), wires the grapple
// dependencies (popup sink via DiceRollContext, dice roll via useLoggedDiceRoll,
// combat summary/target via mocked services), then clicks the Grapple span.
async function renderGrappleAndClick({ cannotAct = false, target = npcTarget('Goblin', 1), lastAttack = null } = {}) {
  const setPopupHtml = vi.fn();
  const rollAbilityCheck = vi.fn().mockResolvedValue(undefined);

  getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'lastAttack') return lastAttack;
    if (key === 'activeBuffs') return [];
    if (key === 'hasteExtraActionUsed') return false;
    if (key === 'activeConditions') return [];
    return null;
  });
  loadCombatSummary.mockResolvedValue({ creatures: [target] });
  getTargetFromAttacker.mockReturnValue(target);
  useLoggedDiceRoll.mockReturnValue({
    popupHtml: null, setPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(),
    rollSkillCheck: vi.fn(), rollAbilityCheck, quickRollPlayerSave: vi.fn(),
  });

  const wrapper = ({ children }) => (
    <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml, rollAbilityCheck }}>
      {children}
    </DiceRollContext.Provider>
  );
  await act(async () => render(<CharActions playerStats={basePlayerStats} campaignName="test-campaign" cannotAct={cannotAct} />, { wrapper }));
  const grappleBtn = await waitFor(() => screen.getByText('Grapple'));
  await act(async () => { fireEvent.click(grappleBtn); });
  return { setPopupHtml, rollAbilityCheck };
}

describe('CharActions grapple click integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve(['Hide', 'Dash', 'Disengage', 'Dodge', 'Grapple']) });
    getRuntimeValue.mockImplementation(() => null);
  });

  it('clicking Grapple rolls Strength (Athletics) against the target contest and stamps grappled on success', async () => {
    const { setPopupHtml, rollAbilityCheck } = await renderGrappleAndClick({ lastAttack: { d20: 12, total: 18 } });

    expect(rollAbilityCheck).toHaveBeenCalledWith('Strength', 6, {});
    await waitFor(() => {
      expect(setPopupHtml).toHaveBeenCalledWith({
        type: 'automation_info',
        name: 'Grapple',
        description: 'Grapple successful! (d20: 12 + 6 = 18) vs Goblin Athletics (+1). Target is now grappled.',
      });
    });
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['grappled'], 'test-campaign');
  });

  it('clicking Grapple reports failure and leaves the target ungrappled when the check loses the contest', async () => {
    const { setPopupHtml, rollAbilityCheck } = await renderGrappleAndClick({ target: npcTarget('Ogre', 8), lastAttack: { d20: 1, total: 7 } });

    expect(rollAbilityCheck).toHaveBeenCalledWith('Strength', 6, {});
    await waitFor(() => {
      expect(setPopupHtml).toHaveBeenCalledWith({
        type: 'automation_info',
        name: 'Grapple',
        description: 'Grapple failed! (d20: 1 + 6 = 7) vs Ogre Athletics (+8). Target is not grappled.',
      });
    });
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Ogre', 'activeConditions', expect.arrayContaining(['grappled']), 'test-campaign');
  });

  it.each([
    { label: 'cannotAct prop silently blocks the click', cannotAct: true, target: npcTarget('Goblin', 1), expectedPopup: null },
    { label: 'no selected target prompts to select one', cannotAct: false, target: null, expectedPopup: { type: 'automation_info', name: 'Grapple', description: 'No target selected. Select a target in combat first.' } },
  ])('guard: $label', async ({ cannotAct, target, expectedPopup }) => {
    const { setPopupHtml, rollAbilityCheck } = await renderGrappleAndClick({ cannotAct, target });

    if (expectedPopup) {
      await waitFor(() => {
        expect(setPopupHtml).toHaveBeenCalledWith(expectedPopup);
      });
    } else {
      expect(setPopupHtml).not.toHaveBeenCalled();
    }
    expect(rollAbilityCheck).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'activeConditions', expect.arrayContaining(['grappled']), 'test-campaign');
  });
});
