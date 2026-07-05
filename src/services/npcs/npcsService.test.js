// @cleaned-by-ai
import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadNPCs, saveNPCs, loadNPC, deleteNPC, saveNPC } from './npcsService.js';

function makeFetchMock() {
  return vi.fn();
}

function stubFetch(fn) {
  vi.stubGlobal('fetch', fn);
}

function okResponse(body) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
}

function errResponse(errorBody) {
  return Promise.resolve({ ok: false, json: () => Promise.resolve(errorBody) });
}

describe('npcsService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveNPC', () => {
    it('should save an NPC with PUT and return response', async () => {
      const npc = { name: 'Town Guard', alignment: 'Lawful Good' };
      const responseData = { success: true };
      const fetchMock = makeFetchMock();
      fetchMock.mockResolvedValue(okResponse(responseData));
      stubFetch(fetchMock);

      const result = await saveNPC('campaign1', npc);

      expect(result).toEqual(responseData);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/npcs/Town%20Guard',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(npc),
        }
      );
    });

    it('should use oldName as the URL path when renaming', async () => {
      const npc = { name: 'New Guard' };
      const fetchMock = makeFetchMock();
      fetchMock.mockResolvedValue(okResponse({}));
      stubFetch(fetchMock);

      await saveNPC('campaign1', npc, 'Old Guard');

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/npcs/Old%20Guard',
        expect.any(Object)
      );
    });

    it('should encode special characters in campaign and NPC names', async () => {
      const npc = { name: 'Guard' };
      const fetchMock = makeFetchMock();
      fetchMock.mockResolvedValue(okResponse({}));
      stubFetch(fetchMock);

      await saveNPC('my campaign!', npc, 'guard@home');

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign!/npcs/guard%40home',
        expect.any(Object)
      );
    });

    it('should throw on API error', async () => {
      const fetchMock = makeFetchMock();
      fetchMock.mockResolvedValue(errResponse({ error: 'NPC not found' }));
      stubFetch(fetchMock);

      await expect(saveNPC('campaign1', { name: 'Ghost' })).rejects.toThrow('NPC not found');
    });

    it('should throw generic message when API error has no error field', async () => {
      const fetchMock = makeFetchMock();
      fetchMock.mockResolvedValue(errResponse({}));
      stubFetch(fetchMock);

      await expect(saveNPC('campaign1', { name: 'Ghost' })).rejects.toThrow('Failed to save NPC');
    });

    it('should throw on network error', async () => {
      const fetchMock = makeFetchMock();
      fetchMock.mockRejectedValue(new Error('ENOTFOUND'));
      stubFetch(fetchMock);

      await expect(saveNPC('campaign1', { name: 'Ghost' })).rejects.toThrow('ENOTFOUND');
    });
  });

  describe('loadNPCs', () => {
    it('should return NPCs array from API', async () => {
      const mockNPCs = [{ name: 'NPC 1' }, { name: 'NPC 2' }];
      const fetchMock = makeFetchMock();
      fetchMock.mockResolvedValue(okResponse(mockNPCs));
      stubFetch(fetchMock);

      const result = await loadNPCs('campaign1');

      expect(result).toEqual(mockNPCs);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/npcs',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should return empty array when API returns empty', async () => {
      const fetchMock = makeFetchMock();
      fetchMock.mockResolvedValue(okResponse([]));
      stubFetch(fetchMock);

      const result = await loadNPCs('campaign1');

      expect(result).toEqual([]);
    });

    it('should encode campaign name with spaces', async () => {
      const fetchMock = makeFetchMock();
      fetchMock.mockResolvedValue(okResponse([]));
      stubFetch(fetchMock);

      await loadNPCs('campaign with spaces');

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/npcs',
        expect.any(Object)
      );
    });

    it('should throw on API error with message', async () => {
      const fetchMock = makeFetchMock();
      fetchMock.mockResolvedValue(errResponse({ error: 'Campaign not found' }));
      stubFetch(fetchMock);

      await expect(loadNPCs('campaign1')).rejects.toThrow('Campaign not found');
    });

    it('should throw on network error', async () => {
      const fetchMock = makeFetchMock();
      fetchMock.mockRejectedValue(new Error('Network error'));
      stubFetch(fetchMock);

      await expect(loadNPCs('campaign1')).rejects.toThrow('Network error');
    });
  });

  describe('saveNPCs', () => {
    it('should save NPCs array and return response', async () => {
      const npcs = [{ name: 'NPC 1' }];
      const responseData = { success: true, savedCount: 1 };
      const fetchMock = makeFetchMock();
      fetchMock.mockResolvedValue(okResponse(responseData));
      stubFetch(fetchMock);

      const result = await saveNPCs('campaign1', npcs);

      expect(result).toEqual(responseData);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/npcs',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ npcs }),
        }
      );
    });

    it('should throw on API error with message', async () => {
      const fetchMock = makeFetchMock();
      fetchMock.mockResolvedValue(errResponse({ error: 'Invalid NPCs data' }));
      stubFetch(fetchMock);

      await expect(saveNPCs('campaign1', [])).rejects.toThrow('Invalid NPCs data');
    });

    it('should throw on network error', async () => {
      const fetchMock = makeFetchMock();
      fetchMock.mockRejectedValue(new Error('Network error'));
      stubFetch(fetchMock);

      await expect(saveNPCs('campaign1', [])).rejects.toThrow('Network error');
    });
  });

  describe('loadNPC', () => {
    it('should return a single NPC from API', async () => {
      const mockNPC = { name: 'Town Guard' };
      const fetchMock = makeFetchMock();
      fetchMock.mockResolvedValue(okResponse(mockNPC));
      stubFetch(fetchMock);

      const result = await loadNPC('campaign1', 'Town Guard');

      expect(result).toEqual(mockNPC);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/npcs/Town%20Guard',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should encode both campaign and NPC names', async () => {
      const fetchMock = makeFetchMock();
      fetchMock.mockResolvedValue(okResponse({}));
      stubFetch(fetchMock);

      await loadNPC('campaign with spaces', 'NPC with spaces');

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/npcs/NPC%20with%20spaces',
        expect.any(Object)
      );
    });

    it('should throw on API error with message', async () => {
      const fetchMock = makeFetchMock();
      fetchMock.mockResolvedValue(errResponse({ error: 'NPC not found' }));
      stubFetch(fetchMock);

      await expect(loadNPC('campaign1', 'Town Guard')).rejects.toThrow('NPC not found');
    });

    it('should throw on network error', async () => {
      const fetchMock = makeFetchMock();
      fetchMock.mockRejectedValue(new Error('Network error'));
      stubFetch(fetchMock);

      await expect(loadNPC('campaign1', 'Town Guard')).rejects.toThrow('Network error');
    });
  });

  describe('deleteNPC', () => {
    it('should delete an NPC and return response', async () => {
      const responseData = { success: true };
      const fetchMock = makeFetchMock();
      fetchMock.mockResolvedValue(okResponse(responseData));
      stubFetch(fetchMock);

      const result = await deleteNPC('campaign1', 'Town Guard');

      expect(result).toEqual(responseData);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/npcs/Town%20Guard',
        { method: 'DELETE' }
      );
    });

    it('should encode both campaign and NPC names', async () => {
      const fetchMock = makeFetchMock();
      fetchMock.mockResolvedValue(okResponse({ success: true }));
      stubFetch(fetchMock);

      await deleteNPC('campaign with spaces', 'NPC with spaces');

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/npcs/NPC%20with%20spaces',
        expect.any(Object)
      );
    });

    it('should throw on API error with message', async () => {
      const fetchMock = makeFetchMock();
      fetchMock.mockResolvedValue(errResponse({ error: 'NPC not found' }));
      stubFetch(fetchMock);

      await expect(deleteNPC('campaign1', 'Town Guard')).rejects.toThrow('NPC not found');
    });

    it('should throw on network error', async () => {
      const fetchMock = makeFetchMock();
      fetchMock.mockRejectedValue(new Error('Network error'));
      stubFetch(fetchMock);

      await expect(deleteNPC('campaign1', 'Town Guard')).rejects.toThrow('Network error');
    });
  });
});
