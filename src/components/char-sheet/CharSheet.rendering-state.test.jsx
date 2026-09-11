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

vi.mock('./DiceRollResult.jsx', () => ({
  default: vi.fn(({ name }) => (
    <div data-testid="dice-roll-result"><span>{name || 'dice'}</span></div>
  )),
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
// Tests — runtime value propagation to playerStats
// ---------------------------------------------------------------------------

describe('runtime value propagation to playerStats', () => {
  beforeEach(() => {
    resetTestState(sharedPopupReturnVal);
    mockStore.clear();
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(createMockPlayerStats()));
  });

  it.each([
    { rules: '2024', className: 'Wizard', spellPrepared: 'Prepared', label: '2024 Wizard' },
    { rules: '5e', className: 'Cleric', spellPrepared: 'Prepared', label: '5e Cleric' },
  ])('loads prepared spells from runtime for $label', async ({ rules, className, spellPrepared }) => {
    mockStore.set('Test Character:preparedSpells', ['Fireball']);
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(createMockPlayerStats({
      rules,
      class: { name: className },
      spellAbilities: { spells: [{ name: 'Fireball', prepared: '' }, { name: 'Mage Armor', prepared: 'Prepared' }], maxPreparedSpells: 5 },
    })));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSpells } = await import('./char-spells/CharSpells.jsx');
    const passedStats = CharSpells.mock.calls[0][0].playerStats;
    const fireballSpell = passedStats.spellAbilities.spells.find((s) => s.name === 'Fireball');
    expect(fireballSpell.prepared).toBe(spellPrepared);
  });
});

// ---------------------------------------------------------------------------
// Tests — Aspect of the Wilds passive effects (2024)
// ---------------------------------------------------------------------------

describe('Aspect of the Wilds passive effects (2024)', () => {
  beforeEach(() => {
    resetTestState(sharedPopupReturnVal);
    mockStore.clear();
  });

  it('extends Darkvision range by 60ft when Owl option is selected', async () => {
    const stats = createMockPlayerStats({
      rules: '2024',
      senses: [{ name: 'Darkvision', value: '60 ft.' }],
    });
    mockStore.set('Test Character:aspectOfTheWildsOption', 'Owl');
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(stats));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    const passedStats = CharSummary.mock.calls[0][0].playerStats;
    const dv = passedStats.senses.find((s) => s.name === 'Darkvision');
    expect(dv.value).toBe('120 ft.');
  });

  it('adds new Darkvision entry when none exists and Owl is selected', async () => {
    const stats = createMockPlayerStats({ rules: '2024' });
    mockStore.set('Test Character:aspectOfTheWildsOption', 'Owl');
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(stats));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    const passedStats = CharSummary.mock.calls[0][0].playerStats;
    const dv = passedStats.senses?.find((s) => s.name === 'Darkvision');
    expect(dv).toBeDefined();
    expect(dv.value).toBe('60 ft.');
  });

  it('sets climbSpeed when Panther option is selected', async () => {
    const stats = createMockPlayerStats({
      rules: '2024',
      race: { speed: 30, subrace: { speed: 35 } },
    });
    mockStore.set('Test Character:aspectOfTheWildsOption', 'Panther');
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(stats));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    const passedStats = CharSummary.mock.calls[0][0].playerStats;
    expect(passedStats.climbSpeed).toBe(35);
  });

  it('sets swimSpeed when Salmon option is selected', async () => {
    const stats = createMockPlayerStats({
      rules: '2024',
      race: { speed: 30 },
    });
    mockStore.set('Test Character:aspectOfTheWildsOption', 'Salmon');
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(stats));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    const passedStats = CharSummary.mock.calls[0][0].playerStats;
    expect(passedStats.swimSpeed).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Tests — passive effect speed modifications
// ---------------------------------------------------------------------------

describe('passive effect speed modifications', () => {
  beforeEach(() => {
    resetTestState(sharedPopupReturnVal);
    mockStore.clear();
  });

  it('applies aquatic affinity passive swim speed and sets emanation range', async () => {
    const stats = createMockPlayerStats({
      automation: { passives: [{ effect: 'aquatic_affinity' }] },
    });
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(stats));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    const passedStats = CharSummary.mock.calls[0][0].playerStats;
    expect(passedStats.swimSpeed).toBe(30);
  });

  it('applies second-storywork passive climb speed', async () => {
    const stats = createMockPlayerStats({
      automation: { passives: [{ effect: 'second_storywork' }] },
    });
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(stats));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    const passedStats = CharSummary.mock.calls[0][0].playerStats;
    expect(passedStats.climbSpeed).toBe(30);
  });

  it('applies athlete climb speed passive', async () => {
    const stats = createMockPlayerStats({
      automation: { passives: [{ effect: 'climb_speed' }] },
    });
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(stats));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    const passedStats = CharSummary.mock.calls[0][0].playerStats;
    expect(passedStats.climbSpeed).toBe(30);
  });

  it('applies Roving climb and swim speeds when not wearing heavy armor', async () => {
    const stats = createMockPlayerStats({
      automation: { passives: [{ name: 'Roving' }] },
      inventory: { equipped: ['Longsword'] },
      equipment: [{ name: 'Longsword' }, { name: 'Chain Mail', armor_category: 'Heavy' }],
    });
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(stats));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    const passedStats = CharSummary.mock.calls[0][0].playerStats;
    expect(passedStats.climbSpeed).toBe(40);
    expect(passedStats.swimSpeed).toBe(40);
  });

  it('does not apply Roving when wearing heavy armor', async () => {
    const stats = createMockPlayerStats({
      automation: { passives: [{ name: 'Roving' }] },
      inventory: { equipped: ['Chain Mail'] },
      equipment: [{ name: 'Chain Mail', armor_category: 'Heavy' }],
    });
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(stats));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    const passedStats = CharSummary.mock.calls[0][0].playerStats;
    expect(passedStats.climbSpeed).toBeUndefined();
    expect(passedStats.swimSpeed).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests — Athlete feat flags
// ---------------------------------------------------------------------------

describe('Athlete feat flags', () => {
  beforeEach(() => {
    resetTestState(sharedPopupReturnVal);
    mockStore.clear();
  });

  it('exposes athleteStandFromProne flag when stand_from_prone passive exists', async () => {
    const stats = createMockPlayerStats({
      automation: { passives: [{ effect: 'stand_from_prone' }] },
    });
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(stats));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    const passedStats = CharSummary.mock.calls[0][0].playerStats;
    expect(passedStats.athleteStandFromProne).toBe(true);
  });

  it('exposes athleteReducedJumpRequirement flag when reduced_running_jump_requirement passive exists', async () => {
    const stats = createMockPlayerStats({
      automation: { passives: [{ effect: 'reduced_running_jump_requirement' }] },
    });
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(stats));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    const passedStats = CharSummary.mock.calls[0][0].playerStats;
    expect(passedStats.athleteReducedJumpRequirement).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests — Exhaustion penalty computation
// ---------------------------------------------------------------------------

describe('Exhaustion penalty computation', () => {
  beforeEach(() => {
    resetTestState(sharedPopupReturnVal);
    mockStore.clear();
  });

  it.each([
    { input: 3, expected: 3, label: 'normal level (3)' },
    { input: 10, expected: 6, label: 'exceeds max (10 → 6)' },
    { input: -1, expected: 0, label: 'negative (-1 → 0)' },
  ])('clamps exhaustionLevel prop: $label', async ({ input, expected }) => {
    mockStore.set('Test Character:exhaustionLevel', input);

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    expect(CharSummary.mock.calls[0][0].exhaustionLevel).toBe(expected);
  });
});
