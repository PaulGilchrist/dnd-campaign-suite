// @maintained-by-ai
// CharSheet RENDER prop-flow lane. computeConditionEffects (service) is mocked;
// computeCharConditionEffects in CharSheet.conditionEffects.js runs for real, so
// tests here pin how its outputs reach child components plus the sheet-side
// post-compute feature flags (Elusive / Alert) this lane owns.
//
// Lane split (do not re-add here):
//   - CLA-218 mageHand gating  -> CharSheet.conditionEffects.mageHand.test.js
//   - SP-111 action-block rider -> CharSheet.conditionEffects.stinkingBlock.test.js
//   - buff additive/override logic -> CharSheet.rendering-effects.test.jsx
//   - exhaustionLevel clamping -> CharSheet.rendering-state.test.jsx
// ---------------------------------------------------------------------------

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CharSheet from './CharSheet';
import rulesFactory from '../../services/rules/rulesFactory.js';
import {
  createMockStore,
  createDefaultProps,
  createMockPlayerStats,
  createSharedPopupReturnValue,
  resetTestState,
} from './CharSheet.test-utils.jsx';

// ---------------------------------------------------------------------------
// Mocks — child components
// ---------------------------------------------------------------------------

vi.mock('./char-summary/CharSummary.jsx', () => ({
  default: vi.fn(({ playerStats, conditionEffects, exhaustionLevel }) => (
    <div data-testid="char-summary">
      <span>{playerStats?.name || 'none'}</span>
      {conditionEffects && <span data-testid="condition-effects">{JSON.stringify(conditionEffects)}</span>}
      <span data-testid="exhaustion-level">{exhaustionLevel}</span>
    </div>
  )),
}));

vi.mock('./CharAbilities.jsx', () => ({
  default: vi.fn(({ playerStats, conditionEffects, isRaging, exhaustionPenalty }) => (
    <div data-testid="char-abilities">
      <span>{playerStats?.name || 'none'}</span>
      {conditionEffects && <span data-testid="abilities-condition-effects">{JSON.stringify(conditionEffects)}</span>}
      <span data-testid="is-raging">{String(isRaging)}</span>
      <span data-testid="exhaustion-penalty">{exhaustionPenalty}</span>
    </div>
  )),
}));

vi.mock('./CharActions.jsx', () => ({
  default: vi.fn(({ playerStats, cannotAct, conditionAttackMode }) => (
    <div data-testid="char-actions">
      <span>{playerStats?.name || 'none'}</span>
      <span data-testid="cannot-act">{String(cannotAct)}</span>
      <span data-testid="attack-mode">{conditionAttackMode}</span>
    </div>
  )),
}));

vi.mock('./CharInventory.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-inventory"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharReactions.jsx', () => ({
  default: vi.fn(({ cannotAct }) => (
    <div data-testid="char-reactions">
      <span data-testid="reactions-cannot-act">{String(cannotAct)}</span>
    </div>
  )),
}));

vi.mock('./CharSpecialActions.jsx', () => ({
  default: vi.fn(({ cannotAct }) => (
    <div data-testid="char-special-actions">
      <span data-testid="special-actions-cannot-act">{String(cannotAct)}</span>
    </div>
  )),
}));

vi.mock('./CharCharacterAdvancement.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-character-advancement"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./char-spells/CharSpells.jsx', () => ({
  default: vi.fn(({ playerStats, cannotAct, conditionAttackMode }) => (
    <div data-testid="char-spells">
      <span>{playerStats?.name || 'none'}</span>
      <span data-testid="spells-cannot-act">{String(cannotAct)}</span>
      <span data-testid="spells-attack-mode">{conditionAttackMode}</span>
    </div>
  )),
}));

// ---------------------------------------------------------------------------
// Mocks — services
// ---------------------------------------------------------------------------

vi.mock('../../services/automation/handlers/shieldOfFaithHandler.js', () => ({
  applyShieldOfFaith: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraComboEffects.js', () => ({
  computeAuraComboEffects: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn().mockImplementation(() => ({
    attackAdvantageCount: 0,
    attackDisadvantageCount: 0,
    autoReroll: false,
    autoRerollCondition: null,
    autoRerollBonus: null,
    cannotAct: false,
  })),
  getNetAttackMode: vi.fn().mockReturnValue('normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn().mockReturnValue({ creatures: [] }),
  loadCombatSummary: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => expr),
}));

vi.mock('../../services/automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isCreatureWarded: vi.fn().mockReturnValue(false),
}));

