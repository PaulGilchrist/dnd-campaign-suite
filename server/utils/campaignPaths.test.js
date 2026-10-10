import path from 'path';
import fs from 'fs';
import * as campaignPaths from '../utils/campaignPaths.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Capture __dirname / ROOT for assertions
// The module computes:
//   __dirname = path.dirname(fileURLToPath(import.meta.url))
//   ROOT = path.resolve(__dirname, '..', '..')
// which resolves to the project root (two levels up from server/utils/)

// ---------------------------------------------------------------------------
// campaignsRoot
// ---------------------------------------------------------------------------
describe('campaignPaths - campaignsRoot', () => {
    it('should be a function', () => {
        expect(typeof campaignPaths.campaignsRoot).toBe('function');
    });

    it('should return the campaigns root path', () => {
        const result = campaignPaths.campaignsRoot();
        expect(result).toBe(path.resolve(process.cwd(), 'public', 'campaigns'));
    });

    it('should always return the same path (deterministic)', () => {
        const r1 = campaignPaths.campaignsRoot();
        const r2 = campaignPaths.campaignsRoot();
        expect(r1).toBe(r2);
    });
});

// ---------------------------------------------------------------------------
// campaignDir
// ---------------------------------------------------------------------------
describe('campaignPaths - campaignDir', () => {
    it('should be a function', () => {
        expect(typeof campaignPaths.campaignDir).toBe('function');
    });

    it('should return the correct path for a campaign', () => {
        const result = campaignPaths.campaignDir('test-campaign');
        expect(result).toBe(path.resolve(process.cwd(), 'public', 'campaigns', 'test-campaign'));
    });

    it('should handle campaign names with hyphens', () => {
        const result = campaignPaths.campaignDir('my-test-campaign');
        expect(result).toContain('my-test-campaign');
    });

    it('should handle campaign names with underscores', () => {
        const result = campaignPaths.campaignDir('my_campaign');
        expect(result).toContain('my_campaign');
    });

    it('should handle campaign names with numbers', () => {
        const result = campaignPaths.campaignDir('campaign-2024');
        expect(result).toContain('campaign-2024');
    });

    it('should handle campaign names with spaces', () => {
        const result = campaignPaths.campaignDir('my campaign');
        expect(result).toContain('my campaign');
    });

    it('should return an empty-string-based path for empty campaign name', () => {
        const result = campaignPaths.campaignDir('');
        expect(result).toBe(path.resolve(process.cwd(), 'public', 'campaigns', ''));
    });
});

