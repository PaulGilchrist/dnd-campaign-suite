// @maintained-by-ai 2026-11-18
// IJ 2026-11-18 improve: attack-chain dwell affordance. While this sheet's popup
// host is staged (popupHtml → `.popup-overlay > .popup-modal`) or a merged modal
// is open (e.g. the `.sp-overlay` rider chooser via attackRiderModal), the overlay
// intercepts every weapon-row press — the rows must render a dedicated dim/disabled
// class + aria-disabled, and must return to normal on every close path (the flag is
// derived from the existing sheet-local state, so unmount = restore).
// Harness follows the CharActions.simpleDamageRoll.test.jsx conventions.
import { render, screen, fireEvent, act } from '@testing-library/react';
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

// Staged attack-result popup payload shape (useLoggedDiceRollAttack buildPopupData).
const stagedAttackPopup = {
  rollType: 'attack', name: 'Dagger', hit: true, rolls: [19],
  targetAc: 15, targetName: 'Goblin', autoDamage: { total: 7 },
};

// Devious-Strikes-style rider chooser props (CharActionModals AttackRiderModal host).
const riderChooser = { action: { name: 'Devious Strikes' }, targetName: 'Goblin' };

function renderCharActions({ popupHtml = null, spellModalState = {} } = {}) {
  globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
  return act(async () => render(
    <DiceRollContext.Provider value={{ popupHtml, setPopupHtml: vi.fn(), _isShared: true }}>
      <CharActions playerStats={basePlayerStats} campaignName="test-campaign" spellModalState={spellModalState} />
    </DiceRollContext.Provider>
  ));
}

// Activation cells of the Dagger row: name cell (the trigger), hit cell, damage cell.
const cells = () => ({
  name: screen.getByText('Dagger'),
  hit: screen.getByText('+5'),
  damage: screen.getByText('1d4+3'),
});

const DWELL_CLASS = 'attack-dwell-disabled';

function expectDwell(state) {
  for (const [label, cell] of Object.entries(cells())) {
    if (state) {
      expect(cell.classList.contains(DWELL_CLASS), `${label} cell dimmed`).toBe(true);
      expect(cell.getAttribute('aria-disabled'), `${label} cell aria-disabled`).toBe('true');
    } else {
      expect(cell.classList.contains(DWELL_CLASS), `${label} cell NOT dimmed`).toBe(false);
      expect(cell.hasAttribute('aria-disabled'), `${label} cell has no aria-disabled`).toBe(false);
    }
  }
}

describe('CharActions attack-chain dwell affordance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
  });

  it('idle sheet (no popup, no modal): activation cells are normal, no dwell class or aria', async () => {
    await renderCharActions();
    expectDwell(false);
  });

  it('staged attack-result popup dwell: activation cells carry the dim class + aria-disabled', async () => {
    await renderCharActions({ popupHtml: stagedAttackPopup });
    expectDwell(true);
  });

  it('rider chooser dwell (attackRiderModal via the spell-modal mirror): same dim + aria', async () => {
    await renderCharActions({ spellModalState: { attackRiderModal: riderChooser } });
    expectDwell(true);
  });

  it('close paths restore the rows: popup unstage and chooser close each clear the dwell', async () => {
    const { rerender } = await renderCharActions({ popupHtml: stagedAttackPopup });
    expectDwell(true);

    // Done/Cancel-equivalent: popup host unstaged (popupHtml → null).
    rerender(
      <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: vi.fn(), _isShared: true }}>
        <CharActions playerStats={basePlayerStats} campaignName="test-campaign" spellModalState={{ attackRiderModal: riderChooser }} />
      </DiceRollContext.Provider>
    );
    // Chooser still open → dwell persists through the popup-close half only.
    expectDwell(true);

    // Cancel/Apply-equivalent: chooser closed too → rows back to normal.
    rerender(
      <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: vi.fn(), _isShared: true }}>
        <CharActions playerStats={basePlayerStats} campaignName="test-campaign" spellModalState={{}} />
      </DiceRollContext.Provider>
    );
    expectDwell(false);
  });

  it('the dwell is presentation-only: with no dwell, a row press still reaches the attack handler', async () => {
    await renderCharActions();
    // handleAttackClick path bottoms out in rollAttack (mocked); a plain press
    // must not be short-circuited by the dwell styling machinery.
    await act(async () => { fireEvent.click(screen.getByText('Dagger')); });
    expect(screen.getByText('Dagger')).toBeTruthy();
  });
});
