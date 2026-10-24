import express from 'express';
import { publish, characterChangeData, markDirty } from '../utils/changeData.js';
import asyncHandler from '../utils/asyncHandler.js';
import { resolveOverrideTitles } from '../utils/resolveTrackTitles.js';
import { validateRuntimeWrite } from '../validation/keyValidators.js';
import { addEntry as addLogEntry } from './log.js';

const router = express.Router();

// Reject requests with invalid campaign names before any route handler
router.use('/api/campaigns/:campaign', (req, res, next) => {
    const { campaign } = req.params;
    if (campaign === 'undefined' || campaign === 'null') {
        console.error('Rejecting request for invalid campaign name', { campaign, url: req.originalUrl, ip: req.ip });
        return res.status(400).json({ error: 'Invalid campaign name' });
    }
    next();
});

// GET /api/campaigns/:campaign/change-data - Get full change data object for campaign
router.get('/api/campaigns/:campaign/change-data', asyncHandler((req, res) => {
    const { campaign } = req.params;
    const data = characterChangeData.get(campaign);
    res.json(data || {});
}));

// GET /api/campaigns/:campaign/positioning - Get positioning data
router.get('/api/campaigns/:campaign/positioning', asyncHandler((req, res) => {
    const { campaign } = req.params;
    const data = characterChangeData.get(campaign);
    res.json({ positioning: data?.positioning || {} });
}));

// POST /api/campaigns/:campaign/positioning - Save positioning data
router.post('/api/campaigns/:campaign/positioning', asyncHandler((req, res) => {
    const { campaign } = req.params;
    const { positioning } = req.body;

    if (!characterChangeData.has(campaign)) {
        characterChangeData.set(campaign, {});
    }

    characterChangeData.get(campaign).positioning = positioning;
    markDirty(campaign);

    // Broadcast positioning change
    publish(`positioning-${campaign}`, positioning, campaign);

    res.json({ message: 'Positioning saved successfully' });
}));

// GET /api/campaigns/:campaign/:key - Generic GET from in-memory change data store
router.get('/api/campaigns/:campaign/:key', asyncHandler((req, res, next) => {
    const { campaign, key } = req.params;
    if (key === 'log') return next();
    if (key === 'campaign') {
        console.error(
            '[campaigns-changedata] Client read from deprecated "campaign" key. ' +
            `Campaign: "${campaign}", key: "${key}". Campaign-level keys should GET from /api/campaigns/:campaign/:key directly. ` +
            'Check useRuntimeState.js or storage.js for getRuntimeValue("campaign", ...) or storage.getProperty("campaign", ...).',
            { campaign, key, stack: new Error().stack }
        );
        return res.status(400).json({ error: 'Use /api/campaigns/:campaign/:key for campaign-level data' });
    }
    if (key === campaign) {
        console.error(
            '[campaigns-changedata] GET to :campaign/:campaign with key === campaign. ' +
            `Campaign: "${campaign}", key: "${key}". Campaign-level data should GET from :campaign/:key directly.`,
            { campaign, key, stack: new Error().stack }
        );
    }
    const data = characterChangeData.get(campaign);

    if (!data || !(key in data)) {
        return res.json({ value: null });
    }

    res.json({ [key]: data[key] });
}));

// POST /api/campaigns/:campaign/music - GM ambience state, intent-split merge.
// Transport writes (play/pause/stop/mood/volume via useSyncedState) POST the full
// music object and overwrite every field, exactly as the generic wildcard did before.
// The track EDITOR save/reset PATCH sends { overrides } only: playing/mood/volume are
// absent from that payload, so server truth survives the merge — saving a track list
// while stopped must never resurrect playing:true and surprise-autoplay other tabs
// (backlog 2026-10-24). Response echoes the merged object so the editor can pin its
// local store to server truth (skipSync).
//
// Unresolved track titles (editor stamps title = raw video ID) are enriched
// server-side via YouTube oEmbed before the merge — browser cannot CORS-hit
// oembed (backlog 2026-10-24). Bounded parallel fetches; any failure falls
// back to the raw ID and NEVER blocks the save. Transport writes echo back
// already-resolved overrides, so the stampede guard (reuse stored titles)
// keeps play/pause instant — only new/changed videos cost a lookup.
router.post('/api/campaigns/:campaign/music', asyncHandler(async (req, res) => {
    const { campaign } = req.params;
    let incoming = ('value' in req.body ? req.body.value : req.body);
    if (!incoming || typeof incoming !== 'object') {
        return res.status(400).json({ error: 'music payload must be an object' });
    }
    if ('overrides' in incoming && (!incoming.overrides || typeof incoming.overrides !== 'object' || Array.isArray(incoming.overrides))) {
        return res.status(400).json({ error: 'music.overrides must be an object' });
    }
    const current = characterChangeData.get(campaign)?.music;
    const base = (current && typeof current === 'object' && !Array.isArray(current))
        ? current
        : { mood: null, playing: false, volume: 0.6, overrides: {} };
    if ('overrides' in incoming) {
        incoming = { ...incoming, overrides: await resolveOverrideTitles(incoming.overrides, base.overrides) };
    }
    const merged = { ...base, ...incoming };

    if (!characterChangeData.has(campaign)) {
        characterChangeData.set(campaign, {});
    }
    characterChangeData.get(campaign).music = merged;
    markDirty(campaign);

    // Broadcast merged truth
    publish(`change-${campaign}-music`, merged, campaign);

    res.json({ music: merged, message: 'Music saved successfully' });
}));

