import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepSkills from './WizardStepSkills.jsx';

global.fetch = vi.fn();

vi.mock('../../services/skillValidation.js', () => ({
  validateSkills: vi.fn(() => Promise.resolve([])),
  getSkillLimits: vi.fn(() => Promise.resolve({ allowed: 3, details: 'Your class and level grant 3 skills.' })),
  getExpertiseLimits: vi.fn(() => Promise.resolve({ allowed: true, count: 2, details: 'Rogues get expertise in 2 skills.' })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([
        { full_name: 'Dexterity', skills: ['Acrobatics', 'Stealth'] },
        { full_name: 'Wisdom', skills: ['Perception'] },
       ]),
     });
});

describe('WizardStepSkills', () => {
  const mockProps = {
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
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
          { full_name: 'Dexterity', skills: ['Acrobatics', 'Stealth'] },
          { full_name: 'Wisdom', skills: ['Perception'] },
          ]),
        });
     });

  it('should render step header', () => {
    render(<WizardStepSkills {...mockProps} />);
    expect(screen.getByText('Step 6: Skill Proficiencies')).toBeInTheDocument();
     });

  it('should display skill limits info when provided', () => {
    render(<WizardStepSkills {...mockProps} />);
    expect(screen.getByText(/Rules/)).toBeInTheDocument();
    expect(screen.getByText(/Your class and level grant 3 skills/)).toBeInTheDocument();
     });

  it('should display skill count', () => {
    render(<WizardStepSkills {...mockProps} />);
    expect(screen.getByText(/You have selected 1 of 3 allowed skill proficiency/)).toBeInTheDocument();
     });

  it('should display expertise info when provided', () => {
    render(<WizardStepSkills {...mockProps} />);
    expect(screen.getByText(/Expertise:/)).toBeInTheDocument();
    expect(screen.getByText(/Rogues get expertise in 2 skills/)).toBeInTheDocument();
     });

  it('should render skill proficiencies label', () => {
    render(<WizardStepSkills {...mockProps} />);
    expect(screen.getByText('Skill Proficiencies')).toBeInTheDocument();
     });

  it('should not render warnings when none provided', () => {
    render(<WizardStepSkills {...mockProps} warnings={[]} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
     });

  it('should render warnings when provided', () => {
    render(<WizardStepSkills {...mockProps} warnings={[{ type: 'warning', message: 'Warning message' }]} />);
    expect(screen.getByText('Warning message')).toBeInTheDocument();
     });

  it('should show proficiency error when provided', () => {
    render(<WizardStepSkills {...mockProps} errors={{ skillProficiencies: 'Too many skills selected.' }} />);
    expect(screen.getByText('Too many skills selected.')).toBeInTheDocument();
     });

  it('should handle missing formData gracefully', () => {
    const emptyProps = {
          ...mockProps,
      formData: {},
        };

    render(<WizardStepSkills {...emptyProps} />);
    expect(screen.getByText('Step 6: Skill Proficiencies')).toBeInTheDocument();
     });

   it('should render checkboxes for skills when loaded', async () => {
    render(<WizardStepSkills {...mockProps} />);
    await waitFor(() => {
      expect(document.querySelectorAll('input[type="checkbox"]').length).toBeGreaterThan(0);
    });
    });

  it('should not show expertise info when not allowed', () => {
    render(<WizardStepSkills {...mockProps} expertiseLimits={null} />);
    expect(screen.queryByText(/Expertise:/)).not.toBeInTheDocument();
     });
});
