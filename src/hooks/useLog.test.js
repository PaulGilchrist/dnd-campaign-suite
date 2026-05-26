import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useLog from './useLog.js';

const mockClose = vi.fn();
let mockEventSource;

beforeEach(() => {
   vi.restoreAllMocks();
   localStorage.clear();
   mockEventSource = { onmessage: null, close: vi.fn() };
});

const MockEventSourceClass = vi.fn(function() {
    return mockEventSource;
});
MockEventSourceClass.prototype.close = () => {};
global.EventSource = MockEventSourceClass;

describe('useLog', () => {
  it('should start with empty logEntries and initialized false', () => {
    const { result } = renderHook(() => useLog('test-campaign'));
    expect(result.current.logEntries).toEqual([]);
    expect(result.current.initialized).toBe(false);
  });

  it('should set initialized to true after effect runs', async () => {
    const { result } = renderHook(() => useLog('test-campaign'));
    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
  });

  it('should call getLog with campaignName', async () => {
    const { logService } = await import('../services/logService.js');
    const { result } = renderHook(() => useLog('my-campaign'));
    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
    expect(logService.getLog).toHaveBeenCalledWith('my-campaign');
  });

  it('addEntry should call logService.addEntry', async () => {
    const { logService } = await import('../services/logService.js');
    const { result } = renderHook(() => useLog('test-campaign'));
    await act(async () => {
      await result.current.addEntry({ text: 'Hello' });
    });
    expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', { text: 'Hello' });
  });

   it('should create EventSource with correct URL', () => {
     renderHook(() => useLog('test-campaign'));
     expect(global.EventSource).toHaveBeenCalledWith(
        'http://localhost/subscribe?campaign=test-campaign'
      );
    });

   it('onmessage handler should add entries to logEntries', async () => {
     const logService = await vi.importActual('../services/logService.js');
     const mockLogService = {
       getLog: vi.fn(async () => []),
       addEntry: vi.fn(async () => {})
     };
     vi.doMock('../services/logService.js', () => mockLogService);

     const { result } = renderHook(() => useLog('test-campaign'));

     await waitFor(() => {
       expect(result.current.initialized).toBe(true);
      });

      // Simulate an SSE message
     const logEntry = { text: 'A dragon appears!' };
     act(() => {
       mockEventSource.onmessage({
         data: JSON.stringify({ key: 'log-1234567890', data: logEntry }),
        });
      });

     await waitFor(() => {
       expect(result.current.logEntries).toHaveLength(1);
       expect(result.current.logEntries[0]).toEqual(logEntry);
      });
    });

   it('should ignore non-log events', async () => {
     const { result } = renderHook(() => useLog('test-campaign');

     await waitFor(() => {
       expect(result.current.initialized).toBe(true);
      });

     act(() => {
       mockEventSource.onmessage({
         data: JSON.stringify({ key: 'other-event', data: { text: 'ignored' } }),
        });
      });

      // Should still be empty since key doesn't start with 'log-'
     expect(result.current.logEntries).toHaveLength(0);
    });

   it('should cap log entries at MAX_LOG_ENTRIES', async () => {
     const { result } = renderHook(() => useLog('test-campaign'));

     await waitFor(() => {
       expect(result.current.initialized).toBe(true);
      });

      // Add 205 entries to exceed MAX_LOG_ENTRIES (200)
     act(() => {
       for (let i = 0; i < 205; i++) {
         mockEventSource.onmessage({
           data: JSON.stringify({ key: `log-${i}`, data: { text: `entry ${i}` } }),
          });
        }
      });

     await waitFor(() => {
       expect(result.current.logEntries.length).toBeLessThanOrEqual(200);
      });
    });

   it('should call EventSource.close on unmount', () => {
     const { unmount } = renderHook(() => useLog('test-campaign'));
     expect(mockEventSource.close).not.toHaveBeenCalled();
     unmount();
     await act(async () => {});
     expect(mockEventSource.close).toHaveBeenCalled();
    });
});
