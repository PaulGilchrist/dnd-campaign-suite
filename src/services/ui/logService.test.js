import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLog, addEntry } from './logService.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockSuccessResponse(data) {
    const headers = new Map([['content-type', 'application/json']]);
    return {
        ok: true,
        status: 200,
        headers,
        json: async () => data
    };
}

function mockErrorResponse(status = 500) {
    return {
        ok: false,
        status,
        headers: new Map([['content-type', 'text/html']]),
        json: async () => null
    };
}

describe('logService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getLog', () => {
        it('should fetch log for a campaign', async () => {
            const mockLog = [
                { timestamp: '2024-01-01', message: 'Campaign started' }
            ];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockLog));

            const result = await getLog('my-campaign');

            expect(result).toEqual(mockLog);
            expect(mockFetch).toHaveBeenCalledWith(
                '/api/campaigns/my-campaign/log'
            );
        });

        it('should URL-encode campaign names with special characters', async () => {
            const mockLog = [{ message: 'Entry' }];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockLog));

            await getLog('my campaign!');

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/campaigns/my%20campaign!/log'
            );
        });

        it('should URL-encode campaign names with slashes', async () => {
            const mockLog = [{ message: 'Entry' }];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockLog));

            await getLog('campaign/level1');

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/campaigns/campaign%2Flevel1/log'
            );
        });

        it('should throw on non-ok response', async () => {
            mockFetch.mockResolvedValue(mockErrorResponse(404));

            await expect(getLog('missing-campaign')).rejects.toThrow(
                'Failed to fetch log'
            );
        });

        it('should throw on network error', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            await expect(getLog('my-campaign')).rejects.toThrow(
                'Network error'
            );
        });

        it('should throw on server error', async () => {
            mockFetch.mockResolvedValue(mockErrorResponse(500));

            await expect(getLog('my-campaign')).rejects.toThrow(
                'Failed to fetch log'
            );
        });
    });

    describe('addEntry', () => {
        it('should add a log entry to a campaign', async () => {
            const mockEntry = { message: 'Player attacked goblin', type: 'combat' };
            const mockResponse = { success: true };
            mockFetch.mockResolvedValue(mockSuccessResponse(mockResponse));

            const result = await addEntry('my-campaign', mockEntry);

            expect(result).toEqual(mockResponse);
            expect(mockFetch).toHaveBeenCalledWith(
                '/api/campaigns/my-campaign/log',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mockEntry)
                }
            );
        });

        it('should URL-encode campaign names with special characters', async () => {
            const mockEntry = { message: 'Test entry' };
            const mockResponse = { success: true };
            mockFetch.mockResolvedValue(mockSuccessResponse(mockResponse));

            await addEntry('my campaign!', mockEntry);

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/campaigns/my%20campaign!/log',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mockEntry)
                }
            );
        });

        it('should send valid JSON body', async () => {
            const mockEntry = { message: 'Player cast fireball', type: 'spell' };
            const mockResponse = { success: true };
            mockFetch.mockResolvedValue(mockSuccessResponse(mockResponse));

            await addEntry('my-campaign', mockEntry);

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body).toEqual(mockEntry);
        });

        it('should throw on non-ok response', async () => {
            const mockEntry = { message: 'Test' };
            mockFetch.mockResolvedValue(mockErrorResponse(500));

            await expect(addEntry('my-campaign', mockEntry)).rejects.toThrow(
                'Failed to add log entry'
            );
        });

        it('should throw on network error', async () => {
            const mockEntry = { message: 'Test' };
            mockFetch.mockRejectedValue(new Error('Network error'));

            await expect(addEntry('my-campaign', mockEntry)).rejects.toThrow(
                'Network error'
            );
        });

        it('should handle complex entry objects', async () => {
            const mockEntry = {
                message: 'Player leveled up',
                type: 'levelup',
                details: {
                    character: 'Thorin',
                    level: 5,
                    class: 'Cleran'
                }
            };
            const mockResponse = { success: true, entryId: 'abc123' };
            mockFetch.mockResolvedValue(mockSuccessResponse(mockResponse));

            const result = await addEntry('my-campaign', mockEntry);

            expect(result).toEqual(mockResponse);
            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.details.level).toBe(5);
            expect(body.details.class).toBe('Cleran');
        });
    });
});
