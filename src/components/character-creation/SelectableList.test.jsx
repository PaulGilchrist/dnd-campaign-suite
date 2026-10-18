// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SelectableList from './SelectableList.jsx';

const mockItems = [
  { name: 'Item A', index: 'alpha', type: 'Type1' },
  { name: 'Item B', index: 'bravo', type: 'Type2' },
  { name: 'Item C', index: 'charlie', type: 'Type1' },
];

const ITEM_NAMES = mockItems.map((i) => i.name);

// One renderItem for every test: exposes selection state as data attributes
// and each callback as a distinctly-named button (no click bubbling, since
// the row itself is not clickable here).
const renderItem = (item, index, opts) => (
  <div
    data-testid={`row-${index}`}
    data-selected={String(opts.isSelected)}
    data-pre-selected={String(opts.isPreSelected)}
    data-count={opts.itemCount}
  >
    <span>{item.name}</span>
    {opts.isExpanded ? <span data-testid={`expanded-${index}`}>Expanded</span> : null}
    <button onClick={opts.onToggle}>Select {item.name}</button>
    <button onClick={opts.onToggleExpand}>Expand {item.name}</button>
    <button onClick={opts.onRemove}>Remove {item.name}</button>
  </div>
);

const listElement = (props = {}) => (
  <SelectableList
    items={mockItems}
    fieldName="skills"
    formData={{ skills: [] }}
    onArrayFieldChange={vi.fn()}
    title="Test List"
    searchPlaceholder="Search..."
    renderItem={renderItem}
    {...props}
  />
);

function renderComponent(props = {}) {
  return render(listElement(props));
}

// Assert the exact set of visible item names.
function expectVisible(names) {
  ITEM_NAMES.forEach((name) => {
    expect(!!screen.queryByText(name), `${name} visible`).toBe(names.includes(name));
  });
}

function selectOptions() {
  return Array.from(document.querySelector('select').options).map((o) => o.value);
}

