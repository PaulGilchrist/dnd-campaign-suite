import fs from 'fs';
import { campaignDataFile, ensureDataDir } from '../utils/campaignPaths.js';
import asyncHandler from '../utils/asyncHandler.js';
import { isLocalHost } from '../utils/jsonEntityCrud.js';
import { publish } from '../utils/changeData.js';
import { TOOLBELT_VIEWS } from '../../src/services/ui/sidebarNav.js';
import { Router } from 'express';

// ---------------------------------------------------------------------------
// Campaign-type + toolbelt metadata (data/campaign-meta.json).
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
// The same file carries the sidebar TOOLBELT: the per-campaign set of
// sidebar views the GM has hidden for this session
// (`toolbelt: { hiddenViews: [...] }`). An absent toolbelt field is the
// canonical all-visible default — nothing migrates, nothing infers.
//
// GET stays open (every tab, LAN included, needs the badge and the hidden
// set); PUT is GM-only (localhost) and is a PARTIAL upsert: `type` and
// `toolbelt` may each ride alone, and an absent field is left untouched on
// disk (a toolbelt write never clobbers the type, and vice versa).
//
// Mounted BEFORE campaigns-changedata.js in server.js so the generic
// `/:key` wildcard can never capture `meta` (same trap as starter-seed).
// The campaigns-character wildcard routes pass `/meta` through themselves
// (they only claim `.json` file names).
// ---------------------------------------------------------------------------

const router = Router();

const META_FILE = 'campaign-meta.json';

export const CAMPAIGN_TYPES = ['standard', 'arena', 'starter'];

// The view names the toolbelt may hide — the ONE canonical list the sidebar
// dialog renders (the server reads src directly, campaigns-changedata's
// MOODS twin doctrine). An unknown name 400s on PUT and degrades on read,
// exactly like an off-enum `type`.
export const TOOLBELT_VIEW_NAMES = TOOLBELT_VIEWS.map(({ view }) => view);

const metaPath = (campaign) => campaignDataFile(campaign, META_FILE);

/** Parse the meta document, `{}` for a missing/corrupt file. Never throws. */
function readCampaignMeta(campaign) {
    try {
        const meta = JSON.parse(fs.readFileSync(metaPath(campaign), 'utf-8'));
        return meta && typeof meta === 'object' ? meta : {};
    } catch {
        return {};
    }
}

/**
 * Normalize a stored/sent toolbelt to the canonical shape
 * `{ hiddenViews: string[] }` (deduped, known views only). Anything absent
 * or malformed (hand-edited disk file) resolves to the all-visible default —
 * mirrors the resolveCampaignType degrade-don't-500 law: an unknown stored
 * view name is ignored the same way an unknown stored type resolves to
 * 'standard'.
 */
function normalizeToolbelt(toolbelt) {
    const views = toolbelt?.hiddenViews;
    if (!Array.isArray(views)) return { hiddenViews: [] };
    const strings = views
        .filter((v) => typeof v === 'string')
        .map((v) => v.trim())
        .filter((v) => TOOLBELT_VIEW_NAMES.includes(v));
    return { hiddenViews: [...new Set(strings)] };
}

/**
 * Synchronous meta write — the ONE writeFileSync idiom for campaign-meta.json,
 * shared by the PUT route below and the campaign-create route
 * (campaigns-admin.js), which stamps the preset type INSIDE the create
 * response (backlog SS 2026-11-22: a separate follow-up meta write left a
 * window where GET /api/campaigns reported the fresh folder under `folders`
 * while `types` still read 'standard' — folders led types, unbadged row).
 * Merges over the existing document so a type stamp never erases a stored
 * toolbelt. The caller owns the live-sync `publish`; this writes bytes only.
 */
export function writeCampaignMeta(campaign, type) {
    ensureDataDir(campaign);
    const meta = { ...readCampaignMeta(campaign), type };
    fs.writeFileSync(metaPath(campaign), JSON.stringify(meta, null, 2));
}

/** Resolve a campaign's type: explicit meta file, else the 'standard'
 *  default. Never throws. */
export function resolveCampaignType(campaign) {
    const { type } = readCampaignMeta(campaign);
    if (CAMPAIGN_TYPES.includes(type)) return type;
    return 'standard';
}

// GET /api/campaigns/:campaign/meta — always 200 with the resolved type and
// the toolbelt (absent/malformed stored toolbelt answers the all-visible
// `{ hiddenViews: [] }` default, never a 404 or a missing field).
router.get('/api/campaigns/:campaign/meta', asyncHandler((req, res) => {
    const meta = readCampaignMeta(req.params.campaign);
    res.json({
        type: resolveCampaignType(req.params.campaign),
        toolbelt: normalizeToolbelt(meta.toolbelt),
    });
}));

// PUT /api/campaigns/:campaign/meta — partial upsert of { type } and/or
// { toolbelt } (GM-only). Each field rides alone; absent fields keep their
// stored values. Payloads naming neither field, or carrying a malformed one,
// 400 with the expected shape named in plain English.
router.put('/api/campaigns/:campaign/meta', asyncHandler((req, res) => {
    const { campaign } = req.params;
    if (!isLocalHost(req)) {
        return res.status(403).json({ error: 'Only the GM (localhost) can set the campaign meta' });
    }
    const { type, toolbelt } = req.body ?? {};
    if (type === undefined && toolbelt === undefined) {
        return res.status(400).json({ error: 'campaign meta payload must include { type } and/or { toolbelt }' });
    }
    if (type !== undefined && !CAMPAIGN_TYPES.includes(type)) {
        return res.status(400).json({ error: `campaign meta payload must be { type: one of ${CAMPAIGN_TYPES.join(', ')} }` });
    }
    if (toolbelt !== undefined) {
        const views = toolbelt?.hiddenViews;
        if (!Array.isArray(views) || views.some((v) => typeof v !== 'string' || v.trim() === '')) {
            return res.status(400).json({ error: 'campaign meta toolbelt payload must be { toolbelt: { hiddenViews: [ ...view names... ] } }' });
        }
        if (views.some((v) => !TOOLBELT_VIEW_NAMES.includes(v.trim()))) {
            return res.status(400).json({ error: `campaign meta toolbelt hiddenViews must be one of ${TOOLBELT_VIEW_NAMES.join(', ')}` });
        }
    }

    ensureDataDir(campaign);
    const meta = { ...readCampaignMeta(campaign) };
    if (type !== undefined) meta.type = type;
    if (toolbelt !== undefined) meta.toolbelt = normalizeToolbelt(toolbelt);
    fs.writeFileSync(metaPath(campaign), JSON.stringify(meta, null, 2));

    // Live-sync (campaigns-list doctrine): every surface that reads the meta
    // lane refreshes on this event — the campaign-selection badge rows AND
    // mounted campaign tabs (publish targets this campaign's SSE clients, so
    // the whole table's sidebar converges live, not just at reload).
    publish('campaigns-list', { action: 'updated', campaign }, campaign);
    res.json({
        message: 'Campaign meta saved successfully',
        type: CAMPAIGN_TYPES.includes(meta.type) ? meta.type : 'standard',
        toolbelt: normalizeToolbelt(meta.toolbelt),
    });
}));

export default router;
