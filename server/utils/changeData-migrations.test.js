import fs from 'fs';
import {
    activeMaps,
    subscribers,
    characterChangeData,
    spellOverlayData,
    readFile,
    saveFile,
    debouncedSave,
    markDirty,
} from '../utils/changeData.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearStores() {
    activeMaps.clear();
    characterChangeData.clear();
    spellOverlayData.clear();
    subscribers.length = 0;
}

// ---------------------------------------------------------------------------
// markDirty
// ---------------------------------------------------------------------------
describe('changeData - markDirty', () => {
    beforeEach(() => {
        clearStores();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        clearStores();
    });

    it('should call debouncedSave when invoked', () => {
        characterChangeData.set('test-campaign', { character1: { hp: 25 } });

        const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(() => {
            return { id: 1 };
        });

        markDirty('test-campaign');

        // markDirty calls debouncedSave which sets a setTimeout
        expect(setTimeoutSpy).toHaveBeenCalled();

        setTimeoutSpy.mockRestore();
    });

    it('should call debouncedSave even without data in store', () => {
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(() => {
            return { id: 1 };
        });

        markDirty('test-campaign');

        expect(setTimeoutSpy).toHaveBeenCalled();

        setTimeoutSpy.mockRestore();
    });

    it('should not throw with null campaign argument', () => {
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(() => {
            return { id: 1 };
        });

        expect(() => markDirty(null)).not.toThrow();

        setTimeoutSpy.mockRestore();
    });

    it('should not throw with undefined campaign argument', () => {
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(() => {
            return { id: 1 };
        });

        expect(() => markDirty(undefined)).not.toThrow();

        setTimeoutSpy.mockRestore();
    });

    it('should not throw with empty string campaign argument', () => {
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(() => {
            return { id: 1 };
        });

        expect(() => markDirty('')).not.toThrow();

        setTimeoutSpy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// readFile - Migration logic
// ---------------------------------------------------------------------------
describe('changeData - readFile migrations', () => {
    beforeEach(() => {
        clearStores();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        clearStores();
    });

    it('should flatten nested campaign-named keys to top level', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'test-campaign', isDirectory: () => true },
        ]);
        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(
            JSON.stringify({
                'test-campaign': {
                    targetEffects: [{ id: '1', type: 'frightened' }],
                    otherKey: 'value',
                },
            }),
        );
        readFile();

        const data = characterChangeData.get('test-campaign');
        // targetEffects should be promoted to top level
        expect(data).toHaveProperty('targetEffects');
        expect(data.targetEffects).toEqual([{ id: '1', type: 'frightened' }]);
        // The nested campaign key should be removed
        expect(data).not.toHaveProperty('test-campaign');
        // otherKey is not a campaign data key so it should NOT be promoted
        expect(data).not.toHaveProperty('otherKey');

        readdirSpy.mockRestore();
        existsSpy.mockRestore();
        readFileSyncSpy.mockRestore();
    });

    it('should flatten nested deprecated "campaign" wrapper keys to top level', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'test-campaign', isDirectory: () => true },
        ]);
        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(
            JSON.stringify({
                campaign: {
                    targetEffects: [{ id: '1', type: 'blinded' }],
                    pendingSavePrompts: [{ id: '2' }],
                    otherKey: 'value',
                },
            }),
        );
        readFile();

        const data = characterChangeData.get('test-campaign');
        expect(data).toHaveProperty('targetEffects');
        expect(data.targetEffects).toEqual([{ id: '1', type: 'blinded' }]);
        expect(data).toHaveProperty('pendingSavePrompts');
        expect(data.pendingSavePrompts).toEqual([{ id: '2' }]);
        expect(data).not.toHaveProperty('campaign');
        expect(data).not.toHaveProperty('otherKey');

        readdirSpy.mockRestore();
        existsSpy.mockRestore();
        readFileSyncSpy.mockRestore();
    });

    it('should NOT overwrite existing top-level keys during migration', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'test-campaign', isDirectory: () => true },
        ]);
        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(
            JSON.stringify({
                targetEffects: [{ id: 'existing', type: 'poisoned' }],
                'test-campaign': {
                    targetEffects: [{ id: 'nested', type: 'frightened' }],
                },
            }),
        );
        readFile();

        const data = characterChangeData.get('test-campaign');
        // Top-level targetEffects should be preserved (not overwritten by nested)
        expect(data.targetEffects).toEqual([{ id: 'existing', type: 'poisoned' }]);

        readdirSpy.mockRestore();
        existsSpy.mockRestore();
        readFileSyncSpy.mockRestore();
    });

    it('should handle both campaign and test-campaign nested wrappers in same file', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'test-campaign', isDirectory: () => true },
        ]);
        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(
            JSON.stringify({
                campaign: {
                    coverRefresh: { key: 'value1' },
                },
                'test-campaign': {
                    warCasterReactions: [{ id: '1' }],
                },
            }),
        );
        readFile();

        const data = characterChangeData.get('test-campaign');
        expect(data).toHaveProperty('coverRefresh');
        expect(data).toHaveProperty('warCasterReactions');
        expect(data).not.toHaveProperty('campaign');
        expect(data).not.toHaveProperty('test-campaign');

        readdirSpy.mockRestore();
        existsSpy.mockRestore();
        readFileSyncSpy.mockRestore();
    });

    it('should handle nested key that is not a campaign data key (skip migration)', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'test-campaign', isDirectory: () => true },
        ]);
        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(
            JSON.stringify({
                'test-campaign': {
                    targetEffects: [{ id: '1' }],
                    regularCharacterData: { hp: 25 },
                },
            }),
        );
        readFile();

        const data = characterChangeData.get('test-campaign');
        expect(data).toHaveProperty('targetEffects');
        // regularCharacterData is not a campaign data key, so it should NOT be at top level
        // but it also should not cause an error
        expect(data).not.toHaveProperty('regularCharacterData');

        readdirSpy.mockRestore();
        existsSpy.mockRestore();
        readFileSyncSpy.mockRestore();
    });

    it('should handle non-object nested value gracefully', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'test-campaign', isDirectory: () => true },
        ]);
        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(
            JSON.stringify({
                'test-campaign': 'not an object',
            }),
        );
        readFile();

        const data = characterChangeData.get('test-campaign');
        // 'not an object' is not typeof === 'object' (strings are 'string'),
        // so the migration block is skipped and the key remains
        expect(data).toEqual({ 'test-campaign': 'not an object' });

        readdirSpy.mockRestore();
        existsSpy.mockRestore();
        readFileSyncSpy.mockRestore();
    });

    it('should handle empty nested object gracefully', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'test-campaign', isDirectory: () => true },
        ]);
        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(
            JSON.stringify({
                'test-campaign': {},
            }),
        );
        readFile();

        const data = characterChangeData.get('test-campaign');
        expect(data).toEqual({});

        readdirSpy.mockRestore();
        existsSpy.mockRestore();
        readFileSyncSpy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// saveFile - Duplicate prevention
