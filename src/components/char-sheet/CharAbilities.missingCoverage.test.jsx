import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharAbilities from './CharAbilities';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const mockFn = vi.fn(() => ({
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
  }));
  return { default: mockFn };
});

const mockStore = new Map();
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
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
      { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
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

describe('CharAbilities cosmic omen on skill checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('includes cosmic omen bonus in skill check call', () => {
    mockStore.set('Test Fighter:cosmicOmenEffect', JSON.stringify({ type: 'Weal', isEven: true, d6Value: 3 }));
    render(<CharAbilities {...defaultProps} />);
    fireEvent.click(screen.getByText(/Athletics/));
    // Athletics bonus is 8, cosmic omen adds 3, so total = 11
    expect(getMocks().rollSkillCheck).toHaveBeenCalledWith('Athletics', 11, undefined);
  });

  it('includes negative cosmic omen bonus in skill check call', () => {
    mockStore.set('Test Fighter:cosmicOmenEffect', JSON.stringify({ type: 'Woe', isEven: false, d6Value: 5 }));
    render(<CharAbilities {...defaultProps} />);
    fireEvent.click(screen.getByText(/Athletics/));
    // Athletics bonus is 8, cosmic omen subtracts 5, so total = 3
    expect(getMocks().rollSkillCheck).toHaveBeenCalledWith('Athletics', 3, undefined);
  });
});

describe('CharAbilities cosmic omen on ability checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('includes cosmic omen bonus in ability check call when ability bonus is clicked', () => {
    mockStore.set('Test Fighter:cosmicOmenEffect', JSON.stringify({ type: 'Weal', isEven: true, d6Value: 3 }));
    render(<CharAbilities {...defaultProps} />);
    const bonusCell = Array.from(document.querySelectorAll('.clickable')).find(el => el.textContent === '+7');
    if (bonusCell) {
      fireEvent.click(bonusCell);
    }
    // Strength bonus is 4, cosmic omen adds 3, so total = 7
    expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', 7, undefined);
  });

  it('includes cosmic omen bonus in save call when save value is clicked', () => {
    mockStore.set('Test Fighter:cosmicOmenEffect', JSON.stringify({ type: 'Weal', isEven: true, d6Value: 3 }));
    render(<CharAbilities {...defaultProps} />);
    const saveCell = Array.from(document.querySelectorAll('.clickable')).find(el => el.textContent === '+9');
    if (saveCell) {
      fireEvent.click(saveCell);
    }
    // Strength save is 6, cosmic omen adds 3, so total = 9
    expect(getMocks().rollSavingThrow).toHaveBeenCalledWith('Strength', 9, expect.objectContaining({ autoFail: undefined, forcedMode: undefined }));
  });
});

describe('CharAbilities internal event handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('responds to internal-skill-check event with check type and rolls ability check', () => {
    render(<CharAbilities {...defaultProps} />);
    window.dispatchEvent(new CustomEvent('internal-skill-check', { detail: { skillName: 'Strength', checkType: 'check' } }));
    expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', 4, undefined);
  });

  it('responds to internal-skill-check event with check type and rolls skill check with cosmic omen', () => {
    mockStore.set('Test Fighter:cosmicOmenEffect', JSON.stringify({ type: 'Weal', isEven: true, d6Value: 3 }));
    render(<CharAbilities {...defaultProps} />);
    window.dispatchEvent(new CustomEvent('internal-skill-check', { detail: { skillName: 'Athletics', checkType: 'skill' } }));
    // Athletics base bonus 8 + cosmic omen 3 = 11
    expect(getMocks().rollSkillCheck).toHaveBeenCalledWith('Athletics', 11, undefined);
  });
});

describe('CharAbilities psiBolsteredKnack context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('passes psiBolsteredKnack context when player is Soulknife rogue level 3+', () => {
    const stats = createPlayerStats({
      class: { name: 'Rogue', major: { name: 'Soulknife' }, class_levels: [{ level: 5, energy: { energy_die_type: 8 } }] },
      level: 5,
      abilities: [
        { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
        { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
        { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Wisdom', bonus: -1, save: 1, totalScore: 9, skills: [] },
        { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
      ],
    });
    render(<CharAbilities {...defaultProps} playerStats={stats} />);
    const bonusCell = Array.from(document.querySelectorAll('.clickable')).find(el => el.textContent === '+4');
    if (bonusCell) {
      fireEvent.click(bonusCell);
    }
    expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ psiBolsteredKnack: true, psiBolsteredKnackDieSize: 8 }));
  });

  it('does not pass psiBolsteredKnack when player is not Soulknife', () => {
    const stats = createPlayerStats({
      class: { name: 'Rogue', major: { name: 'Assassin' } },
      abilities: [
        { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
        { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
        { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Wisdom', bonus: -1, save: 1, totalScore: 9, skills: [] },
        { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
      ],
    });
    render(<CharAbilities {...defaultProps} playerStats={stats} />);
    const bonusCell = Array.from(document.querySelectorAll('.clickable')).find(el => el.textContent === '+4');
    if (bonusCell) {
      fireEvent.click(bonusCell);
    }
    expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), undefined);
  });

  it('does not pass psiBolsteredKnack when Soulknife but level below 3', () => {
    const stats = createPlayerStats({
      class: { name: 'Rogue', major: { name: 'Soulknife' } },
      level: 2,
      class_levels: [{ level: 2, energy: { energy_die_type: 6 } }],
      abilities: [
        { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
        { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
        { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Wisdom', bonus: -1, save: 1, totalScore: 9, skills: [] },
        { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
      ],
    });
    render(<CharAbilities {...defaultProps} playerStats={stats} />);
    const bonusCell = Array.from(document.querySelectorAll('.clickable')).find(el => el.textContent === '+4');
    if (bonusCell) {
      fireEvent.click(bonusCell);
    }
    expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), undefined);
  });
});
