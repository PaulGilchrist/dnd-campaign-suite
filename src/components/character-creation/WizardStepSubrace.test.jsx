// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepSubrace from './WizardStepSubrace.jsx';

const mockRacesData = [
  {
    name: 'Dragonborn',
    speed: 30,
    traits: [],
    subraces: [
      { name: 'Red Dragonborn', description: '<p>Red dragonborn are fierce and passionate.</p>', damage_resistance: 'Fire' },
      { name: 'Blue Dragonborn', description: 'Blue dragonborn channel crackling lightning.', damage_resistance: 'Lightning' },
    ],
  },
  {
    name: 'Human',
    speed: 30,
    traits: [],
    subraces: [],
  },
];

function createMockProps(overrides = {}) {
  return {
    formData: overrides.formData || { race: { name: '', subrace: { name: '' } } },
    errors: overrides.errors || {},
    racesData: overrides.racesData || mockRacesData,
    onInputChange: overrides.onInputChange || vi.fn(),
  };
}

describe('WizardStepSubrace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Render with subraces', () => {
    it('should display the step heading', () => {
      render(<WizardStepSubrace {...createMockProps()} />);
      expect(screen.getByText('Step 4: Subrace')).toBeInTheDocument();
    });

    it('should show subrace dropdown when race has subraces', () => {
      render(
        <WizardStepSubrace
          {...createMockProps({
            formData: { race: { name: 'Dragonborn', subrace: { name: '' } } },
          })}
        />
      );
      expect(screen.getByText('Subrace *')).toBeInTheDocument();
      expect(screen.getByText('Red Dragonborn')).toBeInTheDocument();
      expect(screen.getByText('Blue Dragonborn')).toBeInTheDocument();
    });

    it('should show no-subrace message when race has no subraces', () => {
      render(
        <WizardStepSubrace
          {...createMockProps({
            formData: { race: { name: 'Human', subrace: { name: '' } } },
          })}
        />
      );
      expect(screen.getByText(/Your selected race \(Human\) has no subraces/)).toBeInTheDocument();
    });
  });

  describe('Expand/Collapse', () => {
    it('should expand subrace details when clicked', () => {
      render(
        <WizardStepSubrace
          {...createMockProps({
            formData: { race: { name: 'Dragonborn', subrace: { name: 'Red Dragonborn' } } },
          })}
        />
      );
      expect(screen.getByText('Show Details')).toBeInTheDocument();
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText('Hide Details')).toBeInTheDocument();
    });

    it('should show subrace description when expanded', () => {
      render(
        <WizardStepSubrace
          {...createMockProps({
            formData: { race: { name: 'Dragonborn', subrace: { name: 'Red Dragonborn' } } },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText('Red Dragonborn Details')).toBeInTheDocument();
    });
  });

  describe('Subrace selection', () => {
    it('should call onInputChange when subrace changes', () => {
      const mockOnChange = vi.fn();
      render(
        <WizardStepSubrace
          {...createMockProps({
            onInputChange: mockOnChange,
            formData: { race: { name: 'Dragonborn', subrace: { name: '' } } },
          })}
        />
      );
      const select = document.querySelector('select');
      fireEvent.change(select, { target: { value: 'Blue Dragonborn' } });
      expect(mockOnChange).toHaveBeenCalledWith('race', {
        name: 'Dragonborn',
        subrace: { name: 'Blue Dragonborn' }
      });
    });
  });

  describe('Error display', () => {
    it('should render error message and error class when subrace error exists', () => {
      render(
        <WizardStepSubrace
          {...createMockProps({
            formData: { race: { name: 'Dragonborn', subrace: { name: '' } } },
            errors: { subrace: 'Subrace is required' },
          })}
        />
      );
      expect(screen.getByText('Subrace is required')).toBeInTheDocument();
      const select = document.querySelector('select');
      expect(select).toHaveClass('error');
    });
  });

  describe('Trait expansion', () => {
    it('should show damage resistance trait', () => {
      render(
        <WizardStepSubrace
          {...createMockProps({
            formData: { race: { name: 'Dragonborn', subrace: { name: 'Red Dragonborn' } } },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText('Damage Resistance')).toBeInTheDocument();
    });
  });
});
