// @maintained-by-ai
// CharInventory item lookup — parenthetical extraction before equipment lookup
// (seam unique to this file per the seam map in CharInventory.edgeCases.test.jsx).
//
// Both tests assert the LOOKUP OUTCOME (item found vs not found), not just the
// bold title — the not-found branch of buildItemPopupHtml also emits
// `<b>${itemName}</b>`, so a title-only assertion passes even with the
// extraction logic deleted.
//
//   - Leading parenthesis: indexOf('(') === 0 must NOT trigger extraction; the
//     full name reaches the DB and matches.
//   - Multiple groups: only text before the FIRST parenthesis is used as the
//     lookup key ("Box (Large) (Heavy)" → "Box").
//
// Not duplicated here (covered by siblings):
//   popup.test.jsx — exact name/index match, plural fallback, not-found message,
//     load-error handling; "Rations (10)" there pins only the not-found branch.
//   edgeCases.test.jsx — falsy-vs-truthy cost, blank clickable elements.
//   popup.pluralSingular.test.jsx — placeholder file, no tests remain.

import { describe, it, expect, beforeEach } from 'vitest';
import { createRenderComponent } from './charInventory.test-utils.jsx';

describe('CharInventory item lookup', () => {
  let helpers;

  beforeEach(() => {
    helpers = createRenderComponent();
    helpers.setup();
  });

  it('looks up a leading-parenthesis name un-extracted — finds it when the database stores the same name', async () => {
    helpers.setup([
      { name: '(Special) Item', index: 'special-item', desc: ['Straight from the vault.'] },
    ]);
    const stats = { inventory: { magicItems: [], equipped: ['(Special) Item'], backpack: [] } };
    helpers.renderComponent(stats);
    await helpers.clickItemByText('(Special) Item');
    const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
    // Found branch only: db title + desc, and no not-found fallback.
    expect(callArg).toContain('<b>(Special) Item</b>');
    expect(callArg).toContain('Straight from the vault.');
    expect(callArg).not.toContain('not found in database');
  });

  it('uses only the text before the FIRST parenthesis as the lookup key for multiple parenthetical groups', async () => {
    helpers.setup([
      { name: 'Box', index: 'box', desc: ['A sturdy container.'] },
    ]);
    const stats = { inventory: { magicItems: [], equipped: ['Box (Large) (Heavy)'], backpack: [] } };
    helpers.renderComponent(stats);
    await helpers.clickItemByText('Box (Large) (Heavy)');
    const callArg = helpers.setPopupHtmlSpy.mock.calls[0][0];
    // Popup shows the resolved db name "Box" (found) — not the raw inventory
    // name — proving the key was "Box" and not "Box (Large)" or the full string.
    expect(callArg).toContain('<b>Box</b>');
    expect(callArg).not.toContain('<b>Box (Large) (Heavy)</b>');
    expect(callArg).not.toContain('not found in database');
  });
});
