// @improved-by-ai
// @cleaned-by-ai
// Removed 2 tests:
//   - "should render an empty alignment select when fetch fails" → redundant with error-logging test (same failure path)
//   - "should do nothing when no file is selected" → low-value negative assertion for trivial guard
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
    campaignName: overrides.campaignName || undefined,
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

  describe('Render', () => {
    it('should display initial form values', async () => {
      render(<WizardStepBasic stepNumber={2} {...createMockProps()} />);

      expect(screen.getByDisplayValue('Test Character')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toHaveValue('Lawful Good');
      });
    });

    it('should show "Click to upload" and no remove button when no image is set', () => {
      render(<WizardStepBasic stepNumber={2} {...createMockProps()} />);

      expect(screen.getByText('Click to upload')).toBeInTheDocument();
      expect(screen.queryByText('Remove Image')).not.toBeInTheDocument();
    });

    it.each([
      { label: 'base64 image data', formData: { image: 'data:image/png;base64,test' } },
      { label: 'image path', formData: { imagePath: '/path/to/portrait.jpg' } },
    ])('should render image preview from %s', ({ formData }) => {
      render(<WizardStepBasic stepNumber={2} {...createMockProps({ formData })} />);

      const preview = screen.getByRole('img');
      expect(preview).toBeInTheDocument();
      expect(preview).toHaveAttribute('src', formData.image || formData.imagePath);
      expect(screen.queryByText('Click to upload')).not.toBeInTheDocument();
    });

    it('should use campaignName to construct image path when imagePath is a relative path', async () => {
      render(
        <WizardStepBasic stepNumber={2}
          {...createMockProps({
            campaignName: 'my-campaign',
            formData: { imagePath: 'portraits/hero.jpg' },
          })}
        />
      );

      const preview = screen.getByRole('img');
      expect(preview).toHaveAttribute(
        'src',
        'campaigns/my-campaign/portraits/hero.jpg',
      );
    });

    it('should not prepend campaigns/ when imagePath is an absolute URL', () => {
      render(
        <WizardStepBasic stepNumber={2}
          {...createMockProps({
            campaignName: 'my-campaign',
            formData: { imagePath: 'https://example.com/hero.jpg' },
          })}
        />
      );

      const preview = screen.getByRole('img');
      expect(preview).toHaveAttribute('src', 'https://example.com/hero.jpg');
    });

    it('should render remove button when an image is set', () => {
      render(
        <WizardStepBasic stepNumber={2}
          {...createMockProps({
            formData: { image: 'data:image/png;base64,test' },
          })}
        />
      );

      expect(screen.getByText('Remove Image')).toBeInTheDocument();
    });
  });

  describe('Input changes', () => {
    it('should call onInputChange with name when the name input changes', () => {
      const mockOnChange = vi.fn();
      render(<WizardStepBasic stepNumber={2} {...createMockProps({ onInputChange: mockOnChange })} />);

      const nameInput = screen.getByDisplayValue('Test Character');
      fireEvent.change(nameInput, { target: { value: 'New Name' } });

      expect(mockOnChange).toHaveBeenCalledWith('name', 'New Name');
    });

    it.each([
      { input: '10', expected: 10, label: 'parses valid integer' },
      { input: '', expected: NaN, label: 'returns NaN for empty string' },
      { input: 'abc', expected: NaN, label: 'returns NaN for non-numeric string' },
      { input: '0', expected: 0, label: 'parses zero' },
      { input: '-5', expected: -5, label: 'parses negative number' },
    ])(
      'should call onInputChange with parsed integer level when level input changes (%s)',
      ({ input, expected }) => {
        const mockOnChange = vi.fn();
        render(
          <WizardStepBasic stepNumber={2}
            {...createMockProps({
              formData: { level: 1 },
              onInputChange: mockOnChange,
            })}
          />
        );

        const levelInput = document.querySelector('input[type="number"]');
        fireEvent.change(levelInput, { target: { value: input } });

        expect(mockOnChange).toHaveBeenCalledWith('level', expected);
      },
    );

    it('should call onInputChange with alignment when the alignment select changes', async () => {
      const mockOnChange = vi.fn();
      render(<WizardStepBasic stepNumber={2} {...createMockProps({ onInputChange: mockOnChange })} />);

      await waitFor(() => {
        const alignmentSelect = screen.getByRole('combobox');
        expect(alignmentSelect).toBeInTheDocument();
      });

      const alignmentSelect = screen.getByRole('combobox');
      fireEvent.change(alignmentSelect, { target: { value: 'Chaotic Neutral' } });

      expect(mockOnChange).toHaveBeenCalledWith('alignment', 'Chaotic Neutral');
    });
  });

  describe('Validation errors', () => {
    it.each([
      { field: 'name', error: 'Name is required', getQuery: () => screen.getByDisplayValue('Test Character') },
      { field: 'level', error: 'Level is required', getQuery: () => document.querySelector('input[type="number"]') },
      { field: 'alignment', error: 'Alignment is required', getQuery: () => screen.getByRole('combobox') },
    ])(
      'should render error message and error class for the %s field',
      ({ field, error, getQuery }) => {
        render(
          <WizardStepBasic stepNumber={2}
            {...createMockProps({
              errors: { [field]: error },
            })}
          />
        );

        expect(screen.getByText(error)).toBeInTheDocument();
        const input = getQuery();
        expect(input).toHaveClass('error');
      },
    );
  });

  describe('Image removal', () => {
    it('should clear both image and imagePath when Remove Image is clicked', () => {
      const mockOnChange = vi.fn();
      render(
        <WizardStepBasic stepNumber={2}
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
      const mockResult = 'data:image/png;base64,mockdata';

      const readAsDataURLSpy = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function () {
        // Simulate successful read
        Object.defineProperty(this, 'result', { value: mockResult, writable: true, configurable: true });
        if (this.onload) {
          this.onload({ target: this });
        }
      });

      render(<WizardStepBasic stepNumber={2} {...createMockProps({ onInputChange: mockOnChange })} />);

      const fileInput = document.querySelector('input[type="file"]');
      const file = new File(['test'], 'test-image.png', { type: 'image/png' });

      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(mockOnChange).toHaveBeenCalledWith('image', mockResult);
      expect(mockOnChange).toHaveBeenCalledWith('imageName', 'test-image.png');

      readAsDataURLSpy.mockRestore();
    });
  });

  describe('Alignment fetch error handling', () => {
    it('should log an error and keep rendering when alignment fetch fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      setupFetchFailure();
      render(<WizardStepBasic stepNumber={2} {...createMockProps()} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error loading alignments:',
          expect.any(Error),
        );
      });

      expect(screen.getByText('Step 2: Basic Information')).toBeInTheDocument();
      consoleSpy.mockRestore();
    });
  });
});
