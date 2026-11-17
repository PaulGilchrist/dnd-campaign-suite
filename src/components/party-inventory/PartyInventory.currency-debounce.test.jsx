// @maintained-by-ai: 2026-11-17
// Improve (party-currency chip burst coalescing) + clobber migration: +/- chip clicks
// used to each fire one full-store snapshot POST (~30/session) and later a 400ms trailing
// debounce merged bursts into ONE whole-document POST — which let two GM windows silently
// clobber each other's presses (bug-inventory-chip-cross-tab-full-doc-clobber). The chip
// lane now accumulates a signed per-coin DELTA behind the same 400ms trailing debounce and
// flushes it to the atomic /inventory/adjust route (server clamps and adds onto ITS
// ledger), so spaced clicks still flush individually, nothing is dropped, a net-zero
// burst posts nothing, and an in-flight currency flush can neither block nor clobber an
// item write (separate queues now). Fake timers; fetch mocked to the real route semantics
// (GET doc · POST /inventory/item atomic single-row intent · POST /adjust signed deltas).
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PartyInventory from './PartyInventory.jsx';

const INVENTORY_URL = '/api/campaigns/test-campaign/inventory';
const ADJUST_URL = `${INVENTORY_URL}/adjust`;
const ITEM_URL = `${INVENTORY_URL}/item`;
const DEBOUNCE_MS = 400;
const COIN_KEYS = ['pp', 'gp', 'sp', 'cp'];

let sseHandler = null;

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: (_campaign, handler) => {
    sseHandler = handler;
    return () => { sseHandler = null; };
  },
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn().mockResolvedValue([]),
}));

const defaultProps = {
  campaignName: 'test-campaign',
  isLocalhost: true,
  characters: [
    { name: 'War Cleric', inventory: { backpack: [], equipped: [], gold: 10, magicItems: [] } },
  ],
};

const baseInventory = () => ({
  currency: { pp: 0, gp: 50, sp: 20, cp: 10 },
  items: [{ id: 'i1', name: 'Rope, Hempen', quantity: 1, description: '' }],
});

/** Fake ledger mirroring server/routes/inventory.js lane semantics. */
let server;
let adjustments; // currency payloads of every POST to /inventory/adjust
let itemIntents; // bodies of every POST to /inventory/item
let holdAdjust;  // when true, the next adjust RESPONSE parks (server-side write is
                 // already applied — only network delivery is delayed, the honest
                 // out-of-order-delivery model for a single-threaded sync handler)
let holdItem;    // same, for the items lane
let releaseAdjust = null;
let releaseItem = null;

function response(body) {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
}

const clone = (v) => JSON.parse(JSON.stringify(v));

// Mirror the route's `publish(inventory-<campaign>, …)` — the SSE echo fires before the
// HTTP response and is what re-bases every window's view (and bumps the revision stamp
// that drops out-of-order acks).
function publishEvent() {
  if (sseHandler) sseHandler({ key: 'inventory-test-campaign', data: clone(server) });
}

// Apply ONE intent onto the CURRENT fake ledger — rows the intent never mentions
// survive by construction (the retired snapshot lane replaced the whole list instead).
function applyIntentToLedger(body) {
  const items = server.items;
  if (body.action === 'add' || body.action === 'update') {
    const index = items.findIndex(i => i.id === body.item.id);
    const row = { name: body.item.name, quantity: body.item.quantity, description: body.item.description };
    if (index >= 0) items[index] = { ...items[index], ...row };
    else items.push({ id: body.item.id, ...row });
  } else if (body.action === 'setQty') {
    const target = items.find(i => i.id === body.id);
    if (!target) return false;
    target.quantity = body.quantity;
  } else if (body.action === 'delete') {
    server = { currency: server.currency, items: items.filter(i => i.id !== body.id) };
    return true;
  }
  server = { currency: server.currency, items };
  return true;
}

const fetchMock = vi.fn(async (url, options = {}) => {
  const target = String(url);
  if (target !== INVENTORY_URL && target !== ADJUST_URL && target !== ITEM_URL) return response({});
  if (options.method !== 'POST') return response({ inventory: clone(server) });
  const body = JSON.parse(options.body);
  if (target === ADJUST_URL) {
    adjustments.push(body.currency);
    for (const key of COIN_KEYS) {
      server.currency[key] = Math.max(0, server.currency[key] + (body.currency[key] || 0));
    }
    const truth = clone(server);
    publishEvent();
    if (holdAdjust) {
      holdAdjust = false;
      await new Promise(resolve => { releaseAdjust = resolve; });
    }
    return response({ success: true, inventory: truth });
  }
  itemIntents.push(body);
  if (!applyIntentToLedger(body)) {
    return {
      ok: false,
      status: 409,
      json: async () => ({ error: `Party item "${body.name}" was deleted in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.`, inventory: clone(server) }),
    };
  }
  const truth = clone(server);
  publishEvent();
  if (holdItem) {
    holdItem = false;
    await new Promise(resolve => { releaseItem = resolve; });
  }
  return response({ success: true, inventory: truth });
});

async function renderReady() {
  let view = null;
  await act(async () => {
    view = render(<PartyInventory {...defaultProps} />);
  });
  screen.getByText('Party Inventory');
  return view;
}

