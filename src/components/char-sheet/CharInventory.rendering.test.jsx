// @maintained-by-ai
// CharInventory section + magic-item row rendering — seams unique to this file
// (family seam map lives in CharInventory.edgeCases.test.jsx):
//   - Section order/content: Magic Items / Equipped / Backpack headers in DOM order,
//     each section's items scoped inside its own wrapper.
//   - EMPTY-array sections render nothing (the length === 0 clause; null arrays are
//     pinned by popupAndRendering.test.jsx).
//   - Magic-item row template: italic "type (subtype), rarity" segment, generic vs
//     custom attunement wording, magic-quantity truthiness (qty 1 DOES render, unlike
//     the itemMeta "×n >1" rule owned by itemMeta.test.jsx), and description text —
//     incl. the empty-string description pin folded into the subtype test.
//
// Delegated (not duplicated here): popup wording and lookup lanes (popup/itemLookup/
// equipmentData/edgeCases), itemMeta quantities and meta overrides (itemMeta),
// magic-item click inertness and null-array guard (popupAndRendering).
//
// Consolidated: "hide magic when empty" + "hide equipped/backpack when empty" folded
// into the all-empty test (positives come from the order test); subtype present/absent
// merged into one italic-segment test; "no attunement when false" and "empty-string
// description" folded as negatives; "description as text" removed (every remaining
// magic test already asserts its description text).
import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { createRenderComponent } from './charInventory.test-utils.jsx';

// Magic rows are the sibling <div>s after the "Magic Items:" <b> header.
function magicRows() {
  const section = screen.getByText('Magic Items:').parentElement;
  return Array.from(section.children).filter((el) => el.tagName === 'DIV');
}

const norm = (el) => el.textContent.replace(/\s+/g, ' ').trim();

