// CharInventory item lookup tests
//
// Tests in this file cover unique lookup normalization edge cases:
//   - Parentheses at start of name (no extraction)
//   - Multiple parenthetical groups in name
//
// Tests removed as duplicates already covered in:
//   CharInventory.popup.test.jsx - case-insensitive matching (line 44-65),
//     whitespace normalization via "Potion of Healing" (line 14-26),
//     index field matching (line 67-82),
//     parentheses extraction "Rations (10)" (line 28-40),
//     item not found behavior (line 189-202)
//   CharInventory.edgeCases.test.jsx - whitespace-only item names (line 47-51)
//   CharInventory.popup.pluralSingular.test.jsx - irregular plurals,
//     multi-word names with mid-name plural
//
// Removed tests (6):
//   REMOVE: case-insensitive lookup (duplicate of popup.test.jsx:44-65)
//   REMOVE: leading/trailing spaces (duplicate of edgeCases.test.jsx:47-51)
//   REMOVE: extra spaces between words (duplicate of popup.test.jsx:14-26)
//   REMOVE: tab characters (duplicate of "extra spaces" + fragile assertion)
//   REMOVE: index field normalization (duplicate of popup.test.jsx:67-82)
//   REMOVE: Item (N) format (duplicate of popup.test.jsx:28-40)
//   REMOVE: item not found after normalization (duplicate of popup.test.jsx:189-202)
//
// Kept tests (2):
//   KEEP: parentheses at start of name (unique edge case)
//   KEEP: multiple parenthetical groups (unique edge case)

import { describe, it, expect, beforeEach } from 'vitest';
import { createRenderComponent } from './charInventory.test-utils.jsx';

describe('CharInventory item lookup', () => {
  let helpers;

  beforeEach(() => {
    helpers = createRenderComponent();
    helpers.setup();
  });

  describe('parentheses edge cases', () => {
    it('should handle item name with parentheses at the start (no extraction)', async () => {
      helpers.setup([
        { name: '(Special) Item', index: 'special-item' },
      ]);
      const stats = { inventory: { magicItems: [], equipped: ['(Special) Item'], backpack: [] } };
      helpers.renderComponent(stats);
      await helpers.clickItemByText('(Special) Item');
      const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('<b>(Special) Item</b>');
    });

    it('should extract only text before first parentheses for multiple parenthetical groups', async () => {
      helpers.setup([
        { name: 'Box (Large) (Heavy)', index: 'box-large-heavy' },
      ]);
      const stats = { inventory: { magicItems: [], equipped: ['Box (Large) (Heavy)'], backpack: [] } };
      helpers.renderComponent(stats);
      await helpers.clickItemByText('Box (Large) (Heavy)');
      const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('<b>Box (Large) (Heavy)</b>');
    });
  });
});