// ---------------------------------------------------------------------------
// campaignDataDir
// ---------------------------------------------------------------------------
describe('campaignPaths - campaignDataDir', () => {
    it('should be a function', () => {
        expect(typeof campaignPaths.campaignDataDir).toBe('function');
    });

    it('should return the data subdirectory path', () => {
        const result = campaignPaths.campaignDataDir('test-campaign');
        expect(result).toBe(path.resolve(process.cwd(), 'public', 'campaigns', 'test-campaign', 'data'));
    });

    it('should nest correctly under campaignDir', () => {
        const result = campaignPaths.campaignDataDir('test');
        // Should end with /data
        expect(result.endsWith(path.join('public', 'campaigns', 'test', 'data'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// campaignDataFile
// ---------------------------------------------------------------------------
describe('campaignPaths - campaignDataFile', () => {
    it('should be a function', () => {
        expect(typeof campaignPaths.campaignDataFile).toBe('function');
    });

    it('should return the full path to a data file', () => {
        const result = campaignPaths.campaignDataFile('test-campaign', 'character.json');
        expect(result).toBe(path.resolve(process.cwd(), 'public', 'campaigns', 'test-campaign', 'data', 'character.json'));
    });

    it('should handle file names with multiple dots', () => {
        const result = campaignPaths.campaignDataFile('campaign', 'backup.v1.json');
        expect(result.endsWith(path.join('data', 'backup.v1.json'))).toBe(true);
    });

    it('should handle file names with hyphens', () => {
        const result = campaignPaths.campaignDataFile('campaign', 'save-file.json');
        expect(result.endsWith(path.join('data', 'save-file.json'))).toBe(true);
    });

    it('should handle file names with underscores', () => {
        const result = campaignPaths.campaignDataFile('campaign', 'save_file.json');
        expect(result.endsWith(path.join('data', 'save_file.json'))).toBe(true);
    });

    it('should handle empty campaign name', () => {
        const result = campaignPaths.campaignDataFile('', 'data.json');
        expect(result).toContain(path.join('public', 'campaigns', '', 'data', 'data.json'));
    });

    it('should handle empty file name', () => {
        const result = campaignPaths.campaignDataFile('campaign', '');
        expect(result.endsWith(path.join('data', ''))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// campaignMapsDir
// ---------------------------------------------------------------------------
describe('campaignPaths - campaignMapsDir', () => {
    it('should be a function', () => {
        expect(typeof campaignPaths.campaignMapsDir).toBe('function');
    });

    it('should return the maps subdirectory path', () => {
        const result = campaignPaths.campaignMapsDir('test-campaign');
        expect(result).toBe(path.resolve(process.cwd(), 'public', 'campaigns', 'test-campaign', 'maps'));
    });

    it('should nest correctly under campaignDir', () => {
        const result = campaignPaths.campaignMapsDir('test');
        expect(result.endsWith(path.join('public', 'campaigns', 'test', 'maps'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// campaignImagesDir
// ---------------------------------------------------------------------------
describe('campaignPaths - campaignImagesDir', () => {
    it('should be a function', () => {
        expect(typeof campaignPaths.campaignImagesDir).toBe('function');
    });

    it('should return the images subdirectory path', () => {
        const result = campaignPaths.campaignImagesDir('test-campaign');
        expect(result).toBe(path.resolve(process.cwd(), 'public', 'campaigns', 'test-campaign', 'images'));
    });

    it('should nest correctly under campaignDir', () => {
        const result = campaignPaths.campaignImagesDir('test');
        expect(result.endsWith(path.join('public', 'campaigns', 'test', 'images'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// ensureDataDir
// ---------------------------------------------------------------------------
describe('campaignPaths - ensureDataDir', () => {
    it('should be a function', () => {
        expect(typeof campaignPaths.ensureDataDir).toBe('function');
    });

    it('should return the data directory path', () => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const result = campaignPaths.ensureDataDir('test-campaign');
        expect(result).toBe(path.resolve(process.cwd(), 'public', 'campaigns', 'test-campaign', 'data'));
        fs.existsSync.mockRestore();
    });

    it('should not throw when directory already exists', () => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);

        expect(() => campaignPaths.ensureDataDir('existing-campaign')).not.toThrow();

        fs.existsSync.mockRestore();
    });

    it('should create the directory when it does not exist', () => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(false);
        const mkdirSyncSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => { /* no-op */ });

        campaignPaths.ensureDataDir('new-campaign');

        expect(mkdirSyncSpy).toHaveBeenCalledWith(
            expect.stringContaining('new-campaign'),
            { recursive: true },
        );

        mkdirSyncSpy.mockRestore();
        fs.existsSync.mockRestore();
    });

    it('should call existsSync with the data directory path', () => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);

        campaignPaths.ensureDataDir('test-campaign');

        expect(fs.existsSync).toHaveBeenCalledWith(
            expect.stringContaining('test-campaign'),
        );

        fs.existsSync.mockRestore();
    });

    it('should call mkdirSync with recursive option', () => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(false);
        const mkdirSyncSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => { /* no-op */ });

        campaignPaths.ensureDataDir('recursive-test');

        expect(mkdirSyncSpy).toHaveBeenCalledWith(
            expect.any(String),
            { recursive: true },
        );

        mkdirSyncSpy.mockRestore();
        fs.existsSync.mockRestore();
    });

    it('should return the correct path after creating directory', () => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(false);
        vi.spyOn(fs, 'mkdirSync').mockImplementation(() => { /* no-op */ });

        const result = campaignPaths.ensureDataDir('created-campaign');
        expect(result).toBe(path.resolve(process.cwd(), 'public', 'campaigns', 'created-campaign', 'data'));

        fs.existsSync.mockRestore();
        fs.mkdirSync.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// normalizeMapFile
// ---------------------------------------------------------------------------
describe('campaignPaths - normalizeMapFile', () => {
    it('should be a function', () => {
        expect(typeof campaignPaths.normalizeMapFile).toBe('function');
    });

    it('should append .json when name does not have it', () => {
        const result = campaignPaths.normalizeMapFile('map1');
        expect(result).toBe('map1.json');
    });

    it('should return the name unchanged when it already ends with .json', () => {
        const result = campaignPaths.normalizeMapFile('map1.json');
        expect(result).toBe('map1.json');
    });

    it('should handle names with dots that do not end in .json', () => {
        const result = campaignPaths.normalizeMapFile('map.v1');
        expect(result).toBe('map.v1.json');
    });

    it('should handle names with multiple dots ending in .json', () => {
        const result = campaignPaths.normalizeMapFile('map.backup.json');
        expect(result).toBe('map.backup.json');
    });

    it('should handle empty string', () => {
        const result = campaignPaths.normalizeMapFile('');
        expect(result).toBe('.json');
    });

    it('should handle names with hyphens', () => {
        const result = campaignPaths.normalizeMapFile('my-map');
        expect(result).toBe('my-map.json');
    });

    it('should handle names with underscores', () => {
        const result = campaignPaths.normalizeMapFile('my_map');
        expect(result).toBe('my_map.json');
    });

    it('should handle names with spaces', () => {
        const result = campaignPaths.normalizeMapFile('my map');
        expect(result).toBe('my map.json');
    });

    it('should be case-sensitive for .json extension', () => {
        const result = campaignPaths.normalizeMapFile('map.JSON');
        expect(result).toBe('map.JSON.json');
    });

    it('should handle single character name', () => {
        const result = campaignPaths.normalizeMapFile('a');
        expect(result).toBe('a.json');
    });
});

// ---------------------------------------------------------------------------
// campaignSnapshotDir
// ---------------------------------------------------------------------------
describe('campaignPaths - campaignSnapshotDir', () => {
    it('should be a function', () => {
        expect(typeof campaignPaths.campaignSnapshotDir).toBe('function');
    });

    it('should return the snapshots subdirectory path inside campaigns root', () => {
        const result = campaignPaths.campaignSnapshotDir();
        expect(result).toBe(path.resolve(process.cwd(), 'public', 'campaigns', '.snapshots'));
    });

    it('should always return the same path (no parameters)', () => {
        const r1 = campaignPaths.campaignSnapshotDir();
        const r2 = campaignPaths.campaignSnapshotDir();
        expect(r1).toBe(r2);
    });

    it('should end with .snapshots', () => {
        const result = campaignPaths.campaignSnapshotDir();
        expect(result.endsWith(path.join('public', 'campaigns', '.snapshots'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// campaignSnapshotFile
// ---------------------------------------------------------------------------
describe('campaignPaths - campaignSnapshotFile', () => {
    it('should be a function', () => {
        expect(typeof campaignPaths.campaignSnapshotFile).toBe('function');
    });

    it('should return the snapshot zip file path', () => {
        const result = campaignPaths.campaignSnapshotFile('test-campaign');
        expect(result).toBe(path.resolve(process.cwd(), 'public', 'campaigns', '.snapshots', 'test-campaign.zip'));
    });

    it('should handle campaign names with hyphens', () => {
        const result = campaignPaths.campaignSnapshotFile('my-test-campaign');
        expect(result.endsWith(path.join('.snapshots', 'my-test-campaign.zip'))).toBe(true);
    });

    it('should handle campaign names with underscores', () => {
        const result = campaignPaths.campaignSnapshotFile('my_campaign');
        expect(result.endsWith(path.join('.snapshots', 'my_campaign.zip'))).toBe(true);
    });

    it('should handle empty campaign name', () => {
        const result = campaignPaths.campaignSnapshotFile('');
        expect(result.endsWith(path.join('.snapshots', '.zip'))).toBe(true);
    });

    it('should always return a .zip file', () => {
        const result = campaignPaths.campaignSnapshotFile('test');
        expect(result.endsWith('.zip')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Path consistency / integration checks
// ---------------------------------------------------------------------------
describe('campaignPaths - path consistency', () => {
    it('campaignDataDir should be inside campaignDir', () => {
        const dir = campaignPaths.campaignDir('test');
        const dataDir = campaignPaths.campaignDataDir('test');
        expect(dataDir).toContain(dir);
    });

    it('campaignMapsDir should be inside campaignDir', () => {
        const dir = campaignPaths.campaignDir('test');
        const mapsDir = campaignPaths.campaignMapsDir('test');
        expect(mapsDir).toContain(dir);
    });

    it('campaignImagesDir should be inside campaignDir', () => {
        const dir = campaignPaths.campaignDir('test');
        const imagesDir = campaignPaths.campaignImagesDir('test');
        expect(imagesDir).toContain(dir);
    });

    it('campaignDataFile should be inside campaignDataDir', () => {
        const dataDir = campaignPaths.campaignDataDir('test');
        const dataFile = campaignPaths.campaignDataFile('test', 'file.json');
        expect(dataFile).toContain(dataDir);
    });

    it('campaignSnapshotFile should be inside campaignSnapshotDir', () => {
        const snapDir = campaignPaths.campaignSnapshotDir();
        const snapFile = campaignPaths.campaignSnapshotFile('test');
        expect(snapFile).toContain(snapDir);
    });

    it('campaignsRoot should be the parent of campaignDir', () => {
        const root = campaignPaths.campaignsRoot();
        const dir = campaignPaths.campaignDir('test');
        expect(dir).toContain(root);
    });
});

// ---------------------------------------------------------------------------
// snapshotTimestamp / campaignTimestampedSnapshotFile
// ---------------------------------------------------------------------------
describe('campaignPaths - snapshotTimestamp', () => {
    it('should format a deterministic lexicographically sortable timestamp', () => {
        const ts = campaignPaths.snapshotTimestamp(new Date('2026-10-10T12:34:56.789Z'));
        expect(ts).toBe('2026-10-10T12-34-56-789');
    });

    it('should sort chronologically as strings', () => {
        const a = campaignPaths.snapshotTimestamp(new Date('2026-10-10T00:00:00.000Z'));
        const b = campaignPaths.snapshotTimestamp(new Date('2026-10-10T23:59:59.999Z'));
        expect(a < b).toBe(true);
    });

    it('should contain no colons, dots, or slashes (filename safe)', () => {
        const ts = campaignPaths.snapshotTimestamp();
        expect(ts).not.toMatch(/[:./]/);
    });
});

describe('campaignPaths - campaignTimestampedSnapshotFile', () => {
    it('should build a timestamped archive path', () => {
        const result = campaignPaths.campaignTimestampedSnapshotFile('test-campaign', '2026-10-10T12-34-56-789');
        expect(result).toBe(path.resolve(process.cwd(), 'public', 'campaigns', '.snapshots', 'test-campaign-2026-10-10T12-34-56-789.zip'));
    });
});
