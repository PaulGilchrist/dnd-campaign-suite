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

    it('should render a custom className on the root element', () => {
      const { container } = renderComponent({ className: 'custom-class' });
      expect(container.querySelector('.wizard-step.custom-class')).toBeInTheDocument();
    });

    it('should render a custom className on the results container', () => {
      const { container } = renderComponent({ className: 'custom-class' });
      expect(container.querySelector('.custom-class-results-container')).toBeInTheDocument();
    });

    it('should render a custom className on the results header', () => {
      const { container } = renderComponent({ className: 'custom-class' });
      expect(container.querySelector('.custom-class-results-header')).toBeInTheDocument();
    });

    it('should render a custom className on the results list', () => {
      const { container } = renderComponent({ className: 'custom-class' });
      expect(container.querySelector('.custom-class-results-list')).toBeInTheDocument();
    });

    it('should render search input with the correct placeholder', () => {
      renderComponent({ searchPlaceholder: 'Search items...' });
      expect(screen.getByPlaceholderText('Search items...')).toBeInTheDocument();
    });

    it('should render the search input with the correct id', () => {
      renderComponent();
      expect(screen.getByLabelText('Search Test List')).toBeInTheDocument();
    });

    it('should render result count with plural when multiple items', () => {
      renderComponent();
      expect(screen.getByText(/Showing 3 items/)).toBeInTheDocument();
    });

    it('should render result count with singular when one item', () => {
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

    it('should render renderSummary when provided', () => {
      const mockRenderSummary = createRenderSummary();
      renderComponent({ renderSummary: mockRenderSummary });
      expect(screen.getByTestId('summary')).toBeInTheDocument();
      expect(mockRenderSummary).toHaveBeenCalled();
    });

    it('should not call renderSummary when not provided', () => {
      const mockRenderSummary = createRenderSummary();
      renderComponent();
      expect(mockRenderSummary).not.toHaveBeenCalled();
    });

    it('should render renderWarnings when provided', () => {
      const mockRenderWarnings = createRenderWarnings();
      renderComponent({ renderWarnings: mockRenderWarnings });
      expect(screen.getByTestId('warnings')).toBeInTheDocument();
      expect(mockRenderWarnings).toHaveBeenCalled();
    });

    it('should not call renderWarnings when not provided', () => {
      const mockRenderWarnings = createRenderWarnings();
      renderComponent();
      expect(mockRenderWarnings).not.toHaveBeenCalled();
    });

    it('should render "Show Only Selected" checkbox with selected count', () => {
      renderComponent();
      expect(screen.getByText(/Show Only Selected/)).toBeInTheDocument();
      expect(screen.getByText(/1 selected\)/)).toBeInTheDocument();
    });
  });

  describe('loading/empty state', () => {
    it('should render loading message when items is empty array', () => {
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

    it('should render loading message when items is null', () => {
      const renderItem = createRenderItem();
      render(
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
    });

    it('should render loading message when items is undefined', () => {
      const renderItem = createRenderItem();
      render(
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

    it('should still render the title in the loading state', () => {
      const renderItem = createRenderItem();
      render(
        <SelectableList
          items={[]}
          fieldName="skills"
          formData={{}}
          onArrayFieldChange={vi.fn()}
          title="My Title"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
        />,
      );
      expect(screen.getByText('My Title')).toBeInTheDocument();
    });

    it('should render the loading message with a custom className', () => {
      const renderItem = createRenderItem();
      const { container } = render(
        <SelectableList
          items={[]}
          fieldName="skills"
          formData={{}}
          onArrayFieldChange={vi.fn()}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
          className="custom-class"
        />,
      );
      expect(container.querySelector('.wizard-step.custom-class')).toBeInTheDocument();
    });
  });

  describe('search filtering', () => {
    it('should filter items by search query matching name', () => {
      renderComponent();
      fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'Item A' } });
      expect(screen.getByText('Item A')).toBeInTheDocument();
      expect(screen.queryByText('Item B')).not.toBeInTheDocument();
      expect(screen.queryByText('Item C')).not.toBeInTheDocument();
    });

    it('should filter items by search query matching index', () => {
      renderComponent();
      fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'b' } });
      expect(screen.getByText('Item B')).toBeInTheDocument();
      expect(screen.queryByText('Item A')).not.toBeInTheDocument();
    });

    it('should be case-insensitive when filtering by search query', () => {
      renderComponent();
      fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'item a' } });
      expect(screen.getByText('Item A')).toBeInTheDocument();
      expect(screen.queryByText('Item B')).not.toBeInTheDocument();
    });

    it('should show all items when search query is cleared', () => {
      renderComponent();
      fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'Item A' } });
      expect(screen.getByText('Item A')).toBeInTheDocument();
      fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: '' } });
      expect(screen.getByText('Item A')).toBeInTheDocument();
      expect(screen.getByText('Item B')).toBeInTheDocument();
      expect(screen.getByText('Item C')).toBeInTheDocument();
    });

    it('should show no results message when search has no matches', () => {
      renderComponent({ resultLabel: 'item' });
      fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'ZZZZ' } });
      expect(screen.getByText(/No item found matching your criteria/)).toBeInTheDocument();
      expect(screen.getByText(/Showing 0 items/)).toBeInTheDocument();
    });

    it('should show the "found" message when search is active but no items match', () => {
      renderComponent();
      fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'ZZZZ' } });
      expect(screen.getByText(/found matching your criteria/)).toBeInTheDocument();
      expect(screen.queryByText(/No items available/)).not.toBeInTheDocument();
    });

    it('should show the "available" message when no items match without active search', () => {
      const renderItem = createRenderItem();
      renderItem.mockImplementation((item) => <div key={item.name}>{item.name}</div>);
      render(
        <SelectableList
          items={[{ name: 'HiddenItem' }]}
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
      expect(screen.queryByText(/found matching your criteria/)).not.toBeInTheDocument();
    });

    it('should trim whitespace from search queries', () => {
      const renderItem = createRenderItem();
      renderItem.mockImplementation((item) => <div key={item.name}>{item.name}</div>);
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
      fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: '   ' } });
      expect(screen.getByText('Item A')).toBeInTheDocument();
    });
  });

  describe('filter dropdowns', () => {
    it('should render filter dropdowns with correct label', () => {
      renderComponent({ filters: mockFilters });
      expect(screen.getByText('Type1')).toBeInTheDocument();
    });

    it('should default filter to the defaultLabel option', () => {
      renderComponent({ filters: mockFilters });
      const select = document.querySelector('select');
      expect(select.value).toBe('All');
    });

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
      expect(screen.getByText('Item A')).toBeInTheDocument();
      fireEvent.change(select, { target: { value: 'All' } });
      expect(screen.getByText('Item A')).toBeInTheDocument();
      expect(screen.getByText('Item B')).toBeInTheDocument();
      expect(screen.getByText('Item C')).toBeInTheDocument();
    });

    it('should include array values as filter options', () => {
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
    });

    it('should filter by multi-value array property', () => {
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

      expect(screen.getByText('Fireball')).toBeInTheDocument();
      expect(screen.getByText('Cure Wounds')).toBeInTheDocument();

      const select = document.querySelector('select');
      fireEvent.change(select, { target: { value: 'Wizard' } });

      expect(screen.getByText('Fireball')).toBeInTheDocument();
      expect(screen.queryByText('Cure Wounds')).not.toBeInTheDocument();
      expect(screen.queryByText('Eldritch Blast')).not.toBeInTheDocument();
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
      expect(options[3]).toBe('All');
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

    it('should handle filter with undefined values in items', () => {
      const items = [
        { name: 'Item A', type: 'Type1' },
        { name: 'Item B' },
        { name: 'Item C', type: 'Type1' },
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
    });

    it('should handle filter with null values in items', () => {
      const items = [
        { name: 'Item A', type: 'Type1' },
        { name: 'Item B', type: null },
        { name: 'Item C', type: 'Type1' },
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
      expect(options).not.toContain('null');
    });
  });

  describe('item toggling', () => {
    it('should call onArrayFieldChange when a non-selected item is clicked', () => {
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
          formData={{ skills: [] }}
          onArrayFieldChange={mockOnChange}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
        />,
      );

      fireEvent.click(screen.getByTestId('item-1'));
      expect(mockOnChange).toHaveBeenCalledWith('skills', ['Item B']);
    });

    it('should call onArrayFieldChange when a selected item is toggled off', () => {
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
          formData={{ skills: ['Item A'] }}
          onArrayFieldChange={mockOnChange}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
        />,
      );

      fireEvent.click(screen.getByTestId('item-0'));
      expect(mockOnChange).toHaveBeenCalledWith('skills', []);
    });

    it('should call onArrayFieldChange with the updated array when toggling on', () => {
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
          formData={{ skills: ['Item A'] }}
          onArrayFieldChange={mockOnChange}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
        />,
      );

      fireEvent.click(screen.getByTestId('item-1'));
      expect(mockOnChange).toHaveBeenCalledWith('skills', ['Item A', 'Item B']);
    });

    it('should not call onArrayFieldChange when a pre-selected item is toggled off', () => {
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

    it('should call onArrayFieldChange when a non-pre-selected selected item is toggled off', () => {
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

    it('should pass isSelected to renderItem for selected items', () => {
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

      const firstCall = renderItem.mock.calls[0];
      expect(firstCall[2].isSelected).toBe(true);
    });

    it('should pass isSelected to renderItem for non-selected items', () => {
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

      const secondCall = renderItem.mock.calls[1];
      expect(secondCall[2].isSelected).toBe(false);
    });

    it('should pass isPreSelected to renderItem for pre-selected items', () => {
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

      const firstCall = renderItem.mock.calls[0];
      expect(firstCall[2].isPreSelected).toBe(true);
    });

    it('should pass isPreSelected to renderItem for non-pre-selected items', () => {
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

      const secondCall = renderItem.mock.calls[1];
      expect(secondCall[2].isPreSelected).toBe(false);
    });

    it('should pass onToggleExpand to renderItem', () => {
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

      const firstCall = renderItem.mock.calls[0];
      expect(typeof firstCall[2].onToggleExpand).toBe('function');
    });
  });

  describe('expand/collapse', () => {
    it('should show expanded content when item is expanded', () => {
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
    });

    it('should hide expanded content when item is collapsed', () => {
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
    it('should show all items when the checkbox is unchecked', () => {
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

      expect(screen.getByText('Item A')).toBeInTheDocument();
      expect(screen.getByText('Item B')).toBeInTheDocument();
      expect(screen.getByText('Item C')).toBeInTheDocument();
    });

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

    it('should combine show only selected with search filtering', () => {
      const renderItem = createRenderItem();
      render(
        <SelectableList
          items={mockItems}
          fieldName="skills"
          formData={{ skills: ['Item A', 'Item B'] }}
          onArrayFieldChange={vi.fn()}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
        />,
      );

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'B' } });

      expect(screen.getByText('Item B')).toBeInTheDocument();
      expect(screen.queryByText('Item A')).not.toBeInTheDocument();
      expect(screen.queryByText('Item C')).not.toBeInTheDocument();
    });
  });

  describe('combined filtering', () => {
    it('should apply search and filter together', () => {
      const renderItem = createRenderItem();
      render(
        <SelectableList
          items={mockItems}
          fieldName="skills"
          formData={mockFormData}
          onArrayFieldChange={vi.fn()}
          title="Test List"
          searchPlaceholder="Search..."
          filters={mockFilters}
          renderItem={renderItem}
        />,
      );

      fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'Item' } });
      const select = document.querySelector('select');
      fireEvent.change(select, { target: { value: 'Type1' } });

      expect(screen.getByText('Item A')).toBeInTheDocument();
      expect(screen.getByText('Item C')).toBeInTheDocument();
      expect(screen.queryByText('Item B')).not.toBeInTheDocument();
    });

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

    it('should sort filtered results by name', () => {
      const renderItem = createRenderItem();
      const unsortedItems = [
        { name: 'Zebra', type: 'Type1' },
        { name: 'Apple', type: 'Type1' },
        { name: 'Mango', type: 'Type2' },
      ];
      render(
        <SelectableList
          items={unsortedItems}
          fieldName="skills"
          formData={mockFormData}
          onArrayFieldChange={vi.fn()}
          title="Test List"
          searchPlaceholder="Search..."
          filters={mockFilters}
          renderItem={renderItem}
        />,
      );

      const testIds = [...screen.getAllByTestId(/item-/)].map((el) => el.getAttribute('data-testid'));
      // After filtering to Type1 and sorting alphabetically: Apple, Zebra
      // The index passed to renderItem is the position in the sorted array
      expect(testIds[0]).toBe('item-0');
      expect(testIds[1]).toBe('item-1');
    });
  });

  describe('nested field access', () => {
    it('should read from a nested field path', () => {
      const nestedFormData = { character: { skills: ['Item A'] } };
      const mockOnChange = vi.fn();
      const renderItem = createRenderItem();
      renderItem.mockImplementation((item, index) => (
        <div data-testid={`item-${index}`} onClick={() => {}}>
          <span>{item.name}</span>
        </div>
      ));
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

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(screen.getByText('Item A')).toBeInTheDocument();
      expect(screen.queryByText('Item B')).not.toBeInTheDocument();
    });

    it('should write to a nested field path', () => {
      const nestedFormData = { character: { skills: [] } };
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
          fieldName="character.skills"
          formData={nestedFormData}
          onArrayFieldChange={mockOnChange}
          title="Test List"
          searchPlaceholder="Search..."
          filters={[]}
          renderItem={renderItem}
        />,
      );

      fireEvent.click(screen.getByTestId('item-0'));
      expect(mockOnChange).toHaveBeenCalledWith('character.skills', ['Item A']);
    });
  });
});
