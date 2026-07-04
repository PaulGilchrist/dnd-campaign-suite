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

        it('returns an empty array for campaigns with no log entries', async () => {
            fetchSpy.mockResolvedValue(createResponse({ data: [] }));

            const result = await getLog('empty-campaign');

            expect(result).toEqual([]);
        });

        it.each([
            ['my campaign!', '/api/campaigns/my%20campaign!/log'],
            ['campaign/level1', '/api/campaigns/campaign%2Flevel1/log'],
            ['campaign?query', '/api/campaigns/campaign%3Fquery/log'],
            ['campaign#hash', '/api/campaigns/campaign%23hash/log'],
            ['café', '/api/campaigns/caf%C3%A9/log'],
        ])('URL-encodes campaign name "%s" in fetch URL', async (_name, expectedUrl) => {
            fetchSpy.mockResolvedValue(createResponse({ data: [] }));

            await getLog(_name);

            expect(fetchSpy).toHaveBeenCalledWith(expectedUrl);
        });

        it('throws with descriptive error on non-ok response', async () => {
            fetchSpy.mockResolvedValue(createResponse({ ok: false, status: 404 }));

            await expect(getLog('missing-campaign')).rejects.toThrow('Failed to fetch log');
        });

        it.each([
            [400, 'Bad Request'],
            [401, 'Unauthorized'],
            [403, 'Forbidden'],
            [404, 'Not Found'],
            [500, 'Internal Server Error'],
            [502, 'Bad Gateway'],
            [503, 'Service Unavailable'],
        ])('throws on HTTP %s (%s)', async (status) => {
            fetchSpy.mockResolvedValue(createResponse({ ok: false, status }));

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

        it.each([
            ['my campaign!', '/api/campaigns/my%20campaign!/log'],
            ['campaign/level1', '/api/campaigns/campaign%2Flevel1/log'],
            ['campaign?query', '/api/campaigns/campaign%3Fquery/log'],
        ])('URL-encodes campaign name "%s" in fetch URL', async (_name, expectedUrl) => {
            fetchSpy.mockResolvedValue(createResponse({ data: { success: true } }));

            await addEntry(_name, { message: 'Test' });

            expect(fetchSpy).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
        });

        it('serializes complex entry objects with nested data', async () => {
            const mockEntry = {
                message: 'Player leveled up',
                type: 'levelup',
                details: { character: 'Thorin', level: 5, class: 'Cleran' }
            };
            fetchSpy.mockResolvedValue(createResponse({ data: { success: true, entryId: 'abc123' } }));

            await addEntry('my-campaign', mockEntry);

            const callArgs = fetchSpy.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.details.level).toBe(5);
            expect(body.details.class).toBe('Cleran');
        });

        it.each([
            [400, 'Bad Request'],
            [401, 'Unauthorized'],
            [403, 'Forbidden'],
            [404, 'Not Found'],
            [500, 'Internal Server Error'],
            [502, 'Bad Gateway'],
            [503, 'Service Unavailable'],
        ])('throws with descriptive error on HTTP %s (%s)', async (status) => {
            fetchSpy.mockResolvedValue(createResponse({ ok: false, status }));

            await expect(addEntry('my-campaign', { message: 'Test' })).rejects.toThrow('Failed to add log entry');
        });

    });
});
