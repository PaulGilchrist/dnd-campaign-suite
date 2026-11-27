// @maintained-by-ai 2026-11-26
// Deterministic hook-contract tests for useLog: initial load + MAX_LOG_ENTRIES
// cap, reloadLog/addEntry delegation (logService is mocked at the network
// boundary), SSE log-event handling through the REAL shared sseClient, and the
// subscription lifecycle across campaign changes/unmount. Shared-client
// mechanics (one connection per campaign, fan-out, close-on-last-unsubscribe,
// reconnects) are owned by src/services/ui/sseClient.test.js and
// src/components/common/subscriber.test.jsx — this file only asserts what
// useLog itself does with the events it receives and the calls it makes.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import useLog from './useLog.js';
import * as logService from '../../services/ui/logService.js';
import { resetSSEClient } from '../../services/ui/sseClient.js';

vi.mock('../../services/ui/logService.js', () => ({
  getLog: vi.fn(),
  addEntry: vi.fn(),
}));

// Controllable fake EventSource that records every instance the shared
// sseClient constructs (same pattern as subscriber.test.jsx).
let eventSources;

class FakeEventSource {
  constructor(url) {
    this.url = url;
    this.onmessage = null;
    this.onerror = null;
    // Named SSE listeners (the shared sseClient registers its 'client-id'
    // event via addEventListener). Stored so tests can fire them the way
    // the browser would; onmessage fan-out semantics are untouched.
    this.namedListeners = {};
    this.close = vi.fn();
    eventSources.push(this);
  }

  addEventListener(type, fn) {
    (this.namedListeners[type] = this.namedListeners[type] || []).push(fn);
  }

  // Deliver a frame the way the browser would (raw SSE data string).
  emit(event) {
    this.onmessage({ data: JSON.stringify(event) });
  }
}

function subscribeUrl(campaignName) {
  const params = new URLSearchParams({ campaign: campaignName });
  return `http://localhost/subscribe?${params.toString()}`;
}

let consoleErrorSpy;

