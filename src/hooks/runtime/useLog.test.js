// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../services/ui/logService.js', () => ({
  getLog: vi.fn(async () => []),
  addEntry: vi.fn(async () => {}),
}));

import useLog from './useLog.js';
import * as logService from '../../services/ui/logService.js';

let mockEventSource;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockEventSource = { onmessage: null, close: vi.fn() };
  global.EventSource = vi.fn(function () {
    return mockEventSource;
  });
  global.EventSource.prototype.close = function () {};
});

function buildSubscribeUrl(campaignName) {
  const params = new URLSearchParams({ campaign: campaignName });
  return `http://localhost/subscribe?${params.toString()}`;
}

describe('useLog', () => {
  describe('initial state', () => {
    it('returns empty logEntries and initialized false before effect runs', () => {
      const { result } = renderHook(() => useLog('test-campaign'));
      expect(result.current.logEntries).toEqual([]);
      expect(result.current.initialized).toBe(false);
    });
  });

  describe('initialization', () => {
    it('sets initialized to true after the effect resolves', async () => {
      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });
    });

    it('calls getLog with the campaign name', async () => {
      const { result } = renderHook(() => useLog('my-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });
      expect(logService.getLog).toHaveBeenCalledWith('my-campaign');
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

    it('handles getLog returning fewer entries than MAX_LOG_ENTRIES', async () => {
      const fewEntries = [{ text: 'only one' }];
      logService.getLog.mockResolvedValue(fewEntries);

      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      expect(result.current.logEntries).toHaveLength(1);
      expect(result.current.logEntries[0]).toEqual({ text: 'only one' });
    });

    it('handles getLog rejecting by logging error and still setting initialized', async () => {
      const error = new Error('fetch failed');
      logService.getLog.mockRejectedValue(error);

      const consoleErrorSpy = vi.spyOn(console, 'error');

      const { result } = renderHook(() => useLog('test-campaign'));

      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load log:',
        error
      );
      expect(result.current.logEntries).toEqual([]);

      consoleErrorSpy.mockRestore();
    });

    it('does not call getLog when campaignName is falsy', async () => {
      renderHook(() => useLog(null));
      await act(async () => {});
      expect(logService.getLog).not.toHaveBeenCalled();
    });
  });

  describe('addEntry', () => {
    it('calls logService.addEntry with campaign name and entry', async () => {
      const { result } = renderHook(() => useLog('test-campaign'));
      await act(async () => {
        await result.current.addEntry({ text: 'Hello' });
      });
      expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', {
        text: 'Hello',
      });
    });

    it('does not call addEntry when campaignName is falsy', async () => {
      const { result } = renderHook(() => useLog(null));
      await act(async () => {
        await result.current.addEntry({ text: 'Hello' });
      });
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('logs error when addEntry rejects', async () => {
      const error = new Error('add failed');
      logService.addEntry.mockRejectedValue(error);

      const consoleErrorSpy = vi.spyOn(console, 'error');

      const { result } = renderHook(() => useLog('test-campaign'));
      await act(async () => {
        await result.current.addEntry({ text: 'fail' });
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to add log entry:',
        error
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('SSE event handling', () => {
    it('creates EventSource with the correct subscribe URL', () => {
      renderHook(() => useLog('test-campaign'));
      expect(global.EventSource).toHaveBeenCalledWith(
        buildSubscribeUrl('test-campaign')
      );
    });

    it('appends log entries from SSE events and caps at MAX_LOG_ENTRIES', async () => {
      logService.getLog.mockResolvedValue([]);

      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      // Add 205 entries via SSE — should cap at 200
      act(() => {
        for (let i = 0; i < 205; i++) {
          mockEventSource.onmessage({
            data: JSON.stringify({
              key: `log-${i}`,
              data: { text: `entry ${i}` },
            }),
          });
        }
      });

      expect(result.current.logEntries).toHaveLength(200);
      expect(result.current.logEntries[0].text).toBe('entry 5');
      expect(result.current.logEntries[199].text).toBe('entry 204');
    });

    it('ignores events whose key does not start with "log-"', async () => {
      logService.getLog.mockResolvedValue([]);

      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      act(() => {
        mockEventSource.onmessage({
          data: JSON.stringify({
            key: 'other-event',
            data: { text: 'ignored' },
          }),
        });
      });

      expect(result.current.logEntries).toHaveLength(0);
    });

    it('maintains entries across multiple SSE events after initial load', async () => {
      const initialEntries = [{ text: 'initial' }];
      logService.getLog.mockResolvedValue(initialEntries);

      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      expect(result.current.logEntries).toHaveLength(1);

      act(() => {
        mockEventSource.onmessage({
          data: JSON.stringify({
            key: 'log-1',
            data: { text: 'sse one' },
          }),
        });
        mockEventSource.onmessage({
          data: JSON.stringify({
            key: 'log-2',
            data: { text: 'sse two' },
          }),
        });
      });

      expect(result.current.logEntries).toHaveLength(3);
      expect(result.current.logEntries[1]).toEqual({ text: 'sse one' });
      expect(result.current.logEntries[2]).toEqual({ text: 'sse two' });
    });
  });

  describe('cleanup', () => {
    it('calls EventSource.close on unmount', async () => {
      logService.getLog.mockResolvedValue([]);

      const { result, unmount } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      expect(mockEventSource.close).not.toHaveBeenCalled();
      unmount();
      await act(async () => {});
      expect(mockEventSource.close).toHaveBeenCalled();
    });

    it('does not create EventSource when campaignName is falsy', () => {
      renderHook(() => useLog(null));
      expect(mockEventSource.close).not.toHaveBeenCalled();
      expect(global.EventSource).not.toHaveBeenCalled();
    });
  });
});
