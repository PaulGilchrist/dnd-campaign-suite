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

/**
 * Synchronous meta write — the ONE writeFileSync idiom for campaign-meta.json,
 * shared by the PUT route below and the campaign-create route
 * (campaigns-admin.js), which stamps the preset type INSIDE the create
 * response (backlog SS 2026-11-22: a separate follow-up meta write left a
 * window where GET /api/campaigns reported the fresh folder under `folders`
 * while `types` still read 'standard' — folders led types, unbadged row).
 * The caller owns the live-sync `publish`; this writes bytes only.
 */
export function writeCampaignMeta(campaign, type) {
    ensureDataDir(campaign);
    fs.writeFileSync(metaPath(campaign), JSON.stringify({ type }, null, 2));
}

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
    writeCampaignMeta(campaign, type);
    // Live-sync the selection list: every surface that renders the badge reads
    // the types map refreshed by this event (quick-create presets arrive fully
    // typed via the create route itself, so this lane now serves Admin/meta
    // writers).
    publish('campaigns-list', { action: 'updated', campaign }, campaign);
    res.json({ message: 'Campaign meta saved successfully', type });
}));

export default router;
