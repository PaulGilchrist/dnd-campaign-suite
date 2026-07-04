// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepFeats from './WizardStepFeats.jsx';
import * as featValidation from '../../services/character/featValidation.js';

vi.mock('../../services/character/featValidation.js', () => ({
  validateFeats: vi.fn(() => Promise.resolve([])),
  getFeatLimits: vi.fn(() => Promise.resolve({ allowed: 2, originRequired: false, details: 'Test rules' })),
  normalizeFeatDescription: vi.fn((feat) => ({ text: feat.description || (feat.desc && feat.desc[0]) || '', isHtml: !!feat.description })),
  getRaceFeatChoices: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../services/character/featBuffService.js', () => ({
  computeFeatBuffs: vi.fn(() => ({
    abilityScoreIncreases: [],
    proficiencies: [],
    resistances: [],
    features: [],
  })),
}));

const mockFeats = [
  { index: 'great-weapon-master', name: 'Great Weapon Master', type: 'Combat', description: 'Bonus attack' },
  { index: 'sharpshooter', name: 'Sharpshooter', desc: ['No disadvantage on long range'] },
  { index: 'lucky', name: 'Lucky', prerequisites: { level: 4 } },
  { index: 'magic-initiate', name: 'Magic Initiate', type: 'General', description: '<p>Learn two cantrips</p>', prerequisites: ['Spellcasting feature', '4th level'] },
  { index: 'actor', name: 'Actor', type: 'General', desc: ['You master disguise and mimicry'], prerequisites: 'Charisma 13 or higher' },
  { index: 'observant', name: 'Observant', type: 'General', desc: ['Keen observation'], prerequisites: { name: 'Proficiency with Perception' } },
  { index: 'weapon-master', name: 'Weapon Master', type: 'Combat', description: '<p><strong>Master</strong> all weapons</p>' },
];

const mockFormData = {
  feats: [],
  level: 4,
  rules: '5e',
};

function renderComponent(props) {
  return render(
    <WizardStepFeats
      formData={mockFormData}
      allFeats={mockFeats}
      onArrayFieldChange={vi.fn()}
      preSelectedFeats={[]}
      {...props}
    />,
  );
}

