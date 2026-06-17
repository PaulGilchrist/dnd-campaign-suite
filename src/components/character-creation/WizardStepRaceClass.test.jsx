import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WizardStepRaceClass from './WizardStepRaceClass.jsx';

vi.mock('./CascadingSelect.jsx', () => ({
  default: function CascadingSelect({ label, childLabel, fieldName, errorKey, errors, formData, onInputChange }) {
    return (
      <div data-testid={`cascading-select-${fieldName}`}>
        <label>{label}</label>
        {childLabel && <label>{childLabel}</label>}
        <input
          data-testid={`input-${fieldName}`}
          value={typeof fieldName === 'string' ? formData[fieldName] || '' : formData[fieldName]?.name || ''}
          onChange={(e) => onInputChange(fieldName, typeof fieldName === 'string' ? e.target.value : { ...formData[fieldName], name: e.target.value })}
        />
        {errors && errorKey && errors[errorKey] && (
          <span className="error-message">{errors[errorKey]}</span>
        )}
      </div>
    );
  },
}));

const baseProps = {
  formData: { race: '', subrace: '', class: {} },
  errors: {},
  racesData: [
    { name: 'Human', subraces: ['Variant', 'Standard'] },
    { name: 'Elf', subraces: ['High Elf', 'Wood Elf'] },
    { name: 'Dwarf', subraces: ['Hill Dwarf', 'Mountain Dwarf'] },
  ],
  classSubtypes: [
    { className: 'Cleric', subtypes: ['Order of the Keeper', 'Order of the Storm'] },
    { className: 'Druid', subtypes: ['Circle of the Land', 'Circle of the Moon'] },
    { className: 'Fighter', subtypes: ['Champion', 'Battle Master'] },
  ],
  ruleset: '5e',
  onInputChange: vi.fn((field, value) => {
    baseProps.formData[field] = value;
  }),
};

