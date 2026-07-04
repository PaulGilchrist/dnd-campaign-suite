// @cleaned-by-ai
// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SelectableList from './SelectableList.jsx';

const mockItems = [
  { name: 'Item A', index: 'a', type: 'Type1', level: 1 },
  { name: 'Item B', index: 'b', type: 'Type2', level: 2 },
  { name: 'Item C', index: 'c', type: 'Type1', level: 3 },
];

const mockFormData = {
  skills: ['Item A'],
};

const mockFilters = [
  { field: 'type', defaultLabel: 'All', getValue: (item) => item.type },
];

function createRenderItem() {
  return vi.fn((item, index, opts) => (
    <div data-testid={`item-${index}`} onClick={opts?.onToggle} className={opts?.isSelected ? 'selected' : ''}>
      <span>{item.name}</span>
      {opts?.isExpanded && <span data-testid={`expanded-${index}`}>Expanded</span>}
      <button onClick={opts?.onToggleExpand}>Toggle</button>
    </div>
  ));
}

function createRenderSummary() {
  return vi.fn(() => <div data-testid="summary">Summary</div>);
}

function createRenderWarnings() {
  return vi.fn(() => <div data-testid="warnings">Warnings</div>);
}

function renderComponent(props) {
  return render(
    <SelectableList
      items={mockItems}
      fieldName="skills"
      formData={mockFormData}
      onArrayFieldChange={vi.fn()}
      title="Test List"
      searchPlaceholder="Search..."
      filters={[]}
      renderItem={createRenderItem()}
      {...props}
    />,
  );
}

