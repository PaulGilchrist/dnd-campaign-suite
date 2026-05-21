import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// API endpoint to create a new campaign folder
router.post('/api/campaigns', (req, res) => {
    const { campaignName } = req.body;
    
    if (!campaignName || campaignName.trim() === '') {
        return res.status(400).json({ error: 'Campaign name is required' });
    }
    
    const campaignsDir = path.join(process.cwd(), 'public', 'campaigns');
    const newCampaignDir = path.join(campaignsDir, campaignName.trim());
    
    try {
        if (fs.existsSync(newCampaignDir)) {
            return res.status(400).json({ error: 'Campaign already exists' });
        }
        
        fs.mkdirSync(newCampaignDir);
        // Create maps subdirectory for campaign map files
        fs.mkdirSync(path.join(newCampaignDir, 'maps'), { recursive: true });
        // Create images subdirectory for character images
        fs.mkdirSync(path.join(newCampaignDir, 'images'), { recursive: true });
        // Create data subdirectory for character change data
        fs.mkdirSync(path.join(newCampaignDir, 'data'), { recursive: true });
        
        res.status(201).json({ message: 'Campaign created successfully', campaignName: campaignName.trim() });
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
});

// API endpoint to rename a campaign directory
router.put('/api/campaigns/:campaign', (req, res) => {
    const { campaign } = req.params;
    const { newName } = req.body;
    
    if (!newName || newName.trim() === '') {
        return res.status(400).json({ error: 'New campaign name is required' });
    }
    
    const campaignsDir = path.join(process.cwd(), 'public', 'campaigns');
    const oldCampaignDir = path.join(campaignsDir, campaign);
    const newCampaignDir = path.join(campaignsDir, newName.trim());
    
    try {
        if (!fs.existsSync(oldCampaignDir)) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        
        if (fs.existsSync(newCampaignDir)) {
            return res.status(400).json({ error: 'Campaign already exists' });
        }
        
        fs.renameSync(oldCampaignDir, newCampaignDir);
        
        res.json({ message: 'Campaign renamed successfully', campaignName: newName.trim() });
    } catch (error) {
        console.error('Error renaming campaign:', error);
        res.status(500).json({ error: 'Failed to rename campaign' });
    }
});

// API endpoint to delete a campaign and all its files/images
router.delete('/api/campaigns/:campaign', (req, res) => {
    const { campaign } = req.params;
    const campaignDir = path.join(process.cwd(), 'public', 'campaigns', campaign);
    
    try {
        if (!fs.existsSync(campaignDir)) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        
        // Remove the entire campaign directory
        fs.rmSync(campaignDir, { recursive: true, force: true });
        
        res.json({ message: 'Campaign deleted successfully' });
    } catch (error) {
        console.error('Error deleting campaign:', error);
        res.status(500).json({ error: 'Failed to delete campaign' });
    }
});

export default router;
