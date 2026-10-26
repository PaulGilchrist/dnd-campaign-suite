import express from 'express';

// Read-only server meta for the client. GET-only on purpose: GETs pass
// through the CAMPAIGN_LOCK middleware in server.js, so the Admin panel can
// learn the lock state up front and disable the Rename Campaign affordance
// while the lock is engaged. `campaignLock` is the already-decoded lock name
// from server.js (null when unlocked) — the env parsing stays a single
// source of truth there.
export default function createServerConfigRouter(campaignLock) {
    const router = express.Router();

    router.get('/api/server-config', (req, res) => {
        if (campaignLock) {
            res.json({ campaignLocked: true, lockedCampaign: campaignLock });
        } else {
            res.json({ campaignLocked: false });
        }
    });

    return router;
}
