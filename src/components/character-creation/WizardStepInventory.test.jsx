// @cleaned-by-ai
// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepInventory from './WizardStepInventory.jsx';

vi.mock('../../hooks/ui/useEquipmentSearch.js', () => ({
  useEquipmentSearch: vi.fn(),
}));

vi.mock('./EquipmentSearchModal.jsx', () => ({
  default: function MockEquipmentSearchModal({
    showSearchModal,
    onClose,
    filteredEquipment,
    onEquipmentSelect,
    currentItemCount = 0,
  }) {
    if (!showSearchModal) return null;
    return (
      <div className="equipment-search-modal-overlay" data-testid="equipment-search-modal">
        <div className="equipment-search-modal">
          <div className="search-modal-header">
            <h3>Select Equipment</h3>
            <button className="close-modal-btn" onClick={onClose}>
              ✕
            </button>
          </div>
          <div className="search-modal-body">
            <div className="equipment-results">
              {filteredEquipment.length === 0 ? (
                <div className="no-results">No results</div>
              ) : (
                filteredEquipment.map((item) => (
                  <div
                    key={item.index}
                    className="equipment-item"
                    onClick={() => onEquipmentSelect(item)}
                  >
                    <div className="equipment-item-name">{item.name}</div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="search-modal-footer">
            <span className="filter-checkbox-count">{currentItemCount} selected)</span>
          </div>
        </div>
      </div>
    );
  },
}));

import { useEquipmentSearch } from '../../hooks/ui/useEquipmentSearch.js';

const mockEquipment = [
  { index: 'club', name: 'Club', equipment_category: 'Weapons', cost: { quantity: 1, unit: 'cp' }, weight: 2 },
  { index: 'dagger', name: 'Dagger', equipment_category: 'Weapons', cost: { quantity: 2, unit: 'gp' }, weight: 1 },
];

const createMockHookReturn = (overrides = {}) => ({
  searchQuery: '',
  setSearchQuery: vi.fn(),
  filteredEquipment: [],
  selectedCategory: 'All',
  showOnlySelectedBackpack: false,
  setShowOnlySelectedBackpack: vi.fn(),
  showOnlySelectedEquipped: false,
  setShowOnlySelectedEquipped: vi.fn(),
  searchField: null,
  setSearchField: vi.fn(),
  handleEquipmentSelect: vi.fn(),
  handleAddCustomItem: vi.fn(),
  handleCategoryChange: vi.fn(),
  handleSearchFieldFocus: vi.fn(),
  uniqueCategories: ['All', 'Weapons', 'Armor'],
  ...overrides,
});

const createMockProps = (overrides = {}) => ({
  formData: { inventory: { gold: 15 } },
  tempInventory: { backpack: ['Rope', 'Torch'], equipped: ['Longsword', 'Chain mail'] },
  onInventoryChange: vi.fn(),
  onTempInventoryChange: vi.fn(),
  ...overrides,
});

describe('WizardStepInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEquipmentSearch.mockReturnValue(createMockHookReturn());
  });

  describe('rendering', () => {
    it('should render the step header, gold input, textareas, and search buttons', () => {
      const props = createMockProps();
      render(<WizardStepInventory {...props} />);
      expect(screen.getByText('Step 11: Inventory')).toBeInTheDocument();
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
      expect(screen.getAllByRole('textbox')).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: /Search Equipment/ })).toHaveLength(2);
      expect(screen.getByText('Backpack Items')).toBeInTheDocument();
      expect(screen.getByText('Equipped Items')).toBeInTheDocument();
    });
  });

  describe('gold input', () => {
    it('should display the initial gold value from formData.inventory.gold', () => {
      const props = createMockProps({ formData: { inventory: { gold: 50 } } });
      render(<WizardStepInventory {...props} />);
      expect(screen.getByRole('spinbutton')).toHaveValue(50);
    });

    it('should call onInventoryChange with the parsed integer when gold changes', () => {
      const onInventoryChange = vi.fn();
      const props = createMockProps({ onInventoryChange });
      render(<WizardStepInventory {...props} />);
      const goldInput = screen.getByRole('spinbutton');
      fireEvent.change(goldInput, { target: { value: '100' } });
      expect(onInventoryChange).toHaveBeenCalledWith('gold', 100);
    });

    it('should call onInventoryChange with 0 when gold input is non-numeric or empty', () => {
      const onInventoryChange = vi.fn();
      const props = createMockProps({ onInventoryChange });
      render(<WizardStepInventory {...props} />);
      const goldInput = screen.getByRole('spinbutton');

      fireEvent.change(goldInput, { target: { value: '' } });
      expect(onInventoryChange).toHaveBeenCalledWith('gold', 0);

      vi.mocked(onInventoryChange).mockClear();
      fireEvent.change(goldInput, { target: { value: 'abc' } });
      expect(onInventoryChange).toHaveBeenCalledWith('gold', 0);
    });
  });

  describe('textarea blur commits items', () => {
    it('should split comma-separated items and commit them on blur', () => {
      const onInventoryChange = vi.fn();
      const onTempInventoryChange = vi.fn();
      const props = createMockProps({
        tempInventory: { backpack: [], equipped: [] },
        onInventoryChange,
        onTempInventoryChange,
      });
      render(<WizardStepInventory {...props} />);

      const backpackTextarea = screen.getAllByRole('textbox')[0];
      fireEvent.change(backpackTextarea, { target: { value: 'Drums, Guitar' } });
      fireEvent.blur(backpackTextarea);

      expect(onTempInventoryChange).toHaveBeenCalledWith('backpack', ['Drums', 'Guitar']);
      expect(onInventoryChange).toHaveBeenCalledWith('backpack', ['Drums', 'Guitar']);
    });

    it('should trim whitespace and filter empty items when splitting on commas', () => {
      const onInventoryChange = vi.fn();
      const onTempInventoryChange = vi.fn();
      const props = createMockProps({
        tempInventory: { backpack: [], equipped: [] },
        onInventoryChange,
        onTempInventoryChange,
      });
      render(<WizardStepInventory {...props} />);

      const backpackTextarea = screen.getAllByRole('textbox')[0];
      fireEvent.change(backpackTextarea, { target: { value: ', Rope, , Torch,' } });
      fireEvent.blur(backpackTextarea);

      expect(onTempInventoryChange).toHaveBeenCalledWith('backpack', ['Rope', 'Torch']);
      expect(onInventoryChange).toHaveBeenCalledWith('backpack', ['Rope', 'Torch']);
    });

    it('should commit an empty array when blur clears or whitespace-only the textarea', () => {
      const onInventoryChange = vi.fn();
      const onTempInventoryChange = vi.fn();
      const props = createMockProps({
        tempInventory: { backpack: ['Rope'], equipped: [] },
        onInventoryChange,
        onTempInventoryChange,
      });
      render(<WizardStepInventory {...props} />);

      const backpackTextarea = screen.getAllByRole('textbox')[0];
      fireEvent.change(backpackTextarea, { target: { value: '' } });
      fireEvent.blur(backpackTextarea);
      expect(onTempInventoryChange).toHaveBeenCalledWith('backpack', []);
      expect(onInventoryChange).toHaveBeenCalledWith('backpack', []);
    });

    it('should commit items from the equipped textarea on blur', () => {
      const onInventoryChange = vi.fn();
      const onTempInventoryChange = vi.fn();
      const props = createMockProps({
        tempInventory: { backpack: [], equipped: [] },
        onInventoryChange,
        onTempInventoryChange,
      });
      render(<WizardStepInventory {...props} />);

      const equippedTextarea = screen.getAllByRole('textbox')[1];
      fireEvent.change(equippedTextarea, { target: { value: 'Longsword, Shield' } });
      fireEvent.blur(equippedTextarea);

      expect(onTempInventoryChange).toHaveBeenCalledWith('equipped', ['Longsword', 'Shield']);
      expect(onInventoryChange).toHaveBeenCalledWith('equipped', ['Longsword', 'Shield']);
    });
  });

  describe('textarea Enter key commits items', () => {
    it('should split and commit comma-separated items when Enter is pressed', () => {
      const onInventoryChange = vi.fn();
      const onTempInventoryChange = vi.fn();
      const props = createMockProps({
        tempInventory: { backpack: [], equipped: [] },
        onInventoryChange,
        onTempInventoryChange,
      });
      render(<WizardStepInventory {...props} />);

      const backpackTextarea = screen.getAllByRole('textbox')[0];
      fireEvent.change(backpackTextarea, { target: { value: 'Dagger, Arrow' } });
      fireEvent.keyDown(backpackTextarea, { key: 'Enter' });

      expect(onTempInventoryChange).toHaveBeenCalledWith('backpack', ['Dagger', 'Arrow']);
      expect(onInventoryChange).toHaveBeenCalledWith('backpack', ['Dagger', 'Arrow']);
    });

    it('should not commit items when Shift+Enter is pressed', () => {
      const onInventoryChange = vi.fn();
      const onTempInventoryChange = vi.fn();
      const props = createMockProps({
        tempInventory: { backpack: [], equipped: [] },
        onInventoryChange,
        onTempInventoryChange,
      });
      render(<WizardStepInventory {...props} />);

      const backpackTextarea = screen.getAllByRole('textbox')[0];
      fireEvent.change(backpackTextarea, { target: { value: 'Dagger, Arrow' } });
      fireEvent.keyDown(backpackTextarea, { key: 'Enter', shiftKey: true });

      expect(onInventoryChange).not.toHaveBeenCalled();
      expect(onTempInventoryChange).not.toHaveBeenCalled();
    });
  });

  describe('item preview', () => {
    it('should display item tags, counts, and overflow indicator', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope', 'Torch', 'Rations', 'Dagger', 'Shield', 'Potion', 'Map'], equipped: ['Longsword'] },
      });
      render(<WizardStepInventory {...props} />);

      expect(screen.getByText('Rope')).toBeInTheDocument();
      expect(screen.getByText('Torch')).toBeInTheDocument();
      expect(screen.getByText('7 items')).toBeInTheDocument();
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('should display singular item count for a single item', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope'], equipped: [] },
      });
      render(<WizardStepInventory {...props} />);
      expect(screen.getByText('1 item')).toBeInTheDocument();
    });

    it('should not render the preview container when there are no items', () => {
      const { container } = render(
        <WizardStepInventory
          {...createMockProps({
            tempInventory: { backpack: [], equipped: [] },
          })}
        />
      );
      expect(container.querySelector('.inventory-items-preview')).not.toBeInTheDocument();
    });
  });

  describe('search button interaction', () => {
    it('should call handleSearchFieldFocus with the correct field when search button is clicked', () => {
      const handleSearchFieldFocus = vi.fn();
      useEquipmentSearch.mockReturnValue(createMockHookReturn({
        searchField: null,
        handleSearchFieldFocus,
      }));

      const props = createMockProps();
      render(<WizardStepInventory {...props} />);

      const buttons = screen.getAllByRole('button', { name: /Search Equipment/ });
      fireEvent.click(buttons[0]);
      expect(handleSearchFieldFocus).toHaveBeenCalledWith('backpack');

      fireEvent.click(buttons[1]);
      expect(handleSearchFieldFocus).toHaveBeenCalledWith('equipped');
    });
  });

  describe('EquipmentSearchModal', () => {
    it('should render the modal when searchField is set', () => {
      useEquipmentSearch.mockReturnValue(createMockHookReturn({
        searchField: 'backpack',
      }));
      const props = createMockProps();
      render(<WizardStepInventory {...props} />);
      expect(screen.getByTestId('equipment-search-modal')).toBeInTheDocument();
    });

    it('should not render the modal when searchField is null', () => {
      useEquipmentSearch.mockReturnValue(createMockHookReturn({
        searchField: null,
      }));
      const props = createMockProps();
      render(<WizardStepInventory {...props} />);
      expect(screen.queryByTestId('equipment-search-modal')).not.toBeInTheDocument();
    });

    it('should call setSearchField and setSearchQuery when close button is clicked', () => {
      const setSearchField = vi.fn();
      const setSearchQuery = vi.fn();
      useEquipmentSearch.mockReturnValue(createMockHookReturn({
        searchField: 'backpack',
        setSearchField,
        setSearchQuery,
      }));

      const props = createMockProps();
      render(<WizardStepInventory {...props} />);

      fireEvent.click(screen.getByText('✕'));
      expect(setSearchField).toHaveBeenCalledWith(null);
      expect(setSearchQuery).toHaveBeenCalledWith('');
    });

    it('should render equipment items and call onEquipmentSelect when clicked', () => {
      const handleEquipmentSelect = vi.fn();
      useEquipmentSearch.mockReturnValue(createMockHookReturn({
        searchField: 'backpack',
        filteredEquipment: mockEquipment,
        handleEquipmentSelect,
      }));

      const props = createMockProps();
      render(<WizardStepInventory {...props} />);

      expect(screen.getByText('Club')).toBeInTheDocument();
      expect(screen.getByText('Dagger')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Club'));
      expect(handleEquipmentSelect).toHaveBeenCalledWith(mockEquipment[0]);
    });

    it('should pass the correct currentItemCount based on the active field', () => {
      useEquipmentSearch.mockReturnValue(createMockHookReturn({
        searchField: 'backpack',
      }));

      const props = createMockProps({
        tempInventory: { backpack: ['Rope', 'Torch'], equipped: ['Sword'] },
      });
      render(<WizardStepInventory {...props} />);
      expect(screen.getByText('2 selected)')).toBeInTheDocument();
    });
  });
});
