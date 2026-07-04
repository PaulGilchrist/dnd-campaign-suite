// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepLanguages from './WizardStepLanguages.jsx';

const mockLanguages = ['Common', 'Elvish', 'Dwarfish', 'Gnome'];
const mockFightingStyles = ['Defense', 'Dueling', 'Archery'];

const defaultLanguageLimits = {
  allowed: 3,
  details: 'Your race grants 2 languages. Your level grants 1.',
  preSelected: ['Common'],
};

const defaultFightingStyleLimits = {
  allowed: 1,
  details: 'Fighters get 1 fighting style.',
  preSelected: ['Defense'],
};

function createMockProps(overrides = {}) {
  return {
    formData: {
      languages: ['Common'],
      class: { fightingStyles: ['Defense'] },
      ...overrides.formData,
    },
    errors: {},
    languageLimits: defaultLanguageLimits,
    fightingStyleLimits: defaultFightingStyleLimits,
    preSelectedLanguages: ['Common'],
    preSelectedFightingStyles: ['Defense'],
    warnings: [],
    onLanguageToggle: vi.fn(),
    onFightingStyleToggle: vi.fn(),
    ...overrides,
  };
}

function setupFetchSuccess() {
  global.fetch = vi.fn((url) => {
    if (url.includes('languages.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockLanguages),
      });
    }
    if (url.includes('fighting-styles.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockFightingStyles),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });
}

describe('WizardStepLanguages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render step header, labels, rule info, and selection counts', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages {...createMockProps()} />);
      await waitFor(() => {
        expect(screen.getByText('Step 7: Languages & Fighting Styles')).toBeInTheDocument();
        expect(screen.getByText('Languages')).toBeInTheDocument();
        expect(screen.getByText('Fighting Styles')).toBeInTheDocument();
        expect(screen.getByText(/Your race grants 2 languages/)).toBeInTheDocument();
        expect(screen.getByText(/Fighters get 1 fighting style/)).toBeInTheDocument();
        expect(screen.getByText(/You have selected 1 of 3 allowed language/)).toBeInTheDocument();
        expect(screen.getByText(/You have selected 1 of 1 allowed fighting style/)).toBeInTheDocument();
      });
    });
  });

  describe('Conditional rendering', () => {
    it('should not render fighting style rule info when fightingStyleLimits is null', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages {...createMockProps()} fightingStyleLimits={null} />);
      await waitFor(() => {
        expect(screen.getByText(/allowed language/)).toBeInTheDocument();
      });
      expect(screen.queryByText(/allowed fighting style/)).not.toBeInTheDocument();
    });

    it('should not render language rule info when languageLimits is null', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages {...createMockProps()} languageLimits={null} />);
      await waitFor(() => {
        expect(screen.getByText(/allowed fighting style/)).toBeInTheDocument();
      });
      expect(screen.queryByText(/allowed language/)).not.toBeInTheDocument();
    });

    it('should render warnings when provided', async () => {
      setupFetchSuccess();
      const warningMsg = 'You have exceeded the limit.';
      render(
        <WizardStepLanguages
          {...createMockProps()}
          warnings={[{ type: 'warning', message: warningMsg }]}
        />
      );
      await waitFor(() => {
        expect(screen.getByText(warningMsg)).toBeInTheDocument();
      });
    });
  });

  describe('Pre-selected items', () => {
    it('should mark pre-selected items with pre-selected class and disable already-selected checkboxes', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages {...createMockProps()} />);
      await waitFor(() => {
        const preSelectedLabel = document.querySelector('.multi-select-item.pre-selected');
        expect(preSelectedLabel).toBeInTheDocument();
        expect(preSelectedLabel.textContent).toContain('Common');
        const checkbox = preSelectedLabel.querySelector('input[type="checkbox"]');
        expect(checkbox).toBeDisabled();
      });
    });

    it('should not apply pre-selected class when preSelectedLanguages is empty', async () => {
      setupFetchSuccess();
      render(
        <WizardStepLanguages
          {...createMockProps()}
          preSelectedLanguages={[]}
        />
      );
      await waitFor(() => {
        const preSelectedLabels = document.querySelectorAll('.multi-select-item.pre-selected');
        expect(preSelectedLabels.length).toBe(0);
      });
    });
  });

  describe('Auto-selection', () => {
    it('should auto-select pre-selected items not already in formData', async () => {
      setupFetchSuccess();
      const mockOnLanguageToggle = vi.fn();
      render(
        <WizardStepLanguages
          {...createMockProps({
            formData: { languages: [], class: { fightingStyles: ['Defense'] } },
          })}
          languageLimits={{
            ...defaultLanguageLimits,
            preSelected: ['Elvish'],
          }}
          onLanguageToggle={mockOnLanguageToggle}
        />
      );
      await waitFor(() => {
        expect(mockOnLanguageToggle).toHaveBeenCalledWith('Elvish');
      });
    });

    it('should not auto-select pre-selected items already in formData or when limits are null', async () => {
      const mockOnLanguageToggle = vi.fn();
      render(
        <WizardStepLanguages
          {...createMockProps({
            formData: { languages: ['Elvish'], class: { fightingStyles: [] } },
          })}
          languageLimits={{
            ...defaultLanguageLimits,
            preSelected: ['Elvish'],
          }}
          onLanguageToggle={mockOnLanguageToggle}
        />
      );
      await waitFor(() => {
        expect(mockOnLanguageToggle).not.toHaveBeenCalled();
      });

      const mockOnLanguageToggle2 = vi.fn();
      render(
        <WizardStepLanguages
          {...createMockProps({ formData: { languages: [], class: { fightingStyles: [] } } })}
          languageLimits={null}
          onLanguageToggle={mockOnLanguageToggle2}
        />
      );
      await waitFor(() => {
        expect(mockOnLanguageToggle2).not.toHaveBeenCalled();
      });
    });
  });

  describe('User interactions', () => {
    it('should call onLanguageToggle when a non-pre-selected language checkbox is clicked', async () => {
      setupFetchSuccess();
      const mockOnLanguageToggle = vi.fn();
      render(
        <WizardStepLanguages
          {...createMockProps()}
          onLanguageToggle={mockOnLanguageToggle}
        />
      );
      await waitFor(() => {
        expect(document.querySelectorAll('.multi-select-item').length).toBeGreaterThan(0);
      });
      const languageItems = document.querySelectorAll('.multi-select-item');
      const elvishItem = Array.from(languageItems).find((l) => l.textContent.includes('Elvish'));
      const checkbox = elvishItem.querySelector('input[type="checkbox"]');
      fireEvent.click(checkbox);
      expect(mockOnLanguageToggle).toHaveBeenCalledWith('Elvish');
    });

    it('should not call onLanguageToggle when a pre-selected already-selected checkbox is clicked', async () => {
      setupFetchSuccess();
      const mockOnLanguageToggle = vi.fn();
      const props = {
        formData: { languages: ['Common', 'Elvish'], class: { fightingStyles: ['Defense'] } },
        errors: {},
        languageLimits: { allowed: 3, details: 'Your race grants 2 languages. Your level grants 1.', preSelected: ['Common', 'Elvish'] },
        fightingStyleLimits: { allowed: 1, details: 'Fighters get 1 fighting style.', preSelected: ['Defense'] },
        preSelectedLanguages: ['Common', 'Elvish'],
        preSelectedFightingStyles: ['Defense'],
        warnings: [],
        onLanguageToggle: mockOnLanguageToggle,
        onFightingStyleToggle: vi.fn(),
      };
      render(<WizardStepLanguages {...props} />);
      await waitFor(() => {
        expect(document.querySelectorAll('.multi-select-item').length).toBeGreaterThan(0);
      });
      const preSelectedLabel = document.querySelector('.multi-select-item.pre-selected');
      const checkbox = preSelectedLabel.querySelector('input[type="checkbox"]');
      expect(checkbox.disabled).toBe(true);
    });
  });

  describe('Validation errors', () => {
    it('should show validation errors for languages and fighting styles', async () => {
      setupFetchSuccess();
      render(
        <WizardStepLanguages
          {...createMockProps()}
          errors={{ languages: 'Must select at least one language', fightingStyles: 'Fighting style selection required' }}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Must select at least one language')).toBeInTheDocument();
        expect(screen.getByText('Fighting style selection required')).toBeInTheDocument();
      });
    });

    it('should not show validation errors when errors object is empty', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages {...createMockProps()} errors={{}} />);
      await waitFor(() => {
        expect(screen.getByText('Step 7: Languages & Fighting Styles')).toBeInTheDocument();
      });
      expect(screen.queryByText(/select at least one/)).not.toBeInTheDocument();
      expect(screen.queryByText(/selection required/)).not.toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('should render the step header when no languages or fighting styles are allowed', async () => {
      setupFetchSuccess();
      render(
        <WizardStepLanguages
          {...createMockProps({
            formData: { languages: [], class: { fightingStyles: [] } },
            languageLimits: { allowed: 0, details: 'No languages allowed', preSelected: [] },
            fightingStyleLimits: { allowed: 0, details: 'No styles', preSelected: [] },
          })}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Step 7: Languages & Fighting Styles')).toBeInTheDocument();
      });
    });

    it('should render the step header even when fetch returns empty lists', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        })
      );
      render(<WizardStepLanguages {...createMockProps()} />);
      await waitFor(() => {
        expect(screen.getByText('Step 7: Languages & Fighting Styles')).toBeInTheDocument();
      });
    });
  });

  describe('Error handling', () => {
    it('should log error and continue rendering when language fetch fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch = vi.fn((url) => {
        if (url.includes('languages.json')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockFightingStyles),
        });
      });
      render(<WizardStepLanguages {...createMockProps()} />);
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error loading languages:', expect.any(Error));
      });
      expect(screen.getByText('Step 7: Languages & Fighting Styles')).toBeInTheDocument();
      expect(screen.getByText('Fighting Styles')).toBeInTheDocument();
      consoleSpy.mockRestore();
    });

    it('should log error and continue rendering when fighting styles fetch fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch = vi.fn((url) => {
        if (url.includes('fighting-styles.json')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockLanguages),
        });
      });
      render(<WizardStepLanguages {...createMockProps()} />);
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error loading fighting styles:', expect.any(Error));
      });
      expect(screen.getByText('Step 7: Languages & Fighting Styles')).toBeInTheDocument();
      expect(screen.getByText('Languages')).toBeInTheDocument();
      consoleSpy.mockRestore();
    });
  });
});
