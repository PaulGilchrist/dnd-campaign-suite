import express from 'express';
import { publish, characterChangeData, saveFile } from '../utils/changeData.js';

const router = express.Router();

// GET /api/campaigns/:campaign/:key - Generic GET from in-memory change data store
router.get('/api/campaigns/:campaign/:key', (req, res) => {
    const { campaign, key } = req.params;
    const data = characterChangeData.get(campaign);

    if (!data || !(key in data)) {
        return res.status(404).json({ error: 'Key not found' });
    }

    res.json({ [key]: data[key] });
});

// POST /api/campaigns/:campaign/:key - Generic POST to in-memory change data store
router.post('/api/campaigns/:campaign/:key', (req, res) => {
    const { campaign, key } = req.params;
    const value = req.body.value || req.body;

if (!characterChangeData.has(campaign)) {
    characterChangeData.set(campaign, {});
 }

 characterChangeData.get(campaign)[key] = value;
 saveFile();

// Broadcast change
 publish(`change-${campaign}-${key}`, value);
    
    res.json({ message: 'Data saved successfully' });
});

export default router;
