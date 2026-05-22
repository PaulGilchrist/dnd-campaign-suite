import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepBasic from './WizardStepBasic.jsx';

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

  it('should show click to upload when no image is set', () => {
    render(<WizardStepBasic {...mockProps} />);

    expect(screen.getByText('Click to upload')).toBeInTheDocument();
  });

  it('should render image preview from image data', () => {
    render(
      <WizardStepBasic
        {...mockProps}
        formData={{ ...mockProps.formData, image: 'data:image/png;base64,test' }}
      />
    );

    const img = document.querySelector('.image-preview img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'data:image/png;base64,test');
  });

  it('should render image preview from image path', () => {
    render(
      <WizardStepBasic
        {...mockProps}
        formData={{ ...mockProps.formData, imagePath: '/path/to/portrait.jpg' }}
      />
    );

    const img = document.querySelector('.image-preview img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/path/to/portrait.jpg');
  });

  it('should remove image when Remove Image button is clicked', () => {
    const mockOnChange = vi.fn();
    render(
      <WizardStepBasic
        {...mockProps}
        formData={{ ...mockProps.formData, image: 'data:image/png;base64,test', imagePath: '/path/to/img.jpg' }}
        onInputChange={mockOnChange}
      />
    );

    const removeBtn = screen.getByText('Remove Image');
    fireEvent.click(removeBtn);

    expect(mockOnChange).toHaveBeenCalledWith('image', '');
    expect(mockOnChange).toHaveBeenCalledWith('imagePath', '');
  });

  it('should handle image upload via FileReader', () => {
    const mockOnChange = vi.fn();
    const mockReadAsDataURL = vi.fn();
    let capturedOnload = null;
    const originalFileReader = global.FileReader;

    global.FileReader = class {
      constructor() {
        this._onload = null;
      }
      get onload() { return this._onload; }
      set onload(fn) { this._onload = fn; capturedOnload = fn; }
      readAsDataURL(file) { mockReadAsDataURL(file); }
    };

    try {
      render(<WizardStepBasic {...mockProps} onInputChange={mockOnChange} />);

      const fileInput = document.getElementById('character-image-upload');
      const file = new File(['test'], 'test-image.png', { type: 'image/png' });

      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(mockReadAsDataURL).toHaveBeenCalledWith(file);

      // Simulate FileReader completing
      capturedOnload({ target: { result: 'data:image/png;base64,mockdata' } });

      expect(mockOnChange).toHaveBeenCalledWith('image', 'data:image/png;base64,mockdata');
      expect(mockOnChange).toHaveBeenCalledWith('imageName', 'test-image.png');
    } finally {
      global.FileReader = originalFileReader;
    }
  });

  it('should do nothing when no file is selected for image upload', () => {
    const mockOnChange = vi.fn();
    const mockReadAsDataURL = vi.fn();
    const originalFileReader = global.FileReader;

    global.FileReader = class {
      constructor() {
        this._onload = null;
      }
      readAsDataURL(file) { mockReadAsDataURL(file); }
    };

    try {
      render(<WizardStepBasic {...mockProps} onInputChange={mockOnChange} />);

      const fileInput = document.getElementById('character-image-upload');
      fireEvent.change(fileInput, { target: { files: [] } });

      expect(mockReadAsDataURL).not.toHaveBeenCalled();
      expect(mockOnChange).not.toHaveBeenCalled();
    } finally {
      global.FileReader = originalFileReader;
    }
  });

  it('should render alignment options from fetched data', async () => {
    render(<WizardStepBasic {...mockProps} />);

    await waitFor(() => {
      const options = document.querySelectorAll('select option');
      expect(options.length).toBe(9);
      expect(options[0]).toHaveValue('Lawful Good');
      expect(options[8]).toHaveValue('Chaotic Evil');
    });
  });

  it('should call onInputChange when alignment is changed', async () => {
    const mockOnChange = vi.fn();
    render(<WizardStepBasic {...mockProps} onInputChange={mockOnChange} />);

    await waitFor(() => {
      const options = document.querySelectorAll('select option');
      expect(options.length).toBe(9);
    });

    const alignmentSelect = document.querySelector('select');
    fireEvent.change(alignmentSelect, { target: { value: 'Chaotic Neutral' } });

    expect(mockOnChange).toHaveBeenCalledWith('alignment', 'Chaotic Neutral');
  });

  it('should handle alignment fetch error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Replace fetch to simulate error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<WizardStepBasic {...mockProps} />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error loading alignments:', expect.any(Error));
    });

    expect(screen.getByText('Step 2: Basic Information')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('should render 2024 background options from backgrounds prop', () => {
    const backgrounds = [
      { index: 'acrobat', name: 'Acrobat' },
      { index: 'soldier', name: 'Soldier' },
    ];

    render(
      <WizardStepBasic
        {...mockProps}
        ruleset="2024"
        backgrounds={backgrounds}
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
