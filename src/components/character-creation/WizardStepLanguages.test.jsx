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

function setupFetchLanguageError() {
  global.fetch = vi.fn((url) => {
    if (url.includes('languages.json')) {
      return Promise.reject(new Error('Network error'));
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

function setupFetchFightingStylesError() {
  global.fetch = vi.fn((url) => {
    if (url.includes('languages.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockLanguages),
      });
    }
    if (url.includes('fighting-styles.json')) {
      return Promise.reject(new Error('Network error'));
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
    it('should render the step header', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages {...createMockProps()} />);
      await waitFor(() => {
        expect(screen.getByText('Step 7: Languages & Fighting Styles')).toBeInTheDocument();
      });
    });

    it('should render languages label', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages {...createMockProps()} />);
      await waitFor(() => {
        expect(screen.getByText('Languages')).toBeInTheDocument();
      });
    });

    it('should render fighting styles label', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages {...createMockProps()} />);
      await waitFor(() => {
        expect(screen.getByText('Fighting Styles')).toBeInTheDocument();
      });
    });

    it('should render language limits rule info', async () => {
      setupFetchSuccess();
      const props = createMockProps();
      render(<WizardStepLanguages {...props} />);
      await waitFor(() => {
        expect(screen.getByText(/Your race grants 2 languages/)).toBeInTheDocument();
      });
    });

    it('should render fighting style limits rule info', async () => {
      setupFetchSuccess();
      const props = createMockProps();
      render(<WizardStepLanguages {...props} />);
      await waitFor(() => {
        expect(screen.getByText(/Fighters get 1 fighting style/)).toBeInTheDocument();
      });
    });

    it('should render language selection count', async () => {
      setupFetchSuccess();
      const props = createMockProps();
      render(<WizardStepLanguages {...props} />);
      await waitFor(() => {
        expect(screen.getByText(/You have selected 1 of 3 allowed language/)).toBeInTheDocument();
      });
    });

    it('should render fighting style selection count', async () => {
      setupFetchSuccess();
      const props = createMockProps();
      render(<WizardStepLanguages {...props} />);
      await waitFor(() => {
        expect(screen.getByText(/You have selected 1 of 1 allowed fighting style/)).toBeInTheDocument();
      });
    });

    it('should render checkboxes for each loaded language', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages {...createMockProps()} />);
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBeGreaterThan(0);
      });
    });

    it('should render checkboxes for each loaded fighting style', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages {...createMockProps()} />);
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBeGreaterThan(0);
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

    it('should not render warnings container when warnings is empty array', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages {...createMockProps()} warnings={[]} />);
      await waitFor(() => {
        expect(screen.getByText('Step 7: Languages & Fighting Styles')).toBeInTheDocument();
      });
      expect(screen.queryByText(/warning/i)).not.toBeInTheDocument();
    });

    it('should not render warnings container when warnings is null', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages {...createMockProps()} warnings={null} />);
      await waitFor(() => {
        expect(screen.getByText('Step 7: Languages & Fighting Styles')).toBeInTheDocument();
      });
      expect(screen.queryByText(/warning/i)).not.toBeInTheDocument();
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
    it('should mark pre-selected languages with pre-selected class', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages {...createMockProps()} />);
      await waitFor(() => {
        const preSelectedLabel = document.querySelector('.multi-select-item.pre-selected');
        expect(preSelectedLabel).toBeInTheDocument();
        expect(preSelectedLabel.textContent).toContain('Common');
      });
    });

    it('should mark pre-selected fighting styles with pre-selected class', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages {...createMockProps()} />);
      await waitFor(() => {
        const formGroups = document.querySelectorAll('.form-group');
        const fsGroup = formGroups[1];
        const preSelectedFsLabel = fsGroup.querySelector('.multi-select-item.pre-selected');
        expect(preSelectedFsLabel).toBeInTheDocument();
        expect(preSelectedFsLabel.textContent).toContain('Defense');
      });
    });

    it('should disable pre-selected language checkbox that is already selected', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages {...createMockProps()} />);
      await waitFor(() => {
        const preSelectedLabel = document.querySelector('.multi-select-item.pre-selected');
        const checkbox = preSelectedLabel.querySelector('input[type="checkbox"]');
        expect(checkbox).toBeDisabled();
      });
    });

    it('should disable pre-selected fighting style checkbox that is already selected', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages {...createMockProps()} />);
      await waitFor(() => {
        const formGroups = document.querySelectorAll('.form-group');
        const fsGroup = formGroups[1];
        const preSelectedFsLabel = fsGroup.querySelector('.multi-select-item.pre-selected');
        const checkbox = preSelectedFsLabel.querySelector('input[type="checkbox"]');
        expect(checkbox).toBeDisabled();
      });
    });

    it('should not apply pre-selected class to languages not in preSelectedLanguages', async () => {
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

    it('should not apply pre-selected class to fighting styles not in preSelectedFightingStyles', async () => {
      setupFetchSuccess();
      render(
        <WizardStepLanguages
          {...createMockProps()}
          preSelectedFightingStyles={[]}
        />
      );
      await waitFor(() => {
        const formGroups = document.querySelectorAll('.form-group');
        const fsGroup = formGroups[1];
        const preSelectedLabels = fsGroup.querySelectorAll('.multi-select-item.pre-selected');
        expect(preSelectedLabels.length).toBe(0);
      });
    });
  });

  describe('Auto-selection of pre-selected items', () => {
    it('should auto-select pre-selected languages not already in formData', async () => {
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

    it('should not auto-select pre-selected language already in formData', async () => {
      setupFetchSuccess();
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
    });

    it('should auto-select pre-selected fighting styles not already in formData', async () => {
      setupFetchSuccess();
      const mockOnFightingStyleToggle = vi.fn();
      render(
        <WizardStepLanguages
          {...createMockProps({
            formData: { languages: [], class: { fightingStyles: [] } },
          })}
          fightingStyleLimits={{
            ...defaultFightingStyleLimits,
            preSelected: ['Archery'],
          }}
          onFightingStyleToggle={mockOnFightingStyleToggle}
        />
      );
      await waitFor(() => {
        expect(mockOnFightingStyleToggle).toHaveBeenCalledWith('Archery');
      });
    });

    it('should not auto-select pre-selected fighting style already in formData', async () => {
      setupFetchSuccess();
      const mockOnFightingStyleToggle = vi.fn();
      render(
        <WizardStepLanguages
          {...createMockProps({
            formData: { languages: [], class: { fightingStyles: ['Archery'] } },
          })}
          fightingStyleLimits={{
            ...defaultFightingStyleLimits,
            preSelected: ['Archery'],
          }}
          onFightingStyleToggle={mockOnFightingStyleToggle}
        />
      );
      await waitFor(() => {
        expect(mockOnFightingStyleToggle).not.toHaveBeenCalled();
      });
    });

    it('should not auto-select when languageLimits is null', async () => {
      setupFetchSuccess();
      const mockOnLanguageToggle = vi.fn();
      render(
        <WizardStepLanguages
          {...createMockProps({ formData: { languages: [], class: { fightingStyles: [] } } })}
          languageLimits={null}
          onLanguageToggle={mockOnLanguageToggle}
        />
      );
      await waitFor(() => {
        expect(mockOnLanguageToggle).not.toHaveBeenCalled();
      });
    });

    it('should not auto-select when fightingStyleLimits is null', async () => {
      setupFetchSuccess();
      const mockOnFightingStyleToggle = vi.fn();
      render(
        <WizardStepLanguages
          {...createMockProps({ formData: { languages: [], class: { fightingStyles: [] } } })}
          fightingStyleLimits={null}
          onFightingStyleToggle={mockOnFightingStyleToggle}
        />
      );
      await waitFor(() => {
        expect(mockOnFightingStyleToggle).not.toHaveBeenCalled();
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

    it('should call onFightingStyleToggle when a non-pre-selected style checkbox is clicked', async () => {
      setupFetchSuccess();
      const mockOnFightingStyleToggle = vi.fn();
      render(
        <WizardStepLanguages
          {...createMockProps()}
          onFightingStyleToggle={mockOnFightingStyleToggle}
        />
      );
      await waitFor(() => {
        expect(document.querySelectorAll('.multi-select-item').length).toBeGreaterThan(0);
      });
      const formGroups = document.querySelectorAll('.form-group');
      const fsGroup = formGroups[1];
      const fsItems = fsGroup.querySelectorAll('.multi-select-item');
      const duelingItem = Array.from(fsItems).find((l) => l.textContent.includes('Dueling'));
      const checkbox = duelingItem.querySelector('input[type="checkbox"]');
      fireEvent.click(checkbox);
      expect(mockOnFightingStyleToggle).toHaveBeenCalledWith('Dueling');
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

    it('should not call onFightingStyleToggle when a pre-selected already-selected checkbox is clicked', async () => {
      setupFetchSuccess();
      const mockOnFightingStyleToggle = vi.fn();
      const props = {
        formData: { languages: ['Common'], class: { fightingStyles: ['Defense', 'Dueling'] } },
        errors: {},
        languageLimits: { allowed: 3, details: 'Your race grants 2 languages. Your level grants 1.', preSelected: ['Common'] },
        fightingStyleLimits: { allowed: 1, details: 'Fighters get 1 fighting style.', preSelected: ['Defense', 'Dueling'] },
        preSelectedLanguages: ['Common'],
        preSelectedFightingStyles: ['Defense', 'Dueling'],
        warnings: [],
        onLanguageToggle: vi.fn(),
        onFightingStyleToggle: mockOnFightingStyleToggle,
      };
      render(<WizardStepLanguages {...props} />);
      await waitFor(() => {
        expect(document.querySelectorAll('.multi-select-item').length).toBeGreaterThan(0);
      });
      const formGroups = document.querySelectorAll('.form-group');
      const fsGroup = formGroups[1];
      const preSelectedFsLabel = fsGroup.querySelector('.multi-select-item.pre-selected');
      const checkbox = preSelectedFsLabel.querySelector('input[type="checkbox"]');
      expect(checkbox.disabled).toBe(true);
    });

    it('should toggle language selection state in the DOM', async () => {
      setupFetchSuccess();
      const mockOnLanguageToggle = vi.fn();
      render(
        <WizardStepLanguages
          {...createMockProps({
            formData: { languages: [], class: { fightingStyles: [] } },
          })}
          onLanguageToggle={mockOnLanguageToggle}
        />
      );
      await waitFor(() => {
        expect(document.querySelectorAll('.multi-select-item').length).toBeGreaterThan(0);
      });
      const languageItems = document.querySelectorAll('.multi-select-item');
      const elvishItem = Array.from(languageItems).find((l) => l.textContent.includes('Elvish'));
      const checkbox = elvishItem.querySelector('input[type="checkbox"]');
      expect(checkbox.checked).toBe(false);
      fireEvent.click(checkbox);
      expect(mockOnLanguageToggle).toHaveBeenCalledWith('Elvish');
    });
  });

  describe('Validation errors', () => {
    it('should show validation error for languages', async () => {
      setupFetchSuccess();
      render(
        <WizardStepLanguages
          {...createMockProps()}
          errors={{ languages: 'Must select at least one language' }}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Must select at least one language')).toBeInTheDocument();
      });
    });

    it('should show validation error for fighting styles', async () => {
      setupFetchSuccess();
      render(
        <WizardStepLanguages
          {...createMockProps()}
          errors={{ fightingStyles: 'Fighting style selection required' }}
        />
      );
      await waitFor(() => {
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
    it('should render the step header when no languages or fighting styles are selected', async () => {
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

    it('should render checkboxes even when lists are empty after fetch', async () => {
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
      setupFetchLanguageError();
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
      setupFetchFightingStylesError();
      render(<WizardStepLanguages {...createMockProps()} />);
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error loading fighting styles:', expect.any(Error));
      });
      expect(screen.getByText('Step 7: Languages & Fighting Styles')).toBeInTheDocument();
      expect(screen.getByText('Languages')).toBeInTheDocument();
      consoleSpy.mockRestore();
    });

    it('should render headers even when both fetches fail', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));
      render(<WizardStepLanguages {...createMockProps()} />);
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error loading languages:', expect.any(Error));
      });
      expect(screen.getByText('Step 7: Languages & Fighting Styles')).toBeInTheDocument();
      consoleSpy.mockRestore();
    });
  });

  describe('Selected state display', () => {
    it('should show selected class on checked language checkboxes', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages {...createMockProps()} />);
      await waitFor(() => {
        const selectedItems = document.querySelectorAll('.multi-select-item.selected');
        expect(selectedItems.length).toBeGreaterThan(0);
      });
    });

    it('should show selected class on checked fighting style checkboxes', async () => {
      setupFetchSuccess();
      render(<WizardStepLanguages {...createMockProps()} />);
      await waitFor(() => {
        const formGroups = document.querySelectorAll('.form-group');
        const fsGroup = formGroups[1];
        const selectedItems = fsGroup.querySelectorAll('.multi-select-item.selected');
        expect(selectedItems.length).toBeGreaterThan(0);
      });
    });

    it('should update language count when items are selected', async () => {
      setupFetchSuccess();
      const mockOnLanguageToggle = vi.fn();
      render(
        <WizardStepLanguages
          {...createMockProps({
            formData: { languages: [], class: { fightingStyles: [] } },
          })}
          onLanguageToggle={mockOnLanguageToggle}
        />
      );
      await waitFor(() => {
        expect(screen.getByText(/You have selected 0 of 3 allowed language/)).toBeInTheDocument();
      });
    });
  });
});
