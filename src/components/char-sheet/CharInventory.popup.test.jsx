import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRenderComponent } from './charInventory.test-utils.jsx';

describe('CharInventory item popup', () => {
  let helpers;

  beforeEach(() => {
    helpers = createRenderComponent();
    helpers.setup();
  });

  describe('name normalization', () => {
    it('should strip quantity from parentheses when clicking backpack items', async () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: [],
          backpack: ['Potion of Healing'],
        },
      };
      helpers.renderComponent(stats);
      await helpers.clickItemByText('Potion of Healing');
      const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('Potion of Healing');
    });

    it('should handle items with parentheses in the name by stripping the parenthetical', async () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: [],
          backpack: ['Rations (10)'],
        },
      };
      helpers.renderComponent(stats);
      await helpers.clickItemByText('Rations (10)');
      const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('Item details not found');
    });
  });

  describe('equipment lookup', () => {
    it('should find item by exact name or index match', async () => {
      helpers.setup([
        { name: 'Dagger', index: 'dagger' },
      ]);
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Dagger'],
          backpack: [],
        },
      };
      helpers.renderComponent(stats);
      await helpers.clickItemByText('Dagger');
      const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('<b>Dagger</b>');
    });

    it('should find item by plural-to-singular fallback and display resolved singular name', async () => {
      helpers.setup([
        { name: 'Dagger', index: 'dagger' },
      ]);
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Daggers'],
          backpack: [],
        },
      };
      helpers.renderComponent(stats);
      await helpers.clickItemByText('Daggers');
      const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('<b>Dagger</b>');
    });
  });

  describe('equipment detail rendering in popup', () => {
    it('should include cost, weight, and category in popup HTML', async () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Longsword'],
          backpack: [],
        },
      };
      helpers.renderComponent(stats);
      await helpers.clickItemByText('Longsword');
      const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('<b>Cost:</b>');
      expect(callArg).toContain('15 gp');
      expect(callArg).toContain('<b>Weight:</b>');
      expect(callArg).toContain('3');
      expect(callArg).toContain('<b>Category:</b>');
      expect(callArg).toContain('Martial Melee Weapons');
    });

    it('should include ability, utilize, and craft fields when present', async () => {
      helpers.setup([
        {
          name: 'Potion of Healing',
          index: 'potion-of-healing',
          desc: ['Restores hit points.', 'Doubles as an alchemy component.'],
          ability: 'Constitution',
          utilize: 'Drink',
          craft: 'Alchemy',
        },
      ]);
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Potion of Healing'],
          backpack: [],
        },
      };
      helpers.renderComponent(stats);
      await helpers.clickItemByText('Potion of Healing');
      const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('<b>Ability:</b>');
      expect(callArg).toContain('Constitution');
      expect(callArg).toContain('<b>Utilize:</b>');
      expect(callArg).toContain('Drink');
      expect(callArg).toContain('<b>Craft:</b>');
      expect(callArg).toContain('Alchemy');
    });

    it('should join array descriptions with <br/><br/>', async () => {
      helpers.setup([
        {
          name: 'Potion of Healing',
          index: 'potion-of-healing',
          desc: ['Restores hit points.', 'Doubles as an alchemy component.'],
        },
      ]);
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Potion of Healing'],
          backpack: [],
        },
      };
      helpers.renderComponent(stats);
      await helpers.clickItemByText('Potion of Healing');
      const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('Restores hit points.');
      expect(callArg).toContain('Doubles as an alchemy component.');
    });
  });

  describe('item not found', () => {
    it('should show "not found" message when item is not in equipment database', async () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Unobtainium Rod'],
          backpack: [],
        },
      };
      helpers.renderComponent(stats);
      await helpers.clickItemByText('Unobtainium Rod');
      const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('Unobtainium Rod');
      expect(callArg).toContain('not found in database');
    });

    it('should show "not found" when equipment data is empty or null', async () => {
      const { loadEquipment } = await import('../../services/ui/dataLoader.js');
      loadEquipment.mockResolvedValue([]);
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Longsword'],
          backpack: [],
        },
      };
      helpers.renderComponent(stats);
      await helpers.clickItemByText('Longsword');
      const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('not found in database');
    });
  });

  describe('error handling', () => {
    it('should log console.error and show error message when equipment loading throws', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { loadEquipment } = await import('../../services/ui/dataLoader.js');
      loadEquipment.mockRejectedValue(new Error('Network error'));
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Longsword'],
          backpack: [],
        },
      };
      helpers.renderComponent(stats);
      await helpers.clickItemByText('Longsword');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[CharInventory] Error loading equipment:',
        expect.any(Error)
      );
      const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('Error loading item details');
      expect(callArg).toContain('Network error');
      consoleErrorSpy.mockRestore();
    });
  });
});
