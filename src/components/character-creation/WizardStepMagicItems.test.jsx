// @improved-by-ai
// @cleaned-by-ai
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepMagicItems from './WizardStepMagicItems.jsx';

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

    it('does not display a warning when attuned items are within or at the limit', () => {
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
            allMagicItems: baseMagicItems,
          })}
        />,
      );
      expect(
        screen.queryByText(/items requiring attunement/),
      ).not.toBeInTheDocument();
    });

    it('does not display a warning when selected items do not require attunement', () => {
      const nonAttunedItems = [
        { name: 'Wand', requiresAttunement: false },
        { name: 'Potion', requiresAttunement: false },
      ];
      render(
        <WizardStepMagicItems
          {...createProps({
            formData: {
              inventory: {
                magicItems: ['Wand', 'Potion'],
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

    it('uses the base limit of 3 when classSubtypes is null or class/subclass does not match', () => {
      const classSubtypes = [
        { className: 'Rogue', subtypes: [{ name: 'Assassin', class_levels: [] }] },
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
              class: { name: 'Wizard' },
              inventory: {
                magicItems: ['Boots', 'Cloak', 'Gloves', 'Ring'],
              },
            },
            allMagicItems: attunedItems,
            classSubtypes,
          })}
        />,
      );
      expect(
        screen.getByText(/maximum of 3 items/),
      ).toBeInTheDocument();
    });

    // CLA-374: 2024 wizard maps subtypes = cls.subclasses || cls.majors, and
    // 2024 Thief majors carry features[] flat (NO class_levels) — the +1 bonus
    // previously never fired and the cap stayed at 3 for lv13+ Thief.
    const thief2024Subtypes = [
      {
        className: 'Rogue',
        subtypes: [
          {
            name: 'Thief',
            subtitle: 'Skill and Precision',
            features: [
              { level: 3, name: 'Fast Hands' },
              { level: 13, name: 'Use Magic Device' },
            ],
          },
        ],
      },
    ];
    const fourAttuned = ['Boots', 'Cloak', 'Gloves', 'Ring'];

    it('CLA-374: raises the cap to 4 for 2024 Thief lv13+ (flat features[] shape, class.subclass)', () => {
      render(
        <WizardStepMagicItems
          {...createProps({
            formData: {
              class: { name: 'Rogue', subclass: { name: 'Thief' } },
              level: 20,
              inventory: { magicItems: fourAttuned },
            },
            allMagicItems: fourAttuned.map((name) => ({ name, requiresAttunement: true })),
            classSubtypes: thief2024Subtypes,
          })}
        />,
      );
      expect(screen.queryByText(/items requiring attunement/)).not.toBeInTheDocument();
    });

    it('CLA-374: honors class.major naming (2024 wizard normalization)', () => {
      render(
        <WizardStepMagicItems
          {...createProps({
            formData: {
              class: { name: 'Rogue', major: { name: 'Thief' } },
              level: 13,
              inventory: { magicItems: fourAttuned },
            },
            allMagicItems: fourAttuned.map((name) => ({ name, requiresAttunement: true })),
            classSubtypes: thief2024Subtypes,
          })}
        />,
      );
      expect(screen.queryByText(/items requiring attunement/)).not.toBeInTheDocument();
    });

    it('CLA-374: keeps base limit 3 below lv13 for 2024 Thief shape', () => {
      render(
        <WizardStepMagicItems
          {...createProps({
            formData: {
              class: { name: 'Rogue', subclass: { name: 'Thief' } },
              level: 12,
              inventory: { magicItems: fourAttuned },
            },
            allMagicItems: fourAttuned.map((name) => ({ name, requiresAttunement: true })),
            classSubtypes: thief2024Subtypes,
          })}
        />,
      );
      expect(screen.getByText(/maximum of 3 items/)).toBeInTheDocument();
    });

    it('CLA-374: keeps base limit 3 without the feature in the major', () => {
      render(
        <WizardStepMagicItems
          {...createProps({
            formData: {
              class: { name: 'Rogue', subclass: { name: 'Assassin' } },
              level: 20,
              inventory: { magicItems: fourAttuned },
            },
            allMagicItems: fourAttuned.map((name) => ({ name, requiresAttunement: true })),
            classSubtypes: [
              {
                className: 'Rogue',
                subtypes: [{ name: 'Assassin', features: [{ level: 3, name: 'Assassinate' }] }],
              },
            ],
          })}
        />,
      );
      expect(screen.getByText(/maximum of 3 items/)).toBeInTheDocument();
    });

    it('matches selected items by index when name lookup fails', () => {
      const items = [
        { name: 'Boots of Speed', index: 'boots-speed', requiresAttunement: true },
        { name: 'Cloak of Protection', index: 'cloak-protection', requiresAttunement: true },
        { name: 'Gloves of Thievery', index: 'gloves-thievery', requiresAttunement: true },
        { name: 'Ring of Spell Storing', index: 'ring-spell-storing', requiresAttunement: true },
      ];
      render(
        <WizardStepMagicItems
          {...createProps({
            formData: {
              inventory: {
                magicItems: ['boots-speed', 'cloak-protection', 'gloves-thievery', 'ring-spell-storing'],
              },
            },
            allMagicItems: items,
          })}
        />,
      );
      expect(
        screen.getByText(/items requiring attunement/),
      ).toBeInTheDocument();
    });
  });

  describe('item display', () => {
    it('shows attunement badge on items that require attunement', () => {
      render(<WizardStepMagicItems {...createProps()} />);
      expect(screen.getByText('requires attunement')).toBeInTheDocument();
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

    it('renders item type and rarity when present, and omits them when missing', () => {
      const itemsWithTypeAndRarity = [
        { name: 'Ring of Protection', index: 'ring', type: 'Ring', rarity: 'Rare', description: 'AC +1' },
      ];
      render(
        <WizardStepMagicItems
          {...createProps({
            allMagicItems: itemsWithTypeAndRarity,
          })}
        />,
      );
      expect(screen.getByText('Ring of Protection')).toBeInTheDocument();
      const magicItem = screen.getByText('Ring of Protection').closest('.magic-item');
      expect(magicItem.querySelector('.magic-item-type')).toHaveTextContent('Ring');
      expect(magicItem.querySelector('.magic-item-rarity')).toHaveTextContent('Rare');

      const minimalItem = {
        name: 'Mysterious Artifact',
        index: 'artifact',
      };
      render(
        <WizardStepMagicItems
          {...createProps({
            allMagicItems: [minimalItem],
          })}
        />,
      );
      expect(screen.getByText('Mysterious Artifact')).toBeInTheDocument();
      expect(screen.queryByText('requires attunement')).not.toBeInTheDocument();
    });
  });

  describe('item selection', () => {
    it('calls onArrayFieldChange to add an unselected item when its checkbox is clicked', () => {
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

    it('calls onArrayFieldChange to remove a selected item when its checkbox is clicked', () => {
      const onArrayFieldChange = vi.fn();
      render(
        <WizardStepMagicItems
          {...createProps({
            onArrayFieldChange,
            formData: {
              inventory: {
                magicItems: ['Wand of Magic', 'Amulet of Health'],
              },
            },
          })}
        />,
      );

      const checkboxes = document.querySelectorAll('.list-item-checkbox-trigger');
      expect(checkboxes.length).toBe(2);

      // Items are sorted alphabetically: Amulet of Health first, Wand of Magic second
      // Both are selected; clicking the first (Amulet) removes it
      fireEvent.click(checkboxes[0]);
      expect(onArrayFieldChange).toHaveBeenCalledWith(
        'inventory.magicItems',
        ['Wand of Magic'],
      );
    });
  });

  describe('item lookup', () => {
    it('matches selected items by index when the item name differs', () => {
      const items = [
        { name: 'Wand of Magic', index: 'wand', requiresAttunement: false },
        { name: 'Amulet of Health', index: 'amulet', requiresAttunement: true },
      ];
      // Select by index instead of name
      render(
        <WizardStepMagicItems
          {...createProps({
            formData: {
              inventory: {
                magicItems: ['amulet'],
              },
            },
            allMagicItems: items,
          })}
        />,
      );
      // The item should be recognized as selected via index lookup
      expect(screen.getByText(/1 selected/)).toBeInTheDocument();
    });
  });
});
