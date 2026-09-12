import express from 'express';
import { publish, characterChangeData, markDirty } from '../utils/changeData.js';
import asyncHandler from '../utils/asyncHandler.js';

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

    const value = 'value' in req.body ? req.body.value : req.body;

    warnDeprecatedLastAttack(campaign, key, value);

    if (!characterChangeData.has(campaign)) {
        characterChangeData.set(campaign, {});
    }

    const propertyValue = extractPropertyValue(key, value);
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
