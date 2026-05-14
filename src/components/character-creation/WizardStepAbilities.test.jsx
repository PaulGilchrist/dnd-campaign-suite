import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepAbilities from './WizardStepAbilities.jsx';

// Mock fetch for loading ability names and point buy costs
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

global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(mockAbilityScores),
  })
);

// Mock the utils module
vi.mock('./utils.js', () => ({
  getPointBuyCosts: vi.fn(() => Promise.resolve(mockPointBuyCosts)),
}));

describe('WizardStepAbilities', () => {
  const mockProps = {
    formData: {
      rules: '5e',
      abilities: [
        { baseScore: '8', abilityImprovements: '0', miscBonus: '0' },
        { baseScore: '8', abilityImprovements: '0', miscBonus: '0' },
        { baseScore: '8', abilityImprovements: '0', miscBonus: '0' },
        { baseScore: '8', abilityImprovements: '0', miscBonus: '0' },
        { baseScore: '8', abilityImprovements: '0', miscBonus: '0' },
        { baseScore: '8', abilityImprovements: '0', miscBonus: '0' },
      ],
    },
    errors: {},
    onAbilityBaseScoreChange: vi.fn(),
    onAbilityImprovementChange: vi.fn(),
    onAbilityMiscBonusChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock for each test
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockAbilityScores),
      })
    );
  });

  it('should render the wizard step header', async () => {
    render(<WizardStepAbilities {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Step 5: Ability Scores')).toBeInTheDocument();
    });
  });

  it('should render the step description with point buy info', async () => {
    render(<WizardStepAbilities {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Use point buy/)).toBeInTheDocument();
    });
  });

  it('should render all ability score cards', async () => {
    render(<WizardStepAbilities {...mockProps} />);

    await waitFor(() => {
      const abilityCards = screen.getAllByText('Strength');
      expect(abilityCards.length).toBeGreaterThan(0);
    });
  });

  it('should render base score input for each ability', async () => {
    render(<WizardStepAbilities {...mockProps} />);

    await waitFor(() => {
      const baseScoreInputs = screen.getAllByLabelText('Base Score (8-15)');
      expect(baseScoreInputs.length).toBe(6);
    });
  });

  it('should render improvements input for each ability', async () => {
    render(<WizardStepAbilities {...mockProps} />);

    await waitFor(() => {
      const improvementsInputs = screen.getAllByLabelText('Improvements');
      expect(improvementsInputs.length).toBe(6);
    });
  });

  it('should render misc bonus input for each ability', async () => {
    render(<WizardStepAbilities {...mockProps} />);

    await waitFor(() => {
      const miscBonusInputs = screen.getAllByLabelText('Misc Bonus');
      expect(miscBonusInputs.length).toBe(6);
    });
  });

  it('should call onAbilityBaseScoreChange when base score input changes', async () => {
    render(<WizardStepAbilities {...mockProps} />);

    await waitFor(() => {
      const baseScoreInputs = screen.getAllByLabelText('Base Score (8-15)');
      fireEvent.change(baseScoreInputs[0], { target: { value: '10' } });
    });

    expect(mockProps.onAbilityBaseScoreChange).toHaveBeenCalled();
  });

  it('should call onAbilityImprovementChange when improvements input changes', async () => {
    render(<WizardStepAbilities {...mockProps} />);

    await waitFor(() => {
      const improvementsInputs = screen.getAllByLabelText('Improvements');
      fireEvent.change(improvementsInputs[0], { target: { value: '1' } });
    });

    expect(mockProps.onAbilityImprovementChange).toHaveBeenCalled();
  });

  it('should call onAbilityMiscBonusChange when misc bonus input changes', async () => {
    render(<WizardStepAbilities {...mockProps} />);

    await waitFor(() => {
      const miscBonusInputs = screen.getAllByLabelText('Misc Bonus');
      fireEvent.change(miscBonusInputs[0], { target: { value: '2' } });
    });

    expect(mockProps.onAbilityMiscBonusChange).toHaveBeenCalled();
  });

  it('should display error message when error exists for ability', async () => {
    const propsWithErrors = {
      ...mockProps,
      errors: {
        ability_0_baseScore: 'Base score must be between 8 and 15',
      },
    };

    render(<WizardStepAbilities {...propsWithErrors} />);

    await waitFor(() => {
      expect(screen.getByText('Base score must be between 8 and 15')).toBeInTheDocument();
    });
  });

  it('should not display error message when no errors exist', async () => {
    render(<WizardStepAbilities {...mockProps} />);

    await waitFor(() => {
      expect(screen.queryByText('Base score must be between 8 and 15')).not.toBeInTheDocument();
    });
  });

  it('should render total score for each ability', async () => {
    const propsWithScores = {
      ...mockProps,
      formData: {
        ...mockProps.formData,
        abilities: [
          { baseScore: '10', abilityImprovements: '2', miscBonus: '1' },
          { baseScore: '8', abilityImprovements: '0', miscBonus: '0' },
          { baseScore: '8', abilityImprovements: '0', miscBonus: '0' },
          { baseScore: '8', abilityImprovements: '0', miscBonus: '0' },
          { baseScore: '8', abilityImprovements: '0', miscBonus: '0' },
          { baseScore: '8', abilityImprovements: '0', miscBonus: '0' },
        ],
      },
    };

    render(<WizardStepAbilities {...propsWithScores} />);

    await waitFor(() => {
      const totalScores = screen.getAllByText('Total:');
      expect(totalScores.length).toBe(6);
    });
  });

  it('should show points remaining', async () => {
    render(<WizardStepAbilities {...mockProps} />);

    await waitFor(() => {
      const pointsRemainingSpan = document.querySelector('.points-remaining');
      expect(pointsRemainingSpan).toBeInTheDocument();
      expect(pointsRemainingSpan.textContent).toContain('points');
     });
   });

  it('should render with empty formData', async () => {
    const propsWithEmptyFormData = {
      ...mockProps,
      formData: {},
    };

    render(<WizardStepAbilities {...propsWithEmptyFormData} />);

    await waitFor(() => {
      expect(screen.getByText('Step 5: Ability Scores')).toBeInTheDocument();
    });
  });
});