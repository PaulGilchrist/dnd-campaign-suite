import express from 'express';
import fs from 'fs';
import path from 'path';
import asyncHandler from '../utils/asyncHandler.js';
import { campaignDir, campaignImagesDir, campaignDataDir, campaignDataFile } from '../utils/campaignPaths.js';
import { characterChangeData, spellOverlayData, activeMaps, saveFile, markDirty } from '../utils/changeData.js';

const router = express.Router();

// API endpoint to migrate all existing campaign imagePath fields to relative format
router.post('/api/campaigns/migrate-image-paths', asyncHandler((req, res) => {
    const campaignsDir = path.join(process.cwd(), 'public', 'campaigns');
    if (!fs.existsSync(campaignsDir)) {
        return res.json({ message: 'No campaigns directory found' });
    }

    const campaignNames = fs.readdirSync(campaignsDir).filter(f => fs.statSync(path.join(campaignsDir, f)).isDirectory());
    let migrated = 0;

    for (const campaignName of campaignNames) {
        const campaignDirPath = path.join(campaignsDir, campaignName);
        const files = fs.readdirSync(campaignDirPath);

        // Migrate character JSON files
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            const filePath = path.join(campaignDirPath, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);

            if (data.imagePath && typeof data.imagePath === 'string' && data.imagePath.includes('campaigns/')) {
                data.imagePath = data.imagePath.replace(`campaigns/${campaignName}/images`, 'images');
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                migrated++;
            }
        }

        // Migrate NPC data
        const npcsPath = path.join(campaignDirPath, 'data', 'npcs.json');
        if (fs.existsSync(npcsPath)) {
            const npcsContent = fs.readFileSync(npcsPath, 'utf8');
            const npcs = JSON.parse(npcsContent);
            let changed = false;
            for (const npc of npcs) {
                if (npc.imagePath && typeof npc.imagePath === 'string' && npc.imagePath.includes('campaigns/')) {
                    npc.imagePath = npc.imagePath.replace(`campaigns/${campaignName}/images`, 'images');
                    changed = true;
                    migrated++;
                }
            }
            if (changed) {
                fs.writeFileSync(npcsPath, JSON.stringify(npcs, null, 2));
            }
        }
    }

    res.json({ message: `Migration complete. Migrated ${migrated} imagePath fields.` });
}));


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

    // Migrate in-memory Maps from old campaign name to new
    if (characterChangeData.has(campaign)) {
        characterChangeData.set(newName.trim(), characterChangeData.get(campaign));
        characterChangeData.delete(campaign);
    }
    if (spellOverlayData.has(campaign)) {
        spellOverlayData.set(newName.trim(), spellOverlayData.get(campaign));
        spellOverlayData.delete(campaign);
    }
    if (activeMaps.has(campaign)) {
        activeMaps.set(newName.trim(), activeMaps.get(campaign));
        activeMaps.delete(campaign);
    }

    // Update imagePath fields in character JSON files
    try {
        const files = fs.readdirSync(newCampaignDir);
        for (const file of files) {
            if (file.endsWith('.json') && !file.startsWith('campaign-') && !file.startsWith('npcs') && !file.startsWith('quests') && !file.startsWith('factions') && !file.startsWith('settlements')) {
                const filePath = path.join(newCampaignDir, file);
                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    if (data.imagePath && typeof data.imagePath === 'string' && data.imagePath.includes('campaigns/')) {
                        data.imagePath = data.imagePath.replace(`campaigns/${campaign}`, 'images');
                        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                    }
                } catch (_err) {
                    // Skip files that can't be parsed as JSON
                }
            }
        }
    } catch (err) {
        console.error(`Failed to update imagePath in character files:`, err.message);
    }

    // Update imagePath fields in NPC data
    const npcsPath = campaignDataFile(newName.trim(), 'npcs.json');
    try {
        if (fs.existsSync(npcsPath)) {
            const npcs = JSON.parse(fs.readFileSync(npcsPath, 'utf-8'));
            if (Array.isArray(npcs)) {
                let changed = false;
                for (const npc of npcs) {
                    if (npc.imagePath && typeof npc.imagePath === 'string' && npc.imagePath.includes('campaigns/')) {
                        npc.imagePath = npc.imagePath.replace(`campaigns/${campaign}`, 'images');
                        changed = true;
                    }
                }
                if (changed) {
                    fs.writeFileSync(npcsPath, JSON.stringify(npcs, null, 2));
                }
            }
        }
    } catch (err) {
        console.error(`Failed to update imagePath in NPC data:`, err.message);
    }

    // Persist the migrated change data to the new campaign path
    saveFile();
    markDirty(newName.trim());

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
