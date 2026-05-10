import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepResistances from './wizard-step-resistances.jsx';

// Mock fetch for loading resistances/immunities data
const mockResistancesData = ['Acid', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Psychic', 'Radiant', 'Thunder'];

global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve(mockResistancesData),
   })
);

describe('WizardStepResistances', () => {
  const mockProps = {
    formData: {
      resistances: [],
      immunities: [],
     },
    onResistanceToggle: vi.fn(),
    onImmunityToggle: vi.fn(),
    warnings: [],
    preSelectedResistances: [],
    preSelectedImmunities: [],
   };

  beforeEach(() => {
    vi.clearAllMocks();
   });

  it('should render the wizard step header', async () => {
    render(<WizardStepResistances {...mockProps} />);
     
    await waitFor(() => {
      expect(screen.getByText('Step 8: Resistances & Immunities')).toBeInTheDocument();
   });
    });

  it('should render the resistances section label', async () => {
    render(<WizardStepResistances {...mockProps} />);
     
    await waitFor(() => {
      const labels = screen.getAllByText('Resistances');
      expect(labels.length).toBeGreaterThan(0);
   });
    });

  it('should render the immunities section label', async () => {
    render(<WizardStepResistances {...mockProps} />);
     
    await waitFor(() => {
      const labels = screen.getAllByText('Immunities');
      expect(labels.length).toBeGreaterThan(0);
   });
    });

  it('should render resistance checkboxes', async () => {
    render(<WizardStepResistances {...mockProps} />);
     
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
   });
    });

  it('should render immunity checkboxes', async () => {
    render(<WizardStepResistances {...mockProps} />);
     
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      // Should have checkboxes for both resistances and immunities
      expect(checkboxes.length).toBe(mockResistancesData.length * 2);
   });
    });

  it('should call onResistanceToggle when resistance checkbox is clicked', async () => {
    render(<WizardStepResistances {...mockProps} />);
     
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      });
      
    expect(mockProps.onResistanceToggle).toHaveBeenCalled();
   });

  it('should call onImmunityToggle when immunity checkbox is clicked', async () => {
    render(<WizardStepResistances {...mockProps} />);
     
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      // Click on an immunity checkbox (second half of checkboxes)
      fireEvent.click(checkboxes[mockResistancesData.length]);
      });
      
    expect(mockProps.onImmunityToggle).toHaveBeenCalled();
   });

  it('should display warnings when provided', async () => {
    const propsWithWarnings = {
       ...mockProps,
      warnings: [
          { type: 'error', message: 'Too many resistances selected' },
          { type: 'warning', message: 'Consider your class limitations' },
         ],
      };
      
    render(<WizardStepResistances {...propsWithWarnings} />);
     
    await waitFor(() => {
      expect(screen.getByText('Too many resistances selected')).toBeInTheDocument();
      expect(screen.getByText('Consider your class limitations')).toBeInTheDocument();
   });
    });

  it('should not display warnings when warnings array is empty', async () => {
    render(<WizardStepResistances {...mockProps} />);
     
    await waitFor(() => {
      expect(document.querySelector('.warning-container')).not.toBeInTheDocument();
   });
    });

  it('should mark resistance as selected when in formData', async () => {
    const propsWithSelected = {
       ...mockProps,
      formData: {
         ...mockProps.formData,
        resistances: ['Fire'],
         },
      };
      
    render(<WizardStepResistances {...propsWithSelected} />);
     
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
       // Fire is the 3rd item in resistances (index 2)
      expect(checkboxes[2]).toBeChecked();
      });
    });

  it('should mark immunity as selected when in formData', async () => {
    const propsWithSelected = {
       ...mockProps,
      formData: {
         ...mockProps.formData,
        immunities: ['Cold'],
         },
      };
      
    render(<WizardStepResistances {...propsWithSelected} />);
     
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
       // Cold is the 2nd item in immunities (index 1 + 9 = 10)
      expect(checkboxes[10]).toBeChecked();
      });
    });

  it('should show granted label for pre-selected resistances', async () => {
    const propsWithPreSelected = {
       ...mockProps,
      preSelectedResistances: ['Acid'],
      };
      
    render(<WizardStepResistances {...propsWithPreSelected} />);
     
    await waitFor(() => {
      expect(screen.getByText('Acid (Granted)')).toBeInTheDocument();
   });
    });

  it('should show granted label for pre-selected immunities', async () => {
    const propsWithPreSelected = {
       ...mockProps,
      preSelectedImmunities: ['Cold'],
      };
      
    render(<WizardStepResistances {...propsWithPreSelected} />);
     
    await waitFor(() => {
      expect(screen.getByText('Cold (Granted)')).toBeInTheDocument();
   });
    });

  it('should enable pre-selected resistance checkbox when not selected', async () => {
    const propsWithPreSelected = {
       ...mockProps,
      preSelectedResistances: ['Fire'],
      formData: {
         ...mockProps.formData,
        resistances: [], // Fire is not selected
         },
      };
      
    render(<WizardStepResistances {...propsWithPreSelected} />);
     
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
       // Fire is the 3rd item in resistances (index 2)
      expect(checkboxes[2]).not.toBeDisabled();
      });
    });

  it('should disable pre-selected resistance checkbox when selected', async () => {
    const propsWithPreSelected = {
       ...mockProps,
      preSelectedResistances: ['Fire'],
      formData: {
         ...mockProps.formData,
        resistances: ['Fire'], // Fire is selected
         },
      };
      
    render(<WizardStepResistances {...propsWithPreSelected} />);
     
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
       // Fire is the 3rd item in resistances (index 2)
      expect(checkboxes[2]).toBeDisabled();
      });
    });

  it('should handle multiple resistances and immunities', async () => {
    const propsWithMultiple = {
       ...mockProps,
      formData: {
         resistances: ['Fire', 'Cold'],
        immunities: ['Acid'],
         },
      };
      
    render(<WizardStepResistances {...propsWithMultiple} />);
     
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      const checkedCheckboxes = checkboxes.filter(cb => cb.checked);
      expect(checkedCheckboxes.length).toBe(3); // 2 resistances + 1 immunity
   });
    });

  it('should render with empty formData', async () => {
    const propsWithEmptyFormData = {
       ...mockProps,
      formData: {},
      };
      
    render(<WizardStepResistances {...propsWithEmptyFormData} />);
     
    await waitFor(() => {
      expect(screen.getByText('Step 8: Resistances & Immunities')).toBeInTheDocument();
   });
    });

  it('should render all resistance types from fetched data', async () => {
    render(<WizardStepResistances {...mockProps} />);
     
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
       // Should have 2 checkboxes for each type (one for resistance, one for immunity)
      expect(checkboxes.length).toBe(mockResistancesData.length * 2);
      });
    });
});