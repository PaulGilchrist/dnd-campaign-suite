// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepSubclass from './WizardStepSubclass.jsx';

const mockClassSubtypes = [
  { className: 'Fighter', subtypes: [{ name: 'Battle Master', description: 'A student of martial combat.', subclass_flavor: 'Martial Archetype' }, { name: 'Champion' }] },
  { className: 'Wizard', subtypes: [{ name: 'School of Evocation' }] },
  { className: 'Barbarian', subtypes: [] },
];

const mockAllClassesData2024 = [
  {
    name: 'Fighter',
    majors: [
      {
        name: 'Battle Master',
        description: '<p>A student of martial combat.</p>',
        features: [
          { name: 'Combat Superiority', level: 3, description: 'You learn maneuvers that exploit openings in your foes\' defenses.' },
          { name: 'Student of War', level: 7, description: 'You gain additional training with weapons.' },
        ],
      },
    ],
  },
];

const mockAllClassesData5e = [
  {
    name: 'Fighter',
    subclasses: [
      {
        name: 'Battle Master',
        description: '<p>A student of martial combat.</p>',
        subclass_flavor: 'Martial Archetype',
        class_levels: [
          { level: 3, features: [{ name: 'Combat Superiority', level: 3, description: 'You learn maneuvers that exploit openings in your foes\' defenses.' }] },
          { level: 7, features: [{ name: 'Student of War', level: 7, description: 'You gain additional training with weapons.' }] },
        ],
      },
    ],
  },
];

function createMockProps(overrides = {}) {
  return {
    formData: overrides.formData || { class: { name: '', subclass: { name: '' } } },
    errors: overrides.errors || {},
    classSubtypes: overrides.classSubtypes || mockClassSubtypes,
    ruleset: overrides.ruleset || '5e',
    allClassesData: overrides.allClassesData || mockAllClassesData5e,
    onInputChange: overrides.onInputChange || vi.fn(),
  };
}

