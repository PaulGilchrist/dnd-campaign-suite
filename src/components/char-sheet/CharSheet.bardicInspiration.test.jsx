// @improved-by-ai
// @cleaned-by-ai
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CharSheet from './CharSheet';
import rulesFactory from '../../services/rules/rulesFactory.js';

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
    <div data-testid="char-character-advancement">
      <span>{playerStats?.name || 'none'}</span>
    </div>
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

const mockStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn((key, prop, _camp) => mockStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn((_key, _prop, _val, _camp) => mockStore.set(`${_key}:${_prop}`, _val)),
  useRuntimeValue: vi.fn((key, prop) => {
    if (prop === 'exhaustionLevel') return 0;
    if (prop === 'activeConditions' || prop === 'activeBuffs' || prop === 'targetEffects') return [];
    if (prop === 'bardicInspirationGrantedBy') return mockStore.get(`${key}:bardicInspirationGrantedBy`) ?? 'unknown';
    const zeroDefaultProps = ['indomitableUses', 'bardicInspirationUses', 'secondWindUses', 'superiorityDice', 'psionicEnergy'];
    if (zeroDefaultProps.includes(prop)) return mockStore.get(`${key}:${prop}`) ?? 0;
    const storePassThroughProps = [
      'bardicInspirationDie', 'bardicInspirationCombatOptions', 'preparedSpells', 'aspectOfTheWildsOption',
      'stunned_speedHalved', 'fanaticalFocusUsed', 'focusPoints', 'disciplinedSurvivorUsed', 'strokeOfLuckUsed',
      'peerlessAthleteActive', 'largeFormActive', 'holyNimbusActive', '_Defensive_Tactics_choice',
      'luckyAdvantageActive', 'luckyDisadvantageActive', '_circleOfTheLandType', '_Energy_Resistances_chosenTypes',
      '_Fiendish_Resilience_chosenType', '_spellThiefCasterBlock', '_spellThiefStolenList',
    ];
    if (storePassThroughProps.includes(prop)) return mockStore.get(`${key}:${prop}`) ?? null;
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
// Tests — Bardic Inspiration feature injection
// ---------------------------------------------------------------------------

describe('bardic inspiration feature injection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(createMockPlayerStats()));
  });

  it.each([
    { die: null, combatOptions: [], expectedReactions: 0, expectedSpecial: 0, label: 'no die, no options' },
    { die: 6, combatOptions: [], expectedReactions: 0, expectedSpecial: 1, label: 'die only' },
    { die: 6, combatOptions: ['defense_add_to_ac'], expectedReactions: 1, expectedSpecial: 1, label: 'die + defense' },
    { die: 6, combatOptions: ['offense_add_to_damage'], expectedReactions: 1, expectedSpecial: 1, label: 'die + offense' },
    { die: 6, combatOptions: ['defense_add_to_ac', 'offense_add_to_damage'], expectedReactions: 2, expectedSpecial: 1, label: 'die + both' },
  ])('special actions and reactions counts are $expectedSpecial/$expectedReactions when $label', async ({ die, combatOptions, expectedReactions, expectedSpecial }) => {
    mockStore.set('Test Bard:bardicInspirationDie', die);
    mockStore.set('Test Bard:bardicInspirationCombatOptions', JSON.stringify(combatOptions));

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSpecialActions } = await import('./CharSpecialActions.jsx');
    const { default: CharReactions } = await import('./CharReactions.jsx');

    expect(CharSpecialActions).toHaveBeenCalled();
    expect(CharReactions).toHaveBeenCalled();

    const specialActions = CharSpecialActions.mock.calls[0][0].playerStats.specialActions;
    expect(specialActions.length).toBe(expectedSpecial);

    const reactions = CharReactions.mock.calls[0][0].playerStats.reactions;
    expect(reactions.length).toBe(expectedReactions);
  });

  it('handles invalid JSON in bardicInspirationCombatOptions gracefully', async () => {
    mockStore.set('Test Bard:bardicInspirationDie', 6);
    mockStore.set('Test Bard:bardicInspirationCombatOptions', 'not-valid-json');

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSpecialActions } = await import('./CharSpecialActions.jsx');
    const { default: CharReactions } = await import('./CharReactions.jsx');

    // Should still inject BI special action but no combat reactions (invalid JSON parses to [] via catch)
    const specialActions = CharSpecialActions.mock.calls[0][0].playerStats.specialActions;
    expect(specialActions.length).toBe(1);

    const reactions = CharReactions.mock.calls[0][0].playerStats.reactions;
    expect(reactions.length).toBe(0);
  });

  it('does not duplicate "Use Bardic Inspiration" if already in specialActions', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(createMockPlayerStats({
      specialActions: [{ name: 'Use Bardic Inspiration', description: 'existing' }],
    })));
    mockStore.set('Test Bard:bardicInspirationDie', 6);

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSpecialActions } = await import('./CharSpecialActions.jsx');
    const passedStats = CharSpecialActions.mock.calls[0][0].playerStats;
    const biActions = passedStats.specialActions.filter((a) => a.name === 'Use Bardic Inspiration');
    expect(biActions.length).toBe(1);
  });

  it('does not duplicate Combat Inspiration reactions if already present', async () => {
    mockStore.set('Test Bard:bardicInspirationDie', 6);
    mockStore.set('Test Bard:bardicInspirationGrantedBy', 'Bard');
    mockStore.set('Test Bard:bardicInspirationCombatOptions', JSON.stringify(['defense_add_to_ac', 'offense_add_to_damage']));
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(createMockPlayerStats({
      reactions: [
        { name: 'Combat Inspiration - Defense' },
        { name: 'Combat Inspiration - Offense' },
      ],
    })));

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharReactions } = await import('./CharReactions.jsx');
    const passedStats = CharReactions.mock.calls[0][0].playerStats;
    const defenseReactions = passedStats.reactions.filter((r) => r.name === 'Combat Inspiration - Defense');
    const offenseReactions = passedStats.reactions.filter((r) => r.name === 'Combat Inspiration - Offense');
    expect(defenseReactions.length).toBe(1);
    expect(offenseReactions.length).toBe(1);
  });

  it('injects the correct die size into reaction descriptions for defense', async () => {
    mockStore.set('Test Bard:bardicInspirationDie', 10);
    mockStore.set('Test Bard:bardicInspirationGrantedBy', 'Bard');
    mockStore.set('Test Bard:bardicInspirationCombatOptions', JSON.stringify(['defense_add_to_ac']));

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharReactions } = await import('./CharReactions.jsx');
    expect(CharReactions.mock.calls.length).toBeGreaterThan(0);
    const passedStats = CharReactions.mock.calls[0][0].playerStats;
    expect(passedStats.reactions.length).toBe(1);
    expect(passedStats.reactions[0].name).toBe('Combat Inspiration - Defense');
    expect(passedStats.reactions[0].description).toContain('1d10');
  });

  it('injects the correct die size into reaction descriptions for offense', async () => {
    mockStore.set('Test Bard:bardicInspirationDie', 12);
    mockStore.set('Test Bard:bardicInspirationGrantedBy', 'Bard');
    mockStore.set('Test Bard:bardicInspirationCombatOptions', JSON.stringify(['offense_add_to_damage']));

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharReactions } = await import('./CharReactions.jsx');
    expect(CharReactions.mock.calls.length).toBeGreaterThan(0);
    const passedStats = CharReactions.mock.calls[0][0].playerStats;
    expect(passedStats.reactions.length).toBe(1);
    expect(passedStats.reactions[0].name).toBe('Combat Inspiration - Offense');
    expect(passedStats.reactions[0].description).toContain('1d12');
  });
});
