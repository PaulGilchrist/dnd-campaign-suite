// @maintained-by-ai
/**
 * inventoryService — client-side fetch contract for the party-inventory family.
 *
 * Lane of the services/campaign/ block (campaignService.test.js map #2002,
 * factionsService precedent #2003): per-test fetch-spied, fail-loud default
 * (unmocked fetch throws — never live, per campaign lockdown), exact request
 * shapes, server-truth response envelopes, error-body extraction vs the
 * client's own generic fallback strings.
 *
 * THIS file owns `/api/campaigns/:campaign/inventory` (GET bare fetch, POST
 * full overwrite) and `/api/campaigns/:campaign/inventory/transfer` (POST).
 *
 * Response shapes pinned against server/routes/inventory.js, NOT canned JSON:
 *  - GET  → { inventory: { currency, items } }; the route loadInventory()
 *    initializes a missing file to the empty shape — this endpoint never 404s.
 *  - POST → { success: true, inventory } (sanitized + re-sorted server-side);
 *    the CLIENT drops the success flag and returns normalizeInventory
 *    (data.inventory) only — pinned below.
 *  - transfer POST → { success: true, inventory, character: { name, inventory } };
 *    the client spreads the envelope and re-normalizes only inventory.
 *  - 4xx truths: 400 'inventory.items must be an array' | 'playerName is
 *    required' | 'direction must be "party-to-player" or "player-to-party"' |
 *    'Transfer one item or one currency set per request' | 'quantity must be
 *    a positive integer'; 404 `Character <name> not found`; 409 shortfall
 *    e.g. 'Party has only 2 of "Torch"'. 500 { error } via asyncHandler.
 *  - The client's `error || 'Failed to …'` generics are defensive client-only
 *    strings (server always sends { error }) — pinned as the client's own.
 *  - The { value: null } leg is the stale change-data wildcard envelope
 *    (server/routes/campaigns-changedata.js:74) falling through where the
 *    inventory route should answer — normalizeInventory must not resolve
 *    undefined into React state.
 *
 * Consumers (liveness verified): src/components/party-inventory/
 * PartyInventory.jsx (App.jsx 'partyInventory' view) — loadInventory on
 * mount, saveInventory on edits, transferInventory for item/currency moves,
 * normalizeInventory on the raw { currency, items } SSE echo.
 *
 * No timers, no localStorage game state — pure fetch boundary; inventory
 * lives server-side in public/campaigns/:campaign/data/inventory.json.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadInventory,
  saveInventory,
  transferInventory,
  depositCurrency,
  normalizeInventory,
} from './inventoryService.js';

const EMPTY_CURRENCY = { pp: 0, gp: 0, sp: 0, cp: 0 };

describe('inventoryService', () => {
  let fetchSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    // Fail-loud default: any fetch a test forgets to mock rejects instead of
    // reaching a live server (campaign lockdown — never real /api here).
    fetchSpy.mockImplementation((url) => {
      throw new Error(`unmocked fetch in inventoryService test: ${url}`);
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('normalizeInventory', () => {
    it('logs and returns the exact empty shape for invalid payloads', () => {
      // undefined, {} and [] all hit the same guard branch (service: !raw ||
      // !raw.currency && !raw.items) — one folded leg, payload pin per input.
      for (const raw of [undefined, {}, []]) {
        expect(normalizeInventory(raw)).toEqual({ currency: EMPTY_CURRENCY, items: [] });
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[inventoryService] Invalid party inventory payload:',
          raw
        );
      }
    });

    it('repairs partial currency and items to the exact output shape, silently', () => {
      const fixed = normalizeInventory({
        currency: { gp: '12', sp: -4 },
        items: [
          { name: 'Torch', quantity: 0 },
          { id: 'keep', name: ' Antitoxin ', quantity: 2.7, description: 'venom' },
          { name: '' },
          null,
        ],
      });

      expect(fixed.currency).toEqual({ pp: 0, gp: 12, sp: 0, cp: 0 });
      // exact keys per item (id/name/quantity/description), name-sorted,
      // quantity floored to >=1, blank/null items dropped, id preserved or minted
      expect(fixed.items).toEqual([
        { id: 'keep', name: 'Antitoxin', quantity: 2, description: 'venom' },
        { id: expect.any(String), name: 'Torch', quantity: 1, description: '' },
      ]);
      // repair path is a valid payload — must stay silent (guard logs only)
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('keeps a valid server/SSE payload intact and re-sorts items by name', () => {
      // SSE lane: PartyInventory feeds normalizeInventory(event.data) the raw
      // published { currency, items } — passthrough fidelity + sort contract.
      const result = normalizeInventory({
        currency: { pp: 1, gp: 2, sp: 3, cp: 4 },
        items: [
          { id: 'b', name: 'Torch', quantity: 2, description: '' },
          { id: 'a', name: 'Antitoxin', quantity: 1, description: 'venom' },
        ],
      });

      expect(result).toEqual({
        currency: { pp: 1, gp: 2, sp: 3, cp: 4 },
        items: [
          { id: 'a', name: 'Antitoxin', quantity: 1, description: 'venom' },
          { id: 'b', name: 'Torch', quantity: 2, description: '' },
        ],
      });
    });
  });

  describe('loadInventory', () => {
    it('GETs the encoded bare inventory URL and returns the normalized envelope', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          inventory: {
            currency: { pp: 1, gp: 2, sp: 3, cp: 4 },
            items: [{ id: 'a', name: 'Torch', quantity: 2, description: '' }],
          },
        }),
      });

      const result = await loadInventory('my campaign/1');

      expect(result).toEqual({
        currency: { pp: 1, gp: 2, sp: 3, cp: 4 },
        items: [{ id: 'a', name: 'Torch', quantity: 2, description: '' }],
      });
      // bare single-arg fetch (no options) — exact pin
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/my%20campaign%2F1/inventory');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('never resolves undefined when a stale wildcard answers { value: null }', async () => {
      // server truth: campaigns-changedata.js answers { value: null } (200)
      // for unknown keys — if a stale deploy routes GET /inventory there,
      // data.inventory is undefined and normalize must fall back loudly.
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ value: null }),
      });

      const inventory = await loadInventory('test-campaign');

      expect(inventory).toEqual({ currency: EMPTY_CURRENCY, items: [] });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[inventoryService] Invalid party inventory payload:',
        undefined
      );
    });

    it('rethrows the server error body and falls back to its own message', async () => {
      // server-truth extraction branch first…
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'EACCES: permission denied' }),
      });
      await expect(loadInventory('test-campaign')).rejects.toThrow('EACCES: permission denied');

      // …then the defensive client-only generic (server always sends { error })
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });
      await expect(loadInventory('test-campaign')).rejects.toThrow('Failed to load party inventory');
    });

    it('rejects raw network errors', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadInventory('test-campaign')).rejects.toThrow('ENOTFOUND');
    });
  });

  describe('saveInventory', () => {
    it('POSTs the exact overwrite body and returns only the normalized inventory', async () => {
      const inventory = {
        currency: { pp: 0, gp: 15, sp: 0, cp: 0 },
        items: [{ id: 'a', name: 'Rope', quantity: 1, description: '50 ft' }],
      };
      // server truth: res.json({ success: true, inventory }) — sanitized +
      // re-sorted server-side
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, inventory }),
      });

      const result = await saveInventory('test-campaign', inventory);

      // client DROPS the success flag — returns normalizeInventory(data.inventory)
      expect(result).toEqual(inventory);
      expect(result).not.toHaveProperty('success');
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/test-campaign/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inventory),
      });
    });

    it('rethrows the server-truth 400 and its own generic fallback', async () => {
      // server truth: sanitizeItems(body.items) === null → 400 exact string
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'inventory.items must be an array' }),
      });
      await expect(
        saveInventory('test-campaign', { currency: {}, items: 'nope' })
      ).rejects.toThrow('inventory.items must be an array');

      // client-only generic when the error body has no error field
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });
      await expect(
        saveInventory('test-campaign', { currency: EMPTY_CURRENCY, items: [] })
      ).rejects.toThrow('Failed to save party inventory');
    });

    it('rejects raw network errors without swallowing them', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(
        saveInventory('test-campaign', { currency: EMPTY_CURRENCY, items: [] })
      ).rejects.toThrow('ENOTFOUND');
      // swallow lives in the consumer (PartyInventory.jsx 'save failed:') —
      // the service must rethrow, staying non-silent at this boundary
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('transferInventory', () => {
    it('POSTs an exact item transfer and spreads the envelope with normalized inventory', async () => {
      const transfer = {
        direction: 'party-to-player',
        playerName: 'Mordai',
        itemName: 'Torch',
        quantity: 2,
      };
      // server truth: { success: true, inventory, character: { name, inventory } }
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          inventory: {
            currency: EMPTY_CURRENCY,
            items: [{ id: 'a', name: 'Antitoxin', quantity: 1, description: 'venom' }],
          },
          character: {
            name: 'Mordai',
            inventory: { backpack: ['Torch'], equipped: [], gold: 0, magicItems: [] },
          },
        }),
      });

      const result = await transferInventory('test-campaign', transfer);

      // client spreads { success, character } untouched and re-normalizes inventory
      expect(result).toEqual({
        success: true,
        inventory: {
          currency: EMPTY_CURRENCY,
          items: [{ id: 'a', name: 'Antitoxin', quantity: 1, description: 'venom' }],
        },
        character: {
          name: 'Mordai',
          inventory: { backpack: ['Torch'], equipped: [], gold: 0, magicItems: [] },
        },
      });
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/test-campaign/inventory/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transfer),
      });

      // currency-set body (PartyInventory.jsx currency moves) — same route, exact body
      const currencyTransfer = {
        direction: 'party-to-player',
        playerName: 'Mordai',
        currency: { pp: 0, gp: 5, sp: 0, cp: 0 },
      };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, inventory: { currency: EMPTY_CURRENCY, items: [] }, character: { name: 'Mordai', inventory: {} } }),
      });
      await transferInventory('test-campaign', currencyTransfer);

      expect(fetchSpy).toHaveBeenLastCalledWith('/api/campaigns/test-campaign/inventory/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currencyTransfer),
      });
    });

    it('rethrows server-truth validation and shortfall errors', async () => {
      // validateTransferRequest 400: itemName AND currency → exact server string
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Transfer one item or one currency set per request' }),
      });
      await expect(
        transferInventory('test-campaign', { direction: 'party-to-player', playerName: 'Mordai', itemName: 'Torch', quantity: 1, currency: { gp: 1 } })
      ).rejects.toThrow('Transfer one item or one currency set per request');

      // applyPartyToPlayer shortfall → 409 exact server string
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: () => Promise.resolve({ error: 'Party has only 2 of "Torch"' }),
      });
      await expect(
        transferInventory('test-campaign', { direction: 'party-to-player', playerName: 'Mordai', itemName: 'Torch', quantity: 5 })
      ).rejects.toThrow('Party has only 2 of "Torch"');
    });

    it('rethrows character-not-found, its own generic fallback, and network errors', async () => {
      // server truth: missing character file → 404 `Character <name> not found`
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Character Mordai not found' }),
      });
      await expect(
        transferInventory('test-campaign', { direction: 'player-to-party', playerName: 'Mordai', itemName: 'Torch', quantity: 1 })
      ).rejects.toThrow('Character Mordai not found');

      // client-only generic when the error body has no error field
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });
      await expect(
        transferInventory('test-campaign', { direction: 'party-to-player', playerName: 'Mordai', itemName: 'Torch', quantity: 1 })
      ).rejects.toThrow('Failed to transfer inventory');

      fetchSpy.mockRejectedValueOnce(new Error('ENOTFOUND'));
      await expect(
        transferInventory('test-campaign', { direction: 'party-to-player', playerName: 'Mordai', itemName: 'Torch', quantity: 1 })
      ).rejects.toThrow('ENOTFOUND');
    });
  });

  describe('depositCurrency', () => {
    it('POSTs the exact deposit body to /inventory/deposit and returns the normalized inventory', async () => {
      const currency = { pp: 70, gp: 3, sp: 0, cp: 0 };
      // server truth: res.json({ success: true, inventory }) — credited server-side
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          inventory: { currency: { pp: 72, gp: 8, sp: 0, cp: 7 }, items: [] },
        }),
      });

      const result = await depositCurrency('test-campaign', currency);

      expect(result).toEqual({ currency: { pp: 72, gp: 8, sp: 0, cp: 7 }, items: [] });
      expect(result).not.toHaveProperty('success');
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/test-campaign/inventory/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency }),
      });
    });

    it('rethrows the server-truth 400, its own generic fallback, and network errors', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'currency with a positive amount is required' }),
      });
      await expect(depositCurrency('test-campaign', { pp: 0, gp: 0, sp: 0, cp: 0 }))
        .rejects.toThrow('currency with a positive amount is required');

      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });
      await expect(depositCurrency('test-campaign', { gp: 1 }))
        .rejects.toThrow('Failed to deposit party currency');

      fetchSpy.mockRejectedValueOnce(new Error('ENOTFOUND'));
      await expect(depositCurrency('test-campaign', { gp: 1 })).rejects.toThrow('ENOTFOUND');
    });
  });
});
