// @improved-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useSpellOverlay from './useSpellOverlay.js';

describe('useSpellOverlay', () => {
  const campaignName = 'test-campaign';
  const mapName = 'test-map';

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  const getHook = (campaign = campaignName, map = mapName) => {
    const { result } = renderHook(() => useSpellOverlay(campaign, map));
    return result;
  };

  describe('initialization', () => {
    it('should initialize with empty overlays', () => {
      const result = getHook();
      expect(result.current.overlays).toEqual([]);
    });

    it('should return pendingOverlay as null by default', () => {
      const result = getHook();
      expect(result.current.pendingOverlay).toBeNull();
    });

    it('should return setPendingOverlay setter', () => {
      const result = getHook();
      expect(result.current.setPendingOverlay).toBeInstanceOf(Function);
    });
  });

  describe('overlay CRUD', () => {
    it('should add an overlay', () => {
      const result = getHook();
      const overlay = { id: 'o1', name: 'Fireball', radius: 20 };
      act(() => {
        result.current.addOverlay(overlay);
      });
      expect(result.current.overlays).toEqual([overlay]);
    });

    it('should update an overlay', () => {
      const result = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      const updated = { id: 'o1', name: 'Fireball', radius: 30 };
      act(() => {
        result.current.updateOverlay(updated);
      });
      expect(result.current.overlays).toEqual([updated]);
    });

    it('should remove an overlay by id', () => {
      const result = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
        result.current.addOverlay({ id: 'o2', name: 'Cone', angle: 60 });
      });
      act(() => {
        result.current.removeOverlay('o1');
      });
      expect(result.current.overlays).toEqual([{ id: 'o2', name: 'Cone', angle: 60 }]);
    });

    it('should clear all overlays', () => {
      const result = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
        result.current.addOverlay({ id: 'o2', name: 'Cone', angle: 60 });
      });
      act(() => {
        result.current.clearOverlays();
      });
      expect(result.current.overlays).toEqual([]);
    });
  });

  describe('API calls', () => {
    it('should call addOverlay sendAction with correct payload', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
      const result = getHook();
      const overlay = { id: 'o1', name: 'Fireball', radius: 20 };
      act(() => {
        result.current.addOverlay(overlay);
      });
      expect(fetchSpy).toHaveBeenCalledWith('/spell-overlay?campaign=test-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', overlays: [overlay] }),
      });
      fetchSpy.mockRestore();
    });

    it('should call removeOverlay sendAction with correct payload', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
      const result = getHook();
      act(() => {
        result.current.removeOverlay('o1');
      });
      expect(fetchSpy).toHaveBeenCalledWith('/spell-overlay?campaign=test-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', overlayId: 'o1' }),
      });
      fetchSpy.mockRestore();
    });

    it('should clear overlays and call API with clear action', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
      const result = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      act(() => {
        result.current.clearOverlays();
      });
      expect(fetchSpy).toHaveBeenCalledWith('/spell-overlay?campaign=test-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' }),
      });
      fetchSpy.mockRestore();
    });

    it('should debounce updateOverlay API calls', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
      const result = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
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
      fetchSpy.mockRestore();
    });

    it('should not call API on updateOverlay if debounce timer is still pending', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
      const result = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      fetchSpy.mockClear();
      const updated = { id: 'o1', name: 'Fireball', radius: 30 };
      act(() => {
        result.current.updateOverlay(updated);
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('should call updateOverlayImmediate without debounce', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
      const result = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      const updated = { id: 'o1', name: 'Fireball', radius: 30 };
      act(() => {
        result.current.updateOverlayImmediate(updated);
      });
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      fetchSpy.mockRestore();
    });

    it('should clear pendingRef when updateOverlayImmediate is called', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
      const result = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      const updated = { id: 'o1', name: 'Fireball', radius: 30 };
      act(() => {
        result.current.updateOverlay(updated);
      });
      act(() => {
        result.current.updateOverlayImmediate({ ...updated, radius: 40 });
      });
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      fetchSpy.mockRestore();
    });
  });

  describe('SSE events', () => {
    it('should handle SSE add event with unique overlays', () => {
      const result = getHook();
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
      const result = getHook();
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

    it('should handle SSE add with multiple new overlays', () => {
      const result = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
      });
      const newOverlays = [
        { id: 'o2', name: 'Cone', angle: 60 },
        { id: 'o3', name: 'Line', length: 30 },
      ];
      act(() => {
        result.current.handleSSEEvent({
          key: 'spell-overlay-test-campaign',
          data: { action: 'add', overlays: newOverlays },
        });
      });
      expect(result.current.overlays).toEqual([
        { id: 'o1', name: 'Fireball', radius: 20 },
        { id: 'o2', name: 'Cone', angle: 60 },
        { id: 'o3', name: 'Line', length: 30 },
      ]);
    });

    it('should handle SSE update event', () => {
      const result = getHook();
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

    it('should handle SSE update with multiple overlays', () => {
      const result = getHook();
      act(() => {
        result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
        result.current.addOverlay({ id: 'o2', name: 'Cone', angle: 60 });
      });
      const updatedOverlays = [
        { id: 'o1', name: 'Fireball Updated', radius: 30 },
        { id: 'o2', name: 'Cone Updated', angle: 90 },
      ];
      act(() => {
        result.current.handleSSEEvent({
          key: 'spell-overlay-test-campaign',
          data: { action: 'update', overlays: updatedOverlays },
        });
      });
      expect(result.current.overlays).toEqual([
        { id: 'o1', name: 'Fireball Updated', radius: 30 },
        { id: 'o2', name: 'Cone Updated', angle: 90 },
      ]);
    });

    it('should handle SSE remove event', () => {
      const result = getHook();
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

    it('should handle SSE clear event', () => {
      const result = getHook();
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
      const result = getHook();
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
      const result = getHook();
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

    it('should ignore SSE events with no key', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent({ data: { action: 'clear' } });
      });
      expect(result.current.overlays).toEqual([]);
    });

    it('should ignore SSE events with no data', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent({ key: 'spell-overlay-test-campaign' });
      });
      expect(result.current.overlays).toEqual([]);
    });
  });

  describe('campaign name from ref', () => {
    it('should use campaignName from ref for SSE event matching', () => {
      const { result } = renderHook(
        ({ campaign, map }) => useSpellOverlay(campaign, map),
        { initialProps: { campaign: 'campaign-a', map: 'map-a' } }
      );
      expect(result.current.overlays).toEqual([]);
      act(() => {
        result.current.handleSSEEvent({
          key: 'spell-overlay-campaign-a',
          data: { action: 'clear' },
        });
      });
      expect(result.current.overlays).toEqual([]);
    });
  });
});
