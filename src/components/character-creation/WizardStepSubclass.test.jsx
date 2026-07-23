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

  describe('Render with subclasses', () => {
    it('should display the step heading', () => {
      render(<WizardStepSubclass {...createMockProps()} />);
      expect(screen.getByText('Step 7: Subclass / Major')).toBeInTheDocument();
    });

    it('should show subclass dropdown when class has subclasses', () => {
      render(
        <WizardStepSubclass
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
        <WizardStepSubclass
          {...createMockProps({
            formData: { class: { name: 'Barbarian', subclass: { name: '' } } },
          })}
        />
      );
      expect(screen.getByText(/Your selected class \(Barbarian\) has no subclasses\/majors/)).toBeInTheDocument();
    });
  });

  describe('Expand/Collapse', () => {
    it('should expand subclass details when clicked', () => {
      render(
        <WizardStepSubclass
          {...createMockProps({
            formData: { class: { name: 'Fighter', subclass: { name: 'Battle Master' } } },
          })}
        />
      );
      expect(screen.getByText('Show Details')).toBeInTheDocument();
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText('Hide Details')).toBeInTheDocument();
    });

    it('should show subclass description when expanded', () => {
      render(
        <WizardStepSubclass
          {...createMockProps({
            formData: { class: { name: 'Fighter', subclass: { name: 'Battle Master' } } },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText('Battle Master Details')).toBeInTheDocument();
    });

    it('should show features when expanded', () => {
      render(
        <WizardStepSubclass
          {...createMockProps({
            formData: { class: { name: 'Fighter', subclass: { name: 'Battle Master' } } },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText('Features')).toBeInTheDocument();
      expect(screen.getByText('Combat Superiority')).toBeInTheDocument();
    });

    it('should show feature level badge', () => {
      render(
        <WizardStepSubclass
          {...createMockProps({
            formData: { class: { name: 'Fighter', subclass: { name: 'Battle Master' } } },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText('Level 3')).toBeInTheDocument();
    });

    it('should expand feature description when clicked', () => {
      render(
        <WizardStepSubclass
          {...createMockProps({
            formData: { class: { name: 'Fighter', subclass: { name: 'Battle Master' } } },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      const featureHeader = screen.getByText('Combat Superiority');
      fireEvent.click(featureHeader);
      expect(screen.getByText('You learn maneuvers that exploit openings in your foes\' defenses.')).toBeInTheDocument();
    });
  });

  describe('Subclass selection', () => {
    it('should call onInputChange when subclass changes', () => {
      const mockOnChange = vi.fn();
      render(
        <WizardStepSubclass
          {...createMockProps({
            onInputChange: mockOnChange,
            formData: { class: { name: 'Fighter', subclass: { name: '' } } },
          })}
        />
      );
      const select = document.querySelector('select');
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
        <WizardStepSubclass
          {...createMockProps({
            formData: { class: { name: 'Fighter', subclass: { name: '' } } },
            errors: { subclass: 'Subclass is required' },
          })}
        />
      );
      expect(screen.getByText('Subclass is required')).toBeInTheDocument();
      const select = document.querySelector('select');
      expect(select).toHaveClass('error');
    });
  });

  describe('2024 ruleset', () => {
    it('should show 2024 major features', () => {
      render(
        <WizardStepSubclass
          {...createMockProps({
            formData: { class: { name: 'Fighter', subclass: { name: 'Battle Master' } } },
            ruleset: '2024',
            allClassesData: mockAllClassesData2024,
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText('Student of War')).toBeInTheDocument();
      expect(screen.getByText('Level 7')).toBeInTheDocument();
    });
  });
});
