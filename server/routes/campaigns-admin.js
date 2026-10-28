import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as archiverLib from 'archiver';
import extractZip from 'extract-zip';
import multerLib from 'multer';
import yauzlLib from 'yauzl';
import asyncHandler from '../utils/asyncHandler.js';
import { campaignDir, campaignMapsDir, campaignImagesDir, campaignDataDir, campaignDataFile, campaignSnapshotDir, campaignSnapshotFile, snapshotTimestamp } from '../utils/campaignPaths.js';
import { characterChangeData, spellOverlayData, activeMaps, saveFile, markDirty, publish, readFile } from '../utils/changeData.js';
import { logCache } from './log.js';

const router = express.Router();

const UPLOAD_SIZE_LIMIT = 100 * 1024 * 1024; // 100 MB — adjust as needed
const upload = multerLib({ storage: multerLib.memoryStorage(), limits: { fileSize: UPLOAD_SIZE_LIMIT } });

// Multer rejects oversized (and malformed) uploads BEFORE the route body
// runs, so its errors bypass the route's try/catch and would land on the
// default Express HTML error handler — leaking a full stack trace with
// absolute server paths. Convert them to the JSON error shape every other
// admin route uses. MulterError codes/messages are static library strings,
// safe to surface.
const uploadSingle = upload.single('file');
function uploadWithJsonErrors(req, res, next) {
    uploadSingle(req, res, (err) => {
        // Gate the Host before reading the error: a foreign client must get
        // the same 403 here that the route bodies enforce, never a
        // multer-detail leak.
        if (!isLocalhost(req)) {
            return res.status(403).json({ error: 'Only available on localhost' });
        }
        if (!err) return next();
        console.error(`Upload rejected for ${req.params.campaign}: ${err.message}`);
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: `File too large (limit ${UPLOAD_SIZE_LIMIT / (1024 * 1024)} MB)` });
        }
        if (err.name === 'MulterError') {
            return res.status(400).json({ error: err.message });
        }
        return res.status(400).json({ error: 'Upload failed: could not read the uploaded file' });
    });
}

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
    if (!isLocalhost(req)) {
        return res.status(403).json({ error: 'Only available on localhost' });
    }

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

// Move in-memory Maps keyed by campaign name from old to new
function migrateCampaignMemoryMaps(oldName, newName) {
    if (characterChangeData.has(oldName)) {
        characterChangeData.set(newName, characterChangeData.get(oldName));
        characterChangeData.delete(oldName);
    }
    if (spellOverlayData.has(oldName)) {
        spellOverlayData.set(newName, spellOverlayData.get(oldName));
        spellOverlayData.delete(oldName);
    }
    if (activeMaps.has(oldName)) {
        activeMaps.set(newName, activeMaps.get(oldName));
        activeMaps.delete(oldName);
    }
    if (logCache.has(oldName)) {
        logCache.set(newName, logCache.get(oldName));
        logCache.delete(oldName);
    }
}

function isCharacterJsonFile(file) {
    return file.endsWith('.json') && !file.startsWith('campaign-') && !file.startsWith('npcs') && !file.startsWith('quests') && !file.startsWith('factions') && !file.startsWith('settlements');
}

