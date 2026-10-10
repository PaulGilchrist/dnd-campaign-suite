// @improved-by-ai
// @cleaned-by-ai
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

async function waitForListsLoaded() {
  await waitFor(() => {
    expect(screen.getByText('Common')).toBeInTheDocument();
    expect(screen.getByText('Defense')).toBeInTheDocument();
  });
}

describe('WizardStepLanguages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render step header, labels, rule info, and selection counts', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages stepNumber={12} {...createMockProps()} />);
      await waitForListsLoaded();
      expect(screen.getByText('Step 12: Languages & Fighting Styles')).toBeInTheDocument();
      expect(screen.getByText('Languages')).toBeInTheDocument();
      expect(screen.getByText('Fighting Styles')).toBeInTheDocument();
      expect(screen.getByText(/Your race grants 2 languages/)).toBeInTheDocument();
      expect(screen.getByText(/Fighters get 1 fighting style/)).toBeInTheDocument();
      expect(screen.getByText(/You have selected 1 of 3 allowed language/)).toBeInTheDocument();
      expect(screen.getByText(/You have selected 1 of 1 allowed fighting style/)).toBeInTheDocument();
    });

    it('should render all languages and fighting styles from fetched data', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages stepNumber={12} {...createMockProps()} />);
      await waitForListsLoaded();
      expect(screen.getByText('Elvish')).toBeInTheDocument();
      expect(screen.getByText('Dwarfish')).toBeInTheDocument();
      expect(screen.getByText('Gnome')).toBeInTheDocument();
      expect(screen.getByText('Dueling')).toBeInTheDocument();
      expect(screen.getByText('Archery')).toBeInTheDocument();
    });

    it('should render warnings when provided', async () => {
      setupFetchSuccess();
      const warningMsg = 'You have exceeded the limit.';
      render(
        <WizardStepLanguages stepNumber={12}
          {...createMockProps()}
          warnings={[{ type: 'warning', message: warningMsg }]}
        />
      );
      await waitForListsLoaded();
      expect(screen.getByText(warningMsg)).toBeInTheDocument();
    });
  });

  describe('conditional rendering', () => {
    it('should hide fighting style rule info when fightingStyleLimits is null', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages stepNumber={12} {...createMockProps()} fightingStyleLimits={null} />);
      await waitForListsLoaded();
      expect(screen.getByText(/allowed language/)).toBeInTheDocument();
      expect(screen.queryByText(/allowed fighting style/)).not.toBeInTheDocument();
    });

    it('should hide language rule info when languageLimits is null', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages stepNumber={12} {...createMockProps()} languageLimits={null} />);
      await waitForListsLoaded();
      expect(screen.getByText(/allowed fighting style/)).toBeInTheDocument();
      expect(screen.queryByText(/allowed language/)).not.toBeInTheDocument();
    });

    it('should show validation errors for languages and fighting styles', async () => {
      setupFetchSuccess();
      render(
        <WizardStepLanguages stepNumber={12}
          {...createMockProps()}
          errors={{ languages: 'Must select at least one language', fightingStyles: 'Fighting style selection required' }}
        />
      );
      await waitForListsLoaded();
      expect(screen.getByText('Must select at least one language')).toBeInTheDocument();
      expect(screen.getByText('Fighting style selection required')).toBeInTheDocument();
    });

    it('should only show the error for the section that has one', async () => {
      setupFetchSuccess();
      render(
        <WizardStepLanguages stepNumber={12}
          {...createMockProps()}
          errors={{ languages: 'Must select at least one language' }}
        />
      );
      await waitForListsLoaded();
      expect(screen.getByText('Must select at least one language')).toBeInTheDocument();
      expect(screen.queryByText(/Fighting style selection required/)).not.toBeInTheDocument();
    });
  });

  describe('pre-selected items', () => {
    it('should disable checkboxes for pre-selected items already in formData', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages stepNumber={12} {...createMockProps()} />);
      await waitForListsLoaded();
      const langCheckbox = screen.getByRole('checkbox', { name: 'Common' });
      expect(langCheckbox).toBeDisabled();
      const styleCheckbox = screen.getByRole('checkbox', { name: 'Defense' });
      expect(styleCheckbox).toBeDisabled();
    });

    it('should not disable pre-selected items when not in formData', async () => {
      setupFetchSuccess();
      render(
        <WizardStepLanguages stepNumber={12}
          {...createMockProps({
            formData: { languages: [], class: { fightingStyles: [] } },
          })}
        />
      );
      await waitForListsLoaded();
      const langCheckbox = screen.getByRole('checkbox', { name: 'Common' });
      expect(langCheckbox).not.toBeDisabled();
      const styleCheckbox = screen.getByRole('checkbox', { name: 'Defense' });
      expect(styleCheckbox).not.toBeDisabled();
    });
  });

  describe('auto-selection', () => {
    it('should auto-select pre-selected languages and fighting styles not already in formData', async () => {
      setupFetchSuccess();
      const mockOnLanguageToggle = vi.fn();
      const mockOnFightingStyleToggle = vi.fn();
      render(
        <WizardStepLanguages stepNumber={12}
          {...createMockProps({
            formData: { languages: [], class: { fightingStyles: [] } },
          })}
          languageLimits={{
            ...defaultLanguageLimits,
            preSelected: ['Elvish'],
          }}
          fightingStyleLimits={{
            ...defaultFightingStyleLimits,
            preSelected: ['Dueling'],
          }}
          onLanguageToggle={mockOnLanguageToggle}
          onFightingStyleToggle={mockOnFightingStyleToggle}
        />
      );
      await waitForListsLoaded();
      expect(mockOnLanguageToggle).toHaveBeenCalledWith('Elvish');
      expect(mockOnFightingStyleToggle).toHaveBeenCalledWith('Dueling');
    });

    it('should not auto-select when items are already in formData', async () => {
      setupFetchSuccess();
      const mockOnLanguageToggle = vi.fn();
      const mockOnFightingStyleToggle = vi.fn();
      render(
        <WizardStepLanguages stepNumber={12}
          {...createMockProps({
            formData: { languages: ['Elvish'], class: { fightingStyles: ['Dueling'] } },
          })}
          languageLimits={{
            ...defaultLanguageLimits,
            preSelected: ['Elvish'],
          }}
          fightingStyleLimits={{
            ...defaultFightingStyleLimits,
            preSelected: ['Dueling'],
          }}
          onLanguageToggle={mockOnLanguageToggle}
          onFightingStyleToggle={mockOnFightingStyleToggle}
        />
      );
      await waitForListsLoaded();
      expect(mockOnLanguageToggle).not.toHaveBeenCalled();
      expect(mockOnFightingStyleToggle).not.toHaveBeenCalled();
    });

    it('should not auto-select when limits are null', async () => {
      setupFetchSuccess();
      const mockOnLanguageToggle = vi.fn();
      const mockOnFightingStyleToggle = vi.fn();
      render(
        <WizardStepLanguages stepNumber={12}
          {...createMockProps({ formData: { languages: [], class: { fightingStyles: [] } } })}
          languageLimits={null}
          fightingStyleLimits={null}
          onLanguageToggle={mockOnLanguageToggle}
          onFightingStyleToggle={mockOnFightingStyleToggle}
        />
      );
      await waitForListsLoaded();
      expect(mockOnLanguageToggle).not.toHaveBeenCalled();
      expect(mockOnFightingStyleToggle).not.toHaveBeenCalled();
    });
  });

  describe('user interactions', () => {
    it('should call onLanguageToggle when a language checkbox is clicked', async () => {
      setupFetchSuccess();
      const mockOnLanguageToggle = vi.fn();
      render(
        <WizardStepLanguages stepNumber={12}
          {...createMockProps()}
          onLanguageToggle={mockOnLanguageToggle}
        />
      );
      await waitForListsLoaded();
      const checkbox = screen.getByRole('checkbox', { name: 'Elvish' });
      fireEvent.click(checkbox);
      expect(mockOnLanguageToggle).toHaveBeenCalledWith('Elvish');
    });

    it('should call onFightingStyleToggle when a fighting style checkbox is clicked', async () => {
      setupFetchSuccess();
      const mockOnFightingStyleToggle = vi.fn();
      render(
        <WizardStepLanguages stepNumber={12}
          {...createMockProps({ formData: { languages: [], class: { fightingStyles: [] } } })}
          onFightingStyleToggle={mockOnFightingStyleToggle}
        />
      );
      await waitForListsLoaded();
      const checkbox = screen.getByRole('checkbox', { name: 'Dueling' });
      fireEvent.click(checkbox);
      expect(mockOnFightingStyleToggle).toHaveBeenCalledWith('Dueling');
    });

  });

  describe('error handling', () => {
    it('should continue rendering when fetch fails for one section', async () => {
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
      render(<WizardStepLanguages stepNumber={12} {...createMockProps()} />);
      await waitFor(() => {
        expect(screen.getByText('Step 12: Languages & Fighting Styles')).toBeInTheDocument();
        expect(screen.getByText('Fighting Styles')).toBeInTheDocument();
      });
      expect(consoleSpy).toHaveBeenCalledWith('Error loading languages:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should continue rendering when both fetches fail', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Network error'))
      );
      render(<WizardStepLanguages stepNumber={12} {...createMockProps()} />);
      await waitFor(() => {
        expect(screen.getByText('Step 12: Languages & Fighting Styles')).toBeInTheDocument();
      });
      expect(consoleSpy).toHaveBeenCalledWith('Error loading languages:', expect.any(Error));
      expect(consoleSpy).toHaveBeenCalledWith('Error loading fighting styles:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('merged lists with object items', () => {
    it('should render string items from formData that are not in the fetched list', async () => {
      setupFetchSuccess();
      render(
        <WizardStepLanguages stepNumber={12}
          {...createMockProps({
            formData: { languages: ['Undercommon'], class: { fightingStyles: [] } },
          })}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Undercommon')).toBeInTheDocument();
      });
    });

    it('should render object items with name property from fetched data', async () => {
      global.fetch = vi.fn((url) => {
        if (url.includes('languages.json')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ name: 'Common' }, { name: 'Elvish' }]),
          });
        }
        if (url.includes('fighting-styles.json')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ name: 'Defense' }]),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      });
      render(<WizardStepLanguages stepNumber={12} {...createMockProps()} />);
      await waitFor(() => {
        expect(screen.getByText('Common')).toBeInTheDocument();
        expect(screen.getByText('Elvish')).toBeInTheDocument();
        expect(screen.getByText('Defense')).toBeInTheDocument();
      });
    });
  });
});
