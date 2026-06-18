// @improved-by-ai
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
    it('should not render anything when showSearchModal is false', () => {
      const props = createMockProps({ showSearchModal: false });
      const { container } = render(<EquipmentSearchModal {...props} />);
      expect(container.innerHTML).toBe('');
      expect(screen.queryByText('Select Equipment')).not.toBeInTheDocument();
    });

    it('should render the modal overlay and header when showSearchModal is true', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} />);
      expect(screen.getByText('Select Equipment')).toBeInTheDocument();
      expect(screen.getByText('✕')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('should render category filter buttons from uniqueCategories', () => {
      const props = createMockProps({
        uniqueCategories: ['All', 'Weapons', 'Armor', 'Potions'],
      });
      render(<EquipmentSearchModal {...props} />);
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Weapons')).toBeInTheDocument();
      expect(screen.getByText('Armor')).toBeInTheDocument();
      expect(screen.getByText('Potions')).toBeInTheDocument();
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
      expect(screen.getAllByText('Weapons').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Armor').length).toBeGreaterThan(0);
      expect(screen.getByText('1 cp')).toBeInTheDocument();
      expect(screen.getByText('2 gp')).toBeInTheDocument();
      expect(screen.getAllByText('10 gp').length).toBeGreaterThan(0);
      expect(screen.getByText('2 lb')).toBeInTheDocument();
      expect(screen.getByText('1 lb')).toBeInTheDocument();
      expect(screen.getByText('12 lb')).toBeInTheDocument();
    });

    it('should not render weight span when item has no weight', () => {
      const props = createMockProps({
        filteredEquipment: [mockEquipment[3]],
      });
      render(<EquipmentSearchModal {...props} />);
      const shieldItem = screen.getByText('Shield').closest('.equipment-item');
      expect(shieldItem).not.toContainElement(
        screen.queryByText(/lb/)
      );
    });

    it('should not render cost when item has no cost property', () => {
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
      expect(screen.queryByText('0 ')).not.toBeInTheDocument();
    });
  });

  describe('initial state', () => {
    it('should have the search input unchecked by default', () => {
      const props = createMockProps({ showOnlySelected: false });
      render(<EquipmentSearchModal {...props} />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
    });

    it('should reflect showOnlySelected value in checkbox state', () => {
      const props = createMockProps({ showOnlySelected: true });
      render(<EquipmentSearchModal {...props} />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('should display search query value in the input', () => {
      const props = createMockProps({ searchQuery: 'sword' });
      render(<EquipmentSearchModal {...props} />);
      expect(screen.getByPlaceholderText('Search equipment...')).toHaveValue(
        'sword'
      );
    });

    it('should highlight the selected category button', () => {
      const props = createMockProps({ selectedCategory: 'Armor' });
      render(<EquipmentSearchModal {...props} />);
      const armorButton = screen.getByText('Armor');
      expect(armorButton).toHaveClass('active');
      const allButton = screen.getByText('All');
      expect(allButton).not.toHaveClass('active');
    });

    it('should default to All category when selectedCategory is not provided', () => {
      const props = createMockProps({ selectedCategory: 'All' });
      render(<EquipmentSearchModal {...props} />);
      const allButton = screen.getByText('All');
      expect(allButton).toHaveClass('active');
    });
  });

  describe('search interaction', () => {
    it('should call onSearchChange when user types in the search input', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} />);
      const searchInput = screen.getByPlaceholderText('Search equipment...');
      fireEvent.change(searchInput, { target: { value: 'dagger' } });
      expect(props.onSearchChange).toHaveBeenCalledWith('dagger');
    });

    it('should call onSearchChange with empty string when input is cleared', () => {
      const props = createMockProps({ searchQuery: 'sword' });
      render(<EquipmentSearchModal {...props} />);
      const searchInput = screen.getByPlaceholderText('Search equipment...');
      fireEvent.change(searchInput, { target: { value: '' } });
      expect(props.onSearchChange).toHaveBeenCalledWith('');
    });
  });

  describe('category filter interaction', () => {
    it('should call onCategoryChange with the selected category when a button is clicked', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} />);
      const weaponsButton = screen.getByText('Weapons');
      fireEvent.click(weaponsButton);
      expect(props.onCategoryChange).toHaveBeenCalledWith('Weapons');
    });

    it('should call onCategoryChange with All when All button is clicked', () => {
      const props = createMockProps({ selectedCategory: 'Weapons' });
      render(<EquipmentSearchModal {...props} />);
      const allButton = screen.getByText('All');
      fireEvent.click(allButton);
      expect(props.onCategoryChange).toHaveBeenCalledWith('All');
    });
  });

  describe('show-only-selected checkbox interaction', () => {
    it('should call onShowOnlySelectedChange with true when checkbox is checked', () => {
      const props = createMockProps({ showOnlySelected: false });
      render(<EquipmentSearchModal {...props} />);
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(props.onShowOnlySelectedChange).toHaveBeenCalledWith(true);
    });

    it('should call onShowOnlySelectedChange with false when checkbox is unchecked', () => {
      const props = createMockProps({ showOnlySelected: true });
      render(<EquipmentSearchModal {...props} />);
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(props.onShowOnlySelectedChange).toHaveBeenCalledWith(false);
    });
  });

  describe('equipment selection', () => {
    it('should call onEquipmentSelect with the correct item when an equipment item is clicked', () => {
      const props = createMockProps({
        filteredEquipment: mockEquipment,
      });
      render(<EquipmentSearchModal {...props} />);
      const clubItem = screen.getByText('Club');
      fireEvent.click(clubItem);
      expect(props.onEquipmentSelect).toHaveBeenCalledWith(mockEquipment[0]);
    });

    it('should call onEquipmentSelect with the second item when clicked', () => {
      const props = createMockProps({
        filteredEquipment: mockEquipment,
      });
      render(<EquipmentSearchModal {...props} />);
      const daggerItem = screen.getByText('Dagger');
      fireEvent.click(daggerItem);
      expect(props.onEquipmentSelect).toHaveBeenCalledWith(mockEquipment[1]);
    });
  });

  describe('custom item creation via Enter key', () => {
    it('should call onAddCustomItem when Enter is pressed with a non-empty searchQuery', () => {
      const props = createMockProps({ searchQuery: 'custom item' });
      render(<EquipmentSearchModal {...props} />);
      const searchInput = screen.getByPlaceholderText('Search equipment...');
      fireEvent.keyDown(searchInput, { key: 'Enter' });
      expect(props.onAddCustomItem).toHaveBeenCalledWith('custom item');
    });

    it('should trim whitespace from searchQuery before calling onAddCustomItem', () => {
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

    it('should not call onAddCustomItem when Enter is pressed with whitespace-only searchQuery', () => {
      const props = createMockProps({ searchQuery: '   ' });
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

    it('should not call onAddCustomItem when Escape is pressed', () => {
      const props = createMockProps({ searchQuery: 'custom item' });
      render(<EquipmentSearchModal {...props} />);
      const searchInput = screen.getByPlaceholderText('Search equipment...');
      fireEvent.keyDown(searchInput, { key: 'Escape' });
      expect(props.onAddCustomItem).not.toHaveBeenCalled();
    });
  });

  describe('close behavior', () => {
    it('should call onClose when the close (✕) button in the header is clicked', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} />);
      const closeButton = screen.getByText('✕');
      fireEvent.click(closeButton);
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when the Cancel button in the footer is clicked', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} />);
      const cancelButton = screen.getByText('Close');
      fireEvent.click(cancelButton);
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose exactly once even when both close buttons are clicked', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} />);
      fireEvent.click(screen.getByText('✕'));
      fireEvent.click(screen.getByText('Close'));
      expect(props.onClose).toHaveBeenCalledTimes(2);
    });
  });

  describe('empty state messages', () => {
    it('should show "No matches found" message when searchQuery exists but no results', () => {
      const props = createMockProps({
        searchQuery: 'nonexistent',
        filteredEquipment: [],
      });
      render(<EquipmentSearchModal {...props} />);
      expect(
        screen.getByText('No matches found. Press Enter to add as custom item.')
      ).toBeInTheDocument();
    });

    it('should show "Start typing" message when no searchQuery and no results', () => {
      const props = createMockProps({
        searchQuery: '',
        filteredEquipment: [],
      });
      render(<EquipmentSearchModal {...props} />);
      expect(
        screen.getByText('Start typing to search equipment.')
      ).toBeInTheDocument();
    });

    it('should not show "No matches found" when there are results even with searchQuery', () => {
      const props = createMockProps({
        searchQuery: 'club',
        filteredEquipment: [mockEquipment[0]],
      });
      render(<EquipmentSearchModal {...props} />);
      expect(screen.getByText('Club')).toBeInTheDocument();
      expect(
        screen.queryByText('No matches found. Press Enter to add as custom item.')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Start typing to search equipment.')
      ).not.toBeInTheDocument();
    });
  });

  describe('default props', () => {
    it('should use ["All"] as default uniqueCategories when not provided', () => {
      const props = createMockProps();
      // eslint-disable-next-line no-unused-vars
      const { uniqueCategories, ...rest } = props;
      render(<EquipmentSearchModal {...rest} />);
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.queryByText('Weapons')).not.toBeInTheDocument();
      expect(screen.queryByText('Armor')).not.toBeInTheDocument();
    });
  });
});
