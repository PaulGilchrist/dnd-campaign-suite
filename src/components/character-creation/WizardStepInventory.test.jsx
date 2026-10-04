// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepInventory from './WizardStepInventory.jsx';

vi.mock('../../hooks/ui/useEquipmentSearch.js', () => ({
  useEquipmentSearch: vi.fn(),
}));

vi.mock('./EquipmentSearchModal.jsx', () => ({
  default: function EquipmentSearchModal({
    showSearchModal,
    onClose,
    filteredEquipment,
    searchQuery,
    onSearchChange,
    selectedCategory,
    onCategoryChange,
    showOnlySelected,
    onShowOnlySelectedChange,
    onEquipmentSelect,
    onAddCustomItem: _onAddCustomItem,
    currentItemCount = 0,
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
              <select
                className="category-select"
                value={selectedCategory}
                onChange={(e) => onCategoryChange(e.target.value)}
              >
                {uniqueCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="search-input-container">
              <input
                type="text"
                className="search-input"
                placeholder="Search equipment..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
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
                      {item.weight && (
                        <span className="equipment-item-weight">
                          {item.weight} lb
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="search-modal-footer">
            <button className="cancel-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  },
}));

import { useEquipmentSearch } from '../../hooks/ui/useEquipmentSearch.js';

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
    it('renders header, gold input, textareas, search buttons, and section labels', () => {
      render(<WizardStepInventory {...createMockProps()} />);
      expect(screen.getByText('Step 11: Inventory')).toBeInTheDocument();
      expect(screen.getByRole('spinbutton', { name: /Gold Pieces/i })).toBeInTheDocument();
      expect(screen.getAllByRole('textbox')).toHaveLength(4);
      expect(
        screen.getAllByRole('button', { name: /Search Equipment/ })
      ).toHaveLength(2);
      expect(screen.getByText('Backpack Items')).toBeInTheDocument();
      expect(screen.getByText('Equipped Items')).toBeInTheDocument();
    });
  });

  describe('gold input', () => {
    it('displays the initial gold value from formData.inventory.gold', () => {
      const props = createMockProps({
        formData: { inventory: { gold: 50 } },
      });
      render(<WizardStepInventory {...props} />);
      expect(screen.getByRole('spinbutton', { name: /Gold Pieces/i })).toHaveValue(50);
    });

    it('calls onInventoryChange with parsed integer when gold changes', () => {
      const onInventoryChange = vi.fn();
      const props = createMockProps({ onInventoryChange });
      render(<WizardStepInventory {...props} />);
      const goldInput = screen.getByRole('spinbutton', { name: /Gold Pieces/i });
      fireEvent.change(goldInput, { target: { value: '100' } });
      expect(onInventoryChange).toHaveBeenCalledWith('gold', 100);
    });

    it('calls onInventoryChange with 0 for empty, non-numeric, or decimal input', () => {
      const onInventoryChange = vi.fn();
      const props = createMockProps({ onInventoryChange });
      render(<WizardStepInventory {...props} />);
      const goldInput = screen.getByRole('spinbutton', { name: /Gold Pieces/i });

      fireEvent.change(goldInput, { target: { value: '' } });
      expect(onInventoryChange).toHaveBeenCalledWith('gold', 0);

      vi.mocked(onInventoryChange).mockClear();
      fireEvent.change(goldInput, { target: { value: 'abc' } });
      expect(onInventoryChange).toHaveBeenCalledWith('gold', 0);

      vi.mocked(onInventoryChange).mockClear();
      fireEvent.change(goldInput, { target: { value: '10.5' } });
      expect(onInventoryChange).toHaveBeenCalledWith('gold', 10);
    });

    it('renders null for gold input when formData.inventory.gold is undefined', () => {
      const props = createMockProps({
        formData: { inventory: {} },
      });
      render(<WizardStepInventory {...props} />);
      expect(screen.getByRole('spinbutton', { name: /Gold Pieces/i })).toHaveValue(null);
    });
  });

  describe('textarea commits items on blur and Enter', () => {
    it('splits comma-separated items and commits them on blur', () => {
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

      expect(onTempInventoryChange).toHaveBeenCalledWith(
        'backpack',
        ['Drums', 'Guitar']
      );
      expect(onInventoryChange).toHaveBeenCalledWith('backpack', [
        'Drums',
        'Guitar',
      ]);
    });

    it('trims whitespace and filters empty items when splitting on commas', () => {
      const onInventoryChange = vi.fn();
      const onTempInventoryChange = vi.fn();
      const props = createMockProps({
        tempInventory: { backpack: [], equipped: [] },
        onInventoryChange,
        onTempInventoryChange,
      });
      render(<WizardStepInventory {...props} />);

      const backpackTextarea = screen.getAllByRole('textbox')[0];
      fireEvent.change(backpackTextarea, {
        target: { value: ', Rope, , Torch,' },
      });
      fireEvent.blur(backpackTextarea);

      expect(onTempInventoryChange).toHaveBeenCalledWith(
        'backpack',
        ['Rope', 'Torch']
      );
      expect(onInventoryChange).toHaveBeenCalledWith('backpack', [
        'Rope',
        'Torch',
      ]);
    });

    it('commits an empty array when blur results in empty text', () => {
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

    it('commits items from the equipped textarea on blur', () => {
      const onInventoryChange = vi.fn();
      const onTempInventoryChange = vi.fn();
      const props = createMockProps({
        tempInventory: { backpack: [], equipped: [] },
        onInventoryChange,
        onTempInventoryChange,
      });
      render(<WizardStepInventory {...props} />);

      const equippedTextarea = screen.getAllByRole('textbox')[1];
      fireEvent.change(equippedTextarea, {
        target: { value: 'Longsword, Shield' },
      });
      fireEvent.blur(equippedTextarea);

      expect(onTempInventoryChange).toHaveBeenCalledWith(
        'equipped',
        ['Longsword', 'Shield']
      );
      expect(onInventoryChange).toHaveBeenCalledWith('equipped', [
        'Longsword',
        'Shield',
      ]);
    });

    it('commits items when Enter is pressed but not when Shift+Enter is pressed', () => {
      const onInventoryChange = vi.fn();
      const onTempInventoryChange = vi.fn();
      const props = createMockProps({
        tempInventory: { backpack: [], equipped: [] },
        onInventoryChange,
        onTempInventoryChange,
      });
      render(<WizardStepInventory {...props} />);

      const backpackTextarea = screen.getAllByRole('textbox')[0];

      // Enter key commits
      fireEvent.change(backpackTextarea, {
        target: { value: 'Dagger, Arrow' },
      });
      fireEvent.keyDown(backpackTextarea, { key: 'Enter' });

      expect(onTempInventoryChange).toHaveBeenCalledWith(
        'backpack',
        ['Dagger', 'Arrow']
      );
      expect(onInventoryChange).toHaveBeenCalledWith('backpack', [
        'Dagger',
        'Arrow',
      ]);

      vi.mocked(onInventoryChange).mockClear();
      vi.mocked(onTempInventoryChange).mockClear();

      // Shift+Enter does not commit
      fireEvent.change(backpackTextarea, {
        target: { value: 'Sword, Shield' },
      });
      fireEvent.keyDown(backpackTextarea, { key: 'Enter', shiftKey: true });

      expect(onInventoryChange).not.toHaveBeenCalled();
      expect(onTempInventoryChange).not.toHaveBeenCalled();
    });
  });

  describe('item preview', () => {
    it('displays item tags, counts, and overflow indicator for 6+ items', () => {
      const props = createMockProps({
        tempInventory: {
          backpack: [
            'Rope',
            'Torch',
            'Rations',
            'Dagger',
            'Shield',
            'Potion',
            'Map',
          ],
          equipped: ['Longsword'],
        },
      });
      render(<WizardStepInventory {...props} />);

      expect(screen.getAllByText('Rope').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Torch').length).toBeGreaterThan(0);
      expect(screen.getByText('7 items')).toBeInTheDocument();
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('displays singular item count for a single item', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope'], equipped: [] },
      });
      render(<WizardStepInventory {...props} />);
      expect(screen.getByText('1 item')).toBeInTheDocument();
    });

    it('does not render the preview container when there are no items', () => {
      const { container } = render(
        <WizardStepInventory
          {...createMockProps({
            tempInventory: { backpack: [], equipped: [] },
          })}
        />
      );
      expect(
        container.querySelector('.inventory-items-preview')
      ).not.toBeInTheDocument();
    });
  });

  describe('raw text sync and focusedField behavior', () => {
    it('syncs raw text from tempInventory when items change externally and no field is focused', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope'], equipped: [] },
      });
      const { rerender } = render(<WizardStepInventory {...props} />);

      const backpackTextarea = screen.getAllByRole('textbox')[0];
      expect(backpackTextarea).toHaveValue('Rope');

      rerender(
        <WizardStepInventory
          {...props}
          tempInventory={{ backpack: ['Rope', 'Torch'], equipped: [] }}
        />
      );

      expect(backpackTextarea).toHaveValue('Rope, Torch');
    });

    it('does not sync raw text when the field currently has focus', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope'], equipped: [] },
      });
      const { rerender } = render(<WizardStepInventory {...props} />);

      const backpackTextarea = screen.getAllByRole('textbox')[0];
      fireEvent.focus(backpackTextarea);
      fireEvent.change(backpackTextarea, {
        target: { value: 'Custom Item' },
      });

      rerender(
        <WizardStepInventory
          {...props}
          tempInventory={{ backpack: ['Rope', 'Torch'], equipped: [] }}
        />
      );

      expect(backpackTextarea).toHaveValue('Custom Item');
    });
  });

  describe('search button interaction', () => {
    it('calls handleSearchFieldFocus with the correct field when search button is clicked', () => {
      const handleSearchFieldFocus = vi.fn();
      useEquipmentSearch.mockReturnValue(
        createMockHookReturn({ searchField: null, handleSearchFieldFocus })
      );

      const props = createMockProps();
      render(<WizardStepInventory {...props} />);

      const buttons = screen.getAllByRole('button', {
        name: /Search Equipment/,
      });
      fireEvent.click(buttons[0]);
      expect(handleSearchFieldFocus).toHaveBeenCalledWith('backpack');

      fireEvent.click(buttons[1]);
      expect(handleSearchFieldFocus).toHaveBeenCalledWith('equipped');
    });
  });

  describe('EquipmentSearchModal integration', () => {
    it('renders the modal when searchField is set', () => {
      useEquipmentSearch.mockReturnValue(
        createMockHookReturn({ searchField: 'backpack' })
      );
      const props = createMockProps();
      render(<WizardStepInventory {...props} />);
      expect(screen.getByTestId('equipment-search-modal')).toBeInTheDocument();
    });

    it('does not render the modal when searchField is null', () => {
      useEquipmentSearch.mockReturnValue(
        createMockHookReturn({ searchField: null })
      );
      const props = createMockProps();
      render(<WizardStepInventory {...props} />);
      expect(
        screen.queryByTestId('equipment-search-modal')
      ).not.toBeInTheDocument();
    });

    it('calls setSearchField and setSearchQuery when modal is closed', () => {
      const setSearchField = vi.fn();
      const setSearchQuery = vi.fn();
      useEquipmentSearch.mockReturnValue(
        createMockHookReturn({
          searchField: 'backpack',
          setSearchField,
          setSearchQuery,
        })
      );

      const props = createMockProps();
      render(<WizardStepInventory {...props} />);

      // Close via ✕ button
      fireEvent.click(screen.getByText('✕'));
      expect(setSearchField).toHaveBeenCalledWith(null);
      expect(setSearchQuery).toHaveBeenCalledWith('');
    });
  });
});

