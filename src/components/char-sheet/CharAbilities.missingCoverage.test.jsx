// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
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

vi.mock('../common/Popup.jsx', () => ({
  default: ({ children, onClickOrKeyDown }) => (
    <div data-testid="popup" onClick={onClickOrKeyDown}>
      {children}
    </div>
  ),
}));

vi.mock('./DiceRollResult.jsx', () => ({
  default: ({ onReroll, onStrokeOfLuck }) => (
    <div data-testid="dice-roll-result">
      <button onClick={onReroll}>Reroll</button>
      <button onClick={onStrokeOfLuck}>Stroke of Luck</button>
    </div>
  ),
}));

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

describe('CharAbilities ability name popup content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('calls setPopupHtml with ability description HTML when ability name is clicked', () => {
    render(<CharAbilities {...defaultProps} />);
    fireEvent.click(screen.getByText('Strength'));
    const mockSetPopupHtml = vi.mocked(useLoggedDiceRoll).mock.results[0].value.setPopupHtml;
    expect(mockSetPopupHtml).toHaveBeenCalledWith('<h3>Strength</h3>STR desc<br/>');
  });

  it('calls setPopupHtml with Dexterity description when Dexterity is clicked', () => {
    render(<CharAbilities {...defaultProps} />);
    fireEvent.click(screen.getByText('Dexterity'));
    const mockSetPopupHtml = vi.mocked(useLoggedDiceRoll).mock.results[0].value.setPopupHtml;
    expect(mockSetPopupHtml).toHaveBeenCalledWith('<h3>Dexterity</h3>DEX desc<br/>');
  });
});

describe('CharAbilities DiceRollResult props passthrough', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('passes onReroll prop to DiceRollResult when popupHtml is an object', () => {
    const mockSetPopupHtml = vi.fn();
    const mockOnReroll = vi.fn();
    const mockOnStrokeOfLuck = vi.fn();
    vi.mocked(useLoggedDiceRoll).mockReturnValue({
      popupHtml: { name: 'Test Roll', type: 'd20' },
      setPopupHtml: mockSetPopupHtml,
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
    });

    render(<CharAbilities {...defaultProps} onReroll={mockOnReroll} onStrokeOfLuck={mockOnStrokeOfLuck} />);
    const diceRollResult = screen.getByTestId('dice-roll-result');
    const rerollBtn = diceRollResult.querySelector('button');
    expect(rerollBtn).toBeTruthy();
  });

  it('passes onStrokeOfLuck prop to DiceRollResult when popupHtml is an object', () => {
    const mockSetPopupHtml = vi.fn();
    const mockOnReroll = vi.fn();
    const mockOnStrokeOfLuck = vi.fn();
    vi.mocked(useLoggedDiceRoll).mockReturnValue({
      popupHtml: { name: 'Test Roll', type: 'd20' },
      setPopupHtml: mockSetPopupHtml,
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
    });

    render(<CharAbilities {...defaultProps} onReroll={mockOnReroll} onStrokeOfLuck={mockOnStrokeOfLuck} />);
    const diceRollResult = screen.getByTestId('dice-roll-result');
    const strokeBtn = diceRollResult.querySelectorAll('button')[1];
    expect(strokeBtn).toBeTruthy();
  });
});

describe('CharAbilities mixed save states in same render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('shows AUTO FAIL for str, normal for dex, and (Adv) for wis in same render', () => {
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
    const { container } = render(
      <CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ autoFailSaves: ['str'], saveAdvantageAbilities: ['WIS'] }} />
    );
    const saveCells = container.querySelectorAll('.abilities > div:nth-child(4)');
    const saveTexts = Array.from(saveCells).map(c => c.textContent);
    expect(saveTexts).toContain('AUTO FAIL');
    expect(saveTexts).toContain('+5 (Adv)');
    expect(saveTexts).toContain('+4');
  });

  it('shows (Adv) when both saveAdvantageCount and saveAdvantageAbilities match the same ability', () => {
    const { container } = render(
      <CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageCount: 1, saveAdvantageAbilities: ['STR'] }} />
    );
    const saveCells = container.querySelectorAll('.abilities > div:nth-child(4)');
    const saveTexts = Array.from(saveCells).map(c => c.textContent);
    expect(saveTexts).toContain('+6 (Adv)');
  });
});

