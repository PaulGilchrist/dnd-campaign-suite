// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';

import Subscriber from './Subscriber.jsx';

// Module-level registry for the mocked SSE client.
var _sseRegistry = new Map();

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: function (campaignName, handler) {
    var key = campaignName || '';
    if (!_sseRegistry.has(key)) {
      _sseRegistry.set(key, {
        handlers: new Set(),
        eventSource: {
          onmessage: function (e) {
            var parsed;
            try { parsed = JSON.parse(e.data); }
            catch (_) { return; }
            _sseRegistry.get(key).handlers.forEach(function (fn) {
              try { fn(parsed); }
              catch (_) { /* handler errors are logged in the real impl */ }
            });
          },
          onerror: function () {},
          close: function () {},
        },
      });
    }
    var entry = _sseRegistry.get(key);
    entry.handlers.add(handler);
    return function unsubscribe() {
      entry.handlers.delete(handler);
      if (entry.handlers.size === 0) {
        entry.eventSource.close();
        _sseRegistry.delete(key);
      }
    };
  },
  resetSSEClient: function () {
    _sseRegistry.forEach(function (entry) { entry.eventSource.close(); });
    _sseRegistry.clear();
  },
  __getSources: function () { return _sseRegistry; },
}));

// Re-import after mocking so Subscriber gets the mocked module.
const { resetSSEClient, __getSources } = await import('../../services/ui/sseClient.js');

