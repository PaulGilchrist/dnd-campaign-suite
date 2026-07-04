// @improved-by-ai
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepMagicItems from './WizardStepMagicItems.jsx';

// Mock sanitize to pass through HTML unchanged
vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

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
    it('renders the step title, each magic item name, search input, type filter, and result count', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      expect(screen.getByText('Step 10: Magic Items')).toBeInTheDocument();
      expect(screen.getByText('Amulet of Health')).toBeInTheDocument();
      expect(screen.getByText('Wand of Magic')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Search magic items...');
      expect(screen.getByLabelText('Item Type')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /show only selected/i })).toBeInTheDocument();
      expect(screen.getByText(/Showing 2 magic items/)).toBeInTheDocument();
    });

    it('renders the attunement badge on items that require attunement', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      expect(screen.getByText('requires attunement')).toBeInTheDocument();
    });
  });

  describe('item display', () => {
    it('renders Show More button and reveals description after clicking', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      const showMoreButtons = screen.getAllByText('Show More');
      expect(showMoreButtons.length).toBe(2);

      fireEvent.click(showMoreButtons[0]);
      expect(screen.getByText(/Health amulet/)).toBeInTheDocument();
      expect(screen.getByText('Show Less')).toBeInTheDocument();
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
      const showMoreBtns = screen.getAllByText('Show More');
      fireEvent.click(showMoreBtns[0]);
      expect(screen.getByText(/Restores 2d4\+2 HP/)).toBeInTheDocument();

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
                { level: 13, features: [{ name: 'Impostor' }] },
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
    it('filters items by search query and type dropdown', () => {
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