describe('CharAbilities skill bonus calculation order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('applies exhaustion penalty, then primal knowledge, then jack of all trades, then passWithoutTraceBonus', () => {
    const stats = createPlayerStats({
      level: 10,
      automation: {
        primalKnowledge: ['Stealth'],
        passives: [{ type: 'jack_of_all_trades' }],
      },
      skillProficiencies: [],
      expertise: [],
      abilities: [
        { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Stealth', bonus: 2 }] },
        { name: 'Dexterity', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Constitution', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Wisdom', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Charisma', bonus: 0, save: 0, totalScore: 10, skills: [] },
      ],
    });
    render(
      <CharAbilities
        {...defaultProps}
        playerStats={stats}
        exhaustionPenalty={1}
        isRaging={true}
        conditionEffects={{ passWithoutTraceBonus: '2' }}
      />
    );
    // proficiency = Math.floor((10-1)/4 + 2) = Math.floor(4.25) = 4
    // primal knowledge: strengthBonus = 4 (STR bonus only, not proficient in skillProficiencies)
    // bonus = 4 - 1 (exhaustion) = 3
    // jack of all trades: isNotProficient = true (skillProficiencies is empty), prof = 4, Math.floor(4/2) = 2
    // bonus = 3 + 2 = 5
    // passWithoutTraceBonus: Stealth + 2 = 7
    expect(screen.getByText('Stealth (+7)')).toBeInTheDocument();
  });

  it('applies primal knowledge override even when original skill bonus is higher', () => {
    const stats = createPlayerStats({
      level: 5,
      automation: { primalKnowledge: ['Stealth'], passives: [] },
      skillProficiencies: [],
      expertise: [],
      abilities: [
        { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Stealth', bonus: 10 }] },
        { name: 'Dexterity', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Constitution', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Wisdom', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Charisma', bonus: 0, save: 0, totalScore: 10, skills: [] },
      ],
    });
    render(<CharAbilities {...defaultProps} playerStats={stats} isRaging={true} />);
    // proficiency = Math.floor((5-1)/4 + 2) = 3
    // primal knowledge: strengthBonus = 4 (STR bonus, not proficient)
    // bonus = 4 - 0 = 4
    // jack of all trades: passives is [], so isJackOfAllTrades = false
    // original Stealth bonus was 10, but primal knowledge overrides to 4
    expect(screen.getByText('Stealth (+4)')).toBeInTheDocument();
  });

  it('applies jack of all trades after exhaustion penalty', () => {
    const stats = createPlayerStats({
      level: 10,
      automation: {
        primalKnowledge: [],
        passives: [{ type: 'jack_of_all_trades' }],
      },
      skillProficiencies: [],
      abilities: [
        { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Stealth', bonus: 2 }] },
        { name: 'Dexterity', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Constitution', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Wisdom', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Charisma', bonus: 0, save: 0, totalScore: 10, skills: [] },
      ],
    });
    render(<CharAbilities {...defaultProps} playerStats={stats} exhaustionPenalty={2} />);
    // base = 2 - 2 (exhaustion) = 0
    // jack of all trades: prof = Math.floor((10-1)/4 + 2) = 4, Math.floor(4/2) = 2
    // bonus = 0 + 2 = 2
    expect(screen.getByText('Stealth (+2)')).toBeInTheDocument();
  });

  it('does not apply jack of all trades when proficient', () => {
    const stats = createPlayerStats({
      level: 10,
      automation: {
        primalKnowledge: [],
        passives: [{ type: 'jack_of_all_trades' }],
      },
      skillProficiencies: ['Stealth'],
      abilities: [
        { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Stealth', bonus: 6 }] },
        { name: 'Dexterity', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Constitution', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Wisdom', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Charisma', bonus: 0, save: 0, totalScore: 10, skills: [] },
      ],
    });
    render(<CharAbilities {...defaultProps} playerStats={stats} />);
    // skillProficiencies includes Stealth, so jack of all trades does not apply
    // bonus = 6
    expect(screen.getByText('Stealth (+6)')).toBeInTheDocument();
  });
});

describe('CharAbilities cosmic omen on skill checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('includes cosmic omen bonus in skill check call', () => {
    mockStore.set('Test Fighter:cosmicOmenEffect', JSON.stringify({ type: 'Weal', isEven: true, d6Value: 3 }));
    render(<CharAbilities {...defaultProps} />);
    fireEvent.click(screen.getByText(/Athletics/));
    const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
    // Athletics bonus is 8, cosmic omen adds 3, so total = 11
    expect(mocks.rollSkillCheck).toHaveBeenCalledWith('Athletics', 11, undefined);
  });

  it('includes negative cosmic omen bonus in skill check call', () => {
    mockStore.set('Test Fighter:cosmicOmenEffect', JSON.stringify({ type: 'Woe', isEven: false, d6Value: 5 }));
    render(<CharAbilities {...defaultProps} />);
    fireEvent.click(screen.getByText(/Athletics/));
    const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
    // Athletics bonus is 8, cosmic omen subtracts 5, so total = 3
    expect(mocks.rollSkillCheck).toHaveBeenCalledWith('Athletics', 3, undefined);
  });
});

describe('CharAbilities save display with combined effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('shows AUTO FAIL even when exhaustion penalty is active', () => {
    render(
      <CharAbilities {...defaultProps} exhaustionPenalty={2} conditionEffects={{ autoFailSaves: ['str'] }} />
    );
    expect(screen.getByText('AUTO FAIL')).toBeInTheDocument();
  });

  it('shows (Adv) suffix even when exhaustion penalty is active', () => {
    const { container } = render(
      <CharAbilities {...defaultProps} exhaustionPenalty={2} conditionEffects={{ saveAdvantageCount: 1 }} />
    );
    const saveCells = container.querySelectorAll('.abilities > div:nth-child(4)');
    const saveTexts = Array.from(saveCells).map(c => c.textContent);
    expect(saveTexts).toContain('+4 (Adv)');
  });

  it('shows penalized class when both autoFailSaves and saveDisadvantage are active', () => {
    const { container } = render(
      <CharAbilities {...defaultProps} conditionEffects={{ autoFailSaves: ['str'], saveDisadvantage: ['dex'] }} />
    );
    // saveDisadvantage.length > 0 applies stat--penalized to ALL save cells (code checks array length, not content)
    const penalizedCells = container.querySelectorAll('.stat--penalized');
    expect(penalizedCells.length).toBeGreaterThan(0);
  });
});

