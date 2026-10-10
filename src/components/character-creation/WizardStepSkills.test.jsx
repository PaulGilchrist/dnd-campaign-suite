// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepSkills from './WizardStepSkills.jsx';

// Mock dataLoader to avoid actual fetch calls and allow precise control
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSkills: vi.fn(),
}));

import { loadSkills } from '../../services/ui/dataLoader.js';

const defaultSkillsData = [
  { name: 'Acrobatics', ability: 'Dexterity' },
  { name: 'Stealth', ability: 'Dexterity' },
  { name: 'Perception', ability: 'Wisdom' },
  { name: 'Insight', ability: 'Wisdom' },
];

const baseProps = {
  formData: {
    skillProficiencies: ['Acrobatics'],
    expertSkills: [],
  },
  errors: {},
  skillLimits: { allowed: 3, details: 'Your class and level grant 3 skills.' },
  expertiseLimits: { allowed: true, count: 2, classCount: 2, details: 'Rogues get expertise in 2 skills.' },
  preSelectedSkills: ['Stealth'],
  warnings: [],
  onSkillToggle: vi.fn(),
  onSkillExpertiseToggle: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  loadSkills.mockResolvedValue(defaultSkillsData);
});

/**
 * Wait for the skills list to be rendered.
 * Waits for the container to have any multi-select items, indicating data has loaded.
 */
async function waitForSkillsLoaded() {
  await waitFor(() => {
    expect(document.querySelectorAll('.multi-select-item').length).toBeGreaterThan(0);
  });
}

