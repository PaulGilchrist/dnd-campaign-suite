// @maintained-by-ai
// CharActions integration tests — the CLICK-WIRING seam only.
// Branch logic of handleAutomationAction (cannotAct gate internals, featureChoice
// modals, logEntries dispatch, onBuffsChange branches, null results) is covered
// precisely at the hook seam in useCharActionsAutomation.test.*.js files.
// CANONICAL OWNER: buildFeatureDetailHtml details-popup coverage lives here —
// do not duplicate it in automation.test.jsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';
import { executeHandler } from '../../services/automation/index.js';
import { addEntry } from '../../services/ui/logService.js';
import { buildFeatureDetailHtml } from '../../hooks/combat/useActionPopup.js';

const _syncedStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getStore: vi.fn(() => _syncedStore),
  useSyncedState: vi.fn((_ns, key, defaultValue) => {
    const hasValue = _syncedStore.has(key);
    return [hasValue ? _syncedStore.get(key) : defaultValue, vi.fn()];
  }),
  useRuntimeValue: vi.fn(() => null),
  listeners: new Map(),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    rollAttack: vi.fn(), rollDamage: vi.fn(), rollSkillCheck: vi.fn(), rollAbilityCheck: vi.fn(),
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
    resolveAttackDamage: vi.fn(), resumeAttackPipeline: vi.fn(),
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
  spellAbilities: { spells: [], toHit: 5, saveDc: 13 },
  abilities: [{ name: 'STR', bonus: 3 }], proficiency: 3,
};

function renderCharActions(stats, setPopupHtml, props = {}) {
  return render(
    <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml }}>
      <CharActions playerStats={stats} campaignName="test-campaign" {...props} />
    </DiceRollContext.Provider>
  );
}

async function clickActionRow(actionName) {
  await act(async () => { fireEvent.click(screen.getByText(`${actionName}:`)); });
}

describe('CharActions feature-row click wiring (integration)', () => {
  let setPopupHtml;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
    hasAutomation.mockReturnValue(false);
    setPopupHtml = vi.fn();
  });

  it('clicking an automation row executes the handler, renders the popup payload, logs entries, and refreshes buffs for buff types', async () => {
    hasAutomation.mockReturnValue(true);
    const logEntry = { type: 'ability_use', characterName: 'TestCharacter', abilityName: 'Test Action', description: 'Test log entry' };
    executeHandler.mockResolvedValue({ type: 'popup', payload: '<b>Done</b>', logEntries: [logEntry] });

    const onBuffsChange = vi.fn();
    const stats = { ...basePlayerStats, actions: [{ name: 'Test Action', description: 'Buffs up.', automation: { type: 'temp_buff' } }] };
    renderCharActions(stats, setPopupHtml, { onBuffsChange });

    await clickActionRow('Test Action');

    await waitFor(() => {
      expect(executeHandler).toHaveBeenCalledWith(stats.actions[0], stats, 'test-campaign', undefined, undefined);
      expect(setPopupHtml).toHaveBeenCalledWith('<b>Done</b>');
      expect(addEntry).toHaveBeenCalledWith('test-campaign', logEntry);
      expect(onBuffsChange).toHaveBeenCalled();
    });
  });

  it('clicking an automation row while cannotAct blocks everything — no handler, popup, or log', async () => {
    hasAutomation.mockReturnValue(true);
    executeHandler.mockResolvedValue({ type: 'popup', payload: 'Should not reach' });

    const onBuffsChange = vi.fn();
    const stats = { ...basePlayerStats, actions: [{ name: 'Test Action', description: 'Blocked.', automation: { type: 'auto_effect' } }] };
    renderCharActions(stats, setPopupHtml, { cannotAct: true, onBuffsChange });

    await clickActionRow('Test Action');

    expect(executeHandler).not.toHaveBeenCalled();
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(onBuffsChange).not.toHaveBeenCalled();
  });

  it('clicking a details-only row opens the feature detail popup built by buildFeatureDetailHtml and runs no automation', async () => {
    const action = { name: 'Tactical Genius', description: 'A smart move', details: 'Tactical details' };
    const stats = { ...basePlayerStats, actions: [action] };
    renderCharActions(stats, setPopupHtml);

    await clickActionRow('Tactical Genius');

    expect(buildFeatureDetailHtml).toHaveBeenCalledWith(action);
    expect(setPopupHtml).toHaveBeenCalledWith('<b>Tactical Genius</b><br/>A smart move<br/><br/>Tactical details');
    expect(executeHandler).not.toHaveBeenCalled();
  });
});
