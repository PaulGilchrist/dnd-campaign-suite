// Regression tests for point-buy overspend UX: attempting to raise a base
// score beyond the remaining points was silently clamped (and clearing the
// input silently reset it to 8). Overspend must now be refused with an
// inline "not enough points" message near the points-remaining display,
// mirroring the expertise-feedback refusal flow in WizardStepSkills.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepAbilities from './WizardStepAbilities.jsx';

const mockAbilityScores = [
  { full_name: 'Strength' },
  { full_name: 'Dexterity' },
  { full_name: 'Constitution' },
  { full_name: 'Intelligence' },
  { full_name: 'Wisdom' },
  { full_name: 'Charisma' },
];

const mockRulesValidation5e = {
  '5e': {
    point_buy: {
      total_points: 24,
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

function createProps(overrides = {}) {
  return {
    stepNumber: 9,
    formData: { rules: '5e', abilities: abilitiesWith([15, 15, 13, 8, 8, 8]) },
    errors: {},
    onAbilityBaseScoreChange: vi.fn(),
    onAbilityMiscIncreaseChange: vi.fn(),
    onBackgroundIncreaseChange: vi.fn(),
    allFeats: [],
    featAbilityChoices: [],
    featAbilityAssignments: {},
    onFeatAbilityChoiceChange: vi.fn(),
    onFeatAbilityModeChange: vi.fn(),
    ...overrides,
  };
}

async function renderStep(props) {
  render(<WizardStepAbilities {...props} />);
  await waitFor(() => {
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(6);
  });
}

// Spent: 9 + 9 + 5 + 0 + 0 + 0 = 23 of 24 → 1 point remaining.
describe('WizardStepAbilities point-buy overspend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('refuses an overspend increase, keeps the value, and shows an inline message', async () => {
    const props = createProps();
    await renderStep(props);

    const baseInputs = screen.getAllByLabelText('Base Score (8-15)');
    fireEvent.change(baseInputs[3], { target: { value: '10' } });

    expect(props.onAbilityBaseScoreChange).not.toHaveBeenCalled();
    await waitFor(() => {
      const feedback = document.querySelector('.points-feedback');
      expect(feedback).toBeInTheDocument();
      expect(feedback.textContent).toContain('Not enough points');
      expect(feedback.textContent).toContain('Intelligence');
    });
    expect(screen.getAllByLabelText('Base Score (8-15)')[3]).toHaveValue(8);
  });

  it('accepts an increase that exactly uses the remaining points with no message', async () => {
    const props = createProps();
    await renderStep(props);

    const baseInputs = screen.getAllByLabelText('Base Score (8-15)');
    fireEvent.change(baseInputs[3], { target: { value: '9' } });

    expect(props.onAbilityBaseScoreChange).toHaveBeenCalledWith(3, '9');
    expect(document.querySelector('.points-feedback')).not.toBeInTheDocument();
  });

  it('clears the message once a valid action is taken', async () => {
    const props = createProps();
    await renderStep(props);

    const baseInputs = screen.getAllByLabelText('Base Score (8-15)');
    fireEvent.change(baseInputs[3], { target: { value: '10' } });
    await waitFor(() => {
      expect(document.querySelector('.points-feedback')).toBeInTheDocument();
    });

    fireEvent.change(baseInputs[2], { target: { value: '12' } });

    expect(props.onAbilityBaseScoreChange).toHaveBeenCalledWith(2, '12');
    expect(document.querySelector('.points-feedback')).not.toBeInTheDocument();
  });

  it('does not forward an empty input (no silent reset to 8)', async () => {
    const props = createProps();
    await renderStep(props);

    const baseInputs = screen.getAllByLabelText('Base Score (8-15)');
    fireEvent.change(baseInputs[0], { target: { value: '' } });

    expect(props.onAbilityBaseScoreChange).not.toHaveBeenCalled();
  });

  it('auto-clears the message after a few seconds', async () => {
    const props = createProps();
    await renderStep(props);

    const baseInputs = screen.getAllByLabelText('Base Score (8-15)');
    fireEvent.change(baseInputs[3], { target: { value: '10' } });
    await waitFor(() => {
      expect(document.querySelector('.points-feedback')).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(document.querySelector('.points-feedback')).not.toBeInTheDocument();
      },
      { timeout: 4000 }
    );
  });
});
