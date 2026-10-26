// @maintained-by-ai
/**
 * Regression lock for bug-player-clients-clobber-fog-reset (the '__map__'
 * co-writer lane): a read-only (network) client must NEVER POST '__map__' —
 * the server owns that key via the activate route and every client mirrors it
 * through SSE. Clients populate their LOCAL runtime store with skipSync=true
 * so grid distances still work. GM (localhost) writes exactly ONE '__map__'
 * POST per sync via the guard-free force-stamp lane (see MapContextSync.null-stamp
 * + the single-writer lock in this file).
 */
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MapContextSync from './MapContextSync.jsx';
import { setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeObject: vi.fn(),
}));

function stampRequests(fetchMock) {
  return fetchMock.mock.calls.map(([url, init]) => ({
    key: decodeURIComponent(url.split('/').pop()),
    method: init?.method,
    value: JSON.parse(init?.body).value,
  }));
}

function stampsFor(fetchMock, key) {
  return stampRequests(fetchMock).filter((req) => req.key === key);
}

function storeCallsFor(key) {
  return setRuntimeObject.mock.calls.filter(([storeKey]) => storeKey === key);
}

describe('MapContextSync — read-only client (non-localhost)', () => {
  let fetchMock;

  beforeEach(() => {
    setRuntimeObject.mockClear();
    fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
  });

  it('never POSTs __map__ but still mirrors the active map LOCALLY (skipSync)', () => {
    render(
      <MapContextSync campaignName="test-campaign" activeMapName="test-map.json" isLocalhost={false} />,
    );

    expect(stampsFor(fetchMock, '__map__')).toHaveLength(0);
    // local mirror, skipSync=true ⇒ no server post, grid distances still work
    expect(storeCallsFor('__map__')).toEqual([
      ['__map__', { activeMapName: 'test-map' }, 'test-campaign', true],
    ]);
  });

  it('POSTs __map__ on localhost (GM) — exactly once via the force-stamp lane', () => {
    render(
      <MapContextSync campaignName="test-campaign" activeMapName="test-map.json" isLocalhost={true} />,
    );

    const mapStamps = stampsFor(fetchMock, '__map__');
    expect(mapStamps).toHaveLength(1);
    expect(mapStamps[0]).toEqual({ method: 'POST', key: '__map__', value: { activeMapName: 'test-map' } });
    // Single server writer (improvement-map-open-double-writes): the GM store
    // mirror is skipSync too — the force-stamp above is the ONLY __map__ POST.
    // (The real setRuntimeObject POSTs whenever its guard sees a change, so a
    // non-skipSync call here would re-introduce the same-tick identical pair.)
    expect(storeCallsFor('__map__')).toEqual([
      ['__map__', { activeMapName: 'test-map' }, 'test-campaign', true],
    ]);
  });
});
