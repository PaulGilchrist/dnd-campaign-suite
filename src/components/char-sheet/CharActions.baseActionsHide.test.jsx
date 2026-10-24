// @maintained-by-ai
// Component-level click-lane coverage for CharActions' Hide & Dodge buttons:
// rendered buttons must reach their handlers with props wired (cannotAct gate,
// conditionEffects pass-through) and drive runtime-store reads/writes + logs.
// Branch logic (stealth bonus math, forcedMode selection, Skulker, Pass Without
// Trace, buff dedup, Dodge deactivate copy) is pinned at hook level in
// useCharActionsHideAction.test.js and useCharActionsDodgeAction.test.js —
// not re-pinned here.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { addEntry } from '../../services/ui/logService.js';
import { toggleBuff } from '../../services/automation/common/buffToggle.js';
import { addExpiration } from '../../services/rules/effects/expirations.js';

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

vi.mock('../../services/automation/common/buffToggle.js', () => ({
  toggleBuff: vi.fn(() => ({ wasActive: false })),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(() => Promise.resolve()),
}));

const CAMPAIGN = 'test-campaign';

const basePlayerStats = {
  name: 'TestCharacter', rules: '5e', level: 5, attacks: [], actions: [],
  spellAbilities: { spells: [], toHit: 5, saveDc: 13 },
  abilities: [{ name: 'STR', bonus: 3 }], proficiency: 3,
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

function makeStealthStats(bonus = 5) {
  const stats = createStats({ actions: ['Hide'], skillProficiencies: ['Stealth'], level: 5 });
  stats.abilities = [
    { name: 'Dexterity', bonus: 2, skills: [{ name: 'Stealth', bonus }] },
    { name: 'Strength', bonus: 0, skills: [] },
    { name: 'Constitution', bonus: 0, skills: [] },
    { name: 'Intelligence', bonus: 0, skills: [] },
    { name: 'Wisdom', bonus: 0, skills: [] },
    { name: 'Charisma', bonus: 0, skills: [] },
  ];
  return stats;
}

// Runtime-store stub: neutral state unless overridden (per-test condition seeds).
function stubRuntimeState({ conditions = [], lastAttack = null } = {}) {
  getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'activeConditions') return conditions;
    if (key === 'activeBuffs') return [];
    if (key === 'hasteExtraActionUsed') return false;
    if (_name === 'campaign' && key === 'lastAttack') return lastAttack;
    return null;
  });
}

// Wire the dice-roll hook lane; returns the two spies tests assert on.
function stubRollLane() {
  const setPopupHtml = vi.fn();
  const rollSkillCheck = vi.fn().mockResolvedValue(undefined);
  useLoggedDiceRoll.mockReturnValue({
    popupHtml: null, setPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(),
    rollSkillCheck, rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
  });
  return { setPopupHtml, rollSkillCheck };
}

function renderCharActions(props, setPopupHtml) {
  const Wrapper = ({ children }) => (
    <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml }}>
      {children}
    </DiceRollContext.Provider>
  );
  return act(async () => render(<CharActions campaignName={CAMPAIGN} {...props} />, { wrapper: Wrapper }));
}

function clickByText(text) {
  return act(async () => { fireEvent.click(screen.getByText(text)); });
}

