import fs from 'fs';
import path from 'path';
import {
    getEncountersFilePath,
    readEncounters,
    writeEncounters,
} from '../utils/encounterUtils.js';

// ---------------------------------------------------------------------------
// getEncountersFilePath
// ---------------------------------------------------------------------------
describe('encounterUtils - getEncountersFilePath', () => {
    it('should return the correct path for a campaign', () => {
        const result = getEncountersFilePath('test-campaign');
        const expected = path.join(process.cwd(), 'public', 'campaigns', 'test-campaign', 'data', 'encounters.json');
        expect(result).toBe(expected);
    });

    it('should use process.cwd()', () => {
        const result = getEncountersFilePath('my-campaign');
        expect(result).toContain(process.cwd());
    });

    it('should handle campaign names with hyphens', () => {
        const result = getEncountersFilePath('my-test-campaign');
        expect(result).toContain('my-test-campaign');
        expect(result).toContain('encounters.json');
    });

    it('should handle campaign names with underscores', () => {
        const result = getEncountersFilePath('my_test_campaign');
        expect(result).toContain('my_test_campaign');
        expect(result).toContain('encounters.json');
    });

    it('should always return path ending with encounters.json', () => {
        const result = getEncountersFilePath('campaign');
        expect(result.endsWith('encounters.json')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// readEncounters
// ---------------------------------------------------------------------------
describe('encounterUtils - readEncounters', () => {
    beforeEach(() => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return empty encounters array when file does not exist', () => {
        fs.existsSync.mockReturnValueOnce(false);
        const result = readEncounters('nonexistent-campaign');
        expect(result).toEqual({ encounters: [] });
    });

    it('should return empty encounters array when campaign directory does not exist', () => {
        fs.existsSync.mockReturnValueOnce(false);
        const result = readEncounters('totally-missing-campaign');
        expect(result).toEqual({ encounters: [] });
    });

    it('should parse valid encounters JSON', () => {
        const encountersData = {
            encounters: [
                { id: 'enc-1', name: 'Goblin Ambush', level: 1 },
                { id: 'enc-2', name: 'Dragon Lair', level: 15 },
            ],
        };
        vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(encountersData));

        const result = readEncounters('test-campaign-1');
        expect(result).toEqual(encountersData);
    });

    it('should handle encounters with empty array', () => {
        const encountersData = { encounters: [] };
        vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(encountersData));

        const result = readEncounters('test-campaign-2');
        expect(result).toEqual(encountersData);
    });

    it('should handle encounters with complex nested data', () => {
        const encountersData = {
            encounters: [
                {
                    id: 'enc-1',
                    name: 'Complex Encounter',
                    level: 5,
                    creatures: [
                        { name: 'Goblin', hp: 7, ac: 15 },
                        { name: 'Goblin', hp: 7, ac: 15 },
                    ],
                    rewards: { xp: 225, items: ['potion', 'gold'] },
                    location: { map: 'forest', section: 'clearing' },
                },
            ],
        };
        vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(encountersData));

        const result = readEncounters('test-campaign-3');
        expect(result).toEqual(encountersData);
    });

    it('should return empty encounters on invalid JSON', () => {
        vi.spyOn(fs, 'readFileSync').mockReturnValue('this is not valid json{{{');

        const spy = vi.spyOn(console, 'error');
        const result = readEncounters('test-campaign-4');

        expect(result).toEqual({ encounters: [] });
        expect(spy).toHaveBeenCalledWith('Error reading encounters file:', expect.anything());
        spy.mockRestore();
    });

    it('should handle file read errors gracefully', () => {
        vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('EACCES: permission denied');
        });

        const spy = vi.spyOn(console, 'error');
        const result = readEncounters('test-campaign-5');

        expect(result).toEqual({ encounters: [] });
        spy.mockRestore();
    });

    it('should return encounters with various data types', () => {
        const encountersData = {
            encounters: [
                { id: '1', name: 'String', active: true, count: 42, values: null, nested: { a: 1 } },
            ],
        };
        vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(encountersData));

        const result = readEncounters('test-campaign-1');
        expect(result).toEqual(encountersData);
    });
});

