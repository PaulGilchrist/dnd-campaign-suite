import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepInventory from './WizardStepInventory.jsx';

vi.mock('../../hooks/ui/useEquipmentSearch.js', () => ({
  useEquipmentSearch: vi.fn(),
}));

vi.mock('./EquipmentSearchModal.jsx', () => ({
  default: function MockEquipmentSearchModal({ showSearchModal, searchField, onClose }) {
    if (!showSearchModal) return null;
    return (
      <div data-testid="equipment-search-modal">
        Modal for {searchField}
        <button data-testid="modal-close-btn" onClick={onClose}>Close</button>
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

  describe('Rendering', () => {
    it('renders the step header', () => {
      const props = createMockProps();
      render(<WizardStepInventory {...props} />);
      expect(screen.getByText('Step 11: Inventory')).toBeInTheDocument();
    });

    it('renders the gold pieces input', () => {
      const props = createMockProps();
      render(<WizardStepInventory {...props} />);
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('renders the backpack textarea', () => {
      const props = createMockProps();
      render(<WizardStepInventory {...props} />);
      const textareas = screen.getAllByRole('textbox');
      expect(textareas.length).toBe(2);
    });

    it('renders search buttons for both fields', () => {
      const props = createMockProps();
      render(<WizardStepInventory {...props} />);
      const buttons = screen.getAllByRole('button', { name: /Search Equipment/ });
      expect(buttons.length).toBe(2);
    });
  });

  describe('Gold pieces', () => {
    it('displays the initial gold value', () => {
      const props = createMockProps({
        formData: { inventory: { gold: 50 } },
      });
      render(<WizardStepInventory {...props} />);
      expect(screen.getByRole('spinbutton')).toHaveValue(50);
    });

    it('calls onInventoryChange when gold input changes', () => {
      const onInventoryChange = vi.fn();
      const props = createMockProps({ onInventoryChange });
      render(<WizardStepInventory {...props} />);
      const goldInput = screen.getByRole('spinbutton');
      fireEvent.change(goldInput, { target: { value: '100' } });
      expect(onInventoryChange).toHaveBeenCalledWith('gold', 100);
    });

    it('calls onInventoryChange with 0 when gold input is cleared', () => {
      const onInventoryChange = vi.fn();
      const props = createMockProps({ onInventoryChange });
      render(<WizardStepInventory {...props} />);
      const goldInput = screen.getByRole('spinbutton');
      fireEvent.change(goldInput, { target: { value: '' } });
      expect(onInventoryChange).toHaveBeenCalledWith('gold', 0);
    });
  });

  describe('Textarea raw text - typing does NOT split on comma', () => {
    it('typing with commas does NOT call onInventoryChange during onChange', () => {
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

    it('the textarea displays the raw typed text including commas', () => {
      const props = createMockProps({
        tempInventory: { backpack: [], equipped: [] },
      });
      render(<WizardStepInventory {...props} />);

      const backpackTextarea = screen.getAllByRole('textbox')[0];
      fireEvent.change(backpackTextarea, { target: { value: 'Drums,Guitar' } });

      expect(backpackTextarea).toHaveValue('Drums,Guitar');
    });
  });

  describe('Textarea blur commits items', () => {
    it('blurring after typing comma-separated items splits and commits them', () => {
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

    it('blurring the equipped textarea commits equipped items', () => {
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

    it('blurring with empty text commits an empty array', () => {
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
  });

  describe('Textarea Enter commits items', () => {
    it('pressing Enter commits the typed items', () => {
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

    it('Enter prevents default to avoid form submission', () => {
      const props = createMockProps({
        tempInventory: { backpack: [], equipped: [] },
      });
      render(<WizardStepInventory {...props} />);

      const backpackTextarea = screen.getAllByRole('textbox')[0];
      const event = fireEvent.keyDown(backpackTextarea, { key: 'Enter' });
      expect(event).toBe(false);
    });
  });

  describe('Shift+Enter does NOT commit', () => {
    it('pressing Shift+Enter does not commit items', () => {
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

  describe('Item preview shows committed items', () => {
    it('displays item tags for backpack items', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope', 'Torch', 'Rations'], equipped: [] },
      });
      render(<WizardStepInventory {...props} />);

      expect(screen.getByText('Rope')).toBeInTheDocument();
      expect(screen.getByText('Torch')).toBeInTheDocument();
      expect(screen.getByText('Rations')).toBeInTheDocument();
    });

    it('displays item count for backpack', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope', 'Torch'], equipped: [] },
      });
      render(<WizardStepInventory {...props} />);

      expect(screen.getByText('2 items')).toBeInTheDocument();
    });

    it('displays singular "item" when there is exactly one', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope'], equipped: [] },
      });
      render(<WizardStepInventory {...props} />);

      expect(screen.getByText('1 item')).toBeInTheDocument();
    });

    it('shows "+N more" when there are more than 5 items', () => {
      const props = createMockProps({
        tempInventory: {
          backpack: ['Rope', 'Torch', 'Rations', 'Dagger', 'Shield', 'Potion', 'Map'],
          equipped: [],
        },
      });
      render(<WizardStepInventory {...props} />);

      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('does not show item preview when there are no items', () => {
      const { container } = render(<WizardStepInventory {...createMockProps({
        tempInventory: { backpack: [], equipped: [] },
      })} />);

      expect(screen.queryByText('0 items')).not.toBeInTheDocument();
      expect(container.querySelector('.inventory-items-preview')).not.toBeInTheDocument();
    });
  });

  describe('Search button opens modal', () => {
    it('clicking the backpack search button calls handleSearchFieldFocus with "backpack"', () => {
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

    it('clicking the equipped search button calls handleSearchFieldFocus with "equipped"', () => {
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
    it('renders the modal when searchField is set', () => {
      useEquipmentSearch.mockReturnValue(createMockHookReturn({
        searchField: 'backpack',
      }));

      const props = createMockProps();
      render(<WizardStepInventory {...props} />);

      expect(screen.getByTestId('equipment-search-modal')).toBeInTheDocument();
    });

    it('does not render the modal when searchField is null', () => {
      useEquipmentSearch.mockReturnValue(createMockHookReturn({
        searchField: null,
      }));

      const props = createMockProps();
      render(<WizardStepInventory {...props} />);

      expect(screen.queryByTestId('equipment-search-modal')).not.toBeInTheDocument();
    });

    it('clicking close button calls setSearchField and setSearchQuery', () => {
      const setSearchField = vi.fn();
      const setSearchQuery = vi.fn();
      useEquipmentSearch.mockReturnValue(createMockHookReturn({
        searchField: 'backpack',
        setSearchField,
        setSearchQuery,
      }));

      const props = createMockProps();
      render(<WizardStepInventory {...props} />);

      fireEvent.click(screen.getByTestId('modal-close-btn'));

      expect(setSearchField).toHaveBeenCalledWith(null);
      expect(setSearchQuery).toHaveBeenCalledWith('');
    });
  });

  describe('Focus behavior', () => {
    it('typing does not split on comma while field is focused', () => {
      const onInventoryChange = vi.fn();
      const onTempInventoryChange = vi.fn();
      const props = createMockProps({
        tempInventory: { backpack: ['Rope'], equipped: [] },
        onInventoryChange,
        onTempInventoryChange,
      });
      render(<WizardStepInventory {...props} />);

      const textarea = screen.getAllByRole('textbox')[0];
      // Focus the textarea to set focusedField
      fireEvent.focus(textarea);
      // Type a comma-separated string - should NOT commit during typing
      fireEvent.change(textarea, { target: { value: 'Rope, Torch' } });

      expect(onInventoryChange).not.toHaveBeenCalled();
      expect(onTempInventoryChange).not.toHaveBeenCalled();
    });

    it('blur after focus commits the items', () => {
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
  });

  describe('Raw text sync', () => {
    it('syncs raw text from items when no field is focused', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope', 'Torch'], equipped: [] },
      });
      render(<WizardStepInventory {...props} />);

      const textarea = screen.getAllByRole('textbox')[0];
      // Textarea shows items joined by comma (synced via useEffect)
      expect(textarea).toHaveValue('Rope, Torch');
    });

    it('updates textarea when items change and not focused', () => {
      const props = createMockProps({
        tempInventory: { backpack: ['Rope'], equipped: [] },
      });
      const { rerender } = render(<WizardStepInventory {...props} />);

      const textarea = screen.getAllByRole('textbox')[0];
      expect(textarea).toHaveValue('Rope');

      // Re-render with updated items
      rerender(<WizardStepInventory {...{
        ...props,
        tempInventory: { backpack: ['Rope', 'Torch', 'Rations'], equipped: [] },
      }} />);

      expect(textarea).toHaveValue('Rope, Torch, Rations');
    });
  });
});
