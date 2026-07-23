// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepClass from './WizardStepClass.jsx';

const mockAllClassesData5e = [
  { index: 'barbarian', name: 'Barbarian', hit_die: 12, description: 'A fierce warrior of primitive background who can enter a battle rage', proficiencies: ['Light Armor', 'Medium Armor', 'Shields', 'Simple Weapons', 'Martial Weapons'], saving_throws: ['STR', 'CON'] },
  { index: 'wizard', name: 'Wizard', hit_die: 6, description: 'A scholarly magic-user capable of manipulating the structures of reality', proficiencies: [' Daggers', 'Darts', 'Slings', 'Quarterstaff', 'Light Crossbows'], saving_throws: ['INT', 'WIS'] },
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

  describe('5e ruleset', () => {
    it('should display the step heading', () => {
      render(<WizardStepClass {...createMockProps()} />);
      expect(screen.getByText('Step 6: Class')).toBeInTheDocument();
    });

    it('should render the class dropdown with options', () => {
      render(<WizardStepClass {...createMockProps()} />);
      expect(screen.getByText('Class *')).toBeInTheDocument();
      const select = document.querySelector('select');
      expect(select.querySelector('option:nth-child(1)')).toHaveTextContent('Select a class');
      expect(select.querySelector('option:nth-child(2)')).toHaveTextContent('Barbarian');
      expect(select.querySelector('option:nth-child(3)')).toHaveTextContent('Wizard');
    });

    it('should show class details when expanded', () => {
      render(
        <WizardStepClass
          {...createMockProps({
            allClassesData: mockAllClassesData5e,
            formData: { class: { name: 'Barbarian', subclass: { name: '' }, divineOrder: '', primalOrder: '' } },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText('Barbarian Details')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Hit Die')).toBeInTheDocument();
      expect(screen.getByText('d12')).toBeInTheDocument();
    });

    it('should show saving throws for 5e', () => {
      render(
        <WizardStepClass
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
  });

  describe('2024 ruleset', () => {
    it('should show 2024 class info', () => {
      render(
        <WizardStepClass
          {...createMockProps({
            allClassesData: mockAllClassesData2024,
            ruleset: '2024',
            formData: { class: { name: 'Barbarian', subclass: { name: '' }, divineOrder: '', primalOrder: '' } },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText('Barbarian Details')).toBeInTheDocument();
      expect(screen.getByText('Primary Ability')).toBeInTheDocument();
      expect(screen.getByText('Strength')).toBeInTheDocument();
      expect(screen.getByText('Hit Point Die')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    it('should show Divine Order dropdown for Cleric 2024', () => {
      render(
        <WizardStepClass
          {...createMockProps({
            allClassesData: mockAllClassesData2024,
            classSubtypes: mockClassSubtypes,
            ruleset: '2024',
            formData: { class: { name: 'Cleric', subclass: { name: '' }, divineOrder: '', primalOrder: '' } },
          })}
        />
      );
      expect(screen.getByText('Divine Order *')).toBeInTheDocument();
      expect(screen.getByText('Protector')).toBeInTheDocument();
      expect(screen.getByText('Thaumaturge')).toBeInTheDocument();
    });

    it('should show Primal Order dropdown for Druid 2024', () => {
      render(
        <WizardStepClass
          {...createMockProps({
            allClassesData: mockAllClassesData2024,
            classSubtypes: mockClassSubtypes,
            ruleset: '2024',
            formData: { class: { name: 'Druid', subclass: { name: '' }, divineOrder: '', primalOrder: '' } },
          })}
        />
      );
      expect(screen.getByText('Primal Order *')).toBeInTheDocument();
      expect(screen.getByText('Magician')).toBeInTheDocument();
      expect(screen.getByText('Warden')).toBeInTheDocument();
    });
  });

  describe('Class selection', () => {
    it('should call onInputChange when class changes', () => {
      const mockOnChange = vi.fn();
      render(
        <WizardStepClass
          {...createMockProps({
            onInputChange: mockOnChange,
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

    it('should reset subclass when changing class', () => {
      const mockOnChange = vi.fn();
      render(
        <WizardStepClass
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
  });

  describe('Error display', () => {
    it('should render error message and error class when class error exists', () => {
      render(
        <WizardStepClass
          {...createMockProps({
            errors: { class: 'Class is required' },
          })}
        />
      );
      expect(screen.getByText('Class is required')).toBeInTheDocument();
      const select = document.querySelector('select');
      expect(select).toHaveClass('error');
    });
  });
});
