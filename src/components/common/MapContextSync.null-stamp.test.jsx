import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MapContextSync from './MapContextSync.jsx';
import { setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeObject: vi.fn(),
}));

function stampedKeys() {
  return setRuntimeObject.mock.calls.map(([key]) => key);
}

describe('MapContextSync null-stamp guard', () => {
  let fetchMock;

  beforeEach(() => {
    setRuntimeObject.mockClear();
    fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
  });

  it('never stamps __map__ null on mount (campaign selected, map not yet loaded)', () => {
    render(<MapContextSync campaignName="test-campaign" activeMapName={null} />);

    expect(stampedKeys()).not.toContain('__map__');
    const posted = fetchMock.mock.calls.map(([url]) => url);
    expect(posted.some(u => u.endsWith('/__map__'))).toBe(false);
    expect(posted.some(u => u.endsWith('/__campaign__'))).toBe(true);
  });

  it('stamps the real active map name once it resolves', () => {
    render(<MapContextSync campaignName="test-campaign" activeMapName="battle-arena.json" />);

    expect(setRuntimeObject).toHaveBeenCalledWith('__map__', { activeMapName: 'battle-arena' }, 'test-campaign');
    const posted = fetchMock.mock.calls.find(([url]) => url.endsWith('/__map__'));
    expect(JSON.parse(posted[1].body)).toEqual({ value: { activeMapName: 'battle-arena' } });
  });
});