describe('CharInventory rendering', () => {
  let helpers;

  beforeEach(() => {
    helpers = createRenderComponent();
    helpers.setup();
  });

  describe('section rendering', () => {
    it('renders all three sections in DOM order, each item inside its own section', () => {
      const stats = {
        inventory: {
          magicItems: [{ name: 'Magic Ring', type: 'Ring', rarity: 'Uncommon', description: 'A magic ring.' }],
          equipped: ['Longsword', 'Shield'],
          backpack: ['Rations', 'Water'],
        },
      };
      helpers.renderComponent(stats);

      const headers = ['Magic Items:', 'Equipped:', 'Backpack:'].map((t) => screen.getByText(t));
      // Real DOM-order check — the original "correct order" test never verified order.
      for (let i = 0; i < headers.length - 1; i++) {
        expect(headers[i].compareDocumentPosition(headers[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
      // Each item lives in its own section wrapper, with no leakage between sections.
      expect(headers[0].parentElement.textContent).toContain('Magic Ring');
      expect(headers[1].parentElement.textContent).toContain('Longsword');
      expect(headers[1].parentElement.textContent).not.toContain('Rations');
      expect(headers[2].parentElement.textContent).toContain('Rations');
    });

    it('renders only the Inventory header when every section array is empty (length === 0 clause; null arrays pinned by popupAndRendering)', () => {
      helpers.renderComponent({ inventory: { magicItems: [], equipped: [], backpack: [] } });
      expect(screen.getByText('Inventory')).toBeInTheDocument();
      expect(screen.queryByText(/Magic Items:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Equipped:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Backpack:/)).not.toBeInTheDocument();
    });
  });

  describe('magic items', () => {
    it('renders the core row — name, italic "type, rarity", description — with no attunement or quantity noise when both are absent', () => {
      helpers.renderComponent({
        inventory: {
          magicItems: [{ name: 'Unnamed Ring', type: 'Ring', rarity: 'Uncommon', requiresAttunement: false }],
          equipped: [],
          backpack: [],
        },
      });
      const row = magicRows()[0];
      expect(row.textContent).toContain('Unnamed Ring');
      expect(norm(row.querySelector('i'))).toBe('Ring, Uncommon');
      // requiresAttunement:false renders no attunement text, and no qty marker when unset.
      expect(row.textContent).not.toMatch(/attunement/i);
      expect(row.textContent).not.toContain('qty');
    });

    it('shows "(requires attunement)" only for generic attunement — custom requirements replace it', () => {
      helpers.renderComponent({
        inventory: {
          magicItems: [
            { name: 'Ring of Protection', type: 'Ring', rarity: 'Rare', requiresAttunement: true, description: 'AC +1' },
            // Custom requirement replaces the generic wording, and false omits entirely.
            { name: 'Armor of Invulnerability', type: 'Armor', rarity: 'Legendary', requiresAttunement: true, attunementRequirements: 'by a barbarian', description: 'Immune to damage' },
            { name: 'Common Ring', type: 'Ring', rarity: 'Common', requiresAttunement: false, description: 'A simple ring.' },
          ],
          equipped: [],
          backpack: [],
        },
      });
      const rows = magicRows();
      expect(norm(rows[0].querySelector('i'))).toBe('Ring, Rare (requires attunement)');
      expect(rows[0].textContent).toContain('AC +1');
      expect(norm(rows[1].querySelector('i'))).toBe('Armor, Legendary (by a barbarian)');
      expect(rows[1].textContent).not.toContain('requires attunement');
      expect(rows[1].textContent).toContain('Immune to damage');
      expect(norm(rows[2].querySelector('i'))).toBe('Ring, Common');
    });

    it('wraps a subtype in parentheses inside the italic segment, omits it when absent, and renders a blank description cleanly', () => {
      helpers.renderComponent({
        inventory: {
          magicItems: [
            { name: 'Plate Armor', type: 'Armor', subtype: 'Heavy', rarity: 'Rare', description: 'AC 18' },
            { name: 'Ring of Protection', type: 'Ring', rarity: 'Rare', description: 'AC +1' },
            // Empty-string description: same dangerouslySetInnerHTML path as missing — renders an empty span, no crash.
            { name: 'Blank Verse', type: 'Scroll', rarity: 'Uncommon', description: '' },
          ],
          equipped: [],
          backpack: [],
        },
      });
      const rows = magicRows();
      expect(norm(rows[0].querySelector('i'))).toBe('Armor (Heavy), Rare');
      expect(norm(rows[1].querySelector('i'))).toBe('Ring, Rare');
      expect(rows[0].textContent).toContain('AC 18');
      expect(rows[1].textContent).toContain('AC +1');
      const blankRow = rows[2];
      expect(norm(blankRow)).toBe('Blank Verse - Scroll, Uncommon:');
      expect(blankRow.querySelector('.magic-item-description').textContent).toBe('');
    });

    it('renders "(qty n)" for any truthy magic quantity — qty 1 included (unlike the itemMeta ×n >1 rule) — and omits the marker when unset', () => {
      helpers.renderComponent({
        inventory: {
          magicItems: [
            { name: 'Potion of Healing', type: 'Potion', rarity: 'Common', quantity: 3, description: 'Heals 2d4+2 HP' },
            { name: 'Aeon Stone', type: 'Wondrous Item', rarity: 'Rare', quantity: 1, description: 'Stretches time.' },
            { name: 'Cloak of Elvenkind', type: 'Wondrous Item', rarity: 'Uncommon', description: 'Eyes glint.' },
          ],
          equipped: [],
          backpack: [],
        },
      });
      const rows = magicRows();
      expect(rows[0].textContent).toContain('(qty 3)');
      // Honest pin of the truthiness check: magic rows differ from equipped/backpack
      // itemMeta quantities, which only render "×n" for n > 1 (pinned in itemMeta).
      expect(rows[1].textContent).toContain('(qty 1)');
      expect(rows[2].textContent).toContain('Cloak of Elvenkind');
      expect(rows[2].textContent).not.toContain('qty');
    });
  });
});
