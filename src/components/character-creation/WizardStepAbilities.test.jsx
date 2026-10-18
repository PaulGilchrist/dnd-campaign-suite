// @maintained-by-ai
// Generic lane for WizardStepAbilities: header/cap descriptions, ability-card
// rendering, error display, 2024 background panel (render + local validation),
// feat ASI cards, feat/racial badges, empty-abilities fallback.
// Point-buy budget refusal/refund and base-score forwarding are pinned in
// WizardStepAbilities.point-buy.test.jsx — not restated here.
// Fixtures mirror disk canon: public/data/rules-validation.json point_buy
// (total_points 27, costs {8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9}) and the
// 2024 Acolyte background (Intelligence, Wisdom, Charisma).

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

// Mirror of public/data/rules-validation.json point_buy for both rulesets (disk canon).
function rulesValidationFor(rules) {
  const pointBuy = {
    total_points: 27,
    costs: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 },
  };
  return { [rules]: { point_buy: pointBuy } };
}

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

function createProps(overrides = {}) {
  return {
    formData: {
      rules: '5e',
      abilities: Array.from({ length: 6 }, () => ({
        baseScore: '8',
        featIncrease: '0',
        miscIncrease: '0',
        backgroundIncrease: '0',
      })),
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

function setupFetchMock(rules) {
  global.fetch.mockImplementation((url) => {
    let data = [];
    if (url.includes('ability-scores.json')) data = mockAbilityScores;
    else if (url.includes('rules-validation.json')) data = rulesValidationFor(rules);
    else if (url.includes('backgrounds.json')) data = mockBackgrounds2024;
    return Promise.resolve({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(data),
    });
  });
}

async function renderWizard(props) {
  render(<WizardStepAbilities stepNumber={9} {...props} />);
  await waitFor(() => {
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(6);
  });
}

function cardFor(abilityName) {
  return screen.getByRole('heading', { level: 4, name: abilityName }).closest('.ability-score-card');
}

// Props for a single-mode '+2 to one / +1 to two' feat choice card.
const ASI_GROUP = {
  id: 'ability-score-improvement',
  featName: 'Ability Score Improvement',
  type: 'choice',
  mode: 'single',
  options: {
    single: { amount: 2, abilityNames: ['Strength', 'Dexterity', 'Constitution'], assignment: null },
    dual: { amount: 1, count: 2, abilityNames: ['Strength', 'Dexterity', 'Constitution'], assignments: [null, null] },
  },
  featDescription: 'Increase one ability score of your choice by 2, or increase two ability scores of your choice by 1.',
};
const ASI_ASSIGNMENTS = {
  'ability-score-improvement': { mode: 'single', assignments: { single: 'Strength', dual: ['Strength', ''] } },
};

describe('WizardStepAbilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Header and descriptions', () => {
    it('renders the step header, point-buy budget, and total-score cap guidance', async () => {
      setupFetchMock('5e');
      await renderWizard(createProps());

      expect(screen.getByRole('heading', { level: 2, name: /Step 9: Ability Scores/ })).toBeInTheDocument();
      expect(screen.getByText(/\(Total points allowed: 27\)/)).toBeInTheDocument();
      expect(
        screen.getByText(/Total score \(base \+ feat \+ background \+ racial \+ misc\) cannot exceed 20/)
      ).toBeInTheDocument();
    });
  });

  describe('Ability score cards', () => {
    it('renders six ability cards with base/misc inputs and totals of 8', async () => {
      setupFetchMock('5e');
      await renderWizard(createProps());

      expect(screen.getAllByLabelText('Base Score (8-15)')).toHaveLength(6);
      expect(screen.getAllByLabelText('Misc Increase')).toHaveLength(6);

      const totals = screen.getAllByText(/Total:/);
      expect(totals).toHaveLength(6);
      totals.forEach((el) => {
        expect(el.textContent).toContain('Total: 8');
      });
    });

    it('forwards misc increase edits as parsed integers', async () => {
      const props = createProps();
      setupFetchMock('5e');
      await renderWizard(props);

      fireEvent.change(screen.getAllByLabelText('Misc Increase')[0], { target: { value: '3' } });
      expect(props.onAbilityMiscIncreaseChange).toHaveBeenCalledWith(0, 3);
    });

    it('marks inputs with error class and shows messages from the errors map', async () => {
      setupFetchMock('5e');
      await renderWizard(createProps({
        errors: { ability_0_baseScore: 'Invalid score', ability_0_miscIncrease: 'Invalid value' },
      }));

      const baseInput = screen.getAllByLabelText('Base Score (8-15)')[0];
      const miscInput = screen.getAllByLabelText('Misc Increase')[0];
      expect(baseInput).toHaveClass('error');
      expect(miscInput).toHaveClass('error');
      expect(within(cardFor('Strength')).getByText('Invalid score')).toBeInTheDocument();
      expect(within(cardFor('Strength')).getByText('Invalid value')).toBeInTheDocument();
    });

    it('shows a single (max 20) error on the card whose total exceeds the cap', async () => {
      setupFetchMock('5e');
      await renderWizard(createProps({
        formData: {
          rules: '5e',
          abilities: [
            { baseScore: '15', featIncrease: '0', miscIncrease: '6', backgroundIncrease: '0' },
            ...Array.from({ length: 5 }, () => ({ baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' })),
          ],
        },
      }));

      expect(screen.getAllByText('(max 20)')).toHaveLength(1);
      const strCard = cardFor('Strength');
      expect(strCard.querySelector('.total-score')).toHaveClass('error');
      expect(strCard).toHaveTextContent('Total: 21');
      expect(cardFor('Dexterity')).not.toHaveTextContent('max');
    });

    it('warns when misc increases consume points outside point buy', async () => {
      setupFetchMock('5e');
      await renderWizard(createProps({
        formData: {
          rules: '5e',
          abilities: [
            { baseScore: '8', featIncrease: '0', miscIncrease: '2', backgroundIncrease: '0' },
            { baseScore: '8', featIncrease: '0', miscIncrease: '1', backgroundIncrease: '0' },
            ...Array.from({ length: 4 }, () => ({ baseScore: '8', featIncrease: '0', miscIncrease: '0', backgroundIncrease: '0' })),
          ],
        },
      }));

      expect(screen.getByText(/Misc increases total 3 points\./)).toBeInTheDocument();
    });
  });

  describe('2024 background ability panel', () => {
    async function renderWithAcolyte() {
      const props = createProps({ formData: { rules: '2024', background: 'Acolyte' } });
      setupFetchMock('2024');
      await renderWizard(props);
      return props;
    }

    it('renders background selects and highlights the three background ability cards with +1 badges', async () => {
      await renderWithAcolyte();

      expect(screen.getByText('Background Ability Scores (Acolyte):')).toBeInTheDocument();
      expect(screen.getByText('Intelligence:')).toBeInTheDocument();
      expect(screen.getByText('Wisdom:')).toBeInTheDocument();
      expect(screen.getByText('Charisma:')).toBeInTheDocument();
      // Badge amount reflects formData.backgroundIncrease ('0' until the parent applies changes).
      expect(screen.getAllByText('Background: +0')).toHaveLength(3);
      expect(cardFor('Strength').querySelector('.bg-ability-badge')).toBeNull();
    });

    it('forwards a background select change as a number and reflects it in the select', async () => {
      const props = await renderWithAcolyte();

      const select = screen.getByText('Intelligence:').closest('.bg-ability-assignment').querySelector('select');
      fireEvent.change(select, { target: { value: '2' } });

      expect(props.onBackgroundIncreaseChange).toHaveBeenCalledWith('Intelligence', 2);
      expect(select).toHaveValue('2');
    });

    it('warns when assigned background points fall below 3, then above 3', async () => {
      await renderWithAcolyte();

      const intSelect = screen.getByText('Intelligence:').closest('.bg-ability-assignment').querySelector('select');
      fireEvent.change(intSelect, { target: { value: '0' } });
      await waitFor(() => {
        expect(screen.getByText(/must assign at least 3 points.*Currently assigned: 2\./)).toBeInTheDocument();
      });

      fireEvent.change(intSelect, { target: { value: '2' } });
      const wisSelect = screen.getByText('Wisdom:').closest('.bg-ability-assignment').querySelector('select');
      fireEvent.change(wisSelect, { target: { value: '2' } });
      await waitFor(() => {
        expect(screen.getByText(/You have assigned 5 points to background abilities\. The maximum is 3/)).toBeInTheDocument();
      });
    });

    it('renders no background panel but keeps the ability grid when the background cannot be resolved', async () => {
      setupFetchMock('2024');
      await renderWizard(createProps({ formData: { rules: '2024', background: 'NonExistent' } }));

      expect(screen.queryByText(/Background Ability Scores/)).not.toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(6);
    });
  });

  describe('Feat ability score increase cards', () => {
    it('renders a feat ASI card with mode labels and the single-mode ability options selected', async () => {
      setupFetchMock('5e');
      await renderWizard(createProps({
        featAbilityChoices: [ASI_GROUP],
        featAbilityAssignments: ASI_ASSIGNMENTS,
      }));

      expect(screen.getByText(/Feat Ability Score Increases:/)).toBeInTheDocument();
      const card = screen.getByText('Ability Score Improvement').closest('.feat-asi-card');
      expect(within(card).getByText('+2 to one ability')).toBeInTheDocument();
      expect(within(card).getByText('+1 to 2 abilities')).toBeInTheDocument();

      const select = within(card).getByRole('combobox');
      expect([...select.querySelectorAll('option')].map((o) => o.value)).toEqual(['Strength', 'Dexterity', 'Constitution']);
      expect(select).toHaveValue('Strength');
    });

    it('forwards ability selection and mode toggle edits from the feat card', async () => {
      const props = createProps({
        featAbilityChoices: [ASI_GROUP],
        featAbilityAssignments: ASI_ASSIGNMENTS,
      });
      setupFetchMock('5e');
      await renderWizard(props);

      const card = screen.getByText('Ability Score Improvement').closest('.feat-asi-card');
      fireEvent.change(within(card).getByRole('combobox'), { target: { value: 'Constitution' } });
      expect(props.onFeatAbilityChoiceChange).toHaveBeenCalledWith('ability-score-improvement', 0, 'Constitution');

      fireEvent.click(within(card).getByRole('radio', { name: /\+1 to 2 abilities/ }));
      expect(props.onFeatAbilityModeChange).toHaveBeenCalledWith('ability-score-improvement', 'dual');
    });
  });

  describe('Feat and racial increase badges', () => {
    it('shows Feat and Racial badges on the Strength card and folds both into its total', async () => {
      setupFetchMock('5e');
      await renderWizard(createProps({
        formData: { rules: '5e', feats: ['Observant'], race: { name: 'Hill Dwarf' } },
        allFeats: [{ name: 'Observant' }],
        racesData: [{ name: 'Hill Dwarf', subraces: [] }],
      }));

      // Service mocks grant +2 Strength each: total = 8 base + 2 feat + 2 racial.
      expect(screen.getAllByText('Feat: +2')).toHaveLength(1);
      expect(screen.getAllByText('Racial: +2')).toHaveLength(1);
      expect(cardFor('Strength')).toHaveTextContent('Total: 12');
      expect(cardFor('Dexterity')).toHaveTextContent('Total: 8');
    });
  });

  describe('Edge cases', () => {
    it('falls back to default base score 8 on all cards when the abilities array is empty', async () => {
      setupFetchMock('5e');
      await renderWizard(createProps({ formData: { rules: '5e', abilities: [] } }));

      const totals = screen.getAllByText(/Total:/);
      expect(totals).toHaveLength(6);
      totals.forEach((el) => {
        expect(el.textContent).toContain('Total: 8');
      });
      expect(screen.getAllByLabelText('Base Score (8-15)')[0]).toHaveValue(8);
    });
  });
});
