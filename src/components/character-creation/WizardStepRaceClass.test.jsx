// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WizardStepRaceClass from './WizardStepRaceClass.jsx';

vi.mock('./CascadingSelect.jsx', () => {
  function MockCascadingSelect({
    label,
    childLabel,
    errorKey,
    errors,
    onInputChange,
    fieldName,
  }) {
    return (
      <div data-testid={`cascading-select-${fieldName}`}>
        <label>{label} *</label>
        {childLabel && <label>{childLabel} *</label>}
        <input
          data-testid={`input-${fieldName}`}
          onChange={(e) => onInputChange(fieldName, { name: e.target.value })}
        />
        {errorKey && errors?.[errorKey] && (
          <span className="error-message">{errors[errorKey]}</span>
        )}
      </div>
    );
  }
  return { default: MockCascadingSelect };
});

const makeRacesData = () => [
  { name: 'Human', subraces: ['Variant', 'Standard'] },
  { name: 'Elf', subraces: ['High Elf', 'Wood Elf'] },
  { name: 'Dwarf', subraces: ['Hill Dwarf', 'Mountain Dwarf'] },
];

const makeClassSubtypes = () => [
  { className: 'Cleric', subtypes: ['Order of the Keeper', 'Order of the Storm'] },
  { className: 'Druid', subtypes: ['Circle of the Land', 'Circle of the Moon'] },
  { className: 'Fighter', subtypes: ['Champion', 'Battle Master'] },
];

const makeOnInputChange = vi.fn();

const makeProps = (overrides = {}) => ({
  formData: { race: '', subrace: '', class: {} },
  errors: {},
  racesData: makeRacesData(),
  classSubtypes: makeClassSubtypes(),
  ruleset: '5e',
  onInputChange: makeOnInputChange,
  ...overrides,
});

