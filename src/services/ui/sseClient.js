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

// Benign-error severity policy (console must stay a clean error signal):
// EventSource auto-reconnects natively, so a page reload / tab-close / brief dev
// restart fires the error handler while readyState is still CONNECTING. Those
// transient rows log at console.debug; only after this many CONSECUTIVE
// reconnecting errors (API persistently unreachable under a live tab — native
// retries keep failing) does the lane escalate to console.error. A CLOSED
// source never retries, so its error is always loud. Any open/message resets
// the streak. No timers: counting is driven purely by native EventSource events.
const RECONNECT_ERROR_ESCALATION = 3;

// Browser-driven teardown flag: during unload (reload/tab-close) EventSource
// fires a final benign error row — keep it at debug no matter the streak.
// Stamped on `beforeunload` TOO (not just `pagehide`): on CDP-driven navigations
// the final EventSource error can land AFTER pagehide but always after
// beforeunload, so the earlier of the two unload signals wins the race. Both are
// one-way unload signals — once the browser starts tearing the document down it
// never aborts to a live page in our browsers, so latching is safe (2026-11-22
// improve sse-unload-race-console-hygiene). Hidden-ness is deliberately NOT
// latched here: a backgrounded tab returns to the foreground, so
// document.visibilityState is READ AT ERROR TIME inside onerror instead.
let pageUnloading = false;
const markPageUnloading = () => {
    pageUnloading = true;
};
window.addEventListener('beforeunload', markPageUnloading);
window.addEventListener('pagehide', markPageUnloading);

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
        entry = { eventSource, handlers: new Set(), consecutiveErrors: 0, clientId: null };
        entry.eventSource.onopen = () => {
            entry.consecutiveErrors = 0;
        };
        // Named 'client-id' event (server/routes/sse.js): the hub stamps each
        // connection with its own id on connect (and again after a native
        // reconnect, which re-registers under a fresh id). GM-side "who else
        // is connected" lanes pass this as `exclude` so a tab never counts
        // itself. addEventListener (not onmessage): named events never reach
        // the default onmessage slot, so existing fan-out is untouched.
        entry.eventSource.addEventListener('client-id', (e) => {
            try {
                entry.clientId = JSON.parse(e.data).clientId || null;
            } catch (_parseErr) {
                console.debug('[SSE] malformed client-id event', e.data);
            }
        });
        entry.eventSource.onmessage = (e) => {
            let event;
            try {
                event = JSON.parse(e.data);
            } catch (_parseErr) {
                return;
            }
            entry.consecutiveErrors = 0;
            entry.handlers.forEach(handler => {
                try {
                    handler(event);
                } catch (_handlerErr) {
                    console.error('[SSE] handler error:', _handlerErr);
                }
            });
        };
        entry.eventSource.onerror = (err) => {
            const reconnecting = eventSource.readyState === EventSource.CONNECTING;
            if (reconnecting) {
                entry.consecutiveErrors += 1;
            }
            // Hidden-ness is read HERE, at error time — never latched — so a tab
            // that backgrounds and returns keeps its future visible-tab escalation.
            const benign = reconnecting
                && (pageUnloading
                    || document.visibilityState === 'hidden'
                    || entry.consecutiveErrors < RECONNECT_ERROR_ESCALATION);
            if (benign) {
                console.debug('[SSE] connection error — reconnecting', err);
            } else {
                console.error('[SSE] connection error', err);
            }
        };
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

// Hub-issued client id of THIS tab's shared connection to a campaign, or
// null while no connection is open / the stamp has not arrived yet.
export const getOwnSseClientId = (campaignName) =>
    sources.get(campaignName || '')?.clientId || null;

// Test helper — closes and forgets all shared connections.
export const resetSSEClient = () => {
    sources.forEach(entry => entry.eventSource.close());
    sources.clear();
};