describe('WizardStepSubclass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should display the step heading', () => {
      render(<WizardStepSubclass stepNumber={7} {...createMockProps()} />);
      expect(screen.getByText('Step 7: Subclass / Major')).toBeInTheDocument();
    });

    it('should show the default select option', () => {
      render(
        <WizardStepSubclass stepNumber={7}
          {...createMockProps({
            formData: { class: { name: 'Fighter', subclass: { name: '' } } },
          })}
        />
      );
      expect(screen.getByRole('combobox')).toHaveValue('');
    });

    it('should show subclass dropdown options when class has subclasses', () => {
      render(
        <WizardStepSubclass stepNumber={7}
          {...createMockProps({
            formData: { class: { name: 'Fighter', subclass: { name: '' } } },
          })}
        />
      );
      expect(screen.getByText('Subclass / Major *')).toBeInTheDocument();
      expect(screen.getByText('Battle Master')).toBeInTheDocument();
      expect(screen.getByText('Champion')).toBeInTheDocument();
    });

    it('should show no-subclass message when class has no subclasses', () => {
      render(
        <WizardStepSubclass stepNumber={7}
          {...createMockProps({
            formData: { class: { name: 'Barbarian', subclass: { name: '' } } },
          })}
        />
      );
      expect(screen.getByText(/Your selected class \(Barbarian\) has no subclasses\/majors/)).toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('should show no-subclass message when no class is selected', () => {
      render(<WizardStepSubclass stepNumber={7} {...createMockProps()} />);
      expect(screen.getByText(/Your selected class \(\) has no subclasses\/majors/)).toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });
  });

  describe('Subclass details expand/collapse', () => {
    it('should show subclass details header when a subclass is selected', () => {
      render(
        <WizardStepSubclass stepNumber={7}
          {...createMockProps({
            formData: { class: { name: 'Fighter', subclass: { name: 'Battle Master' } } },
          })}
        />
      );
      expect(screen.getByText('Battle Master Details')).toBeInTheDocument();
      expect(screen.getByText('Show Details')).toBeInTheDocument();
    });

    it('should toggle expanded state when the header is clicked', () => {
      render(
        <WizardStepSubclass stepNumber={7}
          {...createMockProps({
            formData: { class: { name: 'Fighter', subclass: { name: 'Battle Master' } } },
          })}
        />
      );
      fireEvent.click(screen.getByText('Show Details'));

      expect(screen.getByText('Hide Details')).toBeInTheDocument();
      expect(screen.queryByText('Show Details')).not.toBeInTheDocument();
      expect(screen.getByText('Features')).toBeInTheDocument();
      expect(screen.getByText('Combat Superiority')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Hide Details'));
      expect(screen.getByText('Show Details')).toBeInTheDocument();
      expect(screen.queryByText('Hide Details')).not.toBeInTheDocument();
    });

    it('should render the subclass description, flavor, and features when expanded', () => {
      render(
        <WizardStepSubclass stepNumber={7}
          {...createMockProps({
            formData: { class: { name: 'Fighter', subclass: { name: 'Battle Master' } } },
          })}
        />
      );
      fireEvent.click(screen.getByText('Show Details'));

      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('A student of martial combat.')).toBeInTheDocument();
      expect(screen.getByText('Flavor')).toBeInTheDocument();
      expect(screen.getByText('Martial Archetype')).toBeInTheDocument();
      expect(screen.getByText('Features')).toBeInTheDocument();
      expect(screen.getByText('Combat Superiority')).toBeInTheDocument();
      expect(screen.getByText('Level 3')).toBeInTheDocument();
      expect(screen.getByText(/You learn maneuvers that exploit openings in your foes/)).toBeInTheDocument();
      expect(screen.getByText('Student of War')).toBeInTheDocument();
      expect(screen.getByText('Level 7')).toBeInTheDocument();
    });

    it('should not render the flavor section when subclass_flavor is absent', () => {
      render(
        <WizardStepSubclass stepNumber={7}
          {...createMockProps({
            formData: { class: { name: 'Fighter', subclass: { name: 'Champion' } } },
          })}
        />
      );
      fireEvent.click(screen.getByText('Champion Details'));

      expect(screen.queryByText('Flavor')).not.toBeInTheDocument();
    });
  });

  describe('Subclass selection', () => {
    it('should call onInputChange with the correct payload when subclass changes', () => {
      const mockOnChange = vi.fn();
      render(
        <WizardStepSubclass stepNumber={7}
          {...createMockProps({
            onInputChange: mockOnChange,
            formData: { class: { name: 'Fighter', subclass: { name: '' } } },
          })}
        />
      );
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'Champion' } });
      expect(mockOnChange).toHaveBeenCalledWith('class', {
        name: 'Fighter',
        subclass: { name: 'Champion' }
      });
    });
  });

  describe('Error display', () => {
    it('should render error message and error class when subclass error exists', () => {
      render(
        <WizardStepSubclass stepNumber={7}
          {...createMockProps({
            formData: { class: { name: 'Fighter', subclass: { name: '' } } },
            errors: { subclass: 'Subclass is required' },
          })}
        />
      );
      expect(screen.getByText('Subclass is required')).toBeInTheDocument();
      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('error');
    });
  });

  describe('2024 ruleset', () => {
    it('should show 2024 major features and description', () => {
      render(
        <WizardStepSubclass stepNumber={7}
          {...createMockProps({
            formData: { class: { name: 'Fighter', subclass: { name: 'Battle Master' } } },
            ruleset: '2024',
            allClassesData: mockAllClassesData2024,
          })}
        />
      );
      fireEvent.click(screen.getByText('Battle Master Details'));

      expect(screen.getByText('Combat Superiority')).toBeInTheDocument();
      expect(screen.getByText('Level 3')).toBeInTheDocument();
      expect(screen.getByText('Student of War')).toBeInTheDocument();
      expect(screen.getByText('Level 7')).toBeInTheDocument();
      expect(screen.getByText('A student of martial combat.')).toBeInTheDocument();
    });
  });
});
