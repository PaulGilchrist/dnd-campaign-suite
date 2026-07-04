// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WizardStepRaceClass from './WizardStepRaceClass.jsx';

const mockCascadingSelectProps = vi.fn();

vi.mock('./CascadingSelect.jsx', () => {
  function MockCascadingSelect(props) {
    mockCascadingSelectProps(props);
    const {
      label,
      childLabel,
      errorKey,
      errors,
      onInputChange,
      fieldName,
    } = props;
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
    mockCascadingSelectProps.mockClear();
  });

  describe('structure and labels', () => {
    it('renders the wizard step container with heading, race/class selects, and subrace/subclass child labels', () => {
      render(<WizardStepRaceClass {...makeProps()} />);
      expect(screen.getByText('Step 3: Race & Class')).toBeInTheDocument();
      expect(screen.getByTestId('cascading-select-race')).toBeInTheDocument();
      expect(screen.getByTestId('cascading-select-class')).toBeInTheDocument();
      expect(screen.getByText(/Subrace \*/)).toBeInTheDocument();
      expect(screen.getByText(/Subclass \*/)).toBeInTheDocument();
    });
  });

  describe('2024 ruleset — Cleric shows Divine Order', () => {
    const props = () =>
      makeProps({
        ruleset: '2024',
        formData: { race: '', subrace: '', class: { name: 'Cleric' } },
      });

    const getDivineOrderSelect = () => {
      const defaultOption = screen.getByText('Select a Divine Order');
      return defaultOption.closest('select');
    };

    it('renders Divine Order select with required asterisk, options, and empty default', () => {
      render(<WizardStepRaceClass {...props()} />);
      expect(screen.getByText('Divine Order *')).toBeInTheDocument();
      expect(screen.getByText('Protector')).toBeInTheDocument();
      expect(screen.getByText('Thaumaturge')).toBeInTheDocument();
      expect(getDivineOrderSelect()).toHaveValue('');
    });

    it('does not render Primal Order when Cleric is selected', () => {
      render(<WizardStepRaceClass {...props()} />);
      expect(screen.queryByText(/Primal Order/)).not.toBeInTheDocument();
    });

    it('applies error class and renders error message for divineOrder', () => {
      render(
        <WizardStepRaceClass
          {...props()}
          errors={{ divineOrder: 'Please select a divine order' }}
        />
      );
      expect(getDivineOrderSelect()).toHaveClass('error');
      expect(screen.getByText('Please select a divine order')).toBeInTheDocument();
    });

    it('calls onInputChange when a divine order is selected', () => {
      render(<WizardStepRaceClass {...props()} />);
      const select = getDivineOrderSelect();
      select.value = 'Protector';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      expect(makeOnInputChange).toHaveBeenCalledWith('class', {
        name: 'Cleric',
        divineOrder: 'Protector',
      });
    });

    it('shows pre-selected divineOrder in the select', () => {
      render(
        <WizardStepRaceClass
          {...props()}
          formData={{ race: '', subrace: '', class: { name: 'Cleric', divineOrder: 'Protector' } }}
        />
      );
      expect(getDivineOrderSelect()).toHaveValue('Protector');
    });
  });

  describe('2024 ruleset — Druid shows Primal Order', () => {
    const props = () =>
      makeProps({
        ruleset: '2024',
        formData: { race: '', subrace: '', class: { name: 'Druid' } },
      });

    const getPrimalOrderSelect = () => {
      const defaultOption = screen.getByText('Select a Primal Order');
      return defaultOption.closest('select');
    };

    it('renders Primal Order select with required asterisk, options, and empty default', () => {
      render(<WizardStepRaceClass {...props()} />);
      expect(screen.getByText('Primal Order *')).toBeInTheDocument();
      expect(screen.getByText('Magician')).toBeInTheDocument();
      expect(screen.getByText('Warden')).toBeInTheDocument();
      expect(getPrimalOrderSelect()).toHaveValue('');
    });

    it('does not render Divine Order when Druid is selected', () => {
      render(<WizardStepRaceClass {...props()} />);
      expect(screen.queryByText('Divine Order')).not.toBeInTheDocument();
    });

    it('applies error class and renders error message for primalOrder', () => {
      render(
        <WizardStepRaceClass
          {...props()}
          errors={{ primalOrder: 'Please select a primal order' }}
        />
      );
      expect(getPrimalOrderSelect()).toHaveClass('error');
      expect(screen.getByText('Please select a primal order')).toBeInTheDocument();
    });

    it('calls onInputChange when a primal order is selected', () => {
      render(<WizardStepRaceClass {...props()} />);
      const select = getPrimalOrderSelect();
      select.value = 'Warden';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      expect(makeOnInputChange).toHaveBeenCalledWith('class', {
        name: 'Druid',
        primalOrder: 'Warden',
      });
    });

    it('shows pre-selected primalOrder in the select', () => {
      render(
        <WizardStepRaceClass
          {...props()}
          formData={{ race: '', subrace: '', class: { name: 'Druid', primalOrder: 'Warden' } }}
        />
      );
      expect(getPrimalOrderSelect()).toHaveValue('Warden');
    });
  });

  describe('2024 ruleset — non-Druid/non-Cleric hides order selects', () => {
    it('does not render Divine Order or Primal Order for Fighter', () => {
      render(
        <WizardStepRaceClass
          {...makeProps({
            ruleset: '2024',
            formData: { race: '', subrace: '', class: { name: 'Fighter' } },
          })}
        />
      );
      expect(screen.queryByText('Divine Order')).not.toBeInTheDocument();
      expect(screen.queryByText('Primal Order')).not.toBeInTheDocument();
    });
  });

  describe('formData edge cases', () => {
    it('renders without order selects when class is undefined or has empty name', () => {
      render(
        <WizardStepRaceClass
          {...makeProps({
            formData: { race: '', subrace: '', class: undefined },
          })}
        />
      );
      expect(screen.queryByText('Divine Order')).not.toBeInTheDocument();
      expect(screen.queryByText('Primal Order')).not.toBeInTheDocument();

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
    it('calls onInputChange when race or class CascadingSelect changes', () => {
      render(<WizardStepRaceClass {...makeProps()} />);
      const input = screen.getByTestId('input-race');
      fireEvent.change(input, { target: { value: 'Elf' } });
      expect(makeOnInputChange).toHaveBeenCalledWith('race', { name: 'Elf' });

      const classInput = screen.getByTestId('input-class');
      fireEvent.change(classInput, { target: { value: 'Fighter' } });
      expect(makeOnInputChange).toHaveBeenCalledWith('class', { name: 'Fighter' });
    });
  });

  describe('dynamic class switching in 2024 ruleset', () => {
    it('shows Primal Order when class changes from Cleric to Druid', () => {
      const { rerender } = render(
        <WizardStepRaceClass
          {...makeProps({
            ruleset: '2024',
            formData: { race: '', subrace: '', class: { name: 'Cleric' } },
          })}
        />
      );
      expect(screen.getByText('Divine Order *')).toBeInTheDocument();
      expect(screen.queryByText(/Primal Order/)).not.toBeInTheDocument();

      rerender(
        <WizardStepRaceClass
          {...makeProps({
            ruleset: '2024',
            formData: { race: '', subrace: '', class: { name: 'Druid' } },
          })}
        />
      );

      expect(screen.queryByText('Divine Order')).not.toBeInTheDocument();
      expect(screen.getByText('Primal Order *')).toBeInTheDocument();
    });
  });
});
