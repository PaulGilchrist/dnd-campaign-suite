import express from 'express';
import { publish, characterChangeData, saveFile, subscribers } from '../utils/changeData.js';

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

// GET /api/campaigns/:campaign/:key - Generic GET from in-memory change data store
router.get('/api/campaigns/:campaign/:key', (req, res, next) => {
    const { campaign, key } = req.params;
    if (key === 'log') return next();
    const data = characterChangeData.get(campaign);

    if (!data || !(key in data)) {
        return res.json({ value: null });
    }

    res.json({ [key]: data[key] });
});

// POST /api/campaigns/:campaign/:key - Generic POST to in-memory change data store
router.post('/api/campaigns/:campaign/:key', (req, res, next) => {
    const { campaign, key } = req.params;
    if (key === 'log') return next();
    if (campaign === 'undefined' || campaign === 'null') {
        console.error('Rejecting change data write for invalid campaign name', { campaign, key, body: req.body, url: req.originalUrl, ip: req.ip });
        return res.status(400).json({ error: 'Invalid campaign name' });
    }
    const value = req.body.value || req.body;

    if (!characterChangeData.has(campaign)) {
        characterChangeData.set(campaign, {});
    }

    const oldValue = characterChangeData.get(campaign)[key];
    characterChangeData.get(campaign)[key] = value;
    saveFile();

    // Broadcast change
    publish(`change-${campaign}-${key}`, value);

    res.json({ message: 'Data saved successfully' });
});

// DELETE /api/campaigns/:campaign/:key - Remove a key from the change data store
router.delete('/api/campaigns/:campaign/:key', (req, res, next) => {
    const { campaign, key } = req.params;
    if (key === 'log') return next();
    if (characterChangeData.has(campaign)) {
        delete characterChangeData.get(campaign)[key];
        saveFile();
    }
    publish(`change-${campaign}-${key}`, null);

    res.json({ message: 'Data deleted successfully' });
});

export default router;
