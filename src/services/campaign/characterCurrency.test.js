// @maintained-by-ai: 2026-11-17
// Shared purse rule (improve sheet-purse-read-face): extracted verbatim from
// PartyInventory.jsx so the From Players pane and the sheet's read-only Purse row
// share ONE implementation mirroring the server's characterCurrency() rule
// (server/routes/inventory.js — canonical for writes). Component-level lanes stay
// pinned by PartyInventory.player-currency.test.jsx and CharInventory.purse.test.jsx.
import { describe, it, expect } from 'vitest';
import { characterCurrency } from './characterCurrency.js';

describe('characterCurrency (shared purse rule)', () => {
  it('resolves the { pp, gp, sp, cp } block when present', () => {
    expect(characterCurrency({
      inventory: { gold: 10, currency: { pp: 1, gp: 2, sp: 3, cp: 4 } },
    })).toEqual({ pp: 1, gp: 2, sp: 3, cp: 4 });
  });

  it('falls back to positive inventory.gold counted as gp when no currency block exists', () => {
    expect(characterCurrency({ inventory: { gold: 10 } })).toEqual({ pp: 0, gp: 10, sp: 0, cp: 0 });
  });

  it('treats missing, zero, negative, non-numeric and fractional coins as 0 (block wins over gold)', () => {
    expect(characterCurrency({ inventory: { gold: 99, currency: { gp: -5, sp: 'x', cp: 2.9 } } }))
      .toEqual({ pp: 0, gp: 0, sp: 0, cp: 2 });
    expect(characterCurrency({ inventory: { gold: 0 } })).toEqual({ pp: 0, gp: 0, sp: 0, cp: 0 });
    expect(characterCurrency({ inventory: { gold: -3 } })).toEqual({ pp: 0, gp: 0, sp: 0, cp: 0 });
  });

  it('tolerates characters with no inventory at all', () => {
    expect(characterCurrency({})).toEqual({ pp: 0, gp: 0, sp: 0, cp: 0 });
  });
});
