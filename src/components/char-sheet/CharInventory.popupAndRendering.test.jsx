// @maintained-by-ai
// CharInventory interaction boundaries — seams unique to this file (seam map lives in
// CharInventory.edgeCases.test.jsx):
//   - Magic items are DISPLAY-ONLY: their rows render no clickable spans and clicking
//     them never opens the popup, while a co-located equipped span DOES open it
//     (positive control in the same render). No sibling asserts magic-item
//     interactivity — popup siblings all click equipped/backpack items.
//   - NULL section arrays (equipped/backpack/magicItems: null) render nothing and do
//     not crash — pinning the `!items` short-circuit clause of renderItems. rendering
//     .test.jsx pins only the `length === 0` clause (empty arrays); this is the
//     standing "pin equipped: null somewhere in the family" for this lane.
//
// Delegated (not duplicated here):
//   popup.test.jsx — canonical popup wording, found-vs-notfound discrimination,
//     null loadEquipment data guard, load-error branch.
//   rendering.test.jsx — section presence/order, empty-array sections.
//   edgeCases.test.jsx — falsy-vs-truthy cost, null/empty-string array ELEMENTS.
//   itemMeta/itemLookup/equipmentData — meta quantities, parenthetical extraction,
//     desc/weight guards.
import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { createRenderComponent } from './charInventory.test-utils.jsx';

describe('CharInventory popup content and rendering', () => {
  let helpers;

  beforeEach(() => {
    helpers = createRenderComponent();
    helpers.setup();
  });

  it('renders magic items display-only — clicking a magic item opens no popup, while a co-located equipped item does', async () => {
    const stats = {
      inventory: {
        magicItems: [
          {
            name: 'Magic Sword',
            type: 'Weapon',
            rarity: 'Uncommon',
            description: 'A magical sword.',
          },
        ],
        equipped: ['Longsword'],
        backpack: [],
      },
    };
    helpers.renderComponent(stats);

    // The magic-items section wrapper must contain no interactive spans at all —
    // the .clickable span is the sole popup trigger in this component.
    const magicSection = screen.getByText('Magic Items:').parentElement;
    expect(magicSection.querySelectorAll('span.clickable')).toHaveLength(0);

    // Clicking the magic item row is inert: the handler is async, so flush the
    // microtask queue (mocked loadEquipment resolves immediately) before checking.
    fireEvent.click(screen.getByText(/Magic Sword/));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(helpers.setPopupHtmlSpy).not.toHaveBeenCalled();

    // Positive control in the same render: equipped items are interactive, so the
    // inert click above was a real behavior, not a broken test harness.
    await helpers.clickItemByText('Longsword');
    expect(helpers.setPopupHtmlSpy).toHaveBeenCalledTimes(1);
    expect(helpers.setPopupHtmlSpy.mock.calls[0][0]).toContain('<b>Longsword</b>');
  });

  it('renders only the Inventory header when every section array is null (the !items guard)', () => {
    // Null arrays hit the `!items` short-circuit — the empty-array clause
    // (length === 0) is already pinned by rendering.test.jsx.
    const stats = { inventory: { magicItems: null, equipped: null, backpack: null } };
    const view = helpers.renderComponent(stats);

    expect(screen.getByText('Inventory')).toBeInTheDocument();
    expect(screen.queryByText(/Magic Items:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Equipped:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Backpack:/)).not.toBeInTheDocument();
    expect(view.container.querySelector('span.clickable')).toBeNull();
  });
});
