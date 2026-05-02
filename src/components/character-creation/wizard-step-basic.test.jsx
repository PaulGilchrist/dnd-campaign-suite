import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepBasic from './wizard-step-basic';

const mockAlignments = ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'];

global.fetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockAlignments),
     });
});

const mockProps = {
  formData: {
    name: 'Test Character',
    level: 5,
    alignment: 'Lawful Good',
     },
  errors: {},
  onInputChange: vi.fn(),
};

describe('WizardStepBasic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAlignments),
       });
     });

  it('should render step header', () => {
    render(<WizardStepBasic {...mockProps} />);

    expect(screen.getByText('Step 2: Basic Information')).toBeInTheDocument();
     });

  it('should render name label', () => {
    render(<WizardStepBasic {...mockProps} />);

    expect(screen.getByText('Character Name *')).toBeInTheDocument();
     });

  it('should render level label', () => {
    render(<WizardStepBasic {...mockProps} />);

    expect(screen.getByText('Level *')).toBeInTheDocument();
     });

  it('should render alignment label', () => {
    render(<WizardStepBasic {...mockProps} />);

    expect(screen.getByText('Alignment *')).toBeInTheDocument();
     });

  it('should display initial name value', () => {
    render(<WizardStepBasic {...mockProps} />);

    expect(screen.getByDisplayValue('Test Character')).toBeInTheDocument();
     });

  it('should display initial level value', () => {
    render(<WizardStepBasic {...mockProps} />);

    const levelInput = document.querySelector('input[type="number"]');
    expect(levelInput).toHaveAttribute('value', '5');
     });

  it('should call onInputChange when name changes', () => {
    const mockOnChange = vi.fn();
    render(<WizardStepBasic {...mockProps} onInputChange={mockOnChange} />);

    const nameInput = screen.getByDisplayValue('Test Character');
    fireEvent.change(nameInput, { target: { value: 'New Name' } });

    expect(mockOnChange).toHaveBeenCalledWith('name', 'New Name');
     });

  it('should call onInputChange when level changes', () => {
    const mockOnChange = vi.fn();
    render(<WizardStepBasic {...mockProps} onInputChange={mockOnChange} />);

    const levelInput = document.querySelector('input[type="number"]');
    fireEvent.change(levelInput, { target: { value: '10' } });

    expect(mockOnChange).toHaveBeenCalledWith('level', 10);
     });

  it('should show error for name field', () => {
    render(<WizardStepBasic {...mockProps} errors={{ name: 'Name is required' }} />);

    expect(screen.getByText('Name is required')).toBeInTheDocument();
     });

  it('should show error for level field', () => {
    render(<WizardStepBasic {...mockProps} errors={{ level: 'Level is required' }} />);

    expect(screen.getByText('Level is required')).toBeInTheDocument();
     });

  it('should show error for alignment field', () => {
    render(<WizardStepBasic {...mockProps} errors={{ alignment: 'Alignment is required' }} />);

    expect(screen.getByText('Alignment is required')).toBeInTheDocument();
     });

  it('should not show background for 5e ruleset', () => {
    render(<WizardStepBasic {...mockProps} ruleset="5e" />);

    expect(screen.queryByText('Background (2024 Rules)')).not.toBeInTheDocument();
     });

  it('should show background for 2024 ruleset', () => {
    const backgrounds = [{ index: 'acrobat', name: 'Acrobat' }];

    render(
         <WizardStepBasic
          {...mockProps}
         ruleset="2024"
         backgrounds={backgrounds}
          />
        );

    expect(screen.getByText('Background (2024 Rules)')).toBeInTheDocument();
     });

  it('should call onInputChange when background changes', () => {
    const mockOnChange = vi.fn();
    const backgrounds = [{ index: 'acrobat', name: 'Acrobat' }];

    render(
         <WizardStepBasic
          {...mockProps}
         ruleset="2024"
         backgrounds={backgrounds}
         onInputChange={mockOnChange}
          />
        );

    const backgroundSelect = document.querySelectorAll('select')[1];
    fireEvent.change(backgroundSelect, { target: { value: 'Acrobat' } });

    expect(mockOnChange).toHaveBeenCalledWith('background', 'Acrobat');
     });

  it('should show background error when provided (2024)', () => {
    const backgrounds = [{ index: 'acrobat', name: 'Acrobat' }];

    render(
         <WizardStepBasic
          {...mockProps}
         ruleset="2024"
         backgrounds={backgrounds}
         errors={{ background: 'Background is required for 2024 rules' }}
          />
        );

    expect(screen.getByText('Background is required for 2024 rules')).toBeInTheDocument();
     });

  it('should handle empty formData', () => {
    render(
         <WizardStepBasic
         formData={{ name: '', level: '', alignment: '' }}
         errors={{}}
         onInputChange={vi.fn()}
          />
        );

    expect(screen.getByText('Step 2: Basic Information')).toBeInTheDocument();
     });
});
