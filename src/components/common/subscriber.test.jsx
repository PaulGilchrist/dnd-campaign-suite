// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';

import Subscriber from './Subscriber.jsx';
import { resetSSEClient } from '../../services/ui/sseClient.js';

// Exercise the REAL Subscriber against the REAL shared SSE client, faking
// only the browser boundary (EventSource, which jsdom lacks — setup.js
// installs an inert one; this controllable fake replaces it per-file).
//
// The previous version of this file mocked sseClient with a reimplementation
// of its fan-out logic, so tests of dispatch, parse-error tolerance, and
// close-on-last-unsubscribe validated the mock instead of the code. That
// mock is gone: assertions here are observable behavior only — the
// connection URL, how many connections exist, whether they are closed, and
// what each handleEvent receives.
class FakeEventSource {
  constructor(url) {
    this.url = url;
    this.closed = false;
    this.onmessage = null;
    this.onerror = null;
    eventSources.push(this);
  }

  close() {
    this.closed = true;
  }

  // Deliver a frame the way the browser would (raw SSE data string).
  emitRaw(data) {
    this.onmessage({ data });
  }

  emit(event) {
    this.emitRaw(JSON.stringify(event));
  }
}

let eventSources;

function subscribeUrl(campaignName) {
  const params = new URLSearchParams();
  if (campaignName) {
    params.set('campaign', campaignName);
  }
  return `http://localhost/subscribe?${params.toString()}`;
}

