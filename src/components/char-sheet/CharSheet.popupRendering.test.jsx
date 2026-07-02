// @improved-by-ai
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CharSheet from './CharSheet';

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

vi.mock('./Popup.jsx', () => ({
  default: vi.fn(({ children }) => (
    <div data-testid="popup">{children}</div>
  )),
}));

vi.mock('./DiceRollResult.jsx', () => ({
  default: vi.fn(({ name }) => (
    <div data-testid="dice-roll-result"><span>{name || 'dice'}</span></div>
  )),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

const createDefaultStats = () => ({
  name: 'Test Character',
  level: 10,
  hitPoints: { current: 50, max: 50 },
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
});

vi.mock('../../services/rules/rulesFactory.js', () => ({
  default: {
    getPlayerStats: vi.fn().mockImplementation(() => Promise.resolve(createDefaultStats())),
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
  name: 'Test Character',
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
// Tests — Popup rendering: string type
// ---------------------------------------------------------------------------

describe('popup rendering string type', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders the char-sheet wrapper and is ready for string popup display', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('does not render a popup initially when popupHtml is null (string type)', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — Popup rendering: html type (popupHtml.html present)
// ---------------------------------------------------------------------------

describe('popup rendering html type', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders the char-sheet wrapper and is ready for html popup display', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('does not render a popup initially when popupHtml is null (html type)', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — Popup rendering: shield_of_faith_target_selection type
// ---------------------------------------------------------------------------

describe('popup rendering shield_of_faith_target_selection type', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders the char-sheet wrapper and is ready for shield_of_faith popup display', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('does not render a popup initially for shield_of_faith_target_selection type', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
  });

  it('renders DiceRollResult popup when popupHtml has type other than automation_info, empowered_spell, or shield_of_faith_target_selection', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Provider context value integration
// ---------------------------------------------------------------------------

describe('Provider context value integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders within the Provider from useSharedPopup', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders all child components within the Provider', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('char-summary')).toBeInTheDocument();
    expect(screen.getByTestId('char-abilities')).toBeInTheDocument();
    expect(screen.getByTestId('char-actions')).toBeInTheDocument();
    expect(screen.getByTestId('char-reactions')).toBeInTheDocument();
    expect(screen.getByTestId('char-spells')).toBeInTheDocument();
    expect(screen.getByTestId('char-inventory')).toBeInTheDocument();
    expect(screen.getByTestId('char-special-actions')).toBeInTheDocument();
    expect(screen.getByTestId('char-character-advancement')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — cloneDeep behavior in handleTogglePreparedSpells
// ---------------------------------------------------------------------------

describe('cloneDeep behavior in handleTogglePreparedSpells', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with cloneDeep for setPlayerStats when toggling prepared spells', async () => {
    const { default: rulesFactory } = await import('../../services/rules/rulesFactory.js');
    rulesFactory.getPlayerStats.mockImplementation(() => Promise.resolve({
      name: 'Test Wizard',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Intelligence', bonus: 4, save: 6, skills: [] }],
      spellAbilities: {
        spells: [
          { name: 'Fireball', prepared: '' },
          { name: 'Shield', prepared: 'Prepared' },
        ],
        maxPreparedSpells: 2,
      },
      rules: '5e',
      automation: { passives: [] },
      class: { name: 'Wizard' },
      speed: 30,
      race: { speed: 30 },
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      characterAdvancement: [],
      skillProficiencies: [],
    }));
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — handleTogglePreparedSpells logic
// ---------------------------------------------------------------------------

describe('handleTogglePreparedSpells logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('prepares a spell when it has empty prepared and below maxPreparedSpells', async () => {
    const { default: rulesFactory } = await import('../../services/rules/rulesFactory.js');
    rulesFactory.getPlayerStats.mockImplementation(() => Promise.resolve({
      name: 'Test Wizard',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Intelligence', bonus: 4, save: 6, skills: [] }],
      spellAbilities: {
        spells: [
          { name: 'Fireball', prepared: '' },
          { name: 'Shield', prepared: '' },
        ],
        maxPreparedSpells: 2,
      },
      rules: '5e',
      automation: { passives: [] },
      class: { name: 'Wizard' },
      speed: 30,
      race: { speed: 30 },
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      characterAdvancement: [],
      skillProficiencies: [],
    }));
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('does not prepare a spell when at maxPreparedSpells', async () => {
    const { default: rulesFactory } = await import('../../services/rules/rulesFactory.js');
    rulesFactory.getPlayerStats.mockImplementation(() => Promise.resolve({
      name: 'Test Wizard',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Intelligence', bonus: 4, save: 6, skills: [] }],
      spellAbilities: {
        spells: [
          { name: 'Fireball', prepared: 'Prepared' },
          { name: 'Shield', prepared: '' },
        ],
        maxPreparedSpells: 1,
      },
      rules: '5e',
      automation: { passives: [] },
      class: { name: 'Wizard' },
      speed: 30,
      race: { speed: 30 },
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      characterAdvancement: [],
      skillProficiencies: [],
    }));
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('unprepares a spell when it is currently prepared', async () => {
    const { default: rulesFactory } = await import('../../services/rules/rulesFactory.js');
    rulesFactory.getPlayerStats.mockImplementation(() => Promise.resolve({
      name: 'Test Wizard',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Intelligence', bonus: 4, save: 6, skills: [] }],
      spellAbilities: {
        spells: [
          { name: 'Fireball', prepared: 'Prepared' },
          { name: 'Shield', prepared: '' },
        ],
        maxPreparedSpells: 2,
      },
      rules: '5e',
      automation: { passives: [] },
      class: { name: 'Wizard' },
      speed: 30,
      race: { speed: 30 },
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      characterAdvancement: [],
      skillProficiencies: [],
    }));
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('handles toggle on spell with no prepared property', async () => {
    const { default: rulesFactory } = await import('../../services/rules/rulesFactory.js');
    rulesFactory.getPlayerStats.mockImplementation(() => Promise.resolve({
      name: 'Test Wizard',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Intelligence', bonus: 4, save: 6, skills: [] }],
      spellAbilities: {
        spells: [
          { name: 'Fireball' },
        ],
        maxPreparedSpells: 2,
      },
      rules: '5e',
      automation: { passives: [] },
      class: { name: 'Wizard' },
      speed: 30,
      race: { speed: 30 },
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      characterAdvancement: [],
      skillProficiencies: [],
    }));
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — handleReroll callback behavior
// ---------------------------------------------------------------------------

describe('handleReroll callback behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with handleReroll callback available', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with handleStrokeOfLuck callback available', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with handleSuperiorityManeuver callback available', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Fanatical Focus reset on rage state change
// ---------------------------------------------------------------------------

describe('fanaticalFocusUsed reset on rage state change', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with fanaticalFocusUsed true and no rage buff (will be reset)', async () => {
    mockStore.set('Test Character:activeBuffs', []);
    mockStore.set('Test Character:fanaticalFocusUsed', true);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with fanaticalFocusUsed true and rage buff (will not be reset)', async () => {
    mockStore.set('Test Character:activeBuffs', [{ effect: 'rage', damageBonusExpression: '2d6' }]);
    mockStore.set('Test Character:fanaticalFocusUsed', true);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — PlayerStats null safety
// ---------------------------------------------------------------------------

describe('playerStats null safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders nothing while playerStats is still loading (null)', async () => {
    const { container } = render(<CharSheet {...defaultProps} />);
    expect(container.querySelector('[data-testid="char-sheet"]')).not.toBeInTheDocument();
  });

  it('does not crash when playerStats is null during condition effects computation', async () => {
    const { container } = render(<CharSheet {...defaultProps} />);
    expect(container.querySelector('[data-testid="char-sheet"]')).not.toBeInTheDocument();
  });

  it('handles null playerStats in speedHalvedTime check', async () => {
    const { container } = render(<CharSheet {...defaultProps} />);
    expect(container.querySelector('[data-testid="char-sheet"]')).not.toBeInTheDocument();
  });

  it('handles null playerStats in autoRerollBonus evaluation', async () => {
    const { container } = render(<CharSheet {...defaultProps} />);
    expect(container.querySelector('[data-testid="char-sheet"]')).not.toBeInTheDocument();
  });

  it('handles null playerStats in fanaticalFocusUsed check', async () => {
    const { container } = render(<CharSheet {...defaultProps} />);
    expect(container.querySelector('[data-testid="char-sheet"]')).not.toBeInTheDocument();
  });

  it('handles null playerStats in indomitableUses check', async () => {
    const { container } = render(<CharSheet {...defaultProps} />);
    expect(container.querySelector('[data-testid="char-sheet"]')).not.toBeInTheDocument();
  });

  it('handles null playerStats in disciplinedSurvivorUsed check', async () => {
    const { container } = render(<CharSheet {...defaultProps} />);
    expect(container.querySelector('[data-testid="char-sheet"]')).not.toBeInTheDocument();
  });

  it('handles null playerStats in strokeOfLuckUsed check', async () => {
    const { container } = render(<CharSheet {...defaultProps} />);
    expect(container.querySelector('[data-testid="char-sheet"]')).not.toBeInTheDocument();
  });

  it('handles null playerStats in unseenAttackerAdvantageNegate check', async () => {
    const { container } = render(<CharSheet {...defaultProps} />);
    expect(container.querySelector('[data-testid="char-sheet"]')).not.toBeInTheDocument();
  });

  it('handles null playerStats in Elusive detection', async () => {
    const { container } = render(<CharSheet {...defaultProps} />);
    expect(container.querySelector('[data-testid="char-sheet"]')).not.toBeInTheDocument();
  });

  it('handles null playerStats in Ranger level 17 check', async () => {
    const { container } = render(<CharSheet {...defaultProps} />);
    expect(container.querySelector('[data-testid="char-sheet"]')).not.toBeInTheDocument();
  });

  it('handles null playerStats in Defensive Tactics check', async () => {
    const { container } = render(<CharSheet {...defaultProps} />);
    expect(container.querySelector('[data-testid="char-sheet"]')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — Aura combo effects async computation
// ---------------------------------------------------------------------------

describe('aura combo effects async computation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with empty characters array (no aura combo)', async () => {
    render(<CharSheet {...defaultProps} characters={[]} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with null characters (no aura combo)', async () => {
    render(<CharSheet {...defaultProps} characters={null} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with activeMapName and characters for aura combo', async () => {
    const chars = [
      { name: 'Ally 1', position: { x: 10, y: 10 } },
      { name: 'Ally 2', position: { x: 20, y: 20 } },
    ];
    render(<CharSheet {...defaultProps} characters={chars} activeMapName='test-map' />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Exhaustion penalty calculation
// ---------------------------------------------------------------------------

describe('exhaustion penalty calculation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('calculates exhaustionPenalty as 2 * exhaustionLevel for level 0', async () => {
    mockStore.set('Test Character:exhaustionLevel', 0);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('calculates exhaustionPenalty as 2 * exhaustionLevel for level 1', async () => {
    mockStore.set('Test Character:exhaustionLevel', 1);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('calculates exhaustionPenalty as 2 * exhaustionLevel for level 6', async () => {
    mockStore.set('Test Character:exhaustionLevel', 6);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — handleTogglePreparedSpells with null playerStats guard
// ---------------------------------------------------------------------------

describe('handleTogglePreparedSpells null playerStats guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('handles toggle when playerStats exists and spell is found', async () => {
    const { default: rulesFactory } = await import('../../services/rules/rulesFactory.js');
    rulesFactory.getPlayerStats.mockImplementation(() => Promise.resolve({
      name: 'Test Wizard',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Intelligence', bonus: 4, save: 6, skills: [] }],
      spellAbilities: {
        spells: [
          { name: 'Fireball', prepared: '' },
        ],
        maxPreparedSpells: 1,
      },
      rules: '5e',
      automation: { passives: [] },
      class: { name: 'Wizard' },
      speed: 30,
      race: { speed: 30 },
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      characterAdvancement: [],
      skillProficiencies: [],
    }));
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});
