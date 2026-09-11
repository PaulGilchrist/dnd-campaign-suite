// @improved-by-ai
// @cleaned-by-ai
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CharSheet from './CharSheet';
import {
  createDefaultProps,
  createMockPlayerStats,
  createMockStore,
  createSharedPopupReturnValue,
  resetTestState,
  setPopup,
} from './CharSheet.test-utils.jsx';

// ---------------------------------------------------------------------------
// Mocks — child components
// ---------------------------------------------------------------------------

vi.mock('./char-summary/CharSummary.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-summary"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharAbilities.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-abilities"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharActions.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-actions"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharInventory.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-inventory"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharReactions.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-reactions"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharSpecialActions.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-special-actions"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharCharacterAdvancement.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-character-advancement"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./char-spells/CharSpells.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-spells"><span>{playerStats?.name || 'none'}</span></div>
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
  computeConditionEffects: vi.fn().mockReturnValue({
    attackAdvantageCount: 0,
    attackDisadvantageCount: 0,
    autoReroll: false,
    autoRerollCondition: null,
    autoRerollBonus: null,
    cannotAct: false,
  }),
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
// Mocks — hooks
// ---------------------------------------------------------------------------

const mockStore = createMockStore();
const sharedPopupReturnValue = createSharedPopupReturnValue();

vi.mock('../../hooks/combat/useSharedPopup.js', () => {
  const mockFn = vi.fn();
  mockFn.mockImplementation(() => {
    return { ...sharedPopupReturnValue, Provider: ({ children }) => children };
  });
  return { default: mockFn };
});

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn((key, prop, _camp) => mockStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn((_key, _prop, _val, _camp) => mockStore.set(`${_key}:${_prop}`, _val)),
  useRuntimeValue: vi.fn((key, prop) => {
    if (prop === 'exhaustionLevel') return 0;
    if (prop === 'activeBuffs') return mockStore.get(`${key}:activeBuffs`) ? JSON.parse(mockStore.get(`${key}:activeBuffs`)) : [];
    const defaults = {
      activeConditions: [],
      targetEffects: [],
      bardicInspirationGrantedBy: 'unknown',
      indomitableUses: 0,
      bardicInspirationUses: 0,
      secondWindUses: 0,
      superiorityDice: 0,
      psionicEnergy: 0,
    };
    const def = Object.prototype.hasOwnProperty.call(defaults, prop) ? defaults[prop] : null;
    return mockStore.get(`${key}:${prop}`) ?? def;
  }),
}));

vi.mock('../../services/rules/rulesFactory.js', () => ({
  default: {
    getPlayerStats: vi.fn().mockImplementation(() => Promise.resolve({})),
  },
}));

// ---------------------------------------------------------------------------
// Tests — Wild Shape modal rendering
// ---------------------------------------------------------------------------

describe('Wild Shape modal rendering', () => {
  const defaultProps = createDefaultProps();

  beforeEach(() => {
    resetTestState(sharedPopupReturnValue);
    mockStore.clear();
  });

  it('renders PolymorphSelectionModal for wild_shape_select popup', async () => {
    setPopup(sharedPopupReturnValue, {
      type: 'wild_shape_select',
      playerStats: createMockPlayerStats(),
      campaignName: 'test-campaign',
      action: { name: 'Wild Shape' },
    });
    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    expect(screen.getByTestId('polymorph-selection-modal')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — Shield of Faith target selection modal rendering
// ---------------------------------------------------------------------------

describe('Shield of Faith target selection modal rendering', () => {
  const defaultProps = createDefaultProps();

  beforeEach(() => {
    resetTestState(sharedPopupReturnValue);
    mockStore.clear();
  });

  it('renders SecondaryTargetModal for shield_of_faith_target_selection popup', async () => {
    setPopup(sharedPopupReturnValue, {
      type: 'shield_of_faith_target_selection',
      creatureTargets: [
        { name: 'Ally1', type: 'creature' },
        { name: 'Ally2', type: 'creature' },
      ],
      duration: '1 minute',
      range: 60,
    });
    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    expect(screen.getByTestId('secondary-target-modal')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — Polymorph modal rendering
// ---------------------------------------------------------------------------

describe('Polymorph modal rendering', () => {
  const defaultProps = createDefaultProps();

  beforeEach(() => {
    resetTestState(sharedPopupReturnValue);
    mockStore.clear();
  });

  it('renders PolymorphSelectionModal for polymorph_select popup', async () => {
    setPopup(sharedPopupReturnValue, {
      type: 'polymorph_select',
      maxCR: 4,
      campaignName: 'test-campaign',
      targetName: 'Test Character',
      casterName: 'Test Character',
    });
    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    expect(screen.getByTestId('polymorph-selection-modal')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — Shapechange modal rendering
// ---------------------------------------------------------------------------

describe('Shapechange modal rendering', () => {
  const defaultProps = createDefaultProps();

  beforeEach(() => {
    resetTestState(sharedPopupReturnValue);
    mockStore.clear();
  });

  it('renders PolymorphSelectionModal for shapechange_select popup', async () => {
    setPopup(sharedPopupReturnValue, {
      type: 'shapechange_select',
      maxCR: 8,
      campaignName: 'test-campaign',
      targetName: 'Test Character',
      casterName: 'Test Character',
    });
    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    expect(screen.getByTestId('polymorph-selection-modal')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — True Polymorph modal rendering
// ---------------------------------------------------------------------------

describe('True Polymorph modal rendering', () => {
  const defaultProps = createDefaultProps();

  beforeEach(() => {
    resetTestState(sharedPopupReturnValue);
    mockStore.clear();
  });

  it('renders PolymorphSelectionModal for true_polymorph_select popup', async () => {
    setPopup(sharedPopupReturnValue, {
      type: 'true_polymorph_select',
      maxCR: 8,
      campaignName: 'test-campaign',
      targetName: 'Test Character',
      casterName: 'Test Character',
      mode: 'creature_to_creature',
    });
    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    expect(screen.getByTestId('polymorph-selection-modal')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — Object Transform modal rendering
// ---------------------------------------------------------------------------

describe('Object Transform modal rendering', () => {
  const defaultProps = createDefaultProps();

  beforeEach(() => {
    resetTestState(sharedPopupReturnValue);
    mockStore.clear();
  });

  it('renders ObjectTransformModal for true_polymorph_object popup', async () => {
    setPopup(sharedPopupReturnValue, {
      type: 'true_polymorph_object',
      campaignName: 'test-campaign',
      targetName: 'Test Character',
      casterName: 'Test Character',
    });
    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    expect(screen.getByTestId('object-transform-modal')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — Animal Shapes modal rendering
// ---------------------------------------------------------------------------

describe('Animal Shapes modal rendering', () => {
  const defaultProps = createDefaultProps();

  beforeEach(() => {
    resetTestState(sharedPopupReturnValue);
    mockStore.clear();
  });

  it('renders AnimalShapesSelectionModal for animal_shapes_target_selection popup', async () => {
    setPopup(sharedPopupReturnValue, {
      type: 'animal_shapes_target_selection',
      targets: [{ name: 'Goblin', type: 'creature' }],
      maxCR: 4,
      campaignName: 'test-campaign',
    });
    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    expect(screen.getByTestId('animal-shapes-selection-modal')).toBeInTheDocument();
  });
});