beforeEach(() => {
  resetSSEClient();
  vi.clearAllMocks();
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  eventSources = [];
  global.EventSource = FakeEventSource;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useLog', () => {
  it('starts empty and loads the log on mount', async () => {
    logService.getLog.mockResolvedValue([{ text: 'loaded' }]);

    const { result } = renderHook(() => useLog('test-campaign'));
    expect(result.current.logEntries).toEqual([]);
    expect(result.current.initialized).toBe(false);

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
    expect(logService.getLog).toHaveBeenCalledWith('test-campaign');
    expect(result.current.logEntries).toEqual([{ text: 'loaded' }]);
  });

  it('does nothing with a falsy campaign: no load, no subscribe, no writes', async () => {
    const { result } = renderHook(() => useLog(null));
    await act(async () => {
      await result.current.reloadLog();
      await result.current.addEntry({ text: 'Hello' });
    });

    expect(result.current.logEntries).toEqual([]);
    expect(result.current.initialized).toBe(false);
    expect(eventSources).toHaveLength(0);
    // logService is the network boundary: silence here IS the observable
    // no-request contract for the falsy guards in each effect/callback.
    expect(logService.getLog).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('slices a loaded log to the 200-entry tail', async () => {
    logService.getLog.mockResolvedValue(
      Array.from({ length: 250 }, (_, i) => ({ text: `entry ${i}` }))
    );

    const { result } = renderHook(() => useLog('test-campaign'));
    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });

    expect(result.current.logEntries).toHaveLength(200);
    expect(result.current.logEntries[0].text).toBe('entry 50');
    expect(result.current.logEntries[199].text).toBe('entry 249');
  });

  it('logs a failed initial load and keeps the empty log', async () => {
    const error = new Error('fetch failed');
    logService.getLog.mockRejectedValue(error);

    const { result } = renderHook(() => useLog('test-campaign'));
    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load log:', error);
    expect(result.current.logEntries).toEqual([]);
  });

  it('delegates addEntry to logService and logs failures without throwing', async () => {
    logService.getLog.mockResolvedValue([]);
    logService.addEntry.mockResolvedValue();

    const { result } = renderHook(() => useLog('test-campaign'));
    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });

    await act(async () => {
      await result.current.addEntry({ text: 'Hello' });
    });
    // Delegation IS the seam contract: local state is not updated here,
    // the SSE echo delivers the entry back.
    expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', {
      text: 'Hello',
    });
    expect(result.current.logEntries).toEqual([]);

    const error = new Error('add failed');
    logService.addEntry.mockRejectedValue(error);
    await act(async () => {
      await result.current.addEntry({ text: 'fail' });
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to add log entry:',
      error
    );
  });

  it('replaces entries on reloadLog and logs reload failures', async () => {
    logService.getLog.mockResolvedValue([{ text: 'fresh' }]);

    const { result } = renderHook(() => useLog('test-campaign'));
    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });

    logService.getLog.mockResolvedValue([{ text: 'fresher' }]);
    await act(async () => {
      await result.current.reloadLog();
    });
    expect(result.current.logEntries).toEqual([{ text: 'fresher' }]);

    const error = new Error('reload failed');
    logService.getLog.mockRejectedValue(error);
    await act(async () => {
      await result.current.reloadLog();
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to reload log:', error);
    // Failed reload leaves the previous entries untouched.
    expect(result.current.logEntries).toEqual([{ text: 'fresher' }]);
  });

  it('appends log-* SSE events in order, capped at the 200-entry tail', async () => {
    logService.getLog.mockResolvedValue([{ text: 'loaded' }]);

    const { result } = renderHook(() => useLog('test-campaign'));
    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });

    act(() => {
      for (let i = 0; i < 201; i++) {
        eventSources[0].emit({ key: `log-${i}`, data: { text: `entry ${i}` } });
      }
    });

    // Last-200 window: the loaded entry and the oldest emits are evicted,
    // survivors keep their arrival order.
    expect(result.current.logEntries).toHaveLength(200);
    expect(result.current.logEntries[0].text).toBe('entry 1');
    expect(result.current.logEntries[199].text).toBe('entry 200');
  });

  it('clears the log when an SSE event carries null data', async () => {
    logService.getLog.mockResolvedValue([{ text: 'existing' }]);

    const { result } = renderHook(() => useLog('test-campaign'));
    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });

    act(() => {
      eventSources[0].emit({ key: 'log-clear', data: null });
    });

    expect(result.current.logEntries).toEqual([]);
  });

  it('ignores events whose key does not start with "log-"', async () => {
    logService.getLog.mockResolvedValue([]);

    const { result } = renderHook(() => useLog('test-campaign'));
    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });

    act(() => {
      eventSources[0].emit({ key: 'other-event', data: { text: 'ignored' } });
    });

    expect(result.current.logEntries).toHaveLength(0);
  });

  it('reloads and re-subscribes on campaign change, closing connections on switch and unmount', async () => {
    logService.getLog.mockResolvedValue([{ text: 'old' }]);

    const { result, rerender, unmount } = renderHook(
      ({ campaignName }) => useLog(campaignName),
      { initialProps: { campaignName: 'campaign-a' } }
    );

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });

    logService.getLog.mockResolvedValue([{ text: 'new' }]);
    rerender({ campaignName: 'campaign-b' });

    await waitFor(() => {
      expect(result.current.logEntries).toEqual([{ text: 'new' }]);
    });
    expect(logService.getLog).toHaveBeenCalledWith('campaign-a');
    expect(logService.getLog).toHaveBeenCalledWith('campaign-b');
    expect(eventSources.map(source => source.url)).toEqual([
      subscribeUrl('campaign-a'),
      subscribeUrl('campaign-b'),
    ]);
    // useLog unsubscribes on every seam: old campaign closed on switch,
    // new campaign closed on unmount (last-subscriber mechanics are
    // sseClient-owned; this pins that useLog actually releases them).
    expect(eventSources[0].close).toHaveBeenCalled();
    expect(eventSources[1].close).not.toHaveBeenCalled();

    unmount();
    expect(eventSources[1].close).toHaveBeenCalled();
  });
});
