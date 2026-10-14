// CharInventory edge cases and special scenarios
//
// This file contains truly unique edge case tests not covered by other CharInventory test files:
//   - cost: null (falsy null distinct from cost: { quantity: 0, unit: '' } which is truthy)
//   - Empty string item names in inventory arrays (array element, not null/undefined array)
//   - Clicking an empty string item shows "not found"
//
// Tests removed as duplicates already covered in:
//   CharInventory.equipmentData.test.jsx - desc as string (covers desc: undefined via same Array.isArray path),
//     weight: 0 (covers weight: undefined via same falsy check),
//     cost with zero quantity (covers cost: null via same falsy check)
//   CharInventory.rendering.test.jsx - negative quantity (same qty rendering path as positive qty),
//     missing type (same missing optional field rendering as missing description)
//   CharInventory.popup.test.jsx - HTML chars in item name (asserts "not found", same as other missing item tests)
//   CharInventory.edgeCases.test.jsx itself - empty string in backpack (duplicate of empty string in equipped)

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { createRenderComponent } from './charInventory.test-utils.jsx';

describe('CharInventory edge cases', () => {
  let helpers;

  beforeEach(() => {
    helpers = createRenderComponent();
    helpers.setup();
  });

  describe('null/undefined field values', () => {
    it('should omit cost section when cost is explicitly null', async () => {
      helpers.setup([
        { name: 'Null Cost Item', index: 'null-cost-item', cost: null, weight: 2 },
      ]);
      const stats = { inventory: { magicItems: [], equipped: ['Null Cost Item'], backpack: [] } };
      helpers.renderComponent(stats);
      await helpers.clickItemByText('Null Cost Item');
      const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('<b>Null Cost Item</b>');
      expect(callArg).not.toContain('<b>Cost:</b>');
      expect(callArg).toContain('<b>Weight:</b>');
    });
  });

  describe('empty and special item names', () => {
    it('should handle empty string in equipped array without crashing', () => {
      const stats = { inventory: { magicItems: [], equipped: [''], backpack: [] } };
      helpers.renderComponent(stats);
      expect(screen.getByText('Inventory')).toBeInTheDocument();
    });

    it('should show not found when clicking an empty string item', async () => {
      helpers.setup([
        { name: 'Longsword', index: 'longsword' },
      ]);
      const stats = { inventory: { magicItems: [], equipped: [''], backpack: [] } };
      helpers.renderComponent(stats);
      // Empty string renders as empty span; find it by class
      const emptySpan = screen.getByText((content, element) =>
        element && element.classList.contains('clickable') && element.textContent === ''
      );
      fireEvent.click(emptySpan);
      await waitFor(() => {
        expect(helpers.setPopupHtmlSpy).toHaveBeenCalled();
      });
      const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('not found in database');
    });
  });
});
