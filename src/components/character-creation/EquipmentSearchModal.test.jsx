// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EquipmentSearchModal from './EquipmentSearchModal.jsx';

const mockEquipment = [
  {
    index: 'club',
    name: 'Club',
    equipment_category: 'Weapons',
    cost: { quantity: 1, unit: 'cp' },
    weight: 2,
  },
  {
    index: 'shield',
    name: 'Shield',
    equipment_category: 'Armor',
    cost: { quantity: 10, unit: 'gp' },
  },
  {
    index: 'rock',
    name: 'Rock',
    equipment_category: 'Adventuring Gear',
  },
];

const createMockProps = (overrides = {}) => ({
  showSearchModal: true,
  onClose: vi.fn(),
  filteredEquipment: [],
  searchQuery: '',
  onSearchChange: vi.fn(),
  selectedCategory: 'All',
  onCategoryChange: vi.fn(),
  showOnlySelected: false,
  onShowOnlySelectedChange: vi.fn(),
  onEquipmentSelect: vi.fn(),
  onAddCustomItem: vi.fn(),
  currentItemCount: 0,
  uniqueCategories: ['All', 'Weapons', 'Armor'],
  ...overrides,
});

describe('EquipmentSearchModal', () => {
  it('renders nothing when showSearchModal is false', () => {
    const props = createMockProps({ showSearchModal: false });
    const { container } = render(<EquipmentSearchModal {...props} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the open modal with its header and every control queryable', () => {
    render(<EquipmentSearchModal {...createMockProps()} />);
    expect(
      screen.getByRole('heading', { name: 'Select Equipment' })
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Search equipment...')
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '✕' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('reflects controlled props: query, category options/value, checkbox and count', () => {
    const props = createMockProps({
      searchQuery: 'sword',
      uniqueCategories: ['All', 'Weapons', 'Armor'],
      selectedCategory: 'Armor',
      showOnlySelected: true,
      currentItemCount: 5,
    });
    render(<EquipmentSearchModal {...props} />);
    expect(
      screen.getByPlaceholderText('Search equipment...')
    ).toHaveValue('sword');
    const select = screen.getByRole('combobox');
    expect(select.value).toBe('Armor');
    expect([...select.options].map(o => o.textContent)).toEqual([
      'All',
      'Weapons',
      'Armor',
    ]);
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByText('5 selected)')).toBeInTheDocument();
  });

  it('renders one row per result with exact cost/weight text and no stray output', () => {
    render(
      <EquipmentSearchModal
        {...createMockProps({ filteredEquipment: mockEquipment })}
      />
    );
    expect(screen.getByText('Club')).toBeInTheDocument();
    expect(screen.getByText('Shield')).toBeInTheDocument();
    expect(screen.getByText('Rock')).toBeInTheDocument();
    expect(screen.getByText('Adventuring Gear')).toBeInTheDocument();
    // Exact formatted cost/weight pairs — Club only full item, Shield lacks
    // weight, Rock lacks cost; missing values must render nothing (no
    // "undefined", no extra " lb").
    expect(screen.getAllByText(/\d+ (cp|gp)/).map(el => el.textContent)).toEqual(['1 cp', '10 gp']);
    expect(screen.getAllByText(/\d+ lb/).map(el => el.textContent)).toEqual(['2 lb']);
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
  });

  it('calls each filter handler with the exact new value when inputs change', () => {
    const props = createMockProps();
    render(<EquipmentSearchModal {...props} />);
    fireEvent.change(
      screen.getByPlaceholderText('Search equipment...'),
      { target: { value: 'dagger' } }
    );
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Weapons' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(props.onSearchChange).toHaveBeenCalledWith('dagger');
    expect(props.onCategoryChange).toHaveBeenCalledWith('Weapons');
    expect(props.onShowOnlySelectedChange).toHaveBeenCalledWith(true);
    expect(props.onEquipmentSelect).not.toHaveBeenCalled();
    expect(props.onAddCustomItem).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('calls onEquipmentSelect with the exact clicked item', () => {
    const props = createMockProps({ filteredEquipment: mockEquipment });
    render(<EquipmentSearchModal {...props} />);
    fireEvent.click(screen.getByText('Club'));
    expect(props.onEquipmentSelect).toHaveBeenCalledWith(mockEquipment[0]);
  });

  it('calls onAddCustomItem with the trimmed query when Enter is pressed', () => {
    const props = createMockProps({ searchQuery: '  sword  ' });
    render(<EquipmentSearchModal {...props} />);
    fireEvent.keyDown(screen.getByPlaceholderText('Search equipment...'), {
      key: 'Enter',
    });
    expect(props.onAddCustomItem).toHaveBeenCalledWith('sword');
  });

  it('does not add a custom item for non-Enter keys or blank queries', () => {
    const props = createMockProps({ searchQuery: 'shield' });
    const { rerender } = render(<EquipmentSearchModal {...props} />);
    fireEvent.keyDown(screen.getByPlaceholderText('Search equipment...'), {
      key: 'Tab',
    });
    rerender(<EquipmentSearchModal {...props} searchQuery="   " />);
    fireEvent.keyDown(screen.getByPlaceholderText('Search equipment...'), {
      key: 'Enter',
    });
    expect(props.onAddCustomItem).not.toHaveBeenCalled();
  });

  it('closes via both the ✕ icon and the footer Close button', () => {
    const props = createMockProps();
    render(<EquipmentSearchModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it('swaps empty-state copy when a query is entered', () => {
    const props = createMockProps();
    const { rerender } = render(<EquipmentSearchModal {...props} />);
    expect(
      screen.getByText('Start typing to search equipment.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('No matches found. Press Enter to add as custom item.')
    ).not.toBeInTheDocument();

    rerender(
      <EquipmentSearchModal {...props} searchQuery="nonexistent" />
    );
    expect(
      screen.getByText('No matches found. Press Enter to add as custom item.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Start typing to search equipment.')
    ).not.toBeInTheDocument();
  });
});