// value may be the full store object { targetEffects: [...], hitPoints: 123, ... }
// or just the property value directly. Extract the property if value[key] exists.
function extractPropertyValue(key, value) {
    if (value && typeof value === 'object') {
        if (key in value) {
            return value[key];
        }
        if ('value' in value && Object.keys(value).length === 1 && typeof value.value === 'object') {
            // Client sent { value: fullStoreObject } — unwrap it directly
            return value.value;
        }
    }
    return value;
}

function warnDeprecatedLastAttack(campaign, key, value) {
    if (key !== 'combatSummary' || !value || typeof value !== 'object' || !('lastAttack' in value)) {
        return;
    }
    console.error(
        '[campaigns-changedata] Client wrote lastAttack to deprecated combatSummary.lastAttack. ' +
        `Campaign: "${campaign}". Use POST to /api/campaigns/:campaign/lastAttack directly. ` +
        'Check storage.setProperty(\'combatSummary\', \'lastAttack\', ...) or storage.set(\'combatSummary\', { ...lastAttack }).'
    );
}

// POST /api/campaigns/:campaign/:key - Generic POST to in-memory change data store
router.post('/api/campaigns/:campaign/:key', asyncHandler((req, res, next) => {
    const { campaign, key } = req.params;
    if (key === 'log') return next();
    if (key === 'campaign') {
        console.error(
            '[campaigns-changedata] Client wrote to deprecated "campaign" key. ' +
            `Campaign: "${campaign}", key: "${key}". Campaign-level keys should POST to /api/campaigns/:campaign/:key directly. ` +
            'Check useRuntimeState.js or storage.js for setRuntimeValue("campaign", ...) or storage.setProperty("campaign", ...).',
            { campaign, key, body: req.body, stack: new Error().stack }
        );
        return res.status(400).json({ error: 'Use /api/campaigns/:campaign/:key for campaign-level data' });
    }

    if (key === campaign) {
        console.error(
            '[campaigns-changedata] POST to :campaign/:campaign with key === campaign. ' +
            `Campaign: "${campaign}", key: "${key}". Campaign-level data should POST to :campaign/:key directly.`,
            { campaign, key, stack: new Error().stack }
        );
    }

    // Dotted-key wildcard trap (backlog 2026-10-24): character routes (mounted
    // BEFORE this router) own every ".json" path — they consume GET/PUT/PATCH/
    // DELETE but never POST, so POST /:campaign/<anything>.json used to fall
    // through here and persist an undeletable junk key (the same URL GET/DELETE
    // routes to campaigns-character → 404). Runtime store keys are never
    // file-suffixed — refuse the write loudly instead of poisoning the store.
    if (key.endsWith('.json')) {
        console.error(
            '[campaigns-changedata] Rejected POST to file-suffixed change-data key. ' +
            `Campaign: "${campaign}", key: "${key}". ` +
            `Character files are written via PUT /api/campaigns/${campaign}/<file>.json.`,
            { campaign, key, stack: new Error().stack }
        );
        return res.status(400).json({
            error: `Change-data keys cannot end in .json — "${key}" looks like a character file. ` +
                `Save character files with PUT /api/campaigns/${campaign}/<file>.json.`,
        });
    }

    const value = 'value' in req.body ? req.body.value : req.body;

    warnDeprecatedLastAttack(campaign, key, value);

    if (!characterChangeData.has(campaign)) {
        characterChangeData.set(campaign, {});
    }

    const propertyValue = extractPropertyValue(key, value);

    // L5-001 (D2): per-key validators guard enforcement truth. No validator
    // registered for this key ⇒ the write passes through exactly as today.
    const validation = validateRuntimeWrite(key, propertyValue, { req, campaign, current: characterChangeData.get(campaign) });
    if (!validation.ok) {
        // Broadcast the rejection so every client can surface the denied write.
        publish(`denied-${campaign}-${key}`, { key, reason: validation.reason }, campaign);
        // §10.4: denials are PERSISTENT audit — the audit ledger must show
        // what the server refused even after the SSE moment has passed.
        addLogEntry(campaign, {
            type: 'enforcement_denied',
            origin: 'server-validator',
            key,
            reason: validation.reason,
            description: `Server rejected write to ${key}: ${validation.reason}`,
        });
        return res.status(400).json({ error: validation.reason });
    }

    characterChangeData.get(campaign)[key] = propertyValue;
    markDirty(campaign);

    // Broadcast change
    publish(`change-${campaign}-${key}`, propertyValue, campaign);

    res.json({ message: 'Data saved successfully' });
}));

// DELETE /api/campaigns/:campaign/:key - Remove a key from the change data store
router.delete('/api/campaigns/:campaign/:key', asyncHandler((req, res, next) => {
    const { campaign, key } = req.params;
    if (key === 'log') return next();
    if (characterChangeData.has(campaign)) {
        delete characterChangeData.get(campaign)[key];
        markDirty(campaign);
    }
    publish(`change-${campaign}-${key}`, null, campaign);

    res.json({ message: 'Data deleted successfully' });
}));

export default router;