describe('Subscriber', () => {
  beforeEach(() => {
    resetSSEClient();
  });

  describe('event subscription', () => {
    it('registers a handler with subscribeToSSE when mounted', () => {
      const handleEvent = vi.fn();

      render(
        <Subscriber
          handleEvent={handleEvent}
          campaignName="test-campaign"
        />
      );

      const entry = __getSources().get('test-campaign');
      expect(entry).toBeDefined();
      expect(entry.handlers.size).toBe(1);
    });

    it('registers with an empty string key when campaignName is falsy (null, undefined, or empty string)', () => {
      const nullHandleEvent = vi.fn();
      const undefinedHandleEvent = vi.fn();
      const emptyHandleEvent = vi.fn();

      render(
        <Subscriber
          handleEvent={nullHandleEvent}
          campaignName={null}
        />
      );
      render(
        <Subscriber
          handleEvent={undefinedHandleEvent}
          campaignName={undefined}
        />
      );
      render(
        <Subscriber
          handleEvent={emptyHandleEvent}
          campaignName=""
        />
      );

      const entry = __getSources().get('');
      expect(entry).toBeDefined();
      expect(entry.handlers.size).toBe(3);
    });

  });

  describe('event handling', () => {
    it('passes parsed SSE data to the handler', () => {
      const handleEvent = vi.fn();

      render(
        <Subscriber
          handleEvent={handleEvent}
          campaignName="test-campaign"
        />
      );

      // Simulate an SSE message arriving on the shared EventSource
      const entry = Array.from(__getSources().values())[0];
      entry.eventSource.onmessage({ data: JSON.stringify({ type: 'test', data: 'value' }) });

      expect(handleEvent).toHaveBeenCalledWith({ type: 'test', data: 'value' });
    });

    it('dispatches a shared SSE event to all subscribed handlers for the same campaign', () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      render(
        <Subscriber
          handleEvent={firstHandler}
          campaignName="test-campaign"
        />
      );
      render(
        <Subscriber
          handleEvent={secondHandler}
          campaignName="test-campaign"
        />
      );

      const eventData = { key: 'some-event', data: 42 };
      const entry = Array.from(__getSources().values())[0];
      entry.eventSource.onmessage({ data: JSON.stringify(eventData) });

      expect(firstHandler).toHaveBeenCalledWith(eventData);
      expect(secondHandler).toHaveBeenCalledWith(eventData);
    });
  });

  describe('handleEvent ref staleness prevention', () => {
    it('calls the latest handleEvent when props change', () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      const { rerender } = render(
        <Subscriber
          handleEvent={firstHandler}
          campaignName="test-campaign"
        />
      );

      // Capture the EventSource after the first render
      const entry = Array.from(__getSources().values())[0];

      // Rerender with a new handler — useEffect only depends on campaignName,
      // so the same EventSource is kept; only the ref is updated in-place.
      rerender(
        <Subscriber
          handleEvent={secondHandler}
          campaignName="test-campaign"
        />
      );

      entry.eventSource.onmessage({ data: JSON.stringify({ type: 'test' }) });

      expect(secondHandler).toHaveBeenCalledWith({ type: 'test' });
      expect(firstHandler).not.toHaveBeenCalled();
    });

    it('unsubscribes from the old campaign and subscribes to the new one when campaignName changes', () => {
      const handlerA = vi.fn();
      const handlerB = vi.fn();

      const { rerender } = render(
        <Subscriber
          handleEvent={handlerA}
          campaignName="campaign-a"
        />
      );

      expect(__getSources().has('campaign-a')).toBe(true);
      expect(__getSources().has('campaign-b')).toBe(false);

      rerender(
        <Subscriber
          handleEvent={handlerB}
          campaignName="campaign-b"
        />
      );

      // After rerender: campaign-a subscription was cleaned up, campaign-b is active.
      expect(__getSources().has('campaign-a')).toBe(false);
      expect(__getSources().has('campaign-b')).toBe(true);
      expect(__getSources().get('campaign-b').handlers.size).toBe(1);
    });
  });

  describe('cleanup on unmount', () => {
    it('unsubscribes the handler from subscribeToSSE on unmount', () => {
      const handleEvent = vi.fn();
      const { unmount } = render(
        <Subscriber
          handleEvent={handleEvent}
          campaignName="test-campaign"
        />
      );

      const entry = __getSources().get('test-campaign');
      expect(entry.handlers.size).toBe(1);

      unmount();

      expect(entry.handlers.size).toBe(0);
    });

    it('closes the EventSource only after the last subscriber for a campaign unmounts', () => {
      const { unmount: unmountFirst } = render(
        <Subscriber
          handleEvent={vi.fn()}
          campaignName="test-campaign"
        />
      );
      const { unmount: unmountSecond } = render(
        <Subscriber
          handleEvent={vi.fn()}
          campaignName="test-campaign"
        />
      );

      const entry = __getSources().get('test-campaign');
      let closed = false;
      entry.eventSource.close = function () { closed = true; };

      unmountFirst();
      expect(closed).toBe(false);

      unmountSecond();
      expect(closed).toBe(true);
    });

    it('removing one subscriber does not affect handlers for other campaigns', () => {
      const handlerA = vi.fn();
      const handlerB = vi.fn();

      render(
        <Subscriber
          handleEvent={handlerA}
          campaignName="campaign-a"
        />
      );
      render(
        <Subscriber
          handleEvent={handlerB}
          campaignName="campaign-b"
        />
      );

      const { unmount } = render(
        <Subscriber
          handleEvent={vi.fn()}
          campaignName="campaign-a"
        />
      );

      const entryA = __getSources().get('campaign-a');

      // Two subscribers for campaign-a; unmounting one leaves one.
      expect(entryA.handlers.size).toBe(2);
      expect(__getSources().get('campaign-b').handlers.size).toBe(1);

      // Unmount should not affect campaign-b
      unmount();
      expect(entryA.handlers.size).toBe(1);
      expect(__getSources().get('campaign-b').handlers.size).toBe(1);
    });
  });

  describe('different campaigns', () => {
    it('only delivers events to handlers subscribed to the matching campaign', () => {
      const handlerA = vi.fn();
      const handlerB = vi.fn();

      render(
        <Subscriber
          handleEvent={handlerA}
          campaignName="campaign-a"
        />
      );
      render(
        <Subscriber
          handleEvent={handlerB}
          campaignName="campaign-b"
        />
      );

      const entryA = __getSources().get('campaign-a');

      const eventData = { key: 'event-x', data: 1 };
      entryA.eventSource.onmessage({ data: JSON.stringify(eventData) });

      expect(handlerA).toHaveBeenCalledWith(eventData);
      expect(handlerB).not.toHaveBeenCalled();
    });
  });

  describe('malformed SSE data', () => {
    it('does not call the handler when SSE data is not valid JSON', () => {
      const handleEvent = vi.fn();

      render(
        <Subscriber
          handleEvent={handleEvent}
          campaignName="test-campaign"
        />
      );

      const entry = Array.from(__getSources().values())[0];
      entry.eventSource.onmessage({ data: 'not json' });

      expect(handleEvent).not.toHaveBeenCalled();
    });
  });

  describe('handler error tolerance', () => {
    it('does not prevent other handlers from receiving events when one handler throws', () => {
      const throwingHandler = vi.fn(() => {
        throw new Error('handler error');
      });
      const healthyHandler = vi.fn();

      render(
        <Subscriber
          handleEvent={throwingHandler}
          campaignName="test-campaign"
        />
      );
      render(
        <Subscriber
          handleEvent={healthyHandler}
          campaignName="test-campaign"
        />
      );

      const entry = Array.from(__getSources().values())[0];
      const eventData = { key: 'test', data: 1 };

      // The SSE client catches handler errors internally; the event should
      // still reach the healthy handler.
      entry.eventSource.onmessage({ data: JSON.stringify(eventData) });

      expect(healthyHandler).toHaveBeenCalledWith(eventData);
    });
  });
});
