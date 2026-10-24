// @maintained-by-ai
/**
 * Regression lock for bug-player-clients-clobber-fog-reset (the '__map__'
 * co-writer lane): a read-only (network) client must NEVER POST '__map__' —
 * the server owns that key via the activate route and every client mirrors it
 * through SSE. Read-only clients now populate their LOCAL runtime store with
 * skipSync=true so grid distances still work, but issue zero server writes.
 * GM (localhost) behaviour is byte-unchanged (see MapContextSync.null-stamp).
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

  it('POSTs __map__ on localhost (GM) — the gate is role-scoped', () => {
    render(
      <MapContextSync campaignName="test-campaign" activeMapName="test-map.json" isLocalhost={true} />,
    );

    const mapStamps = stampsFor(fetchMock, '__map__');
    expect(mapStamps).toHaveLength(1);
    expect(mapStamps[0]).toEqual({ method: 'POST', key: '__map__', value: { activeMapName: 'test-map' } });
    // GM mirror is NOT skipSync (server-write path)
    expect(storeCallsFor('__map__')).toEqual([
      ['__map__', { activeMapName: 'test-map' }, 'test-campaign'],
    ]);
  });
});
