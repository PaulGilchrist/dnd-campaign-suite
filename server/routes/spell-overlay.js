import express from 'express';
import { publish, spellOverlayData, markDirty } from '../utils/changeData.js';
import asyncHandler from '../utils/asyncHandler.js';
import { getCampaignLock, blockRequest } from '../utils/campaignLock.js';

const router = express.Router();

// GET stays open even while locked — mirrors the campaign-lock doctrine
// (READ_METHODS pass through campaignLock.js), and overlay reads are
// harmless in-memory snapshots. WRITES are the danger: this transport sits
// outside /api/campaigns/* (campaign is a query param), so the path-based
// lock middleware never inspects it. Enforce the same rule in-route: while
// locked, any write whose campaign is not the locked one is refused with the
// canonical 403 BEFORE the spellOverlayData Map or publish() are touched —
// this also refuses garbage campaign names (they are off-target by
// definition), closing both the cross-campaign-mutation hole and the
// unbounded phantom-entry growth.

router.get('/spell-overlay', asyncHandler((req, res) => {
    const campaign = req.query.campaign;
    if (!campaign) {
        return res.status(400).json({ error: 'campaign query param required' });
    }
    const overlays = spellOverlayData.has(campaign) ? spellOverlayData.get(campaign) : [];
    res.json({ overlays });
}));

// While locked, refuse any write whose campaign is not the locked one.
// Returns true when the request was answered with the block response.
function refuseLockedOffTargetWrite(req, res, campaign) {
    const campaignLock = getCampaignLock();
    if (!campaignLock || campaign === campaignLock) {
        return false;
    }
    blockRequest(req, res, campaignLock);
    return true;
}

router.post('/spell-overlay', asyncHandler((req, res) => {
    const campaign = req.query.campaign;
    if (!campaign) {
        return res.status(400).json({ error: 'campaign query param required' });
    }
    if (refuseLockedOffTargetWrite(req, res, campaign)) {
        return;
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

    // Ride the shared debounced cache→disk lane (same as change-data) so
    // placed zones survive an API restart. Locked off-target writes already
    // returned 403 above and never reach this.
    markDirty(campaign);

    publish(`spell-overlay-${campaign}`, { action, overlays, overlayId }, campaign);
    res.json({ ok: true });
}));

export default router;