vi.mock('../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
  getHolyAuraTargets: vi.fn().mockReturnValue(false),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn().mockReturnValue(null),
}));

vi.mock('../../services/rules/spells/empoweredSpellService.js', () => ({
  executeEmpoweredReroll: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  getManeuversForRules: vi.fn().mockResolvedValue([]),
  getSuperiorityDice: vi.fn().mockReturnValue(0),
}));

vi.mock('../../services/ui/storage.js', () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    getProperty: vi.fn().mockResolvedValue(null),
    setProperty: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="secondary-target-modal">modal</div>),
}));

vi.mock('./modals/PolymorphSelectionModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="polymorph-selection-modal">modal</div>),
}));

vi.mock('./modals/AnimalShapesSelectionModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="animal-shapes-selection-modal">modal</div>),
}));

vi.mock('./modals/ObjectTransformModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="object-transform-modal">modal</div>),
}));

vi.mock('../common/popup.jsx', () => ({
  default: vi.fn(({ children }) => <div data-testid="popup">{children}</div>),
}));

vi.mock('../common/AttackResultPopup.jsx', () => ({
  default: vi.fn((props) => (
    <div data-testid="attack-result-popup">
      <span>{props.popupHtml?.name || 'Attack'}</span>
    </div>
  )),
}));

// ---------------------------------------------------------------------------
// Mocks — hooks (uses shared test-utils helpers)
// ---------------------------------------------------------------------------

const mockStore = createMockStore();

let sharedPopupReturnVal = createSharedPopupReturnValue();

vi.mock('../../hooks/combat/useSharedPopup.js', () => {
  const mockFn = vi.fn();
  mockFn.mockImplementation(() => {
    return { ...sharedPopupReturnVal, Provider: ({ children }) => children };
  });
  return { default: mockFn };
});

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => mockStore),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn((key, prop) => mockStore.get(prop) ?? null),
  setRuntimeValue: vi.fn((_key, prop, _val, _camp) => mockStore.set(prop, _val)),
  useRuntimeValue: vi.fn((key, prop) => {
    if (prop === 'exhaustionLevel') return mockStore.get('exhaustionLevel') ?? 0;
    const defaults = {
      activeConditions: [],
      activeBuffs: [],
      targetEffects: [],
      bardicInspirationGrantedBy: 'unknown',
      indomitableUses: 0,
      bardicInspirationUses: 0,
      secondWindUses: 0,
      superiorityDice: 0,
      psionicEnergy: 0,
    };
    const def = Object.prototype.hasOwnProperty.call(defaults, prop) ? defaults[prop] : null;
    return mockStore.get(prop) ?? def;
  }),
}));

vi.mock('../../services/rules/rulesFactory.js', () => ({
  default: {
    getPlayerStats: vi.fn().mockImplementation(() => Promise.resolve(createMockPlayerStats())),
  },
}));

// ---------------------------------------------------------------------------
// Tests — prop flow out of computeCharConditionEffects into children
// ---------------------------------------------------------------------------

