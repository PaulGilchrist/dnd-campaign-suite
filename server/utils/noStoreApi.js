// Shared cache-control lane for route-served campaign JSON.
//
// The static servers in server.js already set `Cache-Control: no-store` on
// mutable public/ files, but the /api/campaigns/* JSON GETs (character files,
// campaign/file lists, and every campaign-scoped JSON route mounted after
// this middleware) shipped only a weak ETag with NO cache directive. Browsers
// then heuristically cache those responses: after deleting/renaming a
// character, ONE reload could resurrect the old entry as a sidebar phantom
// (run-Q observation). Mirror the static lane's directive centrally so the
// whole route-served campaign JSON family is covered by one mechanism.
//
// GET-only: POST/PUT/DELETE/PATCH responses stay byte-identical. The SSE lane
// (/subscribe) lives outside this path prefix and keeps its own `no-cache`.
export function noStoreCampaignGets(req, res, next) {
    if (req.method === 'GET') {
        res.setHeader('Cache-Control', 'no-store');
    }
    next();
}
