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

  const getHook = (campaign = campaignName, map = mapName, initialOverlays = []) => {
    const storageKey = `spellOverlays-${campaign}-${map}`;
    if (initialOverlays.length) {
      localStorage.setItem(storageKey, JSON.stringify(initialOverlays));
    }
    const { result } = renderHook(() => useSpellOverlay(campaign, map));
    return result;
  };

  it('should initialize with empty overlays when no localStorage data', () => {
    const result = getHook();
    expect(result.current.overlays).toEqual([]);
  });

  it('should initialize from localStorage when data exists', () => {
    const initial = [
      { id: 'overlay1', name: 'Fireball', radius: 20 },
      { id: 'overlay2', name: 'Cone', angle: 60 },
    ];
    const result = getHook(campaignName, mapName, initial);
    expect(result.current.overlays).toEqual(initial);
  });

  it('should initialize with empty array on corrupted localStorage data', () => {
    const storageKey = `spellOverlays-${campaignName}-${mapName}`;
    localStorage.setItem(storageKey, 'not-valid-json');
    const result = getHook();
    expect(result.current.overlays).toEqual([]);
  });

  it('should persist overlays to localStorage on change', () => {
    const result = getHook();
    act(() => {
      result.current.addOverlay({ id: 'o1', name: 'Fireball', radius: 20 });
    });
    const storageKey = `spellOverlays-${campaignName}-${mapName}`;
    const stored = JSON.parse(localStorage.getItem(storageKey));
    expect(stored).toEqual([{ id: 'o1', name: 'Fireball', radius: 20 }]);
  });

  it('should add an overlay', () => {
    const result = getHook();
    const overlay = { id: 'o1', name: 'Fireball', radius: 20 };
    act(() => {
      result.current.addOverlay(overlay);
    });
    expect(result.current.overlays).toEqual([overlay]);
  });

  it('should update an overlay', () => {
    const initial = [{ id: 'o1', name: 'Fireball', radius: 20 }];
    const result = getHook(campaignName, mapName, initial);
    const updated = { id: 'o1', name: 'Fireball', radius: 30 };
    act(() => {
      result.current.updateOverlay(updated);
    });
    expect(result.current.overlays).toEqual([updated]);
  });

  it('should debounce updateOverlay API calls', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
    const initial = [{ id: 'o1', name: 'Fireball', radius: 20 }];
    const result = getHook(campaignName, mapName, initial);
    const updated = { id: 'o1', name: 'Fireball', radius: 30 };
    act(() => {
      result.current.updateOverlay(updated);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('/spell-overlay?campaign=test-campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', overlays: [updated] }),
    });
    fetchSpy.mockRestore();
  });

  it('should call updateOverlayImmediate without debounce', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
    const initial = [{ id: 'o1', name: 'Fireball', radius: 20 }];
    const result = getHook(campaignName, mapName, initial);
    const updated = { id: 'o1', name: 'Fireball', radius: 30 };
    act(() => {
      result.current.updateOverlayImmediate(updated);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('/spell-overlay?campaign=test-campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', overlays: [updated] }),
    });
    fetchSpy.mockRestore();
  });

  it('should remove an overlay by id', () => {
    const initial = [
      { id: 'o1', name: 'Fireball', radius: 20 },
      { id: 'o2', name: 'Cone', angle: 60 },
    ];
    const result = getHook(campaignName, mapName, initial);
    act(() => {
      result.current.removeOverlay('o1');
    });
    expect(result.current.overlays).toEqual([{ id: 'o2', name: 'Cone', angle: 60 }]);
  });

  it('should clear all overlays', () => {
    const initial = [
      { id: 'o1', name: 'Fireball', radius: 20 },
      { id: 'o2', name: 'Cone', angle: 60 },
    ];
    const result = getHook(campaignName, mapName, initial);
    act(() => {
      result.current.clearOverlays();
    });
    expect(result.current.overlays).toEqual([]);
  });

  it('should clear overlays and call API with clear action', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
    const initial = [{ id: 'o1', name: 'Fireball', radius: 20 }];
    const result = getHook(campaignName, mapName, initial);
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

  it('should handle SSE add event with unique overlays', () => {
    const initial = [{ id: 'o1', name: 'Fireball', radius: 20 }];
    const result = getHook(campaignName, mapName, initial);
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
    const initial = [{ id: 'o1', name: 'Fireball', radius: 20 }];
    const result = getHook(campaignName, mapName, initial);
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
    const initial = [
      { id: 'o1', name: 'Fireball', radius: 20 },
      { id: 'o2', name: 'Cone', angle: 60 },
    ];
    const result = getHook(campaignName, mapName, initial);
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
    const initial = [
      { id: 'o1', name: 'Fireball', radius: 20 },
      { id: 'o2', name: 'Cone', angle: 60 },
    ];
    const result = getHook(campaignName, mapName, initial);
    act(() => {
      result.current.handleSSEEvent({
        key: 'spell-overlay-test-campaign',
        data: { action: 'remove', overlayId: 'o1' },
      });
    });
    expect(result.current.overlays).toEqual([{ id: 'o2', name: 'Cone', angle: 60 }]);
  });

  it('should handle SSE clear event', () => {
    const initial = [
      { id: 'o1', name: 'Fireball', radius: 20 },
      { id: 'o2', name: 'Cone', angle: 60 },
    ];
    const result = getHook(campaignName, mapName, initial);
    act(() => {
      result.current.handleSSEEvent({
        key: 'spell-overlay-test-campaign',
        data: { action: 'clear' },
      });
    });
    expect(result.current.overlays).toEqual([]);
  });

  it('should ignore SSE events with wrong key prefix', () => {
    const initial = [{ id: 'o1', name: 'Fireball', radius: 20 }];
    const result = getHook(campaignName, mapName, initial);
    act(() => {
      result.current.handleSSEEvent({
        key: 'other-event',
        data: { action: 'clear' },
      });
    });
    expect(result.current.overlays).toEqual([{ id: 'o1', name: 'Fireball', radius: 20 }]);
  });

  it('should ignore SSE events for wrong campaign', () => {
    const initial = [{ id: 'o1', name: 'Fireball', radius: 20 }];
    const result = getHook(campaignName, mapName, initial);
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

  it('should return pendingOverlay as null by default', () => {
    const result = getHook();
    expect(result.current.pendingOverlay).toBeNull();
  });

  it('should return setPendingOverlay setter', () => {
    const result = getHook();
    expect(typeof result.current.setPendingOverlay).toBe('function');
  });

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

  it('should handle SSE add with multiple new overlays', () => {
    const initial = [{ id: 'o1', name: 'Fireball', radius: 20 }];
    const result = getHook(campaignName, mapName, initial);
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

  it('should handle SSE update with multiple overlays', () => {
    const initial = [
      { id: 'o1', name: 'Fireball', radius: 20 },
      { id: 'o2', name: 'Cone', angle: 60 },
    ];
    const result = getHook(campaignName, mapName, initial);
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

  it('should not call API on updateOverlay if debounce timer is still pending', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
    const initial = [{ id: 'o1', name: 'Fireball', radius: 20 }];
    const result = getHook(campaignName, mapName, initial);
    const updated = { id: 'o1', name: 'Fireball', radius: 30 };
    act(() => {
      result.current.updateOverlay(updated);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('should clear pendingRef when updateOverlayImmediate is called', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
    const initial = [{ id: 'o1', name: 'Fireball', radius: 20 }];
    const result = getHook(campaignName, mapName, initial);
    const updated = { id: 'o1', name: 'Fireball', radius: 30 };
    // First call updateOverlay to set up a pending debounce
    act(() => {
      result.current.updateOverlay(updated);
    });
    // Immediately call updateOverlayImmediate to cancel it
    act(() => {
      result.current.updateOverlayImmediate({ ...updated, radius: 40 });
    });
    // The immediate call should have fired, and the pending timer should be cleared
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it('should use campaignName from ref for SSE event matching', () => {
    const initial = [{ id: 'o1', name: 'Fireball', radius: 20 }];
    const storageKey = 'spellOverlays-campaign-a-map-a';
    localStorage.setItem(storageKey, JSON.stringify(initial));
    const { result } = renderHook(
      ({ campaign, map }) => useSpellOverlay(campaign, map),
      { initialProps: { campaign: 'campaign-a', map: 'map-a' } }
    );
    // Initial state from campaign-a/map-a
    expect(result.current.overlays).toEqual([{ id: 'o1', name: 'Fireball', radius: 20 }]);
    // SSE event for campaign-a should be processed
    act(() => {
      result.current.handleSSEEvent({
        key: 'spell-overlay-campaign-a',
        data: { action: 'clear' },
      });
    });
    expect(result.current.overlays).toEqual([]);
  });
});
