import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepRaceClass from './wizard-step-race-class.jsx';

describe('WizardStepRaceClass', () => {
  const mockProps = {
    formData: {
      race: { name: 'Human' },
      class: { name: 'Fighter' },
     },
    errors: {},
    ruleset: '5e',
    onInputChange: vi.fn(),
    racesData: [
       { name: 'Human', subraces: [{ index: 'hill', name: 'Hill' }, { index: 'high', name: 'High' }] },
       { name: 'Elf', subraces: [{ index: 'wood', name: 'Wood' }, { index: 'drow', name: 'Drow' }] },
      ],
    classSubtypes: [
       { className: 'Fighter', subtypes: [{ name: 'Champion' }, { name: 'Battle Master' }] },
       { className: 'Wizard', subtypes: [{ name: 'Evocation' }, { name: 'Transmutation' }] },
      ],
    };

  beforeEach(() => {
    vi.clearAllMocks();
    });

  it('should render step header', () => {
    render(<WizardStepRaceClass {...mockProps} />);

    expect(screen.getByText('Step 3: Race & Class')).toBeInTheDocument();
    });

  it('should render race label', () => {
    render(<WizardStepRaceClass {...mockProps} />);

    expect(screen.getByText('Race *')).toBeInTheDocument();
    });

  it('should display race options', () => {
    render(<WizardStepRaceClass {...mockProps} />);

    const raceSelect = document.querySelector('select');
    expect(raceSelect).toBeInTheDocument();

    fireEvent.change(raceSelect, { target: { value: 'Human' } });

    expect(mockProps.onInputChange).toHaveBeenCalledWith('race', { name: 'Human' });
    });

  it('should display subrace options when race has subraces', () => {
    render(<WizardStepRaceClass {...mockProps} />);

    expect(screen.getByText('Hill')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    });

  it('should not show subrace dropdown when race has no subraces', () => {
    const propsNoSubraces = {
        ...mockProps,
      formData: {
        race: { name: 'Elf' },
        class: { name: 'Fighter' },
        },
      racesData: [{ name: 'Elf', subraces: [] }],
      };

    render(<WizardStepRaceClass {...propsNoSubraces} />);

    expect(screen.queryByText('Hill')).not.toBeInTheDocument();
    });

  it('should display class label', () => {
    render(<WizardStepRaceClass {...mockProps} />);

    expect(screen.getByText('Class *')).toBeInTheDocument();
    });

  it('should display class options', () => {
    render(<WizardStepRaceClass {...mockProps} />);

    expect(screen.getByText('Champion')).toBeInTheDocument();
    expect(screen.getByText('Battle Master')).toBeInTheDocument();
    });

  it('should display subclass label (5e)', () => {
    render(<WizardStepRaceClass {...mockProps} />);

    expect(screen.getByText('Subclass *')).toBeInTheDocument();
    });

  it('should use Major label for 2024 ruleset', () => {
    const props2024 = {
        ...mockProps,
      ruleset: '2024',
      };

    render(<WizardStepRaceClass {...props2024} />);

    expect(screen.getByText('Subclass (Major) *')).toBeInTheDocument();
    });

  it('should use Subrace Major label for 2024 ruleset', () => {
    const props2024 = {
        ...mockProps,
      ruleset: '2024',
      };

    render(<WizardStepRaceClass {...props2024} />);

    expect(screen.getByText('Subrace (Major) *')).toBeInTheDocument();
    });

  it('should call onInputChange when class changes', () => {
    const mockOnInputChange = vi.fn();
    render(
        <WizardStepRaceClass
         {...mockProps}
         onInputChange={mockOnInputChange}
        />
      );

    const classSelect = document.querySelectorAll('select')[2];
    fireEvent.change(classSelect, { target: { value: 'Wizard' } });

    expect(mockOnInputChange).toHaveBeenCalledWith('class', { name: 'Wizard' });
    });

  it('should update subrace when changed', () => {
    const mockOnInputChange = vi.fn();
    render(
        <WizardStepRaceClass
         {...mockProps}
         onInputChange={mockOnInputChange}
        />
      );

    const subraceSelect = document.querySelectorAll('select')[1];
    fireEvent.change(subraceSelect, { target: { value: 'Hill' } });

    expect(mockOnInputChange).toHaveBeenCalledWith(
      'race',
      expect.objectContaining({ subrace: expect.objectContaining({ name: 'Hill' }) })
     );
    });

  it('should update subclass when changed', () => {
    const mockOnInputChange = vi.fn();
    render(
        <WizardStepRaceClass
         {...mockProps}
         onInputChange={mockOnInputChange}
        />
      );

    const subclassSelect = document.querySelectorAll('select')[3];
    fireEvent.change(subclassSelect, { target: { value: 'Champion' } });

    expect(mockOnInputChange).toHaveBeenCalledWith(
      'class',
      expect.objectContaining({ subclass: expect.objectContaining({ name: 'Champion' }) })
     );
    });

  it('should show race error when provided', () => {
    render(
        <WizardStepRaceClass
         {...mockProps}
         errors={{ race: 'Race is required' }}
        />
      );

    expect(screen.getByText('Race is required')).toBeInTheDocument();
    });

  it('should show class error when provided', () => {
    render(
        <WizardStepRaceClass
         {...mockProps}
         errors={{ class: 'Class is required' }}
        />
      );

    expect(screen.getByText('Class is required')).toBeInTheDocument();
    });

  it('should show subclass error when provided', () => {
    render(
        <WizardStepRaceClass
         {...mockProps}
         errors={{ subclass: 'Subclass is required' }}
        />
      );

    expect(screen.getByText('Subclass is required')).toBeInTheDocument();
    });

  it('should show subrace error when provided', () => {
    render(
        <WizardStepRaceClass
         {...mockProps}
         errors={{ subrace: 'Subrace is required' }}
        />
      );

    expect(screen.getByText('Subrace is required')).toBeInTheDocument();
    });

  it('should show loading races when racesData is empty', () => {
    render(
        <WizardStepRaceClass
         {...mockProps}
         racesData={[]}
        />
      );

    expect(screen.getByText('Loading races...')).toBeInTheDocument();
    });

  it('should show loading classes when classSubtypes is empty', () => {
    render(
        <WizardStepRaceClass
         {...mockProps}
         classSubtypes={[]}
        />
      );

    expect(screen.getByText('Loading classes...')).toBeInTheDocument();
    });

  it('should not show subclass dropdown when no subclasses available', () => {
    render(
        <WizardStepRaceClass
         {...mockProps}
         formData={{ ...mockProps.formData, class: { name: 'Wizard' } }}
         classSubtypes={[]}
        />
      );

    expect(screen.queryByText('Champion')).not.toBeInTheDocument();
    });

  it('should handle undefined race', () => {
    render(
        <WizardStepRaceClass
         {...mockProps}
         formData={{ race: undefined, class: { name: 'Fighter' } }}
        />
      );

    expect(screen.getByText('Step 3: Race & Class')).toBeInTheDocument();
    });
});