// ---------------------------------------------------------------------------
describe('changeData - saveFile duplicate prevention', () => {
    beforeEach(() => {
        characterChangeData.clear();
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        vi.spyOn(fs, 'mkdirSync').mockImplementation(() => { /* no-op */ });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        characterChangeData.clear();
    });

    it('should NOT write when serialized data matches current file content', () => {
        const existingContent = JSON.stringify({ character1: { hp: 25 } }, null, 2);
        vi.spyOn(fs, 'readFileSync').mockReturnValue(existingContent);

        const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { /* no-op */ });

        characterChangeData.set('test-campaign', { character1: { hp: 25 } });
        saveFile();

        // writeFileSync should NOT have been called because content is identical
        expect(writeSpy).not.toHaveBeenCalled();

        writeSpy.mockRestore();
    });

    it('should write when serialized data differs from current file content', () => {
        const existingContent = JSON.stringify({ character1: { hp: 20 } }, null, 2);
        vi.spyOn(fs, 'readFileSync').mockReturnValue(existingContent);

        const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { /* no-op */ });

        characterChangeData.set('test-campaign', { character1: { hp: 25 } });
        saveFile();

        // writeFileSync should have been called because content changed
        expect(writeSpy).toHaveBeenCalled();

        writeSpy.mockRestore();
    });

    it('should write when file does not exist on disk', () => {
        vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('ENOENT: no such file');
        });

        const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { /* no-op */ });

        characterChangeData.set('test-campaign', { character1: { hp: 25 } });
        saveFile();

        // writeFileSync should have been called because file doesn't exist
        expect(writeSpy).toHaveBeenCalled();

        writeSpy.mockRestore();
    });

    it('should write when existing content is empty string', () => {
        vi.spyOn(fs, 'readFileSync').mockReturnValue('');

        const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { /* no-op */ });

        characterChangeData.set('test-campaign', { character1: { hp: 25 } });
        saveFile();

        // writeFileSync should have been called because empty !== serialized
        expect(writeSpy).toHaveBeenCalled();

        writeSpy.mockRestore();
    });

    it('should NOT write for campaign with empty object when file already has empty object', () => {
        vi.spyOn(fs, 'readFileSync').mockReturnValue('{}');

        const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { /* no-op */ });

        characterChangeData.set('test-campaign', {});
        saveFile();

        expect(writeSpy).not.toHaveBeenCalled();

        writeSpy.mockRestore();
    });

    it('should handle multiple campaigns with mixed write/no-write states', () => {
        const existingContent1 = JSON.stringify({ character1: { hp: 25 } }, null, 2);
        vi.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
            if (filePath.includes('campaign-1')) return existingContent1;
            throw new Error('ENOENT');
        });

        const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { /* no-op */ });

        characterChangeData.set('campaign-1', { character1: { hp: 25 } });
        characterChangeData.set('campaign-2', { character2: { hp: 10 } });
        saveFile();

        // campaign-1 should NOT be written (identical content)
        // campaign-2 should be written (new file)
        expect(writeSpy).toHaveBeenCalledTimes(1);
        expect(writeSpy.mock.calls[0][0]).toContain('campaign-2');

        writeSpy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// debouncedSave - timer behavior