// ---------------------------------------------------------------------------
// writeEncounters
// ---------------------------------------------------------------------------
describe('encounterUtils - writeEncounters', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should write encounters data to the correct file path', () => {
        const encountersData = { encounters: [{ id: '1', name: 'Test' }] };

        vi.spyOn(fs, 'existsSync').mockImplementation(() => true);
        vi.spyOn(fs, 'writeFileSync').mockImplementation((filePath, data) => {
            expect(filePath).toContain('write-test-1');
            expect(filePath).toContain('encounters.json');
            expect(JSON.parse(data)).toEqual(encountersData);
        });

        writeEncounters('write-test-1', encountersData);
    });

    it('should create the directory if it does not exist', () => {
        const encountersData = { encounters: [{ id: '1' }] };

        const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockImplementation(() => false);
        const mkdirSyncSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => { /* no-op */ });
        const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { /* no-op */ });

        writeEncounters('write-test-2', encountersData);

        expect(mkdirSyncSpy).toHaveBeenCalledWith(
            expect.stringContaining('write-test-2/data'),
            { recursive: true },
        );
        expect(writeFileSyncSpy).toHaveBeenCalled();

        existsSyncSpy.mockRestore();
        mkdirSyncSpy.mockRestore();
        writeFileSyncSpy.mockRestore();
    });

    it('should write data as JSON with pretty printing', () => {
        const encountersData = { encounters: [{ id: '1', name: 'Test' }] };

        let writtenData = '';
        vi.spyOn(fs, 'existsSync').mockImplementation(() => true);
        vi.spyOn(fs, 'writeFileSync').mockImplementation((filePath, data) => {
            writtenData = data;
        });

        writeEncounters('write-test-3', encountersData);

        // Should use JSON.stringify with indent (null, 2)
        expect(writtenData).toBe(JSON.stringify(encountersData, null, 2));
    });

    it('should write empty encounters array', () => {
        const encountersData = { encounters: [] };

        let writtenData = '';
        vi.spyOn(fs, 'existsSync').mockImplementation(() => true);
        vi.spyOn(fs, 'writeFileSync').mockImplementation((filePath, data) => {
            writtenData = data;
        });

        writeEncounters('write-test-4', encountersData);

        expect(writtenData).toBe(JSON.stringify(encountersData, null, 2));
    });

    it('should write complex nested encounter data', () => {
        const encountersData = {
            encounters: [
                {
                    id: 'enc-1',
                    name: 'Complex Encounter',
                    level: 5,
                    creatures: [
                        { name: 'Goblin', hp: 7, ac: 15 },
                        { name: 'Goblin', hp: 7, ac: 15 },
                    ],
                    rewards: { xp: 225, items: ['potion', 'gold'] },
                },
            ],
        };

        let writtenData = '';
        vi.spyOn(fs, 'existsSync').mockImplementation(() => true);
        vi.spyOn(fs, 'writeFileSync').mockImplementation((filePath, data) => {
            writtenData = data;
        });

        writeEncounters('complex-campaign', encountersData);

        expect(writtenData).toBe(JSON.stringify(encountersData, null, 2));
    });

    it('should use the correct file path from getEncountersFilePath', () => {
        let capturedPath = '';

        vi.spyOn(fs, 'existsSync').mockImplementation(() => true);
        vi.spyOn(fs, 'writeFileSync').mockImplementation((filePath, _data) => {
            capturedPath = filePath;
        });

        const expectedPath = path.join(process.cwd(), 'public', 'campaigns', 'path-test', 'data', 'encounters.json');
        expect(getEncountersFilePath('path-test')).toBe(expectedPath);

        writeEncounters('path-test', { encounters: [] });

        expect(capturedPath).toBe(expectedPath);
    });

    it('should handle single encounter object', () => {
        const encountersData = {
            encounters: [
                { id: 'solo-encounter', name: 'Boss Fight', level: 10 },
            ],
        };

        let writtenData = '';
        vi.spyOn(fs, 'existsSync').mockImplementation(() => true);
        vi.spyOn(fs, 'writeFileSync').mockImplementation((filePath, data) => {
            writtenData = data;
        });

        writeEncounters('solo-campaign', encountersData);

        const parsed = JSON.parse(writtenData);
        expect(parsed.encounters).toHaveLength(1);
        expect(parsed.encounters[0].id).toBe('solo-encounter');
    });

    it('should handle multiple encounters', () => {
        const encountersData = {
            encounters: [
                { id: '1', name: 'Encounter 1' },
                { id: '2', name: 'Encounter 2' },
                { id: '3', name: 'Encounter 3' },
            ],
        };

        let writtenData = '';
        vi.spyOn(fs, 'existsSync').mockImplementation(() => true);
        vi.spyOn(fs, 'writeFileSync').mockImplementation((filePath, data) => {
            writtenData = data;
        });

        writeEncounters('multi-campaign', encountersData);

        const parsed = JSON.parse(writtenData);
        expect(parsed.encounters).toHaveLength(3);
    });
});
