// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepInventory from './WizardStepInventory.jsx';

// Hook is mocked to keep this lane deterministic (no equipment.json fetch).
vi.mock('../../hooks/ui/useEquipmentSearch.js', () => {
  return { useEquipmentSearch: vi.fn() };
});

// Minimal stub of EquipmentSearchModal covering ONLY the parent-wiring seam
// this step drives: open/close dispatch, count derivation, only-selected
// routing, and item-select pass-through. Modal internals are covered by
// EquipmentSearchModal.test.jsx (#365/#372 shared-component lane).
vi.mock('./EquipmentSearchModal.jsx', () => ({
  default: function EquipmentSearchModal({
    showSearchModal,
    onClose,
    filteredEquipment,
    showOnlySelected,
    onShowOnlySelectedChange,
    onEquipmentSelect,
    currentItemCount = 0,
  }) {
    if (!showSearchModal) return null;
    return (
      <div data-testid="equipment-search-modal">
        <button onClick={onClose}>✕</button>
        <label>
          <input
            type="checkbox"
            checked={showOnlySelected}
            onChange={(e) => onShowOnlySelectedChange(e.target.checked)}
          />
          Only selected
        </label>
        <span className="modal-item-count">{currentItemCount} selected</span>
        {filteredEquipment.map((item) => (
          <div key={item.index} className="stub-equipment-row" onClick={() => onEquipmentSelect(item)}>
            {item.name}
          </div>
        ))}
      </div>
    );
  },
}));

import { useEquipmentSearch } from '../../hooks/ui/useEquipmentSearch.js';

// Free-text inventory lists are user input, not rules data — plain names.
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
  stepNumber: 16,
  formData: { inventory: { gold: 15 } },
  tempInventory: {
    backpack: ['Rope', 'Torch'],
    equipped: ['Longsword', 'Chain mail'],
  },
  onInventoryChange: vi.fn(),
  onTempInventoryChange: vi.fn(),
  ...overrides,
});

// DOM order: [0] backpack textarea, [1] equipped textarea
// (meta description inputs are <input>, not .inventory-textarea).
const textareaFor = (container, field) =>
  container.querySelectorAll('.inventory-textarea')[field === 'backpack' ? 0 : 1];

const tagTexts = (container) =>
  [...container.querySelectorAll('.inventory-items-preview .item-tag:not(.more-items)')].map((el) => el.textContent);

