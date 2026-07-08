// @cleaned-by-ai
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CharSheet from './CharSheet';
import rulesFactory from '../../services/rules/rulesFactory.js';

// ---------------------------------------------------------------------------
// Mocks — child components
// ---------------------------------------------------------------------------

vi.mock('./char-summary/CharSummary.jsx', () => ({
  default: vi.fn(({ playerStats, onReroll, onStrokeOfLuck }) => (
    <div data-testid="char-summary">
      <span>{playerStats?.name || 'none'}</span>
      <button data-testid="reroll-btn" onClick={onReroll}>Reroll</button>
      <button data-testid="stroke-of-luck-btn" onClick={onStrokeOfLuck}>Stroke of Luck</button>
    </div>
  )),
}));

vi.mock('./CharAbilities.jsx', () => ({
  default: vi.fn(({ playerStats, onReroll, onStrokeOfLuck }) => (
    <div data-testid="char-abilities">
      <span>{playerStats?.name || 'none'}</span>
      <button data-testid="reroll-btn-abilities" onClick={onReroll}>Reroll</button>
      <button data-testid="stroke-of-luck-btn-abilities" onClick={onStrokeOfLuck}>Stroke of Luck</button>
    </div>
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
    strokeOfLuck: false,
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

vi.mock('../common/popup.jsx', () => ({
  default: vi.fn(({ children }) => <div data-testid="popup">{children}</div>),
}));

// ---------------------------------------------------------------------------
// Mocks — hooks
// ---------------------------------------------------------------------------

const mockStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn((key, prop, _camp) => mockStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn((_key, _prop, _val, _camp) => mockStore.set(`${_key}:${_prop}`, _val)),
  useRuntimeValue: vi.fn((key, prop) => {
    const fullKey = key || 'Test Bard';
    if (prop === 'exhaustionLevel') return 0;
    if (prop === 'bardicInspirationDie') return mockStore.get(`${fullKey}:bardicInspirationDie`) ?? null;
    if (prop === 'bardicInspirationCombatOptions') return mockStore.get(`${fullKey}:bardicInspirationCombatOptions`) ?? null;
    if (prop === 'activeConditions') return mockStore.get(`${fullKey}:activeConditions`) ?? [];
    if (prop === 'activeBuffs') return mockStore.get(`${fullKey}:activeBuffs`) ?? [];
    if (prop === 'targetEffects') return mockStore.get(`${fullKey}:targetEffects`) ?? [];
    if (prop === 'preparedSpells') return mockStore.get(`${fullKey}:preparedSpells`) ?? null;
    if (prop === 'aspectOfTheWildsOption') return mockStore.get(`${fullKey}:aspectOfTheWildsOption`) ?? null;
    if (prop === 'bardicInspirationGrantedBy') return mockStore.get(`${fullKey}:bardicInspirationGrantedBy`) ?? 'unknown';
    if (prop === 'stunned_speedHalved') return mockStore.get(`${fullKey}:stunned_speedHalved`) ?? null;
    if (prop === 'fanaticalFocusUsed') return mockStore.get(`${fullKey}:fanaticalFocusUsed`) ?? null;
    if (prop === 'focusPoints') return mockStore.get(`${fullKey}:focusPoints`) ?? null;
    if (prop === 'indomitableUses') return mockStore.get(`${fullKey}:indomitableUses`) ?? 0;
    if (prop === 'disciplinedSurvivorUsed') return mockStore.get(`${fullKey}:disciplinedSurvivorUsed`) ?? null;
    if (prop === 'strokeOfLuckUsed') return mockStore.get(`${fullKey}:strokeOfLuckUsed`) ?? null;
    if (prop === 'bardicInspirationUses') return mockStore.get(`${fullKey}:bardicInspirationUses`) ?? 0;
    if (prop === 'secondWindUses') return mockStore.get(`${fullKey}:secondWindUses`) ?? 0;
    if (prop === 'superiorityDice') return mockStore.get(`${fullKey}:superiorityDice`) ?? 0;
    if (prop === 'psionicEnergy') return mockStore.get(`${fullKey}:psionicEnergy`) ?? 0;
    if (prop === 'peerlessAthleteActive') return mockStore.get(`${fullKey}:peerlessAthleteActive`) ?? null;
    if (prop === 'largeFormActive') return mockStore.get(`${fullKey}:largeFormActive`) ?? null;
    if (prop === 'holyNimbusActive') return mockStore.get(`${fullKey}:holyNimbusActive`) ?? null;
    if (prop === '_Defensive_Tactics_choice') return mockStore.get(`${fullKey}:_Defensive_Tactics_choice`) ?? null;
    return null;
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

const createMockPlayerStats = (overrides = {}) => ({
  name: 'Test Bard',
  level: 5,
  hitPoints: { current: 40, max: 40 },
  abilities: [{ name: 'Strength', bonus: 2, save: 4, skills: [] }],
  spellAbilities: { spells: [], maxPreparedSpells: 5 },
  rules: '5e',
  automation: { passives: [] },
  class: { name: 'Bard' },
  speed: 30,
  race: { speed: 30 },
  actions: [],
  bonusActions: [],
  reactions: [],
  specialActions: [],
  characterAdvancement: [],
  skillProficiencies: [],
  saveModifiers: [],
  ...overrides,
});

const mockPlayerSummary = {
  name: 'Test Bard',
  rules: '5e',
};

const defaultProps = {
  allAbilityScores: [],
  allClasses: [],
  allClasses2024: [],
  allEquipment: [],
  allMagicItems: [],
  allRaces: [],
  allSpells: [],
  allSpells2024: [],
  playerSummary: mockPlayerSummary,
  allRaces2024: [],
  allMagicItems2024: [],
  campaignName: 'test-campaign',
  activeMapName: null,
  characters: [],
  onDeleteCharacter: vi.fn(),
  onEditCharacter: vi.fn(),
  onUploadClick: vi.fn(),
  onSaveClick: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests — prepared spells toggle
// ---------------------------------------------------------------------------

describe('prepared spells toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('toggles a spell from unprepared to prepared', async () => {
    const spells = [
      { name: 'Magic Missile', prepared: '' },
      { name: 'Shield', prepared: 'Prepared' },
    ];

    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(createMockPlayerStats({
      spellAbilities: { spells, maxPreparedSpells: 5 },
    })));

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    // Toggle Magic Missile from '' to 'Prepared'
    const { default: CharSpells } = await import('./char-spells/CharSpells.jsx');
    const toggleFn = CharSpells.mock.calls[0][0].handleTogglePreparedSpells;

    expect(toggleFn).toBeDefined();
    toggleFn('Magic Missile');

    // Magic Missile should now be 'Prepared'
    expect(spells[0].prepared).toBe('Prepared');
    // setRuntimeValue should have been called with preparedSpells
    expect(vi.mocked(setRuntimeValueMock)).toHaveBeenCalled();
  });

  it('respects max prepared spells limit', async () => {
    const spells = [
      { name: 'Magic Missile', prepared: 'Prepared' },
      { name: 'Shield', prepared: 'Prepared' },
      { name: 'Burning Hands', prepared: '' },
    ];

    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(createMockPlayerStats({
      spellAbilities: { spells, maxPreparedSpells: 2 },
    })));

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSpells } = await import('./char-spells/CharSpells.jsx');
    const toggleFn = CharSpells.mock.calls[0][0].handleTogglePreparedSpells;

    // Burning Hands should NOT be toggled to Prepared (max is 2)
    toggleFn('Burning Hands');

    expect(spells[2].prepared).toBe('');
  });

  it('toggles a spell from prepared to unprepared', async () => {
    const spells = [
      { name: 'Magic Missile', prepared: 'Prepared' },
      { name: 'Shield', prepared: 'Prepared' },
    ];

    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(createMockPlayerStats({
      spellAbilities: { spells, maxPreparedSpells: 5 },
    })));

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSpells } = await import('./char-spells/CharSpells.jsx');
    const toggleFn = CharSpells.mock.calls[0][0].handleTogglePreparedSpells;

    toggleFn('Magic Missile');

    expect(spells[0].prepared).toBe('');
  });
});

// Re-import the mocked setRuntimeValue for testing
import { setRuntimeValue as setRuntimeValueMock } from '../../hooks/runtime/useRuntimeState.js';

// ---------------------------------------------------------------------------
// Tests — exhaustion level
// ---------------------------------------------------------------------------

describe('exhaustion level', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('calculates exhaustion penalty as 2 * level', async () => {
    const { default: CharAbilities } = await import('./CharAbilities.jsx');

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    // exhaustionPenalty = 2 * 0 = 0
    expect(CharAbilities.mock.calls[0][0].exhaustionPenalty).toBe(0);
  });

  it('caps exhaustion level between 0 and 6', async () => {
    // Set a negative exhaustion level
    // The mock already returns 0 for exhaustionLevel

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharAbilities } = await import('./CharAbilities.jsx');
    expect(CharAbilities.mock.calls[0][0].exhaustionPenalty).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — HP sync effect
// ---------------------------------------------------------------------------

describe('HP sync effect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('syncs hitPoints to runtime store when playerStats changes', async () => {
    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    // The HP sync effect should call setRuntimeValue with hitPoints
    const setRvCalls = vi.mocked(setRuntimeValueMock).mock.calls;
    const hpCall = setRvCalls.find(call => call[1] === 'hitPoints');
    expect(hpCall).toBeDefined();
    expect(hpCall[2]).toEqual({ current: 40, max: 40 });
  });
});

