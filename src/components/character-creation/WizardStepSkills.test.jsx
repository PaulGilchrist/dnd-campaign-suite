// @cleaned-by-ai
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

    it('should render warnings and errors when provided', async () => {
      render(<WizardStepSkills {...baseProps} warnings={[{ type: 'warning', message: 'Warning message' }]} />);
      await waitForSkills();
      expect(screen.getByText('Warning message')).toBeInTheDocument();

      render(<WizardStepSkills {...baseProps} errors={{ skillProficiencies: 'Too many skills selected.' }} />);
      await waitForSkills();
      expect(screen.getByText('Too many skills selected.')).toBeInTheDocument();
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
  });

  describe('proficiency toggling', () => {
    it('should call onSkillToggle when toggling a skill on or off', async () => {
      const mockOnSkillToggle = vi.fn();

      // Toggle on: Stealth is not proficient
      render(<WizardStepSkills
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics'], expertSkills: [] }}
        onSkillToggle={mockOnSkillToggle}
      />);
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const stealthLabel = Array.from(labels).find(l => l.textContent.includes('Stealth'));
      const checkbox = stealthLabel.querySelector('input[type="checkbox"]');
      fireEvent.click(checkbox);
      expect(mockOnSkillToggle).toHaveBeenCalledWith('Stealth');

      mockOnSkillToggle.mockClear();

      // Toggle off: Acrobatics is proficient
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const acrobaticsCheckbox = acrobaticsLabel.querySelector('input[type="checkbox"]');
      fireEvent.click(acrobaticsCheckbox);
      expect(mockOnSkillToggle).toHaveBeenCalledWith('Acrobatics');
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

    it('should not call onSkillExpertiseToggle when elevating a non-proficient skill', async () => {
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
      fireEvent.click(button);

      expect(mockOnSkillExpertiseToggle).not.toHaveBeenCalled();
    });
  });
});
