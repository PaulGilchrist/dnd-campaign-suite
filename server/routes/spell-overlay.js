import express from 'express';
import { publish } from '../utils/changeData.js';

const router = express.Router();

router.post('/spell-overlay', (req, res) => {
    const campaign = req.query.campaign;
    if (!campaign) {
        return res.status(400).json({ error: 'campaign query param required' });
    }
    const { action, overlays, overlayId } = req.body;
    publish(`spell-overlay-${campaign}`, { action, overlays, overlayId });
    res.json({ ok: true });
});

export default router;