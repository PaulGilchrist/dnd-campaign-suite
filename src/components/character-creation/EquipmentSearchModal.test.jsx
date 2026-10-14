import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    index: 'dagger',
    name: 'Dagger',
    equipment_category: 'Weapons',
    cost: { quantity: 2, unit: 'gp' },
    weight: 1,
  },
  {
    index: 'leather-armor',
    name: 'Leather Armor',
    equipment_category: 'Armor',
    cost: { quantity: 10, unit: 'gp' },
    weight: 12,
  },
  {
    index: 'shield',
    name: 'Shield',
    equipment_category: 'Armor',
    cost: { quantity: 10, unit: 'gp' },
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
  searchField: 'backpack',
  uniqueCategories: ['All', 'Weapons', 'Armor'],
  ...overrides,
});

describe('EquipmentSearchModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render nothing when showSearchModal is false', () => {
      const props = createMockProps({ showSearchModal: false });
      const { container } = render(<EquipmentSearchModal {...props} />);
      expect(container.innerHTML).toBe('');
    });

    it('should render the modal overlay and header when visible', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} />);
      expect(screen.getByText('Select Equipment')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('should render category filter dropdown from uniqueCategories', () => {
      const props = createMockProps({
        uniqueCategories: ['All', 'Weapons', 'Armor', 'Potions'],
      });
      render(<EquipmentSearchModal {...props} />);
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(select.value).toBe('All');
      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(4);
      expect(options[0].textContent).toBe('All');
      expect(options[3].textContent).toBe('Potions');
    });

    it('should render search input with correct placeholder', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} />);
      const input = screen.getByPlaceholderText('Search equipment...');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should render the show-only-selected checkbox with item count', () => {
      const props = createMockProps({ currentItemCount: 5 });
      render(<EquipmentSearchModal {...props} />);
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
      expect(screen.getByText(/Show Only Selected/)).toBeInTheDocument();
      expect(screen.getByText('5 selected)')).toBeInTheDocument();
    });

    it('should render equipment items with name, category, cost, and weight', () => {
      const props = createMockProps({
        filteredEquipment: mockEquipment,
      });
      render(<EquipmentSearchModal {...props} />);
      expect(screen.getByText('Club')).toBeInTheDocument();
      expect(screen.getByText('Dagger')).toBeInTheDocument();
      expect(screen.getByText('Leather Armor')).toBeInTheDocument();
      expect(screen.getByText('Shield')).toBeInTheDocument();
      expect(screen.getByText('1 cp')).toBeInTheDocument();
      expect(screen.getByText('2 gp')).toBeInTheDocument();
      expect(screen.getByText('2 lb')).toBeInTheDocument();
      expect(screen.getByText('1 lb')).toBeInTheDocument();
      expect(screen.getByText('12 lb')).toBeInTheDocument();
    });

    it('should render equipment with missing cost (renders empty cost span)', () => {
      const itemWithoutCost = {
        index: 'rock',
        name: 'Rock',
        equipment_category: 'Misc',
      };
      const props = createMockProps({
        filteredEquipment: [itemWithoutCost],
      });
      render(<EquipmentSearchModal {...props} />);
      expect(screen.getByText('Rock')).toBeInTheDocument();
      const details = screen.getByText('Rock').parentElement;
      expect(details.querySelector('.equipment-item-cost')).toBeInTheDocument();
    });

    it('should render equipment with missing weight (no weight span)', () => {
      const itemWithoutWeight = {
        index: 'shield',
        name: 'Shield',
        equipment_category: 'Armor',
        cost: { quantity: 10, unit: 'gp' },
      };
      const props = createMockProps({
        filteredEquipment: [itemWithoutWeight],
      });
      render(<EquipmentSearchModal {...props} />);
      expect(screen.getByText('Shield')).toBeInTheDocument();
      expect(screen.queryByText(' lb')).not.toBeInTheDocument();
    });
  });

  describe('state display', () => {
    it('should reflect showOnlySelected value in checkbox state', () => {
      const props = createMockProps({ showOnlySelected: true });
      render(<EquipmentSearchModal {...props} />);
      expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('should display search query value in the input', () => {
      const props = createMockProps({ searchQuery: 'sword' });
      render(<EquipmentSearchModal {...props} />);
      expect(screen.getByPlaceholderText('Search equipment...')).toHaveValue(
        'sword'
      );
    });

    it('should reflect the selected category in the combobox value', () => {
      const props = createMockProps({ selectedCategory: 'Armor' });
      render(<EquipmentSearchModal {...props} />);
      const select = screen.getByRole('combobox');
      expect(select.value).toBe('Armor');
    });
  });

  describe('interactions', () => {
    it('should call onSearchChange when user types in the search input', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} />);
      const searchInput = screen.getByPlaceholderText('Search equipment...');
      fireEvent.change(searchInput, { target: { value: 'dagger' } });
      expect(props.onSearchChange).toHaveBeenCalledWith('dagger');
    });

    it('should call onCategoryChange when a category is selected', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} />);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'Weapons' } });
      expect(props.onCategoryChange).toHaveBeenCalledWith('Weapons');
    });

    it('should call onShowOnlySelectedChange with the new checked state when checkbox is toggled', () => {
      const props = createMockProps({ showOnlySelected: false });
      render(<EquipmentSearchModal {...props} />);
      fireEvent.click(screen.getByRole('checkbox'));
      expect(props.onShowOnlySelectedChange).toHaveBeenCalledWith(true);
    });

    it('should call onEquipmentSelect with the clicked item', () => {
      const props = createMockProps({
        filteredEquipment: mockEquipment,
      });
      render(<EquipmentSearchModal {...props} />);
      fireEvent.click(screen.getByText('Club'));
      expect(props.onEquipmentSelect).toHaveBeenCalledWith(mockEquipment[0]);
    });

    it('should call onAddCustomItem with trimmed query when Enter is pressed', () => {
      const props = createMockProps({ searchQuery: '  sword  ' });
      render(<EquipmentSearchModal {...props} />);
      const searchInput = screen.getByPlaceholderText('Search equipment...');
      fireEvent.keyDown(searchInput, { key: 'Enter' });
      expect(props.onAddCustomItem).toHaveBeenCalledWith('sword');
    });

    it('should not call onAddCustomItem when Enter is pressed with empty searchQuery', () => {
      const props = createMockProps({ searchQuery: '' });
      render(<EquipmentSearchModal {...props} />);
      const searchInput = screen.getByPlaceholderText('Search equipment...');
      fireEvent.keyDown(searchInput, { key: 'Enter' });
      expect(props.onAddCustomItem).not.toHaveBeenCalled();
    });

    it('should not call onAddCustomItem when a non-Enter key is pressed', () => {
      const props = createMockProps({ searchQuery: 'custom item' });
      render(<EquipmentSearchModal {...props} />);
      const searchInput = screen.getByPlaceholderText('Search equipment...');
      fireEvent.keyDown(searchInput, { key: 'Tab' });
      expect(props.onAddCustomItem).not.toHaveBeenCalled();
    });

    it('should call onClose when the ✕ close button is clicked', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} />);
      fireEvent.click(screen.getByText('✕'));
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when the footer Close button is clicked', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} />);
      fireEvent.click(screen.getByText('Close'));
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('empty state messages', () => {
    it('should show "No matches found" when searchQuery exists but no results', () => {
      const props = createMockProps({
        searchQuery: 'nonexistent',
        filteredEquipment: [],
      });
      render(<EquipmentSearchModal {...props} />);
      expect(
        screen.getByText('No matches found. Press Enter to add as custom item.')
      ).toBeInTheDocument();
    });

    it('should show "Start typing" when no searchQuery and no results', () => {
      const props = createMockProps({
        searchQuery: '',
        filteredEquipment: [],
      });
      render(<EquipmentSearchModal {...props} />);
      expect(
        screen.getByText('Start typing to search equipment.')
      ).toBeInTheDocument();
    });

  });
});
