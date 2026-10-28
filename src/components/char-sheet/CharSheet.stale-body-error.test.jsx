// @maintained-by-ai
// Regression lane for bug-charsheet-stale-body-minimal-payload: a rejected
// rulesFactory.getPlayerStats (character file missing sections the engine
// requires — rules-magicItems / class & race lookups throw) MUST surface an
// honest "could not load" card for the SELECTED character. Pre-fix the
// rejection was swallowed by the missing .catch on fetchData, setPlayerStats
// never ran, and the sheet kept rendering the PREVIOUS character's entire
// body — including its live Edit/Delete affordances (wrong-entity mutation
// hazard) — under the newly-selected header.
//
// Mock block mirrors CharSheet.rendering-effects.test.jsx (child components
// expose testids; services/hooks/rulesFactory are faked wholesale).

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import CharSheet from './CharSheet';
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
  default: vi.fn(() => <div data-testid="char-summary" />),
}));

vi.mock('./CharAbilities.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-abilities" />),
}));

vi.mock('./CharActions.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-actions" />),
}));

vi.mock('./CharInventory.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-inventory" />),
}));

vi.mock('./CharReactions.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-reactions" />),
}));

vi.mock('./CharSpecialActions.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-special-actions" />),
}));

vi.mock('./CharCharacterAdvancement.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-character-advancement" />),
}));

vi.mock('./char-spells/CharSpells.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-spells" />),
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
  computeConditionEffects: vi.fn().mockReturnValue({}),
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
  default: vi.fn(() => <div data-testid="attack-result-popup" />),
}));

// ---------------------------------------------------------------------------
// Mocks — hooks
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
  getRuntimeValue: vi.fn((key, prop, _camp) => mockStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn((_key, _prop, _val, _camp) => mockStore.set(`${_key}:${_prop}`, _val)),
  useRuntimeValue: vi.fn((key, prop) => {
    if (prop === 'exhaustionLevel') return 0;
    const defaults = {
      activeConditions: [],
      activeBuffs: [],
      targetEffects: [],
      bardicInspirationGrantedBy: 'unknown',
    };
    const def = Object.prototype.hasOwnProperty.call(defaults, prop) ? defaults[prop] : null;
    return mockStore.get(`${key}:${prop}`) ?? def;
  }),
}));

vi.mock('../../services/rules/rulesFactory.js', () => ({
  default: {
    getPlayerStats: vi.fn().mockImplementation(() => Promise.resolve(createMockPlayerStats())),
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const { default: rulesFactoryMock } = await import('../../services/rules/rulesFactory.js');
const getPlayerStats = rulesFactoryMock.getPlayerStats;

const healthySummary = { name: 'Good Hero', rules: '5e' };
const brokenSummary = { name: 'QA Minimal Probe', rules: '2024' };
const engineRejection = () => new Error('Missing array: inventory.magicItems for QA Minimal Probe');

describe('CharSheet stale-body impostor guard', () => {
  let consoleError;

  beforeEach(() => {
    resetTestState(sharedPopupReturnVal);
    mockStore.clear();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    getPlayerStats.mockImplementation(() => Promise.resolve(createMockPlayerStats({ name: healthySummary.name })));
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('replaces the previous character body with an honest error card when the new selection fails to load', async () => {
    const { rerender } = render(<CharSheet {...createDefaultProps({ playerSummary: healthySummary })} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('char-summary')).toBeInTheDocument();

    // Select the broken character: the rules engine throws on its file.
    getPlayerStats.mockImplementationOnce(() => Promise.reject(engineRejection()));
    rerender(<CharSheet {...createDefaultProps({ playerSummary: brokenSummary })} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    // Honest card names the SELECTED character, not the stale one…
    expect(screen.getByRole('alert').textContent).toContain('QA Minimal Probe');
    // …and the previous character's body (and its live Edit/Delete
    // affordances, rendered by CharSummary) is GONE.
    expect(screen.queryByTestId('char-sheet')).toBeNull();
    expect(screen.queryByTestId('char-summary')).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('could not load stats for "QA Minimal Probe"'),
      expect.anything()
    );
  });

  it('shows the error card (not a silent nothing) when the FIRST load fails', async () => {
    getPlayerStats.mockImplementationOnce(() => Promise.reject(engineRejection()));

    render(<CharSheet {...createDefaultProps({ playerSummary: brokenSummary })} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert').textContent).toContain('Could not load');
    expect(screen.queryByTestId('char-sheet')).toBeNull();
  });

  it('recovers the normal sheet once a later selection loads cleanly', async () => {
    getPlayerStats.mockImplementationOnce(() => Promise.reject(engineRejection()));
    const { rerender } = render(<CharSheet {...createDefaultProps({ playerSummary: brokenSummary })} />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    rerender(<CharSheet {...createDefaultProps({ playerSummary: healthySummary })} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
