// Campaign lockdown middleware, split into two phases that server.js
// mounts around the global express.json() parser:
//
// 1. createCampaignLockMiddleware — mounted BEFORE body parsing: rejects
//    every mutating /api/campaigns/* request whose first path segment is
//    not the locked campaign, without ever reading the request body (so
//    off-target requests, incl. large multer uploads, are refused before
//    any parsing cost).
// 2. createCampaignRenameGuard — mounted AFTER body parsing: closes the
//    one campaign mutation whose identity does NOT live in the path —
//    PUT /api/campaigns/:campaign renames the folder to req.body.newName.
//    While locked, a rename of the locked campaign whose trimmed newName
//    decodes to anything other than the locked name itself (a no-op) gets
//    the same 403 + `[campaign-lock] BLOCKED …` log line, so the folder is
//    never renamed out from under the lock (live incident 2026-10-28:
//    test-campaign → zz slipped past phase 1, which only saw the source).
//
// `campaignLock` is the already-decoded lock name (null when unlocked) —
// env parsing stays a single source of truth in server.js. Unset = both
// phases are pure passthrough (normal use, no behavior change).

const CAMPAIGNS_PREFIX = '/api/campaigns';
const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

function blockRequest(req, res, campaignLock) {
    console.error(`[campaign-lock] BLOCKED ${req.method} ${req.path} (locked to "${campaignLock}")`);
    return res.status(403).json({ error: `Campaign locked to "${campaignLock}" — ${req.method} ${req.path} denied` });
}

// Describe a campaign-scoped request path the same way for both phases:
// `target` is the decoded first segment after /api/campaigns (the campaign
// the request operates on), and `exact` is true only when that segment is
// the whole path — i.e. a campaign-level route (rename/delete) rather than
// a nested data write under the campaign. Returns null for non-campaign
// paths.
function describeCampaignPath(req) {
    if (!req.path.startsWith(CAMPAIGNS_PREFIX)) return null;
    const rest = req.path.slice(CAMPAIGNS_PREFIX.length).replace(/^\//, '');
    const segment = rest.split('/')[0];
    if (!segment) return { target: '', exact: false };
    const remainder = rest.slice(segment.length);
    return {
        target: decodeURIComponent(segment),
        // Express (non-strict routing) matches a trailing slash on the
        // campaign-level route too, so treat it as the same shape.
        exact: remainder === '' || remainder === '/'
    };
}

export function createCampaignLockMiddleware(campaignLock) {
    return (req, res, next) => {
        if (!campaignLock) return next();
        if (READ_METHODS.includes(req.method)) return next();
        const scoped = describeCampaignPath(req);
        if (!scoped) return next();
        if (scoped.target === campaignLock) return next();
        return blockRequest(req, res, campaignLock);
    };
}

export function createCampaignRenameGuard(campaignLock) {
    return (req, res, next) => {
        if (!campaignLock) return next();
        if (req.method !== 'PUT') return next();
        const scoped = describeCampaignPath(req);
        // Only the exact campaign-level PUT onto the locked campaign can
        // rename its folder; off-target PUTs were already 403'd by phase 1,
        // and nested data writes never move the folder.
        if (!scoped || !scoped.exact || scoped.target !== campaignLock) return next();
        const newName = req.body && typeof req.body.newName === 'string' ? req.body.newName : null;
        if (newName !== null && newName.trim() !== campaignLock) {
            return blockRequest(req, res, campaignLock);
        }
        // No-op rename (newName === lock) and non-rename PUTs reach the route.
        return next();
    };
}
