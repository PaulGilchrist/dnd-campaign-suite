// @maintained-by-ai 2026-11-17: 2026-11-17
// CharInventory read-only purse row (improve sheet-purse-read-face, backlog 2026-11-17 AB):
// the sheet's inventory area surfaces the character's coin via the SHARED
// characterCurrency rule (services/campaign/characterCurrency.js — same implementation
// the From Players pane imports): { pp,gp,sp,cp } block when present, else positive
// inventory.gold as gp. One segment per non-zero coin; an all-zero purse renders NO
// row; strictly read-only (no button/input anywhere in the row).
//
// Seam map: family lives in CharInventory.edgeCases.test.jsx; this file owns ONLY
// the purse row.
import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { createRenderComponent } from './charInventory.test-utils.jsx';

function purseRow() {
  const label = screen.queryByText('Purse:');
  return label ? label.parentElement : null;
}

const emptySections = { magicItems: [], equipped: [], backpack: [] };

describe('CharInventory purse row', () => {
  let helpers;

  beforeEach(() => {
    helpers = createRenderComponent();
    helpers.setup();
  });

  it('renders "Purse: 10 gp" for a gold-only character (AasimarTest fixture shape)', () => {
    helpers.renderComponent({ inventory: { ...emptySections, gold: 10 } });
    expect(purseRow().textContent.replace(/\s+/g, ' ').trim()).toBe('Purse: 10 gp');
  });

  it('renders every non-zero coin of a currency block, omitting zero coins (From Players convention)', () => {
    helpers.renderComponent({
      inventory: { ...emptySections, gold: 10, currency: { pp: 0, gp: 10, sp: 0, cp: 1 } },
    });
    expect(purseRow().textContent.replace(/\s+/g, ' ').trim()).toBe('Purse: 10 gp, 1 cp');
  });

  it('renders NO purse row for an all-zero purse (zero block, zero gold, or no inventory coin keys)', () => {
    helpers.renderComponent({ inventory: { ...emptySections, gold: 10, currency: { pp: 0, gp: 0, sp: 0, cp: 0 } } });
    expect(screen.queryByText('Purse:')).not.toBeInTheDocument();
    helpers.renderComponent({ inventory: { ...emptySections, gold: 0 } });
    expect(screen.queryByText('Purse:')).not.toBeInTheDocument();
    helpers.renderComponent({ inventory: { ...emptySections } });
    expect(screen.queryByText('Purse:')).not.toBeInTheDocument();
  });

  it('is strictly read-only: the row carries no button, input or other interactive element', () => {
    helpers.renderComponent({ inventory: { ...emptySections, gold: 10 } });
    expect(purseRow().querySelector('button, input, select, textarea, [role=button], .clickable')).toBeNull();
  });

  it('rides above the Equipped/Backpack sections inside the inventory area', () => {
    helpers.renderComponent({
      inventory: { magicItems: [], equipped: ['Longsword'], backpack: [], gold: 10 },
    });
    const row = purseRow();
    const section = screen.getByText('Inventory').parentElement;
    expect(row.parentElement).toBe(section);
    expect(row.compareDocumentPosition(screen.getByText('Equipped:')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
