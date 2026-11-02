import fs from 'fs';
import { campaignDataFile, ensureDataDir } from '../utils/campaignPaths.js';
import asyncHandler from '../utils/asyncHandler.js';
import { isLocalHost } from '../utils/jsonEntityCrud.js';
import { publish } from '../utils/changeData.js';
import { Router } from 'express';

// ---------------------------------------------------------------------------
// Starter-campaign seed document (data/starter-seed.json).
//
// One single-document lane backing the seeded campaign flow (arena-starter plan
// §3): the client orchestrator writes the seed AFTER create (recording the
// rolling seed number + every generated entity name), the first-session
// checklist reads it to decide visibility and to name the generated entities,
// and `regenerateAdventure` rewrites it with the fresh roll.
//
// Existence semantics: GET answers 200 `{ seed: null }` when no file exists —
// a regular campaign never renders the checklist, and the lane never 404s the
// client into its generic error toast for the common non-starter case.
//
// Writes are GM-only (localhost), mirroring the map-create guard doctrine:
// seeding/re-rolling content is a campaign-authoring mutation. Reads stay open
// so player tabs see the same checklist. Campaign-lock (app middleware) still
// gates WHICH campaigns are writable; this gate is WHO.
//
// Mounted BEFORE campaigns-changedata.js in server.js so the generic
// `/:key` wildcard can never capture `starter-seed`.
// ---------------------------------------------------------------------------

const router = Router();

const SEED_FILE = 'starter-seed.json';

const seedPath = (campaign) => campaignDataFile(campaign, SEED_FILE);

// GET /api/campaigns/:campaign/starter-seed
router.get('/api/campaigns/:campaign/starter-seed', asyncHandler((req, res) => {
    const { campaign } = req.params;
    const filePath = seedPath(campaign);
    if (!fs.existsSync(filePath)) {
        return res.json({ seed: null });
    }
    try {
        res.json({ seed: JSON.parse(fs.readFileSync(filePath, 'utf-8')) });
    } catch {
        // Corrupt seed file must not brick the checklist lane — report it as
        // absent (non-starter) rather than 500 a whole campaign view.
        res.json({ seed: null });
    }
}));

// PUT /api/campaigns/:campaign/starter-seed — upsert the whole document.
router.put('/api/campaigns/:campaign/starter-seed', asyncHandler((req, res) => {
    const { campaign } = req.params;
    if (!isLocalHost(req)) {
        return res.status(403).json({ error: 'Only the GM (localhost) can write the starter seed' });
    }
    const seed = req.body?.seed;
    if (!seed || typeof seed !== 'object' || Array.isArray(seed)) {
        return res.status(400).json({ error: 'starter-seed payload must be { seed: object }' });
    }
    ensureDataDir(campaign);
    fs.writeFileSync(seedPath(campaign), JSON.stringify(seed, null, 2));
    // Live-sync (mirrors broadcastSettlementsList, routes/settlements.js):
    // every open tab's first-session checklist refreshes without reload.
    // Explicit campaign arg — publish's key-parsing regex does not know the
    // `starter-seed-` prefix, and campaign names contain hyphens.
    publish(`starter-seed-${campaign}`, { action: 'updated', seed }, campaign);
    res.json({ message: 'Starter seed saved successfully' });
}));

export default router;
