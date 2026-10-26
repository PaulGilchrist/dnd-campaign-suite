// @maintained-by-ai
/**
 * Regression lock for improvement-2026-10-26-C: the '__campaign__' force-stamp
 * re-ran on every activeMapName dep change (campaign-select stamp + map-open
 * re-stamp = two value-identical POSTs per session). The stamp is now gated on
 * the value ACTUALLY changing, via a module-level last-stamped cache mirroring
 * the __map__ transition gate. Locks: identical value ⇒ second POST suppressed;
 * changed campaign ⇒ re-stamp; __map__ lane unchanged (one POST per null→map
 * transition, re-opens included); fresh module cache (SPA re-init) ⇒ re-stamp;
 * a failed stamp does not poison the cache.
 */
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MapContextSync, { _resetForTests } from './MapContextSync.jsx';
import { setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeObject: vi.fn(),
}));

function stampRequests(fetchMock) {
  return fetchMock.mock.calls.map(([url, init]) => ({
    key: decodeURIComponent(url.split('/').pop()),
    campaign: decodeURIComponent(url.split('/').slice(-2)[0]),
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

describe('MapContextSync — __campaign__ value-unchanged dedupe', () => {
  let fetchMock;

  beforeEach(() => {
    _resetForTests(); // simulate fresh module load per test
    setRuntimeObject.mockClear();
    fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
  });

  it('map-open dep-change with an UNCHANGED campaign posts no second __campaign__', () => {
    const { rerender } = render(
      <MapContextSync campaignName="test-campaign" activeMapName={null} />,
    );
    expect(stampsFor(fetchMock, '__campaign__')).toHaveLength(1);

    rerender(<MapContextSync campaignName="test-campaign" activeMapName="battle-arena.json" />);

    // select + open = ONE value-identical POST (was two)
    expect(stampsFor(fetchMock, '__campaign__')).toHaveLength(1);
    // __map__ lane unregressed: exactly one map POST on the null→map transition
    const mapStamps = stampsFor(fetchMock, '__map__');
    expect(mapStamps).toHaveLength(1);
    expect(mapStamps[0].value).toEqual({ activeMapName: 'battle-arena' });
  });

  it('campaign switch (value actually changes) re-stamps __campaign__', () => {
    const { rerender } = render(
      <MapContextSync campaignName="test-campaign" activeMapName={null} />,
    );
    rerender(<MapContextSync campaignName="other-campaign" activeMapName="battle-arena.json" />);

    const campaignStamps = stampsFor(fetchMock, '__campaign__');
    expect(campaignStamps).toHaveLength(2);
    expect(campaignStamps[0]).toMatchObject({
      campaign: 'test-campaign', value: { campaignName: 'test-campaign' },
    });
    expect(campaignStamps[1]).toMatchObject({
      campaign: 'other-campaign', value: { campaignName: 'other-campaign' },
    });
  });

  it('__map__ transition gate intact: re-open after back-nav re-stamps, __campaign__ stays single', () => {
    const { rerender } = render(
      <MapContextSync campaignName="test-campaign" activeMapName={null} />,
    );
    rerender(<MapContextSync campaignName="test-campaign" activeMapName="battle-arena.json" />);
    rerender(<MapContextSync campaignName="test-campaign" activeMapName={null} />); // back-nav
    rerender(<MapContextSync campaignName="test-campaign" activeMapName="battle-arena.json" />); // re-open

    // one __map__ POST per null→map transition (dedupe is campaign-lane only)
    expect(stampsFor(fetchMock, '__map__')).toHaveLength(2);
    expect(stampsFor(fetchMock, '__campaign__')).toHaveLength(1);
  });

  it('fresh module cache (SPA re-init) stamps again for the same campaign', () => {
    const { unmount } = render(
      <MapContextSync campaignName="test-campaign" activeMapName={null} />,
    );
    unmount();
    _resetForTests(); // module reload = empty cache
    render(<MapContextSync campaignName="test-campaign" activeMapName={null} />);

    expect(stampsFor(fetchMock, '__campaign__')).toHaveLength(2);
  });

  it('local __campaign__ mirror (skipSync) still runs on every transition when the POST is suppressed', () => {
    const { rerender } = render(
      <MapContextSync campaignName="test-campaign" activeMapName={null} />,
    );
    rerender(<MapContextSync campaignName="test-campaign" activeMapName="battle-arena.json" />);

    expect(storeCallsFor('__campaign__')).toEqual([
      ['__campaign__', { campaignName: 'test-campaign' }, 'test-campaign', true],
      ['__campaign__', { campaignName: 'test-campaign' }, 'test-campaign', true],
    ]);
  });

  it('a failed __campaign__ stamp clears the cache so the next transition retries', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error('network down'));

    const { rerender } = render(
      <MapContextSync campaignName="test-campaign" activeMapName={null} />,
    );
    expect(stampsFor(fetchMock, '__campaign__')).toHaveLength(1);
    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('[MapContextSync]'), expect.any(Error),
      );
    });

    fetchMock.mockClear();
    fetchMock.mockResolvedValue({ ok: true });
    rerender(<MapContextSync campaignName="test-campaign" activeMapName="battle-arena.json" />);

    // retry fired (cache was not poisoned by the failure)
    expect(stampsFor(fetchMock, '__campaign__')).toHaveLength(1);
    consoleError.mockRestore();
  });
});
