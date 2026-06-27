import express from 'express';
import { publish, characterChangeData, debouncedSave } from '../utils/changeData.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = express.Router();

// GET /api/campaigns/:campaign/positioning - Get in-memory positioning data
router.get('/api/campaigns/:campaign/positioning', asyncHandler((req, res) => {
    const { campaign } = req.params;
    const data = characterChangeData.get(campaign);
    res.json({ positioning: data?.positioning || {} });
}));

// POST /api/campaigns/:campaign/positioning - Save in-memory positioning data
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

export default router;
