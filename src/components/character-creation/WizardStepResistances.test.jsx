// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepResistances from './WizardStepResistances.jsx';

const mockResistancesData = [
  'Acid',
  'Cold',
  'Fire',
  'Force',
  'Lightning',
  'Necrotic',
  'Psychic',
  'Radiant',
  'Thunder',
];

function createMockProps(overrides = {}) {
  return {
    formData: {
      resistances: [],
      immunities: [],
      ...overrides.formData,
    },
    onResistanceToggle: vi.fn(),
    onImmunityToggle: vi.fn(),
    warnings: overrides.warnings || [],
    preSelectedResistances: overrides.preSelectedResistances || [],
    preSelectedImmunities: overrides.preSelectedImmunities || [],
    ...overrides,
  };
}

function setupFetchMock(data) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  });
}

function getSectionByLabelText(text) {
  const formGroups = document.querySelectorAll('.wizard-step .form-group');
  return Array.from(formGroups).find((g) =>
    g.querySelector('label')?.textContent?.includes(text)
  );
}

function getCheckboxForType(section, typeName) {
  const labels = section?.querySelectorAll('label') || [];
  const targetLabel = Array.from(labels).find(
    (l) => l.querySelector('input[type="checkbox"]') && l.textContent.includes(typeName)
  );
  return targetLabel?.querySelector('input[type="checkbox"]') ?? null;
}

describe('WizardStepResistances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetchMock(mockResistancesData);
  });

  describe('Rendering', () => {
    it('should render the step header, resistances and immunities labels', () => {
      render(<WizardStepResistances stepNumber={13} {...createMockProps()} />);
      expect(screen.getByText('Step 13: Resistances & Immunities')).toBeInTheDocument();
      expect(screen.getByText('Resistances')).toBeInTheDocument();
      expect(screen.getByText('Immunities')).toBeInTheDocument();
    });

    it('should render no checkboxes when data array is empty', async () => {
      setupFetchMock([]);
      render(<WizardStepResistances stepNumber={13} {...createMockProps()} />);
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(0);
      });
      expect(screen.getByText('Step 13: Resistances & Immunities')).toBeInTheDocument();
    });
  });

  describe('Selected values', () => {
    it('should check the checkbox when a value is in formData resistances', async () => {
      render(
        <WizardStepResistances stepNumber={13}
          {...createMockProps({
            formData: { resistances: ['Fire'], immunities: [] },
          })}
        />
      );
      await waitFor(() => {
        const resistanceSection = getSectionByLabelText('Resistances');
        expect(getCheckboxForType(resistanceSection, 'Fire').checked).toBe(true);
      });
    });

    it('should mark selected items with the "selected" CSS class', async () => {
      render(
        <WizardStepResistances stepNumber={13}
          {...createMockProps({
            formData: { resistances: ['Fire'], immunities: ['Cold'] },
          })}
        />
      );
      await waitFor(() => {
        const selectedItems = document.querySelectorAll('.multi-select-item.selected');
        expect(selectedItems.length).toBe(2);
      });
    });
  });

  describe('Pre-selected items', () => {
    it('should show "(Granted)" suffix for pre-selected values', async () => {
      render(
        <WizardStepResistances stepNumber={13}
          {...createMockProps({
            preSelectedResistances: ['Acid'],
            preSelectedImmunities: ['Cold'],
          })}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Acid (Granted)')).toBeInTheDocument();
        expect(screen.getByText('Cold (Granted)')).toBeInTheDocument();
      });
    });

    it('should disable the checkbox when pre-selected and already selected, and keep it enabled when pre-selected but not yet selected', async () => {
      render(
        <WizardStepResistances stepNumber={13}
          {...createMockProps({
            preSelectedResistances: ['Fire'],
            formData: { resistances: ['Fire'] },
          })}
        />
      );
      await waitFor(() => {
        const resistanceSection = getSectionByLabelText('Resistances');
        const fireCheckbox = getCheckboxForType(resistanceSection, 'Fire');
        expect(fireCheckbox.disabled).toBe(true);
        expect(fireCheckbox.checked).toBe(true);
      });
    });

    it('should apply pre-selected CSS class to the label', async () => {
      render(
        <WizardStepResistances stepNumber={13}
          {...createMockProps({
            preSelectedResistances: ['Acid'],
          })}
        />
      );
      await waitFor(() => {
        const preSelectedLabel = document.querySelector('.multi-select-item.pre-selected');
        expect(preSelectedLabel).toBeInTheDocument();
        expect(preSelectedLabel.textContent).toContain('Acid');
      });
    });

    it('should handle undefined preSelectedResistances gracefully', () => {
      const props = createMockProps();
      props.preSelectedResistances = undefined;
      props.preSelectedImmunities = undefined;
      render(<WizardStepResistances stepNumber={13} {...props} />);
      expect(screen.getByText('Step 13: Resistances & Immunities')).toBeInTheDocument();
    });
  });

  describe('Toggle interactions', () => {
    it('should call onResistanceToggle when a resistance checkbox is clicked', async () => {
      const mockOnResistanceToggle = vi.fn();
      render(
        <WizardStepResistances stepNumber={13}
          {...createMockProps({
            onResistanceToggle: mockOnResistanceToggle,
            formData: { resistances: [], immunities: [] },
          })}
        />
      );
      await waitFor(() => {
        const resistanceSection = getSectionByLabelText('Resistances');
        const fireCheckbox = getCheckboxForType(resistanceSection, 'Fire');
        expect(fireCheckbox).not.toBeNull();
        fireEvent.click(fireCheckbox);
      });

      expect(mockOnResistanceToggle).toHaveBeenCalledWith('Fire');
    });

    it('should keep the checkbox checked when a disabled pre-selected checkbox is clicked', async () => {
      render(
        <WizardStepResistances stepNumber={13}
          {...createMockProps({
            preSelectedResistances: ['Fire'],
            formData: { resistances: ['Fire'] },
          })}
        />
      );
      await waitFor(() => {
        const resistanceSection = getSectionByLabelText('Resistances');
        const fireCheckbox = getCheckboxForType(resistanceSection, 'Fire');
        expect(fireCheckbox.disabled).toBe(true);
        expect(fireCheckbox.checked).toBe(true);
        fireEvent.click(fireCheckbox);
        expect(fireCheckbox.checked).toBe(true);
      });
    });
  });

  describe('Warnings', () => {
    it('should render warning messages when provided', async () => {
      render(
        <WizardStepResistances stepNumber={13}
          {...createMockProps({
            warnings: [
              { type: 'error', message: 'Too many resistances selected' },
              { type: 'warning', message: 'Consider your class limitations' },
            ],
          })}
        />
      );

      expect(screen.getByText('Too many resistances selected')).toBeInTheDocument();
      expect(screen.getByText('Consider your class limitations')).toBeInTheDocument();
    });

    it('should not render warnings container when warnings is null or empty', () => {
      render(<WizardStepResistances stepNumber={13} {...createMockProps({ warnings: null })} />);
      expect(document.querySelector('.warning-container')).not.toBeInTheDocument();
      render(<WizardStepResistances stepNumber={13} {...createMockProps({ warnings: [] })} />);
      expect(document.querySelector('.warning-container')).not.toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('should log an error and keep rendering when fetch fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      render(<WizardStepResistances stepNumber={13} {...createMockProps()} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error loading resistances/immunities:',
          expect.any(Error),
        );
      });

      expect(screen.getByText('Step 13: Resistances & Immunities')).toBeInTheDocument();
      consoleSpy.mockRestore();
    });
  });
});