// Update imagePath fields in character JSON files after a campaign rename
function renameImagePathsInCharacterFiles(newCampaignDir, campaign) {
    try {
        const files = fs.readdirSync(newCampaignDir);
        for (const file of files) {
            if (!isCharacterJsonFile(file)) continue;
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
    } catch (err) {
        console.error(`Failed to update imagePath in character files:`, err.message);
    }
}

// Update imagePath fields in NPC data after a campaign rename
function renameImagePathsInNpcData(npcsPath, campaign) {
    try {
        if (!fs.existsSync(npcsPath)) return;
        const npcs = JSON.parse(fs.readFileSync(npcsPath, 'utf-8'));
        if (!Array.isArray(npcs)) return;
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
    } catch (err) {
        console.error(`Failed to update imagePath in NPC data:`, err.message);
    }
}

// API endpoint to rename a campaign directory
router.put('/api/campaigns/:campaign', asyncHandler((req, res) => {
    if (!isLocalhost(req)) {
        return res.status(403).json({ error: 'Only available on localhost' });
    }

    const { campaign } = req.params;
    const { newName } = req.body;

    if (!newName || newName.trim() === '') {
        return res.status(400).json({ error: 'New campaign name is required' });
    }

    const trimmedName = newName.trim();
    const oldCampaignDir = campaignDir(campaign);
    const newCampaignDir = campaignDir(trimmedName);

    if (!fs.existsSync(oldCampaignDir)) {
        return res.status(404).json({ error: 'Campaign not found' });
    }

    if (fs.existsSync(newCampaignDir)) {
        return res.status(400).json({ error: 'Campaign already exists' });
    }

    fs.renameSync(oldCampaignDir, newCampaignDir);

    migrateCampaignMemoryMaps(campaign, trimmedName);
    renameImagePathsInCharacterFiles(newCampaignDir, campaign);
    renameImagePathsInNpcData(campaignDataFile(trimmedName, 'npcs.json'), campaign);

    // Persist the migrated change data to the new campaign path
    saveFile();
    markDirty(trimmedName);

    res.json({ message: 'Campaign renamed successfully', campaignName: trimmedName });
}));

// API endpoint to delete a campaign and all its files/images
router.delete('/api/campaigns/:campaign', asyncHandler((req, res) => {
    if (!isLocalhost(req)) {
        return res.status(403).json({ error: 'Only available on localhost' });
    }

    const { campaign } = req.params;
    const dir = campaignDir(campaign);

    if (!fs.existsSync(dir)) {
        return res.status(404).json({ error: 'Campaign not found' });
    }

    // Remove the entire campaign directory
    fs.rmSync(dir, { recursive: true, force: true });

    // Purge in-memory maps so saveFile() sweeps cannot resurrect the deleted campaign
    characterChangeData.delete(campaign);
    spellOverlayData.delete(campaign);
    activeMaps.delete(campaign);
    logCache.delete(campaign);

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
    publish(`change-${campaign}-combatSummary`, null, campaign);

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
    publish(`log-${campaign}`, null, campaign);

    res.json({ message: 'Campaign log cleared' });
}));

// POST /api/campaigns/:campaign/admin/full-reset
async function fullResetClearFiles(campaign, dir, safetyPath) {
    const changeDataPath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'character-change-data.json');
    try {
        if (fs.existsSync(changeDataPath)) {
            fs.unlinkSync(changeDataPath);
        }
    } catch (err) {
        console.error(`Failed to delete change data file for ${campaign}:`, err.message);
        await extractZipToDir(safetyPath, dir);
        return 'Failed to clear change data';
    }
    characterChangeData.delete(campaign);
    activeMaps.delete(campaign);
    spellOverlayData.delete(campaign);
    publish(`change-${campaign}-combatSummary`, null, campaign);

    try {
        if (fs.existsSync(campaignDataFile(campaign, 'campaign-log.json'))) {
            fs.unlinkSync(campaignDataFile(campaign, 'campaign-log.json'));
        }
    } catch (err) {
        console.error(`Failed to delete log file for ${campaign}:`, err.message);
        await extractZipToDir(safetyPath, dir);
        return 'Failed to clear log';
    }
    logCache.delete(campaign);
    publish(`log-${campaign}`, null, campaign);
    return null;
}

router.post('/api/campaigns/:campaign/admin/full-reset', asyncHandler(async (req, res) => {
    if (!isLocalhost(req)) {
        return res.status(403).json({ error: 'Only available on localhost' });
    }

    const { campaign } = req.params;
    const dir = campaignDir(campaign);

    // Safety snapshot before destructive reset, recovered from if any step fails
    const safety = await createSnapshot(campaign);
    const safetyPath = path.join(campaignSnapshotDir(), safety.filename);

    const failure = await fullResetClearFiles(campaign, dir, safetyPath);
    reloadCampaign(campaign);

    if (failure) {
        return res.status(500).json({ error: failure });
    }
    res.json({ message: 'Full reset complete', snapshot: safety.filename });
}));

// --- Snapshot helpers ---

// Keep at most 4 restore points per campaign (owner cap 2026-10-28; pruned
// per-campaign in pruneSnapshots — the shared .snapshots/ dir holds every
// campaign's files but each prune pass only counts its own campaign's).
const SNAPSHOT_RETENTION = 4;

