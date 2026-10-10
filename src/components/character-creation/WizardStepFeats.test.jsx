// @improved-by-ai
// @cleaned-by-ai
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
    <WizardStepFeats stepNumber={8}
      stepNumber={8}
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

  describe('Rendering — pre-selected feats', () => {
    it('should mark pre-selected feats with a pre-selected label', () => {
      renderComponent({ preSelectedFeats: ['Great Weapon Master'] });
      expect(screen.getByText('(Pre-selected)')).toBeInTheDocument();
    });

    it('should not allow toggling pre-selected feats', () => {
      const mockOnChange = vi.fn();
      renderComponent({
        formData: { ...mockFormData, feats: ['Great Weapon Master'] },
        preSelectedFeats: ['Great Weapon Master'],
        onArrayFieldChange: mockOnChange,
      });
      const preSelectedBody = document.querySelector('.list-item.pre-selected .list-item-body');
      fireEvent.click(preSelectedBody);
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Rendering — expanded details', () => {
    it('should show expanded content when "Show More" is clicked', async () => {
      renderComponent();
      const toggleBtns = screen.getAllByRole('button', { name: 'Show More' });
      fireEvent.click(toggleBtns[0]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Show Less' })).toBeInTheDocument();
      });
    });

    it('should render text descriptions from a feat with a desc field', async () => {
      renderComponent();
      const featName = 'Sharpshooter';
      const featRow = screen.getByText(featName).closest('.list-item');
      const toggleBtn = featRow.querySelector('.toggle-details-btn');
      fireEvent.click(toggleBtn);

      await waitFor(() => {
        expect(screen.getByText('No disadvantage on long range')).toBeInTheDocument();
      });
    });
  });

  describe('Rendering — prerequisites', () => {
    it('should render prerequisites for feats with various prerequisite formats', async () => {
      renderComponent();

      // String prerequisite: "Charisma 13 or higher"
      const actorRow = screen.getByText('Actor').closest('.list-item');
      fireEvent.click(actorRow.querySelector('.toggle-details-btn'));
      await waitFor(() => {
        expect(actorRow.querySelector('.feat-prerequisites').textContent).toContain('Charisma 13 or higher');
      });

      // Object prerequisite: { level: 4 }
      const luckyRow = screen.getByText('Lucky').closest('.list-item');
      fireEvent.click(luckyRow.querySelector('.toggle-details-btn'));
      await waitFor(() => {
        expect(luckyRow.querySelector('.feat-prerequisites').textContent).toContain('Prerequisites:');
        expect(luckyRow.querySelector('.feat-prerequisites').textContent).toContain('4');
      });

      // Array prerequisites: ['Spellcasting feature', '4th level']
      const magicInitiateRow = screen.getByText('Magic Initiate').closest('.list-item');
      fireEvent.click(magicInitiateRow.querySelector('.toggle-details-btn'));
      await waitFor(() => {
        expect(magicInitiateRow.querySelector('.feat-prerequisites').textContent).toContain('Spellcasting feature');
        expect(magicInitiateRow.querySelector('.feat-prerequisites').textContent).toContain('4th level');
      });

      // Object with name: { name: 'Proficiency with Perception' }
      const observantRow = screen.getByText('Observant').closest('.list-item');
      fireEvent.click(observantRow.querySelector('.toggle-details-btn'));
      await waitFor(() => {
        expect(observantRow.querySelector('.feat-prerequisites').textContent).toContain('Proficiency with Perception');
      });
    });

    it('should not render prerequisites when the feat has none', async () => {
      const featsNoPrereqs = [
        { index: 'no-prereq-feat', name: 'No Prereqs Feat' },
      ];
      renderComponent({ allFeats: featsNoPrereqs });
      const featRow = screen.getByText('No Prereqs Feat').closest('.list-item');
      fireEvent.click(featRow.querySelector('.toggle-details-btn'));

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
        expect(screen.getByText(/plus 1 pre-selected feat/)).toBeInTheDocument();
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

  describe('Repeatable feats', () => {
    it('should show a count badge for repeatable feats with multiple selections', () => {
      const repeatableFeats = [
        { index: 'war-chant', name: 'War Chant', repeatable: true },
      ];
      renderComponent({
        allFeats: repeatableFeats,
        formData: { ...mockFormData, feats: ['War Chant', 'War Chant', 'War Chant'] },
      });

      expect(screen.getByText('(3)')).toBeInTheDocument();
    });

    it('should render "Add Another" button for selected repeatable feats', () => {
      const repeatableFeats = [
        { index: 'war-chant', name: 'War Chant', repeatable: true },
      ];
      renderComponent({
        allFeats: repeatableFeats,
        formData: { ...mockFormData, feats: ['War Chant'] },
      });

      expect(screen.getByText('Add Another')).toBeInTheDocument();
    });

    it('should render "Remove One" button for selected repeatable feats with count >= 1', () => {
      const repeatableFeats = [
        { index: 'war-chant', name: 'War Chant', repeatable: true },
      ];
      renderComponent({
        allFeats: repeatableFeats,
        formData: { ...mockFormData, feats: ['War Chant', 'War Chant'] },
      });

      expect(screen.getByText('Remove One')).toBeInTheDocument();
    });

    it('should call onArrayFieldChange with empty array when "Add Another" is clicked on a selected repeatable feat', () => {
      const mockOnChange = vi.fn();
      const repeatableFeats = [
        { index: 'war-chant', name: 'War Chant', repeatable: true },
      ];
      renderComponent({
        allFeats: repeatableFeats,
        formData: { ...mockFormData, feats: ['War Chant'] },
        onArrayFieldChange: mockOnChange,
      });

      fireEvent.click(screen.getByText('Add Another'));
      expect(mockOnChange).toHaveBeenCalledWith('feats', []);
    });
  });

  describe('FT-001 Ability Score Improvement serialization', () => {
    const asiFeat = { index: 'ability-score-improvement', name: 'Ability Score Improvement', type: 'General Feat', prerequisites: { level: 4 }, repeatable: true };

    it('adds Ability Score Improvement to feats when ticked', () => {
      const mockOnChange = vi.fn();
      renderComponent({
        allFeats: [asiFeat],
        formData: { ...mockFormData, rules: '2024', level: 8, feats: ['Magic Initiate'] },
        onArrayFieldChange: mockOnChange,
      });
      const row = [...document.querySelectorAll('.list-item')].find(el => el.textContent.includes('Ability Score Improvement'));
      fireEvent.click(row.querySelector('.list-item-checkbox'));
      expect(mockOnChange).toHaveBeenCalledWith('feats', ['Magic Initiate', 'Ability Score Improvement']);
    });

    it('removes Ability Score Improvement from feats when un-ticked', () => {
      const mockOnChange = vi.fn();
      renderComponent({
        allFeats: [asiFeat],
        formData: { ...mockFormData, rules: '2024', level: 8, feats: ['Magic Initiate', 'Ability Score Improvement'] },
        onArrayFieldChange: mockOnChange,
      });
      const row = [...document.querySelectorAll('.list-item')].find(el => el.textContent.includes('Ability Score Improvement'));
      fireEvent.click(row.querySelector('.list-item-checkbox'));
      expect(mockOnChange).toHaveBeenCalledWith('feats', ['Magic Initiate']);
    });
  });

  describe('Edge cases', () => {
    it('should render the wizard step title when allFeats is null or undefined', () => {
      const { rerender } = render(<WizardStepFeats stepNumber={8} formData={mockFormData} allFeats={null} onArrayFieldChange={vi.fn()} preSelectedFeats={[]} />);
      expect(screen.getByText('Step 8: Feats')).toBeInTheDocument();

      rerender(<WizardStepFeats stepNumber={8} formData={mockFormData} allFeats={undefined} onArrayFieldChange={vi.fn()} preSelectedFeats={[]} />);
      expect(screen.getByText('Step 8: Feats')).toBeInTheDocument();
    });
  });
});
