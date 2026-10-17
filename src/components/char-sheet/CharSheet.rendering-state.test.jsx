// @maintained-by-ai
// CharSheet STATE lane — what the load-time fetchData seams stamp onto the
// stats/props handed to children (applyPreparedSpells, applyAspectOfTheWilds,
// applyMovementPassives) and the exhaustion clamp reaching CharSummary.
//
// Lane split (do not re-add here):
//   - prepared-spell toggle / max-prepared cap (#52) -> CharSheet.actionHandlers.test.jsx
//   - Roving folded speed, heavy-armor gate, preserve (CLA-300) -> CharSheet.cla300-roving-speeds.test.jsx
//   - conditionEffects canonical passthrough / exhaustion scaling -> CharSheet.conditionEffects.test.jsx
//   - sheet-side buff stamps, lucky flags, isRaging (#64) -> CharSheet.rendering-effects.test.jsx
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
    getPlayerStats: vi.fn().mockImplementation(() => Promise.resolve(createMockPlayerStats())),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function renderSheet(stats, props = {}) {
  vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(stats));
  render(<CharSheet {...createDefaultProps(props)} />);
  await waitFor(() => {
    expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
  });
}

async function summaryProps() {
  const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
  return CharSummary.mock.calls[0][0];
}

async function spellsProps() {
  const { default: CharSpells } = await import('./char-spells/CharSpells.jsx');
  return CharSpells.mock.calls[0][0].playerStats.spellAbilities.spells;
}

beforeEach(() => {
  resetTestState(sharedPopupReturnVal);
  mockStore.clear();
});

// ---------------------------------------------------------------------------
// applyPreparedSpells — runtime saved list reconciles the loaded spell list
// (toggle/cap lane lives in CharSheet.actionHandlers.test.jsx)
// ---------------------------------------------------------------------------

describe('prepared spells loaded from runtime state', () => {
  const spells = [
    { name: 'Fireball', prepared: '' },
    { name: 'Mage Armor', prepared: 'Prepared' },
  ];

  it.each([
    {
      label: 'saved list marks its spells Prepared and clears stale Prepared flags',
      saved: ['Fireball'],
      expected: { Fireball: 'Prepared', 'Mage Armor': '' },
    },
    {
      label: 'no saved list leaves loaded prepared flags untouched',
      saved: null,
      expected: { Fireball: '', 'Mage Armor': 'Prepared' },
    },
    {
      label: '2024 non-Wizard ignores the saved list (only Wizards track prepared)',
      saved: ['Fireball'],
      rules: '2024',
      className: 'Cleric',
      expected: { Fireball: '', 'Mage Armor': 'Prepared' },
    },
  ])('$label', async ({ saved, rules, className, expected }) => {
    if (saved) mockStore.set('Test Character:preparedSpells', saved);
    const props = rules
      ? { playerSummary: { name: 'Test Character', rules, class: { name: className } } }
      : {};

    await renderSheet(createMockPlayerStats({ spellAbilities: { spells, maxPreparedSpells: 5 } }), props);

    const loaded = await spellsProps();
    expect(loaded.find((s) => s.name === 'Fireball').prepared).toBe(expected.Fireball);
    expect(loaded.find((s) => s.name === 'Mage Armor').prepared).toBe(expected['Mage Armor']);
  });
});

// ---------------------------------------------------------------------------
// applyAspectOfTheWilds — runtime-selected aspect mutates stats at load
// (the option WRITE side lives in CharSpecialActions.handlers.test.jsx;
// CharSummary's own speed recomputation lives in char-summary tests)
// ---------------------------------------------------------------------------