describe('WizardStepInventory item details', () => {
  beforeEach(() => {
    useEquipmentSearch.mockReturnValue(createMockHookReturn());
  });

  it('renders editable quantity and description rows for backpack items', () => {
    const props = createMockProps();
    render(<WizardStepInventory {...props} />);
    const qty = screen.getByLabelText('Quantity for Rope');
    const desc = screen.getByLabelText('Description for Rope');
    expect(qty).toHaveValue(1);
    expect(desc).toHaveValue('');
  });

  it('writes quantity and description into inventory.itemMeta via onInventoryChange', () => {
    const onInventoryChange = vi.fn();
    const props = createMockProps({ onInventoryChange });
    render(<WizardStepInventory {...props} />);

    fireEvent.change(screen.getByLabelText('Quantity for Torch'), { target: { value: '4' } });
    expect(onInventoryChange).toHaveBeenCalledWith('itemMeta', {
      Torch: { quantity: 4, description: '' },
    });

    fireEvent.change(screen.getByLabelText('Description for Rope'), { target: { value: '50 feet' } });
    expect(onInventoryChange).toHaveBeenCalledWith('itemMeta', expect.objectContaining({
      Rope: { quantity: 1, description: '50 feet' },
    }));
  });

  it('does not render item details when the backpack is empty', () => {
    const props = createMockProps({ tempInventory: { backpack: [], equipped: [] } });
    render(<WizardStepInventory {...props} />);
    expect(screen.queryByText('Item Details (optional)')).toBeNull();
  });

  it('shows existing itemMeta values back in the inputs', () => {
    const props = createMockProps({
      formData: {
        inventory: { gold: 50, itemMeta: { Rope: { quantity: 2, description: 'hempen' } } },
      },
    });
    render(<WizardStepInventory {...props} />);
    expect(screen.getByLabelText('Quantity for Rope')).toHaveValue(2);
    expect(screen.getByLabelText('Description for Rope')).toHaveValue('hempen');
  });
});
