// @maintained-by-ai
// Unit-canonical home for src/services/ui/sseClient.js — REAL module, never mocked here.
// Contract: ONE shared EventSource per campaign, fan-out to all handlers, native
// EventSource auto-reconnect (NO hand-rolled reconnect loops, NO timers — every
// branch below is driven by directly invoking the on* slots of a mocked
// EventSource). Severity law (2026-11-11 improve sse-console-cleanliness):
// error events while readyState===CONNECTING are the BENIGN reconnect face —
// logged at console.debug until RECONNECT_ERROR_ESCALATION (3) consecutive
// failures prove the API is persistently unreachable under a live tab, then
// console.error. readyState===CLOSED (native retry definitively over) is always
// console.error. A pagehide (reload/tab-close) pins the whole teardown face to
// debug. Successful open/message resets the streak.
// Each test re-imports the module fresh (vi.resetModules) so the module-level
// `pageUnloading` flag and `sources` pool never leak between faces.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock EventSource face: records instances, exposes readyState, and lets tests
// fire on* slots synchronously. Mirrors src/test/setup.js InertEventSource
// constants (CONNECTING 0 / OPEN 1 / CLOSED 2).
class MockEventSource {
    static instances = [];

    constructor(url) {
        this.url = url;
        this.readyState = MockEventSource.CONNECTING;
        MockEventSource.instances.push(this);
    }

    close() {
        this.readyState = MockEventSource.CLOSED;
    }

    addEventListener() {}
    removeEventListener() {}

    fireOpen() {
        if (this.onopen) this.onopen();
    }

    fireMessage(data) {
        if (this.onmessage) this.onmessage({ data });
    }

    fireError(error = new Error('mock connection error')) {
        if (this.onerror) this.onerror(error);
    }
}
MockEventSource.CONNECTING = 0;
MockEventSource.OPEN = 1;
MockEventSource.CLOSED = 2;

describe('sseClient', () => {
    let debugSpy;
    let errorSpy;

    // Fresh module instance per test: pageUnloading/sources are module state.
    async function freshImport() {
        vi.resetModules();
        return await import('./sseClient.js');
    }

    beforeEach(() => {
        MockEventSource.instances = [];
        vi.stubGlobal('EventSource', MockEventSource);
        debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    describe('shared pool (unchanged reconnection behavior)', () => {
        it('opens ONE EventSource per campaign and fans events to every handler', async () => {
            const { subscribeToSSE } = await freshImport();
            const h1 = vi.fn();
            const h2 = vi.fn();
            subscribeToSSE('test-campaign', h1);
            subscribeToSSE('test-campaign', h2);

            expect(MockEventSource.instances).toHaveLength(1);
            expect(MockEventSource.instances[0].url).toContain('/subscribe?campaign=test-campaign');

            MockEventSource.instances[0].fireMessage(JSON.stringify({ key: 'k', value: 1 }));
            expect(h1).toHaveBeenCalledWith({ key: 'k', value: 1 });
            expect(h2).toHaveBeenCalledWith({ key: 'k', value: 1 });
        });

        it('last unsubscribe closes the connection and forgets the campaign', async () => {
            const { subscribeToSSE } = await freshImport();
            const un1 = subscribeToSSE('test-campaign', vi.fn());
            const un2 = subscribeToSSE('test-campaign', vi.fn());
            const source = MockEventSource.instances[0];

            un1();
            expect(source.readyState).toBe(MockEventSource.CONNECTING); // still open for h2
            un2();
            expect(source.readyState).toBe(MockEventSource.CLOSED);

            // Re-subscribe after teardown creates a fresh connection.
            subscribeToSSE('test-campaign', vi.fn());
            expect(MockEventSource.instances).toHaveLength(2);
        });

        it('a throwing handler is logged loudly but never breaks sibling handlers', async () => {
            const { subscribeToSSE } = await freshImport();
            const bad = vi.fn(() => { throw new Error('handler boom'); });
            const good = vi.fn();
            subscribeToSSE('test-campaign', bad);
            subscribeToSSE('test-campaign', good);

            MockEventSource.instances[0].fireMessage(JSON.stringify({ key: 'k' }));
            expect(good).toHaveBeenCalled();
            expect(errorSpy).toHaveBeenCalledWith('[SSE] handler error:', expect.any(Error));
        });
    });

    describe('error severity branch', () => {
        it('CONNECTING error (reconnect in flight) logs console.debug, never console.error', async () => {
            const { subscribeToSSE } = await freshImport();
            subscribeToSSE('test-campaign', vi.fn());

            MockEventSource.instances[0].readyState = MockEventSource.CONNECTING;
            MockEventSource.instances[0].fireError();

            expect(debugSpy).toHaveBeenCalledWith(
                '[SSE] connection error — reconnecting',
                expect.any(Error)
            );
            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('1–2 consecutive transient errors stay debug; the 3rd escalates to console.error', async () => {
            const { subscribeToSSE } = await freshImport();
            subscribeToSSE('test-campaign', vi.fn());
            const source = MockEventSource.instances[0];
            source.readyState = MockEventSource.CONNECTING;

            source.fireError();
            source.fireError();
            expect(errorSpy).not.toHaveBeenCalled();
            expect(debugSpy).toHaveBeenCalledTimes(2);

            // 3rd consecutive reconnecting failure = persistently unreachable API.
            source.fireError();
            expect(errorSpy).toHaveBeenCalledWith('[SSE] connection error', expect.any(Error));
        });

        it('a successful open resets the streak so flapping never escalates', async () => {
            const { subscribeToSSE } = await freshImport();
            subscribeToSSE('test-campaign', vi.fn());
            const source = MockEventSource.instances[0];
            source.readyState = MockEventSource.CONNECTING;

            source.fireError();
            source.fireError();
            source.fireOpen();        // recovered
            source.fireError();
            source.fireError();
            expect(errorSpy).not.toHaveBeenCalled();

            // Received messages reset too (server replay flowing = healthy).
            source.fireOpen();
            source.fireError();
            source.fireError();
            source.fireMessage(JSON.stringify({ key: 'k' }));
            source.fireError();
            source.fireError();
            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('CLOSED error (native retry definitively over) is always console.error immediately', async () => {
            const { subscribeToSSE } = await freshImport();
            subscribeToSSE('test-campaign', vi.fn());
            const source = MockEventSource.instances[0];

            source.readyState = MockEventSource.CLOSED;
            source.fireError();

            expect(errorSpy).toHaveBeenCalledWith('[SSE] connection error', expect.any(Error));
            expect(debugSpy).not.toHaveBeenCalled();
        });

        it('pagehide (reload/tab-close teardown) pins even a mature error streak to debug', async () => {
            const { subscribeToSSE } = await freshImport();
            subscribeToSSE('test-campaign', vi.fn());
            const source = MockEventSource.instances[0];
            source.readyState = MockEventSource.CONNECTING;

            window.dispatchEvent(new Event('pagehide'));

            source.fireError();
            source.fireError();
            source.fireError();
            source.fireError();
            expect(errorSpy).not.toHaveBeenCalled();
            expect(debugSpy).toHaveBeenCalledTimes(4);
        });
    });
});
