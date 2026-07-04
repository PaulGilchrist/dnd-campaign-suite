// @cleaned-by-ai
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
    it('renders the step title, items, search input, type filter, selected checkbox, and result count', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      expect(screen.getByText('Step 10: Magic Items')).toBeInTheDocument();
      expect(screen.getByText('Amulet of Health')).toBeInTheDocument();
      expect(screen.getByText('Wand of Magic')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Search magic items...');
      expect(screen.getByLabelText('Item Type')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /show only selected/i })).toBeInTheDocument();
      expect(screen.getByText(/Showing 2 magic items/)).toBeInTheDocument();
    });

    it('shows attunement badge on items that require attunement', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      expect(screen.getByText('requires attunement')).toBeInTheDocument();
    });

    it('shows a loading message when items are unavailable', () => {
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
  });

  describe('item display', () => {
    it('expands and collapses item description on Show More / Show Less toggle', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      const showMoreButtons = screen.getAllByText('Show More');
      expect(showMoreButtons.length).toBe(2);

      fireEvent.click(showMoreButtons[0]);
      expect(screen.getByText(/Health amulet/)).toBeInTheDocument();
      expect(screen.getByText('Show Less')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Show Less'));
      expect(screen.queryByText(/Health amulet/)).not.toBeInTheDocument();
      expect(screen.getAllByText('Show More').length).toBe(2);
    });

    it('handles items with missing optional fields gracefully', () => {
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
    it('displays a warning when selected attuned items exceed the limit', () => {
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

    it('does not display a warning when attuned items are within the limit', () => {
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

    it('increases the attunement limit for Thief Rogue level 13+', () => {
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

    it('does not warn when Thief Rogue level 13+ is at the extended limit', () => {
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
  });

  describe('item selection', () => {
    it('calls onArrayFieldChange to add an item when an unselected checkbox is clicked', () => {
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

      // Amulet of Health is unselected; clicking adds it to the array
      fireEvent.click(checkboxes[0]);
      expect(onArrayFieldChange).toHaveBeenCalledWith(
        'inventory.magicItems',
        ['Wand of Magic', 'Amulet of Health'],
      );
    });
  });

  describe('search and filtering', () => {
    it('filters items by search query', () => {
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

    it('shows only selected items when the filter checkbox is enabled', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      const checkbox = screen.getByRole('checkbox', {
        name: /show only selected/i,
      });
      fireEvent.click(checkbox);
      expect(screen.getByText('Wand of Magic')).toBeInTheDocument();
      expect(screen.queryByText('Amulet of Health')).not.toBeInTheDocument();
    });
  });
});
