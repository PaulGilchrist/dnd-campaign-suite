// @improved-by-ai
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

async function waitForSkills() {
  await waitFor(() => {
    expect(document.querySelectorAll('.multi-select-item').length).toBe(3);
  });
}

describe('WizardStepSkills', () => {
  describe('rendering', () => {
    it('should render step header, rules, and skill list', async () => {
      render(<WizardStepSkills {...baseProps} />);
      await waitForSkills();
      expect(screen.getByText('Step 6: Skill Proficiencies')).toBeInTheDocument();
      expect(screen.getByText(/Your class and level grant 3 skills/)).toBeInTheDocument();
      expect(screen.getByText('Acrobatics')).toBeInTheDocument();
      expect(screen.getByText('Stealth')).toBeInTheDocument();
      expect(screen.getByText('Perception')).toBeInTheDocument();
    });

    it('should display proficiency and expertise counts based on formData', async () => {
      render(<WizardStepSkills {...baseProps} />);
      await waitForSkills();
      expect(screen.getByText(/You have selected 1 of 3 allowed/)).toBeInTheDocument();
      expect(screen.getByText(/Expertise:/)).toBeInTheDocument();
      expect(screen.getByText(/Rogues get expertise in 2 skills/)).toBeInTheDocument();
    });

    it('should display expertise count based on formData', async () => {
      render(<WizardStepSkills
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics'], expertSkills: ['Acrobatics'] }}
      />);
      await waitForSkills();
      expect(screen.getByText(/You have expertise in 1 of 2 allowed/)).toBeInTheDocument();
    });

    it('should update proficiency count when formData changes', async () => {
      const { rerender } = render(<WizardStepSkills
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics', 'Stealth', 'Perception'], expertSkills: [] }}
      />);
      await waitForSkills();
      expect(screen.getByText(/You have selected 3 of 3 allowed/)).toBeInTheDocument();

      rerender(<WizardStepSkills
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics'], expertSkills: [] }}
      />);
      await waitForSkills();
      expect(screen.getByText(/You have selected 1 of 3 allowed/)).toBeInTheDocument();
    });

    it('should render warnings and errors when provided', async () => {
      render(<WizardStepSkills {...baseProps} warnings={[{ type: 'warning', message: 'Warning message' }]} />);
      await waitForSkills();
      expect(screen.getByText('Warning message')).toBeInTheDocument();

      render(<WizardStepSkills {...baseProps} errors={{ skillProficiencies: 'Too many skills selected.' }} />);
      await waitForSkills();
      expect(screen.getByText('Too many skills selected.')).toBeInTheDocument();
    });
  });

  describe('checkbox states', () => {
    it.each`
      proficient  | preSelected | expectedChecked | expectedDisabled
      ${true}     | ${true}     | ${true}         | ${true}
      ${true}     | ${false}    | ${true}         | ${false}
      ${false}    | ${true}     | ${false}        | ${false}
      ${false}    | ${false}    | ${false}        | ${false}
    `('checkbox checked=$expectedChecked disabled=$expectedDisabled when proficient=$proficient preSelected=$preSelected',
      async ({ proficient, preSelected, expectedChecked, expectedDisabled }) => {
        const proficiencyList = proficient ? ['Acrobatics'] : [];
        const preSelectedList = preSelected ? ['Acrobatics'] : [];

        render(<WizardStepSkills
          {...baseProps}
          formData={{ skillProficiencies: proficiencyList, expertSkills: [] }}
          preSelectedSkills={preSelectedList}
        />);
        await waitForSkills();

        const labels = document.querySelectorAll('.multi-select-item');
        const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
        const checkbox = acrobaticsLabel.querySelector('input[type="checkbox"]');
        expect(checkbox.checked).toBe(expectedChecked);
        expect(checkbox.disabled).toBe(expectedDisabled);
      });
  });

  describe('proficiency toggling', () => {
    it('should call onSkillToggle when toggling a skill', async () => {
      const proficiencyList = ['Acrobatics'];
      const mockOnSkillToggle = vi.fn();

      render(<WizardStepSkills
        {...baseProps}
        formData={{ skillProficiencies: proficiencyList, expertSkills: [] }}
        onSkillToggle={mockOnSkillToggle}
      />);
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const stealthLabel = Array.from(labels).find(l => l.textContent.includes('Stealth'));
      const checkbox = stealthLabel.querySelector('input[type="checkbox"]');
      fireEvent.click(checkbox);

      expect(mockOnSkillToggle).toHaveBeenCalledWith('Stealth');
    });

    it('should call onSkillToggle when unchecking a proficient skill', async () => {
      const mockOnSkillToggle = vi.fn();
      render(<WizardStepSkills
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics', 'Stealth'], expertSkills: [] }}
        onSkillToggle={mockOnSkillToggle}
      />);
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const checkbox = acrobaticsLabel.querySelector('input[type="checkbox"]');
      fireEvent.click(checkbox);

      expect(mockOnSkillToggle).toHaveBeenCalledWith('Acrobatics');
    });
  });

  describe('expertise toggle button', () => {
    it.each`
      proficient  | expert    | expectedDisabled | buttonText
      ${true}     | ${false}  | ${false}         | ${'Elevate'}
      ${true}     | ${true}   | ${false}         | ${'\u2713 Expert'}
      ${false}    | ${false}  | ${true}          | ${'Elevate'}
    `('button disabled=$expectedDisabled text="$buttonText" when proficient=$proficient expert=$expert',
      async ({ proficient, expert, expectedDisabled, buttonText }) => {
        const proficiencyList = proficient ? ['Acrobatics'] : [];
        const expertList = expert ? ['Acrobatics'] : [];

        render(<WizardStepSkills
          {...baseProps}
          formData={{ skillProficiencies: proficiencyList, expertSkills: expertList }}
        />);
        await waitForSkills();

        const labels = document.querySelectorAll('.multi-select-item');
        const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
        const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
        expect(button.disabled).toBe(expectedDisabled);
        expect(button.textContent).toBe(buttonText);
      });
  });

  describe('expertise toggle action', () => {
    it('should call onSkillExpertiseToggle with true when elevating a proficient skill', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      render(<WizardStepSkills
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics'], expertSkills: [] }}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
      />);
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(button);

      expect(mockOnSkillExpertiseToggle).toHaveBeenCalledWith('Acrobatics', true);
    });

    it('should call onSkillExpertiseToggle with false when deselecting expertise', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      render(<WizardStepSkills
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics', 'Stealth'], expertSkills: ['Acrobatics'] }}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
      />);
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(button);

      expect(mockOnSkillExpertiseToggle).toHaveBeenCalledWith('Acrobatics', false);
    });

    it('should show error feedback when elevating a non-proficient skill', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      render(<WizardStepSkills
        {...baseProps}
        formData={{ skillProficiencies: [], expertSkills: [] }}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
      />);
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');

      expect(button).toBeDisabled();
      expect(button.title).toBe('Select proficient first');
      fireEvent.click(button);
      expect(mockOnSkillExpertiseToggle).not.toHaveBeenCalled();
    });

    it('should show success feedback when elevating a proficient skill', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      render(<WizardStepSkills
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics'], expertSkills: [] }}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
      />);
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Acrobatics is now Expert!')).toBeInTheDocument();
      });
    });
  });

  describe('expertise display', () => {
    it('should display (Expert) label for expert skills', async () => {
      render(<WizardStepSkills
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics', 'Stealth'], expertSkills: ['Acrobatics'] }}
      />);
      await waitForSkills();
      expect(screen.getByText('(Expert)')).toBeInTheDocument();
    });

    it('should not display (Expert) label for non-expert proficient skills', async () => {
      render(<WizardStepSkills
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics', 'Stealth'], expertSkills: [] }}
      />);
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      expect(acrobaticsLabel.textContent).not.toContain('(Expert)');
    });
  });

  describe('null/missing prop handling', () => {
    it('should handle missing formData gracefully', async () => {
      render(<WizardStepSkills {...baseProps} formData={{}} />);
      await waitForSkills();
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(3);
    });

    it('should hide skill limits when skillLimits is null', async () => {
      render(<WizardStepSkills {...baseProps} skillLimits={null} />);
      await waitForSkills();
      expect(screen.queryByText(/Your class and level grant 3 skills/)).not.toBeInTheDocument();
      expect(screen.queryByText(/You have selected/)).not.toBeInTheDocument();
    });

    it('should not show expertise section when expertiseLimits is null or allowed is false', async () => {
      render(<WizardStepSkills {...baseProps} expertiseLimits={null} />);
      await waitForSkills();
      expect(screen.queryByText(/Expertise:/)).not.toBeInTheDocument();

      render(<WizardStepSkills
        {...baseProps}
        expertiseLimits={{ allowed: false, count: 0, details: 'No expertise available.' }}
      />);
      await waitForSkills();
      expect(screen.queryByText(/Expertise:/)).not.toBeInTheDocument();
    });

    it('should handle null preSelectedSkills without error', async () => {
      render(<WizardStepSkills {...baseProps} preSelectedSkills={null} />);
      await waitForSkills();
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(3);
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
  });
});
