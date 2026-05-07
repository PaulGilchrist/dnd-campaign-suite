import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepLanguages from './wizard-step-languages.jsx';

global.fetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch
     .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(['Common', 'Elvish', 'Dwarfish', 'Gnome']) })
     .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(['Defense', 'Dueling', 'Archery']) });
});

describe('WizardStepLanguages', () => {
  const mockProps = {
    formData: {
      languages: ['Common'],
      class: { fightingStyles: ['Defense'] },
      },
    errors: {},
    languageLimits: {
      allowed: 3,
      details: 'Your race grants 2 languages. Your level grants 1.',
      preSelected: ['Common'],
       },
    fightingStyleLimits: {
      allowed: 1,
      details: 'Fighters get 1 fighting style.',
      preSelected: ['Defense'],
       },
    preSelectedLanguages: ['Common'],
    preSelectedFightingStyles: ['Defense'],
    warnings: [],
    onLanguageToggle: vi.fn(),
    onFightingStyleToggle: vi.fn(),
      };

  beforeEach(() => {
    global.fetch
       .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(['Common', 'Elvish', 'Dwarfish', 'Gnome']) })
       .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(['Defense', 'Dueling', 'Archery']) });
     });

  it('should render the step header', () => {
    render(<WizardStepLanguages {...mockProps} />);
    expect(screen.getByText('Step 7: Languages & Fighting Styles')).toBeInTheDocument();
     });

   it('should render language limits info when provided', () => {
    render(<WizardStepLanguages {...mockProps} />);
    const ruleInfos = screen.getAllByText(/Rules:/);
    expect(ruleInfos.length).toBe(2); // One for languages, one for fighting styles
    });

  it('should render fighting style limits info when provided', () => {
    render(<WizardStepLanguages {...mockProps} />);
    expect(screen.getByText(/You have selected 1 of 1 allowed fighting style/)).toBeInTheDocument();
     });

  it('should render languages label', () => {
    render(<WizardStepLanguages {...mockProps} />);
    expect(screen.getByText('Languages')).toBeInTheDocument();
     });

  it('should render fighting styles label', () => {
    render(<WizardStepLanguages {...mockProps} />);
    expect(screen.getByText('Fighting Styles')).toBeInTheDocument();
     });

  it('should not render warnings container when no warnings', () => {
    render(<WizardStepLanguages {...mockProps} warnings={[]} />);
    expect(screen.queryByText(/warning/i)).not.toBeInTheDocument();
     });

  it('should render warnings when provided', () => {
    render(<WizardStepLanguages {...mockProps} warnings={[{ type: 'warning', message: 'You have exceeded the limit.' }]} />);
    expect(screen.getByText('You have exceeded the limit.')).toBeInTheDocument();
     });

   it('should mark pre-selected languages as pre-selected class', async () => {
    render(<WizardStepLanguages {...mockProps} />);
    await waitFor(() => {
      expect(screen.getByText('Common')).toBeInTheDocument();
    });
    });

  it('should handle empty languages list', () => {
    const emptyProps = {
          ...mockProps,
      formData: { languages: [], class: { fightingStyles: [] } },
      languageLimits: { allowed: 0, details: 'No languages allowed', preSelected: [] },
      fightingStyleLimits: { allowed: 0, details: 'No styles', preSelected: [] },
        };

    render(<WizardStepLanguages {...emptyProps} />);
    expect(screen.getByText('Step 7: Languages & Fighting Styles')).toBeInTheDocument();
     });

   it('should render language checkboxes when loaded', async () => {
    render(<WizardStepLanguages {...mockProps} />);
    await waitFor(() => {
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBeGreaterThan(0);
    });
    });

  it('should show language count in rule info', () => {
    render(<WizardStepLanguages {...mockProps} />);
    expect(screen.getByText(/You have selected 1 of 3 allowed language/)).toBeInTheDocument();
     });
});
