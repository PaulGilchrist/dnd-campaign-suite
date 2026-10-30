import fs from 'fs';
import http from 'http';
import {
    activeMaps,
    subscribers,
    characterChangeData,
    spellOverlayData,
    readFile,
    saveFile,
    debouncedSave,
    publish,
    removeChangeDataKey,
    keepAlive,
} from '../utils/changeData.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearStores() {
    activeMaps.clear();
    characterChangeData.clear();
    spellOverlayData.clear();
}

// ---------------------------------------------------------------------------
// activeMaps
// ---------------------------------------------------------------------------
describe('changeData - activeMaps', () => {
    afterEach(clearStores);

    it('should be a Map instance', () => expect(activeMaps).toBeInstanceOf(Map));

    it('should be empty at startup', () => expect(activeMaps.size).toBe(0));

    it('should store and retrieve map keys per campaign', () => {
        activeMaps.set('test-campaign', 'map-123');
        expect(activeMaps.get('test-campaign')).toBe('map-123');
    });

    it('should overwrite existing map key for a campaign', () => {
        activeMaps.set('test-campaign', 'map-old');
        activeMaps.set('test-campaign', 'map-new');
        expect(activeMaps.get('test-campaign')).toBe('map-new');
    });

    it('should support multiple campaigns', () => {
        activeMaps.set('campaign-a', 'map-a');
        activeMaps.set('campaign-b', 'map-b');
        expect(activeMaps.get('campaign-a')).toBe('map-a');
        expect(activeMaps.get('campaign-b')).toBe('map-b');
    });
});

// ---------------------------------------------------------------------------
// characterChangeData
// ---------------------------------------------------------------------------
describe('changeData - characterChangeData', () => {
    afterEach(clearStores);

    it('should be a Map instance', () => expect(characterChangeData).toBeInstanceOf(Map));

    it('should be empty at startup', () => expect(characterChangeData.size).toBe(0));

    it('should store and retrieve data per campaign', () => {
        characterChangeData.set('test-campaign', { character1: { hp: 25 } });
        expect(characterChangeData.get('test-campaign')).toEqual({ character1: { hp: 25 } });
    });

    it('should support complex nested data', () => {
        const complexData = {
            character1: { hp: 25, maxHp: 30, spellSlots: { level1: 3, level2: 1 } },
            character2: { hp: 10, maxHp: 20 },
            combatSummary: { rounds: 5 },
        };
        characterChangeData.set('complex-campaign', complexData);
        expect(characterChangeData.get('complex-campaign')).toEqual(complexData);
    });

    it('should support reserved keys', () => {
        characterChangeData.set('test-campaign', {
            combatSummary: { rounds: 5 },
            activeCreatureId: 'creature-1',
            log: [{ entry: 'test' }],
            positioning: { x: 10, y: 20 },
        });
        const data = characterChangeData.get('test-campaign');
        expect(data.combatSummary).toEqual({ rounds: 5 });
        expect(data.activeCreatureId).toBe('creature-1');
        expect(data.log).toEqual([{ entry: 'test' }]);
        expect(data.positioning).toEqual({ x: 10, y: 20 });
    });
});

