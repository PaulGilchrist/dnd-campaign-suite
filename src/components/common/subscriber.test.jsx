import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Subscriber from './Subscriber.jsx';

vi.mock('../../utils/sseClientId.js', () => ({ default: 'test-client-id-123' }));

const CLIENT_ID = 'test-client-id-123';

// Mock EventSource
class MockEventSource {
    constructor(url) {
        this.url = url;
        this.onmessage = null;
        this.onerror = null;
        this.closed = false;
     }

    close() {
        this.closed = true;
     }

    static instances = [];
    static getInstance(matcher) {
        return matcher instanceof Function
            ? this.instances.find(matcher)
            : this.instances.find(i => i.url === matcher);
      }
}

function urlWithClientId(basePath, campaignName) {
    const params = new URLSearchParams({ clientId: CLIENT_ID });
    if (campaignName) params.set('campaign', campaignName);
    return `http://localhost/subscribe?${params.toString()}`;
   }

describe('Subscriber', () => {
    let handleEventMock;

    beforeEach(() => {
        MockEventSource.instances = [];
        handleEventMock = vi.fn();

         Object.defineProperty(window, 'location', {
            value: { hostname: 'localhost' },
            writable: true,
            configurable: true
         });

          // Mock EventSource globally
        global.EventSource = class extends MockEventSource {
            constructor(url) {
                super(url);
                MockEventSource.instances.push(this);
              }
         };
       });

    afterEach(() => {
          // Clean up any EventSource instances
        MockEventSource.instances.forEach(instance => {
            instance.close();
          });
        MockEventSource.instances = [];

          // Restore original EventSource if it existed
        delete global.EventSource;
       });

    it('should create an EventSource with the correct URL including clientId', () => {
        render(<Subscriber handleEvent={handleEventMock} campaignName="Test Campaign" />);

        const instance = MockEventSource.getInstance(urlWithClientId('/subscribe', 'Test Campaign'));
        expect(instance).toBeDefined();
       });

    it('should call handleEvent when a message is received', async () => {
        render(<Subscriber handleEvent={handleEventMock} campaignName="Test Campaign" />);

        const instance = MockEventSource.getInstance(urlWithClientId('/subscribe', 'Test Campaign'));
        instance.onmessage({ data: JSON.stringify({ type: 'test', payload: 'data', selfId: 'other-client' }) });

        expect(handleEventMock).toHaveBeenCalledWith({ type: 'test', payload: 'data', selfId: 'other-client' });
       });

    it('should skip messages that are self-echoes (selfId matches clientId)', async () => {
        render(<Subscriber handleEvent={handleEventMock} campaignName="Test Campaign" />);

        const instance = MockEventSource.getInstance(urlWithClientId('/subscribe', 'Test Campaign'));
        instance.onmessage({ data: JSON.stringify({ type: 'test', selfId: CLIENT_ID }) });

        expect(handleEventMock).not.toHaveBeenCalled();
       });

    it('should close the EventSource on unmount', async () => {
        const { unmount } = render(<Subscriber handleEvent={handleEventMock} campaignName="Test Campaign" />);

        const instance = MockEventSource.getInstance(urlWithClientId('/subscribe', 'Test Campaign'));
        expect(instance.closed).toBe(false);

        unmount();

        expect(instance.closed).toBe(true);
       });

    it('should not render any visible content', () => {
        const { container } = render(<Subscriber handleEvent={handleEventMock} campaignName="Test Campaign" />);

        expect(container.innerHTML).toBe('');
       });

    it('should handle multiple messages', async () => {
        render(<Subscriber handleEvent={handleEventMock} campaignName="Test Campaign" />);

        const instance = MockEventSource.getInstance(urlWithClientId('/subscribe', 'Test Campaign'));
        instance.onmessage({ data: JSON.stringify({ type: 'message1', selfId: 'other' }) });
        instance.onmessage({ data: JSON.stringify({ type: 'message2', selfId: 'other' }) });
        instance.onmessage({ data: JSON.stringify({ type: 'message3', selfId: 'other' }) });

        expect(handleEventMock).toHaveBeenCalledTimes(3);
        expect(handleEventMock).toHaveBeenCalledWith({ type: 'message1', selfId: 'other' });
        expect(handleEventMock).toHaveBeenCalledWith({ type: 'message2', selfId: 'other' });
        expect(handleEventMock).toHaveBeenCalledWith({ type: 'message3', selfId: 'other' });
       });

    it('should create an absolute URL using the hostname', () => {
        Object.defineProperty(window, 'location', {
            value: { hostname: 'example.com' },
            writable: true,
            configurable: true
          });

        render(<Subscriber handleEvent={handleEventMock} campaignName="Test Campaign" />);

        const instance = MockEventSource.getInstance(i => i.url.startsWith('http://example.com/subscribe?'));
        expect(instance).toBeDefined();
       });

    it('should URL-encode the campaign name', () => {
        render(<Subscriber handleEvent={handleEventMock} campaignName="General Testing" />);

        const instance = MockEventSource.getInstance(urlWithClientId('/subscribe', 'General Testing'));
        expect(instance).toBeDefined();
       });

    it('should work without campaignName', () => {
        render(<Subscriber handleEvent={handleEventMock} />);

        const instance = MockEventSource.getInstance(urlWithClientId('/subscribe'));
        expect(instance).toBeDefined();
       });
});
