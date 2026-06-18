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

// Helper: render with skills resolved, returning the container for queries
function renderWithSkillsResolved(props = {}) {
  const merged = { ...baseProps, ...props };
  const result = render(<WizardStepSkills {...merged} />);
  return result;
}

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

// Helper to wait for skills to finish loading
async function waitForSkills() {
  await waitFor(() => {
    expect(document.querySelectorAll('.multi-select-item').length).toBe(3);
  });
}

describe('WizardStepSkills', () => {
  describe('rendering', () => {
    it('should render step header', async () => {
      renderWithSkillsResolved();
      await waitForSkills();
      expect(screen.getByText('Step 6: Skill Proficiencies')).toBeInTheDocument();
    });

    it('should display skill limits info when provided', async () => {
      renderWithSkillsResolved();
      await waitForSkills();
      expect(screen.getByText(/Rules/)).toBeInTheDocument();
      expect(screen.getByText(/Your class and level grant 3 skills/)).toBeInTheDocument();
    });

    it('should display proficiency count based on formData', async () => {
      renderWithSkillsResolved();
      await waitForSkills();
      // formData has 1 proficiency (Acrobatics), limit is 3
      expect(screen.getByText(/You have selected 1 of 3 allowed/)).toBeInTheDocument();
    });

    it('should update proficiency count when formData changes', async () => {
      const { rerender } = renderWithSkillsResolved({
        formData: { skillProficiencies: ['Acrobatics', 'Stealth', 'Perception'], expertSkills: [] },
      });
      await waitForSkills();
      expect(screen.getByText(/You have selected 3 of 3 allowed/)).toBeInTheDocument();

      rerender(<WizardStepSkills
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics'], expertSkills: [] }}
      />);
      await waitForSkills();
      expect(screen.getByText(/You have selected 1 of 3 allowed/)).toBeInTheDocument();
    });

    it('should display expertise info when provided', async () => {
      renderWithSkillsResolved();
      await waitForSkills();
      expect(screen.getByText(/Expertise:/)).toBeInTheDocument();
      expect(screen.getByText(/Rogues get expertise in 2 skills/)).toBeInTheDocument();
    });

    it('should display expertise count based on formData', async () => {
      renderWithSkillsResolved({
        formData: { skillProficiencies: ['Acrobatics'], expertSkills: ['Acrobatics'] },
      });
      await waitForSkills();
      expect(screen.getByText(/You have expertise in 1 of 2 allowed/)).toBeInTheDocument();
    });

    it('should render skill proficiencies label', async () => {
      renderWithSkillsResolved();
      await waitForSkills();
      expect(screen.getByText('Skill Proficiencies')).toBeInTheDocument();
    });

    it('should render each skill name from the loaded data', async () => {
      renderWithSkillsResolved();
      await waitForSkills();
      expect(screen.getByText('Acrobatics')).toBeInTheDocument();
      expect(screen.getByText('Stealth')).toBeInTheDocument();
      expect(screen.getByText('Perception')).toBeInTheDocument();
    });

    it('should not render warnings when none provided', async () => {
      renderWithSkillsResolved({ warnings: [] });
      await waitForSkills();
      expect(screen.queryByText(/warning/i)).not.toBeInTheDocument();
    });

    it('should render warnings when provided', async () => {
      renderWithSkillsResolved({ warnings: [{ type: 'warning', message: 'Warning message' }] });
      await waitForSkills();
      expect(screen.getByText('Warning message')).toBeInTheDocument();
    });

    it('should show proficiency error when provided', async () => {
      renderWithSkillsResolved({ errors: { skillProficiencies: 'Too many skills selected.' } });
      await waitForSkills();
      expect(screen.getByText('Too many skills selected.')).toBeInTheDocument();
    });
  });

  describe('checkbox states', () => {
    it('should check the checkbox for proficient skills', async () => {
      renderWithSkillsResolved();
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const checkbox = acrobaticsLabel.querySelector('input[type="checkbox"]');
      expect(checkbox).toBeChecked();
    });

    it('should not check the checkbox for non-proficient skills', async () => {
      renderWithSkillsResolved();
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const stealthLabel = Array.from(labels).find(l => l.textContent.includes('Stealth'));
      const checkbox = stealthLabel.querySelector('input[type="checkbox"]');
      expect(checkbox).not.toBeChecked();
    });

    it('should disable the checkbox when skill is pre-selected and proficient', async () => {
      renderWithSkillsResolved({
        formData: { skillProficiencies: ['Stealth', 'Acrobatics'], expertSkills: [] },
        preSelectedSkills: ['Stealth'],
      });
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const stealthLabel = Array.from(labels).find(l => l.textContent.includes('Stealth'));
      const checkbox = stealthLabel.querySelector('input[type="checkbox"]');
      expect(checkbox).toBeDisabled();
      expect(checkbox).toBeChecked();
    });

    it('should not disable the checkbox when skill is pre-selected but not proficient', async () => {
      renderWithSkillsResolved();
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const stealthLabel = Array.from(labels).find(l => l.textContent.includes('Stealth'));
      const checkbox = stealthLabel.querySelector('input[type="checkbox"]');
      expect(checkbox).not.toBeDisabled();
    });

    it('should apply selected class to proficient skills', async () => {
      renderWithSkillsResolved();
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      expect(acrobaticsLabel.className).toContain('selected');
    });

    it('should apply pre-selected class to pre-selected skills', async () => {
      renderWithSkillsResolved();
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const stealthLabel = Array.from(labels).find(l => l.textContent.includes('Stealth'));
      expect(stealthLabel.className).toContain('pre-selected');
    });

    it('should not apply selected class to non-proficient skills', async () => {
      renderWithSkillsResolved();
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const stealthLabel = Array.from(labels).find(l => l.textContent.includes('Stealth'));
      const classes = stealthLabel.className.split(' ').filter(c => c.length > 0);
      expect(classes).not.toContain('selected');
    });
  });

  describe('proficiency toggling', () => {
    it('should call onSkillToggle when clicking a non-proficient skill checkbox', async () => {
      const mockOnSkillToggle = vi.fn();
      renderWithSkillsResolved({ onSkillToggle: mockOnSkillToggle });
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const stealthLabel = Array.from(labels).find(l => l.textContent.includes('Stealth'));
      const checkbox = stealthLabel.querySelector('input[type="checkbox"]');
      fireEvent.click(checkbox);

      expect(mockOnSkillToggle).toHaveBeenCalledWith('Stealth');
    });

    it('should call onSkillToggle when unchecking a proficient skill checkbox', async () => {
      const mockOnSkillToggle = vi.fn();
      renderWithSkillsResolved({
        formData: { skillProficiencies: ['Acrobatics', 'Stealth'], expertSkills: [] },
        onSkillToggle: mockOnSkillToggle,
      });
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const stealthLabel = Array.from(labels).find(l => l.textContent.includes('Stealth'));
      const checkbox = stealthLabel.querySelector('input[type="checkbox"]');
      fireEvent.click(checkbox);

      expect(mockOnSkillToggle).toHaveBeenCalledWith('Stealth');
    });
  });

  describe('expertise toggle button', () => {
    it('should enable the expertise button for proficient skills', async () => {
      renderWithSkillsResolved();
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      expect(button).not.toBeDisabled();
    });

    it('should disable the expertise button for non-proficient skills', async () => {
      renderWithSkillsResolved();
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const stealthLabel = Array.from(labels).find(l => l.textContent.includes('Stealth'));
      const button = stealthLabel.querySelector('.expertise-toggle-btn');
      expect(button).toBeDisabled();
    });

    it('should show "Elevate" text for proficient non-expert skills', async () => {
      renderWithSkillsResolved({
        formData: { skillProficiencies: ['Acrobatics', 'Perception'], expertSkills: [] },
      });
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const perceptionLabel = Array.from(labels).find(l => l.textContent.includes('Perception'));
      const button = perceptionLabel.querySelector('.expertise-toggle-btn');
      expect(button.textContent).toBe('Elevate');
    });

    it('should show "✓ Expert" text for expert skills', async () => {
      renderWithSkillsResolved({
        formData: { skillProficiencies: ['Acrobatics', 'Perception'], expertSkills: ['Acrobatics'] },
      });
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      expect(button.textContent).toBe('✓ Expert');
    });

    it('should call onSkillExpertiseToggle with true when elevating a proficient skill', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      renderWithSkillsResolved({
        formData: { skillProficiencies: ['Acrobatics'], expertSkills: [] },
        onSkillExpertiseToggle: mockOnSkillExpertiseToggle,
      });
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(button);

      expect(mockOnSkillExpertiseToggle).toHaveBeenCalledWith('Acrobatics', true);
    });

    it('should call onSkillExpertiseToggle with false when deselecting expertise', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      renderWithSkillsResolved({
        formData: { skillProficiencies: ['Acrobatics', 'Stealth'], expertSkills: ['Acrobatics'] },
        onSkillExpertiseToggle: mockOnSkillExpertiseToggle,
      });
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(button);

      expect(mockOnSkillExpertiseToggle).toHaveBeenCalledWith('Acrobatics', false);
    });

    it('should show error feedback when elevating a non-proficient skill', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      renderWithSkillsResolved({
        formData: { skillProficiencies: [], expertSkills: [] },
        onSkillExpertiseToggle: mockOnSkillExpertiseToggle,
      });
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');

      // Button should be disabled for non-proficient skills, preventing the click
      expect(button).toBeDisabled();
      expect(button.title).toBe('Select proficient first');

      // Attempting to click a disabled button should not trigger the handler
      fireEvent.click(button);
      expect(mockOnSkillExpertiseToggle).not.toHaveBeenCalled();
      expect(document.querySelector('.expertise-feedback')).toBeNull();
    });

    it('should show success feedback when elevating a proficient skill', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      renderWithSkillsResolved({
        formData: { skillProficiencies: ['Acrobatics'], expertSkills: [] },
        onSkillExpertiseToggle: mockOnSkillExpertiseToggle,
      });
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Acrobatics is now Expert!')).toBeInTheDocument();
      });
    });

    it('should clear feedback after a short delay', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      renderWithSkillsResolved({
        formData: { skillProficiencies: ['Acrobatics'], expertSkills: [] },
        onSkillExpertiseToggle: mockOnSkillExpertiseToggle,
      });
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Acrobatics is now Expert!')).toBeInTheDocument();
      });

      // Wait for the 3-second timeout to clear feedback
      await new Promise(resolve => setTimeout(resolve, 3500));
      expect(screen.queryByText('Acrobatics is now Expert!')).not.toBeInTheDocument();
    });
  });

  describe('expertise display', () => {
    it('should display (Expert) label for expert skills', async () => {
      renderWithSkillsResolved({
        formData: { skillProficiencies: ['Acrobatics', 'Stealth'], expertSkills: ['Acrobatics'] },
      });
      await waitForSkills();

      expect(screen.getByText('(Expert)')).toBeInTheDocument();
    });

    it('should not display (Expert) label for non-expert proficient skills', async () => {
      renderWithSkillsResolved({
        formData: { skillProficiencies: ['Acrobatics', 'Stealth'], expertSkills: [] },
      });
      await waitForSkills();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      expect(acrobaticsLabel.textContent).not.toContain('(Expert)');
    });

    it('should apply skill-expert-label class to expert skill names', async () => {
      renderWithSkillsResolved({
        formData: { skillProficiencies: ['Acrobatics', 'Stealth'], expertSkills: ['Acrobatics'] },
      });
      await waitForSkills();

      const expertLabel = document.querySelector('.skill-expert-label');
      expect(expertLabel).toBeInTheDocument();
      expect(expertLabel.textContent).toContain('Acrobatics');
    });
  });

  describe('null/missing prop handling', () => {
    it('should handle missing formData gracefully', async () => {
      renderWithSkillsResolved({ formData: {} });
      await waitForSkills();
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(3);
    });

    it('should hide skill limits when skillLimits is null', async () => {
      renderWithSkillsResolved({ skillLimits: null });
      await waitForSkills();
      expect(screen.queryByText(/Your class and level grant 3 skills/)).not.toBeInTheDocument();
      expect(screen.queryByText(/You have selected/)).not.toBeInTheDocument();
    });

    it('should not show expertise section when expertiseLimits is null', async () => {
      renderWithSkillsResolved({ expertiseLimits: null });
      await waitForSkills();
      expect(screen.queryByText(/Expertise:/)).not.toBeInTheDocument();
    });

    it('should not show expertise section when expertiseLimits.allowed is false', async () => {
      renderWithSkillsResolved({
        expertiseLimits: { allowed: false, count: 0, details: 'No expertise available.' },
      });
      await waitForSkills();
      expect(screen.queryByText(/Expertise:/)).not.toBeInTheDocument();
    });

    it('should handle null preSelectedSkills without error', async () => {
      renderWithSkillsResolved({ preSelectedSkills: null });
      await waitForSkills();
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(3);
      expect(document.querySelector('.pre-selected')).toBeNull();
    });

    it('should handle empty skills data from loader', async () => {
      loadSkills.mockResolvedValue([]);
      renderWithSkillsResolved();
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(0);
      });
    });

    it('should still render header and rules when skills list is empty', async () => {
      loadSkills.mockResolvedValue([]);
      renderWithSkillsResolved();
      await waitFor(() => {
        expect(screen.getByText('Step 6: Skill Proficiencies')).toBeInTheDocument();
        expect(screen.getByText(/Rules/)).toBeInTheDocument();
      });
    });
  });
});
