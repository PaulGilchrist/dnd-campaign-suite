// Regression lock for bug-vite-proxy-localhost-guard-bypass — the dev-proxy
// half of the fix. Every server-side GM guard reads req.hostname, so the
// vite dev proxy MUST forward the client's honest Host: changeOrigin on the
// /api|/subscribe|/spell-overlay lanes must never be true again (true rewrote
// Host to localhost:80, making every LAN :5173 client the GM server-side).
// This pins the config contract so a future "shortcut" re-enabling
// changeOrigin fails CI instead of silently leaking GM data again.
import { describe, it, expect } from 'vitest';
import viteConfig from './vite.config.js';

const PROXIED_LANES = ['/api', '/subscribe', '/spell-overlay'];

async function resolve() {
    return typeof viteConfig === 'function'
        ? await viteConfig({ command: 'serve', mode: 'development' })
        : viteConfig;
}

describe('vite.config dev proxy — honest Host forwarding', () => {
    it.each(PROXIED_LANES)(
        '%s proxy targets Express :80 and never rewrites the Host header',
        async (lane) => {
            const config = await resolve();
            const entry = config.server.proxy[lane];

            expect(entry, `proxy lane ${lane} must exist`).toBeTruthy();
            expect(entry.target).toBe('http://localhost:80');
            // changeOrigin:true here defeats EVERY isLocalhost(req) guard in
            // server/routes/* and keyValidators.validateAuthority.
            expect(entry.changeOrigin).not.toBe(true);
        }
    );
});
