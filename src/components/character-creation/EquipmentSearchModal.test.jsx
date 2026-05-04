import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EquipmentSearchModal from './EquipmentSearchModal';

const mockEquipment = [
  {
    index: 'club',
    name: 'Club',
    equipment_category: 'Weapons',
    cost: { quantity: 1, unit: 'cp' },
    weight: 2
  },
  {
    index: 'dagger',
    name: 'Dagger',
    equipment_category: 'Weapons',
    cost: { quantity: 2, unit: 'gp' },
    weight: 1
  }
];

const createMockProps = () => ({
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
  uniqueCategories: ['All', 'Weapons', 'Armor']
});

describe('EquipmentSearchModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('does not render anything when showSearchModal is false', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} showSearchModal={false} />);
      expect(screen.queryByText('Select Equipment')).not.toBeInTheDocument();
    });

    it('renders modal when showSearchModal is true', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} />);
      expect(screen.getByText('Select Equipment')).toBeInTheDocument();
    });
  });

  describe('Search input', () => {
    it('displays current searchQuery value', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} searchQuery="club" />);
      expect(screen.getByPlaceholderText('Search equipment...')).toHaveValue('club');
    });

    it('calls onSearchChange when user types', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} />);
      const searchInput = screen.getByPlaceholderText('Search equipment...');
      fireEvent.change(searchInput, { target: { value: 'dagger' } });
      expect(props.onSearchChange).toHaveBeenCalledWith('dagger');
    });
  });

  describe('Category filters', () => {
    it('displays category buttons', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} />);
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Weapons')).toBeInTheDocument();
      expect(screen.getByText('Armor')).toBeInTheDocument();
    });

    it('highlights selected category', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} selectedCategory="Weapons" />);
      const weaponsButton = screen.getByText('Weapons');
      expect(weaponsButton).toHaveClass('active');
      const allButton = screen.getByText('All');
      expect(allButton).not.toHaveClass('active');
    });

    it('calls onCategoryChange when category button clicked', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} />);
      const weaponsButton = screen.getByText('Weapons');
      fireEvent.click(weaponsButton);
      expect(props.onCategoryChange).toHaveBeenCalledWith('Weapons');
    });
  });

  describe('Show only selected checkbox', () => {
    it('displays correct item count in label', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} currentItemCount={3} />);
      expect(screen.getByText(/Show Only Selected/)).toBeInTheDocument();
      expect(screen.getByText('3 selected)')).toBeInTheDocument();
    });

    it('calls onShowOnlySelectedChange when checkbox toggled', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} />);
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(props.onShowOnlySelectedChange).toHaveBeenCalledWith(true);
    });
  });

  describe('Equipment results', () => {
    it('displays equipment items when filteredEquipment has items', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} filteredEquipment={mockEquipment} />);
      expect(screen.getByText('Club')).toBeInTheDocument();
      expect(screen.getByText('Dagger')).toBeInTheDocument();
    });

    it('shows "No matches found" message when searchQuery exists but no results', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} searchQuery="nonexistent" filteredEquipment={[]} />);
      expect(screen.getByText('No matches found. Press Enter to add as custom item.')).toBeInTheDocument();
    });

    it('shows "Start typing to search" when no searchQuery and no results', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} searchQuery="" filteredEquipment={[]} />);
      expect(screen.getByText('Start typing to search equipment.')).toBeInTheDocument();
    });

    it('calls onEquipmentSelect when item is clicked', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} filteredEquipment={mockEquipment} />);
      const clubItem = screen.getByText('Club');
      fireEvent.click(clubItem);
      expect(props.onEquipmentSelect).toHaveBeenCalledWith(mockEquipment[0]);
    });
  });

  describe('Close button', () => {
    it('calls onClose when close button clicked', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} />);
      const closeButton = screen.getByText('✕');
      fireEvent.click(closeButton);
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Cancel button clicked', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} />);
      const cancelButton = screen.getByText('Close');
      fireEvent.click(cancelButton);
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Enter key (custom item)', () => {
    it('calls onAddCustomItem when Enter is pressed with searchQuery', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} searchQuery="custom item" />);
      const searchInput = screen.getByPlaceholderText('Search equipment...');
      fireEvent.keyDown(searchInput, { key: 'Enter' });
      expect(props.onAddCustomItem).toHaveBeenCalledWith('custom item');
    });

    it('does not call onAddCustomItem when Enter is pressed with empty searchQuery', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} searchQuery="" />);
      const searchInput = screen.getByPlaceholderText('Search equipment...');
      fireEvent.keyDown(searchInput, { key: 'Enter' });
      expect(props.onAddCustomItem).not.toHaveBeenCalled();
    });

    it('does not call onAddCustomItem when non-Enter key is pressed', () => {
      const props = createMockProps();
      render(<EquipmentSearchModal {...props} searchQuery="custom item" />);
      const searchInput = screen.getByPlaceholderText('Search equipment...');
      fireEvent.keyDown(searchInput, { key: 'Tab' });
      expect(props.onAddCustomItem).not.toHaveBeenCalled();
    });
  });
});
