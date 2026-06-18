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
    it('should render the step header', () => {
      const props = createMockProps();
      render(<WizardStepInventory {...props} />);
      expect(screen.getByText('Step 11: Inventory')).toBeInTheDocument();
    });

    it('should render the gold input, two textareas, and two search buttons', () => {
      const props = createMockProps();
      render(<WizardStepInventory {...props} />);
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
      expect(screen.getAllByRole('textbox')).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: /Search Equipment/ })).toHaveLength(2);
    });

    it('should render the backpack and equipped labels', () => {
      const props = createMockProps();
      render(<WizardStepInventory {...props} />);
      expect(screen.getByText('Backpack Items')).toBeInTheDocument();
      expect(screen.getByText('Equipped Items')).toBeInTheDocument();
    });

    it('should render field descriptions with placeholders', () => {
      const props = createMockProps();
      render(<WizardStepInventory {...props} />);
      const descriptions = screen.getAllByRole('paragraph');
      expect(descriptions.length).toBe(2);
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

    it('should call onInventoryChange with 0 when gold input is cleared', () => {
      const onInventoryChange = vi.fn();
      const props = createMockProps({ onInventoryChange });
      render(<WizardStepInventory {...props} />);
      const goldInput = screen.getByRole('spinbutton');
      fireEvent.change(goldInput, { target: { value: '' } });
      expect(onInventoryChange).toHaveBeenCalledWith('gold', 0);
    });

    it('should call onInventoryChange with 0 when gold input contains non-numeric text', () => {
      const onInventoryChange = vi.fn();
      const props = createMockProps({ onInventoryChange });
      render(<WizardStepInventory {...props} />);
      const goldInput = screen.getByRole('spinbutton');
      fireEvent.change(goldInput, { target: { value: 'abc' } });
      expect(onInventoryChange).toHaveBeenCalledWith('gold', 0);
    });

    it('should pass negative values through when gold input is negative', () => {
      const onInventoryChange = vi.fn();
      const props = createMockProps({ onInventoryChange });
      render(<WizardStepInventory {...props} />);
      const goldInput = screen.getByRole('spinbutton');
      fireEvent.change(goldInput, { target: { value: '-5' } });
      expect(onInventoryChange).toHaveBeenCalledWith('gold', -5);
    });
  });

  describe('textarea raw text behavior', () => {
    it('should not call onInventoryChange or onTempInventoryChange during onChange typing', () => {
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

    it('should display raw typed text including commas in the textarea', () => {
      const props = createMockProps({
        tempInventory: { backpack: [], equipped: [] },
      });
      render(<WizardStepInventory {...props} />);

      const backpackTextarea = screen.getAllByRole('textbox')[0];
      fireEvent.change(backpackTextarea, { target: { value: 'Drums,Guitar' } });

      expect(backpackTextarea).toHaveValue('Drums,Guitar');
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

    it('should prevent default when Enter is pressed to avoid form submission', () => {
      const props = createMockProps({
        tempInventory: { backpack: [], equipped: [] },
      });
      render(<WizardStepInventory {...props} />);

      const backpackTextarea = screen.getAllByRole('textbox')[0];
      const event = fireEvent.keyDown(backpackTextarea, { key: 'Enter' });
      expect(event).toBe(false);
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

    it('should trim whitespace from each item when splitting on commas', () => {
      const onInventoryChange = vi.fn();
      const onTempInventoryChange = vi.fn();
      const props = createMockProps({
        tempInventory: { backpack: [], equipped: [] },
        onInventoryChange,
        onTempInventoryChange,
      });
      render(<WizardStepInventory {...props} />);

      const equippedTextarea = screen.getAllByRole('textbox')[1];
      fireEvent.change(equippedTextarea, { target: { value: 'Longsword,  Shield , Mace' } });
      fireEvent.blur(equippedTextarea);

      expect(onTempInventoryChange).toHaveBeenCalledWith('equipped', ['Longsword', 'Shield', 'Mace']);
    });

    it('should filter out empty items from trailing/leading/multiple commas', () => {
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

    it('should commit an empty array when blur clears the textarea', () => {
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

    it('should commit whitespace-only text as an empty array', () => {
      const onInventoryChange = vi.fn();
      const onTempInventoryChange = vi.fn();
      const props = createMockProps({
        tempInventory: { backpack: ['Rope'], equipped: [] },
        onInventoryChange,
        onTempInventoryChange,
      });
      render(<WizardStepInventory {...props} />);

      const backpackTextarea = screen.getAllByRole('textbox')[0];
      fireEvent.change(backpackTextarea, { target: { value: '   ' } });
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

    it('should commit items from the equipped textarea when Enter is pressed', () => {
      const onInventoryChange = vi.fn();
      const onTempInventoryChange = vi.fn();
      const props = createMockProps({
        tempInventory: { backpack: [], equipped: [] },
        onInventoryChange,
        onTempInventoryChange,
      });
      render(<WizardStepInventory {...props} />);

      const equippedTextarea = screen.getAllByRole('textbox')[1];
      fireEvent.change(equippedTextarea, { target: { value: 'Sword, Shield' } });
      fireEvent.keyDown(equippedTextarea, { key: 'Enter' });

      expect(onTempInventoryChange).toHaveBeenCalledWith('equipped', ['Sword', 'Shield']);
      expect(onInventoryChange).toHaveBeenCalledWith('equipped', ['Sword', 'Shield']);
    });
  });

  describe('item preview', () => {
    it('should display item tags for backpack items', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope', 'Torch', 'Rations'], equipped: [] },
      });
      render(<WizardStepInventory {...props} />);

      expect(screen.getByText('Rope')).toBeInTheDocument();
      expect(screen.getByText('Torch')).toBeInTheDocument();
      expect(screen.getByText('Rations')).toBeInTheDocument();
    });

    it('should display item tags for equipped items', () => {
      const props = createMockProps({
        tempInventory: { backpack: [], equipped: ['Longsword', 'Shield'] },
      });
      render(<WizardStepInventory {...props} />);

      expect(screen.getByText('Longsword')).toBeInTheDocument();
      expect(screen.getByText('Shield')).toBeInTheDocument();
    });

    it('should display "N items" (plural) when there are multiple items', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope', 'Torch'], equipped: [] },
      });
      render(<WizardStepInventory {...props} />);

      expect(screen.getByText('2 items')).toBeInTheDocument();
    });

    it('should display "1 item" (singular) when there is exactly one item', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope'], equipped: [] },
      });
      render(<WizardStepInventory {...props} />);

      expect(screen.getByText('1 item')).toBeInTheDocument();
    });

    it('should show "+N more" when there are more than 5 items', () => {
      const props = createMockProps({
        tempInventory: {
          backpack: ['Rope', 'Torch', 'Rations', 'Dagger', 'Shield', 'Potion', 'Map'],
          equipped: [],
        },
      });
      render(<WizardStepInventory {...props} />);

      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('should show "+0 more" when there are exactly 5 items', () => {
      const props = createMockProps({
        tempInventory: {
          backpack: ['Rope', 'Torch', 'Rations', 'Dagger', 'Shield'],
          equipped: [],
        },
      });
      render(<WizardStepInventory {...props} />);

      expect(screen.queryByText(/more/)).not.toBeInTheDocument();
    });

    it('should not render the preview container when there are no items', () => {
      const { container } = render(
        <WizardStepInventory {...createMockProps({
          tempInventory: { backpack: [], equipped: [] },
        })} />
      );

      expect(screen.queryByText('0 items')).not.toBeInTheDocument();
      expect(container.querySelector('.inventory-items-preview')).not.toBeInTheDocument();
    });

    it('should not show item preview for equipped when equipped is empty', () => {
      const { container } = render(
        <WizardStepInventory {...createMockProps({
          tempInventory: { backpack: [], equipped: [] },
        })} />
      );

      const previews = container.querySelectorAll('.inventory-items-preview');
      expect(previews.length).toBe(0);
    });
  });

  describe('search button interaction', () => {
    it('should call handleSearchFieldFocus with "backpack" when backpack search button is clicked', () => {
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
    });

    it('should call handleSearchFieldFocus with "equipped" when equipped search button is clicked', () => {
      const handleSearchFieldFocus = vi.fn();
      useEquipmentSearch.mockReturnValue(createMockHookReturn({
        searchField: null,
        handleSearchFieldFocus,
      }));

      const props = createMockProps();
      render(<WizardStepInventory {...props} />);

      const buttons = screen.getAllByRole('button', { name: /Search Equipment/ });
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

    it('should render equipment items when filteredEquipment is provided', () => {
      useEquipmentSearch.mockReturnValue(createMockHookReturn({
        searchField: 'backpack',
        filteredEquipment: mockEquipment,
      }));

      const props = createMockProps();
      render(<WizardStepInventory {...props} />);

      expect(screen.getByText('Club')).toBeInTheDocument();
      expect(screen.getByText('Dagger')).toBeInTheDocument();
    });

    it('should render the show-only-selected checkbox', () => {
      useEquipmentSearch.mockReturnValue(createMockHookReturn({
        searchField: 'backpack',
      }));

      const props = createMockProps();
      render(<WizardStepInventory {...props} />);

      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('should call onEquipmentSelect when an equipment item is clicked', () => {
      const handleEquipmentSelect = vi.fn();
      useEquipmentSearch.mockReturnValue(createMockHookReturn({
        searchField: 'backpack',
        filteredEquipment: mockEquipment,
        handleEquipmentSelect,
      }));

      const props = createMockProps();
      render(<WizardStepInventory {...props} />);

      fireEvent.click(screen.getByText('Club'));
      expect(handleEquipmentSelect).toHaveBeenCalledWith(mockEquipment[0]);
    });

    it('should render the close button in the footer', () => {
      useEquipmentSearch.mockReturnValue(createMockHookReturn({
        searchField: 'backpack',
      }));

      const props = createMockProps();
      render(<WizardStepInventory {...props} />);

      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('should pass the correct currentItemCount for backpack field', () => {
      useEquipmentSearch.mockReturnValue(createMockHookReturn({
        searchField: 'backpack',
      }));

      const props = createMockProps({
        tempInventory: { backpack: ['Rope', 'Torch'], equipped: ['Sword'] },
      });
      render(<WizardStepInventory {...props} />);

      expect(screen.getByText('2 selected)')).toBeInTheDocument();
    });

    it('should pass the correct currentItemCount for equipped field', () => {
      useEquipmentSearch.mockReturnValue(createMockHookReturn({
        searchField: 'equipped',
      }));

      const props = createMockProps({
        tempInventory: { backpack: ['Rope'], equipped: ['Sword', 'Shield', 'Axe'] },
      });
      render(<WizardStepInventory {...props} />);

      expect(screen.getByText('3 selected)')).toBeInTheDocument();
    });
  });

  describe('focus behavior', () => {
    it('should not commit items during typing while field is focused', () => {
      const onInventoryChange = vi.fn();
      const onTempInventoryChange = vi.fn();
      const props = createMockProps({
        tempInventory: { backpack: ['Rope'], equipped: [] },
        onInventoryChange,
        onTempInventoryChange,
      });
      render(<WizardStepInventory {...props} />);

      const textarea = screen.getAllByRole('textbox')[0];
      fireEvent.focus(textarea);
      fireEvent.change(textarea, { target: { value: 'Rope, Torch' } });

      expect(onInventoryChange).not.toHaveBeenCalled();
      expect(onTempInventoryChange).not.toHaveBeenCalled();
    });

    it('should commit items on blur after focus', () => {
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

    it('should switch committed items when switching focus between textareas', () => {
      const onInventoryChange = vi.fn();
      const onTempInventoryChange = vi.fn();
      const props = createMockProps({
        tempInventory: { backpack: [], equipped: [] },
        onInventoryChange,
        onTempInventoryChange,
      });
      render(<WizardStepInventory {...props} />);

      const [backpackTextarea, equippedTextarea] = screen.getAllByRole('textbox');

      // Type and focus backpack
      fireEvent.focus(backpackTextarea);
      fireEvent.change(backpackTextarea, { target: { value: 'Backpack Item' } });
      // Manually blur backpack (jsdom doesn't blur on focus of another element)
      fireEvent.blur(backpackTextarea);
      // Then focus equipped
      fireEvent.focus(equippedTextarea);

      expect(onTempInventoryChange).toHaveBeenCalledWith('backpack', ['Backpack Item']);
      expect(onInventoryChange).toHaveBeenCalledWith('backpack', ['Backpack Item']);

      // Type and blur equipped
      fireEvent.change(equippedTextarea, { target: { value: 'Equipped Item' } });
      fireEvent.blur(equippedTextarea);

      expect(onTempInventoryChange).toHaveBeenCalledWith('equipped', ['Equipped Item']);
      expect(onInventoryChange).toHaveBeenCalledWith('equipped', ['Equipped Item']);
    });
  });

  describe('raw text sync from items', () => {
    it('should sync raw text from items when no field is focused', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope', 'Torch'], equipped: [] },
      });
      render(<WizardStepInventory {...props} />);

      const textarea = screen.getAllByRole('textbox')[0];
      expect(textarea).toHaveValue('Rope, Torch');
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

      // Textarea should retain user's typed value, not sync from items
      expect(textarea).toHaveValue('Rope');
    });

    it('should sync equipped textarea from items when no field is focused', () => {
      const props = createMockProps({
        tempInventory: { backpack: [], equipped: ['Longsword', 'Shield'] },
      });
      render(<WizardStepInventory {...props} />);

      const textarea = screen.getAllByRole('textbox')[1];
      expect(textarea).toHaveValue('Longsword, Shield');
    });
  });
});
