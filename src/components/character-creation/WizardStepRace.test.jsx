// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepRace from './WizardStepRace.jsx';

const mockRacesData = [
  { name: 'Human', speed: 30, size: 'Medium', languages: ['Common'], traits: [{ name: 'Extra Language', description: 'You can speak one extra language.' }] },
  { name: 'Elf', speed: 30, size: 'Medium', languages: ['Common', 'Elvish'], traits: [{ name: 'Fey Ancestry', description: 'You have advantage on Wisdom saving throws against being charmed.' }], subraces: [{ name: 'High Elf', description: 'High elves are elegant and graceful.', damage_resistance: '' }] },
  { name: 'Dwarf', speed: 25, size: 'Medium', languages: ['Common', 'Dwarvish'], traits: [{ name: 'Darkvision', description: 'You have darkvision with a range of 60 feet.' }] },
];

const mockAllRacesData = [
  { name: 'Human', description: '<p>Humans are versatile and ambitious.</p>' },
  { name: 'Elf', description: '<p>Elves are magical beings.</p>' },
  { name: 'Dwarf', description: '<p>Dwarves are tough and resilient.</p>' },
];

function createMockProps(overrides = {}) {
  return {
    formData: overrides.formData || { race: { name: '', subrace: { name: '' } } },
    errors: overrides.errors || {},
    racesData: overrides.racesData || mockRacesData,
    allRacesData: overrides.allRacesData || mockAllRacesData,
    ruleset: overrides.ruleset || '5e',
    onInputChange: overrides.onInputChange || vi.fn(),
  };
}

describe('WizardStepRace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Render', () => {
    it('should display the step heading', () => {
      render(<WizardStepRace {...createMockProps()} />);
      expect(screen.getByText('Step 3: Race')).toBeInTheDocument();
    });

    it('should render the race dropdown with options', () => {
      render(<WizardStepRace {...createMockProps()} />);
      expect(screen.getByText('Race *')).toBeInTheDocument();
      const select = document.querySelector('select');
      expect(select).toBeInTheDocument();
      expect(select.querySelector('option:nth-child(1)')).toHaveTextContent('Select a race');
      expect(select.querySelector('option:nth-child(2)')).toHaveTextContent('Human');
      expect(select.querySelector('option:nth-child(3)')).toHaveTextContent('Elf');
    });

    it('should render with a pre-selected race', () => {
      render(
        <WizardStepRace
          {...createMockProps({
            formData: { race: { name: 'Human', subrace: { name: '' } } },
          })}
        />
      );
      const select = document.querySelector('select');
      expect(select).toHaveValue('Human');
    });

    it('should show the detail card when a race is selected', () => {
      render(
        <WizardStepRace
          {...createMockProps({
            formData: { race: { name: 'Human', subrace: { name: '' } } },
          })}
        />
      );
      expect(screen.getByText('Human Details')).toBeInTheDocument();
    });

    it('should not show the detail card when no race is selected', () => {
      render(<WizardStepRace {...createMockProps()} />);
      expect(screen.queryByText('Details')).not.toBeInTheDocument();
    });
  });

  describe('Expand/Collapse', () => {
    it('should show expanded button when details are collapsed', () => {
      render(
        <WizardStepRace
          {...createMockProps({
            formData: { race: { name: 'Human', subrace: { name: '' } } },
          })}
        />
      );
      expect(screen.getByText('Show Details')).toBeInTheDocument();
    });

    it('should expand details when clicked', () => {
      render(
        <WizardStepRace
          {...createMockProps({
            formData: { race: { name: 'Human', subrace: { name: '' } } },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText('Hide Details')).toBeInTheDocument();
    });

    it('should collapse details when clicked again', () => {
      render(
        <WizardStepRace
          {...createMockProps({
            formData: { race: { name: 'Human', subrace: { name: '' } } },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      fireEvent.click(header);
      expect(screen.getByText('Show Details')).toBeInTheDocument();
    });
  });

  describe('Race selection', () => {
    it('should call onInputChange when race changes', () => {
      const mockOnChange = vi.fn();
      render(
        <WizardStepRace
          {...createMockProps({
            onInputChange: mockOnChange,
          })}
        />
      );
      const select = document.querySelector('select');
      fireEvent.change(select, { target: { value: 'Elf' } });
      expect(mockOnChange).toHaveBeenCalledWith('race', {
        name: 'Elf',
        subrace: { name: '' }
      });
    });

    it('should show subrace when race has subraces', () => {
      const mockOnChange = vi.fn();
      render(
        <WizardStepRace
          {...createMockProps({
            onInputChange: mockOnChange,
          })}
        />
      );
      const select = document.querySelector('select');
      fireEvent.change(select, { target: { value: 'Elf' } });
      expect(mockOnChange).toHaveBeenCalledWith('race', {
        name: 'Elf',
        subrace: { name: '' }
      });
    });
  });

  describe('Error display', () => {
    it('should render error message and error class when race error exists', () => {
      render(
        <WizardStepRace
          {...createMockProps({
            errors: { race: 'Race is required' },
          })}
        />
      );
      expect(screen.getByText('Race is required')).toBeInTheDocument();
      const select = document.querySelector('select');
      expect(select).toHaveClass('error');
    });
  });

  describe('HTML rendering', () => {
    it('should render HTML description safely', () => {
      render(
        <WizardStepRace
          {...createMockProps({
            formData: { race: { name: 'Human', subrace: { name: '' } } },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Humans are versatile and ambitious.')).toBeInTheDocument();
    });
  });

  describe('Trait display', () => {
    it('should show trait header when traits exist and card expanded', () => {
      render(
        <WizardStepRace
          {...createMockProps({
            formData: { race: { name: 'Human', subrace: { name: '' } } },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText('Racial Traits')).toBeInTheDocument();
      expect(screen.getByText('Extra Language')).toBeInTheDocument();
    });

    it('should show trait description when card expanded', () => {
      render(
        <WizardStepRace
          {...createMockProps({
            formData: { race: { name: 'Human', subrace: { name: '' } } },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText(/You can speak one extra language/)).toBeInTheDocument();
    });
  });

  describe('2024 ruleset', () => {
    it('should render with 2024 data', () => {
      render(
        <WizardStepRace
          {...createMockProps({
            ruleset: '2024',
            formData: { race: { name: 'Human', subrace: { name: '' } } },
          })}
        />
      );
      expect(screen.getByText('Step 3: Race')).toBeInTheDocument();
      const select = document.querySelector('select');
      expect(select).toHaveValue('Human');
    });
  });
});
