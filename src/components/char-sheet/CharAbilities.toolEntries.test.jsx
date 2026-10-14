import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharAbilities from './CharAbilities';

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const mockFn = vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
  }));
  return { default: mockFn };
});

const mockStore = new Map();
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn((key, prop) => mockStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn((key, prop) => mockStore.get(`${key}:${prop}`) ?? null),
}));

const mockEquipment = [
  { name: "Healer's Kit", equipment_category: 'Tools', ability: 'Wisdom', utilize: 'Healing' },
  { name: "Thieves' Tools", equipment_category: 'Tools', ability: 'Dexterity', utilize: 'Pick locks' },
  { name: 'Musical Instrument (Lute)', equipment_category: 'Tools', ability: 'Charisma', utilize: 'Performance' },
  { name: 'Non-tool item', equipment_category: 'Equipment', ability: null, utilize: null },
];

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn(() => Promise.resolve(mockEquipment)),
}));

const mockAllAbilityScores = [
  { full_name: 'Strength', description: 'STR desc' },
  { full_name: 'Dexterity', description: 'DEX desc' },
  { full_name: 'Constitution', description: 'CON desc' },
  { full_name: 'Intelligence', description: 'INT desc' },
  { full_name: 'Wisdom', description: 'WIS desc' },
  { full_name: 'Charisma', description: 'CHA desc' },
];

