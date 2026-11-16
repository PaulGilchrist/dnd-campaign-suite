import fs from 'fs';
import { campaignDataFile, ensureDataDir } from '../utils/campaignPaths.js';
import asyncHandler from '../utils/asyncHandler.js';
import { isLocalHost } from '../utils/jsonEntityCrud.js';
import { publish } from '../utils/changeData.js';
import { Router } from 'express';

// ---------------------------------------------------------------------------
// Campaign-type metadata (data/campaign-meta.json).
//
// Quick-create presets (Arena/Starter) must stay visually distinct from
// standard campaigns AFTER creation, so the type is recorded once at seed
// time and read cheaply by the campaign list + selection screens.
//
// The meta file is the ONLY type channel: every campaign folder carries one
// (the four shipped campaigns were stamped in-disk by the no-legacy sweep
// 2026-11-16, which retired the older starter-seed-existence inference).
// A missing/corrupt file — e.g. a standard campaign created before its meta
// write lands — resolves to the plain default 'standard'.
//
// GET stays open (every tab, LAN included, needs the badge); PUT is GM-only
// (localhost), mirroring the starter-seed doctrine. Missing/corrupt files
// never 500 — the lane always answers a type.
//
// Mounted BEFORE campaigns-changedata.js in server.js so the generic
// `/:key` wildcard can never capture `meta` (same trap as starter-seed).
// The campaigns-character wildcard routes pass `/meta` through themselves
// (they only claim `.json` file names).
// ---------------------------------------------------------------------------

const router = Router();

const META_FILE = 'campaign-meta.json';

export const CAMPAIGN_TYPES = ['standard', 'arena', 'starter'];

const metaPath = (campaign) => campaignDataFile(campaign, META_FILE);

/** Resolve a campaign's type: explicit meta file, else the 'standard'
 *  default. Never throws. */
export function resolveCampaignType(campaign) {
    try {
        const meta = JSON.parse(fs.readFileSync(metaPath(campaign), 'utf-8'));
        if (CAMPAIGN_TYPES.includes(meta?.type)) return meta.type;
    } catch {
        // Missing or corrupt meta file → standard default.
    }
    return 'standard';
}

// GET /api/campaigns/:campaign/meta — always 200 with a resolved type.
router.get('/api/campaigns/:campaign/meta', asyncHandler((req, res) => {
    res.json({ type: resolveCampaignType(req.params.campaign) });
}));

// PUT /api/campaigns/:campaign/meta — upsert { type } (GM-only).
router.put('/api/campaigns/:campaign/meta', asyncHandler((req, res) => {
    const { campaign } = req.params;
    if (!isLocalHost(req)) {
        return res.status(403).json({ error: 'Only the GM (localhost) can set the campaign type' });
    }
    const type = req.body?.type;
    if (!CAMPAIGN_TYPES.includes(type)) {
        return res.status(400).json({ error: `campaign meta payload must be { type: one of ${CAMPAIGN_TYPES.join(', ')} }` });
    }
    ensureDataDir(campaign);
    fs.writeFileSync(metaPath(campaign), JSON.stringify({ type }, null, 2));
    // Live-sync the selection list (starter-seed doctrine, 71f617299): quick-
    // create writes the folder first and this meta last, so the second
    // campaigns-list event is what lands the Arena/Starter badge on the row
    // another tab just saw appear unbadged.
    publish('campaigns-list', { action: 'updated', campaign }, campaign);
    res.json({ message: 'Campaign meta saved successfully', type });
}));

export default router;
