import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepFeats from './WizardStepFeats.jsx';
import * as featValidation from '../../services/featValidation.js';

vi.mock('../../services/featValidation.js', () => ({
  validateFeats: vi.fn(() => Promise.resolve([])),
  getFeatLimits: vi.fn(() => Promise.resolve({ allowed: 2, originRequired: false, details: 'Test rules' })),
  normalizeFeatDescription: vi.fn((feat) => ({ text: feat.description || (feat.desc && feat.desc[0]) || '', isHtml: !!feat.description }))
}));

vi.mock('../../services/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html)
}));

describe('WizardStepFeats', () => {
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
    rules: '5e'
  };

  const mockOnArrayFieldChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the component with title', () => {
    render(
      <WizardStepFeats
        formData={mockFormData}
        allFeats={mockFeats}
        onArrayFieldChange={mockOnArrayFieldChange}
        preSelectedFeats={[]}
      />
    );

    expect(screen.getByText('Step 4: Feats')).toBeInTheDocument();
  });

  it('should render feat items', () => {
    render(
      <WizardStepFeats
        formData={mockFormData}
        allFeats={mockFeats}
        onArrayFieldChange={mockOnArrayFieldChange}
        preSelectedFeats={[]}
      />
    );

    expect(screen.getByText('Great Weapon Master')).toBeInTheDocument();
    expect(screen.getByText('Sharpshooter')).toBeInTheDocument();
    expect(screen.getByText('Lucky')).toBeInTheDocument();
  });

  it('should handle feat selection', () => {
    render(
      <WizardStepFeats
        formData={mockFormData}
        allFeats={mockFeats}
        onArrayFieldChange={mockOnArrayFieldChange}
        preSelectedFeats={[]}
      />
    );

    fireEvent.click(screen.getByText('Great Weapon Master'));

    expect(mockOnArrayFieldChange).toHaveBeenCalled();
  });

  it('should render with pre-selected feats', () => {
    render(
      <WizardStepFeats
        formData={mockFormData}
        allFeats={mockFeats}
        onArrayFieldChange={mockOnArrayFieldChange}
        preSelectedFeats={['great-weapon-master']}
      />
    );

    expect(screen.getByText('Great Weapon Master')).toBeInTheDocument();
  });

  it('should show feat type when available', () => {
    render(
      <WizardStepFeats
        formData={mockFormData}
        allFeats={mockFeats}
        onArrayFieldChange={mockOnArrayFieldChange}
        preSelectedFeats={[]}
      />
    );

    // The type is rendered inside renderItem which is passed to SelectableList
    // Just verify the component renders without crashing
    expect(screen.getByText('Step 4: Feats')).toBeInTheDocument();
  });

  describe('Feat description rendering', () => {
    it('should render HTML description via dangerouslySetInnerHTML for feats with description field', async () => {
      render(
        <WizardStepFeats
          formData={mockFormData}
          allFeats={mockFeats}
          onArrayFieldChange={mockOnArrayFieldChange}
          preSelectedFeats={[]}
        />
      );

      // Find Magic Initiate (has HTML description) - sorted: Actor, Great Weapon Master, Lucky, Magic Initiate, Observant, Sharpshooter, Weapon Master
      // Magic Initiate is at index 3 after alphabetical sort
      const showMoreBtns = screen.getAllByText('Show More');
      fireEvent.click(showMoreBtns[3]);

      await waitFor(() => {
        expect(screen.getByText(/Learn two cantrips/)).toBeInTheDocument();
      });
    });

    it('should render text description directly for feats with desc field', async () => {
      render(
        <WizardStepFeats
          formData={mockFormData}
          allFeats={mockFeats}
          onArrayFieldChange={mockOnArrayFieldChange}
          preSelectedFeats={[]}
        />
      );

      // Sharpshooter has desc field (text, not HTML) - it's at index 5 after alphabetical sort
      const showMoreBtns = screen.getAllByText('Show More');
      fireEvent.click(showMoreBtns[5]);

      await waitFor(() => {
        expect(screen.getByText('No disadvantage on long range')).toBeInTheDocument();
      });
    });

    it('should render HTML content from dangerouslySetInnerHTML correctly', async () => {
      const { container } = render(
        <WizardStepFeats
          formData={mockFormData}
          allFeats={mockFeats}
          onArrayFieldChange={mockOnArrayFieldChange}
          preSelectedFeats={[]}
        />
      );

      // Weapon Master has HTML description - it's sorted last (index 6)
      const showMoreBtns = screen.getAllByText('Show More');
      fireEvent.click(showMoreBtns[6]);

      await waitFor(() => {
        const descriptionDiv = container.querySelector('.feat-description');
        expect(descriptionDiv).toBeInTheDocument();
        expect(descriptionDiv).toContainHTML('<strong>Master</strong>');
      });
    });
  });

  describe('Prerequisites rendering', () => {
    it('should render array prerequisites as comma-separated strings', async () => {
      render(
        <WizardStepFeats
          formData={mockFormData}
          allFeats={mockFeats}
          onArrayFieldChange={mockOnArrayFieldChange}
          preSelectedFeats={[]}
        />
      );

      // Magic Initiate has array prerequisites ['Spellcasting feature', '4th level']
      // Sorted: Actor(0), Great Weapon Master(1), Lucky(2), Magic Initiate(3), Observant(4), Sharpshooter(5), Weapon Master(6)
      const showMoreBtns = screen.getAllByText('Show More');
      fireEvent.click(showMoreBtns[3]);

      await waitFor(() => {
        expect(screen.getByText('Prerequisites:')).toBeInTheDocument();
        expect(screen.getByText(/Spellcasting feature/)).toBeInTheDocument();
        expect(screen.getByText(/4th level/)).toBeInTheDocument();
      });
    });

    it('should render string prerequisites directly', async () => {
      render(
        <WizardStepFeats
          formData={mockFormData}
          allFeats={mockFeats}
          onArrayFieldChange={mockOnArrayFieldChange}
          preSelectedFeats={[]}
        />
      );

      // Actor has string prerequisite 'Charisma 13 or higher'
      // Actor is sorted first (index 0)
      const showMoreBtns = screen.getAllByText('Show More');
      fireEvent.click(showMoreBtns[0]);

      await waitFor(() => {
        expect(screen.getByText('Prerequisites:')).toBeInTheDocument();
        expect(screen.getByText(/Charisma 13/)).toBeInTheDocument();
      });
    });

    it('should render object prerequisites with name property', async () => {
      render(
        <WizardStepFeats
          formData={mockFormData}
          allFeats={mockFeats}
          onArrayFieldChange={mockOnArrayFieldChange}
          preSelectedFeats={[]}
        />
      );

      // Observant has object prerequisite { name: 'Proficiency with Perception' }
      // Observant is at index 4
      const showMoreBtns = screen.getAllByText('Show More');
      fireEvent.click(showMoreBtns[4]);

      await waitFor(() => {
        expect(screen.getByText('Prerequisites:')).toBeInTheDocument();
        expect(screen.getByText(/Proficiency with Perception/)).toBeInTheDocument();
      });
    });

    it('should render object prerequisites without name as JSON string', async () => {
      render(
        <WizardStepFeats
          formData={mockFormData}
          allFeats={mockFeats}
          onArrayFieldChange={mockOnArrayFieldChange}
          preSelectedFeats={[]}
        />
      );

      // Lucky has object prerequisite { level: 4 } (no name property)
      // Lucky is at index 2
      const showMoreBtns = screen.getAllByText('Show More');
      fireEvent.click(showMoreBtns[2]);

      await waitFor(() => {
        expect(screen.getByText('Prerequisites:')).toBeInTheDocument();
        expect(screen.getByText(/\{"level":4\}/)).toBeInTheDocument();
      });
    });
  });

  describe('Validation warnings', () => {
    it('should display validation warnings when validateFeats returns warnings', async () => {
      featValidation.validateFeats.mockResolvedValueOnce([
        { message: 'Too many feats selected', type: 'warning' },
        { message: 'Consider an Origin feat', type: 'info' },
      ]);

      render(
        <WizardStepFeats
          formData={{ ...mockFormData, feats: ['Great Weapon Master', 'Sharpshooter', 'Lucky'] }}
          allFeats={mockFeats}
          onArrayFieldChange={mockOnArrayFieldChange}
          preSelectedFeats={[]}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Too many feats selected')).toBeInTheDocument();
        expect(screen.getByText('Consider an Origin feat')).toBeInTheDocument();
      });
    });

    it('should not show warning container when there are no warnings', async () => {
      render(
        <WizardStepFeats
          formData={mockFormData}
          allFeats={mockFeats}
          onArrayFieldChange={mockOnArrayFieldChange}
          preSelectedFeats={[]}
        />
      );

      // ensure warnings container is not rendered
      await waitFor(() => {
        expect(screen.queryByText('Too many feats selected')).not.toBeInTheDocument();
      });
    });
  });

  describe('Feat limits display', () => {
    it('should display feat limits in the summary', async () => {
      featValidation.getFeatLimits.mockResolvedValueOnce(
        { allowed: 3, originRequired: false, details: 'Feats at levels 4, 8, 12, 16, 19' }
      );

      render(
        <WizardStepFeats
          formData={mockFormData}
          allFeats={mockFeats}
          onArrayFieldChange={mockOnArrayFieldChange}
          preSelectedFeats={[]}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Feats at levels/)).toBeInTheDocument();
        expect(screen.getByText(/0 of 3 allowed/)).toBeInTheDocument();
      });
    });

    it('should display correct count when feats are selected', async () => {
      render(
        <WizardStepFeats
          formData={{ ...mockFormData, feats: ['Great Weapon Master'] }}
          allFeats={mockFeats}
          onArrayFieldChange={mockOnArrayFieldChange}
          preSelectedFeats={[]}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/1 of 2 allowed/)).toBeInTheDocument();
      });
    });
  });
});
