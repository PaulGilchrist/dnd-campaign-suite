// @improved-by-ai
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
    json: () => Promise.resolve(data),
  });
}

function setupFetchFailure() {
  global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
}

function getResistanceSection() {
  const formGroups = document.querySelectorAll('.wizard-step .form-group');
  const resistanceGroup = Array.from(formGroups).find((g) =>
    g.querySelector('label')?.textContent?.includes('Resistances')
  );
  return resistanceGroup;
}

function getImmunitySection() {
  const formGroups = document.querySelectorAll('.wizard-step .form-group');
  const immunityGroup = Array.from(formGroups).find((g) =>
    g.querySelector('label')?.textContent?.includes('Immunities')
  );
  return immunityGroup;
}

function findCheckboxInSection(section, typeName) {
  const labels = section.querySelectorAll('label');
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

  describe('Render', () => {
    it('should render the step header, resistances and immunities labels', () => {
      render(<WizardStepResistances {...createMockProps()} />);

      expect(screen.getByText('Step 8: Resistances & Immunities')).toBeInTheDocument();
      expect(screen.getByText('Resistances')).toBeInTheDocument();
      expect(screen.getByText('Immunities')).toBeInTheDocument();
    });

    it('should render checkboxes for each resistance type in both sections', async () => {
      render(<WizardStepResistances {...createMockProps()} />);

      await waitFor(() => {
        const resistanceSection = getResistanceSection();
        const immunitySection = getImmunitySection();
        expect(resistanceSection.querySelectorAll('input[type="checkbox"]').length).toBe(mockResistancesData.length);
        expect(immunitySection.querySelectorAll('input[type="checkbox"]').length).toBe(mockResistancesData.length);
      });
    });

    it('should render all resistance type names in both sections', async () => {
      render(<WizardStepResistances {...createMockProps()} />);

      await waitFor(() => {
        const resistanceSection = getResistanceSection();
        const immunitySection = getImmunitySection();
        for (const type of mockResistancesData) {
          expect(resistanceSection.textContent).toContain(type);
          expect(immunitySection.textContent).toContain(type);
        }
      });
    });
  });

  describe('Selected values', () => {
    it('should check the checkbox when a value is in formData', async () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            formData: { resistances: ['Fire'], immunities: ['Cold'] },
          })}
        />
      );

      await waitFor(() => {
        const resistanceSection = getResistanceSection();
        const immunitySection = getImmunitySection();
        expect(findCheckboxInSection(resistanceSection, 'Fire').checked).toBe(true);
        expect(findCheckboxInSection(immunitySection, 'Cold').checked).toBe(true);
      });
    });

    it('should check multiple selected resistances and immunities', async () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            formData: { resistances: ['Fire', 'Cold'], immunities: ['Acid'] },
          })}
        />
      );

      await waitFor(() => {
        const checkedCheckboxes = document.querySelectorAll(
          'input[type="checkbox"]:checked'
        );
        expect(checkedCheckboxes.length).toBe(3);
      });
    });

    it('should not check values that are not selected', async () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            formData: { resistances: ['Fire'] },
          })}
        />
      );

      await waitFor(() => {
        const resistanceSection = getResistanceSection();
        expect(findCheckboxInSection(resistanceSection, 'Acid').checked).toBe(false);
      });
    });
  });

  describe('Pre-selected items', () => {
    it('should show "(Granted)" suffix for pre-selected values', async () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            preSelectedResistances: ['Acid'],
            preSelectedImmunities: ['Cold'],
          })}
        />
      );

      await waitFor(() => {
        const resistanceSection = getResistanceSection();
        const immunitySection = getImmunitySection();
        expect(resistanceSection.textContent).toContain('Acid (Granted)');
        expect(immunitySection.textContent).toContain('Cold (Granted)');
      });
    });

    it('should disable the checkbox when pre-selected and already selected', async () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            preSelectedResistances: ['Fire'],
            formData: { resistances: ['Fire'] },
          })}
        />
      );

      await waitFor(() => {
        const resistanceSection = getResistanceSection();
        expect(findCheckboxInSection(resistanceSection, 'Fire').disabled).toBe(true);
      });
    });

    it('should not disable the checkbox when pre-selected but not yet selected', async () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            preSelectedResistances: ['Fire'],
            formData: { resistances: [] },
          })}
        />
      );

      await waitFor(() => {
        const resistanceSection = getResistanceSection();
        expect(findCheckboxInSection(resistanceSection, 'Fire').disabled).toBe(false);
      });
    });

    it('should apply pre-selected CSS class to the label', async () => {
      render(
        <WizardStepResistances
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

    it('should not apply selected class when pre-selected but not yet selected', async () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            preSelectedResistances: ['Fire'],
            formData: { resistances: [] },
          })}
        />
      );

      await waitFor(() => {
        const resistanceSection = getResistanceSection();
        const fireLabel = Array.from(resistanceSection.querySelectorAll('label')).find(
          (l) => l.querySelector('input[type="checkbox"]') && l.textContent.includes('Fire')
        );
        const classes = fireLabel.className.split(' ').filter(Boolean);
        expect(classes).toContain('pre-selected');
        expect(classes).not.toContain('selected');
      });
    });
  });

  describe('Toggle interactions', () => {
    it('should call the correct toggle callback when a checkbox is clicked', async () => {
      const mockResistanceToggle = vi.fn();
      const mockImmunityToggle = vi.fn();
      render(
        <WizardStepResistances
          {...createMockProps({
            onResistanceToggle: mockResistanceToggle,
            onImmunityToggle: mockImmunityToggle,
          })}
        />
      );

      await waitFor(() => {
        const resistanceSection = getResistanceSection();
        const immunitySection = getImmunitySection();
        const fireResistCheckbox = findCheckboxInSection(resistanceSection, 'Fire');
        const fireImmunityCheckbox = findCheckboxInSection(immunitySection, 'Fire');
        expect(fireResistCheckbox).not.toBeNull();
        expect(fireImmunityCheckbox).not.toBeNull();
        fireEvent.click(fireResistCheckbox);
        fireEvent.click(fireImmunityCheckbox);
      });

      expect(mockResistanceToggle).toHaveBeenCalledWith('Fire');
      expect(mockImmunityToggle).toHaveBeenCalledWith('Fire');
    });

    it('should keep the checkbox checked when a disabled pre-selected checkbox is clicked', async () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            preSelectedResistances: ['Fire'],
            formData: { resistances: ['Fire'] },
          })}
        />
      );

      await waitFor(() => {
        const resistanceSection = getResistanceSection();
        const fireCheckbox = findCheckboxInSection(resistanceSection, 'Fire');
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
        <WizardStepResistances
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

    it('should not render warnings container when warnings is falsy or empty', () => {
      render(<WizardStepResistances {...createMockProps({ warnings: null })} />);
      expect(document.querySelector('.warning-container')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should render without errors when formData or preSelected arrays are null/undefined', () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            formData: {},
            preSelectedResistances: null,
            preSelectedImmunities: undefined,
          })}
        />
      );

      expect(screen.getByText('Step 8: Resistances & Immunities')).toBeInTheDocument();
    });
  });

  describe('Fetch error handling', () => {
    it('should log an error and keep rendering when fetch fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      setupFetchFailure();
      render(<WizardStepResistances {...createMockProps()} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error loading resistances/immunities:',
          expect.any(Error),
        );
      });

      expect(screen.getByText('Step 8: Resistances & Immunities')).toBeInTheDocument();
      consoleSpy.mockRestore();
    });

    it('should render no checkboxes when fetch returns an empty array', async () => {
      setupFetchMock([]);
      render(<WizardStepResistances {...createMockProps()} />);

      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(0);
      });

      expect(screen.getByText('Step 8: Resistances & Immunities')).toBeInTheDocument();
    });
  });
});
