import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepSkills from './WizardStepSkills.jsx';

// Mock dataLoader to avoid actual fetch calls and allow precise control
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSkills: vi.fn(),
}));

import { loadSkills } from '../../services/ui/dataLoader.js';

vi.mock('../../services/character/skillValidation.js', () => ({
  validateSkills: vi.fn(() => Promise.resolve([])),
  getSkillLimits: vi.fn(() => Promise.resolve({ allowed: 3, details: 'Your class and level grant 3 skills.' })),
  getExpertiseLimits: vi.fn(() => Promise.resolve({ allowed: true, count: 2, details: 'Rogues get expertise in 2 skills.' })),
}));

const defaultSkillsData = [
  { name: 'Acrobatics', ability: 'Dexterity' },
  { name: 'Stealth', ability: 'Dexterity' },
  { name: 'Perception', ability: 'Wisdom' },
];

describe('WizardStepSkills', () => {
  const baseProps = {
    formData: {
      skillProficiencies: ['Acrobatics'],
      expertSkills: [],
    },
    errors: {},
    skillLimits: { allowed: 3, details: 'Your class and level grant 3 skills.' },
    expertiseLimits: { allowed: true, count: 2, details: 'Rogues get expertise in 2 skills.' },
    preSelectedSkills: ['Stealth'],
    warnings: [],
    onSkillToggle: vi.fn(),
    onSkillExpertiseToggle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    loadSkills.mockResolvedValue(defaultSkillsData);
  });

  /* ─── Existing tests (adapted for mocked dataLoader) ─── */

  it('should render step header', () => {
    render(<WizardStepSkills {...baseProps} />);
    expect(screen.getByText('Step 6: Skill Proficiencies')).toBeInTheDocument();
  });

  it('should display skill limits info when provided', () => {
    render(<WizardStepSkills {...baseProps} />);
    expect(screen.getByText(/Rules/)).toBeInTheDocument();
    expect(screen.getByText(/Your class and level grant 3 skills/)).toBeInTheDocument();
  });

  it('should display skill count', () => {
    render(<WizardStepSkills {...baseProps} />);
    expect(screen.getByText(/You have selected 1 of 3 allowed skill proficiency/)).toBeInTheDocument();
  });

  it('should display expertise info when provided', () => {
    render(<WizardStepSkills {...baseProps} />);
    expect(screen.getByText(/Expertise:/)).toBeInTheDocument();
    expect(screen.getByText(/Rogues get expertise in 2 skills/)).toBeInTheDocument();
  });

  it('should render skill proficiencies label', () => {
    render(<WizardStepSkills {...baseProps} />);
    expect(screen.getByText('Skill Proficiencies')).toBeInTheDocument();
  });

  it('should not render warnings when none provided', () => {
    render(<WizardStepSkills {...baseProps} warnings={[]} />);
    expect(screen.queryByText(/warning/i)).not.toBeInTheDocument();
  });

  it('should render warnings when provided', () => {
    render(<WizardStepSkills {...baseProps} warnings={[{ type: 'warning', message: 'Warning message' }]} />);
    expect(screen.getByText('Warning message')).toBeInTheDocument();
  });

  it('should show proficiency error when provided', () => {
    render(<WizardStepSkills {...baseProps} errors={{ skillProficiencies: 'Too many skills selected.' }} />);
    expect(screen.getByText('Too many skills selected.')).toBeInTheDocument();
  });

  it('should handle missing formData gracefully', async () => {
    render(<WizardStepSkills {...baseProps} formData={{}} />);
    await waitFor(() => {
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBeGreaterThan(0);
    });
  });

  it('should render checkboxes for skills when loaded', async () => {
    render(<WizardStepSkills {...baseProps} />);
    await waitFor(() => {
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(3);
    });
  });

  it('should not show expertise info when expertiseLimits is null', () => {
    render(<WizardStepSkills {...baseProps} expertiseLimits={null} />);
    expect(screen.queryByText(/Expertise:/)).not.toBeInTheDocument();
  });

  /* ─── NEW TESTS ─── */

  describe('proficiency toggling', () => {
    it('should toggle skill proficiency on checkbox click', async () => {
      const mockOnSkillToggle = vi.fn();
      render(<WizardStepSkills {...baseProps} onSkillToggle={mockOnSkillToggle} />);

      await waitFor(() => {
        expect(document.querySelectorAll('.multi-select-item').length).toBe(3);
      });

      const labels = document.querySelectorAll('.multi-select-item');
      const perceptionLabel = Array.from(labels).find(l => l.textContent.includes('Perception'));
      const checkbox = perceptionLabel.querySelector('input[type="checkbox"]');
      fireEvent.click(checkbox);

      expect(mockOnSkillToggle).toHaveBeenCalledWith('Perception');
    });
  });

  describe('expertise selection', () => {
    it('should elevate proficient skill to expertise', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      const props = {
        ...baseProps,
        formData: {
          skillProficiencies: ['Acrobatics'],
          expertSkills: [],
        },
        onSkillExpertiseToggle: mockOnSkillExpertiseToggle,
      };
      render(<WizardStepSkills {...props} />);

      await waitFor(() => {
        expect(document.querySelectorAll('.multi-select-item').length).toBe(3);
      });

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const elevateButton = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(elevateButton);

      expect(mockOnSkillExpertiseToggle).toHaveBeenCalledWith('Acrobatics', true);
      expect(screen.getByText('Acrobatics is now Expert!')).toBeInTheDocument();
    });

    it('should not trigger any action when clicking disabled expertise button for non-proficient skill', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      const props = {
        ...baseProps,
        formData: {
          skillProficiencies: [],
          expertSkills: [],
        },
        onSkillExpertiseToggle: mockOnSkillExpertiseToggle,
      };
      render(<WizardStepSkills {...props} />);

      await waitFor(() => {
        expect(document.querySelectorAll('.multi-select-item').length).toBe(3);
      });

      // All skills lack proficiency, so all expertise buttons are disabled
      const labels = document.querySelectorAll('.multi-select-item');
      const perceptionLabel = Array.from(labels).find(l => l.textContent.includes('Perception'));
      const elevateButton = perceptionLabel.querySelector('.expertise-toggle-btn');
      expect(elevateButton).toBeDisabled();

      // Clicking a disabled button should not trigger the handler
      fireEvent.click(elevateButton);
      expect(mockOnSkillExpertiseToggle).not.toHaveBeenCalled();
      expect(document.querySelector('.expertise-feedback')).toBeNull();
    });

    it('should deselect expertise from expert skill', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      const props = {
        ...baseProps,
        formData: {
          skillProficiencies: ['Acrobatics', 'Stealth'],
          expertSkills: ['Acrobatics'],
        },
        onSkillExpertiseToggle: mockOnSkillExpertiseToggle,
      };
      render(<WizardStepSkills {...props} />);

      await waitFor(() => {
        expect(document.querySelectorAll('.multi-select-item').length).toBe(3);
      });

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const expertiseButton = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(expertiseButton);

      expect(mockOnSkillExpertiseToggle).toHaveBeenCalledWith('Acrobatics', false);
    });
  });

  describe('expertise display', () => {
    it('should display (Expert) label for expert skills', async () => {
      const props = {
        ...baseProps,
        formData: {
          skillProficiencies: ['Acrobatics', 'Stealth'],
          expertSkills: ['Acrobatics'],
        },
      };
      render(<WizardStepSkills {...props} />);

      await waitFor(() => {
        expect(document.querySelectorAll('.multi-select-item').length).toBe(3);
      });

      expect(screen.getByText('(Expert)')).toBeInTheDocument();
      const expertSkillSpan = screen.getByText('Acrobatics');
      expect(expertSkillSpan.className).toBe('skill-expert-label');
    });

    it('should have expertise indicator with success class for positive feedback', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      const props = {
        ...baseProps,
        formData: {
          skillProficiencies: ['Acrobatics'],
          expertSkills: [],
        },
        onSkillExpertiseToggle: mockOnSkillExpertiseToggle,
      };
      render(<WizardStepSkills {...props} />);

      await waitFor(() => {
        expect(document.querySelectorAll('.multi-select-item').length).toBe(3);
      });

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const elevateButton = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(elevateButton);

      const feedback = document.querySelector('.expertise-feedback');
      expect(feedback).toBeInTheDocument();
      expect(feedback.className).toContain('success');
      expect(feedback.textContent).toBe('Acrobatics is now Expert!');
    });

  });

  describe('expertise button states', () => {
    it('should disable expertise button for non-proficient skills', async () => {
      // Acrobatics is proficient, Stealth is not (preSelected but not in skillProficiencies)
      render(<WizardStepSkills {...baseProps} />);

      await waitFor(() => {
        expect(document.querySelectorAll('.multi-select-item').length).toBe(3);
      });

      const labels = document.querySelectorAll('.multi-select-item');

      // Stealth is NOT in skillProficiencies, so its button should be disabled
      const stealthLabel = Array.from(labels).find(l => l.textContent.includes('Stealth'));
      const stealthButton = stealthLabel.querySelector('.expertise-toggle-btn');
      expect(stealthButton).toBeDisabled();

      // Acrobatics IS in skillProficiencies, so its button should be enabled
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const acrobaticsButton = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      expect(acrobaticsButton).not.toBeDisabled();
    });

    it('should show "✓ Expert" for expert skills and "Elevate" for proficient non-expert', async () => {
      const props = {
        ...baseProps,
        formData: {
          skillProficiencies: ['Acrobatics', 'Perception'],
          expertSkills: ['Acrobatics'],
        },
      };
      render(<WizardStepSkills {...props} />);

      await waitFor(() => {
        expect(document.querySelectorAll('.multi-select-item').length).toBe(3);
      });

      const labels = document.querySelectorAll('.multi-select-item');

      const acroLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      expect(acroLabel.querySelector('.expertise-toggle-btn').textContent).toBe('✓ Expert');

      const percLabel = Array.from(labels).find(l => l.textContent.includes('Perception'));
      expect(percLabel.querySelector('.expertise-toggle-btn').textContent).toBe('Elevate');
    });
  });

  describe('pre-selected skills', () => {
    it('should disable pre-selected skill checkbox when proficient', async () => {
      const props = {
        ...baseProps,
        formData: {
          skillProficiencies: ['Stealth', 'Acrobatics'],
          expertSkills: [],
        },
        preSelectedSkills: ['Stealth'],
      };
      render(<WizardStepSkills {...props} />);

      await waitFor(() => {
        expect(document.querySelectorAll('.multi-select-item').length).toBe(3);
      });

      const labels = document.querySelectorAll('.multi-select-item');
      const stealthLabel = Array.from(labels).find(l => l.textContent.includes('Stealth'));
      const stealthCheckbox = stealthLabel.querySelector('input[type="checkbox"]');
      expect(stealthCheckbox).toBeDisabled();
    });

    it('should apply pre-selected CSS class', async () => {
      render(<WizardStepSkills {...baseProps} />);

      await waitFor(() => {
        expect(document.querySelectorAll('.multi-select-item').length).toBe(3);
      });

      const preSelectedLabel = document.querySelector('.multi-select-item.pre-selected');
      expect(preSelectedLabel).toBeInTheDocument();
      expect(preSelectedLabel.textContent).toContain('Stealth');
    });
  });

  describe('edge cases', () => {
    it('should hide skill limits when skillLimits is null', () => {
      render(<WizardStepSkills {...baseProps} skillLimits={null} />);
      expect(screen.queryByText(/Your class and level grant 3 skills/)).not.toBeInTheDocument();
      expect(screen.queryByText(/You have selected/)).not.toBeInTheDocument();
    });

    it('should not show expertise section when expertiseLimits.allowed is false', () => {
      render(
        <WizardStepSkills
          {...baseProps}
          expertiseLimits={{ allowed: false, count: 0, details: 'No expertise available.' }}
        />
      );
      expect(screen.queryByText(/Expertise:/)).not.toBeInTheDocument();
    });

    it('should handle null preSelectedSkills without error', async () => {
      render(<WizardStepSkills {...baseProps} preSelectedSkills={null} />);
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(3);
      });
      expect(document.querySelector('.pre-selected')).toBeNull();
    });

    it('should handle empty skills data from loader', async () => {
      loadSkills.mockResolvedValue([]);
      render(<WizardStepSkills {...baseProps} />);
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(0);
      });
    });

    it('should handle zero skills result gracefully (simulating load failure)', async () => {
      // The real loadSkills catches errors internally and returns an empty array,
      // so we mock resolution with an empty array to simulate that fallback
      loadSkills.mockResolvedValue([]);
      render(<WizardStepSkills {...baseProps} />);

      await waitFor(() => {
        expect(document.querySelectorAll('input[type="checkbox"]').length).toBe(0);
      });

      // Component still renders header and other static content
      expect(screen.getByText('Step 6: Skill Proficiencies')).toBeInTheDocument();
      expect(screen.getByText(/Rules/)).toBeInTheDocument();
    });

    it('should not set selected class for non-proficient skills', async () => {
      render(<WizardStepSkills {...baseProps} />);

      await waitFor(() => {
        expect(document.querySelectorAll('.multi-select-item').length).toBe(3);
      });

      const labels = document.querySelectorAll('.multi-select-item');
      const stealthLabel = Array.from(labels).find(l => l.textContent.includes('Stealth'));
      // Stealth is preSelected but NOT in skillProficiencies, so no 'selected' class
      const stealthClasses = stealthLabel.className.split(' ').filter(c => c.length > 0);
      expect(stealthClasses).not.toContain('selected');
      // But should have 'pre-selected' class
      expect(stealthClasses).toContain('pre-selected');
    });

    it('should render each skill name from the loaded data', async () => {
      render(<WizardStepSkills {...baseProps} />);

      await waitFor(() => {
        expect(screen.getByText('Acrobatics')).toBeInTheDocument();
      });
      expect(screen.getByText('Stealth')).toBeInTheDocument();
      expect(screen.getByText('Perception')).toBeInTheDocument();
    });
  });
});
