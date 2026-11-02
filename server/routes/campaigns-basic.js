import express from 'express';
import fs from 'fs';
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

// API endpoint to list character files in a specific campaign
router.get('/api/campaigns/:campaign', asyncHandler((req, res) => {
    const { campaign } = req.params;
    const items = fs.readdirSync(campaignDir(campaign), { withFileTypes: true });
    const files = items
        .filter(item => item.isFile() && item.name.endsWith('.json'))
        .map(item => item.name)
        .sort();

    res.json({ files });
}));

export default router;
