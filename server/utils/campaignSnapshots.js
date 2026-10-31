/**
 * Shared campaign snapshot machinery (extracted verbatim from
 * routes/campaigns-admin.js so the AI authoring service can take a
 * pre-apply restore point without duplicating the zip/prune logic —
 * plan .opencode/plans/ai-campaign-authoring.md Phase 2).
 *
 * Behavior is byte-identical to the admin routes it came from:
 *  - flush the change-data cache BEFORE zipping (saveFile) so in-memory
 *    rows are inside the restore point;
 *  - never zip the .snapshots dir itself;
 *  - keep at most SNAPSHOT_RETENTION restore points per campaign.
 */
import fs from 'fs';
import path from 'path';
import * as archiverLib from 'archiver';
import { campaignDir, campaignSnapshotDir, snapshotTimestamp } from './campaignPaths.js';
import { saveFile } from './changeData.js';

// Keep at most 4 restore points per campaign (owner cap 2026-10-28; pruned
// per-campaign in pruneSnapshots — the shared .snapshots/ dir holds every
// campaign's files but each prune pass only counts its own campaign's).
export const SNAPSHOT_RETENTION = 4;

export function listSnapshotFiles(campaign) {
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

export function pruneSnapshots(campaign) {
    const excess = listSnapshotFiles(campaign).slice(SNAPSHOT_RETENTION);
    for (const { filename } of excess) {
        fs.rmSync(path.join(campaignSnapshotDir(), filename), { force: true });
    }
}

export function createSnapshot(campaign) {
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
