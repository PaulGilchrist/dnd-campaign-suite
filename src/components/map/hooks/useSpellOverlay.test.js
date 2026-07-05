// @cleaned-by-ai
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

  describe('debounced updates', () => {
    it('should debounce updateOverlay API calls', () => {
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
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      fetchSpy.mockRestore();
    });

    it('should clear pending debounce when updateOverlayImmediate is called', () => {
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
      act(() => {
        result.current.updateOverlayImmediate({ ...updated, radius: 40 });
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      fetchSpy.mockRestore();
    });
  });

  describe('SSE events', () => {
    it('should add unique overlays from SSE add event', () => {
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
  });
});