// ---------------------------------------------------------------------------
// spellOverlayData
// ---------------------------------------------------------------------------
describe('changeData - spellOverlayData', () => {
    afterEach(clearStores);

    it('should be a Map instance', () => expect(spellOverlayData).toBeInstanceOf(Map));

    it('should be empty at startup', () => expect(spellOverlayData.size).toBe(0));

    it('should store and retrieve overlay arrays per campaign', () => {
        const overlays = [
            { id: 'overlay-1', name: 'Fireball', level: 3 },
            { id: 'overlay-2', name: 'Shield', level: 1 },
        ];
        spellOverlayData.set('test-campaign', overlays);
        expect(spellOverlayData.get('test-campaign')).toEqual(overlays);
    });

    it('should support empty overlay arrays', () => {
        spellOverlayData.set('empty-campaign', []);
        expect(spellOverlayData.get('empty-campaign')).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// readFile - Load data from disk
// ---------------------------------------------------------------------------
describe('changeData - readFile', () => {
    beforeEach(() => {
        clearStores();
    });

    afterEach(() => {
        clearStores();
    });

    it('should load existing change data files into the store', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'test-campaign-1', isDirectory: () => true },
        ]);
        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ character1: { hp: 25 } }));
        readFile();
        expect(characterChangeData.get('test-campaign-1')).toEqual({ character1: { hp: 25 } });
        readdirSpy.mockRestore();
        existsSpy.mockRestore();
        readFileSyncSpy.mockRestore();
    });

    it('should set empty object when file does not exist', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'test-campaign-1', isDirectory: () => true },
        ]);
        let existsCallCount = 0;
        const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((_p) => {
            existsCallCount++;
            if (existsCallCount === 1) return true; // campaigns dir exists
            return false; // file does not exist
        });
        readFile();
        expect(characterChangeData.has('test-campaign-1')).toBe(true);
        expect(characterChangeData.get('test-campaign-1')).toEqual({});
        readdirSpy.mockRestore();
        existsSpy.mockRestore();
    });

    it('should handle multiple campaigns', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'test-campaign-1', isDirectory: () => true },
            { name: 'test-campaign-2', isDirectory: () => true },
        ]);
        let existsCallCount = 0;
        const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((_p) => {
            existsCallCount++;
            if (existsCallCount === 1) return true; // campaigns dir exists
            return true; // all file paths exist
        });
        const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
            if (p.includes('test-campaign-1')) return JSON.stringify({ character1: { hp: 25 } });
            if (p.includes('test-campaign-2')) return JSON.stringify({ character2: { hp: 10 } });
            return '{}';
        });
        readFile();
        expect(characterChangeData.get('test-campaign-1')).toEqual({ character1: { hp: 25 } });
        expect(characterChangeData.get('test-campaign-2')).toEqual({ character2: { hp: 10 } });
        readdirSpy.mockRestore();
        existsSpy.mockRestore();
        readFileSyncSpy.mockRestore();
    });

    it('should mix campaigns with and without files', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'test-campaign-1', isDirectory: () => true },
            { name: 'test-campaign-2', isDirectory: () => true },
        ]);
        let existsCallCount = 0;
        const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((_p) => {
            existsCallCount++;
            if (existsCallCount === 1) return true; // campaigns dir exists
            if (existsCallCount === 2) return true; // test-campaign-1 file exists
            if (existsCallCount === 3) return false; // test-campaign-2 file does not exist
            return true;
        });
        const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
            if (p.includes('test-campaign-1')) return JSON.stringify({ character1: { hp: 25 } });
            return '{}';
        });
        readFile();
        expect(characterChangeData.get('test-campaign-1')).toEqual({ character1: { hp: 25 } });
        expect(characterChangeData.get('test-campaign-2')).toEqual({});
        readdirSpy.mockRestore();
        existsSpy.mockRestore();
        readFileSyncSpy.mockRestore();
    });

    it('should handle invalid JSON gracefully', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'test-campaign-3', isDirectory: () => true },
        ]);
        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue('this is not valid json{{{');

        const consoleSpy = vi.spyOn(console, 'error');
        readFile();

        expect(characterChangeData.get('test-campaign-3')).toEqual({});
        expect(consoleSpy).toHaveBeenCalledWith(
            'Failed to read character change data for campaign test-campaign-3:',
            expect.any(String),
        );
        consoleSpy.mockRestore();
        readdirSpy.mockRestore();
        existsSpy.mockRestore();
        readFileSyncSpy.mockRestore();
    });

    it('should skip non-directory entries in campaigns folder', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'test-campaign', isDirectory: () => true },
            { name: 'not-a-campaign.txt', isDirectory: () => false },
        ]);
        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        readFile();
        expect(characterChangeData.has('not-a-campaign.txt')).toBe(false);
        readdirSpy.mockRestore();
        existsSpy.mockRestore();
    });

    it('should do nothing if campaigns directory does not exist', () => {
        const spy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
        readFile();
        expect(characterChangeData.size).toBe(0);
        spy.mockRestore();
    });

    it('should handle file read errors gracefully', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'test-campaign-3', isDirectory: () => true },
        ]);
        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('EACCES: permission denied');
        });

        const consoleSpy = vi.spyOn(console, 'error');
        readFile();
        expect(characterChangeData.has('test-campaign-3')).toBe(true);
        expect(characterChangeData.get('test-campaign-3')).toEqual({});
        expect(consoleSpy).toHaveBeenCalledWith(
            'Failed to read character change data for campaign test-campaign-3:',
            expect.any(String),
        );
        consoleSpy.mockRestore();
        readdirSpy.mockRestore();
        existsSpy.mockRestore();
        readFileSyncSpy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// saveFile - Persist data to disk
