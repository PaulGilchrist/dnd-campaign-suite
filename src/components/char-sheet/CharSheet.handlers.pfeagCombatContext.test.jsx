// @improved-by-ai
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CharSheet from './CharSheet';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { isCreatureWarded } from '../../services/automation/handlers/buffs/protectionFromEvilAndGoodHandler.js';

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
      spellAbilities: {
        spells: [{ name: 'Fireball', prepared: '' }],
        maxPreparedSpells: 3,
      },
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

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../services/automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isCreatureWarded: vi.fn(() => false),
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
// Tests — Protection from Evil and Good save advantage with combat context
// ---------------------------------------------------------------------------

describe('protection from evil and good save advantage with combat context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with pfeagActive, charmed condition, and combat context attacker', async () => {
    mockStore.set('test-campaign:targetEffects', []);
    mockStore.set('Test Character:activeBuffs', [{ effect: 'protection_from_evil_and_good' }]);
    mockStore.set('Test Character:activeConditions', ['charmed']);

    vi.mocked(getCombatSummary).mockReturnValue({
      attackerName: 'Goblin',
      creatures: [
        { name: 'Goblin', type: 'Humanoid', position: { x: 10, y: 10 } },
        { name: 'Test Character', position: { x: 20, y: 20 } },
      ],
    });
    vi.mocked(isCreatureWarded).mockReturnValue(true);

    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with pfeagActive, frightened condition, and combat context attacker', async () => {
    mockStore.set('test-campaign:targetEffects', []);
    mockStore.set('Test Character:activeBuffs', [{ effect: 'protection_from_evil_and_good' }]);
    mockStore.set('Test Character:activeConditions', ['frightened']);

    vi.mocked(getCombatSummary).mockReturnValue({
      attackerName: 'Vampire',
      creatures: [
        { name: 'Vampire', type: 'Undead', position: { x: 10, y: 10 } },
        { name: 'Test Character', position: { x: 20, y: 20 } },
      ],
    });
    vi.mocked(isCreatureWarded).mockReturnValue(true);

    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with pfeagActive but no attacker in combat context', async () => {
    mockStore.set('test-campaign:targetEffects', []);
    mockStore.set('Test Character:activeBuffs', [{ effect: 'protection_from_evil_and_good' }]);
    mockStore.set('Test Character:activeConditions', ['charmed']);

    vi.mocked(getCombatSummary).mockReturnValue({
      attackerName: null,
      creatures: [],
    });

    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders without combat context (no combat active)', async () => {
    mockStore.set('test-campaign:targetEffects', []);
    mockStore.set('Test Character:activeBuffs', [{ effect: 'protection_from_evil_and_good' }]);
    mockStore.set('Test Character:activeConditions', ['charmed']);

    vi.mocked(getCombatSummary).mockReturnValue(null);

    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('does not add targetDisadvantage when attacker is not warded', async () => {
    mockStore.set('test-campaign:targetEffects', []);
    mockStore.set('Test Character:activeBuffs', [{ effect: 'protection_from_evil_and_good' }]);
    mockStore.set('Test Character:activeConditions', ['charmed']);

    vi.mocked(getCombatSummary).mockReturnValue({
      attackerName: 'Goblin',
      creatures: [
        { name: 'Goblin', type: 'Humanoid', position: { x: 10, y: 10 } },
        { name: 'Test Character', position: { x: 20, y: 20 } },
      ],
    });
    vi.mocked(isCreatureWarded).mockReturnValue(false);

    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});
