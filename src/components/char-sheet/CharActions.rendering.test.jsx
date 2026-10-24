// @maintained-by-ai
// CharActions: section rendering + attack-name click contract.
// Deliberately NOT covered here (pinned by siblings):
// - base-actions row text/clickables → CharActions.baseActions.test.jsx
// - attack-context build rejection/recovery → CharActions.handlers.test.jsx
// - disabled-attack row cell states → CharActions.sacredWeapon2024.test.jsx
// - popup/event bus behaviour → CharActions.events.test.jsx
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { endFriendsOnHostileAction } from '../../services/rules/features/friendsService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';

const _syncedStore = new Map();
const mockRollAttack = vi.fn();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getStore: vi.fn(() => _syncedStore),
  useSyncedState: vi.fn((_, key, defaultValue) => {
    const hasValue = _syncedStore.has(key);
    const value = hasValue ? _syncedStore.get(key) : defaultValue;
    const setter = vi.fn((newValue) => {
      _syncedStore.set(key, typeof newValue === 'function' ? newValue(value) : newValue);
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
    popupHtml: null, setPopupHtml: vi.fn(), rollAttack: mockRollAttack, rollDamage: vi.fn(),
    rollSkillCheck: vi.fn(), rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
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

const basePlayerStats = {
  name: 'TestCharacter', rules: '5e', level: 5, attacks: [], actions: [],
  automation: { passives: [] },
  spellAbilities: { spells: [], toHit: 5, saveDc: 13 },
  abilities: [{ name: 'STR', bonus: 3 }], proficiency: 3,
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

const longsword = { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' };
const shortbow = { name: 'Shortbow', range: 80, hitBonus: 5, damage: '1d6+3', damageType: 'Piercing', type: 'Action' };

describe('CharActions rendering and attack click', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
    getRuntimeValue.mockImplementation(() => null);
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve(['Hide', 'Dash', 'Disengage', 'Dodge', 'Grapple']) });
  });

  it.each([
    { cannotAct: false, cannotActReason: undefined, expectedLabel: null },
    { cannotAct: true, cannotActReason: undefined, expectedLabel: '(Incapacitated)' },
    { cannotAct: true, cannotActReason: 'Stunned', expectedLabel: '(Stunned)' },
  ])('shows $expectedLabel in the cannot-act label (cannotAct=$cannotAct)', async ({ cannotAct, cannotActReason, expectedLabel }) => {
    await act(async () => { render(<CharActions playerStats={createStats()} cannotAct={cannotAct} cannotActReason={cannotActReason} />); });
    const label = document.querySelector('.disabled-attack-label');
    if (expectedLabel) {
      expect(label).not.toBeNull();
      expect(label).toHaveTextContent(expectedLabel);
    } else {
      expect(label).toBeNull();
    }
  });

  it('renders one row per Action attack with clickable name, range, hit, damage and damage type', async () => {
    const stats = createStats({ attacks: [longsword, shortbow] });
    await act(async () => { render(<CharActions playerStats={stats} />); });

    expect(screen.getByText('Longsword')).toHaveClass('clickable');
    expect(screen.getByText('Shortbow')).toHaveClass('clickable');
    expect(screen.getByText('5 ft.')).toBeInTheDocument();
    expect(screen.getByText('80 ft.')).toBeInTheDocument();
    expect(screen.getAllByText('+5')).toHaveLength(2);
    expect(screen.getByText('1d8+3')).toBeInTheDocument();
    expect(screen.getByText('1d6+3')).toBeInTheDocument();
    expect(screen.getByText('Slashing')).toBeInTheDocument();
    expect(screen.getByText('Piercing')).toBeInTheDocument();
  });

  it.each([
    { rules: '2024', passives: [{ type: 'weapon_kind_mastery' }], enabled: true },
    { rules: '2024', passives: [], enabled: false },
    { rules: '5e', passives: [{ type: 'weapon_kind_mastery' }], enabled: false },
  ])('enables the mastery column class only for 2024 rules with the passive (rules=$rules)', async ({ rules, passives, enabled }) => {
    await act(async () => { render(<CharActions playerStats={createStats({ rules, automation: { passives } })} />); });
    const attacksDiv = document.querySelector('.attacks');
    expect(attacksDiv).not.toBeNull();
    if (enabled) {
      expect(attacksDiv).toHaveClass('mastery-enabled');
    } else {
      expect(attacksDiv).not.toHaveClass('mastery-enabled');
    }
  });

  it('clicking an attack name rolls the attack and ends Friends/Invisibility', async () => {
    const stats = createStats({ attacks: [longsword] });
    await act(async () => { render(<CharActions playerStats={stats} />); });
    await act(async () => { fireEvent.click(screen.getByText('Longsword')); });

    expect(mockRollAttack).toHaveBeenCalledTimes(1);
    expect(mockRollAttack).toHaveBeenCalledWith('Longsword', 5, { hitBonus: 5 });
    expect(endFriendsOnHostileAction).toHaveBeenCalledWith('TestCharacter', undefined);
    expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestCharacter', undefined);
  });

  it.each([
    { action: { name: 'TestAction', details: 'Some details', description: 'A description', automation: null }, clickable: true },
    { action: { name: 'PlainAction', description: 'Plain description' }, clickable: false },
  ])('renders feature action "$action.name" clickable=$clickable', async ({ action, clickable }) => {
    await act(async () => { render(<CharActions playerStats={createStats({ actions: [action] })} />); });
    const row = screen.getByText(`${action.name}:`);
    if (clickable) {
      expect(row).toHaveClass('clickable');
    } else {
      expect(row).not.toHaveClass('clickable');
    }
  });
});
