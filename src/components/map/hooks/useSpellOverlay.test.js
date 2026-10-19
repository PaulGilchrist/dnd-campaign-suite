// @maintained-by-ai
// LANE: useSpellOverlay hook (map) — ownership contract for the hook instance itself:
// mount-load adoption via spellOverlayService, local mutation immediacy, outbound
// POST transport exact URL+body, debounce window semantics, and the handleSSEEvent
// consumer seam (the hook does NOT construct EventSource — the app's ONE shared SSE
// connection wires parent dispatch into handleSSEEvent; registration is owned there, #841).
//
// Seams (who owns what):
//   spellOverlayService.test.js     — GET /spell-overlay transport, ok/json/error fallback
//   sseHandlers-overlay.test.jsx #873 — initiative createOverlayHandler BODY (different module)
//   Map*.test.jsx / container #865    — wiring + DOM routing (mocks this hook entirely)
//   useSpellHandlers.test.js #913     — explicitly defers overlay persistence/SSE to this file
//   THIS FILE                           — hook state adoption, POST body shapes, debounce, guard
//
// Mock hygiene: spellOverlayService boundary-mocked (GET transport proven at owner);
// global fetch mocked in beforeEach (zero real network, deterministic, #906); fake timers
// only for the 150ms update debounce (permitted network-debounce category — deterministic
// flush via advanceTimersByTime, no sleeps); state asserted with exact literals, not
// memo identity (#796).
//
// Old→new map (36→9): init-empty→cut (asserted in every T) · fetch-on-mount + merge-by-id
// →T1(+no-campaign guard) · fetch-error + network-error→cut (service owner, :70/:75) ·
// CRUD add/update/remove/clear/silent-miss ×7→T2 (one exact-byte sequence) · API add/remove
// /clear→T3 (URL+body exact once each) · API-error-log→T4(+optimistic keep) ·
// debounce ×2→T5(not-immediate, window, coalesce-latest) · immediate ×2→T6 (flush+cancel) ·
// SSE add-unique+dedupe / update+no-match / remove+no-match / clear→T7 (verbatim lifecycle
// +echo stability) · SSE guards ×9→T8 (zero-write table) · returned-state→T9 (real round-trip).
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useSpellOverlay from './useSpellOverlay.js';
import { fetchSpellOverlays } from '../../../services/maps/spellOverlayService.js';

// Boundary mock: GET transport and its error fallbacks are proven at the service owner.
vi.mock('../../../services/maps/spellOverlayService.js', () => ({
  fetchSpellOverlays: vi.fn(),
}));

