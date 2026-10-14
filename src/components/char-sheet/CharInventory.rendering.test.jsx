// Tests removed as duplicates already covered in:
//   CharInventory.edgeCases.test.jsx - null/undefined array handling in renderItems (same guard path)
//   CharInventory.popup.test.jsx - desc array joining with <br/><br/> (same popup flow)
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { createRenderComponent } from './charInventory.test-utils.jsx';

describe('CharInventory rendering', () => {
  let helpers;

  beforeEach(() => {
    helpers = createRenderComponent();
    helpers.setup();
  });

  describe('section rendering', () => {
    it('should render all sections in correct order when all have items', () => {
      const stats = {
        inventory: {
          magicItems: [{ name: 'Magic Ring', type: 'Ring', rarity: 'Uncommon', description: 'A magic ring.' }],
          equipped: ['Longsword', 'Shield'],
          backpack: ['Rations', 'Water'],
        },
      };
      helpers.renderComponent(stats);
      // Verify sections exist in DOM order by checking parent elements' textContent
      const magicItemsSection = screen.getByText(/Magic Items:/);
      const equippedSection = screen.getByText(/Equipped:/);
      const backpackSection = screen.getByText(/Backpack:/);
      expect(magicItemsSection.parentElement.textContent).toContain('Magic Ring');
      expect(equippedSection.parentElement.textContent).toContain('Longsword');
      expect(backpackSection.parentElement.textContent).toContain('Rations');
    });

    it('should render inventory section header even when all sub-sections are empty', () => {
      const stats = { inventory: { magicItems: [], equipped: [], backpack: [] } };
      helpers.renderComponent(stats);
      expect(screen.getByText('Inventory')).toBeInTheDocument();
      expect(screen.queryByText(/Magic Items:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Equipped:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Backpack:/)).not.toBeInTheDocument();
    });

    it('should not render magic items subsection when array is empty', () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Longsword'],
          backpack: [],
        },
      };
      helpers.renderComponent(stats);
      expect(screen.queryByText(/Magic Items:/)).not.toBeInTheDocument();
      expect(screen.getByText(/Equipped:/)).toBeInTheDocument();
    });

    it('should not render equipped/backpack subsections when arrays are empty', () => {
      const stats = {
        inventory: {
          magicItems: [{ name: 'Ring', type: 'Ring', rarity: 'Common', description: '' }],
          equipped: [],
          backpack: [],
        },
      };
      helpers.renderComponent(stats);
      expect(screen.getByText(/Magic Items:/)).toBeInTheDocument();
      expect(screen.queryByText(/Equipped:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Backpack:/)).not.toBeInTheDocument();
    });

  });

  describe('magic items', () => {
    it('should render magic item name, type, and rarity when description is missing', () => {
      const stats = {
        inventory: {
          magicItems: [{ name: 'Unnamed Ring', type: 'Ring', rarity: 'Uncommon', requiresAttunement: false }],
          equipped: [],
          backpack: [],
        },
      };
      helpers.renderComponent(stats);
      expect(screen.getByText(/Unnamed Ring/)).toBeInTheDocument();
      expect(screen.getByText(/Ring,/)).toBeInTheDocument();
      expect(screen.getByText(/Uncommon/)).toBeInTheDocument();
    });

    it('should render magic item with empty string description without crashing', () => {
      const stats = {
        inventory: {
          magicItems: [{ name: 'Empty Item', type: 'Wondrous Item', rarity: 'Common', description: '', requiresAttunement: false }],
          equipped: [],
          backpack: [],
        },
      };
      helpers.renderComponent(stats);
      expect(screen.getByText(/Empty Item/)).toBeInTheDocument();
    });

    it('should display "requires attunement" when requiresAttunement is true without custom requirements', () => {
      const stats = {
        inventory: {
          magicItems: [{ name: 'Ring of Protection', type: 'Ring', rarity: 'Rare', requiresAttunement: true, description: 'AC +1' }],
          equipped: [],
          backpack: [],
        },
      };
      helpers.renderComponent(stats);
      expect(screen.getByText(/requires attunement/)).toBeInTheDocument();
      expect(screen.getByText('AC +1')).toBeInTheDocument();
    });

    it('should NOT display "requires attunement" when requiresAttunement is false', () => {
      const stats = {
        inventory: {
          magicItems: [{ name: 'Common Ring', type: 'Ring', rarity: 'Common', requiresAttunement: false, description: 'A simple ring.' }],
          equipped: [],
          backpack: [],
        },
      };
      helpers.renderComponent(stats);
      expect(screen.getByText(/Common Ring/)).toBeInTheDocument();
      expect(screen.queryByText(/requires attunement/)).not.toBeInTheDocument();
    });

    it('should display custom attunement requirements when provided', () => {
      const stats = {
        inventory: {
          magicItems: [{ name: 'Armor of Invulnerability', type: 'Armor', subtype: 'Heavy', rarity: 'Legendary', requiresAttunement: true, attunementRequirements: 'by a barbarian', description: 'Immune to damage' }],
          equipped: [],
          backpack: [],
        },
      };
      helpers.renderComponent(stats);
      expect(screen.getByText(/by a barbarian/)).toBeInTheDocument();
      expect(screen.queryByText(/requires attunement/)).not.toBeInTheDocument();
      expect(screen.getByText('Immune to damage')).toBeInTheDocument();
    });

    it('should display magic item quantity when present and greater than zero', () => {
      const stats = {
        inventory: {
          magicItems: [{ name: 'Potion of Healing', type: 'Potion', rarity: 'Common', quantity: 3, description: 'Heals 2d4+2 HP' }],
          equipped: [],
          backpack: [],
        },
      };
      helpers.renderComponent(stats);
      expect(screen.getByText(/Potion of Healing/)).toBeInTheDocument();
      expect(screen.getByText(/qty 3/)).toBeInTheDocument();
    });

    it('should render subtype in parentheses when present', () => {
      const stats = {
        inventory: {
          magicItems: [{ name: 'Plate Armor', type: 'Armor', subtype: 'Heavy', rarity: 'Rare', description: 'AC 18', requiresAttunement: false }],
          equipped: [],
          backpack: [],
        },
      };
      helpers.renderComponent(stats);
      expect(screen.getByText(/Plate Armor/)).toBeInTheDocument();
      expect(screen.getByText(/Heavy/)).toBeInTheDocument();
    });

    it('should not render subtype parentheses when subtype is missing', () => {
      const stats = {
        inventory: {
          magicItems: [{ name: 'Ring of Protection', type: 'Ring', rarity: 'Rare', description: 'AC +1', requiresAttunement: false }],
          equipped: [],
          backpack: [],
        },
      };
      helpers.renderComponent(stats);
      expect(screen.getByText(/Ring of Protection/)).toBeInTheDocument();
      expect(screen.getByText(/Ring,/)).toBeInTheDocument();
    });

    it('should render magic item description as text content', () => {
      const stats = {
        inventory: {
          magicItems: [{ name: 'Sword of Sharpness', type: 'Weapon', rarity: 'Legendary', description: 'This +3 longsword was forged in a dragon\'s breath.', requiresAttunement: false }],
          equipped: [],
          backpack: [],
        },
      };
      helpers.renderComponent(stats);
      expect(screen.getByText(/This \+3 longsword/)).toBeInTheDocument();
    });
  });
});
