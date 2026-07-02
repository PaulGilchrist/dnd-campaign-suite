import express from 'express';
import { publish, characterChangeData, saveFile, debouncedSave } from '../utils/changeData.js';
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
    debouncedSave();

    // Broadcast positioning change
    publish(`positioning-${campaign}`, positioning);

    res.json({ message: 'Positioning saved successfully' });
}));

// GET /api/campaigns/:campaign/:key - Generic GET from in-memory change data store
router.get('/api/campaigns/:campaign/:key', asyncHandler((req, res, next) => {
    const { campaign, key } = req.params;
    if (key === 'log') return next();
    const data = characterChangeData.get(campaign);

    if (!data || !(key in data)) {
        return res.json({ value: null });
    }

    res.json({ [key]: data[key] });
}));

// POST /api/campaigns/:campaign/:key - Generic POST to in-memory change data store
router.post('/api/campaigns/:campaign/:key', asyncHandler((req, res, next) => {
    const { campaign, key } = req.params;
    if (key === 'log') return next();
    const value = req.body.value || req.body;

    if (!characterChangeData.has(campaign)) {
        characterChangeData.set(campaign, {});
    }

    characterChangeData.get(campaign)[key] = value;
    saveFile();

    // Broadcast change
    publish(`change-${campaign}-${key}`, value);

    res.json({ message: 'Data saved successfully' });
}));

// DELETE /api/campaigns/:campaign/:key - Remove a key from the change data store
router.delete('/api/campaigns/:campaign/:key', asyncHandler((req, res, next) => {
    const { campaign, key } = req.params;
    if (key === 'log') return next();
    if (characterChangeData.has(campaign)) {
        delete characterChangeData.get(campaign)[key];
        saveFile();
    }
    publish(`change-${campaign}-${key}`, null);

    res.json({ message: 'Data deleted successfully' });
}));

export default router;