describe('useSpellOverlay', () => {
  const campaignName = 'test-campaign';
  const URL = '/spell-overlay?campaign=test-campaign';
  const o1 = { id: 'o1', name: 'Fireball', radius: 20 };
  const o2 = { id: 'o2', name: 'Cone', angle: 60 };

  let fetchSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpellOverlays.mockResolvedValue([]);
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const getHook = (campaign = campaignName, map = 'test-map') =>
    renderHook(() => useSpellOverlay(campaign, map));

  it('adopts server overlays verbatim on mount, deduping by id against local adds', async () => {
    const srv1 = { id: 's1', name: 'Server', radius: 10 };
    const srv2 = { id: 's2', name: 'Server2', radius: 15 };
    fetchSpellOverlays.mockResolvedValue([srv1, srv2]);
    const { result } = getHook();
    expect(fetchSpellOverlays).toHaveBeenCalledTimes(1);
    expect(fetchSpellOverlays).toHaveBeenCalledWith(campaignName);
    act(() => {
      result.current.addOverlay({ id: 's1', name: 'Local', radius: 20 });
    });
    await act(async () => {});
    expect(result.current.overlays).toEqual([
      { id: 's1', name: 'Local', radius: 20 },
      srv2,
    ]);

    // No campaign → no load attempt.
    fetchSpellOverlays.mockClear();
    renderHook(() => useSpellOverlay(undefined, undefined));
    expect(fetchSpellOverlays).not.toHaveBeenCalled();
  });

  it('applies local mutations to state immediately, ignoring unknown ids', () => {
    const { result } = getHook();
    act(() => {
      result.current.addOverlay(o1);
      result.current.addOverlay(o2);
    });
    expect(result.current.overlays).toEqual([o1, o2]);

    act(() => {
      result.current.updateOverlay({ id: 'o1', name: 'Fireball', radius: 30 });
    });
    expect(result.current.overlays).toEqual([
      { id: 'o1', name: 'Fireball', radius: 30 },
      o2,
    ]);

    act(() => {
      result.current.removeOverlay('o2');
      // Unknown ids are silent no-ops:
      result.current.removeOverlay('ghost');
      result.current.updateOverlay({ id: 'ghost', name: 'Phantom' });
    });
    expect(result.current.overlays).toEqual([{ id: 'o1', name: 'Fireball', radius: 30 }]);

    act(() => {
      result.current.clearOverlays();
      result.current.clearOverlays();
    });
    expect(result.current.overlays).toEqual([]);
  });

  it('POSTs add/remove/clear to the exact spell-overlay URL with exact bodies, once each', () => {
    const { result } = getHook();
    act(() => {
      result.current.addOverlay(o1);
      result.current.removeOverlay('o1');
      result.current.clearOverlays();
    });
    expect(
      fetchSpy.mock.calls.map(([url, opts]) => [url, opts.method, JSON.parse(opts.body)])
    ).toEqual([
      [URL, 'POST', { action: 'add', overlays: [o1] }],
      [URL, 'POST', { action: 'remove', overlayId: 'o1' }],
      [URL, 'POST', { action: 'clear' }],
    ]);
  });

  it('logs and keeps optimistic state when the transport fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchSpy.mockRejectedValue(new Error('API fail'));
    const { result } = getHook();
    act(() => {
      result.current.addOverlay(o1);
    });
    await act(async () => {});
    expect(consoleSpy).toHaveBeenCalledWith('Spell overlay API error:', expect.any(Error));
    expect(result.current.overlays).toEqual([o1]);
  });

  it('debounces updateOverlay and coalesces rapid updates to the latest', () => {
    const { result } = getHook();
    act(() => {
      result.current.addOverlay(o1);
    });
    fetchSpy.mockClear();
    act(() => {
      result.current.updateOverlay({ id: 'o1', name: 'Fireball', radius: 30 });
      result.current.updateOverlay({ id: 'o1', name: 'Fireball', radius: 40 });
      result.current.updateOverlay({ id: 'o1', name: 'Fireball', radius: 50 });
    });
    act(() => {
      vi.advanceTimersByTime(149);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      URL,
      expect.objectContaining({ body: JSON.stringify({ action: 'update', overlays: [{ id: 'o1', name: 'Fireball', radius: 50 }] }) }),
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('updateOverlayImmediate POSTs at once and cancels the pending debounce', () => {
    const { result } = getHook();
    act(() => {
      result.current.addOverlay(o1);
    });
    fetchSpy.mockClear();
    act(() => {
      result.current.updateOverlay({ id: 'o1', name: 'Fireball', radius: 30 });
      result.current.updateOverlayImmediate({ id: 'o1', name: 'Fireball', radius: 40 });
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      URL,
      expect.objectContaining({ body: JSON.stringify({ action: 'update', overlays: [{ id: 'o1', name: 'Fireball', radius: 40 }] }) }),
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.current.overlays).toEqual([{ id: 'o1', name: 'Fireball', radius: 40 }]);
  });

  it('adopts SSE add/update/remove/clear payloads verbatim and survives echoed events', () => {
    const { result } = getHook();
    act(() => {
      result.current.addOverlay(o1);
    });
    const sse = (data) => ({ key: 'spell-overlay-test-campaign', data });
    const o1v2 = { id: 'o1', name: 'Fireball Updated', radius: 30 };

    act(() => {
      // add: appends new verbatim, dedupes existing id (first bytes win)
      result.current.handleSSEEvent(sse({ action: 'add', overlays: [o2, { id: 'o1', name: 'Dup' }] }));
    });
    expect(result.current.overlays).toEqual([o1, o2]);

    act(() => {
      // update: replaces by id, ignores unknown id
      result.current.handleSSEEvent(sse({ action: 'update', overlays: [o1v2, { id: 'ghost' }] }));
      // echo of the same event: stable state, no duplicate writes
      result.current.handleSSEEvent(sse({ action: 'update', overlays: [o1v2] }));
    });
    expect(result.current.overlays).toEqual([o1v2, o2]);

    act(() => {
      // remove: drops by id, unknown id is a no-op
      result.current.handleSSEEvent(sse({ action: 'remove', overlayId: 'o2' }));
      result.current.handleSSEEvent(sse({ action: 'remove', overlayId: 'ghost' }));
    });
    expect(result.current.overlays).toEqual([o1v2]);

    act(() => {
      result.current.handleSSEEvent(sse({ action: 'clear' }));
    });
    expect(result.current.overlays).toEqual([]);
  });

  it('writes nothing for malformed, foreign-prefixed, or foreign-campaign events', () => {
    const { result } = getHook();
    act(() => {
      result.current.addOverlay(o1);
    });
    const KEY = 'spell-overlay-test-campaign';
    const ignored = [
      ['null event', null],
      ['event without key', { data: { action: 'clear' } }],
      ['foreign key prefix', { key: 'other-event', data: { action: 'clear' } }],
      ['foreign campaign', { key: 'spell-overlay-other-campaign', data: { action: 'clear' } }],
      ['event without data', { key: KEY }],
      ['unknown action', { key: KEY, data: { action: 'unknown' } }],
      ['add with empty overlays', { key: KEY, data: { action: 'add', overlays: [] } }],
      ['update with empty overlays', { key: KEY, data: { action: 'update', overlays: [] } }],
      ['remove without overlayId', { key: KEY, data: { action: 'remove' } }],
    ];
    for (const [label, event] of ignored) {
      act(() => {
        result.current.handleSSEEvent(event);
      });
      expect(result.current.overlays, label).toEqual([o1]);
    }
  });

  it('round-trips pendingOverlay locally without touching the transport', () => {
    const { result } = getHook();
    expect(result.current.pendingOverlay).toBeNull();
    const pending = { id: 'new', name: 'Placement', radius: 10 };
    act(() => {
      result.current.setPendingOverlay(pending);
    });
    expect(result.current.pendingOverlay).toEqual(pending);
    expect(fetchSpy).not.toHaveBeenCalled();
    act(() => {
      result.current.setPendingOverlay(null);
    });
    expect(result.current.pendingOverlay).toBeNull();
  });
});
