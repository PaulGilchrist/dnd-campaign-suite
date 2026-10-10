// @improved-by-ai
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
  {
    name: 'Elf',
    speed: 30,
    traits: [],
    subraces: [
      { name: 'High Elf', description: '', traits: [{ name: 'Cantrip', description: 'You learn one cantrip from the wizard spell list.' }] },
    ],
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

  describe('Rendering', () => {
    it('should display the step heading', () => {
      render(<WizardStepSubrace stepNumber={4} {...createMockProps()} />);
      expect(screen.getByText('Step 4: Subrace')).toBeInTheDocument();
    });

    it('should show a default select option', () => {
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            formData: { race: { name: 'Dragonborn', subrace: { name: '' } } },
          })}
        />
      );
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('');
      expect(select.querySelector('option')).toHaveTextContent('Select a subrace');
    });

    it('should show selected subrace value in dropdown', () => {
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            formData: { race: { name: 'Dragonborn', subrace: { name: 'Red Dragonborn' } } },
          })}
        />
      );
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('Red Dragonborn');
    });

    it('should show no-subrace message when race has no subraces', () => {
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            formData: { race: { name: 'Human', subrace: { name: '' } } },
          })}
        />
      );
      expect(screen.getByText(/Your selected race \(Human\) has no subraces/)).toBeInTheDocument();
    });

    it('should not show subrace dropdown when no subraces available', () => {
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            formData: { race: { name: 'Human', subrace: { name: '' } } },
          })}
        />
      );
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });
  });

  describe('Subrace dropdown options', () => {
    it('should list all subrace names as options', () => {
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            formData: { race: { name: 'Dragonborn', subrace: { name: '' } } },
          })}
        />
      );
      expect(screen.getByText('Subrace *')).toBeInTheDocument();
      expect(screen.getByText('Red Dragonborn')).toBeInTheDocument();
      expect(screen.getByText('Blue Dragonborn')).toBeInTheDocument();
    });
  });

  describe('Expand/Collapse', () => {
    it('should expand details when header is clicked', () => {
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            formData: { race: { name: 'Dragonborn', subrace: { name: 'Red Dragonborn' } } },
          })}
        />
      );
      const header = screen.getByRole('button', { name: /show details/i });
      fireEvent.click(header);
      expect(screen.getByText('Hide Details')).toBeInTheDocument();
    });

    it('should collapse details when header is clicked again', () => {
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            formData: { race: { name: 'Dragonborn', subrace: { name: 'Red Dragonborn' } } },
          })}
        />
      );
      const header = screen.getByRole('button', { name: /show details/i });
      fireEvent.click(header);
      fireEvent.click(header);
      expect(screen.getByText('Show Details')).toBeInTheDocument();
    });

    it('should show subrace details header when expanded', () => {
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            formData: { race: { name: 'Dragonborn', subrace: { name: 'Red Dragonborn' } } },
          })}
        />
      );
      const header = screen.getByRole('button', { name: /show details/i });
      fireEvent.click(header);
      expect(screen.getByText('Red Dragonborn Details')).toBeInTheDocument();
    });

    it('should not show detail card when no subrace is selected', () => {
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            formData: { race: { name: 'Dragonborn', subrace: { name: '' } } },
          })}
        />
      );
      expect(screen.queryByText(/Details$/)).not.toBeInTheDocument();
    });

    it('should not show detail card when race has no subraces', () => {
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            formData: { race: { name: 'Human', subrace: { name: '' } } },
          })}
        />
      );
      expect(screen.queryByRole('button', { name: /show details/i })).not.toBeInTheDocument();
    });
  });

  describe('Description rendering', () => {
    it('should render sanitized HTML description when expanded', () => {
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            formData: { race: { name: 'Dragonborn', subrace: { name: 'Red Dragonborn' } } },
          })}
        />
      );
      const header = screen.getByRole('button', { name: /show details/i });
      fireEvent.click(header);
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Red dragonborn are fierce and passionate.')).toBeInTheDocument();
    });

    it('should not show description section when subrace has no description', () => {
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            formData: { race: { name: 'Elf', subrace: { name: 'High Elf' } } },
          })}
        />
      );
      const header = screen.getByRole('button', { name: /show details/i });
      fireEvent.click(header);
      expect(screen.queryByText('Description')).not.toBeInTheDocument();
    });
  });

  describe('Trait display', () => {
    it('should show damage resistance trait when expanded', () => {
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            formData: { race: { name: 'Dragonborn', subrace: { name: 'Red Dragonborn' } } },
          })}
        />
      );
      const header = screen.getByRole('button', { name: /show details/i });
      fireEvent.click(header);
      expect(screen.getByText('Subrace Traits')).toBeInTheDocument();
      expect(screen.getByText('Damage Resistance')).toBeInTheDocument();
      expect(screen.getByText(/You have resistance to Fire damage/)).toBeInTheDocument();
    });

    it('should show non-damage-resistance traits when expanded', () => {
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            formData: { race: { name: 'Elf', subrace: { name: 'High Elf' } } },
          })}
        />
      );
      const header = screen.getByRole('button', { name: /show details/i });
      fireEvent.click(header);
      expect(screen.getByText('Subrace Traits')).toBeInTheDocument();
      expect(screen.getByText('Cantrip')).toBeInTheDocument();
      expect(screen.getByText(/You learn one cantrip from the wizard spell list/)).toBeInTheDocument();
    });

    it('should not show traits section when subrace has no traits or damage resistance', () => {
      const racesNoTraits = [
        {
          name: 'TestRace',
          speed: 30,
          traits: [],
          subraces: [
            { name: 'EmptySubrace', description: '' },
          ],
        },
      ];
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            formData: { race: { name: 'TestRace', subrace: { name: 'EmptySubrace' } } },
            racesData: racesNoTraits,
          })}
        />
      );
      const header = screen.getByRole('button', { name: /show details/i });
      fireEvent.click(header);
      expect(screen.queryByText('Subrace Traits')).not.toBeInTheDocument();
    });

    it('should render trait descriptions with HTML safely', () => {
      const racesWithHtmlTrait = [
        {
          name: 'TestRace',
          speed: 30,
          traits: [],
          subraces: [
            { name: 'TestSubrace', description: '', traits: [{ name: 'HTML Trait', description: '<p>Has <strong>bold</strong> text.</p>' }] },
          ],
        },
      ];
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            formData: { race: { name: 'TestRace', subrace: { name: 'TestSubrace' } } },
            racesData: racesWithHtmlTrait,
          })}
        />
      );
      const header = screen.getByRole('button', { name: /show details/i });
      fireEvent.click(header);
      expect(screen.getByText('HTML Trait')).toBeInTheDocument();
      const traitDesc = document.querySelector('.trait-description');
      expect(traitDesc.textContent).toContain('Has bold text.');
    });
  });

  describe('Subrace selection', () => {
    it('should call onInputChange with correct payload when subrace changes', () => {
      const mockOnChange = vi.fn();
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            onInputChange: mockOnChange,
            formData: { race: { name: 'Dragonborn', subrace: { name: 'Red Dragonborn' } } },
          })}
        />
      );
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'Blue Dragonborn' } });
      expect(mockOnChange).toHaveBeenCalledWith('race', {
        name: 'Dragonborn',
        subrace: { name: 'Blue Dragonborn' }
      });
    });

    it('should call onInputChange when clearing subrace selection', () => {
      const mockOnChange = vi.fn();
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            onInputChange: mockOnChange,
            formData: { race: { name: 'Dragonborn', subrace: { name: 'Red Dragonborn' } } },
          })}
        />
      );
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '' } });
      expect(mockOnChange).toHaveBeenCalledWith('race', {
        name: 'Dragonborn',
        subrace: { name: '' }
      });
    });
  });

  describe('Error display', () => {
    it('should render error message when subrace error exists', () => {
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            formData: { race: { name: 'Dragonborn', subrace: { name: '' } } },
            errors: { subrace: 'Subrace is required' },
          })}
        />
      );
      expect(screen.getByText('Subrace is required')).toBeInTheDocument();
    });

    it('should apply error class to select when subrace error exists', () => {
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            formData: { race: { name: 'Dragonborn', subrace: { name: '' } } },
            errors: { subrace: 'Subrace is required' },
          })}
        />
      );
      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('error');
    });

    it('should not apply error class when no subrace error exists', () => {
      render(
        <WizardStepSubrace stepNumber={4}
          {...createMockProps({
            formData: { race: { name: 'Dragonborn', subrace: { name: 'Red Dragonborn' } } },
          })}
        />
      );
      const select = screen.getByRole('combobox');
      expect(select).not.toHaveClass('error');
    });
  });
});
