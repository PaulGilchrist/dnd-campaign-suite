// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepSpecial from './WizardStepSpecial.jsx';

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: function MockPreviewToggle({ value, onChange, placeholder }) {
    return (
      <textarea
        className="preview-toggle-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    );
  },
}));

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

  describe('rendering', () => {
    it('should render step header and add action form', () => {
      render(<WizardStepSpecial stepNumber={17} {...baseProps} />);
      expect(screen.getByText('Step 17: Special Actions')).toBeInTheDocument();
      expect(screen.getByText('Add New Action')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Action name (required)')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Description')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Additional details (optional)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add Action' })).toBeInTheDocument();
    });

    it('should render existing actions with name, description, details, and remove button', () => {
      render(<WizardStepSpecial stepNumber={17} {...baseProps} />);
      expect(screen.getByText('Action 1')).toBeInTheDocument();
      expect(screen.getByText('Description 1')).toBeInTheDocument();
      expect(screen.getByText('Custom Special Actions')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });

    it('should not render the actions list section when there are no actions', () => {
      const props = {
        ...baseProps,
        formData: { specialActions: [] },
      };
      render(<WizardStepSpecial stepNumber={17} {...props} />);
      expect(screen.queryByText('Custom Special Actions')).not.toBeInTheDocument();
    });

  });

  describe('normalization', () => {
    it('should normalize string actions to objects with name/description/details', () => {
      const props = {
        ...baseProps,
        formData: {
          specialActions: ['Plain String Action'],
        },
      };
      render(<WizardStepSpecial stepNumber={17} {...props} />);
      expect(screen.getByText('Plain String Action')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });

  });

  describe('adding actions', () => {
    it('should add a new action with trimmed fields and clear the form', () => {
      const mockOnChange = vi.fn();
      const props = {
        ...baseProps,
        formData: {
          specialActions: [],
          newSpecialAction: { name: '  Trimmed Action  ', description: '  Desc  ', details: '   ' },
        },
        onArrayFieldChange: mockOnChange,
      };
      render(<WizardStepSpecial stepNumber={17} {...props} />);
      fireEvent.click(screen.getByRole('button', { name: 'Add Action' }));
      expect(mockOnChange).toHaveBeenCalledWith(
        'specialActions',
        [{ name: 'Trimmed Action', description: 'Desc', details: null }]
      );
      expect(mockOnChange).toHaveBeenCalledWith('newSpecialAction', {});
    });

    it('should not add an action when name is empty, whitespace-only, or missing', () => {
      const mockOnChange = vi.fn();

      // Whitespace-only name
      const propsWhitespace = {
        ...baseProps,
        formData: {
          specialActions: [],
          newSpecialAction: { name: '   ', description: 'Desc', details: '' },
        },
        onArrayFieldChange: mockOnChange,
      };
      const { container: c1 } = render(<WizardStepSpecial stepNumber={17} {...propsWhitespace} />);
      fireEvent.click(c1.querySelector('button.btn-primary'));
      expect(mockOnChange.mock.calls.filter((c) => c[0] === 'specialActions')).toHaveLength(0);

      // Missing name
      const propsNoName = {
        ...baseProps,
        formData: {
          specialActions: [],
          newSpecialAction: { description: 'Desc', details: '' },
        },
        onArrayFieldChange: mockOnChange,
      };
      const { container: c2 } = render(<WizardStepSpecial stepNumber={17} {...propsNoName} />);
      fireEvent.click(c2.querySelector('button.btn-primary'));
      expect(mockOnChange.mock.calls.filter((c) => c[0] === 'specialActions')).toHaveLength(0);
    });

    it('should append to existing actions without replacing them', () => {
      const mockOnChange = vi.fn();
      const props = {
        ...baseProps,
        formData: {
          specialActions: [{ name: 'Existing', description: 'Old', details: null }],
          newSpecialAction: { name: 'New', description: 'New Desc', details: 'New details' },
        },
        onArrayFieldChange: mockOnChange,
      };
      render(<WizardStepSpecial stepNumber={17} {...props} />);
      fireEvent.click(screen.getByRole('button', { name: 'Add Action' }));
      expect(mockOnChange).toHaveBeenCalledWith('specialActions', [
        { name: 'Existing', description: 'Old', details: null },
        { name: 'New', description: 'New Desc', details: 'New details' },
      ]);
    });
  });

  describe('removing actions', () => {
    it('should remove only the clicked action from the array', () => {
      const mockOnChange = vi.fn();

      // Multiple actions: remove middle one
      const propsMulti = {
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
      const { container: c1 } = render(<WizardStepSpecial stepNumber={17} {...propsMulti} />);
      const removeButtons = c1.querySelectorAll('button.btn-danger');
      fireEvent.click(removeButtons[1]);
      expect(mockOnChange).toHaveBeenCalledWith('specialActions', [
        { name: 'Action 1', description: 'Desc 1', details: null },
        { name: 'Action 3', description: 'Desc 3', details: null },
      ]);

      // Single action: removal yields empty array (same code path)
      vi.clearAllMocks();
      const propsSingle = {
        ...baseProps,
        formData: {
          specialActions: [{ name: 'Only Action', description: 'Solo', details: null }],
        },
        onArrayFieldChange: mockOnChange,
      };
      const { container: c2 } = render(<WizardStepSpecial stepNumber={17} {...propsSingle} />);
      fireEvent.click(c2.querySelector('button.btn-danger'));
      expect(mockOnChange).toHaveBeenCalledWith('specialActions', []);
    });

    it('should handle removal from normalized string actions', () => {
      const mockOnChange = vi.fn();
      const props = {
        ...baseProps,
        formData: {
          specialActions: ['String Action 1', 'String Action 2'],
        },
        onArrayFieldChange: mockOnChange,
      };
      render(<WizardStepSpecial stepNumber={17} {...props} />);
      const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
      fireEvent.click(removeButtons[0]);
      expect(mockOnChange).toHaveBeenCalledWith('specialActions', [
        { name: 'String Action 2', description: '', details: null },
      ]);
    });
  });

  describe('form field updates', () => {
    it('should update new action fields on typing', () => {
      const mockOnChange = vi.fn();
      render(<WizardStepSpecial stepNumber={17} {...baseProps} onArrayFieldChange={mockOnChange} />);

      const nameInput = screen.getByPlaceholderText('Action name (required)');
      fireEvent.change(nameInput, { target: { value: 'New Action Name' } });
      expect(mockOnChange).toHaveBeenCalledWith('newSpecialAction', { name: 'New Action Name' });

      const descriptionTextarea = screen.getByPlaceholderText('Description');
      fireEvent.change(descriptionTextarea, { target: { value: 'A powerful new description' } });
      expect(mockOnChange).toHaveBeenCalledWith('newSpecialAction', {
        description: 'A powerful new description',
      });

      const detailsTextarea = screen.getByPlaceholderText('Additional details (optional)');
      fireEvent.change(detailsTextarea, { target: { value: 'Some important details' } });
      expect(mockOnChange).toHaveBeenCalledWith('newSpecialAction', {
        details: 'Some important details',
      });
    });

    it('should preserve existing newSpecialAction fields when updating one field', () => {
      const mockOnChange = vi.fn();
      const props = {
        ...baseProps,
        formData: {
          specialActions: [],
          newSpecialAction: { name: 'Existing Name', description: 'Existing Desc', details: 'Existing Details' },
        },
        onArrayFieldChange: mockOnChange,
      };
      render(<WizardStepSpecial stepNumber={17} {...props} />);

      const nameInput = screen.getByPlaceholderText('Action name (required)');
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
      expect(mockOnChange).toHaveBeenCalledWith('newSpecialAction', {
        name: 'Updated Name',
        description: 'Existing Desc',
        details: 'Existing Details',
      });
    });

    it('should handle undefined newSpecialAction gracefully', () => {
      const mockOnChange = vi.fn();
      const props = {
        ...baseProps,
        formData: {
          specialActions: [],
          newSpecialAction: undefined,
        },
        onArrayFieldChange: mockOnChange,
      };
      render(<WizardStepSpecial stepNumber={17} {...props} />);

      const nameInput = screen.getByPlaceholderText('Action name (required)');
      expect(nameInput).toHaveValue('');
      fireEvent.change(nameInput, { target: { value: 'New Action' } });
      expect(mockOnChange).toHaveBeenCalledWith('newSpecialAction', {
        name: 'New Action',
      });
    });
  });
});
