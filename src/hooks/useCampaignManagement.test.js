import { renderHook, act } from '@testing-library/react';
import useCampaignManagement from './useCampaignManagement.js';

describe('useCampaignManagement', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost', reload: vi.fn() },
      writable: true,
    });

    global.fetch = vi.fn();
    window.confirm = vi.fn();
    window.prompt = vi.fn();

    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('sets showCampaignSelection to true, campaignName to null, and isLocalhost based on hostname', () => {
      const { result } = renderHook(() => useCampaignManagement());

      expect(result.current.showCampaignSelection).toBe(true);
      expect(result.current.campaignName).toBeNull();
      expect(result.current.isLocalhost).toBe(true);
    });
  });

  describe('handleCampaignSelect', () => {
    it('hides selection, sets campaignName, and calls callback', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useCampaignManagement());

      act(() => {
        result.current.setCampaignSelectCallback(callback);
      });

      act(() => {
        result.current.handleCampaignSelect('Test Campaign', ['char1']);
      });

      expect(result.current.showCampaignSelection).toBe(false);
      expect(result.current.campaignName).toBe('Test Campaign');
      expect(callback).toHaveBeenCalledWith('Test Campaign', ['char1']);
    });
  });

  describe('setCampaignSelectCallback', () => {
    it('registers callback that fires on next campaign select', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useCampaignManagement());

      result.current.setCampaignSelectCallback(callback);
      result.current.handleCampaignSelect('New Campaign');

      expect(callback).toHaveBeenCalledWith('New Campaign', undefined);
    });
  });

  describe('handleBackToCampaigns', () => {
    it('sets showCampaignSelection to true', () => {
      const { result } = renderHook(() => useCampaignManagement());

      act(() => {
        result.current.handleCampaignSelect('My Campaign');
      });

      expect(result.current.showCampaignSelection).toBe(false);

      act(() => {
        result.current.handleBackToCampaigns();
      });

      expect(result.current.showCampaignSelection).toBe(true);
    });
  });

  describe('handleRenameCampaign', () => {
    it('prompts for name, calls fetch PUT, updates campaignName, and reloads', async () => {
      window.prompt = vi.fn().mockReturnValue('New Campaign');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });

      const { result } = renderHook(() => useCampaignManagement());

      act(() => {
        result.current.handleCampaignSelect('Old Campaign');
      });

      await act(async () => {
        await result.current.handleRenameCampaign();
      });

      expect(window.prompt).toHaveBeenCalledWith(
        'Enter new campaign name:',
        'Old Campaign'
      );
      expect(global.fetch).toHaveBeenCalledWith(
         '/api/campaigns/Old%20Campaign',
         {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newName: 'New Campaign' }),
         }
       );
      expect(result.current.campaignName).toBe('New Campaign');
      expect(window.location.reload).toHaveBeenCalled();
    });
  });

  describe('handleRenameCampaign cancelled', () => {
    it('early returns if prompt returns null', () => {
      window.prompt = vi.fn().mockReturnValue(null);

      const { result } = renderHook(() => useCampaignManagement());

      act(() => {
        result.current.handleCampaignSelect('My Campaign');
      });

      act(() => {
        result.current.handleRenameCampaign();
      });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(window.location.reload).not.toHaveBeenCalled();
    });

    it('early returns if prompt returns empty string', () => {
      window.prompt = vi.fn().mockReturnValue('');

      const { result } = renderHook(() => useCampaignManagement());

      act(() => {
        result.current.handleCampaignSelect('My Campaign');
      });

      act(() => {
        result.current.handleRenameCampaign();
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('early returns if prompt returns whitespace-only string', () => {
      window.prompt = vi.fn().mockReturnValue('   ');

      const { result } = renderHook(() => useCampaignManagement());

      act(() => {
        result.current.handleCampaignSelect('My Campaign');
      });

      act(() => {
        result.current.handleRenameCampaign();
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('handleDeleteCampaign', () => {
    beforeEach(() => {
      window.confirm = vi.fn();
    });

    it('confirms delete, calls fetch DELETE, and triggers onDeleteCampaignCallback', async () => {
      window.confirm = vi.fn().mockReturnValue(true);
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      const deleteCallback = vi.fn();
      const { result } = renderHook(() => useCampaignManagement());

      act(() => {
        result.current.handleCampaignSelect('ToDelete');
      });

      act(() => {
        result.current.setDeleteCampaignCallback(deleteCallback);
      });

      await act(async () => {
        await result.current.handleDeleteCampaign();
      });

      expect(window.confirm).toHaveBeenCalledWith(
        "Are you sure you want to delete the campaign 'ToDelete'? This will delete all characters in the campaign and cannot be undone."
      );
      expect(global.fetch).toHaveBeenCalledWith('/api/campaigns/ToDelete', {
        method: 'DELETE',
      });
      expect(deleteCallback).toHaveBeenCalled();
    });
  });

  describe('handleDeleteCampaign cancelled', () => {
    it('does not call fetch if confirm returns false', async () => {
      window.confirm = vi.fn().mockReturnValue(false);

      const { result } = renderHook(() => useCampaignManagement());

      await act(async () => {
        await result.current.handleDeleteCampaign();
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('handleDeleteCampaign error', () => {
    it('throws error on non-ok response', async () => {
      window.confirm = vi.fn().mockReturnValue(true);
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Delete failed' }),
      });

      const { result } = renderHook(() => useCampaignManagement());

      act(() => {
        result.current.handleCampaignSelect('My Campaign');
      });

      let thrownError;
      await act(async () => {
        try {
          await result.current.handleDeleteCampaign();
        } catch (err) {
          thrownError = err;
        }
      });

      expect(thrownError).toBeInstanceOf(Error);
      expect(thrownError.message).toBe('Delete failed');
    });
  });

  describe('isLocalhost', () => {
    it('is false when hostname is not localhost or 127.0.0.1', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'example.com', reload: vi.fn() },
        writable: true,
      });

      const { result } = renderHook(() => useCampaignManagement());

      expect(result.current.isLocalhost).toBe(false);
    });
  });
});