function createPlayerStats(overrides = {}) {
  return {
    name: 'Test Fighter',
    level: 5,
    abilities: [
      { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
      { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
      { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
      { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
      { name: 'Wisdom', bonus: 2, save: 4, totalScore: 14, skills: [] },
      { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
    ],
    skillProficiencies: [],
    toolProficiencies: [],
    automation: { primalKnowledge: [], passives: [] },
    expertise: [],
    inventory: { equipped: [], backpack: [] },
    ...overrides,
  };
}

const defaultProps = {
  allAbilityScores: mockAllAbilityScores,
  playerStats: createPlayerStats(),
  campaignName: 'test-campaign',
  exhaustionPenalty: 0,
  conditionEffects: {},
  isRaging: false,
  onReroll: vi.fn(),
  onStrokeOfLuck: vi.fn(),
};

describe('CharAbilities tool entries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  describe('equipment loading', () => {
    it('renders tool entries when character has tool proficiencies', async () => {
      const stats = createPlayerStats({
        level: 5,
        toolProficiencies: ["Healer's Kit"],
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 2, save: 4, totalScore: 14, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      // Proficiency = Math.floor((5-1)/4 + 2) = 3
      // Healer's Kit: wis(2) + prof(3) = 5
      await screen.findByText("Healer's Kit (+5)");
    });

    it('renders tool entries with ability bonus only when not proficient', async () => {
      const stats = createPlayerStats({
        level: 5,
        toolProficiencies: [],
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 2, save: 4, totalScore: 14, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      // Not proficient: bonus = wisBonus(2) = 2
      await screen.findByText("Healer's Kit (+2)");
    });

    it('includes tools from both equipped and backpack inventory', async () => {
      const stats = createPlayerStats({
        level: 5,
        toolProficiencies: ["Healer's Kit", "Thieves' Tools"],
        inventory: { equipped: ["Healer's Kit"], backpack: ["Thieves' Tools"] },
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 4, save: 6, totalScore: 18, skills: [] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 2, save: 4, totalScore: 14, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      // Proficiency = Math.floor((5-1)/4 + 2) = 3
      // Healer's Kit: wis(2) + prof(3) = 5
      // Thieves' Tools: dex(4) + prof(3) = 7
      await screen.findByText("Healer's Kit (+5)");
      await screen.findByText("Thieves' Tools (+7)");
    });

    it('does not show tools that are not in equipment data', async () => {
      const stats = createPlayerStats({
        level: 5,
        toolProficiencies: ['Unknown Tool'],
        inventory: { equipped: ['Unknown Tool'], backpack: [] },
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 2, save: 4, totalScore: 14, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      expect(screen.queryByText('Unknown Tool')).not.toBeInTheDocument();
    });

    it('does not show non-tool equipment items', async () => {
      const stats = createPlayerStats({
        level: 5,
        toolProficiencies: [],
        inventory: { equipped: ['Non-tool item'], backpack: [] },
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 2, save: 4, totalScore: 14, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      expect(screen.queryByText('Non-tool item')).not.toBeInTheDocument();
    });

    it('deduplicates tools appearing in both equipped and backpack', async () => {
      const stats = createPlayerStats({
        level: 5,
        toolProficiencies: ["Healer's Kit"],
        inventory: { equipped: ["Healer's Kit"], backpack: ["Healer's Kit"] },
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 2, save: 4, totalScore: 14, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      // Verify tool renders exactly once (dedup works)
      const healerKitElements = await screen.findAllByText(/Healer's Kit \(\+5\)/);
      expect(healerKitElements).toHaveLength(1);
    });

    it('applies exhaustion penalty to tool bonuses', async () => {
      const stats = createPlayerStats({
        level: 5,
        toolProficiencies: ["Healer's Kit"],
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 2, save: 4, totalScore: 14, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} exhaustionPenalty={2} />);
      // Tool bonus: wis(2) + prof(3) - exhaustion(2) = 3
      await screen.findByText("Healer's Kit (+3)");
    });

    it('handles tools with negative ability bonuses', async () => {
      const stats = createPlayerStats({
        level: 5,
        toolProficiencies: [],
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: -2, save: 0, totalScore: 6, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      // Not proficient: bonus = wisBonus(-2) = -2
      await screen.findByText(/Healer's Kit \(.*2\)/);
    });

    it('handles tools with negative total bonus after proficiency', async () => {
      const stats = createPlayerStats({
        level: 1,
        toolProficiencies: ["Healer's Kit"],
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
        abilities: [
          { name: 'Strength', bonus: -1, save: 0, totalScore: 8, skills: [] },
          { name: 'Dexterity', bonus: -2, save: -1, totalScore: 8, skills: [] },
          { name: 'Constitution', bonus: -3, save: -2, totalScore: 4, skills: [] },
          { name: 'Intelligence', bonus: -4, save: -2, totalScore: 2, skills: [] },
          { name: 'Wisdom', bonus: -5, save: -3, totalScore: 0, skills: [] },
          { name: 'Charisma', bonus: -1, save: 0, totalScore: 8, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      // Proficiency = Math.floor((1-1)/4 + 2) = 2, wis(-5) + prof(2) = -3
      await screen.findByText(/Healer's Kit \(.*3\)/);
    });

    it('groups tools under their respective ability sections', async () => {
      const stats = createPlayerStats({
        level: 5,
        toolProficiencies: ["Healer's Kit", "Thieves' Tools", 'Musical Instrument (Lute)'],
        inventory: { equipped: ["Healer's Kit", "Thieves' Tools", 'Musical Instrument (Lute)'], backpack: [] },
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 4, save: 6, totalScore: 18, skills: [] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 2, save: 4, totalScore: 14, skills: [] },
          { name: 'Charisma', bonus: 3, save: 5, totalScore: 16, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      // Proficiency = Math.floor((5-1)/4 + 2) = 3
      // Healer's Kit (Wis): wis(2) + prof(3) = 5
      // Thieves' Tools (Dex): dex(4) + prof(3) = 7
      // Musical Instrument (CHA): cha(3) + prof(3) = 6
      await screen.findByText("Healer's Kit (+5)");
      await screen.findByText("Thieves' Tools (+7)");
      await screen.findByText('Musical Instrument (Lute) (+6)');
    });

    it('shows no tool entries when inventory has no tools', async () => {
      const stats = createPlayerStats({
        level: 5,
        toolProficiencies: [],
        inventory: { equipped: [], backpack: [] },
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 2, save: 4, totalScore: 14, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      // Healer's Kit is in the equipment data but not in inventory, so it should not appear
      expect(screen.queryByText("Healer's Kit")).not.toBeInTheDocument();
    });

    it('handles missing toolProficiencies gracefully', async () => {
      const stats = createPlayerStats({
        level: 5,
        toolProficiencies: undefined,
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 2, save: 4, totalScore: 14, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      // Not proficient: bonus = wisBonus(2) = 2
      await screen.findByText("Healer's Kit (+2)");
    });

    it('handles missing inventory gracefully', async () => {
      const stats = createPlayerStats({
        level: 5,
        toolProficiencies: [],
        inventory: undefined,
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 2, save: 4, totalScore: 14, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      expect(screen.queryByText("Healer's Kit")).not.toBeInTheDocument();
    });

  });
});
