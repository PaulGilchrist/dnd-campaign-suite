// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CascadingSelect from './CascadingSelect.jsx';

describe('CascadingSelect', () => {
  const makeOptions = () => [
    { name: 'Human', subraces: [{ index: 'hill', name: 'Hill' }, { index: 'high', name: 'High' }] },
    { name: 'Elf', subraces: [{ index: 'wood', name: 'Wood' }] },
  ];

  const makeSubOptionsSelector = (options) => (selectedParentValue) => {
    const found = options.find((r) => r.name === selectedParentValue);
    return found ? found.subraces : [];
  };

  const baseProps = {
    label: 'Race',
    options: makeOptions(),
    subOptionsSelector: makeSubOptionsSelector(makeOptions()),
    fieldName: 'race',
    childFieldName: 'subrace',
    errorKey: 'subrace',
    loadingText: 'Loading races...',
    ruleset: '5e',
    formData: { race: { name: 'Human', subrace: { name: 'Hill', description: '' } } },
    onInputChange: vi.fn(),
    errors: {},
    childExtraFields: { description: '' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the parent label with asterisk', () => {
      const { container } = render(<CascadingSelect {...baseProps} />);
      const labels = container.querySelectorAll('label');
      expect(labels[0].textContent).toContain('Race');
      expect(labels[0].textContent).toContain('*');
    });

    it('should render parent dropdown with all options', () => {
      const { container } = render(<CascadingSelect {...baseProps} />);
      const selects = container.querySelectorAll('select');
      expect(selects[0]).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Human' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Elf' })).toBeInTheDocument();
    });

    it('should render a placeholder option in the parent select', () => {
      const { container } = render(<CascadingSelect {...baseProps} formData={{ race: {} }} />);
      const selects = container.querySelectorAll('select');
      const placeholder = selects[0].querySelector('option[value=""]');
      expect(placeholder).toHaveTextContent('Select a race');
    });

    it('should render child dropdown when subOptions exist', () => {
      const { container } = render(<CascadingSelect {...baseProps} />);
      const selects = container.querySelectorAll('select');
      expect(selects[1]).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Hill' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'High' })).toBeInTheDocument();
    });

    it('should NOT render child dropdown when subOptions are empty', () => {
      const props = {
        ...baseProps,
        formData: { race: { name: 'Elf' } },
        options: [{ name: 'Elf', subraces: [] }],
        subOptionsSelector: makeSubOptionsSelector([{ name: 'Elf', subraces: [] }]),
      };
      const { container } = render(<CascadingSelect {...props} />);
      const selects = container.querySelectorAll('select');
      expect(selects.length).toBe(1);
    });

    it('should render loading text in the parent select when options are empty', () => {
      const { container } = render(<CascadingSelect {...baseProps} options={[]} />);
      const selects = container.querySelectorAll('select');
      const options = selects[0].querySelectorAll('option');
      const loadingOption = options[1];
      expect(loadingOption).toHaveTextContent('Loading races...');
    });

    it('should show the currently selected parent value', () => {
      const { container } = render(<CascadingSelect {...baseProps} />);
      const selects = container.querySelectorAll('select');
      expect(selects[0].value).toBe('Human');
    });

    it('should show the currently selected child value', () => {
      const { container } = render(<CascadingSelect {...baseProps} />);
      const selects = container.querySelectorAll('select');
      expect(selects[1].value).toBe('Hill');
    });

    it('should show empty child select when child value is undefined', () => {
      const { container } = render(<CascadingSelect {...baseProps} formData={{ race: { name: 'Human' } }} />);
      const selects = container.querySelectorAll('select');
      expect(selects[1].value).toBe('');
    });

    it('should show empty parent select when formData[fieldName] is undefined', () => {
      const { container } = render(<CascadingSelect {...baseProps} formData={{}} />);
      const selects = container.querySelectorAll('select');
      expect(selects[0].value).toBe('');
    });

    it('should use (Major) suffix for 2024 ruleset on child label when childLabelProp is not set', () => {
      const { container } = render(<CascadingSelect {...baseProps} ruleset="2024" />);
      const labels = container.querySelectorAll('label');
      expect(labels[1].textContent).toContain('Race (Major)');
    });

    it('should NOT use (Major) suffix for non-2024 ruleset', () => {
      render(<CascadingSelect {...baseProps} ruleset="5e" />);
      const labels = screen.queryAllByText(/^Race \*$/);
      expect(labels.length).toBeGreaterThan(0);
      expect(screen.queryByText('Race (Major) *')).not.toBeInTheDocument();
    });

    it('should apply custom childLabelProp to child dropdown label', () => {
      render(<CascadingSelect {...baseProps} childLabel="Subrace Type" />);
      expect(screen.getByText('Subrace Type *')).toBeInTheDocument();
    });

    it('should apply (Major) suffix to custom childLabelProp for 2024 ruleset', () => {
      render(<CascadingSelect {...baseProps} childLabel="Subrace Type" ruleset="2024" />);
      expect(screen.getByText('Subrace Type (Major) *')).toBeInTheDocument();
    });

    it('should use custom optionsKey for parent option values and display text', () => {
      const options = [
        { id: 'human', displayName: 'Humanoid' },
        { id: 'elf', displayName: 'Elven' },
      ];
      const props = {
        ...baseProps,
        options,
        optionsKey: 'displayName',
      };
      render(<CascadingSelect {...props} />);
      expect(screen.getByRole('option', { name: 'Humanoid' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Elven' })).toBeInTheDocument();
    });

    it('should use custom childOptionsKey for child option values and display text', () => {
      const options = [
        { name: 'Human', subraces: [{ key: 'hill', label: 'Hill Dwarf' }] },
      ];
      const props = {
        ...baseProps,
        options,
        subOptionsSelector: () => [{ key: 'hill', label: 'Hill Dwarf' }],
        childOptionsKey: 'label',
      };
      render(<CascadingSelect {...props} />);
      expect(screen.getByRole('option', { name: 'Hill Dwarf' })).toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    it('should call onInputChange when parent changes', () => {
      const { container } = render(<CascadingSelect {...baseProps} />);
      const selects = container.querySelectorAll('select');
      fireEvent.change(selects[0], { target: { value: 'Elf' } });
      expect(baseProps.onInputChange).toHaveBeenCalledWith('race', { name: 'Elf' });
    });

    it('should call onInputChange when selecting empty parent option', () => {
      const { container } = render(<CascadingSelect {...baseProps} />);
      const selects = container.querySelectorAll('select');
      fireEvent.change(selects[0], { target: { value: '' } });
      expect(baseProps.onInputChange).toHaveBeenCalledWith('race', { name: '' });
    });

    it('should call onInputChange with childExtraFields when child changes', () => {
      const { container } = render(<CascadingSelect {...baseProps} />);
      const selects = container.querySelectorAll('select');
      fireEvent.change(selects[1], { target: { value: 'High' } });
      expect(baseProps.onInputChange).toHaveBeenCalledWith(
        'race',
        expect.objectContaining({
          subrace: expect.objectContaining({ name: 'High', description: '' }),
        })
      );
    });

    it('should merge childExtraFields into child selection', () => {
      const options = [
        { name: 'Elf', subraces: [{ index: 'wood', name: 'Wood' }] },
      ];
      const props = {
        ...baseProps,
        options,
        subOptionsSelector: makeSubOptionsSelector(options),
        formData: { race: { name: 'Elf' } },
        childExtraFields: { description: '', feat: '' },
      };
      const { container } = render(<CascadingSelect {...props} />);
      const selects = container.querySelectorAll('select');
      fireEvent.change(selects[1], { target: { value: 'Wood' } });
      expect(baseProps.onInputChange).toHaveBeenCalledWith(
        'race',
        expect.objectContaining({
          subrace: expect.objectContaining({ name: 'Wood', description: '', feat: '' }),
        })
      );
    });

    it('should handle child change when formData[fieldName] is undefined', () => {
      const props = {
        ...baseProps,
        formData: {},
      };
      const { container } = render(<CascadingSelect {...props} />);
      const selects = container.querySelectorAll('select');
      fireEvent.change(selects[0], { target: { value: 'Human' } });
      expect(baseProps.onInputChange).toHaveBeenCalledWith(
        'race',
        { name: 'Human' }
      );
    });
  });

  describe('error display', () => {
    it('should display parent error message', () => {
      render(<CascadingSelect {...baseProps} errors={{ race: 'Race is required' }} />);
      expect(screen.getByText('Race is required')).toBeInTheDocument();
    });

    it('should display child error message', () => {
      render(<CascadingSelect {...baseProps} errors={{ subrace: 'Subrace is required' }} />);
      expect(screen.getByText('Subrace is required')).toBeInTheDocument();
    });

    it('should not display error messages when errors object is empty', () => {
      render(<CascadingSelect {...baseProps} errors={{}} />);
      expect(screen.queryByText('Race is required')).not.toBeInTheDocument();
      expect(screen.queryByText('Subrace is required')).not.toBeInTheDocument();
    });

    it('should apply error class to parent select when parent has error', () => {
      const { container } = render(<CascadingSelect {...baseProps} errors={{ race: 'Race is required' }} />);
      const selects = container.querySelectorAll('select');
      expect(selects[0]).toHaveClass('error');
    });

    it('should apply error class to child select when child has error', () => {
      const { container } = render(<CascadingSelect {...baseProps} errors={{ subrace: 'Subrace is required' }} />);
      const selects = container.querySelectorAll('select');
      expect(selects[1]).toHaveClass('error');
    });
  });
});
