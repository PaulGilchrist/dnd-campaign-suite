// @improved-by-ai
/**
 * CharAbilities — event-driven roll context lane.
 * Verifies that the `internal-skill-check` window event routes to the correct
 * roll function with the right bonus, and that makeCheckContext/makeSaveContext
 * stamp condition-effect context onto rolls (via events and via cell clicks for
 * effects unique to this lane).
 *
 * Covered by sibling lanes (do NOT re-add here):
 * - event-context: exhaustion on ability-check events, wisCheckReplace, peerless
 *   athlete skills, unknown checkType, unmatched skill names.
 * - clickHandlers: click → roll calls, d20Floor10/strokeOfLuck/autoReroll ctx,
 *   strCheckReplace, strCheckDisadvantage-on-STRENGTH (positive), save ctx matrix.
 * - reliableTalent: CLA-291 proficiency gate via clicks.
 * - conditionEffects / saveBonus / display-save / toolEntries / rendering: display.
 */
import { render, fireEvent } from '@testing-library/react';
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

function dispatchSkillCheck(detail) {
  window.dispatchEvent(new CustomEvent('internal-skill-check', { detail }));
}

function getMocks() {
  return vi.mocked(useLoggedDiceRoll).mock.results[0].value;
}

// Rows render as: 1=name 2=score 3=check bonus 4=save 5=skills.
// Scope by ability-name so tests don't depend on bonus values being unique.
function rowCell(container, abilityName, nth) {
  const row = Array.from(container.querySelectorAll('.abilities'))
    .find(r => r.querySelector('.left')?.textContent === abilityName);
  return row ? row.children[nth - 1] : null;
}

function findClickableByStartText(text) {
  return Array.from(document.querySelectorAll('.clickable'))
    .find(el => el.textContent.startsWith(text));
}

describe('CharAbilities internal-skill-check event routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('rolls a skill check with the computed skill bonus when the event names a skill', () => {
    render(<CharAbilities {...defaultProps} />);
    dispatchSkillCheck({ skillName: 'Athletics', checkType: 'skill' });
    // No condition effects → context is undefined
    expect(getMocks().rollSkillCheck).toHaveBeenCalledWith('Athletics', 8, undefined);
  });

  it('subtracts the exhaustion penalty from the skill bonus for skill-type events', () => {
    render(<CharAbilities {...defaultProps} exhaustionPenalty={2} />);
    dispatchSkillCheck({ skillName: 'Athletics', checkType: 'skill' });
    expect(getMocks().rollSkillCheck).toHaveBeenCalledWith('Athletics', 6, undefined);
  });

  it('applies makeCheckContext to skill checks triggered by events', () => {
    render(<CharAbilities {...defaultProps} conditionEffects={{ reliableTalent: true }} />);
    dispatchSkillCheck({ skillName: 'Athletics', checkType: 'skill' });
    expect(getMocks().rollSkillCheck).toHaveBeenCalledWith(
      'Athletics',
      8,
      expect.objectContaining({ reliableTalent: true })
    );
  });

  it('applies makeCheckContext to ability checks triggered by events', () => {
    render(<CharAbilities {...defaultProps} conditionEffects={{ d20Floor10: true }} />);
    dispatchSkillCheck({ skillName: 'Strength', checkType: 'check' });
    expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith(
      'Strength',
      4,
      expect.objectContaining({ d20Floor10: true })
    );
  });

  it('does nothing when the event detail has no skillName', () => {
    render(<CharAbilities {...defaultProps} />);
    dispatchSkillCheck({});
    expect(getMocks().rollAbilityCheck).not.toHaveBeenCalled();
    expect(getMocks().rollSkillCheck).not.toHaveBeenCalled();
  });

  it('does nothing when the event carries no detail at all', () => {
    render(<CharAbilities {...defaultProps} />);
    window.dispatchEvent(new CustomEvent('internal-skill-check'));
    expect(getMocks().rollAbilityCheck).not.toHaveBeenCalled();
    expect(getMocks().rollSkillCheck).not.toHaveBeenCalled();
  });

  it('does nothing when checkType "check" names a skill instead of an ability', () => {
    render(<CharAbilities {...defaultProps} />);
    dispatchSkillCheck({ skillName: 'Athletics', checkType: 'check' });
    expect(getMocks().rollAbilityCheck).not.toHaveBeenCalled();
    expect(getMocks().rollSkillCheck).not.toHaveBeenCalled();
  });

  it('ignores the event after the component unmounts', () => {
    const { unmount } = render(<CharAbilities {...defaultProps} />);
    unmount();
    dispatchSkillCheck({ skillName: 'Strength', checkType: 'check' });
    expect(getMocks().rollAbilityCheck).not.toHaveBeenCalled();
  });
});

describe('CharAbilities STR forced-mode rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('grants Powerful Build advantage on STR ability checks clicked directly', () => {
    const { container } = render(
      <CharAbilities {...defaultProps} conditionEffects={{ strCheckAdvantage: true }} />
    );
    const strCheckCell = rowCell(container, 'Strength', 3);
    expect(strCheckCell).toBeTruthy();
    fireEvent.click(strCheckCell);
    expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith(
      'Strength',
      4,
      expect.objectContaining({ forcedMode: 'advantage' })
    );
  });

  it('grants Powerful Build advantage on Athletics skill clicks', () => {
    render(<CharAbilities {...defaultProps} conditionEffects={{ strCheckAdvantage: true }} />);
    const athleticsCell = findClickableByStartText('Athletics');
    expect(athleticsCell).toBeTruthy();
    fireEvent.click(athleticsCell);
    expect(getMocks().rollSkillCheck).toHaveBeenCalledWith(
      'Athletics',
      8,
      expect.objectContaining({ forcedMode: 'advantage' })
    );
  });

  it('does not apply STR disadvantage to non-STR ability checks', () => {
    render(<CharAbilities {...defaultProps} conditionEffects={{ strCheckDisadvantage: true }} />);
    dispatchSkillCheck({ skillName: 'Dexterity', checkType: 'check' });
    const dexCall = getMocks().rollAbilityCheck.mock.calls.find(args => args[0] === 'Dexterity');
    expect(dexCall).toBeTruthy();
    expect(dexCall[1]).toBe(2);
    expect(dexCall[2] ?? {}).not.toHaveProperty('forcedMode');
  });
});

describe('CharAbilities makeSaveContext strSaveReplace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('passes strSaveReplace context with strScore when the flag is set', () => {
    const stats = createPlayerStats({
      abilities: [
        { name: 'Strength', bonus: 2, save: 4, totalScore: 14, skills: [] },
        { name: 'Dexterity', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Constitution', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Wisdom', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Charisma', bonus: 0, save: 0, totalScore: 10, skills: [] },
      ],
    });
    const { container } = render(
      <CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ strSaveReplace: true }} />
    );
    const strSaveCell = rowCell(container, 'Strength', 4);
    expect(strSaveCell).toBeTruthy();
    fireEvent.click(strSaveCell);
    expect(getMocks().rollSavingThrow).toHaveBeenCalledWith(
      'Strength',
      4,
      expect.objectContaining({ strSaveReplace: true, strScore: 14 })
    );
  });

  it('omits strSaveReplace context when the flag is not set', () => {
    const { container } = render(<CharAbilities {...defaultProps} />);
    fireEvent.click(rowCell(container, 'Strength', 4));
    expect(getMocks().rollSavingThrow).toHaveBeenCalledWith(
      'Strength',
      6,
      expect.not.objectContaining({ strSaveReplace: expect.anything(), strScore: expect.anything() })
    );
  });
});
