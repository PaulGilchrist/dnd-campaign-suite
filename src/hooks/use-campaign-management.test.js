import { renderHook, act } from '@testing-library/react';
import useCampaignManagement from './use-campaign-management';

describe('useCampaignManagement', () => {
  let sessionStorageMock;

  beforeEach(() => {
    sessionStorageMock = {
      store: {},
      getItem: vi.fn((key) => sessionStorageMock.store[key] ?? null),
      setItem: vi.fn((key, value) => {
        sessionStorageMock.store[key] = value;
      }),
      removeItem: vi.fn((key) => {
        delete sessionStorageMock.store[key];
      }),
      clear: vi.fn(() => {
        sessionStorageMock.store = {};
      }),
    };

    Object.defineProperty(window, 'sessionStorage', {
      value: sessionStorageMock,
      writable: true,
    });

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

  describe('pre-loaded campaign from sessionStorage', () => {
    it('sets showCampaignSelection to false and campaignName from session storage', () => {
      sessionStorageMock.store.currentCampaign = 'My Campaign';

      const { result } = renderHook(() => useCampaignManagement());

      expect(result.current.showCampaignSelection).toBe(false);
      expect(result.current.campaignName).toBe('My Campaign');
    });
  });

  describe('handleCampaignSelect', () => {
    it('stores campaign in session storage, hides selection, and calls callback', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useCampaignManagement());

      act(() => {
        result.current.setCampaignSelectCallback(callback);
      });

      act(() => {
        result.current.handleCampaignSelect('Test Campaign', ['char1']);
      });

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'currentCampaign',
        'Test Campaign'
      );
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
      sessionStorageMock.store.currentCampaign = 'My Campaign';
      const { result } = renderHook(() => useCampaignManagement());

      expect(result.current.showCampaignSelection).toBe(false);

      act(() => {
        result.current.handleBackToCampaigns();
      });

      expect(result.current.showCampaignSelection).toBe(true);
    });
  });

  describe('handleRenameCampaign', () => {
    it('prompts for name, calls fetch PUT, updates session storage, and reloads', async () => {
      sessionStorageMock.store.currentCampaign = 'Old Campaign';
      window.prompt = vi.fn().mockReturnValue('New Campaign');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });

      const { result } = renderHook(() => useCampaignManagement());

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
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'currentCampaign',
        'New Campaign'
      );
      expect(result.current.campaignName).toBe('New Campaign');
      expect(window.location.reload).toHaveBeenCalled();
    });
  });

  describe('handleRenameCampaign cancelled', () => {
    it('early returns if prompt returns null', () => {
      sessionStorageMock.store.currentCampaign = 'My Campaign';
      window.prompt = vi.fn().mockReturnValue(null);

      const { result } = renderHook(() => useCampaignManagement());

      act(() => {
        result.current.handleRenameCampaign();
      });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(window.location.reload).not.toHaveBeenCalled();
    });

    it('early returns if prompt returns empty string', () => {
      window.prompt = vi.fn().mockReturnValue('');
      sessionStorageMock.store.currentCampaign = 'My Campaign';

      const { result } = renderHook(() => useCampaignManagement());

      act(() => {
        result.current.handleRenameCampaign();
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('early returns if prompt returns whitespace-only string', () => {
      window.prompt = vi.fn().mockReturnValue('   ');
      sessionStorageMock.store.currentCampaign = 'My Campaign';

      const { result } = renderHook(() => useCampaignManagement());

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
      sessionStorageMock.store.currentCampaign = 'ToDelete';
      window.confirm = vi.fn().mockReturnValue(true);
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      const deleteCallback = vi.fn();
      const { result } = renderHook(() => useCampaignManagement());

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
      sessionStorageMock.store.currentCampaign = 'My Campaign';
      window.confirm = vi.fn().mockReturnValue(true);
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Delete failed' }),
      });

      const { result } = renderHook(() => useCampaignManagement());

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
