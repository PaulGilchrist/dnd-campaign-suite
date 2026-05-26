import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepSpecial from './WizardStepSpecial.jsx';

describe('WizardStepSpecial', () => {
  const mockProps = {
    formData: {
      specialActions: [
         { name: 'Action 1', description: 'Description 1', details: null },
        ],
      },
    onArrayFieldChange: vi.fn(),
     };

  beforeEach(() => {
    vi.clearAllMocks();
     });

  it('should render step header', () => {
    render(<WizardStepSpecial {...mockProps} />);

    expect(screen.getByText('Step 12: Special Actions')).toBeInTheDocument();
     });

  it('should render add action form', () => {
    render(<WizardStepSpecial {...mockProps} />);

    expect(screen.getByText('Add New Action')).toBeInTheDocument();
     });

  it('should render existing actions list', () => {
    render(<WizardStepSpecial {...mockProps} />);

    expect(screen.getByText('Action 1')).toBeInTheDocument();
    expect(screen.getByText('Description 1')).toBeInTheDocument();
     });

  it('should render remove button for each action', () => {
    render(<WizardStepSpecial {...mockProps} />);

    expect(screen.getByText('Action 1')).toBeInTheDocument();
    const removeBtn = document.querySelector('.btn-danger');
    expect(removeBtn).toBeInTheDocument();
     });

  it('should add a new action when Add Action button is clicked', () => {
    const mockOnChange = vi.fn();
    const emptyList = {
         ...mockProps,
      formData: { specialActions: [], newSpecialAction: { name: 'New Action', description: 'New Desc', details: '' } },
       };

    render(<WizardStepSpecial {...emptyList} onArrayFieldChange={mockOnChange} />);

    const addBtn = screen.getByText('Add Action');
    fireEvent.click(addBtn);

    expect(mockOnChange).toHaveBeenCalledWith('specialActions', expect.arrayContaining([expect.objectContaining({ name: 'New Action' })]));
    expect(mockOnChange).toHaveBeenCalledWith('newSpecialAction', {});
     });

  it('should not add action if name is empty', () => {
    const mockOnChange = vi.fn();
    const emptyList = {
         ...mockProps,
      formData: { specialActions: [], newSpecialAction: { name: '', description: 'Desc', details: '' } },
       };

    render(<WizardStepSpecial {...emptyList} onArrayFieldChange={mockOnChange} />);

    const addBtn = screen.getByText('Add Action');
    fireEvent.click(addBtn);

    const calls = mockOnChange.mock.calls.filter(c => c[0] === 'specialActions');
    expect(calls).toHaveLength(0);
     });

  it('should remove action when remove button is clicked', () => {
    const mockOnChange = vi.fn();
    render(<WizardStepSpecial {...mockProps} onArrayFieldChange={mockOnChange} />);

    expect(screen.getByText('Action 1')).toBeInTheDocument();

    const removeBtns = document.querySelectorAll('.btn-danger');
    fireEvent.click(removeBtns[0]);

    expect(mockOnChange).toHaveBeenCalledWith('specialActions', []);
     });

  it('should handle multiple actions', () => {
    const multipleActions = {
         ...mockProps,
      formData: {
        specialActions: [
           { name: 'Action 1', description: 'Desc 1', details: 'Details 1' },
           { name: 'Action 2', description: 'Desc 2', details: null },
          ],
         },
       };

    render(<WizardStepSpecial {...multipleActions} />);

    expect(screen.getByText('Action 1')).toBeInTheDocument();
    expect(screen.getByText('Action 2')).toBeInTheDocument();
    expect(screen.getByText('Details 1')).toBeInTheDocument();
     });

  it('should not render actions list when empty', () => {
    const emptyList = {
         ...mockProps,
      formData: { specialActions: [] },
       };

    render(<WizardStepSpecial {...emptyList} />);

    expect(screen.queryByText('Custom Special Actions')).not.toBeInTheDocument();
     });

  it('should handle string actions', () => {
    const stringActions = {
         ...mockProps,
      formData: {
        specialActions: ['String Action 1', 'String Action 2'],
         },
       };

    render(<WizardStepSpecial {...stringActions} />);

    expect(screen.getByText('String Action 1')).toBeInTheDocument();
    expect(screen.getByText('String Action 2')).toBeInTheDocument();
     });

  it('should handle empty formData', () => {
    render(
         <WizardStepSpecial
          formData={{}}
          onArrayFieldChange={vi.fn()}
          />
       );

    expect(screen.getByText('Step 12: Special Actions')).toBeInTheDocument();
     });

  it('should display action details when present', () => {
    const actionWithDetails = {
         ...mockProps,
      formData: {
        specialActions: [
           { name: 'Action with Details', description: 'Desc', details: 'Important details here' },
          ],
         },
        };

    render(<WizardStepSpecial {...actionWithDetails} />);

    expect(screen.getByText('Important details here')).toBeInTheDocument();
     });

  it('should update new action name field on typing', () => {
    const mockOnChange = vi.fn();
    render(<WizardStepSpecial {...mockProps} onArrayFieldChange={mockOnChange} />);

    const nameInput = screen.getByPlaceholderText('Action name (required)');
    fireEvent.change(nameInput, { target: { value: 'New Action Name' } });

    expect(mockOnChange).toHaveBeenCalledWith('newSpecialAction', { name: 'New Action Name' });
  });

  it('should allow adding actions with duplicate names', () => {
    const mockOnChange = vi.fn();
    const propsWithSameName = {
      ...mockProps,
      formData: {
        specialActions: [
          { name: 'Action 1', description: 'Description 1', details: null },
        ],
        newSpecialAction: { name: 'Action 1', description: 'Duplicate version', details: '' },
      },
      onArrayFieldChange: mockOnChange,
    };

    render(<WizardStepSpecial {...propsWithSameName} />);
    fireEvent.click(screen.getByText('Add Action'));

    expect(mockOnChange).toHaveBeenCalledWith('specialActions', [
      { name: 'Action 1', description: 'Description 1', details: null },
      { name: 'Action 1', description: 'Duplicate version', details: null },
    ]);
    expect(mockOnChange).toHaveBeenCalledWith('newSpecialAction', {});
  });

  it('should clear new action form after adding', () => {
    const mockOnChange = vi.fn();
    const propsWithAction = {
      ...mockProps,
      formData: {
        specialActions: [],
        newSpecialAction: { name: 'Test Action', description: 'Test Desc', details: '' },
      },
      onArrayFieldChange: mockOnChange,
    };

    render(<WizardStepSpecial {...propsWithAction} />);
    fireEvent.click(screen.getByText('Add Action'));

    expect(mockOnChange).toHaveBeenCalledWith('newSpecialAction', {});
  });

  it('should update description via PreviewToggle textarea', () => {
    const mockOnChange = vi.fn();
    render(<WizardStepSpecial {...mockProps} onArrayFieldChange={mockOnChange} />);

    const descriptionTextarea = screen.getByPlaceholderText('Description');
    fireEvent.change(descriptionTextarea, { target: { value: 'A powerful new description' } });

    expect(mockOnChange).toHaveBeenCalledWith('newSpecialAction', {
      description: 'A powerful new description',
    });
  });

  it('should update details via PreviewToggle textarea', () => {
    const mockOnChange = vi.fn();
    render(<WizardStepSpecial {...mockProps} onArrayFieldChange={mockOnChange} />);

    const detailsTextarea = screen.getByPlaceholderText('Additional details (optional)');
    fireEvent.change(detailsTextarea, { target: { value: 'Some important details' } });

    expect(mockOnChange).toHaveBeenCalledWith('newSpecialAction', {
      details: 'Some important details',
    });
  });
});