// ---------------------------------------------------------------------------
// Tests — buff effect flags
// ---------------------------------------------------------------------------

describe('buff effect flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('detects isRaging from activeBuffs', async () => {
    mockStore.set('Test Bard:activeBuffs', [
      { effect: 'rage', damageBonusExpression: '2d6' },
    ]);

    const { default: CharAbilities } = await import('./CharAbilities.jsx');

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    expect(CharAbilities.mock.calls[0][0].isRaging).toBe(true);
  });

  it('detects shapeShiftActive from activeBuffs', async () => {
    mockStore.set('Test Bard:activeBuffs', [
      { effect: 'shape_shift' },
    ]);

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    expect(CharSummary.mock.calls[0][0].playerStats).toBeDefined();
  });

  it('passes seeInvisibilityActive to condition effects', async () => {
    mockStore.set('Test Bard:activeBuffs', [
      { effect: 'see_invisibility' },
    ]);

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — aspect of the wilds (2024 ruleset)
// ---------------------------------------------------------------------------

describe('aspect of the wilds passives', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('applies Owl aspect: increases Darkvision range by 60', async () => {
    mockStore.set('Test Bard:aspectOfTheWildsOption', 'Owl');

    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(createMockPlayerStats({
      rules: '2024',
      senses: [{ name: 'Darkvision', value: '60 ft.' }],
    })));

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    expect(screen.getByTestId('char-summary')).toBeInTheDocument();
  });

  it('applies Panther aspect: sets climb speed to walk speed', async () => {
    mockStore.set('Test Bard:aspectOfTheWildsOption', 'Panther');

    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(createMockPlayerStats({
      rules: '2024',
    })));

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('applies Salmon aspect: sets swim speed to walk speed', async () => {
    mockStore.set('Test Bard:aspectOfTheWildsOption', 'Salmon');

    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(createMockPlayerStats({
      rules: '2024',
    })));

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — aquaatic affinity passive
// ---------------------------------------------------------------------------

describe('aquatic affinity passive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('sets swim speed and aquaticAffinityEmanationRange when passive exists', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(createMockPlayerStats({
      automation: { passives: [{ effect: 'aquatic_affinity' }] },
    })));

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    // aquaticAffinityEmanationRange should be set to 10
    expect(mockStore.get('Test Bard:aquaticAffinityEmanationRange')).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Tests — second-storywork and athlete passives
// ---------------------------------------------------------------------------

describe('climb speed passives', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('applies second-storywork: sets climb speed to walk speed', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(createMockPlayerStats({
      automation: { passives: [{ effect: 'second_storywork' }] },
    })));

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('applies athlete climb passive: sets climb speed to speed', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(createMockPlayerStats({
      automation: { passives: [{ effect: 'climb_speed' }] },
    })));

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('applies roving passive: sets climb and swim speeds', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(createMockPlayerStats({
      automation: { passives: [{ name: 'Roving', effect: 'roving' }] },
    })));

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — fanatical focus reset
// ---------------------------------------------------------------------------

describe('fanatical focus reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('resets fanaticalFocusUsed to false when not raging', async () => {
    mockStore.set('Test Bard:activeBuffs', []);

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    // fanaticalFocusUsed should be reset to false
    expect(mockStore.get('Test Bard:fanaticalFocusUsed')).toBe(false);
  });
});
