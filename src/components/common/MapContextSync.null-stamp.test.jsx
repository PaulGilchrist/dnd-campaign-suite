// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MapContextSync from './MapContextSync.jsx';
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

function storeCallsFor(key) {
  return setRuntimeObject.mock.calls.filter(([storeKey]) => storeKey === key);
}

describe('MapContextSync', () => {
  let fetchMock;

  beforeEach(() => {
    setRuntimeObject.mockClear();
    fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
  });

  it('mirrors the campaign name into the runtime store and force-posts it to the server', () => {
    render(<MapContextSync campaignName="test-campaign" activeMapName={null} />);

    expect(setRuntimeObject).toHaveBeenCalledWith(
      '__campaign__', { campaignName: 'test-campaign' }, 'test-campaign',
    );
    const campaignStamps = stampsFor(fetchMock, '__campaign__');
    expect(campaignStamps).toHaveLength(1);
    expect(campaignStamps[0]).toEqual({
      method: 'POST',
      key: '__campaign__',
      value: { campaignName: 'test-campaign' },
    });
  });

  it('never stamps __map__ null before the active map resolves (server value wins)', () => {
    render(<MapContextSync campaignName="test-campaign" activeMapName={null} />);

    expect(stampsFor(fetchMock, '__map__')).toHaveLength(0);
    expect(storeCallsFor('__map__')).toHaveLength(0);
    // the campaign side of the sync must still happen
    expect(stampsFor(fetchMock, '__campaign__')).toHaveLength(1);
  });

  it('stamps the active map with its .json suffix stripped, to store and server', () => {
    render(<MapContextSync campaignName="test-campaign" activeMapName="battle-arena.json" />);

    expect(setRuntimeObject).toHaveBeenCalledWith(
      '__map__', { activeMapName: 'battle-arena' }, 'test-campaign',
    );
    const mapStamps = stampsFor(fetchMock, '__map__');
    expect(mapStamps).toHaveLength(1);
    expect(mapStamps[0]).toEqual({
      method: 'POST',
      key: '__map__',
      value: { activeMapName: 'battle-arena' },
    });
  });

  it('leaves map names without a .json suffix unchanged', () => {
    render(<MapContextSync campaignName="test-campaign" activeMapName="wilds" />);

    expect(setRuntimeObject).toHaveBeenCalledWith(
      '__map__', { activeMapName: 'wilds' }, 'test-campaign',
    );
    expect(stampsFor(fetchMock, '__map__')[0].value).toEqual({ activeMapName: 'wilds' });
  });

  it('stamps the map only after a mount-then-resolve transition, not before', () => {
    const { rerender } = render(
      <MapContextSync campaignName="test-campaign" activeMapName={null} />,
    );
    expect(stampsFor(fetchMock, '__map__')).toHaveLength(0);

    rerender(<MapContextSync campaignName="test-campaign" activeMapName="new-arena.json" />);

    expect(stampsFor(fetchMock, '__map__')).toHaveLength(1);
    expect(stampsFor(fetchMock, '__map__')[0].value).toEqual({ activeMapName: 'new-arena' });
    expect(storeCallsFor('__map__')).toEqual([
      ['__map__', { activeMapName: 'new-arena' }, 'test-campaign'],
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

    render(<MapContextSync campaignName="test-campaign" activeMapName="battle-arena.json" />);
    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('[MapContextSync]'), expect.any(Error),
      );
    });

    consoleError.mockRestore();
  });
});
