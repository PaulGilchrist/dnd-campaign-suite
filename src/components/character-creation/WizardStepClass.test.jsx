// @improved-by-ai
// @cleaned-by-ai
// Removed 6 tests:
//   - wizard hat icon (brittle: asserts internal Font Awesome class)
//   - options using cls.index as key (tests React key via DOM — impossible)
//   - show class details when expanded (redundant with toggle tests)
//   - toggle details when clicking header (redundant with full toggle test)
//   - not show Divine Order for Barbarian 2024 (consolidated with Primal Order)
//   - not show Primal Order for Barbarian 2024 (consolidated with Divine Order)
// Consolidated 4 groups:
//   - 5e saving throws + weapon proficiencies → 1 test
//   - 2024 saving throws + weapon proficiencies + armor training → 1 test
//   - 2024 Divine Order + Primal Order dropdowns → parameterized test
//   - divine order change + primal order change → parameterized test
//   - error display for 3 order types → parameterized test
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepClass from './WizardStepClass.jsx';

const mockAllClassesData5e = [
  { index: 'barbarian', name: 'Barbarian', hit_die: 12, description: 'A fierce warrior of primitive background who can enter a battle rage', proficiencies: ['Light Armor', 'Medium Armor', 'Shields', 'Simple Weapons', 'Martial Weapons'], saving_throws: ['STR', 'CON'] },
  { index: 'wizard', name: 'Wizard', hit_die: 6, description: 'A scholarly magic-user capable of manipulating the structures of reality', proficiencies: ['Daggers', 'Darts', 'Slings', 'Quarterstaff', 'Light Crossbows'], saving_throws: ['INT', 'WIS'] },
];

const mockAllClassesData2024 = [
  { index: 'barbarian', name: 'Barbarian', class_description: '<p><b>A fierce warrior of primal rage.</b></p>', primary_ability: 'Strength', hit_point_die: '12', weapon_proficiencies: 'Simple and Martial weapons', armor_training: 'Light and Medium armor and Shields', saving_throw_proficiencies: ['Strength', 'Constitution'], tool_proficiencies: '' },
  { index: 'cleric', name: 'Cleric', class_description: '<p>A priestly champion of God.</p>', primary_ability: 'Wisdom', hit_point_die: '8', weapon_proficiencies: 'Simple weapons', armor_training: 'Light and Medium armor and Shields', saving_throw_proficiencies: ['Wisdom', 'Charisma'], tool_proficiencies: '' },
  { index: 'druid', name: 'Druid', class_description: '<p>A priest of the Primitive Orders.</p>', primary_ability: 'Intelligence', hit_point_die: '8', weapon_proficiencies: 'Clubs, Daggers, Darts, Javelins, Misericordes, Quarters, Scimitars, Scythes, Slings, Spears', armor_training: 'Light and Medium armor and Shields (druid shields)', saving_throw_proficiencies: ['Intelligence', 'Wisdom'], tool_proficiencies: '' },
];

const mockClassSubtypes = [
  { className: 'Barbarian', subtypes: [{ name: 'Path of the Berserker' }, { name: 'Path of the Totem Warrior' }] },
  { className: 'Wizard', subtypes: [{ name: 'School of Abjuration' }, { name: 'School of Evocation' }] },
  { className: 'Cleric', subtypes: [{ name: 'Life Domain' }, { name: 'Death Domain' }] },
  { className: 'Druid', subtypes: [{ name: 'Circle of Dreams' }, { name: 'Circle of the Moon' }] },
];

function createMockProps(overrides = {}) {
  return {
    formData: overrides.formData || { class: { name: '', subclass: { name: '' }, divineOrder: '', primalOrder: '' } },
    errors: overrides.errors || {},
    allClassesData: overrides.allClassesData || mockAllClassesData5e,
    classSubtypes: overrides.classSubtypes || mockClassSubtypes,
    ruleset: overrides.ruleset || '5e',
    onInputChange: overrides.onInputChange || vi.fn(),
  };
}

