import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import useLog from './useLog.js';
import * as logService from '../../services/ui/logService.js';
import { resetSSEClient } from '../../services/ui/sseClient.js';

vi.mock('../../services/ui/logService.js', () => ({
  getLog: vi.fn(),
  addEntry: vi.fn(),
}));

beforeEach(() => {
  resetSSEClient();
  vi.clearAllMocks();
  localStorage.clear();
  global.EventSource = vi.fn(function () {
    const close = vi.fn();
    this.onmessage = null;
    this.close = close;
  });
});

function buildSubscribeUrl(campaignName) {
  const params = new URLSearchParams({ campaign: campaignName });
  return `http://localhost/subscribe?${params.toString()}`;
}

function getMockEventSource() {
  return vi.mocked(global.EventSource).mock.results[0]?.value;
}

describe('useLog', () => {
  describe('initial state', () => {
    it('returns empty logEntries and initialized false synchronously', () => {
      const { result } = renderHook(() => useLog('test-campaign'));
      expect(result.current.logEntries).toEqual([]);
      expect(result.current.initialized).toBe(false);
      expect(typeof result.current.addEntry).toBe('function');
      expect(typeof result.current.reloadLog).toBe('function');
    });

    it('returns empty state when campaignName is null', () => {
      const { result } = renderHook(() => useLog(null));
      expect(result.current.logEntries).toEqual([]);
      expect(result.current.initialized).toBe(false);
    });
  });

  describe('initialization', () => {
    it('sets initialized to true after loading log', async () => {
      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });
    });

    it('calls getLog with the campaign name on mount', async () => {
      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });
      expect(logService.getLog).toHaveBeenCalledWith('test-campaign');
    });

    it('does not call getLog when campaignName is falsy', async () => {
      renderHook(() => useLog(null));
      await act(async () => {});
      expect(logService.getLog).not.toHaveBeenCalled();
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

    it('keeps all entries when log has fewer than MAX_LOG_ENTRIES', async () => {
      const fewEntries = [{ text: 'only one' }];
      logService.getLog.mockResolvedValue(fewEntries);

      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      expect(result.current.logEntries).toEqual([{ text: 'only one' }]);
    });

    it('logs error and keeps empty entries when getLog rejects', async () => {
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
  });

  describe('reloadLog', () => {
    it('calls getLog and replaces entries on success', async () => {
      logService.getLog.mockResolvedValue([{ text: 'fresh' }]);

      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      await act(async () => {
        await result.current.reloadLog();
      });

      expect(logService.getLog).toHaveBeenCalledWith('test-campaign');
      expect(result.current.logEntries).toEqual([{ text: 'fresh' }]);
    });

    it('logs error when reloadLog rejects', async () => {
      const error = new Error('reload failed');
      logService.getLog.mockRejectedValue(error);

      const consoleErrorSpy = vi.spyOn(console, 'error');

      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      await act(async () => {
        await result.current.reloadLog();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to reload log:',
        error
      );

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
    it('calls logService.addEntry with campaign name and entry', async () => {
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
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

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
    it('subscribes to SSE with the correct campaign name on mount', () => {
      renderHook(() => useLog('test-campaign'));
      expect(global.EventSource).toHaveBeenCalledWith(
        buildSubscribeUrl('test-campaign')
      );
    });

    it('does not subscribe to SSE when campaignName is falsy', () => {
      renderHook(() => useLog(null));
      expect(global.EventSource).not.toHaveBeenCalled();
    });

    it('appends log entries from SSE events and caps at MAX_LOG_ENTRIES', async () => {
      logService.getLog.mockResolvedValue([]);

      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      act(() => {
        for (let i = 0; i < 205; i++) {
          getMockEventSource().onmessage({
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

    it('clears entries when SSE event data is null', async () => {
      logService.getLog.mockResolvedValue([
        { text: 'existing' },
        { text: 'also existing' },
      ]);

      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      expect(result.current.logEntries).toHaveLength(2);

      act(() => {
        getMockEventSource().onmessage({
          data: JSON.stringify({
            key: 'log-clear',
            data: null,
          }),
        });
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
        getMockEventSource().onmessage({
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
        getMockEventSource().onmessage({
          data: JSON.stringify({
            key: 'log-1',
            data: { text: 'sse one' },
          }),
        });
        getMockEventSource().onmessage({
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

    it('appends SSE events to existing loaded entries', async () => {
      const initialEntries = [{ text: 'loaded' }];
      logService.getLog.mockResolvedValue(initialEntries);

      const { result } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      act(() => {
        getMockEventSource().onmessage({
          data: JSON.stringify({
            key: 'log-new',
            data: { text: 'new entry' },
          }),
        });
      });

      expect(result.current.logEntries).toHaveLength(2);
      expect(result.current.logEntries[0]).toEqual({ text: 'loaded' });
      expect(result.current.logEntries[1]).toEqual({ text: 'new entry' });
    });
  });

  describe('campaign name changes', () => {
    it('reloads log and re-subscribes when campaignName changes', async () => {
      logService.getLog.mockResolvedValue([{ text: 'old' }]);

      const { result, rerender } = renderHook(
        ({ campaignName }) => useLog(campaignName),
        { initialProps: { campaignName: 'campaign-a' } }
      );

      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      expect(result.current.logEntries).toEqual([{ text: 'old' }]);
      expect(logService.getLog).toHaveBeenCalledWith('campaign-a');

      logService.getLog.mockResolvedValue([{ text: 'new' }]);

      rerender({ campaignName: 'campaign-b' });

      await waitFor(() => {
        expect(result.current.logEntries).toEqual([{ text: 'new' }]);
      });

      expect(logService.getLog).toHaveBeenCalledWith('campaign-b');
      expect(global.EventSource).toHaveBeenCalledTimes(2);
    });

    it('clears subscription when campaignName changes from valid to null', async () => {
      logService.getLog.mockResolvedValue([]);

      const { result, rerender } = renderHook(
        ({ campaignName }) => useLog(campaignName),
        { initialProps: { campaignName: 'campaign-a' } }
      );

      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      const initialEventSource = getMockEventSource();

      rerender({ campaignName: null });

      expect(initialEventSource.close).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('calls EventSource.close on unmount', async () => {
      logService.getLog.mockResolvedValue([]);

      const { result, unmount } = renderHook(() => useLog('test-campaign'));
      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });

      const eventSource = getMockEventSource();
      expect(eventSource.close).not.toHaveBeenCalled();
      unmount();
      await act(async () => {});
      expect(eventSource.close).toHaveBeenCalled();
    });

    it('does not create EventSource when campaignName is falsy', () => {
      renderHook(() => useLog(null));
      expect(global.EventSource).not.toHaveBeenCalled();
    });
  });
});