beforeEach(() => {
  eventSources = [];
  global.EventSource = FakeEventSource;
  // Close/forget any connections left over from a previous test file.
  resetSSEClient();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Subscriber', () => {
  describe('subscription lifecycle', () => {
    it('renders nothing', () => {
      const { container } = render(
        <Subscriber handleEvent={vi.fn()} campaignName="test-campaign" />
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('opens an SSE connection for the campaign on mount', () => {
      render(
        <Subscriber handleEvent={vi.fn()} campaignName="test-campaign" />
      );

      expect(eventSources).toHaveLength(1);
      expect(eventSources[0].url).toBe(subscribeUrl('test-campaign'));
      expect(eventSources[0].closed).toBe(false);
    });

    it('shares one connection between multiple subscribers of the same campaign', () => {
      // Regression guard for the documented production incident: per-instance
      // EventSources exhausted the browser's ~6-connection-per-host pool and
      // starved normal fetches. Subscribers must fan out over one shared
      // connection via subscribeToSSE, never open their own.
      render(
        <Subscriber handleEvent={vi.fn()} campaignName="test-campaign" />
      );
      render(
        <Subscriber handleEvent={vi.fn()} campaignName="test-campaign" />
      );
      render(
        <Subscriber handleEvent={vi.fn()} campaignName="test-campaign" />
      );

      expect(eventSources).toHaveLength(1);
    });

    it('subscribes to the campaign-less feed when campaignName is falsy', () => {
      const handleEvent = vi.fn();
      render(
        <Subscriber handleEvent={handleEvent} campaignName={null} />
      );
      render(
        <Subscriber handleEvent={vi.fn()} campaignName="" />
      );

      // null and '' share one anonymous feed with no campaign query param.
      expect(eventSources).toHaveLength(1);
      expect(eventSources[0].url).toBe(subscribeUrl());

      const event = { key: 'anon-event', data: 1 };
      eventSources[0].emit(event);
      expect(handleEvent).toHaveBeenCalledWith(event);
    });

    it('closes the old connection and opens one for the new campaign when campaignName changes', () => {
      const handlerA = vi.fn();
      const handlerB = vi.fn();

      const { rerender } = render(
        <Subscriber handleEvent={handlerA} campaignName="campaign-a" />
      );

      rerender(<Subscriber handleEvent={handlerB} campaignName="campaign-b" />);

      expect(eventSources).toHaveLength(2);
      expect(eventSources[0].url).toBe(subscribeUrl('campaign-a'));
      expect(eventSources[0].closed).toBe(true);
      expect(eventSources[1].url).toBe(subscribeUrl('campaign-b'));

      // Events on the abandoned campaign no longer reach the component.
      eventSources[0].emit({ key: 'stale' });
      expect(handlerA).not.toHaveBeenCalled();

      const event = { key: 'fresh' };
      eventSources[1].emit(event);
      expect(handlerB).toHaveBeenCalledWith(event);
    });

    it('closes the connection only after the last subscriber for the campaign unmounts', () => {
      const { unmount: unmountFirst } = render(
        <Subscriber handleEvent={vi.fn()} campaignName="test-campaign" />
      );
      const { unmount: unmountSecond } = render(
        <Subscriber handleEvent={vi.fn()} campaignName="test-campaign" />
      );

      unmountFirst();
      expect(eventSources[0].closed).toBe(false);

      unmountSecond();
      expect(eventSources[0].closed).toBe(true);
    });

    it('leaves other campaigns connected when one campaign unmounts', () => {
      const { unmount } = render(
        <Subscriber handleEvent={vi.fn()} campaignName="campaign-a" />
      );
      render(
        <Subscriber handleEvent={vi.fn()} campaignName="campaign-b" />
      );

      const [sourceA, sourceB] = eventSources;
      unmount();

      expect(sourceA.closed).toBe(true);
      expect(sourceB.closed).toBe(false);

      // The surviving campaign still receives its events.
      const handlerB = vi.fn();
      render(
        <Subscriber handleEvent={handlerB} campaignName="campaign-b" />
      );
      expect(eventSources).toHaveLength(2); // reuses the open connection
      const event = { key: 'still-live' };
      sourceB.emit(event);
      expect(handlerB).toHaveBeenCalledWith(event);
    });
  });

  describe('event delivery', () => {
    it('passes parsed event data to handleEvent', () => {
      const handleEvent = vi.fn();
      render(
        <Subscriber handleEvent={handleEvent} campaignName="test-campaign" />
      );

      const event = { key: 'some-event', data: { text: 'hello' } };
      eventSources[0].emit(event);

      expect(handleEvent).toHaveBeenCalledTimes(1);
      expect(handleEvent).toHaveBeenCalledWith(event);
    });

    it('delivers each campaign events only to that campaign subscribers', () => {
      const handlerA = vi.fn();
      const handlerB = vi.fn();

      render(
        <Subscriber handleEvent={handlerA} campaignName="campaign-a" />
      );
      render(
        <Subscriber handleEvent={handlerB} campaignName="campaign-b" />
      );

      const [sourceA, sourceB] = eventSources;

      const eventA = { key: 'event-a', data: 1 };
      sourceA.emit(eventA);
      expect(handlerA).toHaveBeenCalledWith(eventA);
      expect(handlerB).not.toHaveBeenCalled();

      const eventB = { key: 'event-b', data: 2 };
      sourceB.emit(eventB);
      expect(handlerB).toHaveBeenCalledWith(eventB);
      expect(handlerA).toHaveBeenCalledTimes(1); // not re-delivered
    });

    it('broadcasts one event to every handler on the shared connection', () => {
      const handlerA = vi.fn();
      const handlerB = vi.fn();

      render(
        <Subscriber handleEvent={handlerA} campaignName="test-campaign" />
      );
      render(
        <Subscriber handleEvent={handlerB} campaignName="test-campaign" />
      );

      const event = { key: 'broadcast', data: 42 };
      eventSources[0].emit(event);

      expect(handlerA).toHaveBeenCalledWith(event);
      expect(handlerB).toHaveBeenCalledWith(event);
    });

    it('stops delivering events to a subscriber after it unmounts', () => {
      const handleEvent = vi.fn();
      const { unmount } = render(
        <Subscriber handleEvent={handleEvent} campaignName="test-campaign" />
      );

      eventSources[0].emit({ key: 'before' });
      expect(handleEvent).toHaveBeenCalledTimes(1);

      unmount();

      eventSources[0].emit({ key: 'after' });
      expect(handleEvent).toHaveBeenCalledTimes(1);
    });

    it('ignores malformed JSON without closing the connection', () => {
      const handleEvent = vi.fn();
      render(
        <Subscriber handleEvent={handleEvent} campaignName="test-campaign" />
      );

      eventSources[0].emitRaw('not json');
      expect(handleEvent).not.toHaveBeenCalled();

      // The connection survives a bad frame: later events still flow.
      const event = { key: 'valid', data: 1 };
      eventSources[0].emit(event);
      expect(handleEvent).toHaveBeenCalledWith(event);
    });

    it('keeps delivering to other subscribers when one handler throws', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const throwingHandler = vi.fn(() => {
        throw new Error('handler error');
      });
      const healthyHandler = vi.fn();

      render(
        <Subscriber handleEvent={throwingHandler} campaignName="test-campaign" />
      );
      render(
        <Subscriber handleEvent={healthyHandler} campaignName="test-campaign" />
      );

      const event = { key: 'test', data: 1 };
      eventSources[0].emit(event);

      expect(throwingHandler).toHaveBeenCalledWith(event);
      expect(healthyHandler).toHaveBeenCalledWith(event);
      // The failure is surfaced, not silently swallowed.
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('latest handleEvent always wins', () => {
    it('calls the newest handleEvent after a prop change without reopening the connection', () => {
      // Subscribers re-render constantly; the component must swap handlers
      // in place rather than churn subscriptions.
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      const { rerender } = render(
        <Subscriber handleEvent={firstHandler} campaignName="test-campaign" />
      );
      rerender(<Subscriber handleEvent={secondHandler} campaignName="test-campaign" />);

      expect(eventSources).toHaveLength(1); // no reconnect on handler change

      const event = { key: 'test' };
      eventSources[0].emit(event);

      expect(secondHandler).toHaveBeenCalledWith(event);
      expect(firstHandler).not.toHaveBeenCalled();
    });
  });
});