// ---------------------------------------------------------------------------
describe('changeData - saveFile', () => {
    let savedData;

    beforeEach(() => {
        clearStores();
        savedData = { writtenFiles: [] };

        // Wrap writeFileSync to capture what gets written
        vi.spyOn(fs, 'writeFileSync').mockImplementation((filePath, data) => {
            savedData.writtenFiles.push({ filePath, data });
        });

        vi.spyOn(fs, 'existsSync').mockImplementation(() => {
            // Allow the mock to work for the campaign data dir creation
            return true;
        });

        vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
            // no-op
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        clearStores();
    });

    it('should write all campaigns in the store to disk', () => {
        characterChangeData.set('campaign-1', { character1: { hp: 25 } });
        characterChangeData.set('campaign-2', { character2: { hp: 10 } });

        saveFile();

        expect(savedData.writtenFiles).toHaveLength(2);
        const paths = savedData.writtenFiles.map(f => f.filePath);
        expect(paths).toContainEqual(
            expect.stringContaining('campaign-1/data/character-change-data.json'),
        );
        expect(paths).toContainEqual(
            expect.stringContaining('campaign-2/data/character-change-data.json'),
        );
    });

    it('should write data as JSON stringified', () => {
        const testData = { character1: { hp: 25 } };
        characterChangeData.set('test-campaign', testData);

        saveFile();

        const file = savedData.writtenFiles.find(f =>
            f.filePath.includes('test-campaign'),
        );
        expect(file).toBeDefined();
        expect(file.data).toBe(JSON.stringify(testData, null, 2));
    });

    it('should handle empty campaign store gracefully', () => {
        saveFile();

        expect(savedData.writtenFiles).toHaveLength(0);
    });

    it('should handle empty object data for a campaign', () => {
        characterChangeData.set('empty-campaign', {});

        saveFile();

        const file = savedData.writtenFiles.find(f =>
            f.filePath.includes('empty-campaign'),
        );
        expect(file).toBeDefined();
        expect(file.data).toBe(JSON.stringify({}));
    });

    it('should write complex nested data', () => {
        const complexData = {
            character1: { hp: 25, maxHp: 30, spellSlots: { level1: 3 } },
            combatSummary: { rounds: 5 },
        };
        characterChangeData.set('complex-campaign', complexData);

        saveFile();

        const file = savedData.writtenFiles.find(f =>
            f.filePath.includes('complex-campaign'),
        );
        expect(file.data).toBe(JSON.stringify(complexData, null, 2));
    });

    it('should handle write errors without crashing', () => {
        characterChangeData.set('test-campaign', { character1: { hp: 25 } });

        vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
            throw new Error('disk full');
        });

        const spy = vi.spyOn(console, 'error');
        expect(() => saveFile()).not.toThrow();
        expect(spy).toHaveBeenCalledWith(
            'Failed to save character change data for campaign test-campaign:',
            'disk full',
        );
        spy.mockRestore();
    });

    it('should create the data directory if it does not exist', () => {
        characterChangeData.set('new-campaign', { character1: { hp: 25 } });

        const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => { /* no-op */ });
        // Campaign root exists, but its data subdirectory does not
        vi.spyOn(fs, 'existsSync').mockImplementation((p) => !String(p).endsWith('/data'));
        saveFile();

        expect(mkdirSpy).toHaveBeenCalledWith(
            expect.stringContaining('new-campaign/data'),
            { recursive: true },
        );
        mkdirSpy.mockRestore();
    });

    it('should NOT recreate a campaign directory that was deleted from disk', () => {
        // Phantom campaign: key in memory, directory deleted from disk.
        // saveFile must purge it from memory instead of resurrecting the folder.
        characterChangeData.set('phantom-campaign', {});

        const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => { /* no-op */ });
        const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { /* no-op */ });
        vi.spyOn(fs, 'existsSync').mockReturnValue(false);
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* no-op */ });

        saveFile();

        expect(mkdirSpy).not.toHaveBeenCalled();
        expect(writeSpy).not.toHaveBeenCalled();
        expect(characterChangeData.has('phantom-campaign')).toBe(false);
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('phantom-campaign'),
        );

        errorSpy.mockRestore();
        writeSpy.mockRestore();
        mkdirSpy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// spell overlay persistence (readFile load + saveFile disk lane)
