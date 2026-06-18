// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepSpecial from './WizardStepSpecial.jsx';

describe('WizardStepSpecial', () => {
  const baseProps = {
    formData: {
      specialActions: [{ name: 'Action 1', description: 'Description 1', details: null }],
    },
    onArrayFieldChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render step header', () => {
    render(<WizardStepSpecial {...baseProps} />);

    expect(screen.getByText('Step 12: Special Actions')).toBeInTheDocument();
  });

  it('should render add action form with all input fields', () => {
    render(<WizardStepSpecial {...baseProps} />);

    expect(screen.getByText('Add New Action')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Action name (required)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Description')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Additional details (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Action' })).toBeInTheDocument();
  });

  it('should render existing actions with their details', () => {
    render(<WizardStepSpecial {...baseProps} />);

    expect(screen.getByText('Action 1')).toBeInTheDocument();
    expect(screen.getByText('Description 1')).toBeInTheDocument();
  });

  it('should render a remove button for each action', () => {
    render(<WizardStepSpecial {...baseProps} />);

    expect(screen.getByText('Action 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('should render action details when present', () => {
    const propsWithDetails = {
      ...baseProps,
      formData: {
        specialActions: [
          { name: 'Action with Details', description: 'Desc', details: 'Important details here' },
        ],
      },
    };

    render(<WizardStepSpecial {...propsWithDetails} />);

    expect(screen.getByText('Important details here')).toBeInTheDocument();
  });

  it('should not render action description when it is falsy', () => {
    const propsWithNoDescription = {
      ...baseProps,
      formData: {
        specialActions: [{ name: 'No Desc Action', description: '', details: null }],
      },
    };

    render(<WizardStepSpecial {...propsWithNoDescription} />);

    expect(screen.getByText('No Desc Action')).toBeInTheDocument();
    expect(screen.queryByText('No Desc Action')).toBeTruthy();
  });

  it('should not render action details when they are falsy', () => {
    const propsWithNoDetails = {
      ...baseProps,
      formData: {
        specialActions: [{ name: 'No Details Action', description: 'Desc', details: '' }],
      },
    };

    render(<WizardStepSpecial {...propsWithNoDetails} />);

    expect(screen.getByText('No Details Action')).toBeInTheDocument();
    expect(screen.queryByLabelText('Additional details (optional)')).not.toBeInTheDocument();
  });

  it('should add a new action when Add Action button is clicked', () => {
    const mockOnChange = vi.fn();
    const props = {
      ...baseProps,
      formData: {
        specialActions: [],
        newSpecialAction: { name: 'New Action', description: 'New Desc', details: 'New Details' },
      },
      onArrayFieldChange: mockOnChange,
    };

    render(<WizardStepSpecial {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Action' }));

    expect(mockOnChange).toHaveBeenCalledWith(
      'specialActions',
      [{ name: 'New Action', description: 'New Desc', details: 'New Details' }]
    );
    expect(mockOnChange).toHaveBeenCalledWith('newSpecialAction', {});
  });

  it('should trim action name before adding', () => {
    const mockOnChange = vi.fn();
    const props = {
      ...baseProps,
      formData: {
        specialActions: [],
        newSpecialAction: { name: '  Trimmed Action  ', description: 'Desc', details: '' },
      },
      onArrayFieldChange: mockOnChange,
    };

    render(<WizardStepSpecial {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Action' }));

    expect(mockOnChange).toHaveBeenCalledWith(
      'specialActions',
      [{ name: 'Trimmed Action', description: 'Desc', details: null }]
    );
  });

  it('should trim description before adding', () => {
    const mockOnChange = vi.fn();
    const props = {
      ...baseProps,
      formData: {
        specialActions: [],
        newSpecialAction: { name: 'Action', description: '  Trimmed Desc  ', details: '' },
      },
      onArrayFieldChange: mockOnChange,
    };

    render(<WizardStepSpecial {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Action' }));

    expect(mockOnChange).toHaveBeenCalledWith(
      'specialActions',
      [{ name: 'Action', description: 'Trimmed Desc', details: null }]
    );
  });

  it('should set details to null when empty or whitespace-only', () => {
    const mockOnChange = vi.fn();
    const props = {
      ...baseProps,
      formData: {
        specialActions: [],
        newSpecialAction: { name: 'Action', description: 'Desc', details: '   ' },
      },
      onArrayFieldChange: mockOnChange,
    };

    render(<WizardStepSpecial {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Action' }));

    expect(mockOnChange).toHaveBeenCalledWith(
      'specialActions',
      [{ name: 'Action', description: 'Desc', details: null }]
    );
  });

  it('should not add an action when name is empty', () => {
    const mockOnChange = vi.fn();
    const props = {
      ...baseProps,
      formData: {
        specialActions: [],
        newSpecialAction: { name: '', description: 'Desc', details: '' },
      },
      onArrayFieldChange: mockOnChange,
    };

    render(<WizardStepSpecial {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Action' }));

    const specialActionsCalls = mockOnChange.mock.calls.filter((c) => c[0] === 'specialActions');
    expect(specialActionsCalls).toHaveLength(0);
  });

  it('should not add an action when name is whitespace-only', () => {
    const mockOnChange = vi.fn();
    const props = {
      ...baseProps,
      formData: {
        specialActions: [],
        newSpecialAction: { name: '   ', description: 'Desc', details: '' },
      },
      onArrayFieldChange: mockOnChange,
    };

    render(<WizardStepSpecial {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Action' }));

    const specialActionsCalls = mockOnChange.mock.calls.filter((c) => c[0] === 'specialActions');
    expect(specialActionsCalls).toHaveLength(0);
  });

  it('should remove an action when its remove button is clicked', () => {
    const mockOnChange = vi.fn();
    render(<WizardStepSpecial {...baseProps} onArrayFieldChange={mockOnChange} />);

    expect(screen.getByText('Action 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(mockOnChange).toHaveBeenCalledWith('specialActions', []);
  });

  it('should remove only the clicked action when multiple actions exist', () => {
    const mockOnChange = vi.fn();
    const props = {
      ...baseProps,
      formData: {
        specialActions: [
          { name: 'Action 1', description: 'Desc 1', details: null },
          { name: 'Action 2', description: 'Desc 2', details: 'Details 2' },
          { name: 'Action 3', description: 'Desc 3', details: null },
        ],
      },
      onArrayFieldChange: mockOnChange,
    };

    render(<WizardStepSpecial {...props} onArrayFieldChange={mockOnChange} />);

    expect(screen.getByText('Action 1')).toBeInTheDocument();
    expect(screen.getByText('Action 2')).toBeInTheDocument();
    expect(screen.getByText('Action 3')).toBeInTheDocument();

    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    fireEvent.click(removeButtons[1]);

    expect(mockOnChange).toHaveBeenCalledWith('specialActions', [
      { name: 'Action 1', description: 'Desc 1', details: null },
      { name: 'Action 3', description: 'Desc 3', details: null },
    ]);
  });

  it('should render multiple actions', () => {
    const props = {
      ...baseProps,
      formData: {
        specialActions: [
          { name: 'Action 1', description: 'Desc 1', details: 'Details 1' },
          { name: 'Action 2', description: 'Desc 2', details: null },
        ],
      },
    };

    render(<WizardStepSpecial {...props} />);

    expect(screen.getByText('Action 1')).toBeInTheDocument();
    expect(screen.getByText('Action 2')).toBeInTheDocument();
    expect(screen.getByText('Details 1')).toBeInTheDocument();
  });

  it('should not render actions list when specialActions is empty', () => {
    const props = {
      ...baseProps,
      formData: { specialActions: [] },
    };

    render(<WizardStepSpecial {...props} />);

    expect(screen.queryByText('Custom Special Actions')).not.toBeInTheDocument();
  });

  it('should not render actions list when specialActions is null', () => {
    const props = {
      ...baseProps,
      formData: { specialActions: null },
    };

    render(<WizardStepSpecial {...props} />);

    expect(screen.queryByText('Custom Special Actions')).not.toBeInTheDocument();
  });

  it('should not render actions list when specialActions is undefined', () => {
    const props = {
      ...baseProps,
      formData: { specialActions: undefined },
    };

    render(<WizardStepSpecial {...props} />);

    expect(screen.queryByText('Custom Special Actions')).not.toBeInTheDocument();
  });

  it('should handle string entries in specialActions by normalizing them', () => {
    const props = {
      ...baseProps,
      formData: {
        specialActions: ['String Action 1', 'String Action 2'],
      },
    };

    render(<WizardStepSpecial {...props} />);

    expect(screen.getByText('String Action 1')).toBeInTheDocument();
    expect(screen.getByText('String Action 2')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove' }).length).toBe(2);
  });

  it('should handle empty string entries in specialActions', () => {
    const props = {
      ...baseProps,
      formData: {
        specialActions: [''],
      },
    };

    render(<WizardStepSpecial {...props} />);

    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('should handle empty formData object', () => {
    render(
      <WizardStepSpecial
        formData={{}}
        onArrayFieldChange={vi.fn()}
      />
    );

    expect(screen.getByText('Step 12: Special Actions')).toBeInTheDocument();
  });

  it('should update new action name field on typing', () => {
    const mockOnChange = vi.fn();
    render(<WizardStepSpecial {...baseProps} onArrayFieldChange={mockOnChange} />);

    const nameInput = screen.getByPlaceholderText('Action name (required)');
    fireEvent.change(nameInput, { target: { value: 'New Action Name' } });

    expect(mockOnChange).toHaveBeenCalledWith('newSpecialAction', { name: 'New Action Name' });
  });

  it('should merge new action field updates with existing newSpecialAction', () => {
    const mockOnChange = vi.fn();
    const props = {
      ...baseProps,
      formData: {
        newSpecialAction: { name: 'Existing Name', description: 'Existing Desc', details: '' },
      },
      onArrayFieldChange: mockOnChange,
    };

    render(<WizardStepSpecial {...props} onArrayFieldChange={mockOnChange} />);

    const nameInput = screen.getByPlaceholderText('Action name (required)');
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

    expect(mockOnChange).toHaveBeenCalledWith('newSpecialAction', {
      name: 'Updated Name',
      description: 'Existing Desc',
      details: '',
    });
  });

  it('should update description via textarea on change', () => {
    const mockOnChange = vi.fn();
    render(<WizardStepSpecial {...baseProps} onArrayFieldChange={mockOnChange} />);

    const descriptionTextarea = screen.getByPlaceholderText('Description');
    fireEvent.change(descriptionTextarea, { target: { value: 'A powerful new description' } });

    expect(mockOnChange).toHaveBeenCalledWith('newSpecialAction', {
      description: 'A powerful new description',
    });
  });

  it('should update details via textarea on change', () => {
    const mockOnChange = vi.fn();
    render(<WizardStepSpecial {...baseProps} onArrayFieldChange={mockOnChange} />);

    const detailsTextarea = screen.getByPlaceholderText('Additional details (optional)');
    fireEvent.change(detailsTextarea, { target: { value: 'Some important details' } });

    expect(mockOnChange).toHaveBeenCalledWith('newSpecialAction', {
      details: 'Some important details',
    });
  });

  it('should allow adding actions with duplicate names', () => {
    const mockOnChange = vi.fn();
    const props = {
      ...baseProps,
      formData: {
        specialActions: [
          { name: 'Action 1', description: 'Description 1', details: null },
        ],
        newSpecialAction: { name: 'Action 1', description: 'Duplicate version', details: '' },
      },
      onArrayFieldChange: mockOnChange,
    };

    render(<WizardStepSpecial {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Action' }));

    expect(mockOnChange).toHaveBeenCalledWith('specialActions', [
      { name: 'Action 1', description: 'Description 1', details: null },
      { name: 'Action 1', description: 'Duplicate version', details: null },
    ]);
    expect(mockOnChange).toHaveBeenCalledWith('newSpecialAction', {});
  });

  it('should clear new action form after adding', () => {
    const mockOnChange = vi.fn();
    const props = {
      ...baseProps,
      formData: {
        specialActions: [],
        newSpecialAction: { name: 'Test Action', description: 'Test Desc', details: '' },
      },
      onArrayFieldChange: mockOnChange,
    };

    render(<WizardStepSpecial {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Action' }));

    expect(mockOnChange).toHaveBeenCalledWith('newSpecialAction', {});
  });

  it('should render the Custom Special Actions label when actions exist', () => {
    render(<WizardStepSpecial {...baseProps} />);

    expect(screen.getByText('Custom Special Actions')).toBeInTheDocument();
  });

  it('should not render the Custom Special Actions label when no actions exist', () => {
    const props = {
      ...baseProps,
      formData: { specialActions: [] },
    };

    render(<WizardStepSpecial {...props} />);

    expect(screen.queryByText('Custom Special Actions')).not.toBeInTheDocument();
  });
});
