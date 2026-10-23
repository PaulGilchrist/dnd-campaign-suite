// @maintained-by-ai
// CharInventory equipment-data guards in the popup builder (seam unique to this file):
//   - desc as a non-array string is dropped by the Array.isArray guard in
//     buildItemPopupHtml (CharInventory.jsx) — the popup still renders the item
//     cleanly via the guard branch, not the catch branch.
//   - weight: 0 renders "Weight: 0" in buildPropertyLines (CharInventory.jsx):
//     the field-presence guard (`item.weight != null`) mirrors the cost arm's
//     zero-honesty — public/data/equipment.json ships real weight:0 rows
//     (Alms box :127, Antitoxin (vial) :167, Bell :467) just as a zero-quantity
//     cost object renders "Cost: 0 gp" (edgeCases.test.jsx). Absent/null weight
//     stays hidden, symmetric with the cost arm's absent/null omission.
//
// Not duplicated here (covered by siblings):
//   popup.test.jsx — cost/weight/category and ability/utilize/craft when truthy,
//     desc array joining, "not found", and load-error handling.
//   edgeCases.test.jsx — cost null vs zero-quantity object; blank array elements.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRenderComponent } from './charInventory.test-utils.jsx';
import realEquipment from '../../../public/data/equipment.json';

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

  it('renders the Weight line for weight 0, honouring present-zero like the cost arm, while an absent weight stays hidden', async () => {
    helpers.setup([
      {
        name: 'Zero Weight Item',
        index: 'zero-weight-item',
        cost: { quantity: 5, unit: 'gp' },
        weight: 0,
        equipment_category: 'Adventuring Gear',
      },
      {
        name: 'No Weight Field Item',
        index: 'no-weight-field-item',
        cost: { quantity: 2, unit: 'gp' },
        equipment_category: 'Adventuring Gear',
      },
    ]);
    const stats = { inventory: { magicItems: [], equipped: ['Zero Weight Item', 'No Weight Field Item'], backpack: [] } };
    helpers.renderComponent(stats);
    // Regex because the first item's span text includes the ', ' separator.
    await helpers.clickItemByText(/^Zero Weight Item/);
    const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
    expect(callArg).toContain('<b>Zero Weight Item</b>');
    // Symmetric honor (owner ruling 2026-10-22): a genuine weight:0 renders
    // "Weight: 0" in the same house format as non-zero ("Weight: 3").
    expect(callArg).toContain('<b>Weight:</b> 0');
    // Truthy neighbours prove nothing was displaced by the zero line.
    expect(callArg).toContain('<b>Cost:</b> 5 gp');
    expect(callArg).toContain('<b>Category:</b> Adventuring Gear');
    // Absence arm: no weight field means no Weight line — symmetric with the
    // cost arm omitting an absent/null cost object (edgeCases.test.jsx).
    await helpers.clickItemByText('No Weight Field Item');
    const absentArg = helpers.setPopupHtmlSpy.mock.calls[1][0];
    expect(absentArg).toContain('<b>No Weight Field Item</b>');
    expect(absentArg).not.toContain('Weight:');
    expect(absentArg).toContain('<b>Cost:</b> 2 gp');
  });

  it('renders "Weight: 0" for a genuine zero-weight row from public/data/equipment.json', async () => {
    // Real disk data: Alms box (equipment.json :120-127) ships "weight": 0.
    const almsBox = realEquipment.find(e => e.name === 'Alms box');
    expect(almsBox).toBeDefined();
    expect(almsBox.weight).toBe(0);
    helpers.setup([almsBox]);
    const stats = { inventory: { magicItems: [], equipped: ['Alms box'], backpack: [] } };
    helpers.renderComponent(stats);
    await helpers.clickItemByText('Alms box');
    const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
    // Pre-fix this popup carried "Cost: 0 cp" yet no Weight line at all —
    // the asymmetry the field-presence guard now closes.
    expect(callArg).toContain('<b>Weight:</b> 0');
    expect(callArg).toContain('<b>Cost:</b> 0 cp');
  });
});
