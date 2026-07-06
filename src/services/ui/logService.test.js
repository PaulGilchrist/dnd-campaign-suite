// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi } from 'vitest';
import { getLog, addEntry } from './logService.js';

function createResponse(options) {
    return {
        ok: options.ok ?? true,
        status: options.status ?? 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => options.data ?? null
    };
}

describe('logService', () => {
    let fetchSpy;

    beforeEach(() => {
        fetchSpy = vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getLog', () => {
        it('returns the parsed JSON log array', async () => {
            const mockLog = [
                { timestamp: '2024-01-01', message: 'Campaign started' }
            ];
            fetchSpy.mockResolvedValue(createResponse({ data: mockLog }));

            const result = await getLog('my-campaign');

            expect(result).toEqual(mockLog);
        });

        it('returns an empty array when the log is empty', async () => {
            fetchSpy.mockResolvedValue(createResponse({ data: [] }));

            const result = await getLog('empty-campaign');

            expect(result).toEqual([]);
        });

        it('URL-encodes campaign names with special characters', async () => {
            fetchSpy.mockResolvedValue(createResponse({ data: [] }));

            await getLog('my campaign!');

            expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/my%20campaign!/log');
        });

        it('throws with descriptive error on non-ok response', async () => {
            fetchSpy.mockResolvedValue(createResponse({ ok: false, status: 500 }));

            await expect(getLog('my-campaign')).rejects.toThrow('Failed to fetch log');
        });

    });

    describe('addEntry', () => {
        it('returns the parsed JSON response', async () => {
            const mockEntry = { message: 'Player attacked goblin', type: 'combat' };
            const mockResponse = { success: true, entryId: 'e1' };
            fetchSpy.mockResolvedValue(createResponse({ data: mockResponse }));

            const result = await addEntry('my-campaign', mockEntry);

            expect(result).toEqual(mockResponse);
        });

        it('POSTs with correct URL, method, headers, and JSON body', async () => {
            const mockEntry = { message: 'Player cast fireball', type: 'spell' };
            fetchSpy.mockResolvedValue(createResponse({ data: { success: true } }));

            await addEntry('my-campaign', mockEntry);

            expect(fetchSpy).toHaveBeenCalledWith(
                '/api/campaigns/my-campaign/log',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mockEntry)
                }
            );
        });

        it('URL-encodes campaign names with special characters', async () => {
            fetchSpy.mockResolvedValue(createResponse({ data: { success: true } }));

            await addEntry('my campaign!', { message: 'Test' });

            expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/my%20campaign!/log', expect.any(Object));
        });

        it('throws with descriptive error on non-ok response', async () => {
            fetchSpy.mockResolvedValue(createResponse({ ok: false, status: 500 }));

            await expect(addEntry('my-campaign', { message: 'Test' })).rejects.toThrow('Failed to add log entry');
        });

    });
});
