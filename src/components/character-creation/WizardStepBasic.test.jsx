// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepBasic from './WizardStepBasic.jsx';

const mockAlignments = [
  'Lawful Good',
  'Neutral Good',
  'Chaotic Good',
  'Lawful Neutral',
  'True Neutral',
  'Chaotic Neutral',
  'Lawful Evil',
  'Neutral Evil',
  'Chaotic Evil',
];

const mockBackgrounds2024 = [
  { index: 'acrobat', name: 'Acrobat' },
  { index: 'soldier', name: 'Soldier' },
];

function createMockProps(overrides = {}) {
  return {
    formData: {
      name: 'Test Character',
      level: 5,
      alignment: 'Lawful Good',
      background: '',
      image: '',
      imagePath: '',
      ...overrides.formData,
    },
    errors: overrides.errors || {},
    onInputChange: overrides.onInputChange || vi.fn(),
    ...overrides,
  };
}

function setupFetchMock(alignments) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(alignments),
  });
}

function setupFetchFailure() {
  global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
}

describe('WizardStepBasic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetchMock(mockAlignments);
  });

  describe('Render — header and labels', () => {
    it('should render the step header', () => {
      render(<WizardStepBasic {...createMockProps()} />);

      expect(screen.getByText('Step 2: Basic Information')).toBeInTheDocument();
    });

    it('should render all field labels', () => {
      render(<WizardStepBasic {...createMockProps()} />);

      expect(screen.getByText('Character Name *')).toBeInTheDocument();
      expect(screen.getByText('Level *')).toBeInTheDocument();
      expect(screen.getByText('Alignment *')).toBeInTheDocument();
      expect(screen.getByText('Character Picture')).toBeInTheDocument();
    });

    it('should show background label for 2024 ruleset', () => {
      render(
        <WizardStepBasic
          {...createMockProps()}
          ruleset="2024"
          backgrounds={mockBackgrounds2024}
        />
      );

      expect(screen.getByText('Background (2024 Rules)')).toBeInTheDocument();
    });

    it('should not show background label for 5e ruleset', () => {
      render(<WizardStepBasic {...createMockProps()} ruleset="5e" />);

      expect(screen.queryByText('Background (2024 Rules)')).not.toBeInTheDocument();
    });
  });

  describe('Render — form values', () => {
    it('should display the initial name value', () => {
      render(<WizardStepBasic {...createMockProps()} />);

      expect(screen.getByDisplayValue('Test Character')).toBeInTheDocument();
    });

    it('should display the initial level value', () => {
      render(<WizardStepBasic {...createMockProps()} />);

      const levelInput = document.querySelector('input[type="number"]');
      expect(levelInput).toHaveAttribute('value', '5');
    });

    it('should render level input with min and max attributes', () => {
      render(<WizardStepBasic {...createMockProps()} />);

      const levelInput = document.querySelector('input[type="number"]');
      expect(levelInput).toHaveAttribute('min', '1');
      expect(levelInput).toHaveAttribute('max', '20');
    });

    it('should display the initial alignment value in the select', async () => {
      render(<WizardStepBasic {...createMockProps()} />);

      await waitFor(() => {
        const alignmentSelect = document.querySelector('select');
        expect(alignmentSelect).toHaveValue('Lawful Good');
      });
    });

    it('should render alignment options from fetched data', async () => {
      render(<WizardStepBasic {...createMockProps()} />);

      await waitFor(() => {
        const options = document.querySelectorAll('select option');
        expect(options.length).toBe(9);
        expect(options[0]).toHaveValue('Lawful Good');
        expect(options[8]).toHaveValue('Chaotic Evil');
      });
    });
  });

  describe('Render — image preview', () => {
    it('should show "Click to upload" when no image is set', () => {
      render(<WizardStepBasic {...createMockProps()} />);

      expect(screen.getByText('Click to upload')).toBeInTheDocument();
    });

    it('should render image preview from base64 image data', () => {
      render(
        <WizardStepBasic
          {...createMockProps({
            formData: { image: 'data:image/png;base64,test' },
          })}
        />
      );

      const img = document.querySelector('.image-preview img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'data:image/png;base64,test');
    });

    it('should render image preview from image path', () => {
      render(
        <WizardStepBasic
          {...createMockProps({
            formData: { imagePath: '/path/to/portrait.jpg' },
          })}
        />
      );

      const img = document.querySelector('.image-preview img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', '/path/to/portrait.jpg');
    });

    it('should not show remove button when no image is set', () => {
      render(<WizardStepBasic {...createMockProps()} />);

      expect(screen.queryByText('Remove Image')).not.toBeInTheDocument();
    });

    it('should show remove button when an image is set', () => {
      render(
        <WizardStepBasic
          {...createMockProps({
            formData: { image: 'data:image/png;base64,test' },
          })}
        />
      );

      expect(screen.getByText('Remove Image')).toBeInTheDocument();
    });
  });

  describe('Render — 2024 background options', () => {
    it('should render background select with default option and populated choices', () => {
      render(
        <WizardStepBasic
          {...createMockProps()}
          ruleset="2024"
          backgrounds={mockBackgrounds2024}
        />
      );

      const bgSelect = document.querySelectorAll('select')[1];
      const options = bgSelect.querySelectorAll('option');
      expect(options[0]).toHaveValue('');
      expect(options[0]).toHaveTextContent('Select a background');
      expect(options[1]).toHaveValue('Acrobat');
      expect(options[2]).toHaveValue('Soldier');
    });
  });

  describe('Input changes', () => {
    it('should call onInputChange with name when the name input changes', () => {
      const mockOnChange = vi.fn();
      render(<WizardStepBasic {...createMockProps({ onInputChange: mockOnChange })} />);

      const nameInput = screen.getByDisplayValue('Test Character');
      fireEvent.change(nameInput, { target: { value: 'New Name' } });

      expect(mockOnChange).toHaveBeenCalledWith('name', 'New Name');
    });

    it('should call onInputChange with parsed integer level when the level input changes', () => {
      const mockOnChange = vi.fn();
      render(<WizardStepBasic {...createMockProps({ onInputChange: mockOnChange })} />);

      const levelInput = document.querySelector('input[type="number"]');
      fireEvent.change(levelInput, { target: { value: '10' } });

      expect(mockOnChange).toHaveBeenCalledWith('level', 10);
    });

    it('should call onInputChange with alignment when the alignment select changes', async () => {
      const mockOnChange = vi.fn();
      render(<WizardStepBasic {...createMockProps({ onInputChange: mockOnChange })} />);

      await waitFor(() => {
        const alignmentSelect = document.querySelector('select');
        expect(alignmentSelect).toBeInTheDocument();
      });

      const alignmentSelect = document.querySelector('select');
      fireEvent.change(alignmentSelect, { target: { value: 'Chaotic Neutral' } });

      expect(mockOnChange).toHaveBeenCalledWith('alignment', 'Chaotic Neutral');
    });

    it('should call onInputChange with background when the background select changes', () => {
      const mockOnChange = vi.fn();
      render(
        <WizardStepBasic
          {...createMockProps({ onInputChange: mockOnChange })}
          ruleset="2024"
          backgrounds={mockBackgrounds2024}
        />
      );

      const backgroundSelect = document.querySelectorAll('select')[1];
      fireEvent.change(backgroundSelect, { target: { value: 'Acrobat' } });

      expect(mockOnChange).toHaveBeenCalledWith('background', 'Acrobat');
    });
  });

  describe('Validation errors', () => {
    it('should render error message and error class for the name field', () => {
      render(
        <WizardStepBasic
          {...createMockProps({
            errors: { name: 'Name is required' },
          })}
        />
      );

      expect(screen.getByText('Name is required')).toBeInTheDocument();
      const nameInput = screen.getByDisplayValue('Test Character');
      expect(nameInput).toHaveClass('error');
    });

    it('should render error message and error class for the level field', () => {
      render(
        <WizardStepBasic
          {...createMockProps({
            errors: { level: 'Level is required' },
          })}
        />
      );

      expect(screen.getByText('Level is required')).toBeInTheDocument();
      const levelInput = document.querySelector('input[type="number"]');
      expect(levelInput).toHaveClass('error');
    });

    it('should render error message and error class for the alignment field', () => {
      render(
        <WizardStepBasic
          {...createMockProps({
            errors: { alignment: 'Alignment is required' },
          })}
        />
      );

      expect(screen.getByText('Alignment is required')).toBeInTheDocument();
      const alignmentSelect = document.querySelector('select');
      expect(alignmentSelect).toHaveClass('error');
    });

    it('should render error message and error class for the background field in 2024', () => {
      render(
        <WizardStepBasic
          {...createMockProps({
            ruleset: '2024',
            backgrounds: mockBackgrounds2024,
            errors: { background: 'Background is required for 2024 rules' },
          })}
        />
      );

      expect(screen.getByText('Background is required for 2024 rules')).toBeInTheDocument();
      const bgSelect = document.querySelectorAll('select')[1];
      expect(bgSelect).toHaveClass('error');
    });
  });

  describe('Image removal', () => {
    it('should clear both image and imagePath when Remove Image is clicked', () => {
      const mockOnChange = vi.fn();
      render(
        <WizardStepBasic
          {...createMockProps({
            onInputChange: mockOnChange,
            formData: {
              image: 'data:image/png;base64,test',
              imagePath: '/path/to/img.jpg',
            },
          })}
        />
      );

      const removeBtn = screen.getByText('Remove Image');
      fireEvent.click(removeBtn);

      expect(mockOnChange).toHaveBeenCalledWith('image', '');
      expect(mockOnChange).toHaveBeenCalledWith('imagePath', '');
    });
  });

  describe('Image upload', () => {
    it('should read the selected file via FileReader and call onInputChange', () => {
      const mockOnChange = vi.fn();
      const originalFileReader = global.FileReader;
      let capturedOnload = null;

      global.FileReader = class {
        constructor() {
          this._onload = null;
        }
        get onload() {
          return this._onload;
        }
        set onload(fn) {
          this._onload = fn;
          capturedOnload = fn;
        }
        readAsDataURL() {
          /* no-op; we trigger onload manually */
        }
      };

      try {
        render(<WizardStepBasic {...createMockProps({ onInputChange: mockOnChange })} />);

        const fileInput = document.getElementById('character-image-upload');
        const file = new File(['test'], 'test-image.png', { type: 'image/png' });

        fireEvent.change(fileInput, { target: { files: [file] } });

        capturedOnload({ target: { result: 'data:image/png;base64,mockdata' } });

        expect(mockOnChange).toHaveBeenCalledWith('image', 'data:image/png;base64,mockdata');
        expect(mockOnChange).toHaveBeenCalledWith('imageName', 'test-image.png');
      } finally {
        global.FileReader = originalFileReader;
      }
    });

    it('should do nothing when no file is selected', () => {
      const mockOnChange = vi.fn();
      const originalFileReader = global.FileReader;

      global.FileReader = class {
        readAsDataURL() {
          /* no-op */
        }
      };

      try {
        render(<WizardStepBasic {...createMockProps({ onInputChange: mockOnChange })} />);

        const fileInput = document.getElementById('character-image-upload');
        fireEvent.change(fileInput, { target: { files: [] } });

        expect(mockOnChange).not.toHaveBeenCalled();
      } finally {
        global.FileReader = originalFileReader;
      }
    });
  });

  describe('Empty formData', () => {
    it('should render without errors when formData has empty string values', () => {
      render(
        <WizardStepBasic
          {...createMockProps({
            formData: { name: '', level: '', alignment: '', background: '' },
          })}
        />
      );

      expect(screen.getByText('Step 2: Basic Information')).toBeInTheDocument();
      const nameInput = document.querySelector('input[type="text"]');
      expect(nameInput).toHaveValue('');
    });
  });

  describe('Alignment fetch error handling', () => {
    it('should log an error and keep rendering when alignment fetch fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      setupFetchFailure();
      render(<WizardStepBasic {...createMockProps()} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error loading alignments:',
          expect.any(Error),
        );
      });

      expect(screen.getByText('Step 2: Basic Information')).toBeInTheDocument();
      consoleSpy.mockRestore();
    });

    it('should render an empty alignment select when fetch returns an empty array', async () => {
      setupFetchMock([]);
      render(<WizardStepBasic {...createMockProps()} />);

      await waitFor(() => {
        const alignmentSelect = document.querySelector('select');
        const options = alignmentSelect.querySelectorAll('option');
        expect(options.length).toBe(0);
      });
    });
  });
});
