/* @improved-by-ai */
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Subscriber from './Subscriber.jsx';

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

    static reset() {
        this.instances = [];
    }
}

function urlWithCampaign(campaignName) {
    const params = new URLSearchParams();
    if (campaignName) params.set('campaign', campaignName);
    return `http://localhost/subscribe?${params.toString()}`;
}

describe('Subscriber', () => {
    let handleEventMock;
    let originalHostname;

    beforeEach(() => {
        MockEventSource.reset();
        handleEventMock = vi.fn();

        originalHostname = window.location.hostname;
        Object.defineProperty(window, 'location', {
            value: { hostname: 'localhost' },
            writable: true,
            configurable: true,
        });

        global.EventSource = class extends MockEventSource {
            constructor(url) {
                super(url);
                MockEventSource.instances.push(this);
            }
        };
    });

    afterEach(() => {
        cleanup();
        MockEventSource.reset();

        if (originalHostname !== undefined) {
            Object.defineProperty(window, 'location', {
                value: { hostname: originalHostname },
                writable: true,
                configurable: true,
            });
        }

        delete global.EventSource;
    });

    it('should create an EventSource with the correct URL', () => {
        render(<Subscriber handleEvent={handleEventMock} campaignName="Test Campaign" />);

        const instance = MockEventSource.getInstance(urlWithCampaign('Test Campaign'));
        expect(instance).toBeDefined();
    });

    it('should call handleEvent when a message is received', () => {
        render(<Subscriber handleEvent={handleEventMock} campaignName="Test Campaign" />);

        const instance = MockEventSource.getInstance(urlWithCampaign('Test Campaign'));
        instance.onmessage({ data: JSON.stringify({ type: 'test', payload: 'data' }) });

        expect(handleEventMock).toHaveBeenCalledWith({ type: 'test', payload: 'data' });
    });

    it('should close the EventSource on unmount', () => {
        const { unmount } = render(<Subscriber handleEvent={handleEventMock} campaignName="Test Campaign" />);

        const instance = MockEventSource.getInstance(urlWithCampaign('Test Campaign'));
        expect(instance.closed).toBe(false);

        unmount();

        expect(instance.closed).toBe(true);
    });

    it('should not render any visible content', () => {
        const { container } = render(<Subscriber handleEvent={handleEventMock} campaignName="Test Campaign" />);

        expect(container.innerHTML).toBe('');
    });

    it('should handle multiple messages', () => {
        render(<Subscriber handleEvent={handleEventMock} campaignName="Test Campaign" />);

        const instance = MockEventSource.getInstance(urlWithCampaign('Test Campaign'));
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
            configurable: true,
        });

        render(<Subscriber handleEvent={handleEventMock} campaignName="Test Campaign" />);

        const instance = MockEventSource.getInstance(i => i.url.startsWith('http://example.com/subscribe?'));
        expect(instance).toBeDefined();
    });

    it('should URL-encode the campaign name', () => {
        render(<Subscriber handleEvent={handleEventMock} campaignName="General Testing" />);

        const instance = MockEventSource.getInstance(urlWithCampaign('General Testing'));
        expect(instance).toBeDefined();
    });

    it('should work without campaignName', () => {
        render(<Subscriber handleEvent={handleEventMock} />);

        const instance = MockEventSource.getInstance(urlWithCampaign());
        expect(instance).toBeDefined();
    });

    it('should throw when onmessage receives invalid JSON', () => {
        render(<Subscriber handleEvent={handleEventMock} campaignName="Test Campaign" />);

        const instance = MockEventSource.getInstance(urlWithCampaign('Test Campaign'));

        expect(() => {
            instance.onmessage({ data: 'not json' });
        }).toThrow(SyntaxError);
    });

    it('should call handleEvent with parsed event data containing key field', () => {
        render(<Subscriber handleEvent={handleEventMock} campaignName="Test Campaign" />);

        const instance = MockEventSource.getInstance(urlWithCampaign('Test Campaign'));
        instance.onmessage({ data: JSON.stringify({ key: 'spell-overlay', overlay: 'invisibility' }) });

        expect(handleEventMock).toHaveBeenCalledWith({ key: 'spell-overlay', overlay: 'invisibility' });
    });

    it('should use ref to always call the latest handleEvent', () => {
        const { rerender } = render(<Subscriber handleEvent={handleEventMock} campaignName="Test Campaign" />);

        const instance = MockEventSource.getInstance(urlWithCampaign('Test Campaign'));
        handleEventMock.mockReturnValue(undefined);

        const newHandleEvent = vi.fn();
        rerender(<Subscriber handleEvent={newHandleEvent} campaignName="Test Campaign" />);

        instance.onmessage({ data: JSON.stringify({ type: 'updated' }) });

        expect(newHandleEvent).toHaveBeenCalledWith({ type: 'updated' });
        expect(handleEventMock).not.toHaveBeenCalledWith({ type: 'updated' });
    });

    it('should create separate EventSource instances for different campaign names', () => {
        render(
            <>
                <Subscriber handleEvent={handleEventMock} campaignName="Campaign A" />
                <Subscriber handleEvent={handleEventMock} campaignName="Campaign B" />
            </>
        );

        const instanceA = MockEventSource.getInstance(urlWithCampaign('Campaign A'));
        const instanceB = MockEventSource.getInstance(urlWithCampaign('Campaign B'));

        expect(instanceA).toBeDefined();
        expect(instanceB).toBeDefined();
        expect(instanceA).not.toBe(instanceB);
    });

    it('should not include campaign query param when campaignName is omitted', () => {
        render(<Subscriber handleEvent={handleEventMock} />);

        const instance = MockEventSource.getInstance(urlWithCampaign());
        expect(instance.url).toBe('http://localhost/subscribe?');
    });

    it('should include campaign query param when campaignName is provided', () => {
        render(<Subscriber handleEvent={handleEventMock} campaignName="Dungeon Master" />);

        const instance = MockEventSource.getInstance(urlWithCampaign('Dungeon Master'));
        expect(instance.url).toBe('http://localhost/subscribe?campaign=Dungeon+Master');
    });

    it('should handle empty campaign name string', () => {
        render(<Subscriber handleEvent={handleEventMock} campaignName="" />);

        const instance = MockEventSource.getInstance(urlWithCampaign(''));
        expect(instance).toBeDefined();
        expect(instance.url).toBe('http://localhost/subscribe?');
    });
});
