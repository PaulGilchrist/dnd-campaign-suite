// CharInventory equipment data edge cases
//
// Tests in this file cover behavior NOT already verified in other CharInventory test files:
//   - desc as non-array string (Array.isArray guard — unique behavioral assertion)
//
// Tests removed as duplicates already covered in:
//   CharInventory.popup.test.jsx - equipment loading failure (console.error + popup error message)
//   CharInventory.popup.test.jsx - weight:0 (falsy), cost:0 unit:'' (string interp),
//     ability/utilize/craft: '' (falsy checks)
import { describe, it, expect, beforeEach } from 'vitest';
import { createRenderComponent } from './charInventory.test-utils.jsx';

describe('CharInventory equipment data edge cases', () => {
  let helpers;

  beforeEach(() => {
    helpers = createRenderComponent();
    helpers.setup();
  });

  describe('desc as non-array', () => {
    it('should not render description when desc is a string instead of array', async () => {
      helpers.setup([
        { name: 'String Desc Item', index: 'string-desc-item', desc: 'A description string' },
      ]);
      const stats = { inventory: { magicItems: [], equipped: ['String Desc Item'], backpack: [] } };
      helpers.renderComponent(stats);
      await helpers.clickItemByText('String Desc Item');
      const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('<b>String Desc Item</b>');
      expect(callArg).not.toContain('A description string');
    });
  });
});
