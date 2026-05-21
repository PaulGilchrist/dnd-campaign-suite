import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// API endpoint to list character folders
router.get('/api/campaigns', (req, res) => {
    const campaignsDir = path.join(process.cwd(), 'public', 'campaigns');
    
    try {
        const items = fs.readdirSync(campaignsDir, { withFileTypes: true });
        const folders = items
            .filter(item => item.isDirectory())
            .map(item => item.name)
            .sort();
        
        res.json({ folders });
    } catch (error) {
        console.error('Error reading campaigns directory:', error);
        res.status(500).json({ error: 'Failed to read campaigns directory' });
    }
});

// API endpoint to list character files in a specific campaign
router.get('/api/campaigns/:campaign', (req, res) => {
    const { campaign } = req.params;
    const campaignDir = path.join(process.cwd(), 'public', 'campaigns', campaign);
    
    try {
        const items = fs.readdirSync(campaignDir, { withFileTypes: true });
        const files = items
            .filter(item => item.isFile() && item.name.endsWith('.json'))
            .map(item => item.name)
            .sort();
        
        res.json({ files });
    } catch (error) {
        console.error('Error reading campaign directory:', error);
        res.status(500).json({ error: 'Failed to read campaign directory' });
    }
});

export default router;
