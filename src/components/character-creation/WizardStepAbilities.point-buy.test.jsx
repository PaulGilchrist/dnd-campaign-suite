// @maintained-by-ai
// Point-buy lane for WizardStepAbilities: budget enforcement on base-score edits.
// Cost table and total_points pinned to public/data/rules-validation.json (5e):
// costs {8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9}, total_points 27.
// Regression context: overspend was silently clamped (and clearing the input
// silently reset it to 8); overspend must be refused with an inline
// "not enough points" message that auto-clears after 3s.
// Generic rendering, 2024 background, and feat-choice lanes live in
// WizardStepAbilities.test.jsx — not restated here.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WizardStepAbilities from './WizardStepAbilities.jsx';

const mockAbilityScores = [
  { full_name: 'Strength' },
  { full_name: 'Dexterity' },
  { full_name: 'Constitution' },
  { full_name: 'Intelligence' },
  { full_name: 'Wisdom' },
  { full_name: 'Charisma' },
];

// Mirror of public/data/rules-validation.json 5e point_buy (disk canon).
const mockRulesValidation5e = {
  '5e': {
    point_buy: {
      total_points: 27,
      costs: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 },
    },
  },
};

vi.mock('../../services/character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(() => ({ abilityScoreIncreases: [] })),
}));

vi.mock('../../services/character/raceBuffService.js', () => ({
  computeRaceBuffs: vi.fn(() => ({ abilityScoreIncreases: [] })),
}));

global.fetch = vi.fn((url) => {
  if (url.includes('ability-scores.json')) {
    return Promise.resolve({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(mockAbilityScores),
    });
  }
  if (url.includes('rules-validation.json')) {
    return Promise.resolve({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(mockRulesValidation5e),
    });
  }
  return Promise.resolve({
    ok: true,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve([]),
  });
});

function abilitiesWith(baseScores) {
  return baseScores.map((score) => ({
    baseScore: String(score),
    featIncrease: '0',
    miscIncrease: '0',
    backgroundIncrease: '0',
  }));
}

function createProps(baseScores) {
  return {
    stepNumber: 9,
    formData: { rules: '5e', abilities: abilitiesWith(baseScores) },
    errors: {},
    onAbilityBaseScoreChange: vi.fn(),
    onAbilityMiscIncreaseChange: vi.fn(),
    onBackgroundIncreaseChange: vi.fn(),
    allFeats: [],
    featAbilityChoices: [],
    featAbilityAssignments: {},
    onFeatAbilityChoiceChange: vi.fn(),
    onFeatAbilityModeChange: vi.fn(),
  };
}

async function renderStep(props) {
  render(<WizardStepAbilities {...props} />);
  await waitFor(() => {
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(6);
  });
}

// Index 3 is Intelligence in the mocked ability order.
describe('WizardStepAbilities point-buy budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows exact remaining points and refuses any increase when the budget is exhausted, clearing the message after 3s', async () => {
    // 9 + 9 + 9 = 27 of 27 spent → 0 remaining.
    const props = createProps([15, 15, 15, 8, 8, 8]);
    await renderStep(props);

    expect(screen.getByText(/Total points allowed: 27/)).toBeInTheDocument();
    expect(screen.getByText('0 points')).toBeInTheDocument();

    // Switch to fake timers so the 3000ms auto-hide of the feedback message
    // (benign UI timer in source) can be advanced deterministically.
    vi.useFakeTimers();

    // Raising 8→9 costs 1 with 0 left: refused, untouched, inline message.
    fireEvent.change(screen.getAllByLabelText('Base Score (8-15)')[3], { target: { value: '9' } });

    expect(props.onAbilityBaseScoreChange).not.toHaveBeenCalled();
    const feedback = screen.getByText(/Not enough points/);
    expect(feedback).toHaveTextContent('Intelligence');
    expect(screen.getAllByLabelText('Base Score (8-15)')[3]).toHaveValue(8);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText(/Not enough points/)).not.toBeInTheDocument();
  });

  it('refuses an overspend then accepts an increase that exactly uses the remaining points, clearing the message', async () => {
    // 9 + 9 + 7 = 25 of 27 spent → 2 remaining.
    const props = createProps([15, 15, 14, 8, 8, 8]);
    await renderStep(props);

    // 8→11 costs 3 with only 2 remaining: refused, no callback at all.
    fireEvent.change(screen.getAllByLabelText('Base Score (8-15)')[3], { target: { value: '11' } });
    expect(props.onAbilityBaseScoreChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Not enough points/)).toBeInTheDocument();

    // 8→10 costs exactly the 2 remaining: forwarded byte-exact, message gone.
    fireEvent.change(screen.getAllByLabelText('Base Score (8-15)')[3], { target: { value: '10' } });

    expect(props.onAbilityBaseScoreChange).toHaveBeenCalledTimes(1);
    expect(props.onAbilityBaseScoreChange).toHaveBeenCalledWith(3, '10');
    expect(screen.queryByText(/Not enough points/)).not.toBeInTheDocument();
  });

  it('always forwards refunds and never forwards an empty input', async () => {
    // Budget fully spent, but a decrease (refund) is always allowed.
    const props = createProps([15, 15, 15, 8, 8, 8]);
    await renderStep(props);

    // 15→8 refunds 9 points: forwarded unchanged.
    fireEvent.change(screen.getAllByLabelText('Base Score (8-15)')[0], { target: { value: '8' } });
    expect(props.onAbilityBaseScoreChange).toHaveBeenCalledWith(0, '8');

    // Clearing an input must be dropped, not silently reset to 8.
    fireEvent.change(screen.getAllByLabelText('Base Score (8-15)')[1], { target: { value: '' } });
    expect(props.onAbilityBaseScoreChange).toHaveBeenCalledTimes(1);
  });
});
