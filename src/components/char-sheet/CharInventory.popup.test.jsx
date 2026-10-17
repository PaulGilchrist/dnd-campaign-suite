// @maintained-by-ai
// CharInventory popup wording — canonical file for the popup's found/not-found/error
// text and the findEquipmentItem lookup lanes (seam map in CharInventory.edgeCases.test.jsx):
//   - found via INDEX when the database name differs (exact-NAME match is pinned by
//     edgeCases/itemMeta siblings; here the differing name makes index the only lane
//     that can produce the popup, and the full cost/weight/category property lines
//     ride the same path).
//   - plural↔singular fallback both directions (Daggers→Dagger, Halberd→Halberds).
//   - compound lane: parenthetical-quantity extraction feeding the plural→singular
//     fallback ("Rations (10)" → "Ration") — pins that extraction happens BEFORE the
//     plural check. Plain extraction lives in itemLookup; plain plural in this file.
//   - "not found" for a DB miss, for null equipment data (guard branch, proven by the
//     absence of the catch-branch error text), and the load-error catch branch.
//
// Removed as redundant: "strip quantity from parentheses" test clicked "Potion of
// Healing" (no parentheses at all) and asserted only the echoed title — an exact-name
// found click, weaker than the siblings that own that lane.
// Consolidated: ability/utilize/craft + desc-array joining (same fixture, same
// execution path) into one test asserting the literal "<br/><br/>" join.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { createRenderComponent } from './charInventory.test-utils.jsx';

describe('CharInventory item popup', () => {
  let helpers;

  beforeEach(() => {
    helpers = createRenderComponent();
    helpers.setup();
  });

  it('should find an item by its index when only the database name differs, and render full details', async () => {
    helpers.setup([
      {
        name: 'Masterwork Longsword',
        index: 'longsword',
        desc: ['A common sword.'],
        cost: { quantity: 15, unit: 'gp' },
        weight: 3,
        equipment_category: 'Martial Melee Weapons',
      },
    ]);
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
    // Found via index: the popup shows the database title, not the raw inventory name.
    expect(callArg).toContain('<b>Masterwork Longsword</b>');
    expect(callArg).toContain('A common sword.');
    expect(callArg).not.toContain('<b>Longsword</b>');
    expect(callArg).not.toContain('not found in database');
    expect(callArg).toContain('<b>Cost:</b> 15 gp');
    expect(callArg).toContain('<b>Weight:</b> 3');
    expect(callArg).toContain('<b>Category:</b> Martial Melee Weapons');
  });

  it('should fall back plural-to-singular and singular-to-plural, showing the resolved database name', async () => {
    helpers.setup([
      { name: 'Dagger', index: 'dagger', desc: ['A simple knife.'] },
      { name: 'Halberds', index: 'halberds', desc: ['Polearm weapons.'] },
    ]);
    const stats = {
      inventory: {
        magicItems: [],
        equipped: ['Halberd', 'Daggers'],
        backpack: [],
      },
    };
    helpers.renderComponent(stats);
    // Plural inventory name resolves to the singular DB entry.
    await helpers.clickItemByText('Daggers');
    const daggerPopup = helpers.setPopupHtmlSpy.mock.calls[0][0];
    expect(daggerPopup).toContain('<b>Dagger</b>');
    expect(daggerPopup).toContain('A simple knife.');
    expect(daggerPopup).not.toContain('not found in database');

    // Singular inventory name resolves to the plural DB entry.
    // The first span's text carries the ", " list separator — match by regex.
    fireEvent.click(screen.getByText(/^Halberd/));
    await waitFor(() => {
      expect(helpers.setPopupHtmlSpy.mock.calls.length).toBe(2);
    });
    const halberdPopup = helpers.setPopupHtmlSpy.mock.calls[1][0];
    expect(halberdPopup).toContain('<b>Halberds</b>');
    expect(halberdPopup).toContain('Polearm weapons.');
    expect(halberdPopup).not.toContain('not found in database');
  });

  it('should strip a parenthetical quantity before the plural-to-singular fallback and find the item', async () => {
    helpers.setup([
      { name: 'Ration', index: 'ration', desc: ['One day of food.'] },
    ]);
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
    // Found branch only: the lookup key must have been the extracted plural "Rations"
    // narrowed to "Ration" — proving extraction runs before the plural fallback.
    expect(callArg).toContain('<b>Ration</b>');
    expect(callArg).toContain('One day of food.');
    expect(callArg).not.toContain('not found in database');
    expect(callArg).not.toContain('Rations (10)');
  });

  it('should render ability, utilize, and craft fields and join array descriptions with <br/><br/>', async () => {
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
    // Literal join — fragments checked separately would also pass if joined by a
    // single <br/> or by nothing at all.
    expect(callArg).toContain('Restores hit points.<br/><br/>Doubles as an alchemy component.');
    expect(callArg).toContain('<b>Ability:</b> Constitution');
    expect(callArg).toContain('<b>Utilize:</b> Drink');
    expect(callArg).toContain('<b>Craft:</b> Alchemy');
    expect(callArg).not.toContain('not found in database');
  });

  it('should show "not found" naming the item when it is missing from the equipment database', async () => {
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
    expect(callArg).toContain('<b>Unobtainium Rod</b>');
    expect(callArg).toContain('not found in database');
    // Not-found branch renders no property lines and no error text.
    expect(callArg).not.toContain('Cost:');
    expect(callArg).not.toContain('Error loading item details');
  });

  it('should show "not found" — not the error branch — when equipment data loads as null', async () => {
    const { loadEquipment } = await import('../../services/ui/dataLoader.js');
    loadEquipment.mockResolvedValue(null);
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
    // Without the empty-data guard, null would throw in findEquipmentItem and land on
    // the catch branch — its absence proves the guard handled it.
    expect(callArg).toContain('not found in database');
    expect(callArg).not.toContain('Error loading item details');
  });

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
    expect(callArg).toContain('<b>Longsword</b>');
    expect(callArg).toContain('Error loading item details');
    expect(callArg).toContain('Network error');
    expect(callArg).not.toContain('not found in database');
    consoleErrorSpy.mockRestore();
  });
});