// ---------------------------------------------------------------------------
describe('changeData - debouncedSave timer behavior', () => {
    beforeEach(() => {
        characterChangeData.clear();
        vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { /* no-op */ });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        characterChangeData.clear();
    });

    it('should reset the timer when called multiple times rapidly', () => {
        const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(() => {
            return { id: 1 };
        });

        characterChangeData.set('test-campaign', { character1: { hp: 25 } });

        // Call debouncedSave multiple times
        debouncedSave();
        debouncedSave();
        debouncedSave();

        // clearTimeout should have been called for each subsequent call
        // (previous timer from markDirty tests may also contribute)
        expect(clearTimeoutSpy).toHaveBeenCalled();

        clearTimeoutSpy.mockRestore();
        setTimeoutSpy.mockRestore();
    });

    it('should clear saveTimer reference after save completes', () => {
        // This test verifies the internal saveTimer is cleared
        // We can't directly access saveTimer, but we can verify behavior
        // by checking that debouncedSave can be called again without errors
        characterChangeData.set('test-campaign', { character1: { hp: 25 } });

        const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(() => {
            return { id: 1 };
        });

        debouncedSave();
        debouncedSave();

        expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

        setTimeoutSpy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// readFile - Edge cases
// ---------------------------------------------------------------------------
describe('changeData - readFile edge cases', () => {
    beforeEach(() => {
        characterChangeData.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        characterChangeData.clear();
    });

    it('should handle campaigns directory with only files (no directories)', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'file1.txt', isDirectory: () => false },
            { name: 'file2.json', isDirectory: () => false },
        ]);
        readFile();

        expect(characterChangeData.size).toBe(0);

        readdirSpy.mockRestore();
    });

    it('should handle campaigns directory with mixed entries', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'valid-campaign', isDirectory: () => true },
            { name: 'not-a-campaign.txt', isDirectory: () => false },
            { name: 'another-campaign', isDirectory: () => true },
        ]);
        let existsCallCount = 0;
        const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((_p) => {
            existsCallCount++;
            if (existsCallCount === 1) return true; // campaigns dir
            return true; // all file paths exist
        });
        const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue('{}');

        readFile();

        expect(characterChangeData.has('valid-campaign')).toBe(true);
        expect(characterChangeData.has('another-campaign')).toBe(true);
        expect(characterChangeData.has('not-a-campaign.txt')).toBe(false);

        readdirSpy.mockRestore();
        existsSpy.mockRestore();
        readFileSyncSpy.mockRestore();
    });

    it('should handle campaigns directory listing error', () => {
        const spy = vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
            throw new Error('EACCES: permission denied');
        });

        const consoleSpy = vi.spyOn(console, 'error');
        readFile();

        expect(characterChangeData.size).toBe(0);
        expect(consoleSpy).toHaveBeenCalledWith(
            'Failed to read campaigns directory for character change data:',
            'EACCES: permission denied',
        );

        consoleSpy.mockRestore();
        spy.mockRestore();
    });

    it('should handle JSON with null value for campaign key', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'test-campaign', isDirectory: () => true },
        ]);
        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(
            JSON.stringify({
                'test-campaign': null,
            }),
        );
        readFile();

        const data = characterChangeData.get('test-campaign');
        // null is typeof 'object' === true in JavaScript, but data[campaign] is falsy
        // so the if condition `data[campaign] && typeof data[campaign] === 'object'` is false
        // The key remains in the data
        expect(data).toEqual({ 'test-campaign': null });

        readdirSpy.mockRestore();
        existsSpy.mockRestore();
        readFileSyncSpy.mockRestore();
    });

    it('should handle JSON with array value for campaign key', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'test-campaign', isDirectory: () => true },
        ]);
        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(
            JSON.stringify({
                'test-campaign': [{ id: '1' }],
            }),
        );
        readFile();

        const data = characterChangeData.get('test-campaign');
        // Array is typeof 'object' === true, so migration block runs
        // Object.entries([{id:'1'}]) = [['0',{id:'1'}]] - key '0' is not a campaign data key
        // so nothing gets promoted, but delete data['test-campaign'] still runs
        expect(data).toEqual({});

        readdirSpy.mockRestore();
        existsSpy.mockRestore();
        readFileSyncSpy.mockRestore();
    });

    it('should handle JSON with boolean value for campaign key', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'test-campaign', isDirectory: () => true },
        ]);
        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(
            JSON.stringify({
                'test-campaign': true,
            }),
        );
        readFile();

        const data = characterChangeData.get('test-campaign');
        // true is typeof 'boolean', not 'object', so migration is skipped
        expect(data).toEqual({ 'test-campaign': true });

        readdirSpy.mockRestore();
        existsSpy.mockRestore();
        readFileSyncSpy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// saveFile - Edge cases
