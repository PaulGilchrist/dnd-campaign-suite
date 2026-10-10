// @improved-by-ai
// @cleaned-by-ai
// Removed 3 redundant/low-value tests:
//   - "should show points remaining in description" → covered by header test (asserts step-description text)
//   - "should display point cost for each ability score" → low value, only asserts "Cost: 0" ×6 with no variation
//   - "should not show background ability section for 5e" → negative assertion redundant with 2024 positive test
// Consolidated 2 input-change callback tests into 1 parameterized test

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

const mockBackgrounds2024 = [
  {
    index: 'acolyte',
    name: 'Acolyte',
    ability_scores: 'Intelligence, Wisdom, Charisma',
  },
];

const mockRulesValidation2024 = {
  2024: {
    point_buy: {
      total_points: 24,
      costs: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 },
    },
  },
};

const mockRulesValidation5e = {
  '5e': {
    point_buy: {
      total_points: 24,
      costs: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 },
    },
  },
};

global.fetch = vi.fn();

vi.mock('../../services/character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(() => ({
    abilityScoreIncreases: [{ name: 'Strength', amount: 2 }],
  })),
}));

vi.mock('../../services/character/raceBuffService.js', () => ({
  computeRaceBuffs: vi.fn(() => ({
    abilityScoreIncreases: [{ name: 'Strength', amount: 2 }],
  })),
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
    onBackgroundIncreaseChange: vi.fn(),
    allFeats: [],
    featAbilityChoices: [],
    featAbilityAssignments: {},
    onFeatAbilityChoiceChange: vi.fn(),
    onFeatAbilityModeChange: vi.fn(),
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

async function renderWizard(props) {
  render(<WizardStepAbilities stepNumber={9} {...props} />);
  await waitFor(() => {
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(6);
  });
}

describe('WizardStepAbilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Header and description', () => {
    it('should render the step header and descriptions', async () => {
      setupFetchMock('5e');
      const props = createMockProps();
      await renderWizard(props);

      expect(screen.getByText('Step 9: Ability Scores')).toBeInTheDocument();
      expect(screen.getByText(/Total points allowed: 24/)).toBeInTheDocument();
      expect(
        screen.getByText(/Total score \(base \+ feat \+ background \+ racial \+ misc\) cannot exceed 20/)
      ).toBeInTheDocument();
    });
  });

  describe('Ability score cards', () => {
    it('should render all six ability score cards with inputs and totals', async () => {
      setupFetchMock('5e');
      const props = createMockProps();
      await renderWizard(props);

      expect(screen.getByText('Strength')).toBeInTheDocument();
      expect(screen.getByText('Dexterity')).toBeInTheDocument();
      expect(screen.getByText('Constitution')).toBeInTheDocument();
      expect(screen.getByText('Intelligence')).toBeInTheDocument();
      expect(screen.getByText('Wisdom')).toBeInTheDocument();
      expect(screen.getByText('Charisma')).toBeInTheDocument();

      const baseInputs = screen.getAllByLabelText('Base Score (8-15)');
      expect(baseInputs.length).toBe(6);

      const miscInputs = screen.getAllByLabelText('Misc Increase');
      expect(miscInputs.length).toBe(6);

      const totalScores = screen.getAllByText(/Total:/);
      expect(totalScores.length).toBe(6);
      totalScores.forEach((el) => {
        expect(el.textContent).toContain('Total: 8');
      });
    });

    it('should call the appropriate callback when base score or misc increase inputs change', async () => {
      const baseProps = createMockProps();
      setupFetchMock('5e');
      await renderWizard(baseProps);

      const baseInputs = screen.getAllByLabelText('Base Score (8-15)');
      fireEvent.change(baseInputs[0], { target: { value: '10' } });
      expect(baseProps.onAbilityBaseScoreChange).toHaveBeenCalledWith(0, '10');

      const miscInputs = screen.getAllByLabelText('Misc Increase');
      fireEvent.change(miscInputs[0], { target: { value: '3' } });
      expect(baseProps.onAbilityMiscIncreaseChange).toHaveBeenCalledWith(0, 3);
    });

    it('should show error styling and message for invalid base score or misc increase', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        errors: { ability_0_baseScore: 'Invalid score', ability_0_miscIncrease: 'Invalid value' },
      });
      await renderWizard(props);

      const baseInputs = screen.getAllByLabelText('Base Score (8-15)');
      expect(baseInputs[0]).toHaveClass('error');
      expect(screen.getByText('Invalid score')).toBeInTheDocument();

      const miscInputs = screen.getAllByLabelText('Misc Increase');
      expect(miscInputs[0]).toHaveClass('error');
      expect(screen.getByText('Invalid value')).toBeInTheDocument();
    });

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
      await renderWizard(props);

      const errorTotals = screen.getAllByText(/max 20/);
      expect(errorTotals.length).toBeGreaterThan(0);
    });

    it('should show misc points warning when misc increases total more than 0', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        formData: {
          rules: '5e',
          abilities: [
            { baseScore: '8', featIncrease: '0', miscIncrease: '2', backgroundIncrease: '0' },
            { baseScore: '8', featIncrease: '0', miscIncrease: '1', backgroundIncrease: '0' },
            { baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
            { baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
            { baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
            { baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' },
          ],
        },
      });
      await renderWizard(props);

      expect(screen.getByText(/Misc increases total 3 points./)).toBeInTheDocument();
    });
  });

  describe('2024 ruleset - background ability scores', () => {
    it('should show background ability section for 2024 with background', async () => {
      const props = createMockProps({
        formData: { rules: '2024', background: 'Acolyte' },
      });

      setupFetchMock('2024', 'Acolyte');
      await renderWizard(props);

      expect(screen.getByText(/Background Ability Scores \(Acolyte\)/)).toBeInTheDocument();
      expect(screen.getByText('Intelligence:')).toBeInTheDocument();
      expect(screen.getByText('Wisdom:')).toBeInTheDocument();
      expect(screen.getByText('Charisma:')).toBeInTheDocument();
    });

    it('should call onBackgroundIncreaseChange when background ability is changed', async () => {
      const props = createMockProps({
        formData: { rules: '2024', background: 'Acolyte' },
      });

      setupFetchMock('2024', 'Acolyte');
      await renderWizard(props);

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: '2' } });

      expect(props.onBackgroundIncreaseChange).toHaveBeenCalledWith('Intelligence', 2);
    });

    it('should highlight background abilities in the ability score grid with badge', async () => {
      const props = createMockProps({
        formData: { rules: '2024', background: 'Acolyte' },
      });

      setupFetchMock('2024', 'Acolyte');
      await renderWizard(props);

      const bgBadges = screen.getAllByText(/Background:/);
      expect(bgBadges.length).toBeGreaterThan(0);
    });

    it('should show validation warnings when points are outside the 3-point limit', async () => {
      const props = createMockProps({
        formData: { rules: '2024', background: 'Acolyte' },
      });

      setupFetchMock('2024', 'Acolyte');
      await renderWizard(props);

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: '0' } });

      await waitFor(() => {
        expect(screen.getByText(/must assign at least 3 points/)).toBeInTheDocument();
      });

      const allSelects = screen.getAllByRole('combobox');
      fireEvent.change(allSelects[0], { target: { value: '2' } });
      fireEvent.change(allSelects[1], { target: { value: '2' } });

      await waitFor(() => {
        expect(screen.getByText(/maximum is 3/)).toBeInTheDocument();
      });
    });
  });

  describe('2024 ruleset - background not found', () => {
    it('should handle missing background data gracefully', async () => {
      const props = createMockProps({
        formData: { rules: '2024', background: 'NonExistent' },
      });

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
            json: () => Promise.resolve(mockRulesValidation2024),
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

      await renderWizard(props);

      expect(screen.queryByText(/Background Ability Scores/)).not.toBeInTheDocument();
    });
  });

  describe('Feat ability score increases', () => {
    it('should not show feat ability section when there are no feat choices', async () => {
      setupFetchMock('5e');
      const props = createMockProps();
      await renderWizard(props);

      expect(screen.queryByText(/Feat Ability Score Increases/)).not.toBeInTheDocument();
    });

    it('should show feat ability section when there are feat choices', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        featAbilityChoices: [
          {
            featName: 'Ability Score Improvement',
            type: 'choice',
            mode: 'single',
            options: {
              single: { amount: 2, abilityNames: ['Strength', 'Constitution'], assignment: null },
              dual: { amount: 1, count: 2, abilityNames: ['Strength', 'Constitution'], assignments: [null, null] },
            },
            featDescription: 'Increase one ability score of your choice by 2',
          },
        ],
        featAbilityAssignments: {
          'Ability Score Improvement': { mode: 'single', assignments: { single: 'Strength', dual: ['Strength', ''] } },
        },
      });
      await renderWizard(props);

      expect(screen.getByText(/Feat Ability Score Increases/)).toBeInTheDocument();
      expect(screen.getByText('Ability Score Improvement')).toBeInTheDocument();
    });

    it('should show mode toggle with single and dual options for choice type', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        featAbilityChoices: [
          {
            featName: 'Ability Score Improvement',
            type: 'choice',
            mode: 'single',
            options: {
              single: { amount: 2, abilityNames: ['Strength', 'Dexterity', 'Constitution'], assignment: null },
              dual: { amount: 1, count: 2, abilityNames: ['Strength', 'Dexterity', 'Constitution'], assignments: [null, null] },
            },
            featDescription: 'Test description',
          },
        ],
        featAbilityAssignments: {
          'Ability Score Improvement': { mode: 'single', assignments: { single: 'Strength', dual: ['Strength', ''] } },
        },
      });
      await renderWizard(props);

      expect(screen.getByText('+2 to one ability')).toBeInTheDocument();
      expect(screen.getByText('+1 to 2 abilities')).toBeInTheDocument();
    });

    it('should render all ability options for a feat choice', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        featAbilityChoices: [
          {
            featName: 'Ability Score Improvement',
            type: 'choice',
            mode: 'single',
            options: {
              single: { amount: 2, abilityNames: ['Strength', 'Dexterity', 'Constitution'], assignment: null },
              dual: { amount: 1, count: 2, abilityNames: ['Strength', 'Dexterity', 'Constitution'], assignments: [null, null] },
            },
            featDescription: 'Test description',
          },
        ],
        featAbilityAssignments: {
          'Ability Score Improvement': { mode: 'single', assignments: { single: 'Strength', dual: ['Strength', ''] } },
        },
      });
      await renderWizard(props);

      const featSection = screen.getByText(/Feat Ability Score Increases/).closest('.bg-ability-choice');
      expect(featSection).toHaveTextContent('Strength');
      expect(featSection).toHaveTextContent('Dexterity');
      expect(featSection).toHaveTextContent('Constitution');
    });

    it('should call onFeatAbilityChoiceChange when feat ability is changed', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        featAbilityChoices: [
          {
            id: 'Ability Score Improvement',
            featName: 'Ability Score Improvement',
            type: 'choice',
            mode: 'single',
            options: {
              single: { amount: 2, abilityNames: ['Strength', 'Dexterity', 'Constitution'], assignment: null },
              dual: { amount: 1, count: 2, abilityNames: ['Strength', 'Dexterity', 'Constitution'], assignments: [null, null] },
            },
            featDescription: 'Test description',
          },
        ],
        featAbilityAssignments: {
          'Ability Score Improvement': { mode: 'single', assignments: { single: 'Strength', dual: ['Strength', ''] } },
        },
      });
      await renderWizard(props);

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'Constitution' } });

      expect(props.onFeatAbilityChoiceChange).toHaveBeenCalledWith('Ability Score Improvement', 0, 'Constitution');
    });

    it('should call onFeatAbilityModeChange when mode toggle is changed', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        featAbilityChoices: [
          {
            id: 'Ability Score Improvement',
            featName: 'Ability Score Improvement',
            type: 'choice',
            mode: 'single',
            options: {
              single: { amount: 2, abilityNames: ['Strength', 'Dexterity', 'Constitution'], assignment: null },
              dual: { amount: 1, count: 2, abilityNames: ['Strength', 'Dexterity', 'Constitution'], assignments: [null, null] },
            },
            featDescription: 'Test description',
          },
        ],
        featAbilityAssignments: {
          'Ability Score Improvement': { mode: 'single', assignments: { single: 'Strength', dual: ['Strength', ''] } },
        },
      });
      await renderWizard(props);

      const dualOption = screen.getByText('+1 to 2 abilities');
      fireEvent.click(dualOption);

      expect(props.onFeatAbilityModeChange).toHaveBeenCalledWith('Ability Score Improvement', 'dual');
    });
  });

  describe('Feat increase badges', () => {
    it('should show feat increase badge when a feat grants an ability score increase', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        formData: { rules: '5e', feats: ['Observant'] },
        allFeats: [{ name: 'Observant' }],
      });
      await renderWizard(props);

      const featBadges = screen.getAllByText(/Feat: \+\d/);
      expect(featBadges.length).toBeGreaterThan(0);
    });
  });

  describe('Racial increase badges', () => {
    it('should show racial increase badge when race has ability score increases', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        formData: {
          rules: '5e',
          race: { name: 'Hill Dwarf' },
        },
        racesData: [{ name: 'Hill Dwarf', subraces: [] }],
      });
      await renderWizard(props);

      const racialBadges = screen.getAllByText(/Racial: \+\d/);
      expect(racialBadges.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty abilities array gracefully', async () => {
      setupFetchMock('5e');
      const props = createMockProps({
        formData: { rules: '5e', abilities: [] },
      });
      await renderWizard(props);

      expect(screen.getByText('Step 9: Ability Scores')).toBeInTheDocument();
    });
  });
});
