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

// POST /api/campaigns/:campaign/pipeline-event — Record a pipeline milestone event
router.post('/api/campaigns/:campaign/pipeline-event', asyncHandler((req, res) => {
    const { campaign } = req.params;
    const { key, data } = req.body;

    if (!key) {
        return res.status(400).json({ error: 'key is required' });
    }

    if (!characterChangeData.has(campaign)) {
        characterChangeData.set(campaign, {});
    }

    const storedData = data === undefined ? {} : data;
    characterChangeData.get(campaign)[`pipeline-${campaign}-${key}`] = storedData;
    markDirty(campaign);

    publish(`pipeline-${campaign}-${key}`, storedData);

    res.json({ message: 'Pipeline event recorded' });
}));

// GET /api/campaigns/:campaign/pipeline-events — Get stored pipeline events
router.get('/api/campaigns/:campaign/pipeline-events', asyncHandler((req, res) => {
    const { campaign } = req.params;
    const data = characterChangeData.get(campaign);

    if (!data) {
        return res.json({ events: [] });
    }

    const events = [];
    for (const [key, value] of Object.entries(data)) {
        if (key.startsWith(`pipeline-${campaign}-`)) {
            events.push({ key, value });
        }
    }

    res.json({ events });
}));

export default router;
