// @maintained-by-ai 2026-11-27
// Component-seam lane for the weapon damage cell's simple (ungated) damage roll:
// CharActions -> REAL useSimpleDamageRoll -> mocked rollExpression/addEntry plus a
// spied DiceRollContext popup host. Owns: the log-row contract (regression pin for
// the double-.name defect), the popup replacement ORDER (open popup explicitly
// nulled before the damage face stages; no spurious null write when none is open),
// and the inert early-return when the roll fails. Attack-name-click roll bytes are
// owned by CharActions.rendering.test.jsx:276; the disclosure face by
// DiceRollResult.directDamageDisclosure.test.jsx; dwell/chain-retire presentation
// by attackDwell/damagePopupChainRetire. No hook-level unit test exists for
// useSimpleDamageRoll — this seam is its only coverage.
// Mock hygiene (events-lane recipe, run2 #1853): the phantom useSyncedState export
// on the useRuntimeState.js mock is DEAD CODE — CharActions.jsx imports
// useSyncedState from the real useSyncedState.js module (which runs here over the
// mocked getStore/setRuntimeValue/listeners primitives); the mirrored hand-rolled
// implementation is removed. getRuntimeValue/setRuntimeValue/useRuntimeValue stay:
// CharActions.jsx:4 imports them directly.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';
import { addEntry } from '../../services/ui/logService.js';
import { rollExpression } from '../../services/dice/diceRoller.js';
import { DIRECT_DAMAGE_ROLL_NOTE } from '../../hooks/combat/useSimpleDamageRoll.js';

const { DEFAULT_ROLL } = vi.hoisted(() => ({
  DEFAULT_ROLL: { total: 5, rolls: [3, 2], modifier: 0 },
}));

// Single backing Map: the REAL useSyncedState.js reads/writes it through the
// mocked getStore(); the mocked useRuntimeValue/getRuntimeValue share it.
const _syncedStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getStore: vi.fn(() => _syncedStore),
  listeners: new Map(),
  useRuntimeValue: vi.fn((_, key) => (_syncedStore.has(key) ? _syncedStore.get(key) : null)),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  // Return shape matches CharActions.jsx:216's own destructuring exactly.
  default: vi.fn(() => ({
    rollAttack: vi.fn(), rollDamage: vi.fn(), rollSkillCheck: vi.fn(), rollAbilityCheck: vi.fn(),
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
  rollExpression: vi.fn(() => DEFAULT_ROLL),
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
  name: 'TestCharacter', rules: '5e', level: 5, attacks: [], actions: [],
  spellAbilities: { spells: [], toHit: 5, saveDc: 13 },
  abilities: [{ name: 'STR', bonus: 3 }], proficiency: 3,
};

// ONE producer contract, asserted on both faces it stamps: the log row
// (type/characterName/rollType added) and the staged popup (type added).
const ROLL_CONTRACT = {
  name: 'Dagger',
  formula: '1d4+3',
  ...DEFAULT_ROLL,
  damageType: 'Piercing',
  note: DIRECT_DAMAGE_ROLL_NOTE,
};

function renderCharActions(stats, popupHtml, setPopupHtml) {
  globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve(['Hide', 'Dash', 'Disengage', 'Dodge', 'Grapple']) });
  return act(async () => {
    render(
      <DiceRollContext.Provider value={{ popupHtml, setPopupHtml }}>
        <CharActions playerStats={stats} campaignName="test-campaign" />
      </DiceRollContext.Provider>
    );
  });
}

describe('CharActions simple damage roll (weapon damage cell, no target)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
    // Re-seed the roll default after a test may have forced the roll to fail.
    vi.mocked(rollExpression).mockImplementation(() => DEFAULT_ROLL);
  });

  it.each([true, false])(
    'clicking a weapon damage cell logs the roll once and stages the damage popup (prior popup open: %s)',
    async (hadOpenPopup) => {
      const setPopupHtml = vi.fn();

      await renderCharActions(
        { ...basePlayerStats, attacks: [dagger] },
        hadOpenPopup ? { type: 'some-popup' } : null,
        setPopupHtml
      );

      await act(async () => { fireEvent.click(screen.getByText('1d4+3')); });

      await waitFor(() => expect(addEntry).toHaveBeenCalledTimes(1));
      // Exact log-row contract, incl. campaign threading and characterName as
      // the player's name (regression pin for the double-.name defect — callers
      // previously passed a string into useSimpleDamageRoll, which re-read .name
      // and logged characterName: undefined).
      expect(addEntry).toHaveBeenCalledWith('test-campaign', {
        type: 'roll',
        characterName: 'TestCharacter',
        rollType: 'damage',
        ...ROLL_CONTRACT,
      });
      // An open popup is explicitly closed BEFORE the new face stages; with no
      // prior popup there is no spurious null write.
      expect(setPopupHtml).toHaveBeenCalledTimes(hadOpenPopup ? 2 : 1);
      if (hadOpenPopup) {
        expect(setPopupHtml).toHaveBeenNthCalledWith(1, null);
      }
      expect(setPopupHtml).toHaveBeenLastCalledWith({ type: 'damage', ...ROLL_CONTRACT });
    }
  );

  it('clicking a weapon damage cell is inert when the roll fails — nothing logged, an open popup left untouched', async () => {
    const setPopupHtml = vi.fn();
    vi.mocked(rollExpression).mockReturnValue(null);

    // Open popup: proves the early-return precedes even the popup-close write.
    await renderCharActions({ ...basePlayerStats, attacks: [dagger] }, { type: 'some-popup' }, setPopupHtml);

    await act(async () => { fireEvent.click(screen.getByText('1d4+3')); });
    await act(async () => { await Promise.resolve(); });

    expect(addEntry).not.toHaveBeenCalled();
    expect(setPopupHtml).not.toHaveBeenCalled();
  });
});
