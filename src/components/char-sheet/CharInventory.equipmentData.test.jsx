// @maintained-by-ai
// CharInventory equipment-data guards in the popup builder (seam unique to this file):
//   - desc as a non-array string is dropped by the Array.isArray guard in
//     buildItemPopupHtml (CharInventory.jsx) — the popup still renders the item
//     cleanly via the guard branch, not the catch branch.
//   - weight: 0 is falsy and omits the Weight line in buildPropertyLines
//     (CharInventory.jsx), even though public/data/equipment.json ships real
//     weight:0 items; a zero-quantity cost object DOES render "Cost: 0 gp"
//     (edgeCases.test.jsx) — this pins that truthiness asymmetry honestly.
//
// Not duplicated here (covered by siblings):
//   popup.test.jsx — cost/weight/category and ability/utilize/craft when truthy,
//     desc array joining, "not found", and load-error handling.
//   edgeCases.test.jsx — cost null vs zero-quantity object; blank array elements.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRenderComponent } from './charInventory.test-utils.jsx';

describe('CharInventory equipment data edge cases', () => {
  let helpers;

  beforeEach(() => {
    helpers = createRenderComponent();
    helpers.setup();
  });

  it('drops a non-array string desc via the Array.isArray guard and still opens the popup without an error', async () => {
    helpers.setup([
      { name: 'String Desc Item', index: 'string-desc-item', desc: 'A description string' },
    ]);
    const stats = { inventory: { magicItems: [], equipped: ['String Desc Item'], backpack: [] } };
    helpers.renderComponent(stats);
    await helpers.clickItemByText('String Desc Item');
    const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
    expect(callArg).toContain('<b>String Desc Item</b>');
    expect(callArg).not.toContain('A description string');
    // Proves the guard branch handled it — without Array.isArray, .map on a
    // string would throw and the catch-branch error popup would appear instead.
    expect(callArg).not.toContain('Error loading item details');
  });

  it('omits the Weight line when weight is 0 (falsy) while truthy properties still render', async () => {
    helpers.setup([
      {
        name: 'Zero Weight Item',
        index: 'zero-weight-item',
        cost: { quantity: 5, unit: 'gp' },
        weight: 0,
        equipment_category: 'Adventuring Gear',
      },
    ]);
    const stats = { inventory: { magicItems: [], equipped: ['Zero Weight Item'], backpack: [] } };
    helpers.renderComponent(stats);
    await helpers.clickItemByText('Zero Weight Item');
    const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
    expect(callArg).toContain('<b>Zero Weight Item</b>');
    expect(callArg).not.toContain('Weight:');
    // Truthy neighbours prove the omission is selective, not a dropped block.
    expect(callArg).toContain('<b>Cost:</b> 5 gp');
    expect(callArg).toContain('<b>Category:</b> Adventuring Gear');
  });
});