describe('WizardStepInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEquipmentSearch.mockReturnValue(createMockHookReturn());
  });

  it('renders header, gold with initial value, both inventories, search buttons — no modal until opened', () => {
    const { container } = render(<WizardStepInventory {...createMockProps()} />);
    expect(screen.getByText('Step 16: Inventory')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /Gold Pieces/i })).toHaveValue(15);
    expect(screen.getByText('Backpack Items')).toBeInTheDocument();
    expect(screen.getByText('Equipped Items')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Search Equipment/ })).toHaveLength(2);
    expect(container.querySelectorAll('.inventory-textarea')).toHaveLength(2);
    expect(screen.queryByTestId('equipment-search-modal')).not.toBeInTheDocument();
  });

  it.each([
    ['100', 100],
    ['', 0],
    ['10.5', 10],
  ])('gold input "%s" commits parsed integer %i', (value, expected) => {
    const props = createMockProps();
    render(<WizardStepInventory {...props} />);
    fireEvent.change(screen.getByRole('spinbutton', { name: /Gold Pieces/i }), {
      target: { value },
    });
    expect(props.onInventoryChange).toHaveBeenCalledWith('gold', expected);
  });

  it.each([
    ['backpack', 'Drums, Guitar', ['Drums', 'Guitar']],
    ['backpack', ', Rope, , Torch,', ['Rope', 'Torch']],
    ['backpack', '"Lute, travel-size", Torch', ['Lute, travel-size', 'Torch']],
    ['backpack', '', []],
    ['equipped', 'Longsword, Shield', ['Longsword', 'Shield']],
  ])('blur on %s textarea commits "%s" as %j to both handlers', (field, value, items) => {
    const props = createMockProps();
    const { container } = render(<WizardStepInventory {...props} />);
    const textarea = textareaFor(container, field);
    fireEvent.change(textarea, { target: { value } });
    fireEvent.blur(textarea);
    expect(props.onTempInventoryChange).toHaveBeenCalledWith(field, items);
    expect(props.onInventoryChange).toHaveBeenCalledWith(field, items);
  });

  it('Enter commits the textarea but Shift+Enter does not', () => {
    const props = createMockProps();
    const { container } = render(<WizardStepInventory {...props} />);
    const textarea = textareaFor(container, 'backpack');

    fireEvent.change(textarea, { target: { value: 'Dagger, Arrow' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(props.onTempInventoryChange).toHaveBeenCalledWith('backpack', ['Dagger', 'Arrow']);
    expect(props.onInventoryChange).toHaveBeenCalledWith('backpack', ['Dagger', 'Arrow']);

    props.onInventoryChange.mockClear();
    props.onTempInventoryChange.mockClear();

    fireEvent.change(textarea, { target: { value: 'Sword, Shield' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(props.onInventoryChange).not.toHaveBeenCalled();
    expect(props.onTempInventoryChange).not.toHaveBeenCalled();
  });

  it.each([
    [['Rope'], ['Rope'], '1 item', null],
    [
      ['Rope', 'Torch', 'Rations', 'Dagger', 'Shield', 'Potion', 'Map'],
      ['Rope', 'Torch', 'Rations', 'Dagger', 'Shield'],
      '7 items',
      '+2 more',
    ],
  ])('backpack preview shows count "%s", exact tags %j, overflow %s', (items, visibleTags, countText, moreText) => {
    const { container } = render(
      <WizardStepInventory {...createMockProps({ tempInventory: { backpack: items, equipped: [] } })} />
    );
    expect(screen.getByText(countText)).toBeInTheDocument();
    // equipped is empty in every case, so all tags belong to the backpack preview.
    expect(tagTexts(container)).toEqual(visibleTags);
    if (moreText) {
      expect(screen.getByText(moreText)).toBeInTheDocument();
    } else {
      expect(screen.queryByText(/\+ \d+ more/)).not.toBeInTheDocument();
    }
  });

  it('renders no item previews or item-details section when both inventories are empty', () => {
    const { container } = render(
      <WizardStepInventory {...createMockProps({ tempInventory: { backpack: [], equipped: [] } })} />
    );
    expect(container.querySelector('.inventory-items-preview')).not.toBeInTheDocument();
    expect(screen.queryByText('Item Details (optional)')).not.toBeInTheDocument();
  });

  it('syncs textarea text from tempInventory when items change and no field is focused', () => {
    const props = createMockProps();
    const { container, rerender } = render(<WizardStepInventory {...props} />);
    expect(textareaFor(container, 'backpack')).toHaveValue('Rope, Torch');

    rerender(
      <WizardStepInventory {...createMockProps({ tempInventory: { backpack: ['Rope', 'Torch', 'Potion'], equipped: ['Longsword', 'Chain mail'] } })} />
    );
    expect(textareaFor(container, 'backpack')).toHaveValue('Rope, Torch, Potion');
  });

  it('keeps in-progress typing when an externally changed field has focus', () => {
    const props = createMockProps();
    const { container, rerender } = render(<WizardStepInventory {...props} />);
    const textarea = textareaFor(container, 'backpack');
    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: 'Custom Item' } });

    rerender(
      <WizardStepInventory {...createMockProps({ tempInventory: { backpack: ['Rope', 'Torch', 'Potion'], equipped: ['Longsword', 'Chain mail'] } })} />
    );
    expect(textarea).toHaveValue('Custom Item');
  });

  it('search buttons dispatch handleSearchFieldFocus with the matching field', () => {
    const handleSearchFieldFocus = vi.fn();
    useEquipmentSearch.mockReturnValue(createMockHookReturn({ handleSearchFieldFocus }));
    render(<WizardStepInventory {...createMockProps()} />);
    const buttons = screen.getAllByRole('button', { name: /Search Equipment/ });
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    expect(handleSearchFieldFocus).toHaveBeenCalledTimes(2);
    expect(handleSearchFieldFocus).toHaveBeenNthCalledWith(1, 'backpack');
    expect(handleSearchFieldFocus).toHaveBeenNthCalledWith(2, 'equipped');
  });

  describe('EquipmentSearchModal wiring', () => {
    it.each([
      ['backpack', ['Rope', 'Torch'], ['Longsword', 'Chain mail', 'Shield'], 2, true],
      ['equipped', ['Rope', 'Torch'], ['Longsword', 'Chain mail', 'Shield'], 3, false],
    ])('opens for %s with its count and routes only-selected flag to that field', (field, backpack, equipped, expectedCount, expectedChecked) => {
      const setSearchField = vi.fn();
      const setSearchQuery = vi.fn();
      const setShowOnlySelectedBackpack = vi.fn();
      const setShowOnlySelectedEquipped = vi.fn();
      const handleEquipmentSelect = vi.fn();
      const club = { index: 'club', name: 'Club' };
      useEquipmentSearch.mockReturnValue(
        createMockHookReturn({
          searchField: field,
          setSearchField,
          setSearchQuery,
          handleEquipmentSelect,
          setShowOnlySelectedBackpack,
          setShowOnlySelectedEquipped,
          showOnlySelectedBackpack: true,
          showOnlySelectedEquipped: false,
          filteredEquipment: [club],
        })
      );
      const props = createMockProps({ tempInventory: { backpack, equipped } });
      render(<WizardStepInventory {...props} />);

      const modal = screen.getByTestId('equipment-search-modal');
      expect(modal).toBeInTheDocument();
      expect(screen.getByText(`${expectedCount} selected`)).toBeInTheDocument();
      // backpack param: checkbox true comes from backpack flag; equipped param:
      // backpack flag is true but equipped flag is false -> unchecked (proves routing).
      const checkbox = screen.getByRole('checkbox');
      if (expectedChecked) {
        expect(checkbox).toBeChecked();
      } else {
        expect(checkbox).not.toBeChecked();
      }

      // Clicking toggles: backpack starts checked -> false, equipped unchecked -> true.
      fireEvent.click(checkbox);
      const expectedSetter = field === 'backpack' ? setShowOnlySelectedBackpack : setShowOnlySelectedEquipped;
      const otherSetter = field === 'backpack' ? setShowOnlySelectedEquipped : setShowOnlySelectedBackpack;
      expect(expectedSetter).toHaveBeenCalledWith(!expectedChecked);
      expect(otherSetter).not.toHaveBeenCalled();

      fireEvent.click(screen.getByText('Club'));
      expect(handleEquipmentSelect).toHaveBeenCalledWith(club);
    });

    it('closing via ✕ clears the search field and query', () => {
      const setSearchField = vi.fn();
      const setSearchQuery = vi.fn();
      useEquipmentSearch.mockReturnValue(
        createMockHookReturn({ searchField: 'backpack', setSearchField, setSearchQuery })
      );
      render(<WizardStepInventory {...createMockProps()} />);
      fireEvent.click(screen.getByText('✕'));
      expect(setSearchField).toHaveBeenCalledWith(null);
      expect(setSearchQuery).toHaveBeenCalledWith('');
    });
  });

  describe('item details (itemMeta)', () => {
    it('reflects existing itemMeta case-insensitively, defaulting missing meta to qty 1 and empty description', () => {
      render(
        <WizardStepInventory
          {...createMockProps({
            formData: { inventory: { gold: 15, itemMeta: { rope: { quantity: 2, description: 'hempen' } } } },
          })}
        />
      );
      expect(screen.getByLabelText('Quantity for Rope')).toHaveValue(2);
      expect(screen.getByLabelText('Description for Rope')).toHaveValue('hempen');
      expect(screen.getByLabelText('Quantity for Torch')).toHaveValue(1);
      expect(screen.getByLabelText('Description for Torch')).toHaveValue('');
    });

    it('writes exact itemMeta patches, merging existing meta and preserving the original key casing', () => {
      const props = createMockProps({
        formData: { inventory: { gold: 15, itemMeta: { rope: { quantity: 2, description: 'hempen' } } } },
      });
      const { rerender } = render(<WizardStepInventory {...props} />);

      fireEvent.change(screen.getByLabelText('Quantity for Torch'), { target: { value: '4' } });
      // Untouched rope meta is copied through with its lowercase key preserved.
      expect(props.onInventoryChange).toHaveBeenCalledWith('itemMeta', {
        rope: { quantity: 2, description: 'hempen' },
        Torch: { quantity: 4, description: '' },
      });

      // Parent round-trips the new meta back down as props (case-insensitive
      // lookup must find lowercase "rope" when editing "Rope").
      rerender(
        <WizardStepInventory
          {...props}
          formData={{ inventory: { gold: 15, itemMeta: { rope: { quantity: 2, description: 'hempen' }, Torch: { quantity: 4, description: '' } } } }}
        />
      );
      fireEvent.change(screen.getByLabelText('Description for Rope'), { target: { value: '50 feet' } });
      expect(props.onInventoryChange).toHaveBeenLastCalledWith('itemMeta', {
        rope: { quantity: 2, description: '50 feet' },
        Torch: { quantity: 4, description: '' },
      });
    });

    it.each([['0'], ['-5']])('clamps quantity "%s" up to 1', (value) => {
      const props = createMockProps();
      render(<WizardStepInventory {...props} />);
      fireEvent.change(screen.getByLabelText('Quantity for Torch'), { target: { value } });
      expect(props.onInventoryChange).toHaveBeenCalledWith('itemMeta', {
        Torch: { quantity: 1, description: '' },
      });
    });
  });
});