describe('SelectableList', () => {
  it('renders title, labelled search, summary/warnings, result count and selection count', () => {
    renderComponent({
      formData: { skills: ['Item A'] },
      resultLabel: 'spell',
      renderSummary: () => <div data-testid="summary">Summary</div>,
      renderWarnings: () => <div data-testid="warnings">Warnings</div>,
    });
    expect(screen.getByRole('heading', { name: 'Test List' })).toBeInTheDocument();
    expect(screen.getByLabelText('Search Test List')).toBeInTheDocument();
    expect(screen.getByText('Showing 3 spells')).toBeInTheDocument();
    expect(screen.getByText('1 selected)')).toBeInTheDocument();
    expect(screen.getByTestId('summary')).toBeInTheDocument();
    expect(screen.getByTestId('warnings')).toBeInTheDocument();
    expectVisible(ITEM_NAMES);
  });

  it('renders loading/empty state for missing data', () => {
    const { unmount } = renderComponent({ items: null });
    expect(screen.getByText('Data not yet loaded. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('Item A')).not.toBeInTheDocument();
    unmount();

    renderComponent({ items: [], loadingMessage: 'Loading...' });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('filters by search case-insensitively across name and index, restoring all when cleared', () => {
    renderComponent();
    const input = screen.getByLabelText('Search Test List');

    [
      ['item a', ['Item A']], // name match, case-insensitive
      ['bravo', ['Item B']], // index-only match
      ['nope', []], // no match → criteria message
      ['', ITEM_NAMES], // cleared → full list restored
    ].forEach(([query, visible]) => {
      fireEvent.change(input, { target: { value: query } });
      expectVisible(visible);
      if (visible.length === 0) {
        expect(screen.getByText(/No items found matching your criteria/)).toBeInTheDocument();
      }
    });
  });

  it.each([
    ['getValue', [{ field: 'type', defaultLabel: 'All', label: 'Type', getValue: (item) => item.type }]],
    ['item field', [{ field: 'type', defaultLabel: 'All', label: 'Type' }]],
  ])('filters via %s and restores all items when reset to defaultLabel', (_case, filters) => {
    renderComponent({ filters });
    const select = document.querySelector('select');
    fireEvent.change(select, { target: { value: 'Type1' } });
    expectVisible(['Item A', 'Item C']);
    fireEvent.change(select, { target: { value: 'All' } });
    expectVisible(ITEM_NAMES);
  });

  it('flattens array-valued items into exact dropdown options and filters by membership', () => {
    renderComponent({
      items: [
        { name: 'Fireball', classes: ['Wizard', 'Sorcerer'] },
        { name: 'Cure Wounds', classes: ['Cleric', 'Druid'] },
        { name: 'Eldritch Blast', classes: ['Warlock'] },
      ],
      filters: [{ field: 'classes', defaultLabel: 'All', label: 'Class' }],
    });
    expect(selectOptions()).toEqual(['All', 'Cleric', 'Druid', 'Sorcerer', 'Warlock', 'Wizard']);

    fireEvent.change(document.querySelector('select'), { target: { value: 'Wizard' } });
    expect(screen.getByText('Fireball')).toBeInTheDocument();
    expect(screen.queryByText('Cure Wounds')).not.toBeInTheDocument();
    expect(screen.queryByText('Eldritch Blast')).not.toBeInTheDocument();
  });

  it('applies sortFn ordering and renderOption labels to dropdown options', () => {
    renderComponent({
      filters: [{
        field: 'type',
        defaultLabel: 'All',
        label: 'Type',
        sortFn: (a, b) => b.localeCompare(a),
        renderOption: (option) => `★ ${option}`,
      }],
    });
    const options = Array.from(document.querySelector('select').options);
    expect(options.map((o) => o.value)).toEqual(['Type2', 'Type1', 'All']);
    expect(options.map((o) => o.textContent.trim())).toEqual(['★ Type2', '★ Type1', '★ All']);
  });

  it('omits undefined and null values from filter options', () => {
    renderComponent({
      items: [
        { name: 'Item A', type: 'Type1' },
        { name: 'Item B' },
        { name: 'Item D', type: null },
      ],
      filters: [{ field: 'type', defaultLabel: 'All', label: 'Type' }],
    });
    expect(selectOptions()).toEqual(['All', 'Type1']);
  });

  it.each([
    ['adds', [], ['Item B']],
    ['removes', ['Item A', 'Item B'], ['Item A']],
  ])('toggling a %s item emits the exact onChange payload', (_case, selected, expected) => {
    const onArrayFieldChange = vi.fn();
    renderComponent({ formData: { skills: selected }, onArrayFieldChange });

    expect(screen.getByTestId('row-1').dataset.selected).toBe(String(selected.includes('Item B')));
    fireEvent.click(screen.getByText('Select Item B'));
    expect(onArrayFieldChange).toHaveBeenCalledTimes(1);
    expect(onArrayFieldChange).toHaveBeenCalledWith('skills', expected);
  });

  it('locks pre-selected items from toggling off while allowing other selections', () => {
    const onArrayFieldChange = vi.fn();
    renderComponent({
      formData: { skills: ['Item A', 'Item B'] },
      preSelectedItems: ['Item A'],
      onArrayFieldChange,
    });

    const rowA = screen.getByTestId('row-0');
    expect(rowA.dataset.selected).toBe('true');
    expect(rowA.dataset.preSelected).toBe('true');
    expect(screen.getByTestId('row-1').dataset.preSelected).toBe('false');

    fireEvent.click(screen.getByText('Select Item A'));
    expect(onArrayFieldChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Select Item B'));
    expect(onArrayFieldChange).toHaveBeenCalledWith('skills', ['Item A']);
  });

  it('toggles a repeatable pre-selected item off and back on across re-renders', () => {
    const onArrayFieldChange = vi.fn();
    const props = {
      formData: { skills: ['Item A'] },
      repeatableItems: ['Item A'],
      preSelectedItems: ['Item A'],
      onArrayFieldChange,
    };
    const { rerender } = renderComponent(props);

    expect(screen.getByTestId('row-0').dataset.selected).toBe('true');
    fireEvent.click(screen.getByText('Select Item A'));
    expect(onArrayFieldChange).toHaveBeenCalledWith('skills', []);

    rerender(listElement({ ...props, formData: { skills: [] } }));
    expect(screen.getByTestId('row-0').dataset.selected).toBe('false');
    fireEvent.click(screen.getByText('Select Item A'));
    expect(onArrayFieldChange).toHaveBeenLastCalledWith('skills', ['Item A']);
  });

  it('removes one instance of a repeatable item and blocks guarded removals', () => {
    const onArrayFieldChange = vi.fn();
    const props = {
      items: [
        { name: 'Item A', index: 'alpha' },
        { name: 'Item B', index: 'bravo' },
      ],
      formData: { skills: ['Item A', 'Item A', 'Item B'] },
      repeatableItems: ['Item A'],
      preSelectedItems: ['Item A'],
      onArrayFieldChange,
    };
    const { rerender } = renderComponent(props);

    expect(screen.getByTestId('row-0').dataset.count).toBe('2');

    fireEvent.click(screen.getByText('Remove Item B')); // not repeatable → blocked
    expect(onArrayFieldChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Remove Item A')); // pre-selected with count 2 → remove one
    expect(onArrayFieldChange).toHaveBeenCalledWith('skills', ['Item A', 'Item B']);

    onArrayFieldChange.mockClear();
    rerender(listElement({ ...props, formData: { skills: ['Item A'] } }));
    expect(screen.getByTestId('row-0').dataset.count).toBe('1');
    fireEvent.click(screen.getByText('Remove Item A')); // pre-selected with count 1 → blocked
    expect(onArrayFieldChange).not.toHaveBeenCalled();
  });

  it('expands and collapses items independently', () => {
    renderComponent();

    fireEvent.click(screen.getByText('Expand Item A'));
    expect(screen.getByTestId('expanded-0')).toBeInTheDocument();
    expect(screen.queryByTestId('expanded-1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Expand Item B'));
    expect(screen.getByTestId('expanded-0')).toBeInTheDocument();
    expect(screen.getByTestId('expanded-1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Expand Item A'));
    expect(screen.queryByTestId('expanded-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('expanded-1')).toBeInTheDocument();
  });

  it('filters to selected items via show-only-selected and shows empty message when none remain', () => {
    const { rerender } = renderComponent({ formData: { skills: ['Item B'] } });

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expectVisible(['Item B']);
    expect(screen.getByText('Showing 1 item')).toBeInTheDocument();

    rerender(listElement({ formData: { skills: [] } }));
    expect(screen.getByText('No items available.')).toBeInTheDocument();
    expectVisible([]);
  });

  it('combines search, dropdown filter, and show-only-selected together', () => {
    renderComponent({
      formData: { skills: ['Item A', 'Item B'] },
      filters: [{ field: 'type', defaultLabel: 'All', label: 'Type' }],
    });

    fireEvent.change(screen.getByLabelText('Search Test List'), { target: { value: 'item' } });
    fireEvent.change(document.querySelector('select'), { target: { value: 'Type1' } });
    fireEvent.click(screen.getByRole('checkbox'));

    expectVisible(['Item A']);
  });

  it('reads and writes nested field paths', () => {
    const onArrayFieldChange = vi.fn();
    renderComponent({
      fieldName: 'character.skills',
      formData: { character: { skills: ['Item A'] } },
      onArrayFieldChange,
    });

    expect(screen.getByTestId('row-0').dataset.selected).toBe('true');
    expect(screen.getByText('1 selected)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Select Item B'));
    expect(onArrayFieldChange).toHaveBeenCalledWith('character.skills', ['Item A', 'Item B']);
  });

  it('renders without React key collisions when item identities repeat', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderComponent({
      items: [
        { name: 'Bless', index: 'bless' },
        { name: 'Bless', index: 'bless' },
        { name: 'Fire Bolt' },
        { name: 'Fire Bolt' },
        { name: 'Cure Wounds' },
      ],
    });

    expect(screen.getAllByText('Bless')).toHaveLength(2);
    expect(screen.getAllByText('Fire Bolt')).toHaveLength(2);
    expect(screen.getAllByText('Cure Wounds')).toHaveLength(1);
    expect(errorSpy.mock.calls.filter((args) => String(args[0]).includes('unique "key"'))).toHaveLength(0);
    errorSpy.mockRestore();
  });
});