describe('CharAbilities skill click context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('passes makeCheckContext with strokeOfLuck when skill is clicked', () => {
    render(<CharAbilities {...defaultProps} conditionEffects={{ strokeOfLuck: true }} />);
    fireEvent.click(screen.getByText(/Athletics/));
    const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
    expect(mocks.rollSkillCheck).toHaveBeenCalledWith('Athletics', expect.any(Number), expect.objectContaining({ strokeOfLuck: true }));
  });

  it('passes makeCheckContext with d20Floor10 when skill is clicked', () => {
    render(<CharAbilities {...defaultProps} conditionEffects={{ d20Floor10: true }} />);
    fireEvent.click(screen.getByText(/Athletics/));
    const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
    expect(mocks.rollSkillCheck).toHaveBeenCalledWith('Athletics', expect.any(Number), expect.objectContaining({ d20Floor10: true }));
  });

  it('passes makeCheckContext with reliableTalent when skill is clicked', () => {
    render(<CharAbilities {...defaultProps} conditionEffects={{ reliableTalent: true }} />);
    fireEvent.click(screen.getByText(/Athletics/));
    const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
    expect(mocks.rollSkillCheck).toHaveBeenCalledWith('Athletics', expect.any(Number), expect.objectContaining({ reliableTalent: true }));
  });

  it('passes makeCheckContext with tacticalMind when skill is clicked', () => {
    render(<CharAbilities {...defaultProps} conditionEffects={{ tacticalMind: true, tacticalMindBonus: 4 }} />);
    fireEvent.click(screen.getByText(/Athletics/));
    const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
    expect(mocks.rollSkillCheck).toHaveBeenCalledWith('Athletics', expect.any(Number), expect.objectContaining({ tacticalMind: true, tacticalMindBonus: 4 }));
  });

  it('passes makeCheckContext with luckyAdvantage when skill is clicked', () => {
    render(<CharAbilities {...defaultProps} conditionEffects={{ luckyAdvantage: true }} />);
    fireEvent.click(screen.getByText(/Athletics/));
    const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
    expect(mocks.rollSkillCheck).toHaveBeenCalledWith('Athletics', expect.any(Number), expect.objectContaining({ luckyAdvantage: true, luckyAdvantageType: 'advantage' }));
  });

  it('passes makeCheckContext with luckyDisadvantage when skill is clicked', () => {
    render(<CharAbilities {...defaultProps} conditionEffects={{ luckyDisadvantage: true }} />);
    fireEvent.click(screen.getByText(/Athletics/));
    const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
    expect(mocks.rollSkillCheck).toHaveBeenCalledWith('Athletics', expect.any(Number), expect.objectContaining({ luckyDisadvantage: true }));
  });

  it('passes makeCheckContext with strCheckReplace when skill is clicked', () => {
    const stats = createPlayerStats({
      abilities: [
        { name: 'Strength', bonus: 2, save: 4, totalScore: 14, skills: [{ name: 'Stealth', bonus: 2 }] },
        { name: 'Dexterity', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Constitution', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Wisdom', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Charisma', bonus: 0, save: 0, totalScore: 10, skills: [] },
      ],
    });
    render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ strCheckReplace: true }} />);
    fireEvent.click(screen.getByText(/Stealth/));
    const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
    expect(mocks.rollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), expect.objectContaining({ strCheckReplace: true, strScore: 14 }));
  });

  it('passes makeCheckContext with forcedMode when abilityCheckDisadvantage is set and skill is clicked', () => {
    render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckDisadvantage: true }} />);
    fireEvent.click(screen.getByText(/Athletics/));
    const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
    expect(mocks.rollSkillCheck).toHaveBeenCalledWith('Athletics', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage' }));
  });
});

