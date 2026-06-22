// @improved-by-ai
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CharSheet from './CharSheet';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('./char-summary/CharSummary.jsx', () => ({
  default: vi.fn(({ playerStats, conditionEffects }) => (
    <div data-testid="char-summary">
      <span>{playerStats?.name || 'none'}</span>
      <span data-testid="condition-effects">{JSON.stringify(conditionEffects)}</span>
    </div>
  )),
}));

vi.mock('./CharAbilities.jsx', () => ({
  default: vi.fn(({ playerStats, conditionEffects, isRaging }) => (
    <div data-testid="char-abilities">
      <span>{playerStats?.name || 'none'}</span>
      <span data-testid="is-raging">{String(isRaging)}</span>
      <span data-testid="condition-effects">{JSON.stringify(conditionEffects)}</span>
    </div>
  )),
}));

vi.mock('./CharActions.jsx', () => ({
  default: vi.fn(({ playerStats, cannotAct, conditionAttackMode }) => (
    <div data-testid="char-actions">
      <span>{playerStats?.name || 'none'}</span>
      <span data-testid="cannot-act">{String(cannotAct)}</span>
      <span data-testid="attack-mode">{conditionAttackMode || 'none'}</span>
    </div>
  )),
}));

vi.mock('./CharInventory.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-inventory"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharReactions.jsx', () => ({
  default: vi.fn(({ playerStats, cannotAct }) => (
    <div data-testid="char-reactions">
      <span>{playerStats?.name || 'none'}</span>
      <span data-testid="reactions-cannot-act">{String(cannotAct)}</span>
    </div>
  )),
}));

vi.mock('./CharSpecialActions.jsx', () => ({
  default: vi.fn(({ playerStats, cannotAct }) => (
    <div data-testid="char-special-actions">
      <span>{playerStats?.name || 'none'}</span>
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
      <span data-testid="spells-attack-mode">{conditionAttackMode || 'none'}</span>
    </div>
  )),
}));

vi.mock('../../services/rules/rulesFactory.js', () => ({
  default: {
    getPlayerStats: vi.fn().mockResolvedValue({
      name: 'Test Fighter',
      level: 5,
      hitPoints: { current: 45, max: 45 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: { spells: [], maxPreparedSpells: 5 },
      rules: '5e',
      automation: { passives: [] },
      class: { name: 'Fighter' },
      speed: 30,
      race: { speed: 30 },
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      characterAdvancement: [],
      skillProficiencies: [],
    }),
  },
}));

const mockStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((key, prop) => mockStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn((_key, _prop, _val, _camp) => mockStore.set(`${_key}:${_prop}`, _val)),
  useRuntimeValue: vi.fn((_key, prop) => {
    if (prop === 'exhaustionLevel') return 0;
    if (prop === 'bardicInspirationDie') return null;
    if (prop === 'bardicInspirationCombatOptions') return null;
    if (prop === 'activeConditions') return mockStore.get(`${_key}:activeConditions`) ?? [];
    if (prop === 'activeBuffs') return mockStore.get(`${_key}:activeBuffs`) ?? [];
    if (prop === 'targetEffects') return mockStore.get(`${_key}:targetEffects`) ?? [];
    return null;
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockPlayerSummary = {
  name: 'Test Fighter',
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
// Tests — Condition effects and combat state
// ---------------------------------------------------------------------------

describe('condition effects and combat state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with empty active conditions', async () => {
    mockStore.set('Test Fighter:activeConditions', []);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('cannot-act')).toHaveTextContent('false');
  });

  it('passes cannotAct=false to CharActions when no incapacitating conditions', async () => {
    mockStore.set('Test Fighter:activeConditions', []);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('cannot-act')).toHaveTextContent('false');
  });

  it('passes conditionAttackMode to CharActions', async () => {
    mockStore.set('Test Fighter:activeConditions', []);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('attack-mode')).toBeInTheDocument();
  });

  it('passes cannotAct to CharReactions', async () => {
    mockStore.set('Test Fighter:activeConditions', []);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('reactions-cannot-act')).toBeInTheDocument();
  });

  it('passes cannotAct to CharSpecialActions', async () => {
    mockStore.set('Test Fighter:activeConditions', []);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('special-actions-cannot-act')).toBeInTheDocument();
  });

  it('passes cannotAct to CharSpells', async () => {
    mockStore.set('Test Fighter:activeConditions', []);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('spells-cannot-act')).toBeInTheDocument();
  });

  it('passes conditionAttackMode to CharSpells', async () => {
    mockStore.set('Test Fighter:activeConditions', []);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('spells-attack-mode')).toBeInTheDocument();
  });

  it('renders with null activeMapName', async () => {
    mockStore.set('Test Fighter:activeConditions', []);
    render(<CharSheet {...defaultProps} activeMapName={null} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with undefined campaignName', async () => {
    mockStore.set('Test Fighter:activeConditions', []);
    const props = { ...defaultProps };
    delete props.campaignName;
    render(<CharSheet {...props} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});
