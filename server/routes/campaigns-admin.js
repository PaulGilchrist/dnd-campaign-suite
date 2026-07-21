import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as archiverLib from 'archiver';
import extractZip from 'extract-zip';
import multerLib from 'multer';
import asyncHandler from '../utils/asyncHandler.js';
import { campaignDir, campaignMapsDir, campaignImagesDir, campaignDataDir, campaignDataFile, campaignSnapshotDir, campaignSnapshotFile } from '../utils/campaignPaths.js';
import { characterChangeData, spellOverlayData, activeMaps, saveFile, markDirty, publish, readFile } from '../utils/changeData.js';
import { logCache } from './log.js';

const router = express.Router();

const UPLOAD_SIZE_LIMIT = 100 * 1024 * 1024; // 100 MB — adjust as needed
const upload = multerLib({ storage: multerLib.memoryStorage(), limits: { fileSize: UPLOAD_SIZE_LIMIT } });

function isLocalhost(req) {
    return req.hostname === 'localhost' || req.hostname === '127.0.0.1';
}

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

// POST /api/campaigns/:campaign/admin/clear-change-data
router.post('/api/campaigns/:campaign/admin/clear-change-data', asyncHandler((req, res) => {
    if (!isLocalhost(req)) {
        return res.status(403).json({ error: 'Only available on localhost' });
    }

    const { campaign } = req.params;
    const filePath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'character-change-data.json');

    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        console.error(`Failed to delete change data file for ${campaign}:`, err.message);
        return res.status(500).json({ error: 'Failed to delete change data file' });
    }

    characterChangeData.delete(campaign);
    activeMaps.delete(campaign);
    spellOverlayData.delete(campaign);
    publish(`change-${campaign}-combatSummary`, null);

    res.json({ message: 'Change data cleared' });
}));

// POST /api/campaigns/:campaign/admin/clear-log
router.post('/api/campaigns/:campaign/admin/clear-log', asyncHandler((req, res) => {
    if (!isLocalhost(req)) {
        return res.status(403).json({ error: 'Only available on localhost' });
    }

    const { campaign } = req.params;
    const filePath = campaignDataFile(campaign, 'campaign-log.json');

    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        console.error(`Failed to delete log file for ${campaign}:`, err.message);
        return res.status(500).json({ error: 'Failed to delete log file' });
    }

    logCache.delete(campaign);
    publish(`log-${campaign}`, null);

    res.json({ message: 'Campaign log cleared' });
}));

// POST /api/campaigns/:campaign/admin/full-reset
router.post('/api/campaigns/:campaign/admin/full-reset', asyncHandler((req, res) => {
    if (!isLocalhost(req)) {
        return res.status(403).json({ error: 'Only available on localhost' });
    }

    const { campaign } = req.params;

    const changeDataPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'character-change-data.json');
    try {
        if (fs.existsSync(changeDataPath)) {
            fs.unlinkSync(changeDataPath);
        }
    } catch (err) {
        console.error(`Failed to delete change data file for ${campaign}:`, err.message);
        return res.status(500).json({ error: 'Failed to clear change data' });
    }
    characterChangeData.delete(campaign);
    activeMaps.delete(campaign);
    spellOverlayData.delete(campaign);
    publish(`change-${campaign}-combatSummary`, null);

    try {
        if (fs.existsSync(campaignDataFile(campaign, 'campaign-log.json'))) {
            fs.unlinkSync(campaignDataFile(campaign, 'campaign-log.json'));
        }
    } catch (err) {
        console.error(`Failed to delete log file for ${campaign}:`, err.message);
        return res.status(500).json({ error: 'Failed to clear log' });
    }
    logCache.delete(campaign);
    publish(`log-${campaign}`, null);

    res.json({ message: 'Full reset complete' });
}));

// --- Snapshot helpers ---

function createSnapshot(campaign) {
    return new Promise((resolve, reject) => {
        saveFile();

        const snapshotDir = campaignSnapshotDir();
        if (!fs.existsSync(snapshotDir)) {
            fs.mkdirSync(snapshotDir, { recursive: true });
        }

        const snapshotPath = campaignSnapshotFile(campaign);
        const archive = new archiverLib.ZipArchive({ zlib: { level: 9 } });
        const outputStream = fs.createWriteStream(snapshotPath);

        const rejectWith = (err) => {
            archive.abort();
            reject(err);
        };

        archive.on('error', rejectWith);
        outputStream.on('error', rejectWith);

        archive.pipe(outputStream);
        archive.directory(campaignDir(campaign), false, (entry) => {
            if (entry.name.includes('.snapshots')) {
                return false;
            }
            return entry;
        });
        archive.finalize();

        archive.on('end', () => {
            const size = outputStream.bytesWritten;
            resolve(size);
        });
    });
}