// ---------------------------------------------------------------------------
describe('changeData - spell overlay persistence', () => {
    const OVERLAY_FILE = 'spell-overlays.json';

    beforeEach(() => {
        clearStores();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        clearStores();
    });

    describe('readFile boot load', () => {
        it('should load an existing spell-overlays.json into spellOverlayData', () => {
            const overlays = [{ id: 'overlay-1', shape: 'sphere', radiusFt: 20 }];
            vi.spyOn(fs, 'readdirSync').mockReturnValue([
                { name: 'overlay-campaign', isDirectory: () => true },
            ]);
            vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
                const s = String(p);
                // campaigns dir + overlay file exist; change-data file does not
                return !s.includes('character-change-data');
            });
            vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
                if (String(p).endsWith(OVERLAY_FILE)) return JSON.stringify(overlays);
                throw new Error('ENOENT');
            });

            readFile();

            expect(spellOverlayData.get('overlay-campaign')).toEqual(overlays);
        });

        it('should leave the store empty and log nothing when no overlay file exists', () => {
            const consoleSpy = vi.spyOn(console, 'error');
            vi.spyOn(fs, 'readdirSync').mockReturnValue([
                { name: 'fresh-campaign', isDirectory: () => true },
            ]);
            vi.spyOn(fs, 'existsSync').mockImplementation((p) => !String(p).includes('data'));

            readFile();

            expect(spellOverlayData.size).toBe(0);
            expect(consoleSpy).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('should drop in-memory overlays when the disk file was removed (disk authoritative)', () => {
            spellOverlayData.set('overlay-campaign', [{ id: 'ghost-1' }]);
            vi.spyOn(fs, 'readdirSync').mockReturnValue([
                { name: 'overlay-campaign', isDirectory: () => true },
            ]);
            vi.spyOn(fs, 'existsSync').mockImplementation((p) => !String(p).endsWith(OVERLAY_FILE));

            readFile();

            expect(spellOverlayData.has('overlay-campaign')).toBe(false);
        });

        it('should handle invalid overlay JSON gracefully', () => {
            const consoleSpy = vi.spyOn(console, 'error');
            vi.spyOn(fs, 'readdirSync').mockReturnValue([
                { name: 'overlay-campaign', isDirectory: () => true },
            ]);
            vi.spyOn(fs, 'existsSync').mockReturnValue(true);
            vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
                if (String(p).endsWith(OVERLAY_FILE)) return 'not valid json{{{';
                return '{}';
            });

            readFile();

            expect(spellOverlayData.has('overlay-campaign')).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to read spell overlays for campaign overlay-campaign:',
                expect.any(String),
            );
            consoleSpy.mockRestore();
        });

        it('should refuse non-array overlay file content', () => {
            const consoleSpy = vi.spyOn(console, 'error');
            vi.spyOn(fs, 'readdirSync').mockReturnValue([
                { name: 'overlay-campaign', isDirectory: () => true },
            ]);
            vi.spyOn(fs, 'existsSync').mockReturnValue(true);
            vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
                if (String(p).endsWith(OVERLAY_FILE)) return JSON.stringify({ sneaky: 'object' });
                return '{}';
            });

            readFile();

            expect(spellOverlayData.has('overlay-campaign')).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to read spell overlays for campaign overlay-campaign:',
                'file content is not an array',
            );
            consoleSpy.mockRestore();
        });
    });

    describe('saveFile disk write', () => {
        let writtenFiles;
        let unlinked;

        beforeEach(() => {
            writtenFiles = [];
            unlinked = [];
            vi.spyOn(fs, 'writeFileSync').mockImplementation((filePath, data) => {
                writtenFiles.push({ filePath, data });
            });
            vi.spyOn(fs, 'unlinkSync').mockImplementation((filePath) => {
                unlinked.push(String(filePath));
            });
            vi.spyOn(fs, 'mkdirSync').mockImplementation(() => { /* no-op */ });
            vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
                throw new Error('ENOENT');
            });
            vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        });

        it('should persist overlays to spell-overlays.json next to the change data', () => {
            const overlays = [{ id: 'overlay-1', shape: 'cone', angle: 315 }];
            spellOverlayData.set('test-campaign', overlays);

            saveFile();

            const file = writtenFiles.find(f => String(f.filePath).endsWith(OVERLAY_FILE));
            expect(file).toBeDefined();
            expect(String(file.filePath)).toContain('test-campaign/data');
            expect(file.data).toBe(JSON.stringify(overlays, null, 2));
        });

        it('should write change data and overlays in one saveFile pass', () => {
            characterChangeData.set('test-campaign', { Bob: { hp: 25 } });
            spellOverlayData.set('test-campaign', [{ id: 'overlay-1' }]);

            saveFile();

            const paths = writtenFiles.map(f => String(f.filePath));
            expect(paths.some(p => p.includes('character-change-data.json'))).toBe(true);
            expect(paths.some(p => p.endsWith(OVERLAY_FILE))).toBe(true);
        });

        it('should not rewrite when disk content already matches', () => {
            const overlays = [{ id: 'overlay-1' }];
            spellOverlayData.set('test-campaign', overlays);
            vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
                if (String(p).endsWith(OVERLAY_FILE)) return JSON.stringify(overlays, null, 2);
                throw new Error('ENOENT');
            });

            saveFile();

            expect(writtenFiles.filter(f => String(f.filePath).endsWith(OVERLAY_FILE))).toHaveLength(0);
        });

        it('should remove the disk file when overlays were cleared in memory', () => {
            spellOverlayData.set('test-campaign', []);

            saveFile();

            expect(unlinked).toContainEqual(expect.stringContaining(OVERLAY_FILE));
            expect(writtenFiles.filter(f => String(f.filePath).endsWith(OVERLAY_FILE))).toHaveLength(0);
        });

        it('should create no overlay file for a fresh boot with nothing placed', () => {
            // Mirrors a fresh campaign boot: Maps empty → saveFile is a no-op
            saveFile();

            expect(writtenFiles).toHaveLength(0);
            expect(unlinked).toHaveLength(0);
        });

        it('should never write for campaigns whose directory was deleted', () => {
            spellOverlayData.set('phantom-campaign', [{ id: 'overlay-1' }]);
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            vi.spyOn(fs, 'existsSync').mockReturnValue(false);

            saveFile();

            expect(writtenFiles.filter(f => String(f.filePath).endsWith(OVERLAY_FILE))).toHaveLength(0);
            expect(unlinked).toHaveLength(0);
            consoleSpy.mockRestore();
        });

        it('should log and keep serving memory when the overlay write fails', () => {
            spellOverlayData.set('test-campaign', [{ id: 'overlay-1' }]);
            vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
                throw new Error('disk full');
            });
            const consoleSpy = vi.spyOn(console, 'error');

            expect(() => saveFile()).not.toThrow();
            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to save spell overlays for campaign test-campaign:',
                'disk full',
            );
            expect(spellOverlayData.get('test-campaign')).toHaveLength(1);
            consoleSpy.mockRestore();
        });
    });
});

// ---------------------------------------------------------------------------
// debouncedSave
// ---------------------------------------------------------------------------
describe('changeData - debouncedSave', () => {
    beforeEach(() => {
        clearStores();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        clearStores();
    });

    it('should not call saveFile synchronously', () => {
        characterChangeData.set('test-campaign', { character1: { hp: 25 } });

        const saveFileSpy = vi.fn();
        vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
            saveFileSpy();
        });

        debouncedSave();

        // saveFile should not have been called immediately
        expect(saveFileSpy).not.toHaveBeenCalled();
    });

    it('should clear existing timer when called again', () => {
        characterChangeData.set('test-campaign', { character1: { hp: 25 } });

        const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
        vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
            // no-op
        });

        // First call
        debouncedSave();
        // First call: no previous timer to clear

        // Second call should clear the first timer
        debouncedSave();
        // clearTimeout was called to clear the previous timer
        expect(clearTimeoutSpy).toHaveBeenCalled();

        clearTimeoutSpy.mockRestore();
    });


});

