// Shared singleton SSE client.
//
// Previously every Subscriber/useLog instance opened its own EventSource. With
// several mounted at once the browser's ~6-connection-per-host limit was
// reached, so normal fetch() calls (e.g. map create/delete) could not get a
// connection slot — they sat as pending spinners and eventually failed with
// "Load failed" in production, where /api and /subscribe share one origin and
// one connection pool. This module opens ONE EventSource per campaign and
// fans every event out to all subscribed handlers.

const sources = new Map();

export const subscribeToSSE = (campaignName, handler) => {
    const key = campaignName || '';
    let entry = sources.get(key);
    if (!entry) {
        const urlParams = new URLSearchParams();
        if (campaignName) {
            urlParams.set('campaign', campaignName);
        }
        const url = `http://${window.location.hostname}/subscribe?${urlParams.toString()}`;
        const eventSource = new EventSource(url);
        entry = { eventSource, handlers: new Set() };
        entry.eventSource.onmessage = (e) => {
            let event;
            try {
                event = JSON.parse(e.data);
            } catch (_parseErr) {
                return;
            }
            entry.handlers.forEach(handler => {
                try {
                    handler(event);
                } catch (_handlerErr) {
                    console.error('[SSE] handler error:', _handlerErr);
                }
            });
        };
        entry.eventSource.onerror = (err) => console.error('[SSE] connection error', err);
        sources.set(key, entry);
    }
    entry.handlers.add(handler);
    return () => {
        entry.handlers.delete(handler);
        if (entry.handlers.size === 0) {
            entry.eventSource.close();
            sources.delete(key);
        }
    };
};

// Test helper — closes and forgets all shared connections.
export const resetSSEClient = () => {
    sources.forEach(entry => entry.eventSource.close());
    sources.clear();
};