// ---------------------------------------------------------------------------
describe('changeData - saveFile edge cases', () => {
    beforeEach(() => {
        characterChangeData.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        characterChangeData.clear();
    });

    it('should handle campaign names with special characters in file paths', () => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        vi.spyOn(fs, 'mkdirSync').mockImplementation(() => { /* no-op */ });

        const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { /* no-op */ });

        characterChangeData.set('test-campaign-123', { character1: { hp: 25 } });
        saveFile();

        expect(writeSpy).toHaveBeenCalled();
        const callPath = writeSpy.mock.calls[0][0];
        expect(callPath).toContain('test-campaign-123');

        writeSpy.mockRestore();
    });

    it('should handle campaign names with spaces (if filesystem allows)', () => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        vi.spyOn(fs, 'mkdirSync').mockImplementation(() => { /* no-op */ });

        const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { /* no-op */ });

        characterChangeData.set('my campaign', { character1: { hp: 25 } });
        saveFile();

        expect(writeSpy).toHaveBeenCalled();

        writeSpy.mockRestore();
    });

    it('should handle very large data objects', () => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        vi.spyOn(fs, 'mkdirSync').mockImplementation(() => { /* no-op */ });

        const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { /* no-op */ });

        const largeData = {};
        for (let i = 0; i < 1000; i++) {
            largeData[`character${i}`] = { hp: i, maxHp: i * 2, spellSlots: { level1: i } };
        }
        characterChangeData.set('large-campaign', largeData);
        saveFile();

        expect(writeSpy).toHaveBeenCalled();
        const callData = JSON.parse(writeSpy.mock.calls[0][1]);
        expect(callData).toHaveProperty('character0');
        expect(callData).toHaveProperty('character999');

        writeSpy.mockRestore();
    });

    it('should handle data with circular-like structures (JSON.stringify handles safely)', () => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        vi.spyOn(fs, 'mkdirSync').mockImplementation(() => { /* no-op */ });

        const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { /* no-op */ });

        // Plain objects are fine with JSON.stringify
        characterChangeData.set('test-campaign', {
            nested: { deep: { value: 'test' } },
            array: [1, 2, 3],
            string: 'hello',
            number: 42,
            boolean: true,
            nullVal: null,
        });
        saveFile();

        expect(writeSpy).toHaveBeenCalled();

        writeSpy.mockRestore();
    });

    it('should create nested directory structure for deeply nested campaign paths', () => {
        // Campaign root exists, but its data subdirectory does not (forces mkdir)
        vi.spyOn(fs, 'existsSync').mockImplementation((p) => !String(p).endsWith('/data'));
        const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => { /* no-op */ });

        characterChangeData.set('deep-campaign', { character1: { hp: 25 } });
        saveFile();

        expect(mkdirSpy).toHaveBeenCalledWith(
            expect.stringContaining('deep-campaign/data'),
            { recursive: true },
        );

        mkdirSpy.mockRestore();
    });

    it('should handle saveFile with no campaigns but existing store entries cleared', () => {
        vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { /* no-op */ });

        characterChangeData.clear();
        saveFile();

        // Should not throw and should not write anything
        // (writeFileSync mock won't be called since store is empty)
    });
});