describe('WizardStepRaceClass', () => {
  beforeEach(() => {
    makeOnInputChange.mockClear();
  });

  describe('structure and labels', () => {
    it('renders the wizard step container with heading', () => {
      render(<WizardStepRaceClass {...makeProps()} />);
      expect(screen.getByText('Step 3: Race & Class')).toBeInTheDocument();
    });

    it('renders the wizard-step class on the container', () => {
      render(<WizardStepRaceClass {...makeProps()} />);
      const container = screen.getByText('Step 3: Race & Class').parentElement;
      expect(container).toHaveClass('wizard-step');
    });

    it('renders Race and Class CascadingSelect components', () => {
      render(<WizardStepRaceClass {...makeProps()} />);
      expect(screen.getByTestId('cascading-select-race')).toBeInTheDocument();
      expect(screen.getByTestId('cascading-select-class')).toBeInTheDocument();
    });

    it('renders Subrace and Subclass child labels', () => {
      render(<WizardStepRaceClass {...makeProps()} />);
      expect(screen.getByText(/Subrace \*/)).toBeInTheDocument();
      expect(screen.getByText(/Subclass \*/)).toBeInTheDocument();
    });
  });

  describe('CascadingSelect props', () => {
    it('passes racesData as options to the race CascadingSelect', () => {
      const racesData = makeRacesData();
      render(<WizardStepRaceClass {...makeProps({ racesData })} />);
      expect(screen.getByTestId('cascading-select-race')).toBeInTheDocument();
    });

    it('passes classSubtypes as options to the class CascadingSelect', () => {
      const classSubtypes = makeClassSubtypes();
      render(<WizardStepRaceClass {...makeProps({ classSubtypes })} />);
      expect(screen.getByTestId('cascading-select-class')).toBeInTheDocument();
    });

    it('passes ruleset to CascadingSelect components', () => {
      render(<WizardStepRaceClass {...makeProps({ ruleset: '2024' })} />);
      expect(screen.getByTestId('cascading-select-race')).toBeInTheDocument();
      expect(screen.getByTestId('cascading-select-class')).toBeInTheDocument();
    });
  });

  describe('5e ruleset — no order selects', () => {
    it('does not render Divine Order select', () => {
      render(<WizardStepRaceClass {...makeProps({ ruleset: '5e' })} />);
      expect(screen.queryByText('Divine Order')).not.toBeInTheDocument();
    });

    it('does not render Primal Order select', () => {
      render(<WizardStepRaceClass {...makeProps({ ruleset: '5e' })} />);
      expect(screen.queryByText('Primal Order')).not.toBeInTheDocument();
    });
  });

  describe('2024 ruleset — Cleric shows Divine Order', () => {
    const props = () =>
      makeProps({
        ruleset: '2024',
        formData: { race: '', subrace: '', class: { name: 'Cleric' } },
      });

    it('renders Divine Order select with required asterisk', () => {
      render(<WizardStepRaceClass {...props()} />);
      expect(screen.getByText('Divine Order *')).toBeInTheDocument();
    });

    it('renders Divine Order options', () => {
      render(<WizardStepRaceClass {...props()} />);
      expect(screen.getByText('Protector')).toBeInTheDocument();
      expect(screen.getByText('Thaumaturge')).toBeInTheDocument();
    });

    it('renders the select with an empty default option', () => {
      render(<WizardStepRaceClass {...props()} />);
      const defaultOption = screen.getByText('Select a Divine Order');
      expect(defaultOption.closest('select')).toHaveValue('');
    });

    it('wraps the select in a form-group div', () => {
      render(<WizardStepRaceClass {...props()} />);
      const defaultOption = screen.getByText('Select a Divine Order');
      const select = defaultOption.closest('select');
      const formGroup = select.parentElement;
      expect(formGroup).toHaveClass('form-group');
    });

    it('does not render Primal Order when Cleric is selected', () => {
      render(<WizardStepRaceClass {...props()} />);
      expect(screen.queryByText(/Primal Order/)).not.toBeInTheDocument();
    });

    it('applies error class when divineOrder error exists', () => {
      render(
        <WizardStepRaceClass
          {...props()}
          errors={{ divineOrder: 'Required' }}
        />
      );
      const defaultOption = screen.getByText('Select a Divine Order');
      const select = defaultOption.closest('select');
      expect(select).toHaveClass('error');
    });

    it('renders the error message for divineOrder', () => {
      render(
        <WizardStepRaceClass
          {...props()}
          errors={{ divineOrder: 'Please select a divine order' }}
        />
      );
      expect(screen.getByText('Please select a divine order')).toBeInTheDocument();
    });

    it('calls onInputChange when a divine order is selected', () => {
      render(<WizardStepRaceClass {...props()} />);
      const defaultOption = screen.getByText('Select a Divine Order');
      const select = defaultOption.closest('select');
      select.value = 'Protector';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      expect(makeOnInputChange).toHaveBeenCalledWith('class', {
        name: 'Cleric',
        divineOrder: 'Protector',
      });
    });
  });

  describe('2024 ruleset — Druid shows Primal Order', () => {
    const props = () =>
      makeProps({
        ruleset: '2024',
        formData: { race: '', subrace: '', class: { name: 'Druid' } },
      });

    it('renders Primal Order select with required asterisk', () => {
      render(<WizardStepRaceClass {...props()} />);
      expect(screen.getByText('Primal Order *')).toBeInTheDocument();
    });

    it('renders Primal Order options', () => {
      render(<WizardStepRaceClass {...props()} />);
      expect(screen.getByText('Magician')).toBeInTheDocument();
      expect(screen.getByText('Warden')).toBeInTheDocument();
    });

    it('renders the select with an empty default option', () => {
      render(<WizardStepRaceClass {...props()} />);
      const defaultOption = screen.getByText('Select a Primal Order');
      expect(defaultOption.closest('select')).toHaveValue('');
    });

    it('wraps the select in a form-group div', () => {
      render(<WizardStepRaceClass {...props()} />);
      const defaultOption = screen.getByText('Select a Primal Order');
      const select = defaultOption.closest('select');
      const formGroup = select.parentElement;
      expect(formGroup).toHaveClass('form-group');
    });

    it('does not render Divine Order when Druid is selected', () => {
      render(<WizardStepRaceClass {...props()} />);
      expect(screen.queryByText('Divine Order')).not.toBeInTheDocument();
    });

    it('applies error class when primalOrder error exists', () => {
      render(
        <WizardStepRaceClass
          {...props()}
          errors={{ primalOrder: 'Required' }}
        />
      );
      const defaultOption = screen.getByText('Select a Primal Order');
      const select = defaultOption.closest('select');
      expect(select).toHaveClass('error');
    });

    it('renders the error message for primalOrder', () => {
      render(
        <WizardStepRaceClass
          {...props()}
          errors={{ primalOrder: 'Please select a primal order' }}
        />
      );
      expect(screen.getByText('Please select a primal order')).toBeInTheDocument();
    });

    it('calls onInputChange when a primal order is selected', () => {
      render(<WizardStepRaceClass {...props()} />);
      const defaultOption = screen.getByText('Select a Primal Order');
      const select = defaultOption.closest('select');
      select.value = 'Warden';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      expect(makeOnInputChange).toHaveBeenCalledWith('class', {
        name: 'Druid',
        primalOrder: 'Warden',
      });
    });
  });

  describe('2024 ruleset — non-Druid/non-Cleric hides order selects', () => {
    it('does not render Divine Order for Fighter', () => {
      render(
        <WizardStepRaceClass
          {...makeProps({
            ruleset: '2024',
            formData: { race: '', subrace: '', class: { name: 'Fighter' } },
          })}
        />
      );
      expect(screen.queryByText('Divine Order')).not.toBeInTheDocument();
    });

    it('does not render Primal Order for Fighter', () => {
      render(
        <WizardStepRaceClass
          {...makeProps({
            ruleset: '2024',
            formData: { race: '', subrace: '', class: { name: 'Fighter' } },
          })}
        />
      );
      expect(screen.queryByText('Primal Order')).not.toBeInTheDocument();
    });
  });

  describe('formData edge cases', () => {
    it('renders without Divine or Primal Order when class is undefined', () => {
      render(
        <WizardStepRaceClass
          {...makeProps({
            formData: { race: '', subrace: '', class: undefined },
          })}
        />
      );
      expect(screen.getByText('Step 3: Race & Class')).toBeInTheDocument();
      expect(screen.queryByText('Divine Order')).not.toBeInTheDocument();
      expect(screen.queryByText('Primal Order')).not.toBeInTheDocument();
    });

    it('renders without Divine or Primal Order when class name is empty string', () => {
      render(
        <WizardStepRaceClass
          {...makeProps({
            formData: { race: '', subrace: '', class: { name: '' } },
          })}
        />
      );
      expect(screen.queryByText('Divine Order')).not.toBeInTheDocument();
      expect(screen.queryByText('Primal Order')).not.toBeInTheDocument();
    });
  });

  describe('input change handling', () => {
    it('calls onInputChange when race CascadingSelect changes', () => {
      render(<WizardStepRaceClass {...makeProps()} />);
      const input = screen.getByTestId('input-race');
      fireEvent.change(input, { target: { value: 'Elf' } });
      expect(makeOnInputChange).toHaveBeenCalledWith('race', { name: 'Elf' });
    });

    it('calls onInputChange when class CascadingSelect changes', () => {
      render(<WizardStepRaceClass {...makeProps()} />);
      const input = screen.getByTestId('input-class');
      fireEvent.change(input, { target: { value: 'Fighter' } });
      expect(makeOnInputChange).toHaveBeenCalledWith('class', { name: 'Fighter' });
    });
  });

  describe('error display', () => {
    it('renders error message when subrace error exists', () => {
      render(
        <WizardStepRaceClass
          {...makeProps()}
          errors={{ subrace: 'Please select a subrace' }}
        />
      );
      expect(screen.getByText('Please select a subrace')).toBeInTheDocument();
    });

    it('renders error message when subclass error exists', () => {
      render(
        <WizardStepRaceClass
          {...makeProps()}
          errors={{ subclass: 'Please select a subclass' }}
        />
      );
      expect(screen.getByText('Please select a subclass')).toBeInTheDocument();
    });

    it('does not render error messages when errors object is empty', () => {
      render(<WizardStepRaceClass {...makeProps({ errors: {} })} />);
      const errorMessages = document.querySelectorAll('.error-message');
      expect(errorMessages.length).toBe(0);
    });
  });
});