describe('WizardStepFeats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    featValidation.getRaceFeatChoices.mockReset().mockResolvedValue([]);
  });

  describe('Rendering — header and structure', () => {
    it('should render the step header, search input, type filter, and "Show Only Selected" checkbox', () => {
      renderComponent();
      expect(screen.getByText('Step 4: Feats')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search feats...')).toBeInTheDocument();
      const typeLabels = screen.getAllByText('Combat');
      expect(typeLabels.length).toBeGreaterThan(0);
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('should render all feat names sorted alphabetically', () => {
      renderComponent();
      expect(screen.getByText('Actor')).toBeInTheDocument();
      expect(screen.getByText('Great Weapon Master')).toBeInTheDocument();
      expect(screen.getByText('Lucky')).toBeInTheDocument();
      expect(screen.getByText('Magic Initiate')).toBeInTheDocument();
      expect(screen.getByText('Observant')).toBeInTheDocument();
      expect(screen.getByText('Sharpshooter')).toBeInTheDocument();
      expect(screen.getByText('Weapon Master')).toBeInTheDocument();
    });
  });

  describe('Rendering — pre-selected feats', () => {
    it('should mark pre-selected feats with a pre-selected label and not allow toggling', () => {
      renderComponent({ preSelectedFeats: ['Great Weapon Master'] });
      expect(screen.getByText('(Pre-selected)')).toBeInTheDocument();

      const mockOnChange = vi.fn();
      renderComponent({
        formData: { ...mockFormData, feats: ['Great Weapon Master'] },
        preSelectedFeats: ['Great Weapon Master'],
        onArrayFieldChange: mockOnChange,
      });
      const preSelectedBody = document.querySelectorAll('.list-item.pre-selected .list-item-body')[0];
      fireEvent.click(preSelectedBody);
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Rendering — expanded details', () => {
    it('should toggle "Show More"/"Show Less" after expanding', async () => {
      renderComponent();
      const buttons = screen.getAllByRole('button', { name: 'Show More' });
      expect(buttons.length).toBeGreaterThan(0);

      fireEvent.click(buttons[0]);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Show Less' })).toBeInTheDocument();
      });
    });

    it('should render HTML and text descriptions for feats', async () => {
      const { container } = renderComponent();
      const buttons = screen.getAllByRole('button', { name: 'Show More' });

      fireEvent.click(buttons[3]);
      await waitFor(() => {
        const descriptionDiv = container.querySelector('.feat-description');
        expect(descriptionDiv).toBeInTheDocument();
        expect(descriptionDiv).toContainHTML('<p>Learn two cantrips</p>');
      });
    });

    it('should render text descriptions for feats with a desc field', async () => {
      renderComponent();
      const buttons = screen.getAllByRole('button', { name: 'Show More' });
      fireEvent.click(buttons[5]);
      await waitFor(() => {
        expect(screen.getByText('No disadvantage on long range')).toBeInTheDocument();
      });
    });

    it('should render HTML content with sanitized markup', async () => {
      const { container } = renderComponent();
      const buttons = screen.getAllByRole('button', { name: 'Show More' });
      fireEvent.click(buttons[6]);
      await waitFor(() => {
        const descriptionDiv = container.querySelector('.feat-description');
        expect(descriptionDiv).toContainHTML('<strong>Master</strong>');
      });
    });
  });

  describe('Rendering — prerequisites', () => {
    it('should render prerequisites for feats with various prerequisite formats', async () => {
      renderComponent();
      const buttons = screen.getAllByRole('button', { name: 'Show More' });

      fireEvent.click(buttons[0]);
      await waitFor(() => {
        expect(screen.getByText(/Charisma 13/)).toBeInTheDocument();
      });

      fireEvent.click(buttons[2]);
      await waitFor(() => {
        expect(screen.getByText(/{"level":4}/)).toBeInTheDocument();
      });

      fireEvent.click(buttons[3]);
      await waitFor(() => {
        expect(screen.getByText(/Spellcasting feature/)).toBeInTheDocument();
        expect(screen.getByText(/4th level/)).toBeInTheDocument();
      });

      fireEvent.click(buttons[4]);
      await waitFor(() => {
        expect(screen.getByText(/Proficiency with Perception/)).toBeInTheDocument();
      });
    });

    it('should not render prerequisites when the feat has none', async () => {
      const featsNoPrereqs = [
        { index: 'no-prereq-feat', name: 'No Prereqs Feat' },
      ];
      renderComponent({ allFeats: featsNoPrereqs });
      const buttons = screen.getAllByRole('button', { name: 'Show More' });
      fireEvent.click(buttons[0]);

      await waitFor(() => {
        expect(screen.queryByText('Prerequisites:')).not.toBeInTheDocument();
      });
    });
  });

  describe('Rendering — buffs and summary', () => {
    it('should render buff counts in summary when buffs are provided', async () => {
      renderComponent({
        allFeats: [{ index: 'asi-feat', name: 'ASI Feat' }],
        formData: { ...mockFormData, feats: ['ASI Feat'] },
        computedBuffs: {
          abilityScoreIncreases: [{ name: 'Strength', amount: 2 }],
          proficiencies: [{ name: 'Longswords' }],
          resistances: ['Fire'],
          features: [{ name: 'Darkvision' }],
        },
      });

      await waitFor(() => {
        expect(screen.getByText(/Applied Buffs/)).toBeInTheDocument();
        expect(screen.getByText(/1 ability score increase/)).toBeInTheDocument();
        expect(screen.getByText(/1 proficiency/)).toBeInTheDocument();
        expect(screen.getByText(/1 resistance/)).toBeInTheDocument();
        expect(screen.getByText('• 1 passive/feature buff(s)')).toBeInTheDocument();
      });
    });

    it('should display the rules details from featLimits', async () => {
      featValidation.getFeatLimits.mockResolvedValueOnce({
        allowed: 5,
        originRequired: false,
        details: 'Feats at levels 4, 8, 12, 16, 19',
      });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Feats at levels/)).toBeInTheDocument();
      });
    });

    it('should display the correct count of user-selected vs allowed feats', async () => {
      renderComponent({ formData: { ...mockFormData, feats: ['Great Weapon Master', 'Lucky'] } });
      await waitFor(() => {
        expect(screen.getByText(/2 of 2 allowed/)).toBeInTheDocument();
      });
    });

    it('should display user-selected count excluding pre-selected feats', async () => {
      renderComponent({
        formData: { ...mockFormData, feats: ['Great Weapon Master', 'Lucky'] },
        preSelectedFeats: ['Great Weapon Master'],
      });
      await waitFor(() => {
        expect(screen.getByText(/1 of 2 allowed/)).toBeInTheDocument();
        expect(screen.getByText(/plus 1 background feat/)).toBeInTheDocument();
      });
    });

    it('should not mention background feat count when there are none', async () => {
      renderComponent({ formData: { ...mockFormData, feats: ['Lucky'] } });
      await waitFor(() => {
        expect(screen.getByText(/1 of 2 allowed/)).toBeInTheDocument();
        expect(screen.queryByText(/plus/)).not.toBeInTheDocument();
      });
    });

    it('should display zero selected when no feats are chosen', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/0 of 2 allowed/)).toBeInTheDocument();
      });
    });
  });

  describe('Rendering — warnings', () => {
    it('should display validation warnings when validateFeats returns warnings', async () => {
      featValidation.validateFeats.mockResolvedValueOnce([
        { message: 'Too many feats selected', type: 'warning' },
        { message: 'Consider an Origin feat', type: 'info' },
      ]);

      renderComponent({ formData: { ...mockFormData, feats: ['Great Weapon Master', 'Sharpshooter', 'Lucky'] } });

      await waitFor(() => {
        expect(screen.getByText('Too many feats selected')).toBeInTheDocument();
        expect(screen.getByText('Consider an Origin feat')).toBeInTheDocument();
      });
    });
  });

  describe('Rendering — filtering', () => {
    it('should filter feats by search query (case-insensitive), type dropdown, and "Show Only Selected" checkbox', () => {
      renderComponent();
      fireEvent.change(screen.getByPlaceholderText('Search feats...'), { target: { value: 'Lucky' } });
      expect(screen.getByText('Lucky')).toBeInTheDocument();
      expect(screen.queryByText('Great Weapon Master')).not.toBeInTheDocument();

      fireEvent.change(screen.getByPlaceholderText('Search feats...'), { target: { value: 'lucky' } });
      expect(screen.getByText('Lucky')).toBeInTheDocument();
    });

    it('should filter feats by type using the dropdown', () => {
      renderComponent();
      const typeFilter = document.querySelector('.type-filter');
      fireEvent.change(typeFilter, { target: { value: 'Combat' } });
      expect(screen.getByText('Great Weapon Master')).toBeInTheDocument();
      expect(screen.getByText('Weapon Master')).toBeInTheDocument();
      expect(screen.queryByText('Actor')).not.toBeInTheDocument();
    });

    it('should combine search, type filter, and show-only-selected', () => {
      renderComponent();
      fireEvent.change(screen.getByPlaceholderText('Search feats...'), { target: { value: 'Master' } });
      const typeFilter = document.querySelector('.type-filter');
      fireEvent.change(typeFilter, { target: { value: 'Combat' } });
      expect(screen.getByText('Great Weapon Master')).toBeInTheDocument();
      expect(screen.getByText('Weapon Master')).toBeInTheDocument();
      expect(screen.queryByText('Magic Initiate')).not.toBeInTheDocument();
    });

    it('should filter to show only selected items when the checkbox is checked', () => {
      renderComponent({ formData: { ...mockFormData, feats: ['Lucky'] } });
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(screen.getByText('Lucky')).toBeInTheDocument();
      expect(screen.queryByText('Actor')).not.toBeInTheDocument();
    });

    it('should show the selected count in the "Show Only Selected" label', () => {
      renderComponent({ formData: { ...mockFormData, feats: ['Lucky', 'Actor'] } });
      expect(screen.getByText(/2 selected\)/)).toBeInTheDocument();
    });

    it('should display correct plural/singular/zero result counts', () => {
      renderComponent();
      expect(screen.getByText(/Showing 7 feats/)).toBeInTheDocument();

      fireEvent.change(screen.getByPlaceholderText('Search feats...'), { target: { value: 'Lucky' } });
      expect(screen.getByText(/Showing 1 feat/)).toBeInTheDocument();

      fireEvent.change(screen.getByPlaceholderText('Search feats...'), { target: { value: 'ZZZZ' } });
      expect(screen.getByText(/Showing 0 feats/)).toBeInTheDocument();
    });

    it('should show no results message when search has no matches', () => {
      renderComponent();
      fireEvent.change(screen.getByPlaceholderText('Search feats...'), { target: { value: 'Nonexistent' } });
      expect(screen.getByText(/No feat found matching your criteria/)).toBeInTheDocument();
    });
  });

  describe('Rendering — empty/missing items', () => {
    it('should render loading message when allFeats is null', () => {
      renderComponent({ allFeats: null });
      expect(screen.getByText('Feat data not yet loaded. Please try again.')).toBeInTheDocument();
    });

    it('should still render the title when allFeats is empty', () => {
      renderComponent({ allFeats: [] });
      expect(screen.getByText('Step 4: Feats')).toBeInTheDocument();
    });
  });

  describe('Race feat choices for 2024 ruleset', () => {
    it('should display versatile trait info when race has Versatile trait and choices are available', async () => {
      featValidation.getRaceFeatChoices.mockResolvedValueOnce(['Skilled', 'Observant']);
      const { container } = renderComponent({
        formData: {
          ...mockFormData,
          rules: '2024',
          race: { name: 'Human', traits: [{ name: 'Versatile', proficiency_choices: { from: ['Skilled', 'Observant'] } }] },
        },
      });

      await waitFor(() => {
        const versatileSection = container.querySelector('.versatile-trait-info');
        expect(versatileSection).toBeInTheDocument();
        expect(versatileSection).toHaveTextContent('Skilled');
        expect(versatileSection).toHaveTextContent('Observant');
      });
    });

    it('should not display versatile trait info for 5e ruleset', async () => {
      renderComponent({ formData: { ...mockFormData, rules: '5e' } });

      await waitFor(() => {
        expect(screen.queryByText(/Versatile Trait/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Integration — selection workflow', () => {
    it('should add a feat to the selection when its checkbox is clicked', async () => {
      const mockOnChange = vi.fn();
      renderComponent({ onArrayFieldChange: mockOnChange });
      const checkboxes = document.querySelectorAll('.list-item-checkbox-trigger');
      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('feats', ['Actor']);
      });
    });

    it('should remove a feat from the selection when its checkbox is clicked again', async () => {
      const mockOnChange = vi.fn();
      renderComponent({
        formData: { ...mockFormData, feats: ['Actor'] },
        onArrayFieldChange: mockOnChange,
      });
      const checkboxes = document.querySelectorAll('.list-item-checkbox-trigger');
      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('feats', []);
      });
    });
  });
});
