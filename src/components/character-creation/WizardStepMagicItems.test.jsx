// @improved-by-ai
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepMagicItems from './WizardStepMagicItems.jsx';

// Mock sanitize to pass through HTML unchanged
vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

// Mock SelectableList to render a realistic version that mirrors the real component's behavior
vi.mock('./SelectableList.jsx', () => {
  const SelectableList = ({
    items,
    fieldName,
    formData,
    onArrayFieldChange,
    title,
    searchPlaceholder,
    filters,
    renderItem,
    renderWarnings,
    loadingMessage,
    className,
    resultLabel,
  }) => {
    const [searchQuery, setSearchQuery] = React.useState('');
    const [showFullDetails, setShowFullDetails] = React.useState({});
    const [showOnlySelected, setShowOnlySelected] = React.useState(false);
    const [filterStates, setFilterStates] = React.useState(() => {
      const states = {};
      (filters || []).forEach((filter) => {
        states[filter.field] = filter.defaultLabel || 'All';
      });
      return states;
    });

    const getNestedValue = (obj, path) =>
      path.split('.').reduce((current, key) => current?.[key], obj);

    const filterOptions = React.useMemo(() => {
      const options = {};
      (filters || []).forEach((filter) => {
        const optionSet = new Set([filter.defaultLabel || 'All']);
        if (items && items.length > 0) {
          items.forEach((item) => {
            const value = filter.getValue
              ? filter.getValue(item)
              : item[filter.field];
            if (value !== undefined && value !== null) {
              if (Array.isArray(value)) {
                value.forEach((v) => optionSet.add(String(v)));
              } else {
                optionSet.add(String(value));
              }
            }
          });
        }
        options[filter.field] = Array.from(optionSet).sort(
          (a, b) => a.localeCompare(b),
        );
      });
      return options;
    }, [items, filters]);

    const filteredItems = React.useMemo(() => {
      if (!items || items.length === 0) return [];
      let results = [...items];
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        results = results.filter(
          (item) =>
            item.name?.toLowerCase().includes(query) ||
            (item.index && item.index.toLowerCase().includes(query)),
        );
      }
      (filters || []).forEach((filter) => {
        const selectedValue = filterStates[filter.field];
        if (
          selectedValue &&
          selectedValue !== (filter.defaultLabel || 'All')
        ) {
          results = results.filter((item) => {
            const value = filter.getValue
              ? filter.getValue(item)
              : item[filter.field];
            if (Array.isArray(value)) {
              return value.includes(selectedValue);
            }
            return String(value) === selectedValue;
          });
        }
      });
      if (showOnlySelected) {
        const selectedNames = getNestedValue(formData, fieldName) || [];
        results = results.filter((item) => selectedNames.includes(item.name));
      }
      return results.sort((a, b) => a.name.localeCompare(b.name));
    }, [items, searchQuery, filterStates, showOnlySelected, formData, fieldName, filters]);

    const handleItemToggle = (itemName) => {
      const currentItems = getNestedValue(formData, fieldName) || [];
      const isCurrentlySelected = currentItems.includes(itemName);
      const newItems = isCurrentlySelected
        ? currentItems.filter((i) => i !== itemName)
        : [...currentItems, itemName];
      onArrayFieldChange(fieldName, newItems);
    };

    const itemIsSelected = (itemName) =>
      (getNestedValue(formData, fieldName) || []).includes(itemName);

    const toggleFullDetails = (itemIndex) => {
      setShowFullDetails((prev) => ({
        ...prev,
        [itemIndex]: !prev[itemIndex],
      }));
    };

    const handleFilterChange = (filterField, value) => {
      setFilterStates((prev) => ({
        ...prev,
        [filterField]: value,
      }));
    };

    if (!items || items.length === 0) {
      return (
        <div className={`wizard-step ${className}`}>
          <h2>{title}</h2>
          <div className="no-results-found">
            {loadingMessage || 'Data not yet loaded. Please try again.'}
          </div>
        </div>
      );
    }

    return (
      <div className={`wizard-step ${className}`} data-testid="selectable-list">
        <h2>{title}</h2>
        {renderWarnings && renderWarnings()}
        <div className="list-filter-container">
          <div className="filter-group">
            <label htmlFor={`${fieldName}-search`}>Search {title}</label>
            <input
              type="text"
              id={`${fieldName}-search`}
              className={`${fieldName}-search-input`}
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {(filters || []).map((filter) => (
            <div key={filter.field} className="filter-group">
              <label htmlFor={`${fieldName}-${filter.field}-filter`}>
                {filter.label}
              </label>
              <select
                id={`${fieldName}-${filter.field}-filter`}
                className={
                  filter.className || `${filter.field}-filter`
                }
                value={filterStates[filter.field]}
                onChange={(e) => handleFilterChange(filter.field, e.target.value)}
              >
                {(filterOptions[filter.field] || []).map((option) => (
                  <option key={option} value={option}>
                    {filter.renderOption
                      ? filter.renderOption(option)
                      : option}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div className="filter-group">
            <label className="filter-checkbox-label">
              <input
                type="checkbox"
                checked={showOnlySelected}
                onChange={(e) => setShowOnlySelected(e.target.checked)}
              />
              Show Only Selected&nbsp;(
            </label>
            <span className="filter-checkbox-count">
              {(getNestedValue(formData, fieldName) || []).length} selected)
            </span>
          </div>
        </div>
        <div
          className={`list-results-container ${className}-results-container`}
        >
          <div className={`list-results-header ${className}-results-header`}>
            <span className="result-count">
              Showing {filteredItems.length}{' '}
              {resultLabel || 'item'}
              {filteredItems.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className={`list-results-list ${className}-results-list`}>
            {filteredItems.length === 0 ? (
              <div className="no-results-found">
                {searchQuery ||
                filters.some(
                  (f) =>
                    filterStates[f.field] !== (f.defaultLabel || 'All'),
                )
                  ? `No ${resultLabel || 'items'} found matching your criteria.`
                  : `No ${resultLabel || 'items'} available.`}
              </div>
            ) : (
              filteredItems.map((item, index) =>
                renderItem(item, index, {
                  isSelected: itemIsSelected(item.name),
                  isExpanded: showFullDetails[index],
                  onToggle: () => handleItemToggle(item.name),
                  onToggleExpand: () => toggleFullDetails(index),
                }),
              )
            )}
          </div>
        </div>
      </div>
    );
  };
  return { default: SelectableList };
});

describe('WizardStepMagicItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseMagicItems = [
    {
      name: 'Wand of Magic',
      index: 'wand',
      type: 'Rod',
      rarity: 'Uncommon',
      description: '<p>A magic wand.</p>',
      requiresAttunement: false,
    },
    {
      name: 'Amulet of Health',
      index: 'amulet',
      type: 'Amulet',
      rarity: 'Uncommon',
      description: '<p>Health amulet.</p>',
      requiresAttunement: true,
    },
  ];

  const createProps = (overrides = {}) => ({
    formData: {
      inventory: {
        magicItems: ['Wand of Magic'],
      },
    },
    allMagicItems: baseMagicItems,
    ruleset: '5e',
    onArrayFieldChange: vi.fn(),
    ...overrides,
  });

  describe('rendering', () => {
    it('renders the step title', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      expect(screen.getByText('Step 10: Magic Items')).toBeInTheDocument();
    });

    it('renders the search input with correct placeholder', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      const searchInput = screen.getByRole('textbox');
      expect(searchInput).toHaveAttribute('placeholder', 'Search magic items...');
    });

    it('renders the type filter dropdown', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      const filterSelect = screen.getByLabelText('Item Type');
      expect(filterSelect).toBeInTheDocument();
    });

    it('renders the Show Only Selected checkbox', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      expect(
        screen.getByRole('checkbox', { name: /show only selected/i }),
      ).toBeInTheDocument();
    });

    it('renders the result count header', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      expect(screen.getByText(/Showing 2 magic items/)).toBeInTheDocument();
    });
  });

  describe('item display', () => {
    it('renders each magic item name', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      expect(screen.getByText('Amulet of Health')).toBeInTheDocument();
      expect(screen.getByText('Wand of Magic')).toBeInTheDocument();
    });

    it('renders item types', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      const typeElements = document.querySelectorAll('.magic-item-type');
      expect(typeElements.length).toBe(2);
      expect(typeElements[0].textContent).toBe('Amulet');
      expect(typeElements[1].textContent).toBe('Rod');
    });

    it('renders item rarities', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      const rarityElements = screen.getAllByText('Uncommon');
      expect(rarityElements.length).toBe(2);
    });

    it('shows the selected item with a checkmark', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('renders Show More button for collapsed items and Show Less for expanded items', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      // Both items start collapsed, so both show "Show More"
      const showMoreButtons = screen.getAllByText('Show More');
      expect(showMoreButtons.length).toBe(2);
    });

    it('clicking Show More toggles it to Show Less and reveals description', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      // Amulet is first alphabetically, click its Show More
      const showMoreButtons = screen.getAllByText('Show More');
      fireEvent.click(showMoreButtons[0]);
      // Should now show the description text (inside <p> tag)
      expect(screen.getByText(/Health amulet/)).toBeInTheDocument();
      // The button should now say "Show Less"
      expect(screen.getByText('Show Less')).toBeInTheDocument();
    });

    it('renders the expanded item description after clicking Show More', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      const showMoreButtons = screen.getAllByText('Show More');
      // Click the second Show More (Wand of Magic)
      fireEvent.click(showMoreButtons[1]);
      expect(screen.getByText(/magic wand/)).toBeInTheDocument();
    });

    it('renders the multi-line description second paragraph', () => {
      const multiLineItem = {
        name: 'Ring of Powers',
        index: 'ring',
        type: 'Ring',
        rarity: 'Rare',
        description: [
          '<p>First paragraph.</p>',
          '<p>Second paragraph.</p>',
        ],
        requiresAttunement: false,
      };
      render(
        <WizardStepMagicItems
          {...createProps({ allMagicItems: [multiLineItem] })}
        />,
      );
      // Click Show More to expand
      const showMoreBtn = screen.getByText('Show More');
      fireEvent.click(showMoreBtn);
      expect(screen.getByText(/Second paragraph/)).toBeInTheDocument();
    });
  });

  describe('attunement warnings', () => {
    it('displays a warning when more than 3 attuned items are selected', () => {
      const attunedItems = [
        { name: 'Boots', requiresAttunement: true },
        { name: 'Cloak', requiresAttunement: true },
        { name: 'Gloves', requiresAttunement: true },
        { name: 'Ring', requiresAttunement: true },
      ];
      render(
        <WizardStepMagicItems
          {...createProps({
            formData: {
              inventory: {
                magicItems: ['Boots', 'Cloak', 'Gloves', 'Ring'],
              },
            },
            allMagicItems: attunedItems,
          })}
        />,
      );
      const warningText =
        'You have selected 4 items requiring attunement, but a character can only attune to a maximum of 3 items.';
      expect(screen.getByText(warningText)).toBeInTheDocument();
    });

    it('does not display a warning when 3 or fewer attuned items are selected', () => {
      const attunedItems = [
        { name: 'Boots', requiresAttunement: true },
        { name: 'Cloak', requiresAttunement: true },
      ];
      render(
        <WizardStepMagicItems
          {...createProps({
            formData: {
              inventory: {
                magicItems: ['Boots', 'Cloak'],
              },
            },
            allMagicItems: attunedItems,
          })}
        />,
      );
      expect(
        screen.queryByText(/items requiring attunement/),
      ).not.toBeInTheDocument();
    });

    it('does not display a warning when no items require attunement', () => {
      const nonAttunedItems = [
        { name: 'Potion', requiresAttunement: false },
        { name: 'Scroll', requiresAttunement: false },
      ];
      render(
        <WizardStepMagicItems
          {...createProps({
            formData: {
              inventory: {
                magicItems: ['Potion', 'Scroll'],
              },
            },
            allMagicItems: nonAttunedItems,
          })}
        />,
      );
      expect(
        screen.queryByText(/items requiring attunement/),
      ).not.toBeInTheDocument();
    });

    it('does not display a warning when no items are selected', () => {
      render(
        <WizardStepMagicItems
          {...createProps({
            formData: { inventory: { magicItems: [] } },
          })}
        />,
      );
      expect(
        screen.queryByText(/items requiring attunement/),
      ).not.toBeInTheDocument();
    });

    it('updates the warning count when selection changes', () => {
      const { rerender } = render(
        <WizardStepMagicItems
          {...createProps({
            formData: {
              inventory: {
                magicItems: ['Boots', 'Cloak', 'Gloves', 'Ring'],
              },
            },
            allMagicItems: [
              { name: 'Boots', requiresAttunement: true },
              { name: 'Cloak', requiresAttunement: true },
              { name: 'Gloves', requiresAttunement: true },
              { name: 'Ring', requiresAttunement: true },
            ],
          })}
        />,
      );
      expect(screen.getByText(/You have selected 4 items requiring attunement/)).toBeInTheDocument();

      rerender(
        <WizardStepMagicItems
          {...createProps({
            formData: {
              inventory: {
                magicItems: [
                  'Boots',
                  'Cloak',
                  'Gloves',
                  'Ring',
                  'Amulet',
                ],
              },
            },
            allMagicItems: [
              { name: 'Boots', requiresAttunement: true },
              { name: 'Cloak', requiresAttunement: true },
              { name: 'Gloves', requiresAttunement: true },
              { name: 'Ring', requiresAttunement: true },
              { name: 'Amulet', requiresAttunement: true },
            ],
          })}
        />,
      );
      expect(
        screen.getByText(/You have selected 5 items requiring attunement/),
      ).toBeInTheDocument();
    });
  });

  describe('item selection', () => {
    it('calls onArrayFieldChange when an unselected item checkbox is clicked', () => {
      const onArrayFieldChange = vi.fn();
      render(
        <WizardStepMagicItems
          {...createProps({
            onArrayFieldChange,
            formData: { inventory: { magicItems: [] } },
          })}
        />,
      );
      // Items are sorted alphabetically: Amulet first (index 0), Wand second (index 1).
      // Both are unselected. Click the Wand's checkbox (second checkbox, index 1) to select it.
      const checkboxes = document.querySelectorAll('.list-item-checkbox-trigger');
      expect(checkboxes.length).toBe(2);
      fireEvent.click(checkboxes[1]);
      expect(onArrayFieldChange).toHaveBeenCalledWith(
        'inventory.magicItems',
        ['Wand of Magic'],
      );
    });

    it('removes an item from the selection when its checkbox is toggled off', () => {
      const onArrayFieldChange = vi.fn();
      render(
        <WizardStepMagicItems
          {...createProps({
            onArrayFieldChange,
          })}
        />,
      );
      // Wand is pre-selected. Click its checkbox to deselect.
      const checkboxes = document.querySelectorAll('.list-item-checkbox-trigger');
      expect(checkboxes.length).toBe(2);
      // Wand is at index 1 (sorted alphabetically after Amulet)
      fireEvent.click(checkboxes[1]);
      expect(onArrayFieldChange).toHaveBeenCalledWith(
        'inventory.magicItems',
        [],
      );
    });
  });

  describe('search and filtering', () => {
    it('filters items by search query matching item name', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      const searchInput = screen.getByRole('textbox');
      fireEvent.change(searchInput, { target: { value: 'Amulet' } });
      expect(screen.getByText('Amulet of Health')).toBeInTheDocument();
      expect(screen.queryByText('Wand of Magic')).not.toBeInTheDocument();
    });

    it('filters items by search query matching item index', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      const searchInput = screen.getByRole('textbox');
      fireEvent.change(searchInput, { target: { value: 'wand' } });
      expect(screen.getByText('Wand of Magic')).toBeInTheDocument();
      expect(screen.queryByText('Amulet of Health')).not.toBeInTheDocument();
    });

    it('updates the result count when filtering', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      const searchInput = screen.getByRole('textbox');
      fireEvent.change(searchInput, { target: { value: 'Amulet' } });
      expect(screen.getByText(/Showing 1 magic item/)).toBeInTheDocument();
    });

    it('filters by item type dropdown', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      const filterSelect = screen.getByLabelText('Item Type');
      fireEvent.change(filterSelect, { target: { value: 'Rod' } });
      expect(screen.getByText('Wand of Magic')).toBeInTheDocument();
      expect(screen.queryByText('Amulet of Health')).not.toBeInTheDocument();
    });

    it('shows only selected items when checkbox is checked', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      const checkbox = screen.getByRole('checkbox', {
        name: /show only selected/i,
      });
      fireEvent.click(checkbox);
      expect(screen.getByText('Wand of Magic')).toBeInTheDocument();
      expect(screen.queryByText('Amulet of Health')).not.toBeInTheDocument();
    });

    it('shows no results message when search has no matches', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      const searchInput = screen.getByRole('textbox');
      fireEvent.change(searchInput, { target: { value: 'Nonexistent' } });
      expect(
        screen.getByText(/No magic item found matching your criteria/),
      ).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('renders a loading message when allMagicItems is null', () => {
      render(
        <WizardStepMagicItems
          {...createProps({
            allMagicItems: null,
          })}
        />,
      );
      expect(
        screen.getByText('Magic item data not yet loaded. Please try again.'),
      ).toBeInTheDocument();
    });

    it('renders a loading message when allMagicItems is undefined', () => {
      render(
        <WizardStepMagicItems
          {...createProps({
            allMagicItems: undefined,
          })}
        />,
      );
      expect(
        screen.getByText('Magic item data not yet loaded. Please try again.'),
      ).toBeInTheDocument();
    });

    it('renders a loading message when allMagicItems is an empty array', () => {
      render(
        <WizardStepMagicItems
          {...createProps({
            allMagicItems: [],
          })}
        />,
      );
      expect(
        screen.getByText('Magic item data not yet loaded. Please try again.'),
      ).toBeInTheDocument();
    });

    it('handles missing formData.inventory gracefully', () => {
      render(
        <WizardStepMagicItems
          {...createProps({
            formData: {},
          })}
        />,
      );
      expect(screen.getByText('Step 10: Magic Items')).toBeInTheDocument();
    });

    it('handles items matched by index instead of name', () => {
      const indexedItem = {
        name: 'Staff of Power',
        index: 'staff',
        type: 'Staff',
        rarity: 'Very Rare',
        description: '<p>A powerful staff.</p>',
        requiresAttunement: false,
      };
      render(
        <WizardStepMagicItems
          {...createProps({
            formData: {
              inventory: { magicItems: ['staff'] },
            },
            allMagicItems: [indexedItem],
          })}
        />,
      );
      expect(screen.getByText('Staff of Power')).toBeInTheDocument();
    });

    it('renders items with string descriptions after expanding', () => {
      const stringDescItem = {
        name: 'Potion of Healing',
        index: 'potion',
        type: 'Potion',
        description: '<p>Restores 2d4+2 HP.</p>',
        requiresAttunement: false,
      };
      render(
        <WizardStepMagicItems
          {...createProps({
            allMagicItems: [stringDescItem],
          })}
        />,
      );
      expect(screen.getByText('Potion of Healing')).toBeInTheDocument();
      // Must click Show More to expand the description
      const showMoreBtn = screen.getByText('Show More');
      fireEvent.click(showMoreBtn);
      expect(screen.getByText(/Restores 2d4\+2 HP/)).toBeInTheDocument();
    });

    it('renders items with array descriptions after expanding', () => {
      const arrayDescItem = {
        name: 'Staff of Power',
        index: 'staff',
        type: 'Staff',
        rarity: 'Very Rare',
        description: [
          '<p>Can hold up to 5 charges.</p>',
          '<p>Regains 1d4+1 charges daily.</p>',
        ],
        requiresAttunement: true,
      };
      render(
        <WizardStepMagicItems
          {...createProps({
            allMagicItems: [arrayDescItem],
          })}
        />,
      );
      expect(screen.getByText('Staff of Power')).toBeInTheDocument();
      // Must click Show More to expand the description
      const showMoreBtn = screen.getByText('Show More');
      fireEvent.click(showMoreBtn);
      expect(screen.getByText(/Can hold up to 5 charges/)).toBeInTheDocument();
      expect(
        screen.getByText(/Regains 1d4\+1 charges daily/),
      ).toBeInTheDocument();
    });

    it('renders items with missing optional fields', () => {
      const minimalItem = {
        name: 'Odd Item',
        index: 'odd',
      };
      render(
        <WizardStepMagicItems
          {...createProps({
            allMagicItems: [minimalItem],
          })}
        />,
      );
      expect(screen.getByText('Odd Item')).toBeInTheDocument();
    });
  });
});
