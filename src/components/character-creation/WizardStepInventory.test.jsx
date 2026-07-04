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
    _searchField,
    onClose,
    filteredEquipment,
    searchQuery,
    onSearchChange,
    selectedCategory,
    onCategoryChange,
    showOnlySelected,
    onShowOnlySelectedChange,
    onEquipmentSelect,
    onAddCustomItem,
    currentItemCount,
    uniqueCategories = ['All'],
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
            <div className="category-filters">
              {uniqueCategories.map((category, idx) => (
                <button
                  key={`category-${idx}`}
                  className={`category-filter-btn ${selectedCategory === category ? 'active' : ''}`}
                  onClick={() => onCategoryChange(category)}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="search-input-container">
              <input
                type="text"
                className="search-input"
                placeholder="Search equipment..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    onAddCustomItem(searchQuery.trim());
                  }
                }}
                autoFocus
              />
            </div>
            <div className="filter-checkbox-group">
              <label className="filter-checkbox-label">
                <input
                  type="checkbox"
                  checked={showOnlySelected}
                  onChange={(e) => onShowOnlySelectedChange(e.target.checked)}
                />
                Show Only Selected&nbsp;(
              </label>
              <span className="filter-checkbox-count">
                {currentItemCount} selected)
              </span>
            </div>
            <div className="equipment-results">
              {filteredEquipment.length === 0 && searchQuery ? (
                <div className="no-results">
                  No matches found. Press Enter to add as custom item.
                </div>
              ) : filteredEquipment.length === 0 ? (
                <div className="no-results">
                  Start typing to search equipment.
                </div>
              ) : (
                filteredEquipment.map((item) => (
                  <div
                    key={item.index}
                    className="equipment-item"
                    onClick={() => onEquipmentSelect(item)}
                  >
                    <div className="equipment-item-name">{item.name}</div>
                    <div className="equipment-item-details">
                      <span className="equipment-item-category">
                        {item.equipment_category}
                      </span>
                      <span className="equipment-item-cost">
                        {item.cost?.quantity} {item.cost?.unit}
                      </span>
                      {item.weight && <span className="equipment-item-weight">{item.weight} lb</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="search-modal-footer">
            <button className="cancel-btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  },
}));

import { useEquipmentSearch } from '../../hooks/ui/useEquipmentSearch.js';

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
  formData: {
    inventory: {
      gold: 15,
    },
  },
  tempInventory: {
    backpack: ['Rope', 'Torch'],
    equipped: ['Longsword', 'Chain mail'],
  },
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
      const props = createMockProps({
        formData: { inventory: { gold: 50 } },
      });
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

  describe('textarea raw text behavior', () => {
    it('should not commit items during typing', () => {
      const onInventoryChange = vi.fn();
      const onTempInventoryChange = vi.fn();
      const props = createMockProps({
        tempInventory: { backpack: [], equipped: [] },
        onInventoryChange,
        onTempInventoryChange,
      });
      render(<WizardStepInventory {...props} />);

      const backpackTextarea = screen.getAllByRole('textbox')[0];
      fireEvent.change(backpackTextarea, { target: { value: 'Drums,Guitar' } });

      expect(onInventoryChange).not.toHaveBeenCalled();
      expect(onTempInventoryChange).not.toHaveBeenCalled();
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

      vi.mocked(onTempInventoryChange).mockClear();
      vi.mocked(onInventoryChange).mockClear();

      fireEvent.change(backpackTextarea, { target: { value: '   ' } });
      fireEvent.blur(backpackTextarea);
      expect(onTempInventoryChange).toHaveBeenCalledWith('backpack', []);
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
  });

  describe('item preview', () => {
    it('should display item tags for backpack and equipped items', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope', 'Torch', 'Rations'], equipped: ['Longsword', 'Shield'] },
      });
      render(<WizardStepInventory {...props} />);

      expect(screen.getByText('Rope')).toBeInTheDocument();
      expect(screen.getByText('Torch')).toBeInTheDocument();
      expect(screen.getByText('Rations')).toBeInTheDocument();
      expect(screen.getByText('Longsword')).toBeInTheDocument();
      expect(screen.getByText('Shield')).toBeInTheDocument();
    });

    it('should display correct singular/plural item counts', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope'], equipped: [] },
      });
      render(<WizardStepInventory {...props} />);
      expect(screen.getByText('1 item')).toBeInTheDocument();
    });

    it('should display plural item counts', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope', 'Torch'], equipped: [] },
      });
      render(<WizardStepInventory {...props} />);
      expect(screen.getByText('2 items')).toBeInTheDocument();
    });

    it('should show "+N more" when there are more than 5 items', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope', 'Torch', 'Rations', 'Dagger', 'Shield', 'Potion', 'Map'], equipped: [] },
      });
      render(<WizardStepInventory {...props} />);
      expect(screen.getByText('+2 more')).toBeInTheDocument();
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

  describe('focus behavior and raw text sync', () => {
    it('should commit items on blur and sync raw text from items when no field is focused', () => {
      const onInventoryChange = vi.fn();
      const onTempInventoryChange = vi.fn();
      const props = createMockProps({
        tempInventory: { backpack: [], equipped: [] },
        onInventoryChange,
        onTempInventoryChange,
      });
      render(<WizardStepInventory {...props} />);

      const textarea = screen.getAllByRole('textbox')[0];
      fireEvent.focus(textarea);
      fireEvent.change(textarea, { target: { value: 'Rope, Torch' } });
      fireEvent.blur(textarea);

      expect(onTempInventoryChange).toHaveBeenCalledWith('backpack', ['Rope', 'Torch']);
      expect(onInventoryChange).toHaveBeenCalledWith('backpack', ['Rope', 'Torch']);
    });

    it('should sync raw text from items when no field is focused', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope', 'Torch'], equipped: ['Longsword', 'Shield'] },
      });
      render(<WizardStepInventory {...props} />);

      const [backpackTextarea, equippedTextarea] = screen.getAllByRole('textbox');
      expect(backpackTextarea).toHaveValue('Rope, Torch');
      expect(equippedTextarea).toHaveValue('Longsword, Shield');
    });

    it('should update textarea when items change and no field is focused', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope'], equipped: [] },
      });
      const { rerender } = render(<WizardStepInventory {...props} />);

      const textarea = screen.getAllByRole('textbox')[0];
      expect(textarea).toHaveValue('Rope');

      rerender(
        <WizardStepInventory
          {...{
            ...props,
            tempInventory: { backpack: ['Rope', 'Torch', 'Rations'], equipped: [] },
          }}
        />
      );

      expect(textarea).toHaveValue('Rope, Torch, Rations');
    });

    it('should not update textarea when the field is currently focused', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope'], equipped: [] },
      });
      const { rerender } = render(<WizardStepInventory {...props} />);

      const textarea = screen.getAllByRole('textbox')[0];
      fireEvent.focus(textarea);
      expect(textarea).toHaveValue('Rope');

      rerender(
        <WizardStepInventory
          {...{
            ...props,
            tempInventory: { backpack: ['Rope', 'Torch'], equipped: [] },
          }}
        />
      );

      expect(textarea).toHaveValue('Rope');
    });
  });
});