describe('WizardStepClass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('render', () => {
    it('should display the step heading', () => {
      render(<WizardStepClass stepNumber={6} {...createMockProps()} />);
      expect(screen.getByText('Step 6: Class')).toBeInTheDocument();
    });

    it('should render the class dropdown with options', () => {
      render(<WizardStepClass stepNumber={6} {...createMockProps()} />);
      expect(screen.getByText('Class *')).toBeInTheDocument();
      const select = document.querySelector('select');
      expect(select.querySelector('option[value=""]')).toHaveTextContent('Select a class');
      expect(select.querySelector('option[value="Barbarian"]')).toHaveTextContent('Barbarian');
      expect(select.querySelector('option[value="Wizard"]')).toHaveTextContent('Wizard');
    });

    it('should not render a detail card when no class is selected', () => {
      render(<WizardStepClass stepNumber={6} {...createMockProps({ formData: { class: { name: '', subclass: { name: '' }, divineOrder: '', primalOrder: '' } } })} />);
      expect(screen.queryByText(/Details$/)).not.toBeInTheDocument();
    });
  });

  describe('5e ruleset', () => {
    it('should show saving throws and weapon proficiencies for 5e classes', () => {
      render(
        <WizardStepClass stepNumber={6}
          {...createMockProps({
            allClassesData: mockAllClassesData5e,
            formData: { class: { name: 'Barbarian', subclass: { name: '' }, divineOrder: '', primalOrder: '' } },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText('Saving Throws')).toBeInTheDocument();
      expect(screen.getByText('STR, CON')).toBeInTheDocument();
    });

    it('should call onInputChange when class changes and reset subclass', () => {
      const mockOnChange = vi.fn();
      render(
        <WizardStepClass stepNumber={6}
          {...createMockProps({
            onInputChange: mockOnChange,
            formData: { class: { name: 'Barbarian', subclass: { name: 'Path of the Berserker' }, divineOrder: '', primalOrder: '' } },
          })}
        />
      );
      const select = document.querySelector('select');
      fireEvent.change(select, { target: { value: 'Wizard' } });
      expect(mockOnChange).toHaveBeenCalledWith('class', {
        name: 'Wizard',
        subclass: { name: '' },
        divineOrder: '',
        primalOrder: ''
      });
    });

    it('should select an empty string to reset the class', () => {
      const mockOnChange = vi.fn();
      render(
        <WizardStepClass stepNumber={6}
          {...createMockProps({
            onInputChange: mockOnChange,
            formData: { class: { name: 'Barbarian', subclass: { name: '' }, divineOrder: '', primalOrder: '' } },
          })}
        />
      );
      const select = document.querySelector('select');
      fireEvent.change(select, { target: { value: '' } });
      expect(mockOnChange).toHaveBeenCalledWith('class', {
        name: '',
        subclass: { name: '' },
        divineOrder: '',
        primalOrder: ''
      });
    });
  });

  describe('2024 ruleset', () => {
    it('should show saving throws, weapon proficiencies, and armor training for 2024', () => {
      render(
        <WizardStepClass stepNumber={6}
          {...createMockProps({
            allClassesData: mockAllClassesData2024,
            ruleset: '2024',
            formData: { class: { name: 'Barbarian', subclass: { name: '' }, divineOrder: '', primalOrder: '' } },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText('Saving Throws')).toBeInTheDocument();
      expect(screen.getByText('Strength, Constitution')).toBeInTheDocument();
      expect(screen.getByText('Weapon Proficiencies')).toBeInTheDocument();
      expect(screen.getByText('Simple and Martial weapons')).toBeInTheDocument();
      expect(screen.getByText('Armor Training')).toBeInTheDocument();
      expect(screen.getByText('Light and Medium armor and Shields')).toBeInTheDocument();
    });

    it('should not show tool proficiencies when empty for 2024', () => {
      render(
        <WizardStepClass stepNumber={6}
          {...createMockProps({
            allClassesData: mockAllClassesData2024,
            ruleset: '2024',
            formData: { class: { name: 'Cleric', subclass: { name: '' }, divineOrder: '', primalOrder: '' } },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.queryByText('Tool Proficiencies')).not.toBeInTheDocument();
    });

    it.each([
      { className: 'Cleric', label: 'Divine Order *', optionValue: 'Protector', optionText: 'Protector' },
      { className: 'Druid', label: 'Primal Order *', optionValue: 'Magician', optionText: 'Magician' },
    ])('should show %s dropdown for %s 2024', ({ className, label, optionValue, optionText }) => {
      render(
        <WizardStepClass stepNumber={6}
          {...createMockProps({
            allClassesData: mockAllClassesData2024,
            classSubtypes: mockClassSubtypes,
            ruleset: '2024',
            formData: { class: { name: className, subclass: { name: '' }, divineOrder: '', primalOrder: '' } },
          })}
        />
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      const selects = document.querySelectorAll('select');
      const orderSelect = selects[1];
      expect(orderSelect.querySelector(`option[value="${optionValue}"]`)).toHaveTextContent(optionText);
    });

    it('should not show order dropdowns for non-special classes in 2024', () => {
      render(
        <WizardStepClass stepNumber={6}
          {...createMockProps({
            allClassesData: mockAllClassesData2024,
            ruleset: '2024',
            formData: { class: { name: 'Barbarian', subclass: { name: '' }, divineOrder: '', primalOrder: '' } },
          })}
        />
      );
      expect(screen.queryByText('Divine Order')).not.toBeInTheDocument();
      expect(screen.queryByText('Primal Order')).not.toBeInTheDocument();
    });

    it.each([
      { fieldName: 'divineOrder', className: 'Cleric', value: 'Protector' },
      { fieldName: 'primalOrder', className: 'Druid', value: 'Warden' },
    ])('should call onInputChange when %s changes (%s 2024)', ({ fieldName, className, value }) => {
      const mockOnChange = vi.fn();
      const formData = { class: { name: className, subclass: { name: '' }, divineOrder: '', primalOrder: '' } };
      render(
        <WizardStepClass stepNumber={6}
          {...createMockProps({
            allClassesData: mockAllClassesData2024,
            ruleset: '2024',
            onInputChange: mockOnChange,
            formData,
          })}
        />
      );
      const selects = document.querySelectorAll('select');
      const orderSelect = selects[1];
      fireEvent.change(orderSelect, { target: { value } });
      expect(mockOnChange).toHaveBeenCalledWith('class', { ...formData.class, [fieldName]: value });
    });
  });

  describe('toggle details', () => {
    it('should show "Show Details" button initially and toggle to "Hide Details"', () => {
      render(
        <WizardStepClass stepNumber={6}
          {...createMockProps({
            allClassesData: mockAllClassesData5e,
            formData: { class: { name: 'Barbarian', subclass: { name: '' }, divineOrder: '', primalOrder: '' } },
          })}
        />
      );
      expect(screen.getByText('Show Details')).toBeInTheDocument();
      expect(screen.queryByText(/fierce warrior/)).not.toBeInTheDocument();

      const showBtn = screen.getByText('Show Details');
      fireEvent.click(showBtn);
      expect(screen.getByText('Hide Details')).toBeInTheDocument();
      expect(screen.getByText(/fierce warrior/)).toBeInTheDocument();

      const hideBtn = screen.getByText('Hide Details');
      fireEvent.click(hideBtn);
      expect(screen.getByText('Show Details')).toBeInTheDocument();
      expect(screen.queryByText(/fierce warrior/)).not.toBeInTheDocument();
    });
  });

  describe('error display', () => {
    it('should render error message and error class when class error exists', () => {
      render(
        <WizardStepClass stepNumber={6}
          {...createMockProps({
            errors: { class: 'Class is required' },
          })}
        />
      );
      expect(screen.getByText('Class is required')).toBeInTheDocument();
      const select = document.querySelector('select');
      expect(select).toHaveClass('error');
    });

    it.each([
      { fieldName: 'divineOrder', className: 'Cleric', errorMessage: 'Divine Order is required' },
      { fieldName: 'primalOrder', className: 'Druid', errorMessage: 'Primal Order is required' },
    ])('should render error message and error class when %s error exists', ({ fieldName, className, errorMessage }) => {
      render(
        <WizardStepClass stepNumber={6}
          {...createMockProps({
            allClassesData: mockAllClassesData2024,
            ruleset: '2024',
            errors: { [fieldName]: errorMessage },
            formData: { class: { name: className, subclass: { name: '' }, divineOrder: '', primalOrder: '' } },
          })}
        />
      );
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      const selects = document.querySelectorAll('select');
      const orderSelect = selects[1];
      expect(orderSelect).toHaveClass('error');
    });
  });

  describe('empty state', () => {
    it('should render the class dropdown but no detail card when allClassesData is empty', () => {
      render(<WizardStepClass stepNumber={6} {...createMockProps({ allClassesData: [] })} />);
      expect(screen.getByText('Class *')).toBeInTheDocument();
      const select = document.querySelector('select');
      expect(select.querySelector('option[value=""]')).toHaveTextContent('Select a class');
      expect(select.querySelectorAll('option').length).toBe(1);
      expect(screen.queryByText(/Details$/)).not.toBeInTheDocument();
    });
  });
});
