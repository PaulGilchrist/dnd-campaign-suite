// @maintained-by-ai
// ---------------------------------------------------------------------------
// CharSheet modal CANCEL/SKIP lane (render + close-without-dispatch).
// Each shape-change / Shield of Faith popup must render its modal with the
// popup's config (title, maxCR, targets, exclusions) and cancelling must
// close the popup WITHOUT dispatching to any transform service.
// The confirm → service dispatch lane lives in CharSheet.actionHandlers.test.jsx —
// do not duplicate dispatch assertions here.
// ---------------------------------------------------------------------------

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CharSheet from './CharSheet';
import { activateWildShape } from '../../services/automation/handlers/class-druid/wildShapeCreatureBuilder.js';
import { confirmPolymorphTransform } from '../../services/automation/handlers/spells/polymorphService.js';
import { confirmShapechangeTransform } from '../../services/automation/handlers/spells/shapechangeService.js';
import { applyAnimalShapes } from '../../services/automation/handlers/spells/animalShapesService.js';
import { confirmTruePolymorphTransform, applyObjectTransform } from '../../services/automation/handlers/spells/truePolymorphService.js';
import { applyShieldOfFaith } from '../../services/automation/handlers/shieldOfFaithHandler.js';

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
// Mocks — services (transform handlers mocked so cancel can assert NOT called)
// ---------------------------------------------------------------------------

vi.mock('../../services/automation/handlers/shieldOfFaithHandler.js', () => ({
  applyShieldOfFaith: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-druid/wildShapeCreatureBuilder.js', () => ({
  activateWildShape: vi.fn(),
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
// Fixtures
// ---------------------------------------------------------------------------

const CAMPAIGN = 'test-campaign';

const defaultProps = createDefaultProps();

const renderSheet = async () => {
  render(<CharSheet {...defaultProps} />);
  await waitFor(() => {
    expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
  });
};

// Returns the props of the most recent render of a mocked modal component.
const lastModalProps = async (path) => (await import(path)).default.mock.calls.at(-1)[0];

beforeEach(() => {
  resetTestState(sharedPopupReturnValue);
  mockStore.clear();
});

// ---------------------------------------------------------------------------
// Tests — shape-change modals: config forwarded, cancel closes without dispatch
// ---------------------------------------------------------------------------

describe('shape-change modals: cancel closes the popup without dispatching', () => {
  it.each([
    {
      label: 'Wild Shape',
      popupHtml: {
        type: 'wild_shape_select',
        action: { name: 'Wild Shape' },
        playerStats: { name: 'Test Character' },
        campaignName: CAMPAIGN,
      },
      testId: 'polymorph-selection-modal',
      modalPath: './modals/PolymorphSelectionModal.jsx',
      expectedProps: { title: 'Wild Shape', playerStats: { name: 'Test Character' }, campaignName: CAMPAIGN },
      service: activateWildShape,
    },
    {
      label: 'Polymorph',
      popupHtml: { type: 'polymorph_select', maxCR: 4, campaignName: CAMPAIGN },
      testId: 'polymorph-selection-modal',
      modalPath: './modals/PolymorphSelectionModal.jsx',
      expectedProps: { title: 'Polymorph', maxCR: 4 },
      service: confirmPolymorphTransform,
    },
    {
      label: 'Shapechange',
      popupHtml: { type: 'shapechange_select', maxCR: 8, campaignName: CAMPAIGN },
      testId: 'polymorph-selection-modal',
      modalPath: './modals/PolymorphSelectionModal.jsx',
      // Shapechange may take any form except construct/undead (CLA-391 stable array).
      expectedProps: { title: 'Shapechange', maxCR: 8, allowAnyCreature: true, excludeTypes: ['construct', 'undead'] },
      service: confirmShapechangeTransform,
    },
    {
      label: 'True Polymorph',
      popupHtml: { type: 'true_polymorph_select', maxCR: 8, mode: 'creature_to_object', campaignName: CAMPAIGN },
      testId: 'polymorph-selection-modal',
      modalPath: './modals/PolymorphSelectionModal.jsx',
      expectedProps: { title: 'True Polymorph', allowAnyCreature: true, mode: 'creature_to_object' },
      service: confirmTruePolymorphTransform,
    },
    {
      label: 'Animal Shapes',
      popupHtml: {
        type: 'animal_shapes_target_selection',
        targets: [{ name: 'Ally One' }, { name: 'Ally Two' }],
        maxCR: 4,
        campaignName: CAMPAIGN,
      },
      testId: 'animal-shapes-selection-modal',
      modalPath: './modals/AnimalShapesSelectionModal.jsx',
      expectedProps: { title: 'Animal Shapes', maxCR: 4, targets: [{ name: 'Ally One' }, { name: 'Ally Two' }] },
      service: applyAnimalShapes,
    },
    {
      label: 'Object Transform',
      popupHtml: { type: 'true_polymorph_object', campaignName: CAMPAIGN },
      testId: 'object-transform-modal',
      modalPath: './modals/ObjectTransformModal.jsx',
      expectedProps: {},
      service: applyObjectTransform,
    },
  ])('$label: renders its modal, cancel clears the popup and skips the transform', async ({
    popupHtml, testId, modalPath, expectedProps, service,
  }) => {
    setPopup(sharedPopupReturnValue, popupHtml);
    await renderSheet();

    const modalProps = await lastModalProps(modalPath);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
    expect(modalProps).toMatchObject(expectedProps);

    sharedPopupReturnValue.setPopupHtml.mockClear();
    modalProps.onCancel();

    expect(sharedPopupReturnValue.setPopupHtml).toHaveBeenCalledWith(null);
    expect(service).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests — Shield of Faith: targets mapped from popup names, skip closes without casting
// ---------------------------------------------------------------------------

describe('Shield of Faith target selection modal', () => {
  it('maps creature names to targets, labels the cast, and skip closes without casting', async () => {
    setPopup(sharedPopupReturnValue, {
      type: 'shield_of_faith_target_selection',
      creatureTargets: ['Ally One', 'Ally Two'],
      duration: '1 minute',
      range: 60,
    });
    await renderSheet();

    const modalProps = await lastModalProps('./modals/shared/SecondaryTargetModal.jsx');
    expect(screen.getByTestId('secondary-target-modal')).toBeInTheDocument();
    expect(modalProps.title).toBe('Shield of Faith');
    expect(modalProps.confirmLabel).toBe('Cast');
    expect(modalProps.targets).toEqual([
      { name: 'Ally One', type: 'creature' },
      { name: 'Ally Two', type: 'creature' },
    ]);

    sharedPopupReturnValue.setPopupHtml.mockClear();
    modalProps.onSkip();

    expect(sharedPopupReturnValue.setPopupHtml).toHaveBeenCalledWith(null);
    expect(applyShieldOfFaith).not.toHaveBeenCalled();
  });
});
