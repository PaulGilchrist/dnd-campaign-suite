import express from 'express';
import { publish, spellOverlayData } from '../utils/changeData.js';

const router = express.Router();

router.get('/spell-overlay', (req, res) => {
    const campaign = req.query.campaign;
    if (!campaign) {
        return res.status(400).json({ error: 'campaign query param required' });
    }
    const overlays = spellOverlayData.has(campaign) ? spellOverlayData.get(campaign) : [];
    res.json({ overlays });
});

router.post('/spell-overlay', (req, res) => {
    const campaign = req.query.campaign;
    if (!campaign) {
        return res.status(400).json({ error: 'campaign query param required' });
    }
    const { action, overlays, overlayId } = req.body;

    // Persist overlay state in-memory so it survives view switches
    if (!spellOverlayData.has(campaign)) {
        spellOverlayData.set(campaign, []);
    }
    switch (action) {
        case 'add':
            if (overlays?.length) {
                const existing = spellOverlayData.get(campaign);
                const existingIds = new Set(existing.map(o => o.id));
                for (const overlay of overlays) {
                    if (!existingIds.has(overlay.id)) {
                        existing.push(overlay);
                    }
                }
            }
            break;
        case 'update':
            if (overlays?.length) {
                const existing = spellOverlayData.get(campaign);
                const updatedIds = new Set(overlays.map(o => o.id));
                spellOverlayData.set(campaign, existing.map(o => updatedIds.has(o.id) ? overlays.find(n => n.id === o.id) : o));
            }
            break;
        case 'remove':
            if (overlayId) {
                spellOverlayData.set(campaign, spellOverlayData.get(campaign).filter(o => o.id !== overlayId));
            }
            break;
        case 'clear':
            spellOverlayData.set(campaign, []);
            break;
    }

    publish(`spell-overlay-${campaign}`, { action, overlays, overlayId });
    res.json({ ok: true });
});

export default router;