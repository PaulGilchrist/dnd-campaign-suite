import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../services/logService.js', () => ({
  getLog: vi.fn(async () => []),
  addEntry: vi.fn(async () => {}),
}));

vi.mock('../utils/sseClientId.js', () => ({ default: 'test-client-id-123' }));
const CLIENT_ID = 'test-client-id-123';

let mockEventSource;

beforeEach(() => {
   vi.clearAllMocks();
   localStorage.clear();
   mockEventSource = { onmessage: null, close: vi.fn() };
});

function buildUrl(campaignName) {
    const params = new URLSearchParams({ campaign: campaignName, clientId: CLIENT_ID });
    return `http://localhost/subscribe?${params.toString()}`;
    }

const MockEventSourceClass = vi.fn(function () {
    return mockEventSource;
});
MockEventSourceClass.prototype.close = () => {};
global.EventSource = MockEventSourceClass;

import useLog from './useLog.js';

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
    const { result } = renderHook(() => useLog('my-campaign'));
    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
        });
    const logServiceMock = await import('../services/logService.js');
    expect(logServiceMock.getLog).toHaveBeenCalledWith('my-campaign');
       });

  it('addEntry should call logService.addEntry', async () => {
    const { result } = renderHook(() => useLog('test-campaign'));
    await act(async () => {
      await result.current.addEntry({ text: 'Hello' });
         });
    const logServiceMock = await import('../services/logService.js');
    expect(logServiceMock.addEntry).toHaveBeenCalledWith('test-campaign', { text: 'Hello' });
       });

   it('should create EventSource with correct URL including clientId', () => {
     renderHook(() => useLog('test-campaign'));
     expect(global.EventSource).toHaveBeenCalledWith(buildUrl('test-campaign'));
        });

   it('onmessage handler should add entries to logEntries', async () => {
      const mockLogService = {
        getLog: vi.fn(async () => []),
        addEntry: vi.fn(async () => {})
       };
     vi.doMock('../services/logService.js', () => mockLogService);

      const { result } = renderHook(() => useLog('test-campaign'));

      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
         });

           // Simulate an SSE message from another client (different selfId)
       const logEntry = { text: 'A dragon appears!' };
         act(() => {
           mockEventSource.onmessage({
              data: JSON.stringify({ key: 'log-1234567890', data: logEntry, selfId: 'different-client' }),
             });
        });

      await waitFor(() => {
        expect(result.current.logEntries).toHaveLength(1);
        expect(result.current.logEntries[0]).toEqual(logEntry);
          });
      });

   it('should ignore self-echo SSE messages (matching clientId)', async () => {
     const logEntry = { text: 'self-echo' };
      const { result } = renderHook(() => useLog('test-campaign'));

         act(() => {
           mockEventSource.onmessage({
              data: JSON.stringify({ key: 'log-self', data: logEntry, selfId: CLIENT_ID }),
             });
        });

         expect(result.current.logEntries).toHaveLength(0);
      });

    it('should ignore non-log events', async () => {
       const { result } = renderHook(() => useLog('test-campaign'));

      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
          });

         act(() => {
           mockEventSource.onmessage({
              data: JSON.stringify({ key: 'other-event', data: { text: 'ignored' }, selfId: 'different-client' }),
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
                data: JSON.stringify({ key: `log-${i}`, data: { text: `entry ${i}` }, selfId: 'different-client' }),
                 });
            }
          });

      await waitFor(() => {
        expect(result.current.logEntries.length).toBeLessThanOrEqual(200);
        });
       });

    it('should call EventSource.close on unmount', async () => {
       const { unmount } = renderHook(() => useLog('test-campaign'));
       expect(mockEventSource.close).not.toHaveBeenCalled();
       unmount();
      await act(async () => {});
       expect(mockEventSource.close).toHaveBeenCalled();
       });
});