// ---------------------------------------------------------------------------
// readFile - Dynamic campaign key detection
// ---------------------------------------------------------------------------
describe('changeData - readFile dynamic campaign keys', () => {
    beforeEach(() => {
        characterChangeData.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        characterChangeData.clear();
    });

    it('should promote _activeInvisibility_* keys during migration', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'test-campaign', isDirectory: () => true },
        ]);
        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(
            JSON.stringify({
                'test-campaign': {
                    '_activeInvisibility_char1': true,
                    '_activeFriends_char2': true,
                    '_some_appliedTarget': 'value',
                    regularKey: 'data',
                },
            }),
        );
        readFile();

        const data = characterChangeData.get('test-campaign');
        expect(data).toHaveProperty('_activeInvisibility_char1');
        expect(data).toHaveProperty('_activeFriends_char2');
        expect(data).toHaveProperty('_some_appliedTarget');
        expect(data).not.toHaveProperty('regularKey');
        expect(data).not.toHaveProperty('test-campaign');

        readdirSpy.mockRestore();
        existsSpy.mockRestore();
        readFileSyncSpy.mockRestore();
    });

    it('should promote all dynamic campaign keys from deprecated "campaign" wrapper', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
            { name: 'test-campaign', isDirectory: () => true },
        ]);
        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(
            JSON.stringify({
                campaign: {
                    '_activeInvisibility_fighter': true,
                    'targetEffects': [],
                },
            }),
        );
        readFile();

        const data = characterChangeData.get('test-campaign');
        expect(data).toHaveProperty('_activeInvisibility_fighter');
        expect(data).toHaveProperty('targetEffects');
        expect(data).not.toHaveProperty('campaign');

        readdirSpy.mockRestore();
        existsSpy.mockRestore();
        readFileSyncSpy.mockRestore();
    });
});
