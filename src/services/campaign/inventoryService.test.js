// @maintained-by-ai 2026-11-27
/**
 * inventoryService — client-side fetch contract for the party-inventory family.
 *
 * Lane of the services/campaign/ block (campaignService.test.js map #2002,
 * factionsService precedent #2003): per-test fetch-spied, fail-loud default
 * (unmocked fetch throws — never live, per campaign lockdown), exact request
 * shapes, server-truth response envelopes, error-body extraction vs the
 * client's own generic fallback strings.
 *
 * THIS file owns `/api/campaigns/:campaign/inventory` (GET bare fetch) plus the
 * `/inventory/item` atomic per-row intent lane, the `/inventory/adjust` coin lane and
 * the `/inventory/transfer` move lane (POSTs).
 *
 * Response shapes pinned against server/routes/inventory.js, NOT canned JSON
 * (status-code strings like the 400/404/409 copy are pinned there — the client
 * extraction below is status-independent):
 *  - GET  → { inventory: { currency, items } }; the route loadInventory()
 *    initializes a missing file to the empty shape — this endpoint never 404s.
 *  - item-intent POST → { success: true, inventory } (the intent merged onto the
 *    SERVER's re-read ledger, items re-sorted); the CLIENT drops the success flag and
 *    returns normalizeInventory(data.inventory) only — pinned below.
 *  - transfer POST → { success: true, inventory, character: { name, inventory } };
 *    the client spreads the envelope and re-normalizes only inventory.
 *  - applyItemIntent failures carry `.status` always and `.inventory` only when
 *    the conflict body ships one (concurrent-deletion 409, for stale-view adoption).
 *  - The client's `error || 'Failed to …'` generics are defensive client-only
 *    strings (server always sends { error }) — pinned via the shared four-lane
 *    error-contract table below (server truth, empty body, unparseable body via
 *    the json().catch(() => ({})) leg, and raw network rejection).
 *  - The { value: null } leg is the stale change-data wildcard envelope
 *    (server/routes/campaigns-changedata.js:74) falling through where the
 *    inventory route should answer — normalizeInventory must not resolve
 *    undefined into React state.
 *
 * Consumers (liveness verified): src/components/party-inventory/
 * PartyInventory.jsx (App.jsx 'partyInventory' view) — loadInventory on
 * mount, applyItemIntent on item add/edit/step/delete, adjustCurrency for the
 * +/- chip flush, transferInventory for item/currency moves, normalizeInventory
 * on the raw { currency, items } SSE echo. Those component lanes MOCK this
 * module; server copy lives in server/routes/inventory*.test.js.
 *
 * No timers, no localStorage game state — pure fetch boundary; inventory
 * lives server-side in public/campaigns/:campaign/data/inventory.json.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadInventory,
  applyItemIntent,
  transferInventory,
  adjustCurrency,
  normalizeInventory,
} from './inventoryService.js';

const EMPTY_CURRENCY = { pp: 0, gp: 0, sp: 0, cp: 0 };

// One row per fetch lane: the shared error-extraction branch
// (`error.error || <generic>`, then the json().catch fallback, then raw
// network rejection) is identical in shape across the four, so it is pinned
// ONCE as a table. `serverTruth` values are real server/routes/inventory.js
// copy so the table also documents which strings each lane surfaces.
const FETCH_LANES = [
  {
    name: 'loadInventory',
    invoke: () => loadInventory('test-campaign'),
    serverTruth: 'EACCES: permission denied',
    fallback: 'Failed to load party inventory',
  },
  {
    name: 'applyItemIntent',
    invoke: () => applyItemIntent('test-campaign', { action: 'delete', id: 'a', name: 'Rope' }),
    serverTruth: 'action must be "add", "update", "setQty" or "delete"',
    fallback: 'Failed to update party inventory',
  },
  {
    name: 'transferInventory',
    invoke: () => transferInventory('test-campaign', {
      direction: 'party-to-player', playerName: 'Mordai', itemName: 'Torch', quantity: 1,
    }),
    serverTruth: 'Party has only 2 of "Torch"',
    fallback: 'Failed to transfer inventory',
  },
  {
    name: 'adjustCurrency',
    invoke: () => adjustCurrency('test-campaign', { pp: 0, gp: 0, sp: 0, cp: 0 }),
    serverTruth: 'currency with a non-zero whole-number amount is required',
    fallback: 'Failed to adjust party currency',
  },
];

const failedResponse = (body) => ({
  ok: false,
  status: 500,
  statusText: 'Internal Server Error',
  json: () => Promise.resolve(body),
});

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
    // undefined, {} and [] all hit the same guard branch
    // (service: !raw || !raw.currency && !raw.items) — one table.
    it.each([undefined, {}, []])(
      'logs and returns the exact empty shape for invalid payload %p',
      (raw) => {
        expect(normalizeInventory(raw)).toEqual({ currency: EMPTY_CURRENCY, items: [] });
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[inventoryService] Invalid party inventory payload:',
          raw
        );
      }
    );

    it('repairs partial values, keeps valid ones, floors/clamps quantities, drops blanks, mints ids and sorts by name — silently', () => {
      // One call exercises both classes of payload the old split pinned: partial
      // garbage AND fully-valid pass-through are the same code path (valid
      // positive integers survive Math.floor untouched) — the SSE echo lane
      // (PartyInventory feeds normalizeInventory(event.data)) gets its
      // passthrough fidelity from this same assertion.
      const fixed = normalizeInventory({
        currency: { pp: 1, gp: '12', sp: -4, cp: 2.7 },
        items: [
          { name: 'Torch', quantity: 0 },
          { id: 'keep', name: ' Antitoxin ', quantity: 2.7, description: 'venom' },
          { name: 'Rations', quantity: 'lots' },
          { name: '' },
          null,
        ],
      });

      // valid pp preserved; numeric string repaired; negatives and fractions
      // floored toward legal whole coins
      expect(fixed.currency).toEqual({ pp: 1, gp: 12, sp: 0, cp: 2 });
      // exact keys per item (id/name/quantity/description), name-sorted,
      // quantity floored to >=1 (0, 2.7, non-numeric all → legal), blank/null
      // items dropped, id preserved or minted
      expect(fixed.items).toEqual([
        { id: 'keep', name: 'Antitoxin', quantity: 2, description: 'venom' },
        { id: expect.any(String), name: 'Rations', quantity: 1, description: '' },
        { id: expect.any(String), name: 'Torch', quantity: 1, description: '' },
      ]);
      // minted ids come from utils.safeUuid — distinct per item, non-empty
      expect(fixed.items[1].id).not.toBe(fixed.items[2].id);
      expect(fixed.items[1].id).not.toHaveLength(0);
      // repair path is a valid payload — must stay silent (guard logs only)
      expect(consoleErrorSpy).not.toHaveBeenCalled();
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
      expect(fetchSpy.mock.calls).toEqual([
        ['/api/campaigns/my%20campaign%2F1/inventory'],
      ]);
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
  });

  describe('applyItemIntent', () => {
    it('POSTs the exact single-intent body to /inventory/item and returns only the normalized inventory', async () => {
      const intent = { action: 'setQty', id: 'a', quantity: 2, name: 'Rope' };
      const inventory = {
        currency: { pp: 0, gp: 15, sp: 0, cp: 0 },
        items: [{ id: 'a', name: 'Rope', quantity: 2, description: '50 ft' }],
      };
      // server truth: res.json({ success: true, inventory }) — the intent merged onto
      // the SERVER's re-read ledger (currency preserved, items re-sorted)
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, inventory }),
      });

      const result = await applyItemIntent('test-campaign', intent);

      // full-shape toEqual already proves the client DROPS the success flag —
      // it returns normalizeInventory(data.inventory) only
      expect(result).toEqual(inventory);
      expect(fetchSpy.mock.calls).toEqual([
        ['/api/campaigns/test-campaign/inventory/item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(intent),
        }],
      ]);
    });

    it('carries status and a normalized merged inventory on the concurrent-deletion 409 (stale-view adoption)', async () => {
      // server truth: update/setQty/delete on a row another window already
      // removed ships { error, inventory } — the client attaches status always
      // and re-normalizes the conflict doc so the view can adopt it safely.
      fetchSpy.mockResolvedValue({
        ...failedResponse({
          error: 'Party item "Rope" was deleted in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.',
          inventory: {
            currency: { gp: 2 },
            items: [{ name: ' Antitoxin ', quantity: 0 }, { id: 'a', name: 'Rope', quantity: 1, description: '50 ft' }],
          },
        }),
        status: 409,
        statusText: 'Conflict',
      });
      const failure = await applyItemIntent('test-campaign', { action: 'delete', id: 'a', name: 'Rope' })
        .then(() => null, error => error);
      expect(failure.message).toContain('Party item "Rope" was deleted');
      expect(failure.status).toBe(409);
      // partial/unsorted conflict doc arrives normalized
      expect(failure.inventory).toEqual({
        currency: { pp: 0, gp: 2, sp: 0, cp: 0 },
        items: [
          { id: expect.any(String), name: 'Antitoxin', quantity: 1, description: '' },
          { id: 'a', name: 'Rope', quantity: 1, description: '50 ft' },
        ],
      });
    });

    it('leaves .inventory undefined when the failure body ships no inventory', async () => {
      fetchSpy.mockResolvedValue(failedResponse({ error: 'item.name is required' }));
      const failure = await applyItemIntent('test-campaign', { action: 'add', item: {} })
        .then(() => null, error => error);
      expect(failure.message).toBe('item.name is required');
      expect(failure.status).toBe(500);
      expect(failure.inventory).toBeUndefined();
    });
  });

  describe('transferInventory', () => {
    it('POSTs exact item and currency-set bodies to /inventory/transfer and spreads the envelope with normalized inventory', async () => {
      const itemTransfer = {
        direction: 'party-to-player',
        playerName: 'Mordai',
        itemName: 'Torch',
        quantity: 2,
      };
      // currency-set body (PartyInventory.jsx currency moves) — same route
      const currencyTransfer = {
        direction: 'party-to-player',
        playerName: 'Mordai',
        currency: { pp: 0, gp: 5, sp: 0, cp: 0 },
      };
      // server truth: { success: true, inventory, character: { name, inventory } }
      const envelope = {
        success: true,
        inventory: {
          currency: EMPTY_CURRENCY,
          items: [{ id: 'a', name: 'Antitoxin', quantity: 1, description: 'venom' }],
        },
        character: {
          name: 'Mordai',
          inventory: { backpack: ['Torch'], equipped: [], gold: 0, magicItems: [] },
        },
      };
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(envelope) });

      const result = await transferInventory('test-campaign', itemTransfer);
      await transferInventory('test-campaign', currencyTransfer);

      // client spreads { success, character } untouched and re-normalizes inventory
      expect(result).toEqual(envelope);
      // ordered body census: both lanes hit the one route with exact payloads
      expect(fetchSpy.mock.calls).toEqual([
        ['/api/campaigns/test-campaign/inventory/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itemTransfer),
        }],
        ['/api/campaigns/test-campaign/inventory/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currencyTransfer),
        }],
      ]);
    });
  });

  describe('adjustCurrency', () => {
    it('POSTs the exact signed delta body to /inventory/adjust and returns the normalized inventory', async () => {
      const currency = { pp: 0, gp: -10, sp: 0, cp: 3 };
      // server truth: res.json({ success: true, inventory }) — clamped-and-added
      // onto the SERVER's ledger
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          inventory: { currency: { pp: 0, gp: 0, sp: 0, cp: 10 }, items: [] },
        }),
      });

      const result = await adjustCurrency('test-campaign', currency);

      expect(result).toEqual({ currency: { pp: 0, gp: 0, sp: 0, cp: 10 }, items: [] });
      expect(fetchSpy.mock.calls).toEqual([
        ['/api/campaigns/test-campaign/inventory/adjust', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currency }),
        }],
      ]);
    });
  });

  describe('error contract — shared by all four fetch lanes', () => {
    it.each(FETCH_LANES)(
      '$name: rethrows the server error body over its own generic, then the generic, then raw network errors',
      async ({ invoke, serverTruth, fallback }) => {
        // server-truth extraction branch first (status-independent)…
        fetchSpy.mockResolvedValue(failedResponse({ error: serverTruth }));
        await expect(invoke()).rejects.toThrow(serverTruth);

        // …then the defensive client-only generic (server always sends { error })
        fetchSpy.mockResolvedValue(failedResponse({}));
        await expect(invoke()).rejects.toThrow(fallback);

        // json() itself rejects (e.g. an HTML error page) — the
        // .catch(() => ({})) leg must route to the same generic
        fetchSpy.mockResolvedValue({
          ok: false,
          status: 502,
          statusText: 'Bad Gateway',
          json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
        });
        await expect(invoke()).rejects.toThrow(fallback);

        // raw network errors propagate unswallowed — the swallow lives in the
        // consumer (PartyInventory.jsx 'save failed:'), this boundary logs nothing
        fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));
        await expect(invoke()).rejects.toThrow('ENOTFOUND');
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      }
    );
  });
});
