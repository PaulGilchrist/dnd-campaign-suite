// @maintained-by-ai
// CharInventory edge cases — SEAM MAP for the CharInventory test family:
//   edgeCases (THIS FILE): falsy-vs-truthy `cost` line in the popup; empty/null
//     array ELEMENTS in equipped (itemNameOf typeof guard) — rendered then clicked.
//   equipmentData: desc as non-array string (Array.isArray guard).
//   itemLookup: parenthetical/name normalization before equipment lookup.
//   itemMeta: itemMeta quantity "×n" rendering and case-insensitive meta match.
//   popup: popup detail rendering for found items, "not found", load-error handling.
//   popup.pluralSingular: plural↔singular lookup fallback.
//   popupAndRendering: magic items are not clickable.
//   rendering: section presence/order; null/EMPTY ARRAY sections render nothing
//     (empty-string/null array ELEMENTS are covered here, not there).
//
// Removed as redundant: standalone "renders without crashing" test — the
// not-found click test below already renders the same data and asserts strictly
// more (section label, span count, popup outcome).

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { createRenderComponent } from './charInventory.test-utils.jsx';

describe('CharInventory edge cases', () => {
  let helpers;

  beforeEach(() => {
    helpers = createRenderComponent();
    helpers.setup();
  });

  it('should omit the Cost line only when cost is falsy — null omits, a zero-quantity object still renders', async () => {
    helpers.setup([
      { name: 'Null Cost Item', index: 'null-cost-item', cost: null, weight: 2 },
      { name: 'Free Supply', index: 'free-supply', cost: { quantity: 0, unit: 'gp' }, weight: 1 },
    ]);
    const stats = { inventory: { magicItems: [], equipped: ['Null Cost Item', 'Free Supply'], backpack: [] } };
    helpers.renderComponent(stats);

    // "Null Cost Item" is the first span, so its text includes the ", " separator — match by regex.
    await helpers.clickItemByText(/^Null Cost Item/);
    const nullCostPopup = helpers.setPopupHtmlSpy.mock.calls[0][0];
    expect(nullCostPopup).toContain('<b>Null Cost Item</b>');
    expect(nullCostPopup).not.toContain('Cost:');
    expect(nullCostPopup).toContain('<b>Weight:</b> 2');

    fireEvent.click(screen.getByText('Free Supply'));
    await waitFor(() => {
      expect(helpers.setPopupHtmlSpy.mock.calls.length).toBe(2);
    });
    const zeroCostPopup = helpers.setPopupHtmlSpy.mock.calls[1][0];
    expect(zeroCostPopup).toContain('<b>Cost:</b> 0 gp');
  });

  it('should render empty-string and null array elements as blank clickables and show not-found when clicked', async () => {
    const stats = { inventory: { magicItems: [], equipped: ['', null], backpack: [] } };
    const view = helpers.renderComponent(stats);

    expect(screen.getByText('Equipped:')).toBeInTheDocument();
    // getByText walks text nodes, so fully-empty spans are invisible to it —
    // query the rendered clickable spans directly.
    const blankClickables = Array.from(view.container.querySelectorAll('span.clickable'));
    // Names render blank; the first span carries only the ", " list separator.
    expect(blankClickables.map(el => el.textContent)).toEqual([', ', '']);

    fireEvent.click(blankClickables[0]);
    await waitFor(() => {
      expect(helpers.setPopupHtmlSpy).toHaveBeenCalled();
    });
    expect(helpers.setPopupHtmlSpy.mock.calls[0][0]).toContain('not found in database');
  });
});