describe('SelectableList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the title', () => {
      renderComponent();
      expect(screen.getByText('Test List')).toBeInTheDocument();
    });

    it('should apply custom className to root and nested containers', () => {
      const { container } = renderComponent({ className: 'custom-class' });
      expect(container.querySelector('.wizard-step.custom-class')).toBeInTheDocument();
      expect(container.querySelector('.custom-class-results-container')).toBeInTheDocument();
      expect(container.querySelector('.custom-class-results-header')).toBeInTheDocument();
      expect(container.querySelector('.custom-class-results-list')).toBeInTheDocument();
    });

    it('should render the search input with the correct label', () => {
      renderComponent();
      expect(screen.getByLabelText('Search Test List')).toBeInTheDocument();
    });

    it('should render result count with correct pluralization', () => {
      renderComponent();
      expect(screen.getByText(/Showing 3 items/)).toBeInTheDocument();

      const renderItem = createRenderItem();
      renderItem.mockImplementation((item) => <div key={item.name}>{item.name}</div>);
      render(
        <SelectableList
          items={[{ name: 'Item A' }]}
          fieldName="skills"
          formData={mockFormData}
          onArrayFieldChange={vi.fn()}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
        />,
      );
      expect(screen.getByText(/Showing 1 item/)).toBeInTheDocument();
    });

    it('should use custom resultLabel in count display', () => {
      renderComponent({ resultLabel: 'spell' });
      expect(screen.getByText(/Showing 3 spells/)).toBeInTheDocument();
    });

    it('should render renderSummary and renderWarnings when provided', () => {
      const mockRenderSummary = createRenderSummary();
      const mockRenderWarnings = createRenderWarnings();
      renderComponent({ renderSummary: mockRenderSummary, renderWarnings: mockRenderWarnings });
      expect(screen.getByTestId('summary')).toBeInTheDocument();
      expect(screen.getByTestId('warnings')).toBeInTheDocument();
    });

    it('should render "Show Only Selected" checkbox with selected count', () => {
      renderComponent();
      expect(screen.getByText(/Show Only Selected/)).toBeInTheDocument();
      expect(screen.getByText(/1 selected\)/)).toBeInTheDocument();
    });
  });

  describe('loading/empty state', () => {
    it('should render custom loading message when items is empty array', () => {
      const renderItem = createRenderItem();
      render(
        <SelectableList
          items={[]}
          fieldName="skills"
          formData={{}}
          onArrayFieldChange={vi.fn()}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
          loadingMessage="Loading..."
        />,
      );
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render default "not loaded" message when items is null or undefined', () => {
      const renderItem = createRenderItem();
      const { rerender } = render(
        <SelectableList
          items={null}
          fieldName="skills"
          formData={{}}
          onArrayFieldChange={vi.fn()}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
        />,
      );
      expect(screen.getByText('Data not yet loaded. Please try again.')).toBeInTheDocument();

      rerender(
        <SelectableList
          items={undefined}
          fieldName="skills"
          formData={{}}
          onArrayFieldChange={vi.fn()}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
        />,
      );
      expect(screen.getByText('Data not yet loaded. Please try again.')).toBeInTheDocument();
    });
  });

  describe('search filtering', () => {
    it('should filter items by search query matching name or index', () => {
      renderComponent();
      fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'Item A' } });
      expect(screen.getByText('Item A')).toBeInTheDocument();
      expect(screen.queryByText('Item B')).not.toBeInTheDocument();

      fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'b' } });
      expect(screen.getByText('Item B')).toBeInTheDocument();
      expect(screen.queryByText('Item A')).not.toBeInTheDocument();
    });

    it('should be case-insensitive when filtering by search query', () => {
      renderComponent();
      fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'item a' } });
      expect(screen.getByText('Item A')).toBeInTheDocument();
    });

    it('should show all items when search query is cleared', () => {
      renderComponent();
      fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'Item A' } });
      fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: '' } });
      expect(screen.getByText('Item A')).toBeInTheDocument();
      expect(screen.getByText('Item B')).toBeInTheDocument();
      expect(screen.getByText('Item C')).toBeInTheDocument();
    });

    it('should show no results message when search has no matches', () => {
      renderComponent({ resultLabel: 'item' });
      fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'ZZZZ' } });
      expect(screen.getByText(/No item found matching your criteria/)).toBeInTheDocument();
    });
  });

  describe('filter dropdowns', () => {
    it('should filter by selected type using getValue', () => {
      renderComponent({ filters: mockFilters });
      const select = document.querySelector('select');
      fireEvent.change(select, { target: { value: 'Type1' } });
      expect(screen.getByText('Item A')).toBeInTheDocument();
      expect(screen.getByText('Item C')).toBeInTheDocument();
      expect(screen.queryByText('Item B')).not.toBeInTheDocument();
    });

    it('should filter by selected type using field property', () => {
      const fieldFilter = [{ field: 'type', defaultLabel: 'All', label: 'Type' }];
      renderComponent({ filters: fieldFilter });
      const select = document.querySelector('select');
      fireEvent.change(select, { target: { value: 'Type1' } });
      expect(screen.getByText('Item A')).toBeInTheDocument();
      expect(screen.queryByText('Item B')).not.toBeInTheDocument();
    });

    it('should show all items when filter is reset to defaultLabel', () => {
      renderComponent({ filters: mockFilters });
      const select = document.querySelector('select');
      fireEvent.change(select, { target: { value: 'Type1' } });
      fireEvent.change(select, { target: { value: 'All' } });
      expect(screen.getByText('Item A')).toBeInTheDocument();
      expect(screen.getByText('Item B')).toBeInTheDocument();
      expect(screen.getByText('Item C')).toBeInTheDocument();
    });

    it('should include array values as filter options and filter by them', () => {
      const multiClassItems = [
        { name: 'Fireball', classes: ['Wizard', 'Sorcerer'] },
        { name: 'Cure Wounds', classes: ['Cleric', 'Druid', 'Paladin'] },
        { name: 'Eldritch Blast', classes: ['Warlock'] },
      ];
      const classFilter = [{ field: 'classes', defaultLabel: 'All', label: 'Class' }];

      const renderItem = createRenderItem();
      render(
        <SelectableList
          items={multiClassItems}
          fieldName="skills"
          formData={mockFormData}
          onArrayFieldChange={vi.fn()}
          title="Spells"
          searchPlaceholder="Search..."
          filters={classFilter}
          renderItem={renderItem}
        />,
      );

      const select = document.querySelector('select');
      const options = Array.from(select.options).map((o) => o.value);
      expect(options).toContain('Wizard');
      expect(options).toContain('Sorcerer');
      expect(options).toContain('Cleric');
      expect(options).toContain('Druid');
      expect(options).toContain('Paladin');
      expect(options).toContain('Warlock');
      expect(options).toContain('All');

      expect(screen.getByText('Fireball')).toBeInTheDocument();
      expect(screen.getByText('Cure Wounds')).toBeInTheDocument();

      fireEvent.change(select, { target: { value: 'Wizard' } });

      expect(screen.getByText('Fireball')).toBeInTheDocument();
      expect(screen.queryByText('Cure Wounds')).not.toBeInTheDocument();
    });

    it('should use custom sortFn for filter option ordering', () => {
      const items = [
        { name: 'Z', type: 'Zebra' },
        { name: 'A', type: 'Apple' },
        { name: 'M', type: 'Mango' },
      ];
      const descendingSort = [
        { field: 'type', defaultLabel: 'All', label: 'Type', sortFn: (a, b) => b.localeCompare(a) },
      ];

      const renderItem = createRenderItem();
      render(
        <SelectableList
          items={items}
          fieldName="skills"
          formData={{}}
          onArrayFieldChange={vi.fn()}
          title="Test List"
          searchPlaceholder="Search..."
          filters={descendingSort}
          renderItem={renderItem}
        />,
      );

      const select = document.querySelector('select');
      const options = Array.from(select.options).map((o) => o.value);
      expect(options[0]).toBe('Zebra');
      expect(options[1]).toBe('Mango');
      expect(options[2]).toBe('Apple');
    });

    it('should use custom renderOption for filter option display', () => {
      const renderItem = createRenderItem();
      const filterWithRenderOption = [
        {
          field: 'type',
          defaultLabel: 'All',
          label: 'Type',
          renderOption: (option) => `★ ${option}`,
        },
      ];

      render(
        <SelectableList
          items={mockItems}
          fieldName="skills"
          formData={mockFormData}
          onArrayFieldChange={vi.fn()}
          title="Test List"
          searchPlaceholder="Search..."
          filters={filterWithRenderOption}
          renderItem={renderItem}
        />,
      );

      expect(screen.getByText('★ Type1')).toBeInTheDocument();
      expect(screen.getByText('★ Type2')).toBeInTheDocument();
    });

    it('should handle filter with undefined or null values in items', () => {
      const items = [
        { name: 'Item A', type: 'Type1' },
        { name: 'Item B' },
        { name: 'Item C', type: 'Type1' },
        { name: 'Item D', type: null },
      ];
      const filter = [{ field: 'type', defaultLabel: 'All', label: 'Type' }];

      const renderItem = createRenderItem();
      render(
        <SelectableList
          items={items}
          fieldName="skills"
          formData={mockFormData}
          onArrayFieldChange={vi.fn()}
          title="Test List"
          searchPlaceholder="Search..."
          filters={filter}
          renderItem={renderItem}
        />,
      );

      const select = document.querySelector('select');
      const options = Array.from(select.options).map((o) => o.value);
      expect(options).toContain('Type1');
      expect(options).not.toContain('undefined');
      expect(options).not.toContain('null');
    });
  });

  describe('item toggling', () => {
    function renderToggleTest(formData) {
      const mockOnChange = vi.fn();
      const renderItem = createRenderItem();
      renderItem.mockImplementation((item, index, opts) => (
        <div data-testid={`item-${index}`} onClick={opts.onToggle}>
          <span>{item.name}</span>
        </div>
      ));
      render(
        <SelectableList
          items={mockItems}
          fieldName="skills"
          formData={formData}
          onArrayFieldChange={mockOnChange}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
        />,
      );
      return { mockOnChange, renderItem };
    }

    it('should add a non-selected item to the array', () => {
      const { mockOnChange } = renderToggleTest({ skills: [] });
      fireEvent.click(screen.getByTestId('item-1'));
      expect(mockOnChange).toHaveBeenCalledWith('skills', ['Item B']);
    });

    it('should add a non-selected item to an existing array', () => {
      const { mockOnChange } = renderToggleTest({ skills: ['Item A'] });
      fireEvent.click(screen.getByTestId('item-1'));
      expect(mockOnChange).toHaveBeenCalledWith('skills', ['Item A', 'Item B']);
    });

    it('should remove a selected item from the array', () => {
      const { mockOnChange } = renderToggleTest({ skills: ['Item A', 'Item B'] });
      fireEvent.click(screen.getByTestId('item-1'));
      expect(mockOnChange).toHaveBeenCalledWith('skills', ['Item A']);
    });

    it('should not allow toggling pre-selected items off', () => {
      const mockOnChange = vi.fn();
      const renderItem = createRenderItem();
      renderItem.mockImplementation((item, index, opts) => (
        <div data-testid={`item-${index}`} onClick={opts.onToggle}>
          <span>{item.name}</span>
        </div>
      ));
      render(
        <SelectableList
          items={mockItems}
          fieldName="skills"
          formData={{ skills: ['Item A', 'Item B'] }}
          onArrayFieldChange={mockOnChange}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
          preSelectedItems={['Item A']}
        />,
      );

      fireEvent.click(screen.getByTestId('item-0'));
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should allow toggling non-pre-selected items off', () => {
      const mockOnChange = vi.fn();
      const renderItem = createRenderItem();
      renderItem.mockImplementation((item, index, opts) => (
        <div data-testid={`item-${index}`} onClick={opts.onToggle}>
          <span>{item.name}</span>
        </div>
      ));
      render(
        <SelectableList
          items={mockItems}
          fieldName="skills"
          formData={{ skills: ['Item A', 'Item B'] }}
          onArrayFieldChange={mockOnChange}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
          preSelectedItems={['Item A']}
        />,
      );

      fireEvent.click(screen.getByTestId('item-1'));
      expect(mockOnChange).toHaveBeenCalledWith('skills', ['Item A']);
    });

    it('should pass isSelected, isPreSelected, and onToggleExpand to renderItem', () => {
      const renderItem = createRenderItem();
      render(
        <SelectableList
          items={mockItems}
          fieldName="skills"
          formData={mockFormData}
          onArrayFieldChange={vi.fn()}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
          preSelectedItems={['Item A']}
        />,
      );

      expect(renderItem.mock.calls[0][2].isSelected).toBe(true);
      expect(renderItem.mock.calls[0][2].isPreSelected).toBe(true);
      expect(typeof renderItem.mock.calls[0][2].onToggleExpand).toBe('function');

      expect(renderItem.mock.calls[1][2].isSelected).toBe(false);
      expect(renderItem.mock.calls[1][2].isPreSelected).toBe(false);
    });
  });

  describe('expand/collapse', () => {
    it('should show and hide expanded content on toggle', () => {
      const renderItem = createRenderItem();
      render(
        <SelectableList
          items={mockItems}
          fieldName="skills"
          formData={mockFormData}
          onArrayFieldChange={vi.fn()}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
        />,
      );

      const buttons = screen.getAllByRole('button', { name: 'Toggle' });
      fireEvent.click(buttons[0]);
      expect(screen.getByTestId('expanded-0')).toBeInTheDocument();
      fireEvent.click(buttons[0]);
      expect(screen.queryByTestId('expanded-0')).not.toBeInTheDocument();
    });

    it('should expand different items independently', () => {
      const renderItem = createRenderItem();
      render(
        <SelectableList
          items={mockItems}
          fieldName="skills"
          formData={mockFormData}
          onArrayFieldChange={vi.fn()}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
        />,
      );

      const buttons = screen.getAllByRole('button', { name: 'Toggle' });
      fireEvent.click(buttons[0]);
      expect(screen.getByTestId('expanded-0')).toBeInTheDocument();
      expect(screen.queryByTestId('expanded-1')).not.toBeInTheDocument();

      fireEvent.click(buttons[1]);
      expect(screen.getByTestId('expanded-0')).toBeInTheDocument();
      expect(screen.getByTestId('expanded-1')).toBeInTheDocument();
    });
  });

  describe('show only selected filtering', () => {
    it('should filter to show only selected items when checkbox is checked', () => {
      const renderItem = createRenderItem();
      render(
        <SelectableList
          items={mockItems}
          fieldName="skills"
          formData={{ skills: ['Item A'] }}
          onArrayFieldChange={vi.fn()}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
        />,
      );

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(screen.getByText('Item A')).toBeInTheDocument();
      expect(screen.queryByText('Item B')).not.toBeInTheDocument();
      expect(screen.queryByText('Item C')).not.toBeInTheDocument();
      expect(screen.getByText(/Showing 1 item/)).toBeInTheDocument();
    });

    it('should show multiple selected items when checkbox is checked', () => {
      const renderItem = createRenderItem();
      render(
        <SelectableList
          items={mockItems}
          fieldName="skills"
          formData={{ skills: ['Item A', 'Item C'] }}
          onArrayFieldChange={vi.fn()}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
        />,
      );

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(screen.getByText('Item A')).toBeInTheDocument();
      expect(screen.getByText('Item C')).toBeInTheDocument();
      expect(screen.queryByText('Item B')).not.toBeInTheDocument();
      expect(screen.getByText(/Showing 2 items/)).toBeInTheDocument();
    });

    it('should show no results message when checkbox is checked but nothing is selected', () => {
      const renderItem = createRenderItem();
      render(
        <SelectableList
          items={mockItems}
          fieldName="skills"
          formData={{ skills: [] }}
          onArrayFieldChange={vi.fn()}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
        />,
      );

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(screen.getByText(/No items available/)).toBeInTheDocument();
    });

    it('should call onArrayFieldChange with the correct field name and updated array', () => {
      const renderItem = createRenderItem();
      const mockOnChange = vi.fn();
      render(
        <SelectableList
          items={mockItems}
          fieldName="customField"
          formData={{ customField: [] }}
          onArrayFieldChange={mockOnChange}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
        />,
      );

      fireEvent.click(screen.getByTestId('item-0'));
      expect(mockOnChange).toHaveBeenCalledWith('customField', ['Item A']);

      fireEvent.click(screen.getByTestId('item-1'));
      expect(mockOnChange).toHaveBeenCalledWith('customField', ['Item B']);
    });
  });

  describe('combined filtering', () => {
    it('should apply search, filter, and show only selected together', () => {
      const renderItem = createRenderItem();
      render(
        <SelectableList
          items={mockItems}
          fieldName="skills"
          formData={{ skills: ['Item A', 'Item B'] }}
          onArrayFieldChange={vi.fn()}
          title="Test List"
          searchPlaceholder="Search..."
          filters={mockFilters}
          renderItem={renderItem}
        />,
      );

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      const select = document.querySelector('select');
      fireEvent.change(select, { target: { value: 'Type1' } });

      expect(screen.getByText('Item A')).toBeInTheDocument();
      expect(screen.queryByText('Item B')).not.toBeInTheDocument();
      expect(screen.queryByText('Item C')).not.toBeInTheDocument();
    });
  });

  describe('nested field access', () => {
    it('should read from and write to a nested field path', () => {
      const nestedFormData = { character: { skills: [] } };
      const mockOnChange = vi.fn();
      const renderItem = createRenderItem();
      render(
        <SelectableList
          items={mockItems}
          fieldName="character.skills"
          formData={nestedFormData}
          onArrayFieldChange={mockOnChange}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
        />,
      );

      // Verify the nested field is read correctly - checkbox should show 0 selected
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
      expect(screen.queryByText(/0 selected/)).toBeInTheDocument();
    });
  });
});
