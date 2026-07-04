// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharInventory from './CharInventory.jsx';

// Mock the dataLoader service
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn(),
  clearDataCache: vi.fn(),
}));

// Mock the usePopup hook
vi.mock('../../hooks/combat/usePopup.js', () => ({
  default: vi.fn(),
}));

// Mock the sanitize service
vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

import usePopup from '../../hooks/combat/usePopup.js';
import { loadEquipment } from '../../services/ui/dataLoader.js';

const mockEquipmentData = [
  {
    name: 'Longsword',
    index: 'longsword',
    desc: ['A common sword.'],
    cost: { quantity: 15, unit: 'gp' },
    weight: 3,
    equipment_category: 'Martial Melee Weapons',
  },
  {
    name: 'Shield',
    index: 'shield',
    desc: ['A defensive item.'],
    cost: { quantity: 10, unit: 'gp' },
    weight: 6,
    equipment_category: 'Armor',
  },
];

const basePlayerStats = {
  inventory: {
    magicItems: [
      {
        name: 'Magic Sword',
        quantity: 1,
        type: 'Weapon',
        subtype: 'Longsword',
        rarity: 'Uncommon',
        description: 'A magical sword that glows.',
        requiresAttunement: true,
        attunementRequirements: 'Warrior',
      },
    ],
    equipped: ['Longsword', 'Shield'],
    backpack: ['Rations (10)', 'Healing Potion'],
  },
};

function renderComponent(playerStats = basePlayerStats) {
  return render(<CharInventory playerStats={playerStats} />);
}

describe('CharInventory item popup', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    usePopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
    }));

    loadEquipment.mockResolvedValue(mockEquipmentData);
  });

  describe('equipment lookup', () => {
    it('should show popup with equipment details when an item is clicked', async () => {
      renderComponent();

      const equippedSection = screen.getByText(/Equipped:/).parentElement;
      const longswordElement = equippedSection.querySelector('.clickable');
      fireEvent.click(longswordElement);

      await waitFor(() => {
        expect(usePopup.mock.results[0].value.setPopupHtml).toHaveBeenCalled();
      });

      const popupContent = usePopup.mock.results[0].value.setPopupHtml.mock.calls[0][0];
      expect(popupContent).toContain('Longsword');
      expect(popupContent).toContain('A common sword');
      expect(popupContent).toContain('Cost:');
      expect(popupContent).toContain('15 gp');
      expect(popupContent).toContain('Weight:');
      expect(popupContent).toContain('Category:');
    });

    it('should show error popup when loadEquipment rejects', async () => {
      loadEquipment.mockRejectedValue(new Error('Network error'));

      renderComponent();

      const shieldElement = screen.getByText('Shield');
      fireEvent.click(shieldElement);

      await waitFor(() => {
        expect(usePopup.mock.results[0].value.setPopupHtml).toHaveBeenCalled();
      });

      const popupContent = usePopup.mock.results[0].value.setPopupHtml.mock.calls[0][0];
      expect(popupContent).toContain('Error loading item details');
      expect(popupContent).toContain('Network error');
    });

    it('should show not-found popup when item is not in equipment database', async () => {
      renderComponent();

      const healingPotionElement = screen.getByText('Healing Potion');
      fireEvent.click(healingPotionElement);

      await waitFor(() => {
        expect(usePopup.mock.results[0].value.setPopupHtml).toHaveBeenCalled();
      });

      const popupContent = usePopup.mock.results[0].value.setPopupHtml.mock.calls[0][0];
      expect(popupContent).toContain('Healing Potion');
      expect(popupContent).toContain('not found in database');
    });
  });

  describe('item properties display', () => {
    it('should display properties that are present and omit those that are not', async () => {
      const dataWithAllProps = [
        {
          ...mockEquipmentData[0],
          ability: 'Strength',
          utilize: 'Dexterity (Dex) check',
          craft: 'Smiths tools',
        },
      ];

      loadEquipment.mockResolvedValue(dataWithAllProps);

      renderComponent();

      const equippedSection = screen.getByText(/Equipped:/).parentElement;
      const longswordElement = equippedSection.querySelector('.clickable');
      fireEvent.click(longswordElement);

      await waitFor(() => {
        const callArg = usePopup.mock.results[0].value.setPopupHtml.mock.calls[0][0];
        expect(callArg).toContain('Cost:');
        expect(callArg).toContain('Weight:');
        expect(callArg).toContain('Category:');
        expect(callArg).toContain('Ability:');
        expect(callArg).toContain('Utilize:');
        expect(callArg).toContain('Craft:');
      });

      vi.clearAllMocks();

      const dataWithMinimalProps = [
        {
          name: 'Simple Item',
          index: 'simple-item',
          desc: ['A simple item.'],
        },
      ];

      loadEquipment.mockResolvedValue(dataWithMinimalProps);

      renderComponent({
        inventory: { equipped: ['Simple Item'], backpack: [] },
      });

      const simpleItemElement = screen.getByText('Simple Item');
      fireEvent.click(simpleItemElement);

      await waitFor(() => {
        const callArg = usePopup.mock.results[0].value.setPopupHtml.mock.calls[0][0];
        expect(callArg).toContain('Simple Item');
        expect(callArg).toContain('A simple item');
        expect(callArg).not.toContain('Cost:');
        expect(callArg).not.toContain('Weight:');
        expect(callArg).not.toContain('Category:');
        expect(callArg).not.toContain('Ability:');
        expect(callArg).not.toContain('Utilize:');
        expect(callArg).not.toContain('Craft:');
      });
    });
  });
});