function extractZipToDir(source, targetDir) {
    return new Promise((resolve, reject) => {
        extractZip(source, { dir: targetDir })
            .then(resolve)
            .catch(reject);
    });
}

function reloadCampaign(campaign) {
    readFile();
    logCache.delete(campaign);
    publish(`reload-${campaign}`, null);
}

// POST /api/campaigns/:campaign/admin/snapshot
router.post('/api/campaigns/:campaign/admin/snapshot', asyncHandler(async (req, res) => {
    if (!isLocalhost(req)) {
        return res.status(403).json({ error: 'Only available on localhost' });
    }

    const { campaign } = req.params;
    const dir = campaignDir(campaign);

    if (!fs.existsSync(dir)) {
        return res.status(404).json({ error: 'Campaign not found' });
    }

    const size = await createSnapshot(campaign);
    res.json({ message: 'Snapshot created', size });
}));

// POST /api/campaigns/:campaign/admin/rollback
router.post('/api/campaigns/:campaign/admin/rollback', asyncHandler(async (req, res) => {
    if (!isLocalhost(req)) {
        return res.status(403).json({ error: 'Only available on localhost' });
    }

    const { campaign } = req.params;
    const dir = campaignDir(campaign);
    const snapshotPath = campaignSnapshotFile(campaign);

    if (!fs.existsSync(dir)) {
        return res.status(404).json({ error: 'Campaign not found' });
    }

    if (!fs.existsSync(snapshotPath)) {
        return res.status(404).json({ error: 'No snapshot found' });
    }

    // Flush in-memory data to disk before extracting snapshot
    saveFile();

    // Clear campaign folder and extract snapshot
    fs.rmSync(dir, { recursive: true, force: true });
    await extractZipToDir(snapshotPath, dir);
    reloadCampaign(campaign);

    res.json({ message: 'Rollback complete' });
}));

// GET /api/campaigns/:campaign/admin/download
router.get('/api/campaigns/:campaign/admin/download', asyncHandler(async (req, res) => {
    if (!isLocalhost(req)) {
        return res.status(403).json({ error: 'Only available on localhost' });
    }

    const { campaign } = req.params;
    const dir = campaignDir(campaign);

    if (!fs.existsSync(dir)) {
        return res.status(404).json({ error: 'Campaign not found' });
    }

    // Flush in-memory data before creating zip
    saveFile();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${campaign}.zip"`);

    const archive = new archiverLib.ZipArchive({ zlib: { level: 9 } });
    archive.on('error', (err) => {
        console.error('Archive error:', err.message);
        res.status(500).json({ error: 'Failed to create archive' });
    });

    archive.pipe(res);
    archive.directory(dir, false, (entry) => {
        if (entry.name.includes('.snapshots')) {
            return false;
        }
        return entry;
    });
    archive.finalize();
}));

// POST /api/campaigns/:campaign/admin/upload
router.post('/api/campaigns/:campaign/admin/upload', upload.single('file'), asyncHandler(async (req, res) => {
    if (!isLocalhost(req)) {
        return res.status(403).json({ error: 'Only available on localhost' });
    }

    const { campaign } = req.params;
    const dir = campaignDir(campaign);

    if (!fs.existsSync(dir)) {
        return res.status(404).json({ error: 'Campaign not found' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const tempZipPath = path.join(os.tmpdir(), `campaign-upload-${Date.now()}.zip`);

    try {
        // Flush in-memory data and create safety snapshot
        saveFile();
        await createSnapshot(campaign);

        // Write uploaded buffer to temp file for extraction
        fs.writeFileSync(tempZipPath, req.file.buffer);

        // Clear campaign folder and extract uploaded zip
        fs.rmSync(dir, { recursive: true, force: true });
        await extractZipToDir(tempZipPath, dir);

        // Clean up temp file
        fs.unlinkSync(tempZipPath);

        // Reload campaign state
        reloadCampaign(campaign);

        res.json({ message: 'Upload complete' });
    } catch (err) {
        console.error(`Upload failed for ${campaign}:`, err.message);

        // Attempt recovery: restore from safety snapshot
        try {
            fs.rmSync(dir, { recursive: true, force: true });
            const snapshotPath = campaignSnapshotFile(campaign);
            if (fs.existsSync(snapshotPath)) {
                await extractZipToDir(snapshotPath, dir);
            }
        } catch (recoveryErr) {
            console.error(`Recovery also failed for ${campaign}:`, recoveryErr.message);
        }

        // Clean up temp file if it still exists
        try {
            if (fs.existsSync(tempZipPath)) {
                fs.unlinkSync(tempZipPath);
            }
        } catch (_cleanupErr) {
            // Ignore cleanup errors
        }

        // Reload campaign state from recovered files
        reloadCampaign(campaign);

        res.status(500).json({
            error: 'Upload failed, rolled back to previous state',
            details: err.message
        });
    }
}));

export default router;
