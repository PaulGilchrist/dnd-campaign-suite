// @maintained-by-ai 2026-11-17
// ---------------------------------------------------------------------------
// Wild Shape chooser lane regression (bug-wild-shape-chooser-cancel-leaves-ghost-buff).
// Locks the two halves of the zero-write Cancel contract at the sheet seam:
//  - Cancel on the beast chooser only closes the popup: zero runtime-store writes,
//    zero log rows, activeBuffs byte-identical to before the chooser opened.
//  - Confirm is the ONLY writer of the shape_shift buff (filter-then-append via
//    computeToggledBuffs) before delegating the form/spend/log to activateWildShape.
// The row-click leg's zero writes (buffHandler ON leg) are pinned in
// buffHandler.wild-shape.test.js — do not duplicate handler assertions here.
// Harness mirrors CharSheet.modalConfirmHandlers.test.jsx.
// ---------------------------------------------------------------------------

import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CharSheet from './CharSheet';
import { activateWildShape } from '../../services/automation/handlers/class-druid/wildShapeCreatureBuilder.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

import {
  createDefaultProps,
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

vi.mock('../../services/automation/handlers/class-druid/wildShapeCreatureBuilder.js', () => ({
  activateWildShape: vi.fn().mockResolvedValue({ name: 'Cat', index: 'cat' }),
}));

vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({
  confirmPolymorphTransform: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/shapechangeService.js', () => ({
  confirmShapechangeTransform: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/animalShapesService.js', () => ({
  applyAnimalShapes: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/truePolymorphService.js', () => ({
  confirmTruePolymorphTransform: vi.fn(),
  applyObjectTransform: vi.fn(),
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
    // Raw read (mirrors CharSheet.actionHandlers.test.jsx) — the sheet reads
    // activeBuffs for computeCharConditionEffects and tests store plain arrays.
    if (prop === 'activeBuffs') return mockStore.get(`${key}:activeBuffs`) ?? [];
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
// Fixtures
// ---------------------------------------------------------------------------

const CAMPAIGN = 'test-campaign';
const CHARACTER = 'Test Character';
const BEAST = { name: 'Cat', index: 'cat' };

// Production byte-shape: the wild_shape_select payload echoes the sheet row
// verbatim, automation included (public/data/classes.json druid shape_shift).
const WILD_SHAPE_POPUP = {
  type: 'wild_shape_select',
  action: {
    name: 'Wild Shape',
    automation: {
      type: 'temp_buff',
      effect: 'shape_shift',
      action: 'bonus_action',
      duration: 'half_druid_level_hours',
      tempHpExpression: 'druid_level',
      uses: 2,
      casting_time: '1 bonus action',
      blocksSpellcasting: true,
    },
  },
  playerStats: { name: CHARACTER },
  campaignName: CAMPAIGN,
};

// The exact buff toggleBuff/computeToggledBuffs stamps for the automation above.
const SHAPE_SHIFT_BUFF = {
  name: 'Wild Shape',
  effect: 'shape_shift',
  duration: 'half_druid_level_hours',
  enemiesDisadvantageSaves: [],
  distance: '',
  extendedDistance: '',
  sourceCharacter: CHARACTER,
  blocksSpellcasting: true,
  flySpeed: null,
  hover: false,
  seeInvisibleRange: null,
  narrowSpace: false,
  castingTime: '1 bonus action',
  resistanceTypes: [],
  acBonus: 0,
  saveBonus: 0,
};

const defaultProps = createDefaultProps();

const renderSheet = async () => {
  render(<CharSheet {...defaultProps} />);
  await waitFor(() => {
    expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
  });
};

const lastChooserProps = async () => {
  const { default: Modal } = await import('./modals/PolymorphSelectionModal.jsx');
  return Modal.mock.calls.at(-1)[0];
};

beforeEach(() => {
  resetTestState(sharedPopupReturnValue);
  mockStore.clear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Wild Shape chooser: Cancel is a zero-write dismissal', () => {
  it('closes the popup with activeBuffs unchanged, zero store writes and zero log rows', async () => {
    setPopup(sharedPopupReturnValue, WILD_SHAPE_POPUP);
    await renderSheet();

    const modalProps = await lastChooserProps();
    expect(screen.getByTestId('polymorph-selection-modal')).toBeInTheDocument();

    sharedPopupReturnValue.setPopupHtml.mockClear();
    setRuntimeValue.mockClear();
    getRuntimeValue.mockClear();
    addEntry.mockClear();

    modalProps.onCancel();

    expect(sharedPopupReturnValue.setPopupHtml).toHaveBeenCalledWith(null);
    // Ghost-buff regression: nothing may touch the shared runtime store on Cancel.
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(mockStore.get(`${CHARACTER}:activeBuffs`)).toBeUndefined();
  });
});

describe('Wild Shape chooser: Confirm is the only writer of the shape_shift buff', () => {
  it('stamps the exact shape_shift buff bytes into activeBuffs, then activates the form', async () => {
    setPopup(sharedPopupReturnValue, WILD_SHAPE_POPUP);
    await renderSheet();

    const modalProps = await lastChooserProps();
    setRuntimeValue.mockClear();
    activateWildShape.mockClear();

    await act(async () => { await modalProps.onConfirm(BEAST); });

    expect(setRuntimeValue).toHaveBeenCalledWith(
      CHARACTER,
      'activeBuffs',
      [SHAPE_SHIFT_BUFF],
      CAMPAIGN
    );
    expect(mockStore.get(`${CHARACTER}:activeBuffs`)).toEqual([SHAPE_SHIFT_BUFF]);
    expect(activateWildShape).toHaveBeenCalledWith(CHARACTER, BEAST, { name: CHARACTER }, CAMPAIGN);
    expect(sharedPopupReturnValue.setPopupHtml).toHaveBeenCalledWith(null);
  });

  it('replaces (never duplicates) an existing same-named buff — idempotent against a double-confirm', async () => {
    const staleBuff = { name: 'Wild Shape', effect: 'shape_shift', blocksSpellcasting: true };
    mockStore.set(`${CHARACTER}:activeBuffs`, [staleBuff, { name: 'Bless', effect: 'bless' }]);
    setPopup(sharedPopupReturnValue, WILD_SHAPE_POPUP);
    await renderSheet();

    const modalProps = await lastChooserProps();
    await act(async () => { await modalProps.onConfirm(BEAST); });

    const written = mockStore.get(`${CHARACTER}:activeBuffs`);
    expect(written).toEqual([{ name: 'Bless', effect: 'bless' }, SHAPE_SHIFT_BUFF]);
  });
});
