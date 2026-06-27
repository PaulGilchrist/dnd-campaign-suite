import express from 'express';
import fs from 'fs';
import asyncHandler from '../utils/asyncHandler.js';
import { campaignDir, campaignMapsDir, campaignImagesDir, campaignDataDir } from '../utils/campaignPaths.js';

const router = express.Router();

// API endpoint to create a new campaign folder
router.post('/api/campaigns', asyncHandler((req, res) => {
    const { campaignName } = req.body;

    if (!campaignName || campaignName.trim() === '') {
        return res.status(400).json({ error: 'Campaign name is required' });
    }

    const newCampaignDir = campaignDir(campaignName.trim());

    if (fs.existsSync(newCampaignDir)) {
        return res.status(400).json({ error: 'Campaign already exists' });
    }

    fs.mkdirSync(newCampaignDir);
    // Create maps subdirectory for campaign map files
    fs.mkdirSync(campaignMapsDir(campaignName.trim()), { recursive: true });
    // Create images subdirectory for character images
    fs.mkdirSync(campaignImagesDir(campaignName.trim()), { recursive: true });
    // Create data subdirectory for character change data
    fs.mkdirSync(campaignDataDir(campaignName.trim()), { recursive: true });

    res.status(201).json({ message: 'Campaign created successfully', campaignName: campaignName.trim() });
}));

// API endpoint to rename a campaign directory
router.put('/api/campaigns/:campaign', asyncHandler((req, res) => {
    const { campaign } = req.params;
    const { newName } = req.body;

    if (!newName || newName.trim() === '') {
        return res.status(400).json({ error: 'New campaign name is required' });
    }

    const oldCampaignDir = campaignDir(campaign);
    const newCampaignDir = campaignDir(newName.trim());

    if (!fs.existsSync(oldCampaignDir)) {
        return res.status(404).json({ error: 'Campaign not found' });
    }

    if (fs.existsSync(newCampaignDir)) {
        return res.status(400).json({ error: 'Campaign already exists' });
    }

    fs.renameSync(oldCampaignDir, newCampaignDir);

    res.json({ message: 'Campaign renamed successfully', campaignName: newName.trim() });
}));

// API endpoint to delete a campaign and all its files/images
router.delete('/api/campaigns/:campaign', asyncHandler((req, res) => {
    const { campaign } = req.params;
    const dir = campaignDir(campaign);

    if (!fs.existsSync(dir)) {
        return res.status(404).json({ error: 'Campaign not found' });
    }

    // Remove the entire campaign directory
    fs.rmSync(dir, { recursive: true, force: true });

    res.json({ message: 'Campaign deleted successfully' });
}));

export default router;