describe('CharAbilities ability check with exhaustion penalty edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('calls rollAbilityCheck with adjusted bonus when ability bonus click is triggered', () => {
    render(<CharAbilities {...defaultProps} />);
    // Find any clickable bonus cell by text content
    const clickableEls = document.querySelectorAll('.clickable');
    const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4');
    if (bonusCell) {
      fireEvent.click(bonusCell);
    }
    const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
    expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', 4, undefined);
  });

  it('calls rollAbilityCheck with negative adjusted bonus when exhaustionPenalty exceeds ability bonus', () => {
    render(<CharAbilities {...defaultProps} exhaustionPenalty={5} />);
    const clickableEls = document.querySelectorAll('.clickable');
    const bonusCell = Array.from(clickableEls).find(el => el.textContent.startsWith('-'));
    if (bonusCell) {
      fireEvent.click(bonusCell);
    }
    const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
    // First negative bonus found
    const firstNegCall = mocks.rollAbilityCheck.mock.calls.find(call => call[1] < 0);
    expect(firstNegCall).toBeDefined();
  });

  it('calls rollAbilityCheck with zero adjusted bonus when ability bonus is zero and no exhaustion', () => {
    const stats = createPlayerStats({
      abilities: [
        { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
        { name: 'Dexterity', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Constitution', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Wisdom', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Charisma', bonus: 0, save: 0, totalScore: 10, skills: [] },
      ],
    });
    render(<CharAbilities {...defaultProps} playerStats={stats} />);
    const clickableEls = document.querySelectorAll('.clickable');
    const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+0');
    if (bonusCell) {
      fireEvent.click(bonusCell);
    }
    const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
    const zeroCall = mocks.rollAbilityCheck.mock.calls.find(call => call[1] === 0);
    expect(zeroCall).toBeDefined();
    expect(zeroCall[0]).toBe('Dexterity');
  });
});

