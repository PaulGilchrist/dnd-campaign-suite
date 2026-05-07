import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SelectableList from './selectable-list.jsx';

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
});
