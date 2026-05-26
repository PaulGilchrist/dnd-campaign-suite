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

describe('SelectableList', () => {
  const mockRenderItem = vi.fn((item, index, opts) => (
      <div data-testid={`item-${index}`} onClick={opts.onToggle} className={opts.isSelected ? 'selected' : ''}>
        <span>{item.name}</span>
        {opts.isExpanded && <span data-testid={`expanded-${index}`}>Expanded</span>}
        <button onClick={opts.onToggleExpand}>Toggle</button>
      </div>
    ));

  const mockRenderSummary = vi.fn(() => <div data-testid="summary">Summary</div>);
  const mockRenderWarnings = vi.fn(() => <div data-testid="warnings">Warnings</div>);

  beforeEach(() => {
    vi.clearAllMocks();
    });

  it('should render the title', () => {
    render(
        <SelectableList
         items={mockItems}
         fieldName="skills"
         formData={mockFormData}
         onArrayFieldChange={vi.fn()}
         title="Test List"
         searchPlaceholder="Search..."
         filters={[]}
         renderItem={mockRenderItem}
        />
      );

    expect(screen.getByText('Test List')).toBeInTheDocument();
    });

  it('should render loading message when no items', () => {
    render(
        <SelectableList
         items={[]}
         fieldName="skills"
         formData={{}}
         onArrayFieldChange={vi.fn()}
         title="Test List"
         searchPlaceholder="Search..."
         filters={[]}
         renderItem={mockRenderItem}
         loadingMessage="Loading..."
        />
      );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

  it('should render search input', () => {
    render(
        <SelectableList
         items={mockItems}
         fieldName="skills"
         formData={mockFormData}
         onArrayFieldChange={vi.fn()}
         title="Test List"
         searchPlaceholder="Search items..."
         filters={[]}
         renderItem={mockRenderItem}
        />
      );

    expect(screen.getByPlaceholderText('Search items...')).toBeInTheDocument();
    });

  it('should filter items by search query', () => {
    render(
        <SelectableList
         items={mockItems}
         fieldName="skills"
         formData={mockFormData}
         onArrayFieldChange={vi.fn()}
         title="Test List"
         searchPlaceholder="Search..."
         filters={[]}
         renderItem={mockRenderItem}
        />
      );

    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'Item A' } });

    expect(screen.getByText('Item A')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Item A')).toBeInTheDocument();
    });

  it('should show filter dropdowns with correct label', () => {
    render(
        <SelectableList
         items={mockItems}
         fieldName="skills"
         formData={mockFormData}
         onArrayFieldChange={vi.fn()}
         title="Test List"
         searchPlaceholder="Search..."
         filters={mockFilters}
         renderItem={mockRenderItem}
        />
      );

     const label = screen.getByText('Type1');
    expect(label).toBeInTheDocument();
    });

  it('should filter by selected type', () => {
    render(
        <SelectableList
         items={mockItems}
         fieldName="skills"
         formData={mockFormData}
         onArrayFieldChange={vi.fn()}
         title="Test List"
         searchPlaceholder="Search..."
         filters={mockFilters}
         renderItem={mockRenderItem}
        />
      );

    const select = document.querySelector('select');
    fireEvent.change(select, { target: { value: 'Type1' } });

    expect(screen.getByText('Item A')).toBeInTheDocument();
    });

  it('should show "Show Only Selected" checkbox', () => {
    render(
        <SelectableList
         items={mockItems}
         fieldName="skills"
         formData={mockFormData}
         onArrayFieldChange={vi.fn()}
         title="Test List"
         searchPlaceholder="Search..."
         filters={[]}
         renderItem={mockRenderItem}
        />
      );

    expect(screen.getByText(/Show Only Selected/)).toBeInTheDocument();
    });

  it('should filter to show only selected items when checkbox is checked', () => {
    render(
        <SelectableList
         items={mockItems}
         fieldName="skills"
         formData={mockFormData}
         onArrayFieldChange={vi.fn()}
         title="Test List"
         searchPlaceholder="Search..."
         filters={[]}
         renderItem={mockRenderItem}
        />
      );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    });

  it('should display result count', () => {
    render(
        <SelectableList
         items={mockItems}
         fieldName="skills"
         formData={mockFormData}
         onArrayFieldChange={vi.fn()}
         title="Test List"
         searchPlaceholder="Search..."
         filters={[]}
         renderItem={mockRenderItem}
        />
      );

    expect(screen.getByText(/Showing 3 items/)).toBeInTheDocument();
    });

  it('should call onArrayFieldChange when item is toggled', () => {
    const mockOnChange = vi.fn();
    mockRenderItem.mockImplementation((item, index, opts) => (
        <div data-testid={`item-${index}`} onClick={opts.onToggle}>
         <span>{item.name}</span>
        </div>
       ));

    render(
        <SelectableList
         items={mockItems}
         fieldName="skills"
         formData={mockFormData}
         onArrayFieldChange={mockOnChange}
         title="Test List"
         searchPlaceholder="Search..."
         filters={[]}
         renderItem={mockRenderItem}
        />
      );

    fireEvent.click(screen.getByTestId('item-1'));

    expect(mockOnChange).toHaveBeenCalled();
    });

  it('should call renderSummary when provided', () => {
    render(
        <SelectableList
         items={mockItems}
         fieldName="skills"
         formData={mockFormData}
         onArrayFieldChange={vi.fn()}
         title="Test List"
         searchPlaceholder="Search..."
         filters={[]}
         renderItem={mockRenderItem}
         renderSummary={mockRenderSummary}
        />
      );

    expect(screen.getByTestId('summary')).toBeInTheDocument();
    });

  it('should call renderWarnings when provided', () => {
    render(
        <SelectableList
         items={mockItems}
         fieldName="skills"
         formData={mockFormData}
         onArrayFieldChange={vi.fn()}
         title="Test List"
         searchPlaceholder="Search..."
         filters={[]}
         renderItem={mockRenderItem}
         renderWarnings={mockRenderWarnings}
        />
      );

    expect(screen.getByTestId('warnings')).toBeInTheDocument();
    });

  it('should show no results message when search has no matches', () => {
    render(
        <SelectableList
         items={mockItems}
         fieldName="skills"
         formData={mockFormData}
         onArrayFieldChange={vi.fn()}
         title="Test List"
         searchPlaceholder="Search..."
         filters={[]}
         renderItem={mockRenderItem}
         resultLabel="item"
        />
      );

    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'ZZZZ' } });

    expect(screen.getByText(/No item found matching your criteria/)).toBeInTheDocument();
    });

  it('should apply custom className', () => {
    const { container } = render(
        <SelectableList
         items={mockItems}
         fieldName="skills"
         formData={mockFormData}
         onArrayFieldChange={vi.fn()}
         title="Test List"
         searchPlaceholder="Search..."
         filters={[]}
         renderItem={mockRenderItem}
         className="custom-class"
        />
      );

    expect(container.querySelector('.wizard-step.custom-class')).toBeInTheDocument();
    });

  it('should filter by multi-value array property', () => {
    const multiClassItems = [
      { name: 'Fireball', classes: ['Wizard', 'Sorcerer'] },
      { name: 'Cure Wounds', classes: ['Cleric', 'Druid', 'Paladin'] },
      { name: 'Eldritch Blast', classes: ['Warlock'] },
    ];
    const classFilter = [
      { field: 'classes', defaultLabel: 'All', label: 'Class' },
    ];

    render(
        <SelectableList
         items={multiClassItems}
         fieldName="skills"
         formData={mockFormData}
         onArrayFieldChange={vi.fn()}
         title="Spells"
         searchPlaceholder="Search..."
         filters={classFilter}
         renderItem={mockRenderItem}
        />
      );

    // Should show all items initially
    expect(screen.getByText('Fireball')).toBeInTheDocument();
    expect(screen.getByText('Cure Wounds')).toBeInTheDocument();

    // Filter by Wizard — should show Fireball but not Cure Wounds
    const select = document.querySelector('select');
    fireEvent.change(select, { target: { value: 'Wizard' } });

    expect(screen.getByText('Fireball')).toBeInTheDocument();
    expect(screen.queryByText('Cure Wounds')).not.toBeInTheDocument();
    expect(screen.queryByText('Eldritch Blast')).not.toBeInTheDocument();
  });

  it('should include array values as filter options', () => {
    const multiClassItems = [
      { name: 'Fireball', classes: ['Wizard', 'Sorcerer'] },
      { name: 'Cure Wounds', classes: ['Cleric', 'Druid'] },
    ];
    const classFilter = [
      { field: 'classes', defaultLabel: 'All', label: 'Class' },
    ];

    render(
        <SelectableList
         items={multiClassItems}
         fieldName="skills"
         formData={mockFormData}
         onArrayFieldChange={vi.fn()}
         title="Spells"
         searchPlaceholder="Search..."
         filters={classFilter}
         renderItem={mockRenderItem}
        />
      );

    // Options should include each class from the arrays
    const select = document.querySelector('select');
    const options = Array.from(select.options).map(o => o.value);
    expect(options).toContain('Wizard');
    expect(options).toContain('Sorcerer');
    expect(options).toContain('Cleric');
    expect(options).toContain('Druid');
  });

  it('should prevent toggling off pre-selected items', () => {
    const mockOnChange = vi.fn();
    const preSelectedFormData = { skills: ['Item A', 'Item B'] };

    mockRenderItem.mockImplementation((item, index, opts) => (
        <div data-testid={`item-${index}`} onClick={opts.onToggle}>
         <span>{item.name}</span>
        </div>
       ));

    render(
        <SelectableList
         items={mockItems}
         fieldName="skills"
         formData={preSelectedFormData}
         onArrayFieldChange={mockOnChange}
         title="Test List"
         searchPlaceholder="Search..."
         filters={[]}
         renderItem={mockRenderItem}
         preSelectedItems={['Item A']}
        />
      );

    // Click the pre-selected item (Item A) — should NOT trigger onChange
    fireEvent.click(screen.getByTestId('item-0'));
    expect(mockOnChange).not.toHaveBeenCalled();

    // Click a non-pre-selected but selected item (Item B) — should trigger onChange
    mockOnChange.mockClear();
    fireEvent.click(screen.getByTestId('item-1'));
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('should filter to show only selected items when checkbox is checked (actual filtering)', () => {
    const onArrayFieldChange = vi.fn();
    mockRenderItem.mockImplementation((item, index, opts) => (
        <div data-testid={`item-${index}`} onClick={opts.onToggle}>
         <span>{item.name}</span>
        </div>
       ));

    render(
        <SelectableList
         items={mockItems}
         fieldName="skills"
         formData={{ skills: ['Item A'] }}
         onArrayFieldChange={onArrayFieldChange}
         title="Test List"
         searchPlaceholder="Search..."
         filters={[]}
         renderItem={mockRenderItem}
        />
      );

    // Initially all 3 items visible
    expect(screen.getByText('Item A')).toBeInTheDocument();
    expect(screen.getByText('Item B')).toBeInTheDocument();
    expect(screen.getByText('Item C')).toBeInTheDocument();

    // Toggle "Show Only Selected" checkbox
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    // Only Item A should remain (it's selected)
    expect(screen.getByText('Item A')).toBeInTheDocument();
    expect(screen.queryByText('Item B')).not.toBeInTheDocument();
    expect(screen.queryByText('Item C')).not.toBeInTheDocument();

    // Result count should update
    expect(screen.getByText(/Showing 1 item/)).toBeInTheDocument();
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

    mockRenderItem.mockImplementation((item, index) => (
        <div data-testid={`item-${index}`}>
         <span>{item.name}</span>
        </div>
       ));

    render(
        <SelectableList
         items={items}
         fieldName="skills"
         formData={{}}
         onArrayFieldChange={vi.fn()}
         title="Test List"
         searchPlaceholder="Search..."
         filters={descendingSort}
         renderItem={mockRenderItem}
        />
      );

    const select = document.querySelector('select');
    const options = Array.from(select.options).map(o => o.value);
    // With descending sortFn, "All" is alphabetically smallest and sorts last
    expect(options[0]).toBe('Zebra');
    expect(options[1]).toBe('Mango');
    expect(options[2]).toBe('Apple');
    expect(options[3]).toBe('All');
  });

  it('should show "No items found" with active search even when items exist', () => {
    mockRenderItem.mockImplementation((item, index, opts) => (
        <div data-testid={`item-${index}`} onClick={opts.onToggle}>
         <span>{item.name}</span>
        </div>
       ));

    render(
        <SelectableList
         items={mockItems}
         fieldName="skills"
         formData={mockFormData}
         onArrayFieldChange={vi.fn()}
         title="Test List"
         searchPlaceholder="Search..."
         filters={[]}
         renderItem={mockRenderItem}
        />
      );

    // Active search that matches nothing
    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'ZZZZ' } });
    expect(screen.getByText(/found matching your criteria/)).toBeInTheDocument();
    expect(screen.queryByText(/No items available/)).not.toBeInTheDocument();
  });

  it('should show "No items available" when there are items but none match (no search/filter)', () => {
    mockRenderItem.mockImplementation((item, index, opts) => (
        <div data-testid={`item-${index}`} onClick={opts.onToggle}>
         <span>{item.name}</span>
        </div>
       ));

    render(
        <SelectableList
         items={[{ name: 'HiddenItem' }]}
         fieldName="skills"
         formData={{ skills: [] }}
         onArrayFieldChange={vi.fn()}
         title="Test List"
         searchPlaceholder="Search..."
         renderItem={mockRenderItem}
        />
      );

    // Enable show only selected when nothing is selected
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    // No search query, no active filters — should say "available" not "found"
    expect(screen.getByText(/No items available/)).toBeInTheDocument();
    expect(screen.queryByText(/found matching your criteria/)).not.toBeInTheDocument();
  });
});
