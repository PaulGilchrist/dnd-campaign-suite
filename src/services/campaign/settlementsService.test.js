import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  saveSettlement,
  loadSettlements,
  saveSettlements,
  loadSettlement,
  deleteSettlement,
} from './settlementsService.js';

describe('settlementsService', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveSettlement', () => {
    it('returns parsed JSON body and sends PUT with encoded URL on success', async () => {
      const mockSettlement = { name: 'Waterdeep', type: 'city', population: 90000 };
      const responseData = { success: true, name: 'Waterdeep' };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await saveSettlement('campaign1', mockSettlement);

      expect(result).toEqual(responseData);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/settlements/Waterdeep',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockSettlement),
        }
      );
    });

    it('sends PUT with oldName in URL when provided', async () => {
      const mockSettlement = { name: 'Town/Region', type: 'city' };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveSettlement('campaign/1', mockSettlement, 'Old/Name');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/settlements/Old%2FName',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockSettlement),
        }
      );
    });

    it('throws with custom error message on API error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        statusText: 'Conflict',
        json: () => Promise.resolve({ error: 'Settlement already exists' }),
      });

      await expect(
        saveSettlement('campaign1', { name: 'Test' })
      ).rejects.toThrow('Settlement already exists');
    });

    it('rethrows on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

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
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSettlements),
      });

      const result = await loadSettlements('campaign1');

      expect(result).toEqual(mockSettlements);
    });

    it('URL-encodes the campaign name and includes GET options', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await loadSettlements('campaign/with/slashes');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2Fwith%2Fslashes/settlements',
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    it('throws with custom error message on API error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Campaign not found' }),
      });

      await expect(loadSettlements('campaign1')).rejects.toThrow('Campaign not found');
    });

    it('rethrows on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

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

      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await saveSettlements('campaign1', settlements);

      expect(result).toEqual(responseData);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/settlements',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settlements }),
        }
      );
    });

    it('URL-encodes the campaign name', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveSettlements('my campaign/1', []);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign%2F1/settlements',
        expect.any(Object)
      );
    });

    it('throws with custom error message on API error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid settlements data' }),
      });

      await expect(saveSettlements('campaign1', [])).rejects.toThrow('Invalid settlements data');
    });

    it('rethrows on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

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
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSettlement),
      });

      const result = await loadSettlement('campaign1', 'Waterdeep');

      expect(result).toEqual(mockSettlement);
    });

    it('URL-encodes both campaign name and settlement name', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await loadSettlement('campaign/1', 'settlement/abc');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/settlements/settlement%2Fabc',
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    it('throws with custom error message on API error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Settlement not found' }),
      });

      await expect(loadSettlement('campaign1', 'nonexistent')).rejects.toThrow('Settlement not found');
    });

    it('rethrows on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadSettlement('campaign1', 'nonexistent')).rejects.toThrow('ENOTFOUND');
    });
  });

  describe('deleteSettlement', () => {
    it('returns parsed JSON body on successful delete', async () => {
      const responseData = { success: true, deleted: 'Waterdeep' };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await deleteSettlement('campaign1', 'Waterdeep');

      expect(result).toEqual(responseData);
    });

    it('sends DELETE request with encoded URL on success', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await deleteSettlement('campaign/1', 'settlement/abc');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/settlements/settlement%2Fabc',
        { method: 'DELETE' }
      );
    });

    it('throws with custom error message on API error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Settlement not found' }),
      });

      await expect(deleteSettlement('campaign1', 'nonexistent')).rejects.toThrow('Settlement not found');
    });

    it('rethrows on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(deleteSettlement('campaign1', 'nonexistent')).rejects.toThrow('ENOTFOUND');
    });
  });
});