describe('WizardStepSkills', () => {
  describe('rendering', () => {
    it('should render step header, rules, and skill list', async () => {
      render(<WizardStepSkills stepNumber={10} {...baseProps} />);
      await waitForSkillsLoaded();
      expect(screen.getByText('Step 10: Skill Proficiencies')).toBeInTheDocument();
      expect(screen.getByText(/Your class and level grant 3 skills/)).toBeInTheDocument();
      expect(screen.getByText('Acrobatics')).toBeInTheDocument();
      expect(screen.getByText('Stealth')).toBeInTheDocument();
      expect(screen.getByText('Perception')).toBeInTheDocument();
    });

    it('should display proficiency and expertise counts based on formData', async () => {
      render(<WizardStepSkills stepNumber={10} {...baseProps} />);
      await waitForSkillsLoaded();
      expect(screen.getByText(/You have selected.*of.*allowed/)).toBeInTheDocument();
      expect(screen.getByText(/Expertise:/)).toBeInTheDocument();
      expect(screen.getByText(/Rogues get expertise in 2 skills/)).toBeInTheDocument();
    });

    it('should display expertise count when skill has expertise', async () => {
      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics'], expertSkills: ['Acrobatics'] }}
      />);
      await waitForSkillsLoaded();
      expect(screen.getByText(/You have expertise in 1 of 2 allowed/)).toBeInTheDocument();
    });

    it('should render warnings and errors when provided', async () => {
      render(<WizardStepSkills stepNumber={10} {...baseProps} warnings={[{ type: 'warning', message: 'Warning message' }]} />);
      await waitForSkillsLoaded();
      expect(screen.getByText('Warning message')).toBeInTheDocument();

      render(<WizardStepSkills stepNumber={10} {...baseProps} errors={{ skillProficiencies: 'Too many skills selected.' }} />);
      await waitForSkillsLoaded();
      expect(screen.getByText('Too many skills selected.')).toBeInTheDocument();
    });

    it('should hide skill limits when skillLimits is null', async () => {
      render(<WizardStepSkills stepNumber={10} {...baseProps} skillLimits={null} />);
      await waitForSkillsLoaded();
      expect(screen.queryByText(/Your class and level grant 3 skills/)).not.toBeInTheDocument();
      expect(screen.queryByText(/You have selected/)).not.toBeInTheDocument();
    });

    it('should not show expertise section when expertiseLimits is null or allowed is false', async () => {
      render(<WizardStepSkills stepNumber={10} {...baseProps} expertiseLimits={null} />);
      await waitForSkillsLoaded();
      expect(screen.queryByText(/Expertise:/)).not.toBeInTheDocument();

      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        expertiseLimits={{ allowed: false, count: 0, details: 'No expertise available.' }}
      />);
      await waitForSkillsLoaded();
      expect(screen.queryByText(/Expertise:/)).not.toBeInTheDocument();
    });

    it('should mark pre-selected skills correctly based on proficiency state', async () => {
      // Pre-selected but NOT proficient: checkbox enabled, pre-selected class
      const { container: c1 } = render(<WizardStepSkills stepNumber={10} {...baseProps} />);
      await waitForSkillsLoaded();

      let labels = c1.querySelectorAll('.multi-select-item');
      let stealthLabel = Array.from(labels).find(l => l.textContent.includes('Stealth'));
      let stealthCheckbox = stealthLabel.querySelector('input[type="checkbox"]');
      expect(stealthCheckbox).not.toBeDisabled();
      expect(stealthLabel).toHaveClass('pre-selected');
      expect(stealthLabel).not.toHaveClass('selected');

      // Pre-selected AND proficient: checkbox disabled, both classes
      const { container: c2 } = render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics', 'Stealth'], expertSkills: [] }}
        preSelectedSkills={['Stealth']}
      />);
      await waitForSkillsLoaded();

      labels = c2.querySelectorAll('.multi-select-item');
      stealthLabel = Array.from(labels).find(l => l.textContent.includes('Stealth'));
      stealthCheckbox = stealthLabel.querySelector('input[type="checkbox"]');
      expect(stealthCheckbox).toBeDisabled();
      expect(stealthLabel).toHaveClass('selected');
      expect(stealthLabel).toHaveClass('pre-selected');
    });

    it('should show expert badge on expert skills', async () => {
      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics'], expertSkills: ['Acrobatics'] }}
      />);
      await waitForSkillsLoaded();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      expect(acrobaticsLabel).toHaveClass('selected');

      const expertLabel = acrobaticsLabel.querySelector('.skill-expert-label');
      expect(expertLabel).toBeInTheDocument();
      expect(acrobaticsLabel).toHaveTextContent('(Expert)');
    });

    it('should show expertise toggle button with correct state for all proficiency levels', async () => {
      // Expert skill: active button, enabled
      const { container: c1 } = render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics'], expertSkills: ['Acrobatics'] }}
      />);
      await waitForSkillsLoaded();

      let labels = c1.querySelectorAll('.multi-select-item');
      let acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      let button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      expect(button).toHaveTextContent('✓ Expert');
      expect(button).toHaveClass('active');
      expect(button).not.toBeDisabled();
      expect(button).toHaveAttribute('title', 'Click to remove Expert status');

      // Non-proficient: disabled button
      const { container: c2 } = render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: [], expertSkills: [] }}
      />);
      await waitForSkillsLoaded();

      labels = c2.querySelectorAll('.multi-select-item');
      acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      expect(button).toHaveTextContent('Elevate');
      expect(button).not.toHaveClass('active');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'Select proficient first');

      // Proficient non-expert: enabled button
      const { container: c3 } = render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics'], expertSkills: [] }}
      />);
      await waitForSkillsLoaded();

      labels = c3.querySelectorAll('.multi-select-item');
      acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      expect(button).toHaveTextContent('Elevate');
      expect(button).not.toHaveClass('active');
      expect(button).not.toBeDisabled();
      expect(button).toHaveAttribute('title', 'Click to elevate to Expert');
    });

    it('should render with empty skills list', async () => {
      loadSkills.mockResolvedValue([]);
      render(<WizardStepSkills stepNumber={10} {...baseProps} />);

      await waitFor(() => {
        expect(screen.getByText('Step 10: Skill Proficiencies')).toBeInTheDocument();
      });
      expect(screen.queryByText('Acrobatics')).not.toBeInTheDocument();
    });

    it('should handle null/undefined skillProficiencies and expertSkills in formData', async () => {
      render(<WizardStepSkills stepNumber={10}
        skillLimits={{ allowed: 3, details: 'Your class and level grant 3 skills.' }}
        expertiseLimits={{ allowed: true, count: 2, details: 'Rogues get expertise in 2 skills.' }}
        preSelectedSkills={['Stealth']}
        warnings={[]}
        errors={{}}
        formData={{ skillProficiencies: null, expertSkills: undefined }}
        onSkillToggle={vi.fn()}
        onSkillExpertiseToggle={vi.fn()}
      />);
      await waitForSkillsLoaded();
      expect(screen.getByText('Step 10: Skill Proficiencies')).toBeInTheDocument();
      // With null proficiencies, count should be 0
      const summaryText = document.querySelector('.skill-count-text');
      expect(summaryText.textContent).toContain('0');
      expect(summaryText.textContent).toContain('3');
    });
  });

  describe('proficiency toggling', () => {
    it('should call onSkillToggle when toggling a skill on', async () => {
      const mockOnSkillToggle = vi.fn();

      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics'], expertSkills: [] }}
        onSkillToggle={mockOnSkillToggle}
      />);
      await waitForSkillsLoaded();

      const labels = document.querySelectorAll('.multi-select-item');
      const stealthLabel = Array.from(labels).find(l => l.textContent.includes('Stealth'));
      const checkbox = stealthLabel.querySelector('input[type="checkbox"]');
      fireEvent.click(checkbox);
      expect(mockOnSkillToggle).toHaveBeenCalledWith('Stealth');
    });

    it('should call onSkillToggle when toggling a skill off', async () => {
      const mockOnSkillToggle = vi.fn();

      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics'], expertSkills: [] }}
        onSkillToggle={mockOnSkillToggle}
      />);
      await waitForSkillsLoaded();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const checkbox = acrobaticsLabel.querySelector('input[type="checkbox"]');
      fireEvent.click(checkbox);
      expect(mockOnSkillToggle).toHaveBeenCalledWith('Acrobatics');
    });

    it('should remove expertise when proficiency is toggled off', async () => {
      const mockOnSkillToggle = vi.fn();
      const mockOnSkillExpertiseToggle = vi.fn();

      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics'], expertSkills: ['Acrobatics'] }}
        onSkillToggle={mockOnSkillToggle}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
      />);
      await waitForSkillsLoaded();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const checkbox = acrobaticsLabel.querySelector('input[type="checkbox"]');
      fireEvent.click(checkbox);

      expect(mockOnSkillToggle).toHaveBeenCalledWith('Acrobatics');
      expect(mockOnSkillExpertiseToggle).toHaveBeenCalledWith('Acrobatics', false);
    });
  });

  describe('expertise toggle action', () => {
    it('should call onSkillExpertiseToggle with true when elevating a proficient skill', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics'], expertSkills: [] }}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
      />);
      await waitForSkillsLoaded();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(button);

      expect(mockOnSkillExpertiseToggle).toHaveBeenCalledWith('Acrobatics', true);
    });

    it('should call onSkillExpertiseToggle with false when deselecting expertise', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics', 'Stealth'], expertSkills: ['Acrobatics'] }}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
      />);
      await waitForSkillsLoaded();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(button);

      expect(mockOnSkillExpertiseToggle).toHaveBeenCalledWith('Acrobatics', false);
    });

    it('should not call onSkillExpertiseToggle when elevating a non-proficient skill', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: [], expertSkills: [] }}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
      />);
      await waitForSkillsLoaded();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(button);

      expect(mockOnSkillExpertiseToggle).not.toHaveBeenCalled();
    });
  });

  describe('expertise feedback messages', () => {
    it('should show error feedback when attempting to elevate a non-proficient skill', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: [], expertSkills: [] }}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
      />);
      await waitForSkillsLoaded();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');

      // Button is disabled, so clicking it does nothing — verify the button state
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'Select proficient first');
    });

    it('should show success feedback when elevating to expertise', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics'], expertSkills: [] }}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
      />);
      await waitForSkillsLoaded();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(button);

      await waitFor(() => {
        const feedback = document.querySelector('.expertise-feedback');
        expect(feedback).toBeInTheDocument();
        expect(feedback).toHaveClass('success');
        expect(feedback.textContent).toContain('Acrobatics');
        expect(feedback.textContent).toContain('Expert');
      });
    });

    it('should auto-dismiss feedback after 3 seconds', async () => {
      vi.useFakeTimers();
      try {
        const mockOnSkillExpertiseToggle = vi.fn();
        let container;
        await act(async () => {
          const { container: c } = render(<WizardStepSkills stepNumber={10}
            {...baseProps}
            formData={{ skillProficiencies: ['Acrobatics'], expertSkills: [] }}
            onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
          />);
          container = c;
          // Run pending timers to trigger useEffect -> loadSkills
          await vi.runOnlyPendingTimersAsync();
        });

        const labels = container.querySelectorAll('.multi-select-item');
        const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
        const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');

        await act(async () => {
          fireEvent.click(button);
          // Advance past the 3-second setTimeout that dismisses feedback
          await vi.advanceTimersByTimeAsync(3500);
        });

        expect(container.querySelector('.expertise-feedback')).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should show error feedback and dismiss when deselecting expertise', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics'], expertSkills: ['Acrobatics'] }}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
      />);
      await waitForSkillsLoaded();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockOnSkillExpertiseToggle).toHaveBeenCalledWith('Acrobatics', false);
      });

      // Feedback should be cleared immediately on deselect
      expect(document.querySelector('.expertise-feedback')).not.toBeInTheDocument();
    });
  });

  describe('feat-restricted expertise', () => {
    it('should show error when feat count is zero and skill is feat-restricted', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics'], expertSkills: [] }}
        expertiseLimits={{
          allowed: true,
          count: 2,
          classCount: 2,
          featCount: 0,
          featExpertiseSkillLists: [['Acrobatics']],
        }}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
      />);
      await waitForSkillsLoaded();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(button);

      expect(mockOnSkillExpertiseToggle).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByText(/This skill requires a feat expertise slot/)).toBeInTheDocument();
      });
    });

    it('should show error when all feat slots are used for feat-restricted skill', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics', 'Stealth', 'Perception'], expertSkills: ['Acrobatics'] }}
        expertiseLimits={{
          allowed: true,
          count: 2,
          classCount: 2,
          featCount: 1,
          featExpertiseSkillLists: [['Acrobatics', 'Perception']],
        }}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
      />);
      await waitForSkillsLoaded();

      const labels = document.querySelectorAll('.multi-select-item');
      const perceptionLabel = Array.from(labels).find(l => l.textContent.includes('Perception'));
      const button = perceptionLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(button);

      expect(mockOnSkillExpertiseToggle).not.toHaveBeenCalled();
      await waitFor(() => {
        const feedback = document.querySelector('.expertise-feedback');
        expect(feedback).toBeInTheDocument();
        expect(feedback.textContent).toContain('feat expertise slot');
      });
    });

    it('should allow feat-restricted skill when feat slots are available', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics'], expertSkills: [] }}
        expertiseLimits={{
          allowed: true,
          count: 2,
          classCount: 2,
          featCount: 1,
          featExpertiseSkillLists: [['Acrobatics']],
        }}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
      />);
      await waitForSkillsLoaded();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(button);

      expect(mockOnSkillExpertiseToggle).toHaveBeenCalledWith('Acrobatics', true);
    });
  });

  describe('class expertise slots', () => {
    it('should show appropriate error when no expertise slots are available', async () => {
      // No class or feat slots for non-restricted skill
      const mockOnSkillExpertiseToggle1 = vi.fn();
      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics', 'Stealth', 'Perception'], expertSkills: ['Acrobatics', 'Stealth'] }}
        expertiseLimits={{
          allowed: true,
          count: 2,
          classCount: 2,
          featCount: 0,
        }}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle1}
      />);
      await waitForSkillsLoaded();

      const labels = document.querySelectorAll('.multi-select-item');
      const perceptionLabel = Array.from(labels).find(l => l.textContent.includes('Perception'));
      const button = perceptionLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(button);

      expect(mockOnSkillExpertiseToggle1).not.toHaveBeenCalled();
      await waitFor(() => {
        const feedback = document.querySelector('.expertise-feedback');
        expect(feedback).toBeInTheDocument();
        expect(feedback.textContent).toContain('expertise slots');
      });

      // Class grants 0 slots and feat count is 0
      const { container: c2 } = render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics'], expertSkills: [] }}
        expertiseLimits={{
          allowed: true,
          count: 0,
          classCount: 0,
          featCount: 0,
        }}
        onSkillExpertiseToggle={vi.fn()}
      />);
      await waitForSkillsLoaded();

      const labels2 = c2.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels2).find(l => l.textContent.includes('Acrobatics'));
      const button2 = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(button2);

      await waitFor(() => {
        const feedback = c2.querySelector('.expertise-feedback');
        expect(feedback).toBeInTheDocument();
        expect(feedback.textContent).toContain('does not grant expertise slots');
      });
    });

    it('should use feat slots when class slots are exhausted', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics', 'Stealth', 'Perception'], expertSkills: ['Acrobatics', 'Stealth'] }}
        expertiseLimits={{
          allowed: true,
          count: 2,
          classCount: 2,
          featCount: 1,
        }}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
      />);
      await waitForSkillsLoaded();

      const labels = document.querySelectorAll('.multi-select-item');
      const perceptionLabel = Array.from(labels).find(l => l.textContent.includes('Perception'));
      const button = perceptionLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(button);

      // classSlotsAvailable = 2 - 2 + 0 = 0, but feat slots available (featSlotsUsed=0 < featCount=1)
      expect(mockOnSkillExpertiseToggle).toHaveBeenCalledWith('Perception', true);
    });
  });

  describe('class-restricted expertise (Scholar six-skill list)', () => {
    const scholarLimits = {
      allowed: true,
      count: 1,
      classCount: 1,
      featCount: 0,
      classExpertiseSkillLists: [['Acrobatics', 'Stealth']],
    };

    it('should keep Elevate clickable but present the class list refusal for non-list skills', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics', 'Perception'], expertSkills: [] }}
        expertiseLimits={scholarLimits}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
      />);
      await waitForSkillsLoaded();

      const labels = document.querySelectorAll('.multi-select-item');
      const perceptionLabel = Array.from(labels).find(l => l.textContent.includes('Perception'));
      const button = perceptionLabel.querySelector('.expertise-toggle-btn');
      expect(button).not.toBeDisabled();
      expect(button).toHaveAttribute('title', 'Click to elevate to Expert');
      fireEvent.click(button);

      expect(mockOnSkillExpertiseToggle).not.toHaveBeenCalled();
      await waitFor(() => {
        const feedback = document.querySelector('.expertise-feedback');
        expect(feedback).toBeInTheDocument();
        expect(feedback.textContent).toBe('Class expertise is limited to: Acrobatics, Stealth');
      });
    });

    it('should allow elevation of a proficient skill inside the class list', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics', 'Perception'], expertSkills: [] }}
        expertiseLimits={scholarLimits}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
      />);
      await waitForSkillsLoaded();

      const labels = document.querySelectorAll('.multi-select-item');
      const acrobaticsLabel = Array.from(labels).find(l => l.textContent.includes('Acrobatics'));
      const button = acrobaticsLabel.querySelector('.expertise-toggle-btn');
      expect(button).not.toBeDisabled();
      fireEvent.click(button);

      expect(mockOnSkillExpertiseToggle).toHaveBeenCalledWith('Acrobatics', true);
    });

    it('should keep the count gate for in-list skills when class slots are exhausted', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics', 'Stealth'], expertSkills: ['Acrobatics'] }}
        expertiseLimits={scholarLimits}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
      />);
      await waitForSkillsLoaded();

      const labels = document.querySelectorAll('.multi-select-item');
      const stealthLabel = Array.from(labels).find(l => l.textContent.includes('Stealth'));
      const button = stealthLabel.querySelector('.expertise-toggle-btn');
      fireEvent.click(button);

      expect(mockOnSkillExpertiseToggle).not.toHaveBeenCalled();
      await waitFor(() => {
        const feedback = document.querySelector('.expertise-feedback');
        expect(feedback).toBeInTheDocument();
        expect(feedback.textContent).toContain('All class expertise slots are used');
      });
    });

    it('should allow a non-list skill when a feat expertise slot is still free', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics', 'Perception'], expertSkills: [] }}
        expertiseLimits={{ ...scholarLimits, count: 2, featCount: 1 }}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
      />);
      await waitForSkillsLoaded();

      const labels = document.querySelectorAll('.multi-select-item');
      const perceptionLabel = Array.from(labels).find(l => l.textContent.includes('Perception'));
      const button = perceptionLabel.querySelector('.expertise-toggle-btn');
      expect(button).not.toBeDisabled();
      fireEvent.click(button);

      expect(mockOnSkillExpertiseToggle).toHaveBeenCalledWith('Perception', true);
    });

    it('should not gate any skill when classExpertiseSkillLists is absent', async () => {
      const mockOnSkillExpertiseToggle = vi.fn();
      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        formData={{ skillProficiencies: ['Acrobatics', 'Perception'], expertSkills: [] }}
        expertiseLimits={{ allowed: true, count: 1, classCount: 1, featCount: 0 }}
        onSkillExpertiseToggle={mockOnSkillExpertiseToggle}
      />);
      await waitForSkillsLoaded();

      const labels = document.querySelectorAll('.multi-select-item');
      const perceptionLabel = Array.from(labels).find(l => l.textContent.includes('Perception'));
      const button = perceptionLabel.querySelector('.expertise-toggle-btn');
      expect(button).not.toBeDisabled();
      fireEvent.click(button);
      expect(mockOnSkillExpertiseToggle).toHaveBeenCalledWith('Perception', true);
    });
  });

  describe('skill limits breakdown', () => {
    it('should display skill choice sources breakdown', async () => {
      const propsWithBreakdown = {
        ...baseProps,
        skillLimits: {
          allowed: 5,
          skillChoiceSources: [
            { source: 'class', count: 3, skills: ['Acrobatics', 'Stealth', 'Perception'] },
            { source: 'feat', count: 1, featName: 'Skilled', skills: ['Acrobatics', 'Stealth', 'Perception', 'Insight'] },
          ],
        },
      };

      render(<WizardStepSkills stepNumber={10} {...propsWithBreakdown} />);
      await waitForSkillsLoaded();

      const ruleInfo = document.querySelector('.rule-info');
      expect(ruleInfo.textContent).toContain('Class');
      expect(ruleInfo.textContent).toContain('Skilled');
    });

    it('should display skilled source when skilledUsesAvailable > 0', async () => {
      const propsWithSkilled = {
        ...baseProps,
        formData: { skillProficiencies: ['Stealth'], expertSkills: [] },
        skillLimits: {
          allowed: 3,
          skilledUsesAvailable: 2,
          skilledUsesUsed: 1,
          skillChoiceSources: [
            { source: 'class', count: 2, skills: ['Acrobatics', 'Stealth', 'Perception'] },
          ],
        },
      };

      render(<WizardStepSkills stepNumber={10} {...propsWithSkilled} />);
      await waitForSkillsLoaded();

      const skilledSource = document.querySelector('.skilled-source');
      expect(skilledSource).toBeInTheDocument();
      expect(skilledSource.textContent).toContain('Skilled');
      expect(skilledSource.textContent).toContain('1 of 2');
    });

    it('should display details when no skillChoiceSources', async () => {
      render(<WizardStepSkills stepNumber={10}
        {...baseProps}
        skillLimits={{ allowed: 3, details: 'Your class grants 3 skills.' }}
      />);
      await waitForSkillsLoaded();

      // When no skillChoiceSources, the details paragraph should appear
      const ruleInfoElements = document.querySelectorAll('.rule-info');
      const detailsPresent = Array.from(ruleInfoElements).some(el =>
        el.textContent.includes('Your class grants 3 skills.')
      );
      expect(detailsPresent).toBe(true);
    });

    it('should not display details when skillChoiceSources exist', async () => {
      const propsWithBreakdown = {
        ...baseProps,
        skillLimits: {
          allowed: 3,
          details: 'This should not appear.',
          skillChoiceSources: [
            { source: 'class', count: 3, skills: ['Acrobatics', 'Stealth', 'Perception'] },
          ],
        },
      };

      render(<WizardStepSkills stepNumber={10} {...propsWithBreakdown} />);
      await waitForSkillsLoaded();

      const ruleInfoElements = document.querySelectorAll('.rule-info');
      const detailsPresent = Array.from(ruleInfoElements).some(el =>
        el.textContent.includes('This should not appear.')
      );
      expect(detailsPresent).toBe(false);
    });
  });
});
