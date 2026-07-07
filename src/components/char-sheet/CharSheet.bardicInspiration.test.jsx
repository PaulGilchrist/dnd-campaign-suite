// @cleaned-by-ai
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CharSheet from './CharSheet';
import rulesFactory from '../../services/rules/rulesFactory.js';

// ---------------------------------------------------------------------------
// Mocks
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
    <div data-testid="char-reactions">
      <span>{playerStats?.name || 'none'}</span>
      <span data-testid="reactions-count">{playerStats?.reactions?.length || 0}</span>
    </div>
  )),
}));

vi.mock('./CharSpecialActions.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-special-actions">
      <span>{playerStats?.name || 'none'}</span>
      <span data-testid="special-actions-count">{playerStats?.specialActions?.length || 0}</span>
    </div>
  )),
}));

vi.mock('./CharCharacterAdvancement.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-character-advancement">
      <span>{playerStats?.name || 'none'}</span>
      <span data-testid="advancement-count">{playerStats?.characterAdvancement?.length || 0}</span>
    </div>
  )),
}));

vi.mock('./char-spells/CharSpells.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-spells"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

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

vi.mock('../../services/rules/rulesFactory.js', () => ({
  default: {
    getPlayerStats: vi.fn().mockImplementation(() => Promise.resolve(createMockPlayerStats())),
  },
}));

const mockStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((key, prop, _camp) => mockStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn((_key, _prop, _val, _camp) => mockStore.set(`${_key}:${_prop}`, _val)),
  useRuntimeValue: vi.fn((key, prop) => {
    if (prop === 'exhaustionLevel') return 0;
    if (prop === 'bardicInspirationDie') return mockStore.get(`${key}:bardicInspirationDie`) ?? null;
    if (prop === 'bardicInspirationCombatOptions') return mockStore.get(`${key}:bardicInspirationCombatOptions`) ?? null;
    if (prop === 'activeConditions') return [];
    if (prop === 'activeBuffs') return [];
    if (prop === 'targetEffects') return [];
    return null;
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  });

  it.each([
    { die: null, combatOptions: [], expectedReactions: 0, expectedSpecial: 0, label: 'no die, no options' },
    { die: 'd6', combatOptions: [], expectedReactions: 0, expectedSpecial: 1, label: 'die only' },
    { die: 'd6', combatOptions: ['defense_add_to_ac'], expectedReactions: 1, expectedSpecial: 1, label: 'die + defense' },
    { die: 'd6', combatOptions: ['offense_add_to_damage'], expectedReactions: 1, expectedSpecial: 1, label: 'die + offense' },
    { die: 'd6', combatOptions: ['defense_add_to_ac', 'offense_add_to_damage'], expectedReactions: 2, expectedSpecial: 1, label: 'die + both' },
  ])('reactions count is $expectedReactions and special actions count is $expectedSpecial when $label', async ({ die, combatOptions, expectedReactions, expectedSpecial }) => {
    mockStore.set('Test Bard:bardicInspirationDie', die);
    mockStore.set('Test Bard:bardicInspirationCombatOptions', JSON.stringify(combatOptions));

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    expect(screen.getByTestId('reactions-count')).toHaveTextContent(String(expectedReactions));
    expect(screen.getByTestId('special-actions-count')).toHaveTextContent(String(expectedSpecial));
  });

  it('does not duplicate "Use Bardic Inspiration" if already in specialActions', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(createMockPlayerStats({
      specialActions: [{ name: 'Use Bardic Inspiration', description: 'existing' }],
    })));
    mockStore.set('Test Bard:bardicInspirationDie', 'd6');

    render(<CharSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    expect(screen.getByTestId('special-actions-count')).toHaveTextContent('1');
  });
});