function listSnapshotFiles(campaign) {
    const snapshotDir = campaignSnapshotDir();
    if (!fs.existsSync(snapshotDir)) return [];

    const timestampedPrefix = `${campaign}-`;
    const legacyName = `${campaign}.zip`;

    return fs.readdirSync(snapshotDir)
        .filter((name) => name.endsWith('.zip') && (name.startsWith(timestampedPrefix) || name === legacyName))
        .map((filename) => {
            const stats = fs.statSync(path.join(snapshotDir, filename));
            return { filename, size: stats.size, timestamp: stats.mtime.toISOString() };
        })
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function pruneSnapshots(campaign) {
    const excess = listSnapshotFiles(campaign).slice(SNAPSHOT_RETENTION);
    for (const { filename } of excess) {
        fs.rmSync(path.join(campaignSnapshotDir(), filename), { force: true });
    }
}

function createSnapshot(campaign) {
    return new Promise((resolve, reject) => {
        saveFile();

        const snapshotDir = campaignSnapshotDir();
        if (!fs.existsSync(snapshotDir)) {
            fs.mkdirSync(snapshotDir, { recursive: true });
        }

        const filename = `${campaign}-${snapshotTimestamp()}.zip`;
        const snapshotPath = path.join(snapshotDir, filename);
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
            pruneSnapshots(campaign);
            resolve({ filename, size });
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

// Which snapshot a rollback restores. No `filename` in the body → the newest
// entry (legacy lane, exact prior behavior). A requested name must be a plain
// safe .zip name owned by THIS campaign (rejects path separators, '..', and
// foreign-campaign prefixes → 400) AND appear verbatim in the campaign's own
// freshly listed snapshots (rejects missing/pruned files → 404). Membership
// in that list is the authority; the safety pattern only sharpens the error.
function isSafeSnapshotName(campaign, filename) {
    if (typeof filename !== 'string') return false;
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) return false;
    if (!filename.endsWith('.zip')) return false;
    return filename === `${campaign}.zip` || filename.startsWith(`${campaign}-`);
}

// Returns `{ filename }` to restore, or `{ error }` (disk-inert — callers
// respond before touching anything). 404 for 'Snapshot not found'.
function selectRollbackSnapshot(campaign, snapshots, requested) {
    if (requested === undefined || requested === null) {
        return { filename: snapshots[0].filename };
    }
    if (!isSafeSnapshotName(campaign, requested)) {
        return { error: 'Invalid snapshot filename' };
    }
    if (!snapshots.some((s) => s.filename === requested)) {
        return { error: 'Snapshot not found', missing: true };
    }
    return { filename: requested };
}

function reloadCampaign(campaign) {
    readFile();
    logCache.delete(campaign);
    publish(`reload-${campaign}`, null, campaign);
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

    const { filename, size } = await createSnapshot(campaign);
    res.json({ message: 'Snapshot created', filename, size });
}));

// GET /api/campaigns/:campaign/admin/snapshots
router.get('/api/campaigns/:campaign/admin/snapshots', asyncHandler((req, res) => {
    if (!isLocalhost(req)) {
        return res.status(403).json({ error: 'Only available on localhost' });
    }

    const { campaign } = req.params;

    if (!fs.existsSync(campaignDir(campaign))) {
        return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({ snapshots: listSnapshotFiles(campaign) });
}));

// POST /api/campaigns/:campaign/admin/rollback
// Body (optional): { filename } — restore exactly that snapshot. Omitting it
// keeps the legacy newest-first behavior.
router.post('/api/campaigns/:campaign/admin/rollback', asyncHandler(async (req, res) => {
    if (!isLocalhost(req)) {
        return res.status(403).json({ error: 'Only available on localhost' });
    }

    const { campaign } = req.params;
    const dir = campaignDir(campaign);

    if (!fs.existsSync(dir)) {
        return res.status(404).json({ error: 'Campaign not found' });
    }

    // Newest timestamped snapshot first; legacy <campaign>.zip included in the list
    const snapshots = listSnapshotFiles(campaign);

    if (snapshots.length === 0) {
        return res.status(404).json({ error: 'No snapshot found' });
    }

    const requested = req.body?.filename;
    const target = selectRollbackSnapshot(campaign, snapshots, requested);
    if (target.error) {
        return res.status(target.missing ? 404 : 400).json({ error: target.error });
    }

    const snapshotPath = path.join(campaignSnapshotDir(), target.filename);

    // Flush in-memory data to disk before extracting snapshot
    saveFile();

    // Clear campaign folder and extract snapshot
    fs.rmSync(dir, { recursive: true, force: true });
    await extractZipToDir(snapshotPath, dir);
    reloadCampaign(campaign);

    res.json({ message: 'Rollback complete', restored: target.filename });
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

// --- Upload pre-flight inspection ---

// Top-level entries that are campaign data but never characters (the same
// exclusion set isCharacterJsonFile uses, plus the known entity data files
// that live at the archive root or under data/).
const KNOWN_CAMPAIGN_FILES = new Set(['npcs.json', 'quests.json', 'factions.json', 'settlements.json', 'sessions.json', 'notes.json', 'maps.json']);

// Judge a decoded zip entry path (slash-separated) as a recognizable piece of
// a campaign backup: the data/ folder, one of the known campaign data files,
// or a top-level character JSON (shared heuristic with isCharacterJsonFile).
function isRecognizableCampaignEntry(entryPath) {
    const segments = entryPath.split('/');
    if (segments[0] === 'data') return true;
    if (segments.length > 1) return false;
    const name = segments[0];
    if (KNOWN_CAMPAIGN_FILES.has(name)) return true;
    return isCharacterJsonFile(name);
}

// Read-only listing of a zip buffer's entry paths via yauzl (extract-zip's
// own dependency — no new npm dependency). Rejects when the buffer cannot be
// parsed as a zip archive.
function readZipEntryPaths(buffer) {
    return new Promise((resolve, reject) => {
        yauzlLib.fromBuffer(buffer, { lazyEntries: true }, (err, zipFile) => {
            if (err || !zipFile) return reject(err || new Error('Could not open the archive'));
            const names = [];
            zipFile.on('entry', (entry) => {
                names.push(entry.fileName);
                zipFile.readEntry();
            });
            zipFile.on('end', () => resolve(names));
            zipFile.on('error', reject);
            zipFile.readEntry();
        });
    });
}

// POST /api/campaigns/:campaign/admin/upload-inspect
// Dry-run companion of /admin/upload: reads the archive's entry names only,
// never touches campaign data, so the client can reject empty/foreign zips
// BEFORE the destructive confirm-and-replace flow.
router.post('/api/campaigns/:campaign/admin/upload-inspect', uploadWithJsonErrors, asyncHandler(async (req, res) => {
    if (!isLocalhost(req)) {
        return res.status(403).json({ error: 'Only available on localhost' });
    }

    const { campaign } = req.params;

    if (!fs.existsSync(campaignDir(campaign))) {
        return res.status(404).json({ error: 'Campaign not found' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    let entryPaths;
    try {
        entryPaths = await readZipEntryPaths(req.file.buffer);
    } catch (err) {
        console.error(`Upload inspect could not read archive for ${campaign}: ${err.message}`);
        return res.status(400).json({ error: 'Could not read the archive — it is not a valid zip file' });
    }

    const recognizable = entryPaths.filter(isRecognizableCampaignEntry);
    res.json({
        entryCount: entryPaths.length,
        recognizableCount: recognizable.length,
        recognizable: recognizable.slice(0, 10),
    });
}));

// POST /api/campaigns/:campaign/admin/upload
router.post('/api/campaigns/:campaign/admin/upload', uploadWithJsonErrors, asyncHandler(async (req, res) => {
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
    let safetySnapshotPath = null;

    try {
        // Flush in-memory data and create timestamped safety snapshot
        const safety = await createSnapshot(campaign);
        safetySnapshotPath = path.join(campaignSnapshotDir(), safety.filename);

        // Write uploaded buffer to temp file for extraction
        fs.writeFileSync(tempZipPath, req.file.buffer);

        // Clear campaign folder and extract uploaded zip
        fs.rmSync(dir, { recursive: true, force: true });
        await extractZipToDir(tempZipPath, dir);

        // Clean up temp file
        fs.unlinkSync(tempZipPath);

        // Reload campaign state
        reloadCampaign(campaign);

        res.json({ message: 'Upload complete', snapshot: safetySnapshotPath ? path.basename(safetySnapshotPath) : null });
    } catch (err) {
        console.error(`Upload failed for ${campaign}:`, err.message);

        // Attempt recovery: restore from the safety snapshot just created
        try {
            const recoveryPath = safetySnapshotPath || campaignSnapshotFile(campaign);
            fs.rmSync(dir, { recursive: true, force: true });
            if (fs.existsSync(recoveryPath)) {
                await extractZipToDir(recoveryPath, dir);
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
