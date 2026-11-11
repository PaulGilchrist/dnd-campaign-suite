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
//    While locked, only two rename shapes reach the route: a no-op
//    (newName === source) and a member-to-member hop of a set-form lock —
//    the source must be a non-primary allowlist entry (never the
//    harness's own campaign) and the trimmed newName must also be an
//    allowlist member. Everything else gets the same 403 + `[campaign-lock]
//    BLOCKED …` log line, so the folder is never renamed out from under the
//    lock (live incident 2026-10-28: test-campaign → zz slipped past phase 1,
//    which only saw the source).
//
// `campaignLock` is the already-decoded lock name (null when unlocked) —
// env parsing stays a single source of truth in server.js. Unset = both
// phases are pure passthrough (normal use, no behavior change).

const CAMPAIGNS_PREFIX = '/api/campaigns';
const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// Parse the decoded lock string into the set of allowed campaign names.
// Backwards compatible: a single name yields ["name"] and every membership
// test collapses to the original `target === campaignLock` behavior. A
// comma-separated list (e.g. "test-campaign,qa-arena,qa-starter") additionally
// permits writes to the extra throwaway campaigns — used for Arena/Starter
// verification — while still denying every production campaign and any other
// name. Blank entries are dropped; an all-blank/empty lock is treated as
// unlocked (null). Exported so the spell-overlay lane and tests share one parse.
export function parseCampaignLock(campaignLock) {
    if (!campaignLock) return null;
    const names = String(campaignLock)
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);
    return names.length ? names : null;
}

// Is `target` one of the permitted campaign names for this lock string?
function isAllowed(campaignLock, target) {
    const names = parseCampaignLock(campaignLock);
    return !!names && names.includes(target);
}

// Public membership check for out-of-namespace enforcement (the /spell-overlay
// transport takes its campaign as a query param and cannot see the path). A
// null/empty lock returns false — callers must guard on "is locked" themselves.
export function campaignLockAllows(campaignLock, target) {
    return isAllowed(campaignLock, target);
}

// The decoded lock name, kept here as the runtime single source of truth so
// routes OUTSIDE the /api/campaigns path namespace (e.g. the /spell-overlay
// transport, which takes its campaign as a query param the path-based phase-1
// middleware can never see) can apply the same rule. server.js sets it once
// at boot from its env parse; null when unlocked.
let activeCampaignLock = null;

export function setCampaignLock(campaignLock) {
    activeCampaignLock = campaignLock || null;
}

export function getCampaignLock() {
    return activeCampaignLock;
}

// Membership test against the ACTIVE lock (the runtime single source of
// truth). Lets out-of-namespace routes enforce the same rule without threading
// the lock string through. Not-locked (null active lock) → false.
export function activeCampaignLockAllows(campaign) {
    return isAllowed(activeCampaignLock, campaign);
}

// Canonical refusal shared by every lock enforcement point: one stderr
// audit line + the 403 JSON shape clients already see from /api/campaigns.
// `errorMessage` optionally replaces the generic body with a lane-specific
// plain-English message (the create guard names the refused campaign so the
// quick-create modal can explain the denial inline); the audit line is
// identical either way.
export function blockRequest(req, res, campaignLock, errorMessage) {
    console.error(`[campaign-lock] BLOCKED ${req.method} ${req.path} (locked to "${campaignLock}")`);
    return res.status(403).json({ error: errorMessage || `Campaign locked to "${campaignLock}" — ${req.method} ${req.path} denied` });
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
        // A named target that is a permitted campaign of this lock writes freely.
        if (isAllowed(campaignLock, scoped.target)) return next();
        // The bare collection route (POST /api/campaigns, no name segment) carries
        // the new campaign name in the body — invisible to this pre-parse phase —
        // so defer it to createCampaignCreateGuard (mounted after express.json).
        if (scoped.target === '') return next();
        return blockRequest(req, res, campaignLock);
    };
}

// Body-aware creation gate (mounted AFTER express.json). While locked, a new
// campaign may be created ONLY when its name is an explicit member of the lock
// set (e.g. the qa-arena / qa-starter throwaways) — production names and any
// other name are refused with the shared [campaign-lock] audit line. A single-
// name lock therefore can never create (its only member already exists); the
// set form is what makes throwaway creation possible without loosening safety.
export function createCampaignCreateGuard(campaignLock) {
    return (req, res, next) => {
        if (!campaignLock) return next();
        if (req.method !== 'POST') return next();
        if (req.path !== CAMPAIGNS_PREFIX && req.path !== `${CAMPAIGNS_PREFIX}/`) return next();
        const names = parseCampaignLock(campaignLock);
        const campaignName = req.body && typeof req.body.campaignName === 'string'
            ? req.body.campaignName.trim()
            : null;
        if (campaignName && names.includes(campaignName)) return next();
        // Plain-English body naming the refused campaign: the quick-create
        // modal renders this inline (message + preserved input) instead of
        // the client replacing the app with a full-page error (backlog
        // 2026-11-11 LZ). Same 403 + [campaign-lock] audit line as every
        // other enforcement point.
        const attempted = campaignName ? ` named "${campaignName}"` : '';
        return blockRequest(
            req,
            res,
            campaignLock,
            `Campaign locked to "${campaignLock}" — a new campaign${attempted} cannot be created `
            + `while locked. Only these campaign names are allowed: ${names.join(', ')}.`
        );
    };
}

export function createCampaignRenameGuard(campaignLock) {
    return (req, res, next) => {
        if (!campaignLock) return next();
        if (req.method !== 'PUT') return next();
        const scoped = describeCampaignPath(req);
        const names = parseCampaignLock(campaignLock);
        // Only the exact campaign-level PUT onto a permitted campaign can rename
        // its folder; off-target PUTs were already 403'd by phase 1, and nested
        // data writes never move the folder.
        if (!scoped || !scoped.exact || !names.includes(scoped.target)) return next();
        const newName = req.body && typeof req.body.newName === 'string' ? req.body.newName.trim() : null;
        // No-op rename (newName === source) and non-rename PUTs reach the route.
        if (newName === null || newName === scoped.target) return next();
        // A real rename is permitted only between two THROWAWAY members (the
        // primary/first lock entry — the harness's own campaign — is never
        // renamable, closing the 2026-10-28 test-campaign → zz incident, and
        // a throwaway can never be renamed out to a production or new name).
        if (scoped.target !== names[0] && names.includes(newName)) return next();
        return blockRequest(req, res, campaignLock);
    };
}
