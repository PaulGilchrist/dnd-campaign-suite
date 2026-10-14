// @maintained-by-ai
/**
 * CharAbilities — event-context roll lane (`internal-skill-check` window event).
 * Verifies the event handler's routing contract and the bonus/context it derives
 * from CURRENT props (exhaustion penalty, wisCheckReplace, peerless athlete),
 * plus the wisCheckReplace charisma-skill DISPLAY this lane uniquely owns.
 *
 * Notes on the handler's contract (CharAbilities.jsx):
 * - `checkType === 'check'` resolves skillName against ABILITIES and sends the
 *   raw ability bonus (wisCheckReplace affects only the ctx: the roller applies
 *   `wisCheckMinBonus` downstream — that stamping is what these tests pin).
 * - every OTHER checkType (including unknown ones) falls through to SKILL lookup.
 * - this lane OWNS ability-check exhaustion and wisCheckReplace ctx/display.
 *
 * Covered by sibling lanes (do NOT re-add here):
 * - contextFeatures: baseline event routing (skill + ability), exhaustion on skill
 *   events, reliableTalent/d20Floor10 ctx on events, empty/missing detail,
 *   ability-vs-skill name mismatches, unmount teardown, STR forced-mode clicks,
 *   strSaveReplace saves.
 * - clickHandlers: click → roll calls, wisCheckReplace click ctx, save ctx matrix.
 * - conditionEffects / rendering / saveBonus / toolEntries / missingCoverage: display.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharAbilities from './CharAbilities';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

// Stable mock object: every render must hand the component the SAME roll fns,
// otherwise async re-renders (loadEquipment) re-register the event listener
// against fresh mocks and captured mocks go stale.
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const rollMocks = {
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
  };
  return { default: vi.fn(() => rollMocks) };
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

// Per-test fixture factory. `abilityOverrides` patches single abilities by name
// so tests don't re-list all six to tweak one modifier.
function createPlayerStats(overrides = {}) {
  const { abilityOverrides, ...rest } = overrides;
  const stats = {
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
    ...rest,
  };
  if (abilityOverrides) {
    stats.abilities = stats.abilities.map(a => (abilityOverrides[a.name] ? { ...a, ...abilityOverrides[a.name] } : a));
  }
  return stats;
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

function getRollMocks() {
  const results = vi.mocked(useLoggedDiceRoll).mock.results;
  // Clear failure if a test forgot to render before dispatching.
  expect(results.length).toBeGreaterThan(0);
  return results[results.length - 1].value;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStore.clear();
});

describe('CharAbilities internal-skill-check → ability checks (checkType "check")', () => {
  it('subtracts the exhaustion penalty from current props on fresh mount and after a re-render', () => {
    const { rerender } = render(<CharAbilities {...defaultProps} exhaustionPenalty={2} />);
    dispatchSkillCheck({ skillName: 'Strength', checkType: 'check' });
    const { rollAbilityCheck } = getRollMocks();
    expect(rollAbilityCheck).toHaveBeenCalledWith('Strength', 2, undefined);

    rerender(<CharAbilities {...defaultProps} exhaustionPenalty={1} />);
    dispatchSkillCheck({ skillName: 'Strength', checkType: 'check' });
    // 4 − 1: different value per mount proves recompute — a stale closure would
    // still roll the previous penalty (or the unpenalized 4).
    expect(rollAbilityCheck).toHaveBeenLastCalledWith('Strength', 3, undefined);
  });

  it('stamps wisCheckReplace context with the Wisdom-derived minimum on Charisma checks', () => {
    const stats = createPlayerStats({ abilityOverrides: { Wisdom: { bonus: 3 } } });
    render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ wisCheckReplace: true }} />);
    dispatchSkillCheck({ skillName: 'Charisma', checkType: 'check' });
    // Event lane deliberately sends the RAW Charisma bonus (0); the roller applies
    // the wisdom floor from ctx.wisCheckMinBonus.
    expect(getRollMocks().rollAbilityCheck).toHaveBeenCalledWith(
      'Charisma',
      0,
      { wisCheckReplace: true, wisCheckMinBonus: 3 }
    );
  });

  it('floors wisCheckMinBonus at 1 when the Wisdom modifier is negative', () => {
    render(<CharAbilities {...defaultProps} conditionEffects={{ wisCheckReplace: true }} />);
    dispatchSkillCheck({ skillName: 'Charisma', checkType: 'check' });
    // Base fixture Wisdom is -1 → max(1, -1) = 1.
    expect(getRollMocks().rollAbilityCheck).toHaveBeenCalledWith(
      'Charisma',
      0,
      { wisCheckReplace: true, wisCheckMinBonus: 1 }
    );
  });
});

describe('CharAbilities internal-skill-check → skill checks', () => {
  it('forces advantage only for skills listed in peerlessAthleteAdvantageSkills', () => {
    render(
      <CharAbilities {...defaultProps} conditionEffects={{ peerlessAthleteAdvantageSkills: ['Athletics'] }} />
    );
    dispatchSkillCheck({ skillName: 'Athletics', checkType: 'skill' });
    const { rollSkillCheck } = getRollMocks();
    expect(rollSkillCheck).toHaveBeenCalledWith('Athletics', 8, { forcedMode: 'advantage' });
    // Unlisted skill rolls unforced with no context.
    dispatchSkillCheck({ skillName: 'Acrobatics', checkType: 'skill' });
    expect(rollSkillCheck).toHaveBeenLastCalledWith('Acrobatics', 6, undefined);
  });

  it('routes unrecognized checkTypes through the skill lookup (only "check" means ability)', () => {
    render(<CharAbilities {...defaultProps} />);
    dispatchSkillCheck({ skillName: 'Arcana', checkType: 'save' });
    expect(getRollMocks().rollSkillCheck).toHaveBeenCalledWith('Arcana', 2, undefined);
    expect(getRollMocks().rollAbilityCheck).not.toHaveBeenCalled();
  });

  it('does nothing when the event names neither a skill nor an ability', () => {
    render(<CharAbilities {...defaultProps} />);
    dispatchSkillCheck({ skillName: 'NonExistent', checkType: 'skill' });
    expect(getRollMocks().rollSkillCheck).not.toHaveBeenCalled();
    expect(getRollMocks().rollAbilityCheck).not.toHaveBeenCalled();

    // An ability name is not a skill name — the skill lookup must not match it.
    dispatchSkillCheck({ skillName: 'Strength', checkType: 'invalid' });
    expect(getRollMocks().rollSkillCheck).not.toHaveBeenCalled();
    expect(getRollMocks().rollAbilityCheck).not.toHaveBeenCalled();
  });
});

describe('CharAbilities wisCheckReplace charisma display', () => {
  it('replaces a proficient charisma skill bonus with max(1, WIS) + proficiency, leaving other skills untouched', () => {
    const stats = createPlayerStats({
      abilityOverrides: { Wisdom: { bonus: 3 } },
      skillProficiencies: ['Deception'],
    });
    render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ wisCheckReplace: true }} />);
    // 3 (wis) + 3 (proficiency at level 5) = +6, vs the raw +2 without the flag.
    expect(screen.getByText('Deception (+6)')).toBeInTheDocument();
    // The replacement is charisma-only — non-charisma bonuses are unchanged.
    expect(screen.getByText('Athletics (+8)')).toBeInTheDocument();
    expect(screen.getByText('Arcana (+2)')).toBeInTheDocument();
  });

  it('adds proficiency twice for charisma skills with expertise', () => {
    const stats = createPlayerStats({
      abilityOverrides: { Wisdom: { bonus: 2 } },
      skillProficiencies: ['Persuasion'],
      expertise: ['Persuasion'],
    });
    render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ wisCheckReplace: true }} />);
    // 2 (wis) + 3 (proficiency) + 3 (expertise) = +8.
    expect(screen.getByText('Persuasion (Expert) (+8)')).toBeInTheDocument();
  });

  it('shows the raw charisma bonus when the flag is not set', () => {
    render(<CharAbilities {...defaultProps} />);
    expect(screen.getByText('Deception (+2)')).toBeInTheDocument();
  });
});
