import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Subscriber from './Subscriber.jsx';

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
    static getInstance(url) {
        return this.instances.find(i => i.url === url);
    }
}

describe('Subscriber', () => {
    let handleEventMock;

    beforeEach(() => {
        MockEventSource.instances = [];
        handleEventMock = vi.fn();

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

    it('should create an EventSource with the correct URL', () => {
        render(<Subscriber handleEvent={handleEventMock} campaignName="Test Campaign" />);

        const instance = MockEventSource.getInstance('http://localhost/subscribe?campaign=Test%20Campaign');
        expect(instance).toBeDefined();
      });

    it('should call handleEvent when a message is received', async () => {
        render(<Subscriber handleEvent={handleEventMock} campaignName="Test Campaign" />);

        const instance = MockEventSource.getInstance('http://localhost/subscribe?campaign=Test%20Campaign');
        instance.onmessage({ data: JSON.stringify({ type: 'test', payload: 'data' }) });

        expect(handleEventMock).toHaveBeenCalledWith({ type: 'test', payload: 'data' });
      });

    it('should close the EventSource on unmount', async () => {
        const { unmount } = render(<Subscriber handleEvent={handleEventMock} campaignName="Test Campaign" />);

        const instance = MockEventSource.getInstance('http://localhost/subscribe?campaign=Test%20Campaign');
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

        const instance = MockEventSource.getInstance('http://localhost/subscribe?campaign=Test%20Campaign');
        instance.onmessage({ data: JSON.stringify({ type: 'message1' }) });
        instance.onmessage({ data: JSON.stringify({ type: 'message2' }) });
        instance.onmessage({ data: JSON.stringify({ type: 'message3' }) });

        expect(handleEventMock).toHaveBeenCalledTimes(3);
        expect(handleEventMock).toHaveBeenCalledWith({ type: 'message1' });
        expect(handleEventMock).toHaveBeenCalledWith({ type: 'message2' });
        expect(handleEventMock).toHaveBeenCalledWith({ type: 'message3' });
      });

    it('should create an absolute URL using the hostname', () => {
        Object.defineProperty(window, 'location', {
            value: { hostname: 'example.com' },
            writable: true,
            configurable: true
        });

        render(<Subscriber handleEvent={handleEventMock} campaignName="Test Campaign" />);

        const instance = MockEventSource.getInstance('http://example.com/subscribe?campaign=Test%20Campaign');
        expect(instance).toBeDefined();
      });

    it('should URL-encode the campaign name', () => {
        Object.defineProperty(window, 'location', {
            value: { hostname: 'localhost' },
            writable: true,
            configurable: true
        });

        render(<Subscriber handleEvent={handleEventMock} campaignName="General Testing" />);

        const instance = MockEventSource.getInstance('http://localhost/subscribe?campaign=General%20Testing');
        expect(instance).toBeDefined();
      });

    it('should work without campaignName', () => {
        Object.defineProperty(window, 'location', {
            value: { hostname: 'localhost' },
            writable: true,
            configurable: true
        });

        render(<Subscriber handleEvent={handleEventMock} />);

        const instance = MockEventSource.getInstance('http://localhost/subscribe');
        expect(instance).toBeDefined();
      });
});
