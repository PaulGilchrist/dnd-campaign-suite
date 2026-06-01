import express from 'express';
import { publish, characterChangeData, saveFile } from '../utils/changeData.js';

const router = express.Router();

// GET /api/campaigns/:campaign/:key - Generic GET from in-memory change data store
router.get('/api/campaigns/:campaign/:key', (req, res, next) => {
    const { campaign, key } = req.params;
    if (key === 'log') return next();
    const data = characterChangeData.get(campaign);

    if (!data || !(key in data)) {
        return res.status(404).json({ error: 'Key not found' });
    }

    res.json({ [key]: data[key] });
});

// POST /api/campaigns/:campaign/:key - Generic POST to in-memory change data store
router.post('/api/campaigns/:campaign/:key', (req, res, next) => {
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