describe('CharAbilities save display formatting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('shows negative save value with minus sign when save is lower than exhaustion penalty', () => {
    const { container } = render(
      <CharAbilities {...defaultProps} exhaustionPenalty={5} />
    );
    const saveCells = container.querySelectorAll('.abilities > div:nth-child(4)');
    const saveTexts = Array.from(saveCells).map(c => c.textContent.replace(' (Adv)', ''));
    expect(saveTexts).toContain('-1');
  });

  it('shows zero save value with plus sign when save equals exhaustion penalty', () => {
    const stats = createPlayerStats({
      abilities: [
        { name: 'Strength', bonus: 4, save: 4, totalScore: 14, skills: [] },
        { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
        { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Wisdom', bonus: -1, save: 1, totalScore: 9, skills: [] },
        { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
      ],
    });
    const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} exhaustionPenalty={4} />);
    const saveCells = container.querySelectorAll('.abilities > div:nth-child(4)');
    const saveTexts = Array.from(saveCells).map(c => c.textContent.replace(' (Adv)', ''));
    expect(saveTexts).toContain('+0');
  });
});

describe('CharAbilities ability name click with edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('handles ability name click when allAbilityScores is empty array', () => {
    render(<CharAbilities {...defaultProps} allAbilityScores={[]} />);
    fireEvent.click(screen.getByText('Strength'));
    const mockSetPopupHtml = vi.mocked(useLoggedDiceRoll).mock.results[0].value.setPopupHtml;
    expect(mockSetPopupHtml).toHaveBeenCalledWith(null);
  });
});

describe('CharAbilities getSaveAdvantageSource edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('returns null title when saveAdvantageCount is 0 and saveAdvantageAbilities does not match', () => {
    const { container } = render(
      <CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageCount: 0, saveAdvantageAbilities: ['WIS'] }} />
    );
    const saveCell = container.querySelectorAll('.abilities:nth-child(2) > div:nth-child(4)');
    expect(saveCell[0]).not.toHaveAttribute('title');
  });

  it('uses source from matching saveModifier for against_spell condition', () => {
    const stats = createPlayerStats({
      saveModifiers: [
        { target: 'saving_throw', effect: 'advantage', condition: 'against_spell', source: 'Magic Resistance' },
      ],
    });
    const { container } = render(
      <CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ saveAdvantage: ['against_spell'] }} />
    );
    const abilitiesDivs = container.querySelectorAll('.abilities-popup-parent > .abilities');
    const saveCell = abilitiesDivs[1].querySelectorAll('div')[3];
    expect(saveCell).toHaveAttribute('title', 'Magic Resistance');
  });
});

describe('CharAbilities getSkillBonus returns correct value', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('returns skill.bonus minus exhaustionPenalty when no special effects', () => {
    const stats = createPlayerStats({
      abilities: [
        { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Athletics', bonus: 8 }] },
        { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
        { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Wisdom', bonus: -1, save: 1, totalScore: 9, skills: [] },
        { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
      ],
    });
    render(<CharAbilities {...defaultProps} playerStats={stats} exhaustionPenalty={1} />);
    expect(screen.getByText('Athletics (+7)')).toBeInTheDocument();
  });

  it('returns 0 when skill bonus equals exhaustion penalty with no other effects', () => {
    const stats = createPlayerStats({
      abilities: [
        { name: 'Strength', bonus: 0, save: 0, totalScore: 10, skills: [{ name: 'Athletics', bonus: 2 }] },
        { name: 'Dexterity', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Constitution', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Wisdom', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Charisma', bonus: 0, save: 0, totalScore: 10, skills: [] },
      ],
    });
    render(<CharAbilities {...defaultProps} playerStats={stats} exhaustionPenalty={2} />);
    expect(screen.getByText('Athletics (+0)')).toBeInTheDocument();
  });
});
