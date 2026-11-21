/**
 * Shared GM-origin guard (campaign log author gate, 2026-11-21).
 *
 * GM identity in this app is origin-based, never session-based: a request is
 * the GM iff its Host header names the machine the server runs on. This is
 * the exact predicate already proven per-route (maps.js `isLocalhost`, the
 * quests/notes/settlements `refuseUnlessGm` wrappers); those copies stay
 * untouched — this module is the canonical home for NEW gates and the census
 * includes `::1` (the ai-key.js face) so an IPv6 loopback tab is honestly GM.
 *
 * Follows req.hostname, NOT req.ip: the Vite dev proxy keeps the real Host
 * header (`changeOrigin: false`), so a LAN tab browsing http://<en0-ip>:5173
 * is honestly a visitor even though the socket peer is the proxy on loopback.
 */
export function isLocalhost(req) {
    const host = req.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}
