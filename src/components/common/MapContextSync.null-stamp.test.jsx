// @maintained-by-ai 2026-11-27
/**
 * Null-stamp face of MapContextSync: null/absent names must NEVER write.
 * A freshly-mounted tab has local activeMapName = null until the server's
 * active-map fetch resolves; force-stamping null there used to clobber the
 * server-authoritative '__map__' (the activate route owns that key). Locks:
 * the map lane stays silent while the name is null (mount AND back-nav), one
 * store+server write per null→map transition, .json-suffix normalization on
 * both lanes, the skipSync=true single-server-writer lock
 * (improvement-map-open-double-writes: the guard-free force-stamp is the ONLY
 * POST lane), an empty campaign as a total gate, and render survival when a
 * stamp POST rejects.
 *
 * Sibling lanes (observed current bytes, NOT restated here):
 * - MapContextSync.dedupe.test.jsx (6 tests): '__campaign__' value-unchanged
 *   dedupe, campaign switch, fresh-cache re-stamp, failed-stamp cache heal.
 * - MapContextSync.read-only.test.jsx (2 tests): non-GM client mirrors
 *   '__map__' locally with zero server writes.
 */
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MapContextSync, { _resetForTests } from './MapContextSync.jsx';
import { setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeObject: vi.fn(),
}));

// The component force-posts to /api/campaigns/:campaign/<key>; surface those
// requests as { key, method, value } so each test asserts the full contract
// (which key, HTTP verb, payload) instead of fuzzy URL suffix matching.
function stampRequests(fetchMock) {
  return fetchMock.mock.calls.map(([url, init]) => ({
    key: decodeURIComponent(url.split('/').pop()),
    method: init?.method,
    value: JSON.parse(init?.body).value,
  }));
}

function stampsFor(fetchMock, key) {
  return stampRequests(fetchMock).filter(req => req.key === key);
}

// Expected shape of a local store mirror: skipSync=true, so the mirror never
// POSTs — the force-stamp lane owns the server write.
function mirror(key, value) {
  return [key, value, 'test-campaign', true];
}

describe('MapContextSync', () => {
  let fetchMock;

  beforeEach(() => {
    // Fresh-session state per test: the module-level last-stamped campaign
    // cache survives the file-level module registry (improvement-2026-10-26-C).
    _resetForTests();
    setRuntimeObject.mockClear();
    fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
  });

  it('mirrors the campaign name into the runtime store and force-posts it to the server', () => {
    render(<MapContextSync campaignName="test-campaign" activeMapName={null} />);

    expect(setRuntimeObject).toHaveBeenCalledWith(
      '__campaign__', { campaignName: 'test-campaign' }, 'test-campaign', true,
    );
    expect(stampRequests(fetchMock)).toEqual([
      { key: '__campaign__', method: 'POST', value: { campaignName: 'test-campaign' } },
    ]);
  });

  // The null-stamp core, told as one ordered sequence: mount(null) → resolve
  // → back-nav(null). Also carries the single-write-on-open lock (improvement-
  // map-open-double-writes): the real setRuntimeObject issues its own POST
  // when its equality guard sees a change, so a non-skipSync mirror would
  // re-introduce a same-tick IDENTICAL pair — every mirror call below must
  // carry skipSync=true, making the guard-free stamp the ONLY server writer
  // (one POST per key per transition, while still surviving an admin wipe).
  it('null map names never write: mount(null) → resolve → back-nav emits exactly one __map__ write per lane', () => {
    const { rerender } = render(
      <MapContextSync campaignName="test-campaign" activeMapName={null} />,
    );
    // Fresh tab: the server value wins — the map lane is entirely silent
    // (no POST, no local mirror) while the campaign side still syncs.
    expect(stampsFor(fetchMock, '__map__')).toHaveLength(0);
    expect(setRuntimeObject.mock.calls.filter(([k]) => k === '__map__')).toHaveLength(0);
    expect(stampsFor(fetchMock, '__campaign__')).toHaveLength(1);

    rerender(<MapContextSync campaignName="test-campaign" activeMapName="battle-arena.json" />);
    rerender(<MapContextSync campaignName="test-campaign" activeMapName={null} />);

    // Ordered full server-write census across the whole sequence: exactly one
    // '__campaign__' + one '__map__' POST; the back-nav null adds nothing.
    expect(stampRequests(fetchMock)).toEqual([
      { key: '__campaign__', method: 'POST', value: { campaignName: 'test-campaign' } },
      { key: '__map__', method: 'POST', value: { activeMapName: 'battle-arena' } },
    ]);
    // Full store-mirror census: campaign mirrors on every effect run, the map
    // mirrors exactly once (null→map transition only), all skipSync=true.
    expect(setRuntimeObject.mock.calls).toEqual([
      mirror('__campaign__', { campaignName: 'test-campaign' }),
      mirror('__campaign__', { campaignName: 'test-campaign' }),
      mirror('__map__', { activeMapName: 'battle-arena' }),
      mirror('__campaign__', { campaignName: 'test-campaign' }),
    ]);
  });

  it('normalizes map names on both lanes: strips a trailing .json, leaves suffix-free names unchanged', () => {
    render(<MapContextSync campaignName="test-campaign" activeMapName="battle-arena.json" />);

    expect(stampsFor(fetchMock, '__map__')).toEqual([
      { key: '__map__', method: 'POST', value: { activeMapName: 'battle-arena' } },
    ]);
    expect(setRuntimeObject.mock.calls.filter(([k]) => k === '__map__')).toEqual([
      mirror('__map__', { activeMapName: 'battle-arena' }),
    ]);

    // Second mount, suffix-free name: cache-suppressed campaign lane means the
    // post-clear census isolates the map writes for 'wilds'.
    fetchMock.mockClear();
    setRuntimeObject.mockClear();
    render(<MapContextSync campaignName="test-campaign" activeMapName="wilds" />);

    expect(stampRequests(fetchMock)).toEqual([
      { key: '__map__', method: 'POST', value: { activeMapName: 'wilds' } },
    ]);
    expect(setRuntimeObject.mock.calls.filter(([k]) => k === '__map__')).toEqual([
      mirror('__map__', { activeMapName: 'wilds' }),
    ]);
  });

  it('writes nothing when no campaign is selected', () => {
    render(<MapContextSync campaignName="" activeMapName="battle-arena.json" />);

    expect(setRuntimeObject).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('survives a failed stamp without rejecting or crashing the render', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error('network down'));

    const { container } = render(
      <MapContextSync campaignName="test-campaign" activeMapName="battle-arena.json" />,
    );
    await vi.waitFor(() => {
      // Each failed key logs its own error (exact source prefix; a failed
      // campaign stamp also self-heals the dedupe cache — pinned by the
      // dedupe lane, not restated here).
      expect(consoleError).toHaveBeenCalledWith(
        '[MapContextSync] Failed to stamp __campaign__:', expect.any(Error),
      );
      expect(consoleError).toHaveBeenCalledWith(
        '[MapContextSync] Failed to stamp __map__:', expect.any(Error),
      );
    });
    expect(container).toBeEmptyDOMElement(); // the render itself completed

    consoleError.mockRestore();
  });
});
