// Missing-campaign-folder READ guard (backlog 2026-11-03 CL: deleted-campaign
// ghost APIs).
//
// After a campaign folder is deleted, every campaign-scoped GET used to
// answer 200 with synthesized defaults (`/meta` → {type:"standard"},
// `/change-data` → {}, `/log` → [], entity lanes → {x:[]}) — bookmarks and
// stale tabs could not distinguish "campaign is gone" from "campaign is
// empty", and the entity CRUD lanes even RE-MATERIALIZED the deleted folder
// by writing empty JSON files on a plain read (live-proven 2026-11-03:
// GET /<deleted>/npcs recreated data/npcs.json).
//
// The discriminator is FOLDER EXISTENCE under public/campaigns/:
//   • folder missing        → 404 { error: 'Campaign not found' } (the shape
//                             DELETE/rename/admin routes already speak)
//   • folder exists, empty  → the routes' honest 200 defaults, unchanged
//
// Mounted in server.js as one app-level guard BEFORE every campaign router
// (same placement doctrine as noStoreCampaignGets / campaignLock phase 1) so
// the whole read family is covered by one mechanism instead of per-route
// checks. GET/HEAD only: write routes (POST/PUT/PATCH/DELETE) and the SSE
// lane (/subscribe, outside this prefix) keep byte-identical behavior.
//
// The invalid-name face ('undefined'/'null' client bugs) keeps its existing
// 400 precedence: this guard answers it FIRST (mirroring the
// campaigns-changedata middleware) so no ghost lane can 404-or-200 a request
// that today fails loudly with an audit line.
import fs from 'fs';
import { campaignDir } from './campaignPaths.js';

const CAMPAIGNS_PREFIX = '/api/campaigns';
const READ_METHODS = ['GET', 'HEAD'];

// Client-side bugs leak the literal strings "undefined"/"null" into the
// campaign segment. Shared by the guard below and the campaigns-changedata
// router middleware so both 400 faces check one source of truth.
export function isInvalidCampaignName(name) {
    return name === 'undefined' || name === 'null';
}

// Folder existence is the gone/empty discriminator. campaignDir resolves
// within public/campaigns (mirrors the same-existence checks in
// campaigns-admin delete/rename and the log phantom-persistence guard).
export function campaignFolderExists(campaign) {
    try {
        return fs.existsSync(campaignDir(campaign));
    } catch {
        return false;
    }
}

export function createMissingCampaignFolderGuard() {
    return (req, res, next) => {
        if (!READ_METHODS.includes(req.method)) return next();
        // Only campaign-SCOPED reads; the bare collection route (GET
        // /api/campaigns, no name segment) lists whatever folders exist.
        if (!req.path.startsWith(`${CAMPAIGNS_PREFIX}/`)) return next();
        const segment = req.path.slice(CAMPAIGNS_PREFIX.length + 1).split('/')[0];
        let campaign;
        try {
            campaign = decodeURIComponent(segment);
        } catch {
            // Malformed percent-encoding: let the routers produce their own
            // honest answer, exactly as before this guard existed.
            return next();
        }
        if (!campaign) return next();
        if (isInvalidCampaignName(campaign)) {
            console.error('Rejecting request for invalid campaign name', { campaign, url: req.originalUrl, ip: req.ip });
            return res.status(400).json({ error: 'Invalid campaign name' });
        }
        if (campaignFolderExists(campaign)) return next();
        console.error(`[campaign-read] 404 ${req.method} ${req.originalUrl} — no campaign folder "${campaign}"`);
        return res.status(404).json({ error: 'Campaign not found' });
    };
}
