// @maintained-by-ai
// CharInventory itemMeta seam (seam map in CharInventory.edgeCases.test.jsx):
//   - "×n" quantity suffix derived from itemMeta: suffix only when quantity > 1;
//     meta present-but-qty-1 and meta-absent both render the bare name; meta keys
//     match case-insensitively (getItemMeta lowercase fallback).
//   - popup description precedence: meta description overrides the equipment DB desc
//     for found items (buildItemPopupHtml metaDescription branch), and supplies a
//     description for custom items absent from the DB instead of "not found" —
//     including the \n → <br/> conversion on that meta text.
//
// Not duplicated here (covered by siblings): cost/weight/category property lines,
// desc-array joining, not-found and load-error paths (popup.test.jsx); parenthetical
// extraction (itemLookup); falsy cost (edgeCases); non-array desc and weight:0
// (equipmentData); magic items (rendering / popupAndRendering).

import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { createRenderComponent } from './charInventory.test-utils.jsx';

describe('CharInventory itemMeta', () => {
  let helpers;

  beforeEach(() => {
    helpers = createRenderComponent();
    helpers.setup();
  });

  it('renders an "×n" quantity suffix only for itemMeta quantities above 1, matching meta keys case-insensitively', () => {
    helpers.setup([]);
    const stats = {
      name: 'Testie',
      inventory: {
        backpack: ['Rope, Hempen', 'Camel', 'Torch', 'Waterskin'],
        equipped: [],
        gold: 0,
        magicItems: [],
        itemMeta: {
          'Rope, Hempen': { quantity: 3, description: 'Fifty feet of sturdy hempen rope.' },
          // Meta key stored upper-case; the backpack entry is mixed-case.
          CAMEL: { quantity: 2 },
          Torch: { quantity: 1 },
        },
      },
    };
    helpers.renderComponent(stats);

    expect(screen.getByText(/Rope, Hempen ×3/)).toBeInTheDocument();
    // Case-insensitive fallback: "Camel" must pick up meta stored under "CAMEL".
    expect(screen.getByText(/Camel ×2/)).toBeInTheDocument();
    // Qty-1 (meta present) and no-meta-at-all both render plain names…
    expect(screen.getByText(/Torch/)).toBeInTheDocument();
    expect(screen.getByText('Waterskin')).toBeInTheDocument();
    // …and never a "×1" suffix anywhere in the sheet.
    expect(screen.queryByText(/×1/)).toBeNull();
  });

  it('overrides the equipment database description with the itemMeta description in the popup', async () => {
    const stats = {
      name: 'Testie',
      inventory: {
        backpack: ['Longsword'],
        equipped: [],
        gold: 0,
        magicItems: [],
        itemMeta: { Longsword: { quantity: 1, description: 'Engraved with elvish runes.' } },
      },
    };
    helpers.renderComponent(stats);
    await helpers.clickItemByText('Longsword');

    const html = helpers.setPopupHtmlSpy.mock.calls.at(-1)[0];
    expect(html).toContain('<b>Longsword</b>');
    expect(html).toContain('Engraved with elvish runes.');
    // The default equipment fixture describes it as "A common sword." — the
    // personal meta description must replace that, not append to it.
    expect(html).not.toContain('A common sword.');
    // Database property lines still render — only the description was overridden.
    expect(html).toContain('<b>Cost:</b> 15 gp');
  });

  it('shows the itemMeta description for custom items missing from the database instead of "not found"', async () => {
    const stats = {
      name: 'Testie',
      inventory: {
        backpack: ['Mystery Compass'],
        equipped: [],
        gold: 0,
        magicItems: [],
        itemMeta: {
          'Mystery Compass': { quantity: 1, description: 'Points to buried treasure.\nNever lies.' },
        },
      },
    };
    helpers.renderComponent(stats);
    await helpers.clickItemByText('Mystery Compass');

    const html = helpers.setPopupHtmlSpy.mock.calls.at(-1)[0];
    expect(html).toContain('<b>Mystery Compass</b>');
    // Meta description survives into the popup with newlines converted to <br/>.
    expect(html).toContain('Points to buried treasure.<br/>Never lies.');
    // Without meta, this same click would fall through to the not-found message
    // (pinned by popup.test.jsx) — with meta it must not appear.
    expect(html).not.toContain('not found in database');
  });
});
