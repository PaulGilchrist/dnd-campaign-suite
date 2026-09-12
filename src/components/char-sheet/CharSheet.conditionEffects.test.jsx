// @improved-by-ai
// @cleaned-by-ai
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
    if (prop === 'exhaustionLevel') return 0;
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
// Tests — condition effects flow through computeCharConditionEffects
//
// Note: Individual buff-specific condition effect propagation tests
// (shield, haste, reckless attack, Zealous Presence, Cloak of Shadows, etc.)
// are covered in CharSheet.rendering-effects.test.jsx. This file focuses on
// the core cannotAct/conditionAttackMode/exhaustion flow and unique logic
// (Elusive feature integration).
// ---------------------------------------------------------------------------

describe('CharSheet condition effects computation', () => {
  beforeEach(() => {
    resetTestState(sharedPopupReturnVal);
    mockStore.clear();
  });

  it('renders the char-sheet when playerStats loads successfully', async () => {
    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    expect(CharSummary).toHaveBeenCalled();
    const { playerStats, conditionEffects } = CharSummary.mock.calls[0][0];
    expect(playerStats.name).toBe('Test Character');
    expect(conditionEffects).toBeDefined();
  });

  it('passes cannotAct=true to child components when paralyzed condition is active', async () => {
    mockStore.set('activeConditions', ['paralyzed']);
    const { computeConditionEffects } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockImplementation(() => ({ cannotAct: true }));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharActions } = await import('./CharActions.jsx');
    expect(CharActions).toHaveBeenCalled();
    expect(CharActions.mock.calls[0][0].cannotAct).toBe(true);

    const { default: CharReactions } = await import('./CharReactions.jsx');
    expect(CharReactions).toHaveBeenCalled();
    expect(CharReactions.mock.calls[0][0].cannotAct).toBe(true);

    const { default: CharSpecialActions } = await import('./CharSpecialActions.jsx');
    expect(CharSpecialActions).toHaveBeenCalled();
    expect(CharSpecialActions.mock.calls[0][0].cannotAct).toBe(true);

    const { default: CharSpells } = await import('./char-spells/CharSpells.jsx');
    expect(CharSpells).toHaveBeenCalled();
    expect(CharSpells.mock.calls[0][0].cannotAct).toBe(true);
  });

  it('passes cannotAct=false when no incapacitating condition is active', async () => {
    mockStore.set('activeConditions', []);
    const { computeConditionEffects } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockImplementation(() => ({ cannotAct: false }));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharActions } = await import('./CharActions.jsx');
    expect(CharActions.mock.calls[0][0].cannotAct).toBe(false);
  });

  it('passes conditionAttackMode to CharAbilities and CharActions', async () => {
    mockStore.set('activeConditions', []);
    const { computeConditionEffects, getNetAttackMode } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockImplementation(() => ({ attackAdvantageCount: 1, attackDisadvantageCount: 0 }));
    getNetAttackMode.mockReturnValue('advantage');

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharActions } = await import('./CharActions.jsx');
    expect(CharActions.mock.calls[0][0].conditionAttackMode).toBe('advantage');

    const { default: CharAbilities } = await import('./CharAbilities.jsx');
    expect(CharAbilities).toHaveBeenCalled();
    expect(CharAbilities.mock.calls[0][0].conditionEffects).toBeDefined();
  });

  it('passes conditionEffects object to CharSummary and CharAbilities', async () => {
    mockStore.set('activeConditions', []);
    const { computeConditionEffects } = await import('../../services/combat/conditions/conditionEffects.js');
    const expectedEffects = {
      attackAdvantageCount: 2,
      attackDisadvantageCount: 1,
      autoReroll: true,
      autoRerollBonus: '1d4',
      shieldAcBonus: 5,
      magicMissileImmune: true,
    };
    computeConditionEffects.mockImplementation(() => ({ ...expectedEffects }));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    expect(CharSummary.mock.calls[0][0].conditionEffects).toEqual(expectedEffects);

    const { default: CharAbilities } = await import('./CharAbilities.jsx');
    expect(CharAbilities.mock.calls[0][0].conditionEffects).toEqual(expectedEffects);
  });

  it('passes noAdvantageAgainst when Elusive feature is active and not incapacitated', async () => {
    const stats = createMockPlayerStats({
      actions: [{ name: 'Elusive' }],
    });
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(stats));
    mockStore.set('activeBuffs', []);
    mockStore.set('activeConditions', []);
    const { computeConditionEffects } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockImplementation(() => ({ noAdvantageAgainst: true }));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    const effects = CharSummary.mock.calls[0][0].conditionEffects;
    expect(effects.noAdvantageAgainst).toBe(true);
  });

  it('does not set noAdvantageAgainst from Elusive when incapacitated', async () => {
    const stats = createMockPlayerStats({
      actions: [{ name: 'Elusive' }],
    });
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(stats));
    mockStore.set('activeBuffs', []);
    mockStore.set('activeConditions', ['incapacitated']);
    const { computeConditionEffects } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockImplementation(() => ({}));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    const effects = CharSummary.mock.calls[0][0].conditionEffects;
    expect(effects.noAdvantageAgainst).toBeFalsy();
  });

  it('passes exhaustionPenalty to CharSummary and CharAbilities', async () => {
    mockStore.set('activeConditions', []);
    mockStore.set('activeBuffs', []);
    const { computeConditionEffects } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockImplementation(() => ({}));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    expect(CharSummary.mock.calls[0][0].exhaustionLevel).toBe(0);

    const { default: CharAbilities } = await import('./CharAbilities.jsx');
    expect(CharAbilities.mock.calls[0][0].exhaustionPenalty).toBe(0);
  });

  // CLA-209 regression: hasPowerfulBuild must be forwarded to computeConditionEffects
  // (options.hasPowerfulBuild) so the powerful_build_grapple_escape save modifier can apply there.
  it('forwards hasPowerfulBuild=true to computeConditionEffects (CLA-209)', async () => {
    const stats = createMockPlayerStats({
      hasPowerfulBuild: true,
      saveModifiers: [{ source: 'Powerful Build', target: 'ability_check', condition: 'powerful_build_grapple_escape', effect: 'advantage', abilities: ['STR'] }],
    });
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(stats));
    mockStore.set('activeBuffs', []);
    mockStore.set('activeConditions', ['grappled']);
    const { computeConditionEffects } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockImplementation(() => ({ abilityCheckAdvantageAbilities: ['STR'] }));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    expect(computeConditionEffects).toHaveBeenCalled();
    expect(computeConditionEffects.mock.calls[0][0].hasPowerfulBuild).toBe(true);
  });
});
