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
    it('renders the step title and each magic item name', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      expect(screen.getByText('Step 10: Magic Items')).toBeInTheDocument();
      expect(screen.getByText('Amulet of Health')).toBeInTheDocument();
      expect(screen.getByText('Wand of Magic')).toBeInTheDocument();
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

    it('renders the attunement badge on items that require attunement', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      expect(screen.getByText('requires attunement')).toBeInTheDocument();
    });
  });

  describe('item display', () => {
    it('renders Show More button for collapsed items', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      const showMoreButtons = screen.getAllByText('Show More');
      expect(showMoreButtons.length).toBe(2);
    });

    it('clicking Show More toggles to Show Less and reveals description', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      const showMoreButtons = screen.getAllByText('Show More');
      fireEvent.click(showMoreButtons[0]);
      expect(screen.getByText(/Health amulet/)).toBeInTheDocument();
      expect(screen.getByText('Show Less')).toBeInTheDocument();
    });

    it('renders the expanded item description after clicking Show More', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      const showMoreButtons = screen.getAllByText('Show More');
      fireEvent.click(showMoreButtons[1]);
      expect(screen.getByText(/magic wand/)).toBeInTheDocument();
    });

    it('renders multi-line descriptions with second paragraph visible after expand', () => {
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
      const showMoreBtn = screen.getByText('Show More');
      fireEvent.click(showMoreBtn);
      expect(screen.getByText(/Second paragraph/)).toBeInTheDocument();
    });

    it('renders items with string and array descriptions after expanding', () => {
      const stringDescItem = {
        name: 'Potion of Healing',
        index: 'potion',
        type: 'Potion',
        description: '<p>Restores 2d4+2 HP.</p>',
        requiresAttunement: false,
      };
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
            allMagicItems: [stringDescItem, arrayDescItem],
          })}
        />,
      );
      // Both items start as "Potion of Healing" and "Staff of Power" alphabetically
      // Click Potion's Show More (index 0)
      const showMoreBtns = screen.getAllByText('Show More');
      fireEvent.click(showMoreBtns[0]);
      expect(screen.getByText(/Restores 2d4\+2 HP/)).toBeInTheDocument();
      // Now Potion shows "Show Less", Staff still shows "Show More"
      // Click Staff's Show More (the only remaining "Show More")
      const staffShowMore = screen.getByText('Show More');
      fireEvent.click(staffShowMore);
      expect(screen.getByText(/Can hold up to 5 charges/)).toBeInTheDocument();
      expect(screen.getByText(/Regains 1d4\+1 charges daily/)).toBeInTheDocument();
    });

    it('renders items with missing optional fields gracefully', () => {
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

    it('displays a warning with limit of 4 when Thief Rogue level 13+ exceeds limit', () => {
      const thiefClassSubtypes = [
        {
          className: 'Rogue',
          subtypes: [
            {
              name: 'Thief',
              class_levels: [
                { level: 3, features: [{ name: 'Fast Hands' }] },
                { level: 9, features: [{ name: 'Supreme Sneak' }] },
                { level: 13, features: [{ name: 'Use Magic Device' }] },
                { level: 17, features: [{ name: "Thief's Reflexes" }] },
              ],
            },
          ],
        },
      ];

      const attunedItems = [
        { name: 'Boots', requiresAttunement: true },
        { name: 'Cloak', requiresAttunement: true },
        { name: 'Gloves', requiresAttunement: true },
        { name: 'Ring', requiresAttunement: true },
        { name: 'Amulet', requiresAttunement: true },
      ];

      render(
        <WizardStepMagicItems
          {...createProps({
            formData: {
              class: { name: 'Rogue', subclass: { name: 'Thief' } },
              level: 13,
              inventory: {
                magicItems: ['Boots', 'Cloak', 'Gloves', 'Ring', 'Amulet'],
              },
            },
            allMagicItems: attunedItems,
            classSubtypes: thiefClassSubtypes,
          })}
        />,
      );

      const warningText =
        'You have selected 5 items requiring attunement, but a character can only attune to a maximum of 4 items.';
      expect(screen.getByText(warningText)).toBeInTheDocument();
    });

    it('does not display a warning when 4 attuned items are selected for Thief Rogue level 13+', () => {
      const thiefClassSubtypes = [
        {
          className: 'Rogue',
          subtypes: [
            {
              name: 'Thief',
              class_levels: [
                { level: 13, features: [{ name: 'Use Magic Device' }] },
              ],
            },
          ],
        },
      ];

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
              class: { name: 'Rogue', subclass: { name: 'Thief' } },
              level: 13,
              inventory: {
                magicItems: ['Boots', 'Cloak', 'Gloves', 'Ring'],
              },
            },
            allMagicItems: attunedItems,
            classSubtypes: thiefClassSubtypes,
          })}
        />,
      );

      expect(
        screen.queryByText(/maximum of 4 items/),
      ).not.toBeInTheDocument();
    });

    it('uses limit of 3 for non-Thief subclasses', () => {
      const assassinClassSubtypes = [
        {
          className: 'Rogue',
          subtypes: [
            {
              name: 'Assassin',
              class_levels: [
                { level: 3, features: [{ name: 'Assassinate' }] },
                { level: 9, features: [{ name: 'Infiltration Attacks' }] },
                { level: 13, features: [{ name: 'Impostor' }] },
                { level: 17, features: [{ name: 'Operation: Syke' }] },
              ],
            },
          ],
        },
      ];

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
              class: { name: 'Rogue', subclass: { name: 'Assassin' } },
              level: 13,
              inventory: {
                magicItems: ['Boots', 'Cloak', 'Gloves', 'Ring'],
              },
            },
            allMagicItems: attunedItems,
            classSubtypes: assassinClassSubtypes,
          })}
        />,
      );

      const warningText =
        'You have selected 4 items requiring attunement, but a character can only attune to a maximum of 3 items.';
      expect(screen.getByText(warningText)).toBeInTheDocument();
    });

    it('uses limit of 3 when classSubtypes is null', () => {
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
              class: { name: 'Rogue', subclass: { name: 'Thief' } },
              level: 13,
              inventory: {
                magicItems: ['Boots', 'Cloak', 'Gloves', 'Ring'],
              },
            },
            allMagicItems: attunedItems,
            classSubtypes: null,
          })}
        />,
      );

      const warningText =
        'You have selected 4 items requiring attunement, but a character can only attune to a maximum of 3 items.';
      expect(screen.getByText(warningText)).toBeInTheDocument();
    });

    it('uses limit of 3 when Thief character is below level 13', () => {
      const thiefClassSubtypes = [
        {
          className: 'Rogue',
          subtypes: [
            {
              name: 'Thief',
              class_levels: [
                { level: 13, features: [{ name: 'Use Magic Device' }] },
              ],
            },
          ],
        },
      ];

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
              class: { name: 'Rogue', subclass: { name: 'Thief' } },
              level: 9,
              inventory: {
                magicItems: ['Boots', 'Cloak', 'Gloves', 'Ring'],
              },
            },
            allMagicItems: attunedItems,
            classSubtypes: thiefClassSubtypes,
          })}
        />,
      );

      const warningText =
        'You have selected 4 items requiring attunement, but a character can only attune to a maximum of 3 items.';
      expect(screen.getByText(warningText)).toBeInTheDocument();
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
      const checkboxes = document.querySelectorAll('.list-item-checkbox-trigger');
      expect(checkboxes.length).toBe(2);
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
  });

  describe('edge cases', () => {
    it('renders a loading message when items are unavailable', () => {
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
  });
});
