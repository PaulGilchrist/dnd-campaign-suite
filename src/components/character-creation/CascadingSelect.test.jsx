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
    it('should render parent dropdown with all options', () => {
      render(<CascadingSelect {...baseProps} />);
      expect(screen.getByRole('option', { name: 'Human' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Elf' })).toBeInTheDocument();
    });

    it('should render a placeholder option in the parent select', () => {
      const { container } = render(<CascadingSelect {...baseProps} formData={{ race: {} }} />);
      const selects = container.querySelectorAll('select');
      const [parentSelect] = selects;
      expect(parentSelect.querySelector('option[value=""]')).toHaveTextContent('Select a race');
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

    it('should show selected parent and child values', () => {
      const { container } = render(<CascadingSelect {...baseProps} />);
      const selects = container.querySelectorAll('select');
      expect(selects[0].value).toBe('Human');
      expect(selects[1].value).toBe('Hill');
    });

    it('should show empty selects when values are undefined', () => {
      const { container } = render(<CascadingSelect {...baseProps} formData={{ race: { name: 'Human' } }} />);
      const selects = container.querySelectorAll('select');
      expect(selects[1].value).toBe('');
    });

    it('should show empty parent select when formData[fieldName] is undefined', () => {
      const { container } = render(<CascadingSelect {...baseProps} formData={{}} />);
      const selects = container.querySelectorAll('select');
      expect(selects[0].value).toBe('');
    });

    it('should use (Major) suffix for 2024 ruleset on child label', () => {
      const { container } = render(<CascadingSelect {...baseProps} ruleset="2024" />);
      const labels = container.querySelectorAll('label');
      expect(labels[1].textContent).toContain('Race (Major)');
    });

    it('should apply custom childLabelProp with (Major) suffix for 2024 ruleset', () => {
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

    it('should call onInputChange with empty string when selecting empty parent option', () => {
      const { container } = render(<CascadingSelect {...baseProps} />);
      const selects = container.querySelectorAll('select');
      fireEvent.change(selects[0], { target: { value: '' } });
      expect(baseProps.onInputChange).toHaveBeenCalledWith('race', { name: '' });
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
    it('should display error messages for parent and child', () => {
      render(<CascadingSelect {...baseProps} errors={{ race: 'Race is required', subrace: 'Subrace is required' }} />);
      expect(screen.getByText('Race is required')).toBeInTheDocument();
      expect(screen.getByText('Subrace is required')).toBeInTheDocument();
    });

    it('should apply error class to parent and child selects when they have errors', () => {
      const { container } = render(<CascadingSelect {...baseProps} errors={{ race: 'Race is required', subrace: 'Subrace is required' }} />);
      const selects = container.querySelectorAll('select');
      expect(selects[0]).toHaveClass('error');
      expect(selects[1]).toHaveClass('error');
    });
  });
});
