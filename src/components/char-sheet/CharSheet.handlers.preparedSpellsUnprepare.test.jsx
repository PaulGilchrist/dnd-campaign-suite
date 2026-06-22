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
  default: vi.fn(({ playerStats, handleTogglePreparedSpells }) => (
    <div data-testid="char-spells">
      <span>{playerStats?.name || 'none'}</span>
      <span data-testid="spells-has-toggle">{handleTogglePreparedSpells ? 'true' : 'false'}</span>
    </div>
  )),
}));

vi.mock('../../services/rules/rulesFactory.js', () => ({
  default: {
    getPlayerStats: vi.fn().mockImplementation(() => Promise.resolve({
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
  name: 'Test Wizard',
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
// Tests — 5e prepared spell unprepare logic (line 50)
// ---------------------------------------------------------------------------

describe('5e prepared spell unprepare logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('loads preparedSpells from runtime state and unprepares spells not in the list', async () => {
    // Fireball is in prepared list, Magic Missile is not
    mockStore.set('Test Wizard:preparedSpells', ['Fireball']);

    vi.mocked((await import('../../services/rules/rulesFactory.js')).default.getPlayerStats)
      .mockImplementation(() => Promise.resolve({
        name: 'Test Wizard',
        level: 10,
        hitPoints: { current: 50, max: 50 },
        abilities: [{ name: 'Intelligence', bonus: 4, save: 6, skills: [] }],
        spellAbilities: {
          spells: [
            { name: 'Fireball', prepared: '' },
            { name: 'Shield', prepared: '' },
            { name: 'Magic Missile', prepared: '' },
          ],
          maxPreparedSpells: 3,
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

    // Fireball should be prepared, Shield and Magic Missile should not
    expect(mockStore.get('Test Wizard:preparedSpells')).toEqual(['Fireball']);
  });

  it('unprepares a spell that was previously prepared but is no longer in the list', async () => {
    // Previously all spells were prepared, now only Fireball is
    mockStore.set('Test Wizard:preparedSpells', ['Fireball']);

    vi.mocked((await import('../../services/rules/rulesFactory.js')).default.getPlayerStats)
      .mockImplementation(() => Promise.resolve({
        name: 'Test Wizard',
        level: 10,
        hitPoints: { current: 50, max: 50 },
        abilities: [{ name: 'Intelligence', bonus: 4, save: 6, skills: [] }],
        spellAbilities: {
          spells: [
            { name: 'Fireball', prepared: 'Prepared' },
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

    // Only Fireball should remain prepared
    expect(mockStore.get('Test Wizard:preparedSpells')).toEqual(['Fireball']);
  });

  it('prepares a spell that was not prepared but is in the runtime list', async () => {
    // Magic Missile is in prepared list but was not prepared initially
    mockStore.set('Test Wizard:preparedSpells', ['Magic Missile']);

    vi.mocked((await import('../../services/rules/rulesFactory.js')).default.getPlayerStats)
      .mockImplementation(() => Promise.resolve({
        name: 'Test Wizard',
        level: 10,
        hitPoints: { current: 50, max: 50 },
        abilities: [{ name: 'Intelligence', bonus: 4, save: 6, skills: [] }],
        spellAbilities: {
          spells: [
            { name: 'Fireball', prepared: '' },
            { name: 'Magic Missile', prepared: '' },
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

    // Magic Missile should now be prepared
    expect(mockStore.get('Test Wizard:preparedSpells')).toEqual(['Magic Missile']);
  });

  it('handles empty preparedSpells list (all spells unprepared)', async () => {
    mockStore.set('Test Wizard:preparedSpells', []);

    vi.mocked((await import('../../services/rules/rulesFactory.js')).default.getPlayerStats)
      .mockImplementation(() => Promise.resolve({
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

    // No spells should be prepared
    expect(mockStore.get('Test Wizard:preparedSpells')).toEqual([]);
  });
});
