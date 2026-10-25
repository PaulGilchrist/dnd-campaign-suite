// @maintained-by-ai: 2026-10-24
// Improve (party-currency chip burst coalescing): +/- chip clicks each fired one full-store
// POST (~30/session on /inventory). Currency writes now sit behind a 400ms trailing debounce
// on the existing persist queue: a burst of clicks merges into ONE POST carrying the summed
// latest snapshot (server publishes `inventory-<campaign>` once per flush), spaced clicks
// still flush individually, and nothing is ever dropped — in-flight flushes re-flush pending
// snapshots, unmount flushes a stranded burst, and row-level −chips gate on the PROJECTED
// (optimistic) balance mid-burst. Fake timers; fetch mocked to the real route semantics
// (GET / whole-doc replace POST on /api/campaigns/test-campaign/inventory).
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PartyInventory from './PartyInventory.jsx';

const INVENTORY_URL = '/api/campaigns/test-campaign/inventory';
const DEBOUNCE_MS = 400;

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: () => () => {},
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
  onBack: vi.fn(),
};

const baseInventory = () => ({
  currency: { pp: 0, gp: 50, sp: 20, cp: 10 },
  items: [{ id: 'i1', name: 'Rope, Hempen', quantity: 1, description: '' }],
});

/** Fake ledger mirroring server/routes/inventory.js whole-doc POST semantics. */
let server;
let posts; // parsed payload of every POST to the inventory endpoint
let holdPost; // when true, the next POST parks until releasePost()
let releasePost = null;
let staleOverride = null; // when set, the parked POST answers THIS instead of its own save

function response(body) {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
}

const clone = (v) => JSON.parse(JSON.stringify(v));

const fetchMock = vi.fn(async (url, options = {}) => {
  if (!String(url).startsWith(INVENTORY_URL)) return response({});
  if (options.method !== 'POST') return response({ inventory: clone(server) });
  const body = JSON.parse(options.body);
  posts.push(body);
  if (holdPost) {
    holdPost = false;
    await new Promise(resolve => { releasePost = resolve; });
    if (staleOverride) {
      const stale = staleOverride;
      staleOverride = null;
      return response({ success: true, inventory: stale });
    }
  }
  server = { currency: { ...server.currency, ...body.currency }, items: body.items ?? [] };
  return response({ success: true, inventory: clone(server) });
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
  posts = [];
  holdPost = false;
  releasePost = null;
  staleOverride = null;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('PartyInventory currency chip burst debounce', () => {
  it('merges a burst of five mixed chip clicks into exactly ONE POST with summed balances', async () => {
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
    expect(posts).toHaveLength(0); // nothing flushed while the burst is still clicking

    await pastDebounce();
    expect(posts).toHaveLength(1);
    expect(posts[0].currency).toEqual({ pp: 0, gp: 79, sp: 120, cp: 10 });
    // The lone POST actually landed (GET of the fake ledger).
    expect(server.currency.gp).toBe(79);
    expect(server.currency.sp).toBe(120);
  });

  it('flushes clicks spaced beyond the debounce window individually (burst-shaped, not rate-limit)', async () => {
    await renderReady();
    fireEvent.click(screen.getByTitle('Add 10 gp'));
    await pastDebounce();
    expect(posts).toHaveLength(1);
    expect(posts[0].currency.gp).toBe(60);

    fireEvent.click(screen.getByTitle('Add 1 gp'));
    await pastDebounce();
    expect(posts).toHaveLength(2);
    expect(posts[1].currency.gp).toBe(61);
    expect(server.currency.gp).toBe(61);
  });

  it('lands a lone click on the server within ~1s of the click', async () => {
    await renderReady();
    fireEvent.click(screen.getByTitle('Add 1 cp'));
    await pastDebounce(1000); // generous bound: 400ms debounce + flush
    expect(posts).toHaveLength(1);
    expect(posts[0].currency.cp).toBe(11);
    expect(server.currency.cp).toBe(11);
  });

  it('in-flight flush with a queued follow-up edit: no lost update, trailing POST carries the merged latest', async () => {
    await renderReady();
    fireEvent.click(screen.getByTitle('Add 10 gp'));
    holdPost = true; // first POST parks mid-flight
    await pastDebounce();
    expect(posts).toHaveLength(1);
    expect(posts[0].currency.gp).toBe(60);

    // A newer local edit lands while the flush is in flight: it queues, it never posts early.
    fireEvent.click(screen.getByLabelText('Increase quantity'));
    expect(posts).toHaveLength(1);

    const resolve = releasePost;
    await act(async () => {
      resolve();
    });
    await pastDebounce(50); // finally-refill of the queued snapshot
    expect(posts).toHaveLength(2);
    expect(posts[1].currency.gp).toBe(60);
    expect(posts[1].items[0].quantity).toBe(2);
    expect(goldAmount()).toBe('60');
    expect(screen.getByLabelText('Quantity').value).toBe('2');
    expect(server.items[0].quantity).toBe(2);
  });

  it('drops a stale full-store echo over newer queued local state', async () => {
    await renderReady();
    fireEvent.click(screen.getByTitle('Add 10 gp'));
    holdPost = true;
    await pastDebounce();
    expect(posts).toHaveLength(1);

    // Newer edit queued mid-flight bumps the revision…
    fireEvent.click(screen.getByLabelText('Increase quantity'));
    // …so the parked POST answering with an OLD whole-doc snapshot is ignored.
    staleOverride = { currency: { pp: 0, gp: 50, sp: 20, cp: 10 }, items: [{ id: 'i1', name: 'Rope, Hempen', quantity: 1, description: '' }] };
    const resolve = releasePost;
    await act(async () => {
      resolve();
    });
    await pastDebounce(100);
    expect(goldAmount()).toBe('60'); // stale gp 50 never lands
    expect(screen.getByLabelText('Quantity').value).toBe('2');
    expect(posts).toHaveLength(2);
    expect(posts[1].currency.gp).toBe(60);
    expect(posts[1].items[0].quantity).toBe(2);
  });

  it('gates −chip at the PROJECTED balance mid-burst and never posts below zero', async () => {
    server.currency.gp = 15;
    await renderReady();
    expect(goldAmount()).toBe('15');

    fireEvent.click(screen.getByTitle('Remove 10 gp'));
    // Instant optimistic projection: 5 left → the second −10 is disabled mid-burst,
    // while saving is false (flush still debounced) so +chips stay live.
    expect(goldAmount()).toBe('5');
    expect(screen.getByTitle('Remove 10 gp').disabled).toBe(true);
    expect(screen.getByTitle('Add 10 gp').disabled).toBe(false);
    expect(posts).toHaveLength(0);

    // A same-burst +10 rides onto the SAME trailing POST: projected back to 15.
    fireEvent.click(screen.getByTitle('Add 10 gp'));
    expect(goldAmount()).toBe('15');
    await pastDebounce();
    expect(posts).toHaveLength(1);
    expect(posts[0].currency.gp).toBe(15);
    expect(server.currency.gp).toBe(15);
  });

  it('flushes a debounced burst on unmount so navigating away never loses the write', async () => {
    const view = await renderReady();
    fireEvent.click(screen.getByTitle('Add 10 gp'));
    fireEvent.click(screen.getByTitle('Add 10 gp'));
    expect(posts).toHaveLength(0); // inside the debounce window
    await act(async () => {
      view.unmount();
    });
    expect(posts).toHaveLength(1);
    expect(posts[0].currency.gp).toBe(70);
    expect(server.currency.gp).toBe(70);
  });
});
