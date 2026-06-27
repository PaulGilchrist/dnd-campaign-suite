import express from 'express';
import fs from 'fs';
import asyncHandler from '../utils/asyncHandler.js';
import { campaignDir, campaignsRoot } from '../utils/campaignPaths.js';

const router = express.Router();

// API endpoint to list character folders
router.get('/api/campaigns', asyncHandler((req, res) => {
    const items = fs.readdirSync(campaignsRoot(), { withFileTypes: true });
    const folders = items
        .filter(item => item.isDirectory())
        .map(item => item.name)
        .sort();

    res.json({ folders });
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
