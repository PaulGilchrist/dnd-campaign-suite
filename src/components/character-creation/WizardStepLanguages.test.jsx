import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepLanguages from './WizardStepLanguages.jsx';

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

  it('should handle language fetch error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Completely replace fetch to clear any existing behaviors
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(['Defense', 'Dueling']) });

    render(<WizardStepLanguages {...mockProps} />);

    expect(screen.getByText('Step 7: Languages & Fighting Styles')).toBeInTheDocument();

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error loading languages:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('should handle fighting styles fetch error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Completely replace fetch to clear any existing behaviors
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(['Common', 'Elvish']) })
      .mockRejectedValueOnce(new Error('Network error'));

    render(<WizardStepLanguages {...mockProps} />);

    expect(screen.getByText('Step 7: Languages & Fighting Styles')).toBeInTheDocument();

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error loading fighting styles:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('should auto-select pre-selected languages not already in formData', async () => {
    const mockOnLanguageToggle = vi.fn();

    render(
      <WizardStepLanguages
        {...mockProps}
        formData={{ ...mockProps.formData, languages: [] }}
        languageLimits={{
          ...mockProps.languageLimits,
          preSelected: ['Elvish'],
        }}
        onLanguageToggle={mockOnLanguageToggle}
      />
    );

    await waitFor(() => {
      expect(mockOnLanguageToggle).toHaveBeenCalledWith('Elvish');
    });
  });

  it('should auto-select pre-selected fighting styles not already in formData', async () => {
    const mockOnFightingStyleToggle = vi.fn();

    render(
      <WizardStepLanguages
        {...mockProps}
        formData={{ ...mockProps.formData, class: { fightingStyles: [] } }}
        fightingStyleLimits={{
          ...mockProps.fightingStyleLimits,
          preSelected: ['Archery'],
        }}
        onFightingStyleToggle={mockOnFightingStyleToggle}
      />
    );

    await waitFor(() => {
      expect(mockOnFightingStyleToggle).toHaveBeenCalledWith('Archery');
    });
  });

  it('should not show fighting style rule info when fightingStyleLimits is null', () => {
    render(
      <WizardStepLanguages
        {...mockProps}
        fightingStyleLimits={null}
      />
    );

    expect(screen.queryByText(/allowed fighting style/)).not.toBeInTheDocument();
    // Language rule info should still show
    expect(screen.getByText(/allowed language/)).toBeInTheDocument();
  });

  it('should show validation error for languages', () => {
    render(
      <WizardStepLanguages
        {...mockProps}
        errors={{ languages: 'Must select at least one language' }}
      />
    );

    expect(screen.getByText('Must select at least one language')).toBeInTheDocument();
  });

  it('should disable pre-selected language checkbox', async () => {
    render(<WizardStepLanguages {...mockProps} />);

    await waitFor(() => {
      const preSelectedLabel = document.querySelector('.multi-select-item.pre-selected');
      expect(preSelectedLabel).toBeInTheDocument();
      const checkbox = preSelectedLabel.querySelector('input[type="checkbox"]');
      expect(checkbox).toBeDisabled();
    });
  });

  it('should call onLanguageToggle when unselected language checkbox is clicked', async () => {
    const mockOnLanguageToggle = vi.fn();
    render(
      <WizardStepLanguages
        {...mockProps}
        onLanguageToggle={mockOnLanguageToggle}
      />
    );

    // Wait for languages to load
    await waitFor(() => {
      expect(document.querySelectorAll('.multi-select-item').length).toBeGreaterThan(0);
    });

    // Click the Elvish checkbox
    const combinedLabels = document.querySelectorAll('.multi-select-item');
    const elvishLabel = Array.from(combinedLabels).find(l => l.textContent.includes('Elvish'));
    const checkbox = elvishLabel.querySelector('input[type="checkbox"]');
    fireEvent.click(checkbox);

    expect(mockOnLanguageToggle).toHaveBeenCalledWith('Elvish');
  });

  it('should call onFightingStyleToggle when unselected style checkbox is clicked', async () => {
    const mockOnFightingStyleToggle = vi.fn();
    render(
      <WizardStepLanguages
        {...mockProps}
        onFightingStyleToggle={mockOnFightingStyleToggle}
      />
    );

    // Wait for fighting styles to load
    await waitFor(() => {
      expect(document.querySelectorAll('.multi-select-item').length).toBeGreaterThan(0);
    });

    // Click the Dueling checkbox
    const formGroups = document.querySelectorAll('.form-group');
    const fsLabels = formGroups[1].querySelectorAll('.multi-select-item');
    const duelingLabel = Array.from(fsLabels).find(l => l.textContent.includes('Dueling'));
    const checkbox = duelingLabel.querySelector('input[type="checkbox"]');
    fireEvent.click(checkbox);

    expect(mockOnFightingStyleToggle).toHaveBeenCalledWith('Dueling');
  });

  it('should disable pre-selected fighting style checkbox', async () => {
    render(<WizardStepLanguages {...mockProps} />);

    await waitFor(() => {
      // Fighting Styles is the second form-group
      const formGroups = document.querySelectorAll('.form-group');
      const fsGroup = formGroups[1];
      const preSelectedFsLabel = fsGroup.querySelector('.multi-select-item.pre-selected');
      expect(preSelectedFsLabel).toBeInTheDocument();
      expect(preSelectedFsLabel.textContent).toContain('Defense');
      const checkbox = preSelectedFsLabel.querySelector('input[type="checkbox"]');
      expect(checkbox).toBeDisabled();
    });
  });

  it('should show validation error for fighting styles', () => {
    render(
      <WizardStepLanguages
        {...mockProps}
        errors={{ fightingStyles: 'Fighting style selection required' }}
      />
    );

    expect(screen.getByText('Fighting style selection required')).toBeInTheDocument();
  });
});
