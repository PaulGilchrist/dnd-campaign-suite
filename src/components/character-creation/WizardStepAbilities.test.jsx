import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepAbilities from './WizardStepAbilities.jsx';

const mockAbilityScores = [
  { full_name: 'Strength' },
  { full_name: 'Dexterity' },
  { full_name: 'Constitution' },
  { full_name: 'Intelligence' },
  { full_name: 'Wisdom' },
  { full_name: 'Charisma' }
];

const mockPointBuyCosts = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9
};

const mockBackgrounds2024 = [
  {
    index: 'acolyte',
    name: 'Acolyte',
    ability_scores: 'Intelligence, Wisdom, Charisma',
  }
];

const mockRulesValidation2024 = {
  2024: {
    point_buy: {
      total_points: 24,
      costs: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
    }
  }
};

const mockRulesValidation5e = {
  '5e': {
    point_buy: {
      total_points: 24,
      costs: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
    }
  }
};

global.fetch = vi.fn();

vi.mock('../../services/ui/utils.js', () => ({
  getPointBuyCosts: vi.fn(() => Promise.resolve(mockPointBuyCosts)),
}));

describe('WizardStepAbilities - Background Ability Scores', () => {
  const mockProps = {
    formData: {
      rules: '5e',
      abilities: [
        { baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
        { baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
        { baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
        { baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
        { baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
        { baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
      ],
    },
    errors: {},
    onAbilityBaseScoreChange: vi.fn(),
    onAbilityMiscIncreaseChange: vi.fn(),
    onBgAbilityBonusChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  function setupFetchMock(rules, background = null) {
    global.fetch.mockImplementation((url) => {
      if (url.includes('ability-scores.json')) {
        return Promise.resolve({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(mockAbilityScores),
        });
      }
      
      if (url.includes('rules-validation.json')) {
        const data = rules === '2024' ? mockRulesValidation2024 : mockRulesValidation5e;
        return Promise.resolve({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(data),
        });
      }
      
      if (url.includes('backgrounds.json') && background) {
        return Promise.resolve({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(mockBackgrounds2024),
        });
      }
      
      return Promise.resolve({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve([]),
      });
    });
  }

  it('should not show background ability section for 5e ruleset', async () => {
    setupFetchMock('5e');
    render(<WizardStepAbilities {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Step 5: Ability Scores')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Background Ability Scores/)).not.toBeInTheDocument();
  });

  it('should show background ability section for 2024 ruleset with background', async () => {
    const propsWith2024 = {
      ...mockProps,
      formData: {
        ...mockProps.formData,
        rules: '2024',
        background: 'Acolyte',
      },
    };

    setupFetchMock('2024', 'Acolyte');
    render(<WizardStepAbilities {...propsWith2024} />);

    await waitFor(() => {
      expect(screen.getByText(/Background Ability Scores/)).toBeInTheDocument();
    });

    expect(screen.getByText('Intelligence:')).toBeInTheDocument();
    expect(screen.getByText('Wisdom:')).toBeInTheDocument();
    expect(screen.getByText('Charisma:')).toBeInTheDocument();
  });

  it('should show validation warning when less than 3 points assigned', async () => {
    const propsWith2024 = {
      ...mockProps,
      formData: {
        ...mockProps.formData,
        rules: '2024',
        background: 'Acolyte',
      },
    };

    setupFetchMock('2024', 'Acolyte');
    render(<WizardStepAbilities {...propsWith2024} />);

    await waitFor(() => {
      expect(screen.getByText(/Background Ability Scores/)).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '0' } });

    await waitFor(() => {
      expect(screen.getByText(/must assign at least 3 points/)).toBeInTheDocument();
    });
  });

  it('should highlight background abilities in the ability score grid', async () => {
    const propsWith2024 = {
      ...mockProps,
      formData: {
        ...mockProps.formData,
        rules: '2024',
        background: 'Acolyte',
      },
    };

    setupFetchMock('2024', 'Acolyte');
    render(<WizardStepAbilities {...propsWith2024} />);

    await waitFor(() => {
      expect(screen.getByText(/Background Ability Scores/)).toBeInTheDocument();
    });

    const bgBadges = screen.getAllByText(/Background:/);
    expect(bgBadges.length).toBeGreaterThan(0);
  });

  it('should call onBgAbilityBonusChange when background ability is changed', async () => {
    const propsWith2024 = {
      ...mockProps,
      formData: {
        ...mockProps.formData,
        rules: '2024',
        background: 'Acolyte',
      },
    };

    setupFetchMock('2024', 'Acolyte');
    render(<WizardStepAbilities {...propsWith2024} />);

    await waitFor(() => {
      expect(screen.getByText(/Background Ability Scores/)).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '2' } });

    expect(mockProps.onBgAbilityBonusChange).toHaveBeenCalledWith('Intelligence', 2);
  });

  it('should show point buy total of 24 for 2024 ruleset', async () => {
    const propsWith2024 = {
      ...mockProps,
      formData: {
        ...mockProps.formData,
        rules: '2024',
      },
    };

    setupFetchMock('2024');
    render(<WizardStepAbilities {...propsWith2024} />);

    await waitFor(() => {
      expect(screen.getByText(/Total points allowed: 24/)).toBeInTheDocument();
    });
  });

  it('should show point buy total of 24 for 5e ruleset', async () => {
    setupFetchMock('5e');
    render(<WizardStepAbilities {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Total points allowed: 24/)).toBeInTheDocument();
    });
  });
});
