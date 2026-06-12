import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveSettlement,
  loadSettlements,
  saveSettlements,
  loadSettlement,
  deleteSettlement,
} from './settlementsService.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('settlementsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveSettlement', () => {
    it('should save a settlement and return response', async () => {
      const mockSettlement = { name: 'Waterdeep', type: 'city', population: 90000 };
      const responseData = { success: true, name: 'Waterdeep' };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await saveSettlement('campaign1', mockSettlement);

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/settlements/Waterdeep',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockSettlement),
        }
      );
    });

    it('should use oldName when provided', async () => {
      const mockSettlement = { name: 'Neverwinter', type: 'city' };
      const responseData = { success: true, name: 'Neverwinter' };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await saveSettlement('campaign1', mockSettlement, 'OldNeverwinter');

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/settlements/OldNeverwinter',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockSettlement),
        }
      );
    });

    it('should encode campaign name and settlement name in URL', async () => {
      const mockSettlement = { name: 'New Town', type: 'village' };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveSettlement('campaign with spaces', mockSettlement, 'Old Name');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/settlements/Old%20Name',
        expect.any(Object)
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Settlement already exists' }),
      });

      await expect(
        saveSettlement('campaign1', { name: 'Test' })
      ).rejects.toThrow('Settlement already exists');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(
        saveSettlement('campaign1', { name: 'Test' })
      ).rejects.toThrow('Failed to save settlement');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        saveSettlement('campaign1', { name: 'Test' })
      ).rejects.toThrow('Network error');
    });
  });

  describe('loadSettlements', () => {
    it('should return settlements from API response', async () => {
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
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/settlements',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should encode campaign name in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await loadSettlements('campaign with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/settlements',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Campaign not found' }),
      });

      await expect(loadSettlements('campaign1')).rejects.toThrow('Campaign not found');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(loadSettlements('campaign1')).rejects.toThrow('Failed to load settlements');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(loadSettlements('campaign1')).rejects.toThrow('Network error');
    });
  });

  describe('saveSettlements', () => {
    it('should save settlements and return response', async () => {
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

    it('should encode campaign name in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveSettlements('campaign with spaces', []);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/settlements',
        expect.any(Object)
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid settlements data' }),
      });

      await expect(saveSettlements('campaign1', [])).rejects.toThrow('Invalid settlements data');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(saveSettlements('campaign1', [])).rejects.toThrow('Failed to save settlements');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(saveSettlements('campaign1', [])).rejects.toThrow('Network error');
    });
  });

  describe('loadSettlement', () => {
    it('should return a single settlement from API response', async () => {
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
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/settlements/Waterdeep',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should encode campaign and settlement names in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await loadSettlement('campaign with spaces', 'settlement with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/settlements/settlement%20with%20spaces',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Settlement not found' }),
      });

      await expect(loadSettlement('campaign1', 'nonexistent')).rejects.toThrow('Settlement not found');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(loadSettlement('campaign1', 'nonexistent')).rejects.toThrow('Failed to load settlement');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(loadSettlement('campaign1', 'nonexistent')).rejects.toThrow('Network error');
    });
  });

  describe('deleteSettlement', () => {
    it('should delete a settlement and return response', async () => {
      const responseData = { success: true, deleted: 'Waterdeep' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await deleteSettlement('campaign1', 'Waterdeep');

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/settlements/Waterdeep',
        { method: 'DELETE' }
      );
    });

    it('should encode campaign and settlement names in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await deleteSettlement('campaign with spaces', 'settlement with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/settlements/settlement%20with%20spaces',
        { method: 'DELETE' }
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Settlement not found' }),
      });

      await expect(deleteSettlement('campaign1', 'nonexistent')).rejects.toThrow('Settlement not found');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(deleteSettlement('campaign1', 'nonexistent')).rejects.toThrow('Failed to delete settlement');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(deleteSettlement('campaign1', 'nonexistent')).rejects.toThrow('Network error');
    });
  });
});
