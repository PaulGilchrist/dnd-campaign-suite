// @cleaned-by-ai
// Removed redundant URL-encoding tests that duplicate behavior in the same
// describe blocks. The "oldName rename scenario" test was a duplicate of the
// "encoded special characters" test. Consolidated combined error cases kept
// as they provide good behavioral coverage.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  saveSettlement,
  loadSettlements,
  saveSettlements,
  loadSettlement,
  deleteSettlement,
} from './settlementsService.js';

describe('settlementsService', () => {
  let mockFetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveSettlement', () => {
    it('returns parsed JSON body on successful save', async () => {
      const mockSettlement = { name: 'Waterdeep', type: 'city', population: 90000 };
      const responseData = { success: true, name: 'Waterdeep' };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await saveSettlement('campaign1', mockSettlement);

      expect(result).toEqual(responseData);
    });

    it('sends PUT to the correct URL with encoded special characters', async () => {
      const mockSettlement = { name: 'Town/Region', type: 'city' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveSettlement('campaign/1', mockSettlement, 'Old/Name');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/settlements/Old%2FName',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockSettlement),
        }
      );
    });

    it('throws with custom error on API error, generic fallback on network failure', async () => {
      // API error with error field
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Conflict',
        json: () => Promise.resolve({ error: 'Settlement already exists' }),
      });

      await expect(
        saveSettlement('campaign1', { name: 'Test' })
      ).rejects.toThrow('Settlement already exists');

      // API error without error field
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(
        saveSettlement('campaign1', { name: 'Test' })
      ).rejects.toThrow('Failed to save settlement');

      // Network failure
      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(
        saveSettlement('campaign1', { name: 'Test' })
      ).rejects.toThrow('ENOTFOUND');
    });
  });

  describe('loadSettlements', () => {
    it('returns settlements array from successful API response', async () => {
      const mockSettlements = [
        { name: 'Waterdeep', type: 'city', population: 90000 },
        { name: 'Baldur\'s Gate', type: 'city', population: 50000 },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSettlements),
      });

      const result = await loadSettlements('campaign1');

      expect(result).toEqual(mockSettlements);
    });

    it('sends GET request with correct URL and encoded special characters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await loadSettlements('campaign/with/slashes');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2Fwith%2Fslashes/settlements',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('throws with custom error on API error, generic fallback on network failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Campaign not found' }),
      });

      await expect(loadSettlements('campaign1')).rejects.toThrow('Campaign not found');

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadSettlements('campaign1')).rejects.toThrow('Failed to load settlements');

      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadSettlements('campaign1')).rejects.toThrow('ENOTFOUND');
    });
  });

  describe('saveSettlements', () => {
    it('sends POST with settlements array and returns parsed JSON on success', async () => {
      const settlements = [
        { name: 'Waterdeep', type: 'city' },
        { name: 'Baldur\'s Gate', type: 'city' },
      ];
      const responseData = { success: true, savedCount: 2 };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await saveSettlements('campaign1', settlements);

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/settlements',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settlements }),
        }
      );
    });

    it('sends empty array when settlements is empty', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await saveSettlements('campaign1', []);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/settlements',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ settlements: [] }),
        })
      );
    });

    it('throws with custom error on API error, generic fallback on network failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid settlements data' }),
      });

      await expect(saveSettlements('campaign1', [])).rejects.toThrow('Invalid settlements data');

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(saveSettlements('campaign1', [])).rejects.toThrow('Failed to save settlements');

      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(saveSettlements('campaign1', [])).rejects.toThrow('ENOTFOUND');
    });
  });

  describe('loadSettlement', () => {
    it('returns a single settlement from API response', async () => {
      const mockSettlement = {
        name: 'Waterdeep',
        type: 'city',
        population: 90000,
        description: 'City of Skilled Hands',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSettlement),
      });

      const result = await loadSettlement('campaign1', 'Waterdeep');

      expect(result).toEqual(mockSettlement);
    });

    it('sends GET request with correct URL and encoded special characters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await loadSettlement('campaign/1', 'settlement/abc');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/settlements/settlement%2Fabc',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('throws with custom error on API error, generic fallback on network failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Settlement not found' }),
      });

      await expect(loadSettlement('campaign1', 'nonexistent')).rejects.toThrow('Settlement not found');

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadSettlement('campaign1', 'nonexistent')).rejects.toThrow('Failed to load settlement');

      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadSettlement('campaign1', 'nonexistent')).rejects.toThrow('ENOTFOUND');
    });
  });

  describe('deleteSettlement', () => {
    it('returns parsed JSON body on successful delete', async () => {
      const responseData = { success: true, deleted: 'Waterdeep' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await deleteSettlement('campaign1', 'Waterdeep');

      expect(result).toEqual(responseData);
    });

    it('sends DELETE request with correct URL and encoded special characters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await deleteSettlement('campaign/1', 'settlement/abc');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/settlements/settlement%2Fabc',
        { method: 'DELETE' }
      );
    });

    it('throws with custom error on API error, generic fallback on network failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Settlement not found' }),
      });

      await expect(deleteSettlement('campaign1', 'nonexistent')).rejects.toThrow('Settlement not found');

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(deleteSettlement('campaign1', 'nonexistent')).rejects.toThrow('Failed to delete settlement');

      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(deleteSettlement('campaign1', 'nonexistent')).rejects.toThrow('ENOTFOUND');
    });
  });
});
