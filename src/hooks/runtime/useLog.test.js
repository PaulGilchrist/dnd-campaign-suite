// @maintained-by-ai
// Deterministic hook-contract tests for useLog: initial load + MAX_LOG_ENTRIES
// cap, reloadLog/addEntry delegation (logService is mocked at the boundary),
// SSE log-event handling via the REAL shared sseClient, and subscription
// lifecycle across campaign changes/unmount. Shared-client mechanics
// (fan-out, connection sharing, close-on-last-unsubscribe) are covered by
// src/components/common/subscriber.test.jsx — this file only asserts what
// useLog itself does with the events it receives.
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    this.close = vi.fn();
    eventSources.push(this);
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

function logEvent(key, data) {
  return { key, data };
}

beforeEach(() => {
  resetSSEClient();
  vi.clearAllMocks();
  eventSources = [];
  global.EventSource = FakeEventSource;
});

describe('useLog', () => {
  describe('initial state', () => {
    it('returns empty logEntries and initialized false synchronously', () => {
      const { result } = renderHook(() => useLog('test-campaign'));
      expect(result.current.logEntries).toEqual([]);
      expect(result.current.initialized).toBe(false);
      expect(typeof result.current.addEntry).toBe('function');
      expect(typeof result.current.reloadLog).toBe('function');
    });

    it('does nothing when campaignName is falsy', async () => {
      const { result } = renderHook(() => useLog(null));
      await act(async () => {});
      expect(result.current.logEntries).toEqual([]);
      expect(result.current.initialized).toBe(false);
      expect(logService.getLog).not.toHaveBeenCalled();
      expect(eventSources).toHaveLength(0);
    });
  });

  describe('initialization', () => {
    it('loads the log via getLog on mount and sets initialized', async () => {
      logService.getLog.mockResolvedValue([{ text: 'loaded' }]);

      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      expect(logService.getLog).toHaveBeenCalledWith('test-campaign');
      expect(result.current.logEntries).toEqual([{ text: 'loaded' }]);
    });

    it('slices loaded entries to MAX_LOG_ENTRIES (200) when log has more', async () => {
      const manyEntries = Array.from({ length: 250 }, (_, i) => ({
        text: `entry ${i}`,
      }));
      logService.getLog.mockResolvedValue(manyEntries);

      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      expect(result.current.logEntries).toHaveLength(200);
      expect(result.current.logEntries[0].text).toBe('entry 50');
      expect(result.current.logEntries[199].text).toBe('entry 249');
    });

    it('logs error and keeps empty entries when getLog rejects', async () => {
      const error = new Error('fetch failed');
      logService.getLog.mockRejectedValue(error);

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load log:', error);
      expect(result.current.logEntries).toEqual([]);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('reloadLog', () => {
    it('replaces entries with fresh getLog results', async () => {
      logService.getLog.mockResolvedValue([{ text: 'fresh' }]);

      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      logService.getLog.mockResolvedValue([{ text: 'fresher' }]);
      await act(async () => {
        await result.current.reloadLog();
      });

      expect(logService.getLog).toHaveBeenCalledTimes(2);
      expect(result.current.logEntries).toEqual([{ text: 'fresher' }]);
    });

    it('logs error when reloadLog rejects', async () => {
      const error = new Error('reload failed');
      logService.getLog.mockRejectedValue(error);

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      await act(async () => {
        await result.current.reloadLog();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to reload log:', error);

      consoleErrorSpy.mockRestore();
    });

    it('does not call getLog when campaignName is falsy', async () => {
      const { result } = renderHook(() => useLog(null));
      await act(async () => {
        await result.current.reloadLog();
      });
      expect(logService.getLog).not.toHaveBeenCalled();
    });
  });

  describe('addEntry', () => {
    it('delegates to logService.addEntry with campaign name and entry', async () => {
      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      await act(async () => {
        await result.current.addEntry({ text: 'Hello' });
      });
      expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', {
        text: 'Hello',
      });
    });

    it('logs error when addEntry rejects', async () => {
      const error = new Error('add failed');
      logService.addEntry.mockRejectedValue(error);

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      await act(async () => {
        await result.current.addEntry({ text: 'fail' });
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to add log entry:', error);

      consoleErrorSpy.mockRestore();
    });

    it('does not call addEntry when campaignName is falsy', async () => {
      const { result } = renderHook(() => useLog(null));
      await act(async () => {
        await result.current.addEntry({ text: 'Hello' });
      });
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });

  describe('SSE event handling', () => {
    it('subscribes through the shared SSE client with the campaign URL', () => {
      renderHook(() => useLog('test-campaign'));
      expect(eventSources).toHaveLength(1);
      expect(eventSources[0].url).toBe(subscribeUrl('test-campaign'));
    });

    it('appends log events in order after the initial load', async () => {
      logService.getLog.mockResolvedValue([{ text: 'loaded' }]);

      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      act(() => {
        eventSources[0].emit(logEvent('log-1', { text: 'sse one' }));
        eventSources[0].emit(logEvent('log-2', { text: 'sse two' }));
      });

      expect(result.current.logEntries).toEqual([
        { text: 'loaded' },
        { text: 'sse one' },
        { text: 'sse two' },
      ]);
    });

    it('caps appended entries at MAX_LOG_ENTRIES (200)', async () => {
      logService.getLog.mockResolvedValue([]);

      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      act(() => {
        for (let i = 0; i < 205; i++) {
          eventSources[0].emit(logEvent(`log-${i}`, { text: `entry ${i}` }));
        }
      });

      expect(result.current.logEntries).toHaveLength(200);
      expect(result.current.logEntries[0].text).toBe('entry 5');
      expect(result.current.logEntries[199].text).toBe('entry 204');
    });

    it('clears entries when SSE event data is null', async () => {
      logService.getLog.mockResolvedValue([
        { text: 'existing' },
        { text: 'also existing' },
      ]);

      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      act(() => {
        eventSources[0].emit(logEvent('log-clear', null));
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
        eventSources[0].emit(logEvent('other-event', { text: 'ignored' }));
      });

      expect(result.current.logEntries).toHaveLength(0);
    });
  });

  describe('campaign changes and cleanup', () => {
    it('reloads log and re-subscribes when campaignName changes', async () => {
      logService.getLog.mockResolvedValue([{ text: 'old' }]);

      const { result, rerender } = renderHook(
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
      expect(eventSources).toHaveLength(2);
      expect(eventSources[0].url).toBe(subscribeUrl('campaign-a'));
      expect(eventSources[0].close).toHaveBeenCalled();
      expect(eventSources[1].url).toBe(subscribeUrl('campaign-b'));
    });

    it('closes the connection on unmount', async () => {
      logService.getLog.mockResolvedValue([]);

      const { result, unmount } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      expect(eventSources[0].close).not.toHaveBeenCalled();
      unmount();
      expect(eventSources[0].close).toHaveBeenCalled();
    });
  });
});
