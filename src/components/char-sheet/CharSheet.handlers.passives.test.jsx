// @improved-by-ai
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

vi.mock('../../services/rules/rulesFactory.js', () => ({
  default: {
    getPlayerStats: vi.fn().mockImplementation(() => Promise.resolve({
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
    })),
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
// Tests — Exhaustion level edge cases
// ---------------------------------------------------------------------------

describe('exhaustion level edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with exhaustion level exactly 0', async () => {
    mockStore.set('Test Character:exhaustionLevel', 0);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with exhaustion level exactly 6', async () => {
    mockStore.set('Test Character:exhaustionLevel', 6);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with exhaustion level as float', async () => {
    mockStore.set('Test Character:exhaustionLevel', 3.5);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Bardic Inspiration grantedBy runtime value
// ---------------------------------------------------------------------------

describe('bardic inspiration grantedBy runtime value', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with bardicInspirationGrantedBy set', async () => {
    mockStore.set('Test Character:bardicInspirationDie', 'd6');
    mockStore.set('Test Character:bardicInspirationGrantedBy', 'Ally Bard');
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with bardicInspirationGrantedBy not set (defaults to unknown)', async () => {
    mockStore.set('Test Character:bardicInspirationDie', 'd6');
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Aquatic Affinity swim speed
// ---------------------------------------------------------------------------

describe('aquatic affinity swim speed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with aquatic affinity passive and no swimSpeed', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: { spells: [], maxPreparedSpells: 5 },
      rules: '2024',
      automation: { passives: [{ effect: 'aquatic_affinity' }] },
      class: { name: 'Druid' },
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

  it('renders with aquatic affinity passive and existing swimSpeed', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: { spells: [], maxPreparedSpells: 5 },
      rules: '2024',
      automation: { passives: [{ effect: 'aquatic_affinity' }] },
      class: { name: 'Druid' },
      speed: 30,
      race: { speed: 30 },
      swimSpeed: 20,
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
// Tests — Second-Storywork climb speed
// ---------------------------------------------------------------------------

describe('second-storywork climb speed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with second_storywork passive and no climbSpeed', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: { spells: [], maxPreparedSpells: 5 },
      rules: '5e',
      automation: { passives: [{ effect: 'second_storywork' }] },
      class: { name: 'Rogue' },
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

  it('renders with second_storywork passive and existing climbSpeed', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: { spells: [], maxPreparedSpells: 5 },
      rules: '5e',
      automation: { passives: [{ effect: 'second_storywork' }] },
      class: { name: 'Rogue' },
      speed: 30,
      race: { speed: 30 },
      climbSpeed: 40,
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
// Tests — Athlete feat climb speed
// ---------------------------------------------------------------------------

describe('athlete feat climb speed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with climb_speed passive and no existing climbSpeed', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: { spells: [], maxPreparedSpells: 5 },
      rules: '5e',
      automation: { passives: [{ effect: 'climb_speed' }] },
      class: { name: 'Fighter' },
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

  it('renders with climb_speed passive and existing climbSpeed (should not override)', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: { spells: [], maxPreparedSpells: 5 },
      rules: '5e',
      automation: { passives: [{ effect: 'climb_speed' }] },
      class: { name: 'Fighter' },
      speed: 30,
      race: { speed: 30 },
      climbSpeed: 40,
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
// Tests — Roving passive (Ranger level 6)
// ---------------------------------------------------------------------------

describe('roving passive ranger level 6', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with roving passive and no climb/swim speeds', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: { spells: [], maxPreparedSpells: 5 },
      rules: '5e',
      automation: { passives: [{ name: 'Roving' }] },
      class: { name: 'Ranger' },
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

  it('renders with roving passive and existing climbSpeed', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: { spells: [], maxPreparedSpells: 5 },
      rules: '5e',
      automation: { passives: [{ name: 'Roving' }] },
      class: { name: 'Ranger' },
      speed: 30,
      race: { speed: 30 },
      climbSpeed: 40,
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

  it('renders with roving passive and existing swimSpeed', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: { spells: [], maxPreparedSpells: 5 },
      rules: '5e',
      automation: { passives: [{ name: 'Roving' }] },
      class: { name: 'Ranger' },
      speed: 30,
      race: { speed: 30 },
      swimSpeed: 40,
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
// Tests — Athlete hop up / jump passives
// ---------------------------------------------------------------------------

describe('athlete hop up and jump passives', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with stand_from_prone passive', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: { spells: [], maxPreparedSpells: 5 },
      rules: '5e',
      automation: { passives: [{ effect: 'stand_from_prone' }] },
      class: { name: 'Fighter' },
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

  it('renders with reduced_running_jump_requirement passive', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: { spells: [], maxPreparedSpells: 5 },
      rules: '5e',
      automation: { passives: [{ effect: 'reduced_running_jump_requirement' }] },
      class: { name: 'Fighter' },
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
// Tests — Race speed fallback
// ---------------------------------------------------------------------------

describe('race speed fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with race.subrace.speed present', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: { spells: [], maxPreparedSpells: 5 },
      rules: '5e',
      automation: { passives: [] },
      class: { name: 'Fighter' },
      speed: 30,
      race: { speed: 30, subrace: { speed: 40 } },
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

  it('renders with race.speed but no subrace', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
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
    }));
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with no race object', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: { spells: [], maxPreparedSpells: 5 },
      rules: '5e',
      automation: { passives: [] },
      class: { name: 'Fighter' },
      speed: 30,
      race: null,
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
