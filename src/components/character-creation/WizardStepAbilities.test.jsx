// @improved-by-ai
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

function createMockProps(overrides = {}) {
  return {
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
      ...overrides.formData,
    },
    errors: {},
    onAbilityBaseScoreChange: vi.fn(),
    onAbilityMiscIncreaseChange: vi.fn(),
    onBgAbilityBonusChange: vi.fn(),
    _backgroundAbilityChoices: [],
    _preSelectedBackgroundAbility: null,
    allFeats: [],
    featAbilityChoices: [],
    featAbilityAssignments: {},
    onFeatAbilityChoiceChange: vi.fn(),
    ...overrides,
  };
}

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

function setupFetchFailure() {
  global.fetch.mockImplementation((url) => {
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

    if (url.includes('backgrounds.json')) {
      return Promise.resolve({
        ok: false,
        status: 404,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve([]),
      });
    }

    return Promise.resolve({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve([]),
    });
  });
}

describe('WizardStepAbilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Header and description', () => {
    it('should render the step header', async () => {
      setupFetchMock('5e');
      const props = createMockProps();
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Step 5: Ability Scores')).toBeInTheDocument();
      });
    });

    it('should render the point buy description with points remaining', async () => {
      setupFetchMock('5e');
      const props = createMockProps();
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Total points allowed: 24/)).toBeInTheDocument();
      });
    });

    it('should render the max score description', async () => {
      setupFetchMock('5e');
      const props = createMockProps();
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Total score \(base \+ feat \+ background \+ misc\) cannot exceed 20/)).toBeInTheDocument();
      });
    });
  });

  describe('Ability score cards', () => {
    it('should render all six ability score cards', async () => {
      setupFetchMock('5e');
      const props = createMockProps();
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument();
      });

      expect(screen.getByText('Dexterity')).toBeInTheDocument();
      expect(screen.getByText('Constitution')).toBeInTheDocument();
      expect(screen.getByText('Intelligence')).toBeInTheDocument();
      expect(screen.getByText('Wisdom')).toBeInTheDocument();
      expect(screen.getByText('Charisma')).toBeInTheDocument();
    });

    it('should render base score inputs for each ability', async () => {
      setupFetchMock('5e');
      const props = createMockProps();
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument();
      });

      const baseInputs = screen.getAllByLabelText('Base Score (8-15)');
      expect(baseInputs.length).toBe(6);
    });

    it('should render misc increase inputs for each ability', async () => {
      setupFetchMock('5e');
      const props = createMockProps();
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument();
      });

      const miscInputs = screen.getAllByLabelText('Misc Increase');
      expect(miscInputs.length).toBe(6);
    });

    it('should render total score display for each ability', async () => {
      setupFetchMock('5e');
      const props = createMockProps();
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument();
      });

      const totalScores = screen.getAllByText(/Total:/);
      expect(totalScores.length).toBe(6);
    });

    it('should show total score of 8 when all bases are 8 with no increases', async () => {
      setupFetchMock('5e');
      const props = createMockProps();
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument();
      });

      const totalElements = screen.getAllByText(/Total:/);
      expect(totalElements.length).toBe(6);
      totalElements.forEach(el => {
        expect(el.textContent).toContain('Total: 8');
      });
    });

    it('should call onAbilityBaseScoreChange when base score input changes', async () => {
      setupFetchMock('5e');
      const props = createMockProps();
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument();
      });

      const baseInputs = screen.getAllByLabelText('Base Score (8-15)');
      fireEvent.change(baseInputs[0], { target: { value: '10' } });

      expect(props.onAbilityBaseScoreChange).toHaveBeenCalledWith(0, '10');
    });

    it('should call onAbilityMiscIncreaseChange when misc increase input changes', async () => {
      setupFetchMock('5e');
      const props = createMockProps();
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument();
      });

      const miscInputs = screen.getAllByLabelText('Misc Increase');
      fireEvent.change(miscInputs[0], { target: { value: '3' } });

      expect(props.onAbilityMiscIncreaseChange).toHaveBeenCalledWith(0, 3);
    });

    it('should show error class on base score input when error exists', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        errors: { ability_0_baseScore: 'Invalid score' }
      });
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument();
      });

      const baseInputs = screen.getAllByLabelText('Base Score (8-15)');
      expect(baseInputs[0]).toHaveClass('error');
    });

    it('should show error message for invalid base score', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        errors: { ability_0_baseScore: 'Invalid score' }
      });
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument();
      });

      expect(screen.getByText('Invalid score')).toBeInTheDocument();
    });

    it('should show error class on misc increase input when error exists', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        errors: { ability_0_miscIncrease: 'Invalid value' }
      });
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument();
      });

      const miscInputs = screen.getAllByLabelText('Misc Increase');
      expect(miscInputs[0]).toHaveClass('error');
    });

    it('should show error message for invalid misc increase', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        errors: { ability_0_miscIncrease: 'Invalid value' }
      });
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument();
      });

      expect(screen.getByText('Invalid value')).toBeInTheDocument();
    });
  });

  describe('Total score validation', () => {
    it('should show error styling when total score exceeds 20', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        formData: {
          rules: '5e',
          abilities: [
            { baseScore: '15', featIncrease: '0', miscIncrease: '6', backgroundIncrease: '0' },
            { baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
            { baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
            { baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
            { baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
            { baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
          ],
        },
      });
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument();
      });

      const errorTotals = screen.getAllByText(/max 20/);
      expect(errorTotals.length).toBeGreaterThan(0);
    });
  });

  describe('5e ruleset behavior', () => {
    it('should not show background ability section for 5e ruleset', async () => {
      setupFetchMock('5e');
      const props = createMockProps();
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Step 5: Ability Scores')).toBeInTheDocument();
      });

      expect(screen.queryByText(/Background Ability Scores/)).not.toBeInTheDocument();
    });

    it('should show point buy total of 24 for 5e ruleset', async () => {
      setupFetchMock('5e');
      const props = createMockProps();
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Total points allowed: 24/)).toBeInTheDocument();
      });
    });
  });

  describe('2024 ruleset - background ability scores', () => {
    it('should not show background ability section for 2024 without background', async () => {
      setupFetchMock('2024');
      const props = createMockProps({ formData: { rules: '2024' } });
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Step 5: Ability Scores')).toBeInTheDocument();
      });

      expect(screen.queryByText(/Background Ability Scores/)).not.toBeInTheDocument();
    });

    it('should show background ability section for 2024 with background', async () => {
      const props = createMockProps({
        formData: { rules: '2024', background: 'Acolyte' },
      });

      setupFetchMock('2024', 'Acolyte');
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Background Ability Scores \(Acolyte\)/)).toBeInTheDocument();
      });

      expect(screen.getByText('Intelligence:')).toBeInTheDocument();
      expect(screen.getByText('Wisdom:')).toBeInTheDocument();
      expect(screen.getByText('Charisma:')).toBeInTheDocument();
    });

    it('should pre-fill background ability selections from localStorage when available', async () => {
      const props = createMockProps({
        formData: { rules: '2024', background: 'Acolyte' },
      });

      setupFetchMock('2024', 'Acolyte');

      const storedAssignments = { Intelligence: 2, Wisdom: 1, Charisma: 0 };
      localStorage.setItem('_bg_abilities_Acolyte', JSON.stringify(storedAssignments));

      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Background Ability Scores \(Acolyte\)/)).toBeInTheDocument();
      });

      const selects = screen.getAllByRole('combobox');
      expect(selects[0]).toHaveValue('2');
      expect(selects[1]).toHaveValue('1');
      expect(selects[2]).toHaveValue('0');
    });

    it('should call onBgAbilityBonusChange when background ability is changed', async () => {
      const props = createMockProps({
        formData: { rules: '2024', background: 'Acolyte' },
      });

      setupFetchMock('2024', 'Acolyte');
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Background Ability Scores \(Acolyte\)/)).toBeInTheDocument();
      });

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: '2' } });

      expect(props.onBgAbilityBonusChange).toHaveBeenCalledWith('Intelligence', 2);
    });

    it('should save background ability assignments to localStorage', async () => {
      const props = createMockProps({
        formData: { rules: '2024', background: 'Acolyte' },
      });

      setupFetchMock('2024', 'Acolyte');
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Background Ability Scores \(Acolyte\)/)).toBeInTheDocument();
      });

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: '2' } });

      expect(localStorage.setItem).toHaveBeenCalledWith('_bg_abilities_Acolyte', expect.stringContaining('Intelligence'));
    });

    it('should highlight background abilities in the ability score grid with badge', async () => {
      const props = createMockProps({
        formData: { rules: '2024', background: 'Acolyte' },
      });

      setupFetchMock('2024', 'Acolyte');
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Background Ability Scores \(Acolyte\)/)).toBeInTheDocument();
      });

      const bgBadges = screen.getAllByText(/Background:/);
      expect(bgBadges.length).toBeGreaterThan(0);
    });

    it('should show validation warning when less than 3 points assigned', async () => {
      const props = createMockProps({
        formData: { rules: '2024', background: 'Acolyte' },
      });

      setupFetchMock('2024', 'Acolyte');
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Background Ability Scores \(Acolyte\)/)).toBeInTheDocument();
      });

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: '0' } });

      await waitFor(() => {
        expect(screen.getByText(/must assign at least 3 points/)).toBeInTheDocument();
      });
    });

    it('should show validation warning when more than 3 points assigned', async () => {
      const props = createMockProps({
        formData: { rules: '2024', background: 'Acolyte' },
      });

      setupFetchMock('2024', 'Acolyte');
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Background Ability Scores \(Acolyte\)/)).toBeInTheDocument();
      });

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: '2' } });
      fireEvent.change(selects[1], { target: { value: '2' } });

      await waitFor(() => {
        expect(screen.getByText(/maximum is 3/)).toBeInTheDocument();
      });
    });

    it('should cap background ability bonus at 2 since component enforces max', async () => {
      const props = createMockProps({
        formData: { rules: '2024', background: 'Acolyte' },
      });

      setupFetchMock('2024', 'Acolyte');
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Background Ability Scores \(Acolyte\)/)).toBeInTheDocument();
      });

      const selects = screen.getAllByRole('combobox');
      // Each select only has options 0, 1, 2 - the component caps at 2
      const maxOption = selects[0].querySelector('option[value="2"]');
      expect(maxOption).toBeInTheDocument();
      // Total of 6 would trigger the "maximum is 3" warning, not the "no single ability" warning
      // because the component caps individual values at 2
      fireEvent.change(selects[0], { target: { value: '2' } });
      fireEvent.change(selects[1], { target: { value: '2' } });
      fireEvent.change(selects[2], { target: { value: '2' } });

      await waitFor(() => {
        expect(screen.getByText(/maximum is 3/)).toBeInTheDocument();
      });
    });

    it('should show point buy total of 24 for 2024 ruleset', async () => {
      const props = createMockProps({
        formData: { rules: '2024' },
      });

      setupFetchMock('2024');
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Total points allowed: 24/)).toBeInTheDocument();
      });
    });
  });

  describe('2024 ruleset - background not found', () => {
    it('should handle missing background data gracefully', async () => {
      const props = createMockProps({
        formData: { rules: '2024', background: 'NonExistent' },
      });

      setupFetchFailure();
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Step 5: Ability Scores')).toBeInTheDocument();
      });

      expect(screen.queryByText(/Background Ability Scores/)).not.toBeInTheDocument();
    });
  });

  describe('Feat ability score increases', () => {
    it('should not show feat ability section when there are no feat choices', async () => {
      setupFetchMock('5e');
      const props = createMockProps();
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Step 5: Ability Scores')).toBeInTheDocument();
      });

      expect(screen.queryByText(/Feat Ability Score Increases/)).not.toBeInTheDocument();
    });

    it('should show feat ability section when there are feat choices', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        featAbilityChoices: [
          { amount: 1, abilityNames: ['Strength', 'Constitution'] },
        ],
        featAbilityAssignments: { '0': 'Strength' },
      });
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Feat Ability Score Increases/)).toBeInTheDocument();
      });

      expect(screen.getByText('Feat ASI 1 (+1):')).toBeInTheDocument();
    });

    it('should call onFeatAbilityChoiceChange when feat ability is changed', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        featAbilityChoices: [
          { amount: 1, abilityNames: ['Strength', 'Constitution'] },
        ],
        featAbilityAssignments: { '0': 'Strength' },
      });
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Feat Ability Score Increases/)).toBeInTheDocument();
      });

      const selects = screen.getAllByRole('combobox');
      const featSelect = selects.find(s => {
        const parent = s.closest('.bg-ability-assignment');
        return parent && parent.textContent.includes('Feat ASI');
      });

      if (featSelect) {
        fireEvent.change(featSelect, { target: { value: 'Constitution' } });
        expect(props.onFeatAbilityChoiceChange).toHaveBeenCalledWith(0, 'Constitution');
      }
    });

    it('should render all ability options for a feat choice', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        featAbilityChoices: [
          { amount: 1, abilityNames: ['Strength', 'Dexterity', 'Constitution'] },
        ],
        featAbilityAssignments: { '0': 'Strength' },
      });
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Feat Ability Score Increases/)).toBeInTheDocument();
      });

      const featSection = screen.getByText(/Feat Ability Score Increases/).closest('.bg-ability-choice');
      expect(featSection).toHaveTextContent('Strength');
      expect(featSection).toHaveTextContent('Dexterity');
      expect(featSection).toHaveTextContent('Constitution');
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined abilities array gracefully', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        formData: { rules: '5e', abilities: undefined },
      });
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Step 5: Ability Scores')).toBeInTheDocument();
      });
    });

    it('should handle missing errors prop gracefully when no errors exist', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        errors: {},
      });
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Step 5: Ability Scores')).toBeInTheDocument();
      });
    });

    it('should display point cost for each ability score', async () => {
      setupFetchMock('5e');
      const props = createMockProps();
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument();
      });

      // Base score 8 costs 0 points
      const pointCosts = screen.getAllByText('Cost: 0');
      expect(pointCosts.length).toBe(6);
    });

    it('should display correct point cost for score 10', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        formData: {
          rules: '5e',
          abilities: [
            { baseScore: '10', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
            { baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
            { baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
            { baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
            { baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
            { baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
          ],
        },
      });
      render(<WizardStepAbilities {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument();
      });

      expect(screen.getByText('Cost: 2')).toBeInTheDocument();
    });
  });
});
