import express from 'express';
import fs from 'fs';
import path from 'path';
import asyncHandler from '../utils/asyncHandler.js';
import { campaignDir, campaignsRoot } from '../utils/campaignPaths.js';
import { resolveCampaignType } from './campaigns-meta.js';

const router = express.Router();

// API endpoint to list character folders. `types` maps each campaign name to
// its quick-create type ('standard' | 'arena' | 'starter') so the selection
// screen can badge rows BEFORE opening; resolveCampaignType never throws, so
// a campaign with no meta file just reads as standard.
router.get('/api/campaigns', asyncHandler((req, res) => {
    const items = fs.readdirSync(campaignsRoot(), { withFileTypes: true });
    const folders = items
        .filter(item => item.isDirectory() && !item.name.startsWith('.'))
        .map(item => item.name)
        .sort();

    const types = {};
    for (const name of folders) types[name] = resolveCampaignType(name);

    res.json({ folders, types });
}));

// Character-shape guard for roster enumeration (bug-stray-root-json-ghost-
// character-poisons-initiative-board): this file list IS the roster — the
// campaign-select bake turns every parsed document into a persisted
// combatSummary player row. A stray non-character JSON dropped at campaign
// root (editor/Finder artifact — the app's own meta lives at
// data/campaign-meta.json) parses fine but carries no `name`, minting a
// `name: null` ghost that survives the file's deletion and hard-crashes every
// monster join (`getNextUniqueMonsterName` matches on row names). Enumerate
// only documents the character write lanes could have produced: both the
// create POST and the edit PUT normalize and hard-require a non-empty
// `name` (campaigns-character.js), so one carrying none is not a character.
// Skips are logged, never silently repaired.
function isCharacterDocument(filePath, campaign) {
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        console.log(`[campaigns-basic] Skipping unreadable/unparseable JSON at ${campaign} root: ${path.basename(filePath)}`);
        return false;
    }
    const shaped = !!parsed && typeof parsed === 'object'
        && typeof parsed.name === 'string' && parsed.name.trim() !== '';
    if (!shaped) {
        console.log(`[campaigns-basic] Skipping non-character JSON at ${campaign} root: ${path.basename(filePath)}`);
    }
    return shaped;
}

// API endpoint to list character files in a specific campaign
router.get('/api/campaigns/:campaign', asyncHandler((req, res) => {
    const { campaign } = req.params;
    const dir = campaignDir(campaign);
    const items = fs.readdirSync(dir, { withFileTypes: true });
    const files = items
        .filter(item => item.isFile() && item.name.endsWith('.json'))
        .filter(item => isCharacterDocument(path.join(dir, item.name), campaign))
        .map(item => item.name)
        .sort();

    res.json({ files });
}));

export default router;