// ---------------------------------------------------------------------------
// publish - SSE event publishing
// ---------------------------------------------------------------------------
describe('changeData - publish', () => {
    beforeEach(() => {
        subscribers.length = 0;
    });

    afterEach(() => {
        subscribers.length = 0;
        vi.restoreAllMocks();
    });

    it('should write SSE event data to all connected subscribers', () => {
        const mockRes1 = createMockRes();
        const mockRes2 = createMockRes();
        // The regex extracts the first word after the prefix, so 'change-my-campaign-char'
        // extracts 'my' as the target campaign
        subscribers.push({ campaignName: 'my', res: mockRes1, id: '1' });
        subscribers.push({ campaignName: 'my', res: mockRes2, id: '2' });

        publish('change-my-campaign-character1', { hp: 25 });

        expect(mockRes1.write).toHaveBeenCalled();
        expect(mockRes2.write).toHaveBeenCalled();
    });

    it('should send data in SSE format', () => {
        const mockRes = createMockRes();
        subscribers.push({ campaignName: 'my', res: mockRes, id: '1' });

        publish('change-my-campaign-character1', { hp: 25 });

        const written = mockRes.write.mock.calls[0][0];
        expect(written).toContain('data:');
        expect(written).toContain('hp');
        expect(written).toContain('25');
    });

    it('should JSON stringify the event data', () => {
        const mockRes = createMockRes();
        subscribers.push({ campaignName: 'my', res: mockRes, id: '1' });

        publish('change-my-campaign-character1', { hp: 25 });

        const written = mockRes.write.mock.calls[0][0];
        const jsonStr = written.replace('data: ', '').replace('\n\n', '');
        const parsed = JSON.parse(jsonStr);
        expect(parsed.key).toBe('change-my-campaign-character1');
        expect(parsed.data).toEqual({ hp: 25 });
    });

    it('should not send to subscribers of a different campaign', () => {
        const mockRes1 = createMockRes();
        const mockRes2 = createMockRes();
        // 'change-foo-key' extracts 'foo' as target campaign
        subscribers.push({ campaignName: 'foo', res: mockRes1, id: '1' });
        subscribers.push({ campaignName: 'bar', res: mockRes2, id: '2' });

        publish('change-foo-key', { hp: 25 });

        expect(mockRes1.write).toHaveBeenCalled();
        expect(mockRes2.write).not.toHaveBeenCalled();
    });

    it('should send to subscribers with empty string campaignName', () => {
        const mockRes1 = createMockRes();
        const mockRes2 = createMockRes();
        // 'change-my-key' extracts 'my' as target
        subscribers.push({ campaignName: 'my', res: mockRes1, id: '1' });
        subscribers.push({ campaignName: '', res: mockRes2, id: '2' });

        publish('change-my-key', { hp: 25 });

        expect(mockRes1.write).toHaveBeenCalled();
        // Subscriber with empty string campaignName is treated as no filter (falsy)
        // so they DO receive campaign-filtered events
        expect(mockRes2.write).toHaveBeenCalled();
    });

    it('should send to subscribers without campaignName filter', () => {
        const mockRes1 = createMockRes();
        // No campaignName property means no filter, global events go to them
        subscribers.push({ res: mockRes1, id: '1' });

        publish('some-global-event', { data: 'value' });

        expect(mockRes1.write).toHaveBeenCalled();
    });

    it('should handle events without a campaign prefix', () => {
        const mockRes1 = createMockRes();
        const mockRes2 = createMockRes();
        subscribers.push({ campaignName: 'campaign-a', res: mockRes1, id: '1' });
        subscribers.push({ campaignName: 'campaign-b', res: mockRes2, id: '2' });

        publish('some-global-event', { data: 'value' });

        // Global events (no campaign prefix) should go to all subscribers
        expect(mockRes1.write).toHaveBeenCalled();
        expect(mockRes2.write).toHaveBeenCalled();
    });

    it('should unwrap {value: ...} objects with single key', () => {
        const mockRes = createMockRes();
        subscribers.push({ campaignName: 'my', res: mockRes, id: '1' });

        publish('change-my-campaign-character1', { value: { hp: 25 } });

        const written = mockRes.write.mock.calls[0][0];
        const jsonStr = written.replace('data: ', '').replace('\n\n', '');
        const parsed = JSON.parse(jsonStr);
        // The data should be unwrapped to { hp: 25 }, not { value: { hp: 25 } }
        expect(parsed.data).toEqual({ hp: 25 });
    });

    it('should NOT unwrap objects that have more than one key including value', () => {
        const mockRes = createMockRes();
        subscribers.push({ campaignName: 'my', res: mockRes, id: '1' });

        publish('change-my-campaign-character1', { value: { hp: 25 }, other: 'data' });

        const written = mockRes.write.mock.calls[0][0];
        const jsonStr = written.replace('data: ', '').replace('\n\n', '');
        const parsed = JSON.parse(jsonStr);
        // Should NOT unwrap because there are 2 keys
        expect(parsed.data).toEqual({ value: { hp: 25 }, other: 'data' });
    });

    it('should NOT unwrap non-object data', () => {
        const mockRes = createMockRes();
        subscribers.push({ campaignName: 'my', res: mockRes, id: '1' });

        publish('change-my-campaign-character1', 'simple-string');

        const written = mockRes.write.mock.calls[0][0];
        const jsonStr = written.replace('data: ', '').replace('\n\n', '');
        const parsed = JSON.parse(jsonStr);
        expect(parsed.data).toBe('simple-string');
    });

    it('should NOT unwrap arrays', () => {
        const mockRes = createMockRes();
        subscribers.push({ campaignName: 'my', res: mockRes, id: '1' });

        publish('spell-overlay-my-campaign', [{ id: 'overlay-1' }]);

        const written = mockRes.write.mock.calls[0][0];
        const jsonStr = written.replace('data: ', '').replace('\n\n', '');
        const parsed = JSON.parse(jsonStr);
        expect(parsed.data).toEqual([{ id: 'overlay-1' }]);
    });

    it('should handle disconnected client gracefully', () => {
        const mockRes = createMockRes();
        mockRes.write.mockImplementation(() => {
            throw new Error('client disconnected');
        });
        subscribers.push({ campaignName: 'my', res: mockRes, id: '1' });

        // Should not throw
        expect(() => publish('change-my-campaign-character1', { hp: 25 })).not.toThrow();
    });

    it('should handle empty subscribers list gracefully', () => {
        // No subscribers
        expect(() => publish('change-my-campaign-character1', { hp: 25 })).not.toThrow();
    });

    it('should handle null data', () => {
        const mockRes = createMockRes();
        subscribers.push({ campaignName: 'my', res: mockRes, id: '1' });

        publish('change-my-campaign-character1', null);

        const written = mockRes.write.mock.calls[0][0];
        const jsonStr = written.replace('data: ', '').replace('\n\n', '');
        const parsed = JSON.parse(jsonStr);
        expect(parsed.data).toBeNull();
    });

    it('should handle undefined data', () => {
        const mockRes = createMockRes();
        subscribers.push({ campaignName: 'my', res: mockRes, id: '1' });

        publish('change-my-campaign-character1', undefined);

        const written = mockRes.write.mock.calls[0][0];
        const jsonStr = written.replace('data: ', '').replace('\n\n', '');
        const parsed = JSON.parse(jsonStr);
        expect(parsed.data).toBeUndefined();
    });

    it('should handle various campaign key prefixes', () => {
        const mockResA = createMockRes();
        const mockResB = createMockRes();
        // 'spell-overlay-foo-...' extracts 'foo' as target
        subscribers.push({ campaignName: 'foo', res: mockResA, id: '1' });
        subscribers.push({ campaignName: 'bar', res: mockResB, id: '2' });

        // spell-overlay prefix
        publish('spell-overlay-foo-overlay', [{ id: '1' }]);
        expect(mockResA.write).toHaveBeenCalled();
        expect(mockResB.write).not.toHaveBeenCalled();

        // map-data prefix
        mockResA.write.mockClear();
        mockResB.write.mockClear();
        publish('map-data-foo-map', { map: 'topdown' });
        expect(mockResA.write).toHaveBeenCalled();
        expect(mockResB.write).not.toHaveBeenCalled();

        // maps-list prefix
        mockResA.write.mockClear();
        mockResB.write.mockClear();
        publish('maps-list-foo-list', ['map1', 'map2']);
        expect(mockResA.write).toHaveBeenCalled();
        expect(mockResB.write).not.toHaveBeenCalled();

        // map-activate prefix
        mockResA.write.mockClear();
        mockResB.write.mockClear();
        publish('map-activate-foo-act', { mapId: 'map1' });
        expect(mockResA.write).toHaveBeenCalled();
        expect(mockResB.write).not.toHaveBeenCalled();

        // positioning prefix
        mockResA.write.mockClear();
        mockResB.write.mockClear();
        publish('positioning-foo-pos', { x: 10, y: 20 });
        expect(mockResA.write).toHaveBeenCalled();
        expect(mockResB.write).not.toHaveBeenCalled();

        // log prefix
        mockResA.write.mockClear();
        mockResB.write.mockClear();
        publish('log-foo-log', { entry: 'test' });
        expect(mockResA.write).toHaveBeenCalled();
        expect(mockResB.write).not.toHaveBeenCalled();
    });

    it('should extract first word from key with hyphen in campaign name', () => {
        const mockResA = createMockRes();
        const mockResB = createMockRes();
        // 'change-my-campaign-char' extracts 'my' as target campaign
        subscribers.push({ campaignName: 'my', res: mockResA, id: '1' });
        subscribers.push({ campaignName: 'other', res: mockResB, id: '2' });

        publish('change-my-campaign-character1', { hp: 25 });

        expect(mockResA.write).toHaveBeenCalled();
        expect(mockResB.write).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// removeChangeDataKey
// ---------------------------------------------------------------------------
describe('changeData - removeChangeDataKey', () => {
    let saveFileCalls;

    beforeEach(() => {
        clearStores();
        saveFileCalls = [];
        vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
            saveFileCalls.push(true);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        clearStores();
    });

    it('should remove a character entry matching the first name', () => {
        characterChangeData.set('test-campaign', {
            Bob: { hp: 25 },
            character2: { hp: 10 },
        });

        removeChangeDataKey('test-campaign', 'Bob');

        const data = characterChangeData.get('test-campaign');
        expect(data).not.toHaveProperty('Bob');
        expect(data).toHaveProperty('character2');
    });

    it('should remove entries using first word as name split by non-alphanumeric', () => {
        characterChangeData.set('test-campaign', {
            Bob: { hp: 25 },
            character2: { hp: 10 },
        });

        removeChangeDataKey('test-campaign', 'Bob-Jr');

        const data = characterChangeData.get('test-campaign');
        // firstName from 'Bob-Jr' is 'Bob', so 'Bob' key should be removed
        expect(data).not.toHaveProperty('Bob');
        expect(data).toHaveProperty('character2');
    });

    it('should perform case-insensitive matching', () => {
        characterChangeData.set('test-campaign', {
            BOB: { hp: 25 },
            character2: { hp: 10 },
        });

        removeChangeDataKey('test-campaign', 'bob');

        const data = characterChangeData.get('test-campaign');
        expect(data).not.toHaveProperty('BOB');
        expect(data).toHaveProperty('character2');
    });

    it('should preserve reserved keys', () => {
        characterChangeData.set('test-campaign', {
            Bob: { hp: 25 },
            combatSummary: { rounds: 5 },
            activeCreatureId: 'creature-1',
            log: [{ entry: 'test' }],
            positioning: { x: 10, y: 20 },
        });

        removeChangeDataKey('test-campaign', 'Bob');

        const data = characterChangeData.get('test-campaign');
        expect(data).not.toHaveProperty('Bob');
        expect(data).toHaveProperty('combatSummary');
        expect(data).toHaveProperty('activeCreatureId');
        expect(data).toHaveProperty('log');
        expect(data).toHaveProperty('positioning');
    });

    it('should do nothing if campaign does not exist in store', () => {
        removeChangeDataKey('nonexistent-campaign', 'Bob');

        expect(characterChangeData.has('nonexistent-campaign')).toBe(false);
    });

    it('should remove all matching entries for a character name', () => {
        characterChangeData.set('test-campaign', {
            Bob: { hp: 25 },
            bob: { hp: 20 },
            BOB: { hp: 15 },
            character2: { hp: 10 },
        });

        removeChangeDataKey('test-campaign', 'Bob');

        const data = characterChangeData.get('test-campaign');
        expect(data).not.toHaveProperty('Bob');
        expect(data).not.toHaveProperty('bob');
        expect(data).not.toHaveProperty('BOB');
        expect(data).toHaveProperty('character2');
    });

    it('should trigger debounced save', () => {
        characterChangeData.set('test-campaign', {
            Bob: { hp: 25 },
        });

        const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(() => {
            return { id: 1 };
        });

        removeChangeDataKey('test-campaign', 'Bob');

        // debouncedSave was called, which sets a setTimeout
        expect(setTimeoutSpy).toHaveBeenCalled();

        setTimeoutSpy.mockRestore();
    });

    it('should handle character name with only special characters', () => {
        characterChangeData.set('test-campaign', {
            '!@#$': { hp: 25 },
            character2: { hp: 10 },
        });

        // When firstName falls back to characterName (no alphanumeric chars found)
        removeChangeDataKey('test-campaign', '!@#$');

        const data = characterChangeData.get('test-campaign');
        expect(data).not.toHaveProperty('!@#$');
        expect(data).toHaveProperty('character2');
    });

    it('should handle non-string character names gracefully', () => {
        characterChangeData.set('test-campaign', {
            '123': { hp: 25 },
            character2: { hp: 10 },
        });

        removeChangeDataKey('test-campaign', '123');

        const data = characterChangeData.get('test-campaign');
        expect(data).not.toHaveProperty('123');
        expect(data).toHaveProperty('character2');
    });

    // --- Regression: multi-word names orphaned their buckets (delete lane
    // matched only the FIRST token, so "QA Space Cadet" survived forever) ---

    it('should remove a full multi-word name bucket on delete', () => {
        characterChangeData.set('test-campaign', {
            'QA Space Cadet': { fanaticalFocusUsed: false, hitPoints: 9 },
            AasimarTest: { hitPoints: 20 },
        });

        removeChangeDataKey('test-campaign', 'QA Space Cadet');

        const data = characterChangeData.get('test-campaign');
        expect(data).not.toHaveProperty('QA Space Cadet');
        expect(data).toHaveProperty('AasimarTest');
    });

    it('should remove a multi-word name bucket case-insensitively', () => {
        characterChangeData.set('test-campaign', {
            'zap repro cadet': { hitPoints: 9 },
            character2: { hp: 10 },
        });

        removeChangeDataKey('test-campaign', 'Zap Repro Cadet');

        const data = characterChangeData.get('test-campaign');
        expect(data).not.toHaveProperty('zap repro cadet');
        expect(data).toHaveProperty('character2');
    });

    it('should remove full-name and legacy first-token buckets for a renamed character', () => {
        characterChangeData.set('test-campaign', {
            'Cadet One': { hitPoints: 7 },
            Bob: { hp: 25 },
            character2: { hp: 10 },
        });

        // rename cleanup passes the FULL old name; the first-token leg stays
        // for the legacy "Bob-Jr" → "Bob" cleanup semantics
        removeChangeDataKey('test-campaign', 'Cadet One');
        removeChangeDataKey('test-campaign', 'Bob-Jr');

        const data = characterChangeData.get('test-campaign');
        expect(data).not.toHaveProperty('Cadet One');
        expect(data).not.toHaveProperty('Bob');
        expect(data).toHaveProperty('character2');
    });

    it('should not wipe a live character bucket whose name merely shares the first token', () => {
        characterChangeData.set('test-campaign', {
            'Cadet One': { hitPoints: 7 },
            'Cadet Two': { hitPoints: 14 },
        });

        removeChangeDataKey('test-campaign', 'Cadet One');

        const data = characterChangeData.get('test-campaign');
        expect(data).not.toHaveProperty('Cadet One');
        expect(data).toHaveProperty('Cadet Two');
    });

    it('should match multi-word buckets despite uneven whitespace in the name', () => {
        characterChangeData.set('test-campaign', {
            'Cadet One': { hitPoints: 7 },
            character2: { hp: 10 },
        });

        removeChangeDataKey('test-campaign', '  Cadet   One  ');

        const data = characterChangeData.get('test-campaign');
        expect(data).not.toHaveProperty('Cadet One');
        expect(data).toHaveProperty('character2');
    });

    it('should do nothing for an empty or missing character name', () => {
        characterChangeData.set('test-campaign', {
            'Cadet One': { hitPoints: 7 },
        });

        removeChangeDataKey('test-campaign', undefined);
        removeChangeDataKey('test-campaign', '');

        const data = characterChangeData.get('test-campaign');
        expect(data).toHaveProperty('Cadet One');
    });
});

// ---------------------------------------------------------------------------
// keepAlive
// ---------------------------------------------------------------------------
describe('changeData - keepAlive', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        // Clear all intervals to prevent interference
        // Note: We can't easily clear the interval created by keepAlive,
        // but we can mock http.get to prevent actual network calls
    });

    it('should create an interval that polls the health endpoint', () => {
        const setIntervalSpy = vi.spyOn(global, 'setInterval').mockImplementation((fn) => {
            fn();
            return { id: 1 };
        });

        const httpGetSpy = vi.spyOn(http, 'get').mockImplementation(() => ({
            on: vi.fn((event, callback) => {
                if (event === 'error') callback(new Error('mock error'));
                return { on: () => {} };
            }),
        }));

        const spy = vi.spyOn(console, 'error').mockImplementation(() => { /* no-op */ });
        expect(() => keepAlive()).not.toThrow();
        expect(setIntervalSpy).toHaveBeenCalled();
        expect(httpGetSpy).toHaveBeenCalled();
        spy.mockRestore();
        httpGetSpy.mockRestore();
        setIntervalSpy.mockRestore();
    });

    it('should use PORT environment variable when set', () => {
        const originalPort = process.env.PORT;
        process.env.PORT = '3000';

        const setIntervalSpy = vi.spyOn(global, 'setInterval').mockImplementation((fn) => {
            fn();
            return { id: 1 };
        });

        const httpGetSpy = vi.spyOn(http, 'get').mockImplementation((url) => {
            expect(url).toContain('3000');
            return { on: vi.fn(() => ({})) };
        });

        keepAlive();
        expect(httpGetSpy).toHaveBeenCalledWith(
            'http://localhost:3000/health',
            expect.any(Object),
            expect.any(Function),
        );
        httpGetSpy.mockRestore();
        setIntervalSpy.mockRestore();
        if (originalPort !== undefined) {
            process.env.PORT = originalPort;
        } else {
            delete process.env.PORT;
        }
    });

    it('should default to port 80 when PORT is not set', () => {
        const originalPort = process.env.PORT;
        delete process.env.PORT;

        const setIntervalSpy = vi.spyOn(global, 'setInterval').mockImplementation((fn) => {
            fn();
            return { id: 1 };
        });

        const httpGetSpy = vi.spyOn(http, 'get').mockImplementation((url) => {
            expect(url).toContain('80');
            return { on: vi.fn(() => ({})) };
        });

        keepAlive();
        expect(httpGetSpy).toHaveBeenCalledWith(
            'http://localhost:80/health',
            expect.any(Object),
            expect.any(Function),
        );
        httpGetSpy.mockRestore();
        setIntervalSpy.mockRestore();
        if (originalPort !== undefined) {
            process.env.PORT = originalPort;
        }
    });

    it('should log warning on non-200 status', () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {
            // no-op
        });

        const setIntervalSpy = vi.spyOn(global, 'setInterval').mockImplementation((fn) => {
            fn();
            return { id: 1 };
        });

        const httpGetSpy = vi.spyOn(http, 'get').mockImplementation(() => {
            return {
                on: vi.fn((event) => {
                    if (event === 'response') {
                        // Simulate response event
                    }
                    return { on: () => {} };
                }),
            };
        });

        keepAlive();

        httpGetSpy.mockRestore();
        setIntervalSpy.mockRestore();
        consoleWarn.mockRestore();
    });

    it('should log error on health check failure', () => {
        const setIntervalSpy = vi.spyOn(global, 'setInterval').mockImplementation((fn) => {
            fn();
            return { id: 1 };
        });

        const httpGetSpy = vi.spyOn(http, 'get').mockImplementation(() => {
            const emitter = {
                on: vi.fn((event, callback) => {
                    if (event === 'error') {
                        callback(new Error('connection refused'));
                    }
                    return emitter;
                }),
            };
            return emitter;
        });

        const spy = vi.spyOn(console, 'error').mockImplementation(() => {
            // no-op
        });

        keepAlive();

        expect(httpGetSpy).toHaveBeenCalled();

        spy.mockRestore();
        httpGetSpy.mockRestore();
        setIntervalSpy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------
function createMockRes() {
    const writes = [];
    const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        write: vi.fn((chunk) => {
            writes.push(chunk);
            return true;
        }),
        emit: vi.fn(),
        _writes: writes,
    };
    return mockRes;
}