describe('CharSheet condition effects prop flow', () => {
  beforeEach(() => {
    resetTestState(sharedPopupReturnVal);
    mockStore.clear();
  });

  const renderSheet = async () => {
    render(<CharSheet {...createDefaultProps()} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  };

  // CharActions/CharSpells/CharSpecialActions receive cannotActActions; CharReactions
  // receives the condition-only cannotAct. Both derive inside computeCharConditionEffects
  // from stored activeConditions and/or the mocked service's cannotAct — a service-only
  // block must still leave Reactions free (render-side half of the cannotAct split).
  it.each([
    { label: 'paralyzed condition blocks all children', conditions: ['paralyzed'], serviceCannotAct: false, expected: 'true', reactionsExpected: 'true' },
    { label: 'service-reported cannotAct blocks actions but not reactions', conditions: [], serviceCannotAct: true, expected: 'true', reactionsExpected: 'false' },
    { label: 'no conditions leaves all children free', conditions: [], serviceCannotAct: false, expected: 'false', reactionsExpected: 'false' },
  ])('cannotAct=$expected on actions/spells (reactions=$reactionsExpected) — $label', async ({ conditions, serviceCannotAct, expected, reactionsExpected }) => {
    mockStore.set('activeConditions', conditions);
    const { computeConditionEffects } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockImplementation(() => ({ cannotAct: serviceCannotAct }));

    await renderSheet();

    expect(screen.getByTestId('cannot-act')).toHaveTextContent(expected);
    expect(screen.getByTestId('reactions-cannot-act')).toHaveTextContent(reactionsExpected);
    expect(screen.getByTestId('special-actions-cannot-act')).toHaveTextContent(expected);
    expect(screen.getByTestId('spells-cannot-act')).toHaveTextContent(expected);
  });

  it('plumbs net attack mode and the full conditionEffects object to CharActions, CharSpells, CharSummary and CharAbilities', async () => {
    const effects = {
      attackAdvantageCount: 2,
      attackDisadvantageCount: 1,
      autoReroll: true,
      autoRerollBonus: '1d4',
      shieldAcBonus: 5,
    };
    mockStore.set('activeConditions', []);
    const { computeConditionEffects, getNetAttackMode } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockImplementation(() => ({ ...effects }));
    getNetAttackMode.mockReturnValue('advantage');

    await renderSheet();

    expect(getNetAttackMode).toHaveBeenCalledWith(2, 1, undefined);
    expect(screen.getByTestId('attack-mode')).toHaveTextContent('advantage');
    expect(screen.getByTestId('spells-attack-mode')).toHaveTextContent('advantage');
    expect(JSON.parse(screen.getByTestId('condition-effects').textContent)).toEqual(effects);
    expect(JSON.parse(screen.getByTestId('abilities-condition-effects').textContent)).toEqual(effects);
  });

  // Sheet-side post-compute flags in CharSheet.conditionEffects.js. Elusive stamps
  // noAdvantageAgainst via hasElusiveFeature(playerStats) unless an Incapacitating
  // condition applies; Alert stamps it via the unseenAttackerAdvantageNegate flag.
  // (computeConditionEffects stays mocked — Elusive must be stamped by the sheet lane,
  // not by the compute mock, or the feature logic is not what's under test.)
  it.each([
    { label: 'Elusive and not incapacitated', stats: { actions: [{ name: 'Elusive' }] }, conditions: [], expected: true },
    { label: 'Elusive but incapacitated', stats: { actions: [{ name: 'Elusive' }] }, conditions: ['incapacitated'], expected: false },
    { label: 'Alert negates unseen-attacker advantage', stats: { unseenAttackerAdvantageNegate: true }, conditions: [], expected: true },
    { label: 'neither Elusive nor Alert', stats: {}, conditions: [], expected: false },
  ])('noAdvantageAgainst=$expected — $label', async ({ stats, conditions, expected }) => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(createMockPlayerStats(stats)));
    mockStore.set('activeConditions', conditions);
    const { computeConditionEffects } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockImplementation(() => ({}));

    await renderSheet();

    const effects = JSON.parse(screen.getByTestId('condition-effects').textContent);
    if (expected) {
      expect(effects.noAdvantageAgainst).toBe(true);
    } else {
      expect(effects.noAdvantageAgainst).toBeFalsy();
    }
  });

  // CharSummary gets exhaustionLevel (= penalty / 2), CharAbilities the doubled
  // exhaustionPenalty. Non-zero stored level pins both scaling directions.
  it('scales exhaustion props from the stored exhaustionLevel (summary=level, abilities=2x level)', async () => {
    mockStore.set('activeConditions', []);
    mockStore.set('exhaustionLevel', 2);

    await renderSheet();

    expect(screen.getByTestId('exhaustion-level')).toHaveTextContent('2');
    expect(screen.getByTestId('exhaustion-penalty')).toHaveTextContent('4');
  });

  // CLA-209 regression: hasPowerfulBuild and saveModifiers must be forwarded to
  // computeConditionEffects so the powerful_build_grapple_escape advantage applies there.
  it('forwards hasPowerfulBuild and saveModifiers to computeConditionEffects (CLA-209)', async () => {
    const grappleModifier = { source: 'Powerful Build', target: 'ability_check', condition: 'powerful_build_grapple_escape', effect: 'advantage', abilities: ['STR'] };
    const stats = createMockPlayerStats({ hasPowerfulBuild: true, saveModifiers: [grappleModifier] });
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(stats));
    mockStore.set('activeConditions', ['grappled']);
    const { computeConditionEffects } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockImplementation(() => ({ abilityCheckAdvantageAbilities: ['STR'] }));

    await renderSheet();

    const options = computeConditionEffects.mock.calls[0][0];
    expect(options.hasPowerfulBuild).toBe(true);
    expect(options.saveModifiers).toContainEqual(grappleModifier);
  });
});