describe('WizardStepRaceClass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the wizard step container', () => {
    render(<WizardStepRaceClass {...baseProps} />);
    expect(screen.getByText('Step 3: Race & Class')).toBeInTheDocument();
  });

  it('renders Race CascadingSelect', () => {
    render(<WizardStepRaceClass {...baseProps} />);
    expect(screen.getByTestId('cascading-select-race')).toBeInTheDocument();
  });

  it('renders Class CascadingSelect', () => {
    render(<WizardStepRaceClass {...baseProps} />);
    expect(screen.getByTestId('cascading-select-class')).toBeInTheDocument();
  });

  it('renders Race label', () => {
    render(<WizardStepRaceClass {...baseProps} />);
    expect(screen.getByText('Race')).toBeInTheDocument();
  });

  it('renders Class label', () => {
    render(<WizardStepRaceClass {...baseProps} />);
    expect(screen.getByText('Class')).toBeInTheDocument();
  });

  it('renders Subrace label for race cascading select', () => {
    render(<WizardStepRaceClass {...baseProps} />);
    expect(screen.getByText('Subrace')).toBeInTheDocument();
  });

  it('renders Subclass label for class cascading select', () => {
    render(<WizardStepRaceClass {...baseProps} />);
    expect(screen.getByText('Subclass')).toBeInTheDocument();
  });

  it('does not render Divine Order select for non-2024 rules', () => {
    render(<WizardStepRaceClass {...baseProps} ruleset="5e" />);
    expect(screen.queryByText('Divine Order')).not.toBeInTheDocument();
  });

  it('does not render Divine Order select for 2024 rules with non-Cleric', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      ruleset="2024"
      formData={{ ...baseProps.formData, class: { name: 'Fighter' } }}
    />);
    expect(screen.queryByText('Divine Order')).not.toBeInTheDocument();
  });

  it('renders Divine Order select for 2024 Cleric', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      ruleset="2024"
      formData={{ ...baseProps.formData, class: { name: 'Cleric' } }}
    />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders Divine Order options for 2024 Cleric', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      ruleset="2024"
      formData={{ ...baseProps.formData, class: { name: 'Cleric' } }}
    />);
    expect(screen.getByText('Protector')).toBeInTheDocument();
    expect(screen.getByText('Thaumaturge')).toBeInTheDocument();
  });

  it('does not render Primal Order select for non-2024 rules', () => {
    render(<WizardStepRaceClass {...baseProps} ruleset="5e" />);
    expect(screen.queryByText('Primal Order')).not.toBeInTheDocument();
  });

  it('does not render Primal Order select for 2024 rules with non-Druid', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      ruleset="2024"
      formData={{ ...baseProps.formData, class: { name: 'Fighter' } }}
    />);
    expect(screen.queryByText('Primal Order')).not.toBeInTheDocument();
  });

  it('renders Primal Order select for 2024 Druid', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      ruleset="2024"
      formData={{ ...baseProps.formData, class: { name: 'Druid' } }}
    />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders Primal Order options for 2024 Druid', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      ruleset="2024"
      formData={{ ...baseProps.formData, class: { name: 'Druid' } }}
    />);
    expect(screen.getByText('Magician')).toBeInTheDocument();
    expect(screen.getByText('Warden')).toBeInTheDocument();
  });

  it('does not render Primal Order when Cleric selected in 2024', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      ruleset="2024"
      formData={{ ...baseProps.formData, class: { name: 'Cleric' } }}
    />);
    expect(screen.queryByText(/Primal Order/)).not.toBeInTheDocument();
  });

  it('does not render Divine Order when Druid selected in 2024', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      ruleset="2024"
      formData={{ ...baseProps.formData, class: { name: 'Druid' } }}
    />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByText('Divine Order')).not.toBeInTheDocument();
  });

  it('calls onInputChange when race input changes', () => {
    render(<WizardStepRaceClass {...baseProps} />);
    const raceInput = screen.getByTestId('input-race');
    fireEvent.change(raceInput, { target: { value: 'Human' } });
    expect(baseProps.onInputChange).toHaveBeenCalled();
  });

  it('calls onInputChange when class input changes', () => {
    render(<WizardStepRaceClass {...baseProps} />);
    const classInput = screen.getByTestId('input-class');
    fireEvent.change(classInput, { target: { value: 'Fighter' } });
    expect(baseProps.onInputChange).toHaveBeenCalled();
  });

  it('renders error message when race error exists', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      errors={{ subrace: 'Please select a subrace' }}
    />);
    expect(screen.getByText('Please select a subrace')).toBeInTheDocument();
  });

  it('renders error message when divineOrder error exists', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      ruleset="2024"
      formData={{ ...baseProps.formData, class: { name: 'Cleric' } }}
      errors={{ divineOrder: 'Please select a divine order' }}
    />);
    expect(screen.getByText('Please select a divine order')).toBeInTheDocument();
  });

  it('renders error message when primalOrder error exists', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      ruleset="2024"
      formData={{ ...baseProps.formData, class: { name: 'Druid' } }}
      errors={{ primalOrder: 'Please select a primal order' }}
    />);
    expect(screen.getByText('Please select a primal order')).toBeInTheDocument();
  });

  it('renders error class on divineOrder error', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      ruleset="2024"
      formData={{ ...baseProps.formData, class: { name: 'Cleric' } }}
      errors={{ divineOrder: 'Required' }}
    />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveClass('error');
  });

  it('renders error class on primalOrder error', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      ruleset="2024"
      formData={{ ...baseProps.formData, class: { name: 'Druid' } }}
      errors={{ primalOrder: 'Required' }}
    />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveClass('error');
  });

  it('renders select with default option for Divine Order', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      ruleset="2024"
      formData={{ ...baseProps.formData, class: { name: 'Cleric' } }}
    />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('');
  });

  it('renders select with default option for Primal Order', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      ruleset="2024"
      formData={{ ...baseProps.formData, class: { name: 'Druid' } }}
    />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('');
  });

  it('renders wizard-step class on container', () => {
    render(<WizardStepRaceClass {...baseProps} />);
    const container = screen.getByText('Step 3: Race & Class').parentElement;
    expect(container).toHaveClass('wizard-step');
  });

  it('renders form-group class on Divine Order form group', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      ruleset="2024"
      formData={{ ...baseProps.formData, class: { name: 'Cleric' } }}
    />);
    const formGroup = screen.getByRole('combobox').parentElement;
    expect(formGroup).toHaveClass('form-group');
  });

  it('renders form-group class on Primal Order form group', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      ruleset="2024"
      formData={{ ...baseProps.formData, class: { name: 'Druid' } }}
    />);
    const formGroup = screen.getByRole('combobox').parentElement;
    expect(formGroup).toHaveClass('form-group');
  });

  it('renders required asterisk on Divine Order label', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      ruleset="2024"
      formData={{ ...baseProps.formData, class: { name: 'Cleric' } }}
    />);
    expect(screen.getByText('Divine Order *')).toBeInTheDocument();
  });

  it('renders required asterisk on Primal Order label', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      ruleset="2024"
      formData={{ ...baseProps.formData, class: { name: 'Druid' } }}
    />);
    expect(screen.getByText('Primal Order *')).toBeInTheDocument();
  });

  it('passes racesData to CascadingSelect', () => {
    render(<WizardStepRaceClass {...baseProps} />);
    expect(screen.getByTestId('cascading-select-race')).toBeInTheDocument();
  });

  it('passes classSubtypes to CascadingSelect', () => {
    render(<WizardStepRaceClass {...baseProps} />);
    expect(screen.getByTestId('cascading-select-class')).toBeInTheDocument();
  });

  it('passes ruleset to CascadingSelect components', () => {
    render(<WizardStepRaceClass {...baseProps} ruleset="2024" />);
    expect(screen.getByTestId('cascading-select-race')).toBeInTheDocument();
    expect(screen.getByTestId('cascading-select-class')).toBeInTheDocument();
  });

  it('handles undefined class in formData', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      formData={{ ...baseProps.formData, class: undefined }}
    />);
    expect(screen.getByText('Step 3: Race & Class')).toBeInTheDocument();
    expect(screen.queryByText('Divine Order')).not.toBeInTheDocument();
    expect(screen.queryByText('Primal Order')).not.toBeInTheDocument();
  });

  it('handles empty class name in formData', () => {
    render(<WizardStepRaceClass
      {...baseProps}
      formData={{ ...baseProps.formData, class: { name: '' } }}
    />);
    expect(screen.getByText('Step 3: Race & Class')).toBeInTheDocument();
    expect(screen.queryByText('Divine Order')).not.toBeInTheDocument();
    expect(screen.queryByText('Primal Order')).not.toBeInTheDocument();
  });
});
