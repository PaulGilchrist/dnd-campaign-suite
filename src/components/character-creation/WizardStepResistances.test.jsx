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

  describe('Render — header and section labels', () => {
    it('should render the step header', () => {
      render(<WizardStepResistances {...createMockProps()} />);

      expect(screen.getByText('Step 8: Resistances & Immunities')).toBeInTheDocument();
    });

    it('should render the resistances section label', () => {
      render(<WizardStepResistances {...createMockProps()} />);

      expect(screen.getByText('Resistances')).toBeInTheDocument();
    });

    it('should render the immunities section label', () => {
      render(<WizardStepResistances {...createMockProps()} />);

      expect(screen.getByText('Immunities')).toBeInTheDocument();
    });
  });

  describe('Render — checkboxes', () => {
    it('should render a checkbox for each resistance type in the resistance section', async () => {
      render(<WizardStepResistances {...createMockProps()} />);

      await waitFor(() => {
        const resistanceSection = getResistanceSection();
        const checkboxes = resistanceSection.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(mockResistancesData.length);
      });
    });

    it('should render a checkbox for each resistance type in the immunity section', async () => {
      render(<WizardStepResistances {...createMockProps()} />);

      await waitFor(() => {
        const immunitySection = getImmunitySection();
        const checkboxes = immunitySection.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(mockResistancesData.length);
      });
    });

    it('should render all resistance type names in the resistance section', async () => {
      render(<WizardStepResistances {...createMockProps()} />);

      await waitFor(() => {
        const resistanceSection = getResistanceSection();
        for (const type of mockResistancesData) {
          expect(resistanceSection.textContent).toContain(type);
        }
      });
    });

    it('should render all immunity type names in the immunity section', async () => {
      render(<WizardStepResistances {...createMockProps()} />);

      await waitFor(() => {
        const immunitySection = getImmunitySection();
        for (const type of mockResistancesData) {
          expect(immunitySection.textContent).toContain(type);
        }
      });
    });
  });

  describe('Render — selected values', () => {
    it('should check the resistance checkbox when a resistance is in formData.resistances', async () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            formData: { resistances: ['Fire'] },
          })}
        />
      );

      await waitFor(() => {
        const resistanceSection = getResistanceSection();
        const fireCheckbox = findCheckboxInSection(resistanceSection, 'Fire');
        expect(fireCheckbox.checked).toBe(true);
      });
    });

    it('should check the immunity checkbox when an immunity is in formData.immunities', async () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            formData: { immunities: ['Cold'] },
          })}
        />
      );

      await waitFor(() => {
        const immunitySection = getImmunitySection();
        const coldCheckbox = findCheckboxInSection(immunitySection, 'Cold');
        expect(coldCheckbox.checked).toBe(true);
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

    it('should not check resistances that are not in formData.resistances', async () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            formData: { resistances: ['Fire'] },
          })}
        />
      );

      await waitFor(() => {
        const resistanceSection = getResistanceSection();
        const acidCheckbox = findCheckboxInSection(resistanceSection, 'Acid');
        expect(acidCheckbox.checked).toBe(false);
      });
    });

    it('should not check immunities that are not in formData.immunities', async () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            formData: { immunities: ['Cold'] },
          })}
        />
      );

      await waitFor(() => {
        const immunitySection = getImmunitySection();
        const acidCheckbox = findCheckboxInSection(immunitySection, 'Acid');
        expect(acidCheckbox.checked).toBe(false);
      });
    });
  });

  describe('Render — pre-selected items', () => {
    it('should show "(Granted)" suffix for pre-selected resistances', async () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            preSelectedResistances: ['Acid'],
          })}
        />
      );

      await waitFor(() => {
        const resistanceSection = getResistanceSection();
        expect(resistanceSection.textContent).toContain('Acid (Granted)');
      });
    });

    it('should show "(Granted)" suffix for pre-selected immunities', async () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            preSelectedImmunities: ['Cold'],
          })}
        />
      );

      await waitFor(() => {
        const immunitySection = getImmunitySection();
        expect(immunitySection.textContent).toContain('Cold (Granted)');
      });
    });

    it('should disable the resistance checkbox when pre-selected and already selected', async () => {
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
      });
    });

    it('should disable the immunity checkbox when pre-selected and already selected', async () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            preSelectedImmunities: ['Fire'],
            formData: { immunities: ['Fire'] },
          })}
        />
      );

      await waitFor(() => {
        const immunitySection = getImmunitySection();
        const fireCheckbox = findCheckboxInSection(immunitySection, 'Fire');
        expect(fireCheckbox.disabled).toBe(true);
      });
    });

    it('should not disable the resistance checkbox when pre-selected but not yet selected', async () => {
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
        const fireCheckbox = findCheckboxInSection(resistanceSection, 'Fire');
        expect(fireCheckbox.disabled).toBe(false);
      });
    });

    it('should not disable the immunity checkbox when pre-selected but not yet selected', async () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            preSelectedImmunities: ['Fire'],
            formData: { immunities: [] },
          })}
        />
      );

      await waitFor(() => {
        const immunitySection = getImmunitySection();
        const fireCheckbox = findCheckboxInSection(immunitySection, 'Fire');
        expect(fireCheckbox.disabled).toBe(false);
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

    it('should not apply selected class when pre-selected but not yet selected (resistance)', async () => {
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
    it('should call onResistanceToggle with the correct type when a resistance checkbox is clicked', async () => {
      const mockToggle = vi.fn();
      render(
        <WizardStepResistances
          {...createMockProps({
            onResistanceToggle: mockToggle,
          })}
        />
      );

      await waitFor(() => {
        const resistanceSection = getResistanceSection();
        const fireCheckbox = findCheckboxInSection(resistanceSection, 'Fire');
        expect(fireCheckbox).not.toBeNull();
        fireEvent.click(fireCheckbox);
      });

      expect(mockToggle).toHaveBeenCalledWith('Fire');
    });

    it('should call onImmunityToggle with the correct type when an immunity checkbox is clicked', async () => {
      const mockToggle = vi.fn();
      render(
        <WizardStepResistances
          {...createMockProps({
            onImmunityToggle: mockToggle,
          })}
        />
      );

      await waitFor(() => {
        const immunitySection = getImmunitySection();
        const fireCheckbox = findCheckboxInSection(immunitySection, 'Fire');
        expect(fireCheckbox).not.toBeNull();
        fireEvent.click(fireCheckbox);
      });

      expect(mockToggle).toHaveBeenCalledWith('Fire');
    });

    it('should keep the resistance checkbox checked when a disabled pre-selected checkbox is clicked', async () => {
      const mockToggle = vi.fn();
      render(
        <WizardStepResistances
          {...createMockProps({
            preSelectedResistances: ['Fire'],
            formData: { resistances: ['Fire'] },
            onResistanceToggle: mockToggle,
          })}
        />
      );

      await waitFor(() => {
        const resistanceSection = getResistanceSection();
        const fireCheckbox = findCheckboxInSection(resistanceSection, 'Fire');
        expect(fireCheckbox).not.toBeNull();
        expect(fireCheckbox.disabled).toBe(true);
        expect(fireCheckbox.checked).toBe(true);
        fireEvent.click(fireCheckbox);
        expect(fireCheckbox.checked).toBe(true);
      });
    });

    it('should keep the immunity checkbox checked when a disabled pre-selected checkbox is clicked', async () => {
      const mockToggle = vi.fn();
      render(
        <WizardStepResistances
          {...createMockProps({
            preSelectedImmunities: ['Fire'],
            formData: { immunities: ['Fire'] },
            onImmunityToggle: mockToggle,
          })}
        />
      );

      await waitFor(() => {
        const immunitySection = getImmunitySection();
        const fireCheckbox = findCheckboxInSection(immunitySection, 'Fire');
        expect(fireCheckbox).not.toBeNull();
        expect(fireCheckbox.disabled).toBe(true);
        expect(fireCheckbox.checked).toBe(true);
        fireEvent.click(fireCheckbox);
        expect(fireCheckbox.checked).toBe(true);
      });
    });

    it('should toggle a non-pre-selected resistance checkbox', async () => {
      const mockToggle = vi.fn();
      render(
        <WizardStepResistances
          {...createMockProps({
            onResistanceToggle: mockToggle,
            formData: { immunities: ['Fire'] },
          })}
        />
      );

      await waitFor(() => {
        const resistanceSection = getResistanceSection();
        const fireCheckbox = findCheckboxInSection(resistanceSection, 'Fire');
        expect(fireCheckbox).not.toBeNull();
        expect(fireCheckbox.disabled).toBe(false);
        fireEvent.click(fireCheckbox);
      });

      expect(mockToggle).toHaveBeenCalledWith('Fire');
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

    it('should not render warnings container when warnings array is empty', () => {
      render(<WizardStepResistances {...createMockProps({ warnings: [] })} />);

      expect(document.querySelector('.warning-container')).not.toBeInTheDocument();
    });

    it('should not render warnings container when warnings is null', () => {
      render(<WizardStepResistances {...createMockProps({ warnings: null })} />);

      expect(document.querySelector('.warning-container')).not.toBeInTheDocument();
    });

    it('should not render warnings container when warnings is undefined', () => {
      render(<WizardStepResistances {...createMockProps({ warnings: undefined })} />);

      expect(document.querySelector('.warning-container')).not.toBeInTheDocument();
    });
  });

  describe('Empty / missing formData', () => {
    it('should render without errors when formData is an empty object', () => {
      render(<WizardStepResistances {...createMockProps({ formData: {} })} />);

      expect(screen.getByText('Step 8: Resistances & Immunities')).toBeInTheDocument();
    });

    it('should render without errors when formData.resistances is undefined', () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            formData: { immunities: [] },
          })}
        />
      );

      expect(screen.getByText('Step 8: Resistances & Immunities')).toBeInTheDocument();
    });

    it('should render without errors when formData.immunities is undefined', () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            formData: { resistances: [] },
          })}
        />
      );

      expect(screen.getByText('Step 8: Resistances & Immunities')).toBeInTheDocument();
    });

    it('should render without errors when preSelectedResistances is null', () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            preSelectedResistances: null,
          })}
        />
      );

      expect(screen.getByText('Step 8: Resistances & Immunities')).toBeInTheDocument();
    });

    it('should render without errors when preSelectedImmunities is null', () => {
      render(
        <WizardStepResistances
          {...createMockProps({
            preSelectedImmunities: null,
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
