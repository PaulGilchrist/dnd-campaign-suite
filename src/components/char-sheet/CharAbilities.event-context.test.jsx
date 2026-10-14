import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharAbilities from './CharAbilities';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

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

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn(() => Promise.resolve([])),
}));

const mockStore = new Map();
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => mockStore),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn((key, prop) => mockStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn((key, prop) => mockStore.get(`${key}:${prop}`) ?? null),
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
      { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Athletics', bonus: 8 }] },
      { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [{ name: 'Acrobatics', bonus: 6 }] },
      { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
      { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [{ name: 'Arcana', bonus: 2 }] },
      { name: 'Wisdom', bonus: -1, save: 1, totalScore: 9, skills: [{ name: 'Perception', bonus: 3 }] },
      { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [{ name: 'Deception', bonus: 2 }, { name: 'Intimidation', bonus: 2 }, { name: 'Performance', bonus: 2 }, { name: 'Persuasion', bonus: 2 }] },
    ],
    skillProficiencies: ['Athletics', 'Arcana'],
    automation: { primalKnowledge: ['Athletics'], passives: [] },
    expertise: [],
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

function getMocks() {
  return vi.mocked(useLoggedDiceRoll).mock.results[0].value;
}

// ── Tests ──

describe('CharAbilities internal-skill-check event handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  describe('checkType === "check" (ability check)', () => {
    it('applies exhaustionPenalty to the ability check bonus from event', () => {
      render(<CharAbilities {...defaultProps} exhaustionPenalty={2} />);
      window.dispatchEvent(new CustomEvent('internal-skill-check', { detail: { skillName: 'Strength', checkType: 'check' } }));
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', 2, undefined);
    });

    it('applies wisCheckReplace context for Charisma when wisCheckReplace is set', () => {
      const stats = createPlayerStats({
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 3, save: 5, totalScore: 16, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ wisCheckReplace: true }} />);
      window.dispatchEvent(new CustomEvent('internal-skill-check', { detail: { skillName: 'Charisma', checkType: 'check' } }));
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith(
        'Charisma',
        expect.any(Number),
        expect.objectContaining({ wisCheckReplace: true, wisCheckMinBonus: 3 })
      );
    });
  });

  describe('checkType === "skill" (skill check)', () => {
    it('calls rollSkillCheck for a charisma skill', () => {
      render(<CharAbilities {...defaultProps} />);
      window.dispatchEvent(new CustomEvent('internal-skill-check', { detail: { skillName: 'Deception', checkType: 'skill' } }));
      expect(getMocks().rollSkillCheck).toHaveBeenCalledWith('Deception', expect.any(Number), undefined);
    });

    it('applies peerlessAthleteAdvantageSkills context from event', () => {
      const stats = createPlayerStats({
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Athletics', bonus: 8 }] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [{ name: 'Acrobatics', bonus: 6 }] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: -1, save: 1, totalScore: 9, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ peerlessAthleteAdvantageSkills: ['Athletics'] }} />);
      window.dispatchEvent(new CustomEvent('internal-skill-check', { detail: { skillName: 'Athletics', checkType: 'skill' } }));
      expect(getMocks().rollSkillCheck).toHaveBeenCalledWith(
        'Athletics',
        expect.any(Number),
        expect.objectContaining({ forcedMode: 'advantage' })
      );
    });

    it('does nothing when event skillName does not match any skill', () => {
      render(<CharAbilities {...defaultProps} />);
      window.dispatchEvent(new CustomEvent('internal-skill-check', { detail: { skillName: 'NonExistent', checkType: 'skill' } }));
      expect(getMocks().rollSkillCheck).not.toHaveBeenCalled();
    });
  });

  describe('unknown checkType', () => {
    it('does nothing when checkType is neither "check" nor "skill"', () => {
      render(<CharAbilities {...defaultProps} />);
      window.dispatchEvent(new CustomEvent('internal-skill-check', { detail: { skillName: 'Strength', checkType: 'invalid' } }));
      expect(getMocks().rollAbilityCheck).not.toHaveBeenCalled();
      expect(getMocks().rollSkillCheck).not.toHaveBeenCalled();
    });
  });
});

describe('CharAbilities wisCheckReplace for charisma skills display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('replaces charisma skill bonuses with wisdom-based calculation when wisCheckReplace is set', () => {
    const stats = createPlayerStats({
      level: 5,
      automation: { primalKnowledge: [], passives: [] },
      skillProficiencies: ['Deception'],
      expertise: [],
      abilities: [
        { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
        { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
        { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Wisdom', bonus: 3, save: 5, totalScore: 16, skills: [] },
        { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [{ name: 'Deception', bonus: 2 }] },
      ],
    });
    render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ wisCheckReplace: true }} />);
    expect(screen.getByText('Deception (+6)')).toBeInTheDocument();
  });

  it('does not replace non-charisma skill bonuses when wisCheckReplace is set', () => {
    const stats = createPlayerStats({
      level: 5,
      automation: { primalKnowledge: [], passives: [] },
      skillProficiencies: ['Athletics'],
      expertise: [],
      abilities: [
        { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Athletics', bonus: 8 }] },
        { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
        { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Wisdom', bonus: 3, save: 5, totalScore: 16, skills: [] },
        { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
      ],
    });
    render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ wisCheckReplace: true }} />);
    expect(screen.getByText('Athletics (+8)')).toBeInTheDocument();
  });

  it('handles wisCheckReplace with expertise for charisma skills', () => {
    const stats = createPlayerStats({
      level: 5,
      automation: { primalKnowledge: [], passives: [] },
      skillProficiencies: ['Persuasion'],
      expertise: ['Persuasion'],
      abilities: [
        { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
        { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
        { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Wisdom', bonus: 2, save: 4, totalScore: 14, skills: [] },
        { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [{ name: 'Persuasion', bonus: 2 }] },
      ],
    });
    render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ wisCheckReplace: true }} />);
    expect(screen.getByText('Persuasion (Expert) (+8)')).toBeInTheDocument();
  });
});
