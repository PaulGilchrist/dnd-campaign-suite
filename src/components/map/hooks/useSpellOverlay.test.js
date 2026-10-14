import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useSpellOverlay from './useSpellOverlay.js';

describe('useSpellOverlay', () => {
  const campaignName = 'test-campaign';
  const mapName = 'test-map';

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const getHook = (campaign = campaignName, map = mapName) => {
    const { result, unmount } = renderHook(() => useSpellOverlay(campaign, map));
    return { result, unmount };
  };

  describe('initialization', () => {
    it('should initialize with empty overlays', () => {
      const { result } = getHook();
      expect(result.current.overlays).toEqual([]);
    });

    it('should fetch existing overlays from server on mount', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ overlays: [{ id: 's1', name: 'Saved', radius: 10 }] }),
      });
      getHook();
      await act(async () => {});
      expect(fetchSpy).toHaveBeenCalledWith(
        '/spell-overlay?campaign=test-campaign',
      );
      fetchSpy.mockRestore();
    });

    it('should merge server overlays with existing local overlays by id', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            overlays: [
              { id: 's1', name: 'Server', radius: 10 },
              { id: 's2', name: 'Server2', radius: 15 },
            ],
          }),
      });
      const { result } = getHook();
      await act(async () => {
        result.current.addOverlay({ id: 's1', name: 'Local', radius: 20 });
      });
      await act(async () => {});
      expect(result.current.overlays).toEqual([
        { id: 's1', name: 'Local', radius: 20 },
        { id: 's2', name: 'Server2', radius: 15 },
      ]);
      fetchSpy.mockRestore();
    });

    it('should ignore server fetch on response error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false });
      const { result } = getHook();
      await act(async () => {});
      expect(result.current.overlays).toEqual([]);
    });

    it('should ignore server fetch on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network fail'));
      const { result } = getHook();
      await act(async () => {});
      expect(result.current.overlays).toEqual([]);
    });
  });

  describe('overlay CRUD', () => {
    it('should add an overlay', () => {
      const { result } = getHook();
      const overlay = { id: 'o1', name: 'Fireball', radius: 20 };
      act(() => {
        result.current.addOverlay(overlay);
      });
      expect(result.current.overlays).toEqual([overlay]);
    });

    it('should update an overlay', () => {
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      const updated = { id: 'o1', name: 'Fireball', radius: 30 };
      act(() => {
        result.current.updateOverlay(updated);
      });
      expect(result.current.overlays).toEqual([updated]);
    });

    it('should update a non-existent overlay id silently', () => {
      const { result } = getHook();
      act(() => {
        result.current.updateOverlay({ id: 'nonexistent', name: 'Ghost', radius: 5 });
      });
      expect(result.current.overlays).toEqual([]);
    });

    it('should remove an overlay by id', () => {
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
        result.current.addOverlay({ id: 'o2', name: 'Cone', angle: 60 });
      });
      act(() => {
        result.current.removeOverlay('o1');
      });
      expect(result.current.overlays).toEqual([{ id: 'o2', name: 'Cone', angle: 60 }]);
    });

    it('should handle removing a non-existent overlay id silently', () => {
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      act(() => {
        result.current.removeOverlay('nonexistent');
      });
      expect(result.current.overlays).toEqual([{ id: 'o1', name: 'Fireball', radius: 20 }]);
    });

    it('should clear all overlays', () => {
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
        result.current.addOverlay({ id: 'o2', name: 'Cone', angle: 60 });
      });
      act(() => {
        result.current.clearOverlays();
      });
      expect(result.current.overlays).toEqual([]);
    });

    it('should handle clearing when already empty', () => {
      const { result } = getHook();
      act(() => {
        result.current.clearOverlays();
      });
      expect(result.current.overlays).toEqual([]);
    });
  });

  describe('API calls', () => {
    it('should POST add action when adding an overlay', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
      const { result } = getHook();
      fetchSpy.mockClear();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, callArgs] = fetchSpy.mock.calls[0];
      expect(callArgs.method).toBe('POST');
      expect(JSON.parse(callArgs.body)).toEqual({
        action: 'add',
        overlays: [{ id: 'o1', name: 'Fireball', radius: 20 }],
      });
      fetchSpy.mockRestore();
    });

    it('should POST remove action when removing an overlay', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      fetchSpy.mockClear();
      act(() => {
        result.current.removeOverlay('o1');
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, callArgs] = fetchSpy.mock.calls[0];
      expect(JSON.parse(callArgs.body)).toEqual({
        action: 'remove',
        overlayId: 'o1',
      });
      fetchSpy.mockRestore();
    });

    it('should POST clear action when clearing overlays', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      fetchSpy.mockClear();
      act(() => {
        result.current.clearOverlays();
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, callArgs] = fetchSpy.mock.calls[0];
      expect(JSON.parse(callArgs.body)).toEqual({
        action: 'clear',
      });
      fetchSpy.mockRestore();
    });

    it('should log error when API call fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('API fail'));
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      await Promise.resolve();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Spell overlay API error:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
      globalThis.fetch = originalFetch;
    });
  });

  describe('debounced updates', () => {
    it('should debounce updateOverlay API calls', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      fetchSpy.mockClear();
      const updated = { id: 'o1', name: 'Fireball', radius: 30 };
      act(() => {
        result.current.updateOverlay(updated);
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, callArgs] = fetchSpy.mock.calls[0];
      expect(JSON.parse(callArgs.body)).toEqual({
        action: 'update',
        overlays: [updated],
      });
      fetchSpy.mockRestore();
    });

    it('should debounce multiple rapid updates by sending only the latest', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      fetchSpy.mockClear();
      act(() => {
        result.current.updateOverlay({ id: 'o1', name: 'Fireball', radius: 30 });
        result.current.updateOverlay({ id: 'o1', name: 'Fireball', radius: 40 });
        result.current.updateOverlay({ id: 'o1', name: 'Fireball', radius: 50 });
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, callArgs] = fetchSpy.mock.calls[0];
      expect(JSON.parse(callArgs.body)).toEqual({
        action: 'update',
        overlays: [{ id: 'o1', name: 'Fireball', radius: 50 }],
      });
      fetchSpy.mockRestore();
    });

    it('should clear pending debounce when updateOverlayImmediate is called', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      fetchSpy.mockClear();
      const updated = { id: 'o1', name: 'Fireball', radius: 30 };
      act(() => {
        result.current.updateOverlay(updated);
      });
      act(() => {
        result.current.updateOverlayImmediate({ ...updated, radius: 40 });
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, callArgs] = fetchSpy.mock.calls[0];
      expect(JSON.parse(callArgs.body)).toEqual({
        action: 'update',
        overlays: [{ id: 'o1', name: 'Fireball', radius: 40 }],
      });
      // Advance past the original debounce time to ensure no extra call fires
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      fetchSpy.mockRestore();
    });

    it('should call updateOverlayImmediate immediately without debounce', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      fetchSpy.mockClear();
      act(() => {
        result.current.updateOverlayImmediate({ id: 'o1', name: 'Fireball', radius: 99 });
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, callArgs] = fetchSpy.mock.calls[0];
      expect(JSON.parse(callArgs.body)).toEqual({
        action: 'update',
        overlays: [{ id: 'o1', name: 'Fireball', radius: 99 }],
      });
      fetchSpy.mockRestore();
    });
  });

  describe('SSE events', () => {
    it('should add unique overlays from SSE add event', () => {
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      const newOverlay = { id: 'o2', name: 'Cone', angle: 60 };
      act(() => {
        result.current.handleSSEEvent({
          key: 'spell-overlay-test-campaign',
          data: { action: 'add', overlays: [newOverlay] },
        });
      });
      expect(result.current.overlays).toEqual([
        { id: 'o1', name: 'Fireball', radius: 20 },
        { id: 'o2', name: 'Cone', angle: 60 },
      ]);
    });

    it('should deduplicate SSE add event for existing overlay id', () => {
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      const existingOverlay = { id: 'o1', name: 'Fireball Updated', radius: 30 };
      act(() => {
        result.current.handleSSEEvent({
          key: 'spell-overlay-test-campaign',
          data: { action: 'add', overlays: [existingOverlay] },
        });
      });
      expect(result.current.overlays).toEqual([
        { id: 'o1', name: 'Fireball', radius: 20 },
      ]);
    });

    it('should handle SSE update event', () => {
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
        result.current.addOverlay({ id: 'o2', name: 'Cone', angle: 60 });
      });
      const updatedOverlay = { id: 'o1', name: 'Fireball Updated', radius: 30 };
      act(() => {
        result.current.handleSSEEvent({
          key: 'spell-overlay-test-campaign',
          data: { action: 'update', overlays: [updatedOverlay] },
        });
      });
      expect(result.current.overlays).toEqual([
        { id: 'o1', name: 'Fireball Updated', radius: 30 },
        { id: 'o2', name: 'Cone', angle: 60 },
      ]);
    });

    it('should handle SSE update with non-existent overlay id silently', () => {
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      act(() => {
        result.current.handleSSEEvent({
          key: 'spell-overlay-test-campaign',
          data: { action: 'update', overlays: [{ id: 'ghost', name: 'Phantom' }] },
        });
      });
      expect(result.current.overlays).toEqual([
        { id: 'o1', name: 'Fireball', radius: 20 },
      ]);
    });

    it('should handle SSE remove event', () => {
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
        result.current.addOverlay({ id: 'o2', name: 'Cone', angle: 60 });
      });
      act(() => {
        result.current.handleSSEEvent({
          key: 'spell-overlay-test-campaign',
          data: { action: 'remove', overlayId: 'o1' },
        });
      });
      expect(result.current.overlays).toEqual([{ id: 'o2', name: 'Cone', angle: 60 }]);
    });

    it('should handle SSE remove with non-existent overlay id silently', () => {
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      act(() => {
        result.current.handleSSEEvent({
          key: 'spell-overlay-test-campaign',
          data: { action: 'remove', overlayId: 'ghost' },
        });
      });
      expect(result.current.overlays).toEqual([
        { id: 'o1', name: 'Fireball', radius: 20 },
      ]);
    });

    it('should handle SSE clear event', () => {
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
        result.current.addOverlay({ id: 'o2', name: 'Cone', angle: 60 });
      });
      act(() => {
        result.current.handleSSEEvent({
          key: 'spell-overlay-test-campaign',
          data: { action: 'clear' },
        });
      });
      expect(result.current.overlays).toEqual([]);
    });

    it('should ignore SSE events with wrong key prefix', () => {
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      act(() => {
        result.current.handleSSEEvent({
          key: 'other-event',
          data: { action: 'clear' },
        });
      });
      expect(result.current.overlays).toEqual([{ id: 'o1', name: 'Fireball', radius: 20 }]);
    });

    it('should ignore SSE events for wrong campaign', () => {
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      act(() => {
        result.current.handleSSEEvent({
          key: 'spell-overlay-different-campaign',
          data: { action: 'clear' },
        });
      });
      expect(result.current.overlays).toEqual([{ id: 'o1', name: 'Fireball', radius: 20 }]);
    });

    it('should ignore null event', () => {
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      act(() => {
        result.current.handleSSEEvent(null);
      });
      expect(result.current.overlays).toEqual([
        { id: 'o1', name: 'Fireball', radius: 20 },
      ]);
    });

    it('should ignore event without key', () => {
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      act(() => {
        result.current.handleSSEEvent({ data: { action: 'clear' } });
      });
      expect(result.current.overlays).toEqual([
        { id: 'o1', name: 'Fireball', radius: 20 },
      ]);
    });

    it('should ignore SSE event with no data', () => {
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      act(() => {
        result.current.handleSSEEvent({
          key: 'spell-overlay-test-campaign',
        });
      });
      expect(result.current.overlays).toEqual([
        { id: 'o1', name: 'Fireball', radius: 20 },
      ]);
    });

    it('should ignore SSE event with unknown action', () => {
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      act(() => {
        result.current.handleSSEEvent({
          key: 'spell-overlay-test-campaign',
          data: { action: 'unknown' },
        });
      });
      expect(result.current.overlays).toEqual([
        { id: 'o1', name: 'Fireball', radius: 20 },
      ]);
    });

    it('should ignore SSE add event with empty overlays array', () => {
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      act(() => {
        result.current.handleSSEEvent({
          key: 'spell-overlay-test-campaign',
          data: { action: 'add', overlays: [] },
        });
      });
      expect(result.current.overlays).toEqual([
        { id: 'o1', name: 'Fireball', radius: 20 },
      ]);
    });

    it('should ignore SSE update event with empty overlays array', () => {
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      act(() => {
        result.current.handleSSEEvent({
          key: 'spell-overlay-test-campaign',
          data: { action: 'update', overlays: [] },
        });
      });
      expect(result.current.overlays).toEqual([
        { id: 'o1', name: 'Fireball', radius: 20 },
      ]);
    });

    it('should ignore SSE remove event with no overlayId', () => {
      const { result } = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      act(() => {
        result.current.handleSSEEvent({
          key: 'spell-overlay-test-campaign',
          data: { action: 'remove' },
        });
      });
      expect(result.current.overlays).toEqual([
        { id: 'o1', name: 'Fireball', radius: 20 },
      ]);
    });
  });

  describe('returned state', () => {
    it('should return pendingOverlay and setPendingOverlay', () => {
      const { result } = getHook();
      expect(result.current.pendingOverlay).toBeNull();
      expect(typeof result.current.setPendingOverlay).toBe('function');
    });
  });
});