// Advance past the trailing debounce + let the POST/response microtask chain settle.
async function pastDebounce(ms = DEBOUNCE_MS + 100) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function goldAmount() {
  return screen.getByText('Gold').closest('.pi-currency-row').querySelector('.pi-currency-amount').textContent;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
  server = baseInventory();
  adjustments = [];
  itemIntents = [];
  holdAdjust = false;
  holdItem = false;
  releaseAdjust = null;
  releaseItem = null;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('PartyInventory currency chip burst debounce', () => {
  it('merges a burst of five mixed chip clicks into exactly ONE signed delta POST', async () => {
    await renderReady();
    await act(async () => {
      fireEvent.click(screen.getByTitle('Add 10 gp'));
      fireEvent.click(screen.getByTitle('Add 10 gp'));
      fireEvent.click(screen.getByTitle('Add 10 gp'));
      fireEvent.click(screen.getByTitle('Remove 1 gp'));
      fireEvent.click(screen.getByTitle('Add 100 sp'));
    });

    // Optimistic display is instant: 50 +30 −1 = 79 gp, 20 +100 = 120 sp.
    expect(goldAmount()).toBe('79');
    expect(adjustments).toHaveLength(0); // nothing flushed while the burst is still clicking

    await pastDebounce();
    // ONE flush carrying the summed signed deltas — not snapshots, not 5 POSTs.
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0]).toEqual({ pp: 0, gp: 29, sp: 100, cp: 0 });
    // The chips never touch the items lane.
    expect(itemIntents).toHaveLength(0);
    // The fake ledger converged additively onto 79/120.
    expect(server.currency.gp).toBe(79);
    expect(server.currency.sp).toBe(120);
  });

  it('flushes clicks spaced beyond the debounce window individually as relative deltas', async () => {
    await renderReady();
    fireEvent.click(screen.getByTitle('Add 10 gp'));
    await pastDebounce();
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].gp).toBe(10);

    fireEvent.click(screen.getByTitle('Add 1 gp'));
    await pastDebounce();
    expect(adjustments).toHaveLength(2);
    // The second flush posts the +1 DELTA, never a 61-gp snapshot.
    expect(adjustments[1].gp).toBe(1);
    expect(server.currency.gp).toBe(61);
  });

  it('lands a lone click on the server within ~1s of the click', async () => {
    await renderReady();
    fireEvent.click(screen.getByTitle('Add 1 cp'));
    await pastDebounce(1000); // generous bound: 400ms debounce + flush
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].cp).toBe(1);
    expect(server.currency.cp).toBe(11);
  });

  it('an in-flight currency flush never blocks or clobbered a newer item edit', async () => {
    await renderReady();
    fireEvent.click(screen.getByTitle('Add 10 gp'));
    holdAdjust = true; // first adjust RESPONSE parks mid-flight (ledger already credited)
    await pastDebounce();
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].gp).toBe(10);

    // The queued currency POST disables the chips (one in-flight per lane) but the
    // ITEM lane posts immediately on its own queue — the old shared full-doc queue
    // used to park it behind the currency write.
    fireEvent.click(screen.getByLabelText('Increase quantity of Rope, Hempen'));
    await pastDebounce(50);
    expect(itemIntents).toHaveLength(1);
    expect(itemIntents[0]).toEqual({ action: 'setQty', id: 'i1', quantity: 2, name: 'Rope, Hempen' });
    expect(goldAmount()).toBe('60');

    const resolve = releaseAdjust;
    await act(async () => {
      resolve();
    });
    // Both lanes landed: gp 60 (currency delta) and qty 2 (items save), no lost update.
    expect(server.currency.gp).toBe(60);
    expect(server.items[0].quantity).toBe(2);
    expect(goldAmount()).toBe('60');
    expect(screen.getByLabelText('Quantity').value).toBe('2');
  });

  it('drops a stale items-lane response over newer local state (revision guard)', async () => {
    await renderReady();
    fireEvent.click(screen.getByTitle('Add 10 gp')); // optimistic gp 60 before any POST
    holdItem = true;
    fireEvent.click(screen.getByLabelText('Increase quantity of Rope, Hempen')); // item POST parks
    await pastDebounce();
    // The parked items response was minted BEFORE the chip flush landed — an old
    // whole-doc answer must never resurrect old coin values over newer truth.
    expect(adjustments).toHaveLength(1);
    expect(server.currency.gp).toBe(60);
    expect(goldAmount()).toBe('60');

    const resolve = releaseItem;
    await act(async () => {
      resolve();
    });
    await pastDebounce(100);
    expect(goldAmount()).toBe('60'); // never regresses to the pre-flush 50
    expect(screen.getByLabelText('Quantity').value).toBe('2');
  });

  it('gates −chip at the PROJECTED balance mid-burst and posts nothing net-zero', async () => {
    server.currency.gp = 15;
    await renderReady();
    expect(goldAmount()).toBe('15');

    fireEvent.click(screen.getByTitle('Remove 10 gp'));
    // Instant optimistic projection: 5 left → the second −10 is disabled mid-burst,
    // while saving is false (flush still debounced) so +chips stay live.
    expect(goldAmount()).toBe('5');
    expect(screen.getByTitle('Remove 10 gp').disabled).toBe(true);
    expect(screen.getByTitle('Add 10 gp').disabled).toBe(false);
    expect(adjustments).toHaveLength(0);

    // A same-burst +10 rides onto the SAME trailing flush: projected back to 15,
    // net delta zero — the burst needs NO server round-trip at all.
    fireEvent.click(screen.getByTitle('Add 10 gp'));
    expect(goldAmount()).toBe('15');
    await pastDebounce();
    expect(adjustments).toHaveLength(0);
    expect(server.currency.gp).toBe(15);
  });

  it('flushes a debounced burst on unmount so navigating away never loses the write', async () => {
    const view = await renderReady();
    fireEvent.click(screen.getByTitle('Add 10 gp'));
    fireEvent.click(screen.getByTitle('Add 10 gp'));
    expect(adjustments).toHaveLength(0); // inside the debounce window
    await act(async () => {
      view.unmount();
    });
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].gp).toBe(20);
    expect(server.currency.gp).toBe(70);
  });
});