describe('CharActions Hide/Dodge click lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve(['Hide', 'Dash', 'Disengage', 'Dodge', 'Grapple']) });
    stubRuntimeState();
  });

  it('Hide: already invisible shows a refusal popup without rolling, writing state, or logging', async () => {
    const { setPopupHtml, rollSkillCheck } = stubRollLane();
    stubRuntimeState({ conditions: ['invisible'] });

    await renderCharActions({ playerStats: createStats({ actions: ['Hide'] }) }, setPopupHtml);
    await clickByText('Hide');

    await waitFor(() => {
      expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Hide',
        description: expect.stringContaining('already hidden'),
      }));
    });
    expect(rollSkillCheck).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('Hide: successful Stealth roll (>= DC 15) adds invisible condition, advantage_on_stealth buff, and logs success', async () => {
    const { setPopupHtml, rollSkillCheck } = stubRollLane();
    stubRuntimeState({ lastAttack: { d20: 12, bonus: 5, total: 17 } });

    await renderCharActions({ playerStats: makeStealthStats(5) }, setPopupHtml);
    await clickByText('Hide');

    // Exact bonus pins playerStats skill data reaching the roll, empty context = no forced mode.
    await waitFor(() => {
      expect(rollSkillCheck).toHaveBeenCalledWith('Stealth', 5, {});
    });
    await waitFor(() => {
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'activeConditions', expect.arrayContaining(['invisible']), CAMPAIGN);
    });
    await waitFor(() => {
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'activeBuffs', expect.arrayContaining([{ name: 'Hide', effect: 'advantage_on_stealth' }]), CAMPAIGN);
    });
    await waitFor(() => {
      expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Hide',
        description: expect.stringContaining('Hide successful'),
      }));
    });
    await waitFor(() => {
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestCharacter',
        abilityName: 'Hide',
        description: expect.stringContaining('Success'),
      }));
    });
  });

  it('Hide: failed Stealth roll (< DC 15) pops failure, logs failure, and never writes the invisible condition', async () => {
    const { setPopupHtml, rollSkillCheck } = stubRollLane();
    stubRuntimeState({ lastAttack: { d20: 3, bonus: 5, total: 8 } });

    await renderCharActions({ playerStats: makeStealthStats(5) }, setPopupHtml);
    await clickByText('Hide');

    await waitFor(() => {
      expect(rollSkillCheck).toHaveBeenCalledWith('Stealth', 5, {});
    });
    await waitFor(() => {
      expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Hide',
        description: expect.stringContaining('Hide failed'),
      }));
    });
    await waitFor(() => {
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestCharacter',
        abilityName: 'Hide',
        description: expect.stringContaining('Failure'),
      }));
    });
    expect(setRuntimeValue).not.toHaveBeenCalledWith('TestCharacter', 'activeConditions', expect.arrayContaining(['invisible']), CAMPAIGN);
    expect(setRuntimeValue).not.toHaveBeenCalledWith('TestCharacter', 'activeBuffs', expect.arrayContaining([{ name: 'Hide', effect: 'advantage_on_stealth' }]), CAMPAIGN);
  });

  it('Hide: conditionEffects prop flows through to the Stealth roll context', async () => {
    const { setPopupHtml, rollSkillCheck } = stubRollLane();
    stubRuntimeState({ lastAttack: { d20: 12, bonus: 5, total: 17 } });

    await renderCharActions(
      { playerStats: makeStealthStats(5), conditionEffects: { hexAbilityCheckDisadvantage: true, hexAbilityCheckDisadvantageAbility: 'DEX' } },
      setPopupHtml
    );
    await clickByText('Hide');

    await waitFor(() => {
      expect(rollSkillCheck).toHaveBeenCalledWith('Stealth', 5, expect.objectContaining({ forcedMode: 'disadvantage' }));
    });
  });

  it('cannotAct gates both Hide and Dodge — clicks produce no rolls, buffs, popups, state writes, or logs', async () => {
    const { setPopupHtml, rollSkillCheck } = stubRollLane();

    await renderCharActions({ playerStats: makeStealthStats(5), cannotAct: true }, setPopupHtml);
    await clickByText('Hide');
    await clickByText('Dodge');

    await waitFor(() => {
      expect(rollSkillCheck).not.toHaveBeenCalled();
      expect(toggleBuff).not.toHaveBeenCalled();
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
    });
  });

  it('Dodge: activation toggles the dodge buff, schedules expiry, pops activated copy, and logs', async () => {
    const { setPopupHtml } = stubRollLane();
    toggleBuff.mockReturnValue({ wasActive: false });

    await renderCharActions({ playerStats: createStats() }, setPopupHtml);
    await clickByText('Dodge');

    await waitFor(() => {
      expect(toggleBuff).toHaveBeenCalledWith(
        'TestCharacter',
        'Dodge',
        { effect: 'dodge', duration: 'until_start_of_next_turn' },
        CAMPAIGN,
        'TestCharacter'
      );
    });
    await waitFor(() => {
      expect(addExpiration).toHaveBeenCalledWith({
        attackerName: 'TestCharacter', targetName: 'TestCharacter',
        effects: expect.any(Array), campaignName: CAMPAIGN,
        rounds: undefined, expireOnCreatureName: 'TestCharacter',
      });
    });
    await waitFor(() => {
      expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Dodge',
        description: expect.stringContaining('Dodge activated'),
      }));
    });
    await waitFor(() => {
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
        type: 'ability_use',
        abilityName: 'Dodge',
      }));
    });
  });
});
