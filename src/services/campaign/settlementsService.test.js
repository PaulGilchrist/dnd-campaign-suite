// @improved-by-ai
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

    it('sends PUT to the correct URL using settlement name', async () => {
      const mockSettlement = { name: 'Waterdeep', type: 'city' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveSettlement('campaign1', mockSettlement);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/settlements/Waterdeep',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockSettlement),
        }
      );
    });

    it('uses oldName in URL when provided (rename scenario)', async () => {
      const mockSettlement = { name: 'Neverwinter', type: 'city' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveSettlement('campaign1', mockSettlement, 'OldNeverwinter');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/settlements/OldNeverwinter',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockSettlement),
        }
      );
    });

    it('encodes campaign name with spaces in URL', async () => {
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

    it('encodes campaign and settlement names with special characters in URL', async () => {
      const mockSettlement = { name: 'Town/Region', type: 'city' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveSettlement('campaign/1', mockSettlement, 'Old/Name');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/settlements/Old%2FName',
        expect.any(Object)
      );
    });

    it('throws with custom error message on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Conflict',
        json: () => Promise.resolve({ error: 'Settlement already exists' }),
      });

      await expect(
        saveSettlement('campaign1', { name: 'Test' })
      ).rejects.toThrow('Settlement already exists');
    });

    it('throws generic message when API error has no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(
        saveSettlement('campaign1', { name: 'Test' })
      ).rejects.toThrow('Failed to save settlement');
    });

    it('throws the original error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(
        saveSettlement('campaign1', { name: 'Test' })
      ).rejects.toThrow('ENOTFOUND');
    });

    it('calls console.error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        saveSettlement('campaign1', { name: 'Test' })
      ).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Error saving settlement:', expect.any(Error));
      consoleSpy.mockRestore();
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

    it('sends GET request with correct URL and headers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await loadSettlements('campaign1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/settlements',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('encodes campaign name with spaces in URL', async () => {
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

    it('encodes campaign name with special characters in URL', async () => {
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

    it('throws with custom error message on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Campaign not found' }),
      });

      await expect(loadSettlements('campaign1')).rejects.toThrow('Campaign not found');
    });

    it('throws generic message when API error has no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadSettlements('campaign1')).rejects.toThrow('Failed to load settlements');
    });

    it('throws the original error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadSettlements('campaign1')).rejects.toThrow('ENOTFOUND');
    });

    it('calls console.error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(loadSettlements('campaign1')).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Error loading settlements:', expect.any(Error));
      consoleSpy.mockRestore();
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

    it('encodes campaign name with spaces in URL', async () => {
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

    it('encodes campaign name with special characters in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveSettlements('campaign/1', []);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/settlements',
        expect.any(Object)
      );
    });

    it('throws with custom error message on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid settlements data' }),
      });

      await expect(saveSettlements('campaign1', [])).rejects.toThrow('Invalid settlements data');
    });

    it('throws generic message when API error has no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(saveSettlements('campaign1', [])).rejects.toThrow('Failed to save settlements');
    });

    it('throws the original error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(saveSettlements('campaign1', [])).rejects.toThrow('ENOTFOUND');
    });

    it('calls console.error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(saveSettlements('campaign1', [])).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Error saving settlements:', expect.any(Error));
      consoleSpy.mockRestore();
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

    it('sends GET request with correct URL and headers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await loadSettlement('campaign1', 'Waterdeep');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/settlements/Waterdeep',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('encodes campaign and settlement names with spaces in URL', async () => {
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

    it('encodes campaign and settlement names with special characters in URL', async () => {
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

    it('throws with custom error message on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Settlement not found' }),
      });

      await expect(loadSettlement('campaign1', 'nonexistent')).rejects.toThrow('Settlement not found');
    });

    it('throws generic message when API error has no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadSettlement('campaign1', 'nonexistent')).rejects.toThrow('Failed to load settlement');
    });

    it('throws the original error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadSettlement('campaign1', 'nonexistent')).rejects.toThrow('ENOTFOUND');
    });

    it('calls console.error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(loadSettlement('campaign1', 'nonexistent')).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Error loading settlement:', expect.any(Error));
      consoleSpy.mockRestore();
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

    it('sends DELETE request with correct URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await deleteSettlement('campaign1', 'Waterdeep');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/settlements/Waterdeep',
        { method: 'DELETE' }
      );
    });

    it('encodes campaign and settlement names with spaces in URL', async () => {
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

    it('encodes campaign and settlement names with special characters in URL', async () => {
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

    it('throws with custom error message on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Settlement not found' }),
      });

      await expect(deleteSettlement('campaign1', 'nonexistent')).rejects.toThrow('Settlement not found');
    });

    it('throws generic message when API error has no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(deleteSettlement('campaign1', 'nonexistent')).rejects.toThrow('Failed to delete settlement');
    });

    it('throws the original error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(deleteSettlement('campaign1', 'nonexistent')).rejects.toThrow('ENOTFOUND');
    });

    it('calls console.error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(deleteSettlement('campaign1', 'nonexistent')).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Error deleting settlement:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