describe('Aspect of the Wilds applied at load from runtime option', () => {
  it.each([
    {
      label: 'Owl extends existing Darkvision by 60ft, other senses untouched',
      stats: createMockPlayerStats({
        rules: '2024',
        senses: [{ name: 'Darkvision', value: '60 ft.' }, { name: 'Blindsight', value: '10 ft.' }],
      }),
      aspect: 'Owl',
      expected: { darkvision: '120 ft.', blindsight: '10 ft.', climbSpeed: undefined, swimSpeed: undefined },
    },
    {
      label: 'Owl adds a 60ft Darkvision entry when none exists',
      stats: createMockPlayerStats({ rules: '2024' }),
      aspect: 'Owl',
      expected: { darkvision: '60 ft.', blindsight: undefined, climbSpeed: undefined, swimSpeed: undefined },
    },
    {
      label: 'Panther sets climb speed to base race speed (subrace first)',
      stats: createMockPlayerStats({ rules: '2024', race: { speed: 30, subrace: { speed: 35 } } }),
      aspect: 'Panther',
      expected: { darkvision: undefined, blindsight: undefined, climbSpeed: 35, swimSpeed: undefined },
    },
    {
      label: 'Salmon sets swim speed to base race speed',
      stats: createMockPlayerStats({ rules: '2024', race: { speed: 25 } }),
      aspect: 'Salmon',
      expected: { darkvision: undefined, blindsight: undefined, climbSpeed: undefined, swimSpeed: 25 },
    },
    {
      label: 'ignored under 5e rules — Darkvision is not extended',
      stats: createMockPlayerStats({
        rules: '5e',
        senses: [{ name: 'Darkvision', value: '60 ft.' }],
      }),
      aspect: 'Owl',
      expected: { darkvision: '60 ft.', blindsight: undefined, climbSpeed: undefined, swimSpeed: undefined },
    },
  ])('$label', async ({ stats, aspect, expected }) => {
    mockStore.set('Test Character:aspectOfTheWildsOption', aspect);

    await renderSheet(stats);

    const passedStats = (await summaryProps()).playerStats;
    expect(passedStats.senses?.find((s) => s.name === 'Darkvision')?.value).toBe(expected.darkvision);
    expect(passedStats.senses?.find((s) => s.name === 'Blindsight')?.value).toBe(expected.blindsight);
    expect(passedStats.climbSpeed).toBe(expected.climbSpeed);
    expect(passedStats.swimSpeed).toBe(expected.swimSpeed);
  });
});

// ---------------------------------------------------------------------------
// applyMovementPassives — speed/flag stamps from automation.passives
// (Roving is owned by CharSheet.cla300-roving-speeds.test.jsx)
// ---------------------------------------------------------------------------

describe('movement & Athlete passives stamped on load', () => {
  it.each([
    {
      label: 'aquatic_affinity grants swim speed equal to race speed and publishes emanation range',
      passives: [{ effect: 'aquatic_affinity' }],
      expected: { climbSpeed: undefined, swimSpeed: 30, athleteStandFromProne: undefined, athleteReducedJumpRequirement: undefined, emanationRange: 10 },
    },
    {
      label: 'second_storywork grants climb speed equal to race speed',
      passives: [{ effect: 'second_storywork' }],
      expected: { climbSpeed: 30, swimSpeed: undefined, athleteStandFromProne: undefined, athleteReducedJumpRequirement: undefined, emanationRange: undefined },
    },
    {
      label: 'Athlete climb_speed passive grants climb speed',
      passives: [{ effect: 'climb_speed' }],
      expected: { climbSpeed: 30, swimSpeed: undefined, athleteStandFromProne: undefined, athleteReducedJumpRequirement: undefined, emanationRange: undefined },
    },
    {
      label: 'stand_from_prone exposes the athleteStandFromProne flag without touching speeds',
      passives: [{ effect: 'stand_from_prone' }],
      expected: { climbSpeed: undefined, swimSpeed: undefined, athleteStandFromProne: true, athleteReducedJumpRequirement: undefined, emanationRange: undefined },
    },
    {
      label: 'reduced_running_jump_requirement exposes the athleteReducedJumpRequirement flag without touching speeds',
      passives: [{ effect: 'reduced_running_jump_requirement' }],
      expected: { climbSpeed: undefined, swimSpeed: undefined, athleteStandFromProne: undefined, athleteReducedJumpRequirement: true, emanationRange: undefined },
    },
  ])('$label', async ({ passives, expected }) => {
    await renderSheet(createMockPlayerStats({ automation: { passives } }));

    const passedStats = (await summaryProps()).playerStats;
    expect({
      climbSpeed: passedStats.climbSpeed,
      swimSpeed: passedStats.swimSpeed,
      athleteStandFromProne: passedStats.athleteStandFromProne,
      athleteReducedJumpRequirement: passedStats.athleteReducedJumpRequirement,
      emanationRange: mockStore.get('Test Character:aquaticAffinityEmanationRange'),
    }).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// Exhaustion clamp — stored level is normalized to 0..6 before reaching
// children (scaling of the doubled penalty: CharSheet.conditionEffects.test.jsx)
// ---------------------------------------------------------------------------

describe('exhaustionLevel prop clamping', () => {
  it.each([
    { input: 3, expected: 3, label: 'in-range level passes through (3 -> 3)' },
    { input: 10, expected: 6, label: 'clamped to max at 6 (10 -> 6)' },
    { input: -1, expected: 0, label: 'clamped to min at 0 (-1 -> 0)' },
    { input: 'two', expected: 0, label: 'non-numeric stored value normalizes to 0' },
  ])('$label', async ({ input, expected }) => {
    mockStore.set('Test Character:exhaustionLevel', input);

    await renderSheet(createMockPlayerStats());

    expect((await summaryProps()).exhaustionLevel).toBe(expected);
  });
});
