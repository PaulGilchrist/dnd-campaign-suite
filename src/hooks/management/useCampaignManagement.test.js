// @maintained-by-ai: 2026-10-15
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useCampaignManagement from './useCampaignManagement.js';

const okResponse = { ok: true };

const errorResponse = (error) => ({
  ok: false,
  json: async () => ({ error }),
});

const mockFetch = (response) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

// jsdom navigation is not implemented; stub location and expose the reload spy.
const mockLocation = () => {
  const reload = vi.fn();
  vi.spyOn(window, 'location', 'get').mockReturnValue({ reload });
  return reload;
};

describe('useCampaignManagement', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with campaign selection shown, no campaign, localhost mode', () => {
    const { result } = renderHook(() => useCampaignManagement());
    expect(result.current.showCampaignSelection).toBe(true);
    expect(result.current.campaignName).toBeNull();
    expect(result.current.isLocalhost).toBe(true);
  });

  describe('handleCampaignSelect', () => {
    it('sets campaign, hides selection, and invokes registered callback', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useCampaignManagement());
      act(() => {
        result.current.setCampaignSelectCallback(callback);
      });
      act(() => {
        result.current.handleCampaignSelect('TestCampaign', [{ name: 'Character 1' }]);
      });
      expect(result.current.campaignName).toBe('TestCampaign');
      expect(result.current.showCampaignSelection).toBe(false);
      expect(callback).toHaveBeenCalledWith('TestCampaign', [{ name: 'Character 1' }]);
    });
  });

  describe('handleBackToCampaigns', () => {
    it('shows campaign selection and preserves campaignName', () => {
      const { result } = renderHook(() => useCampaignManagement());
      act(() => {
        result.current.handleCampaignSelect('TestCampaign', []);
      });
      act(() => {
        result.current.handleBackToCampaigns();
      });
      expect(result.current.showCampaignSelection).toBe(true);
      expect(result.current.campaignName).toBe('TestCampaign');
    });
  });

  describe('handleDeleteCampaign', () => {
    it('does nothing when user cancels confirmation', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const fetchSpy = mockFetch(okResponse);
      const { result } = renderHook(() => useCampaignManagement());
      act(() => {
        result.current.handleCampaignSelect('TestCampaign', []);
      });
      act(() => {
        result.current.handleDeleteCampaign();
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.current.campaignName).toBe('TestCampaign');
    });

    it('sends encoded DELETE request and invokes delete callback on success', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const fetchSpy = mockFetch(okResponse);
      const callback = vi.fn();
      const { result } = renderHook(() => useCampaignManagement());
      act(() => {
        result.current.setDeleteCampaignCallback(callback);
        result.current.handleCampaignSelect('My Campaign!', []);
      });
      await act(async () => {
        await result.current.handleDeleteCampaign();
      });
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/My%20Campaign!', {
        method: 'DELETE',
      });
      expect(callback).toHaveBeenCalled();
    });

    it('throws with the server error message on failed delete', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockFetch(errorResponse('Delete failed'));
      const { result } = renderHook(() => useCampaignManagement());
      act(() => {
        result.current.handleCampaignSelect('TestCampaign', []);
      });
      await expect(
        act(async () => {
          await result.current.handleDeleteCampaign();
        })
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('handleRenameCampaign', () => {
    // Matches server contract (campaigns-admin.js PUT /api/campaigns/:campaign):
    // blank names never reach the route.
    it.each([[''], ['   '], [null]])(
      'skips rename when prompt returns %j',
      async (userInput) => {
        vi.spyOn(window, 'prompt').mockReturnValue(userInput);
        const fetchSpy = mockFetch(okResponse);
        const { result } = renderHook(() => useCampaignManagement());
        act(() => {
          result.current.handleCampaignSelect('TestCampaign', []);
        });
        await act(async () => {
          await result.current.handleRenameCampaign();
        });
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(result.current.campaignName).toBe('TestCampaign');
      }
    );

    it('sends PUT with trimmed name, updates state, and reloads', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('  New Campaign!  ');
      const reload = mockLocation();
      const fetchSpy = mockFetch(okResponse);
      const { result } = renderHook(() => useCampaignManagement());
      act(() => {
        result.current.handleCampaignSelect('Old Campaign', []);
      });
      await act(async () => {
        await result.current.handleRenameCampaign();
      });
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/Old%20Campaign', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: 'New Campaign!' }),
      });
      expect(result.current.campaignName).toBe('New Campaign!');
      expect(reload).toHaveBeenCalled();
    });

    it('throws with the server error message on failed rename', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('NewName');
      mockFetch(errorResponse('Rename failed'));
      const { result } = renderHook(() => useCampaignManagement());
      act(() => {
        result.current.handleCampaignSelect('OldCampaign', []);
      });
      await expect(
        act(async () => {
          await result.current.handleRenameCampaign();
        })
      ).rejects.toThrow('Rename failed');
    });

    // Regression (bug-campaign-rename-double-prompt): when a name was already
    // collected in the Admin modal, it must be used directly — never a second
    // native prompt.
    it('uses a pre-collected name without prompting again', async () => {
      const promptSpy = vi.spyOn(window, 'prompt');
      const reload = mockLocation();
      const fetchSpy = mockFetch(okResponse);
      const { result } = renderHook(() => useCampaignManagement());
      act(() => {
        result.current.handleCampaignSelect('Old Campaign', []);
      });
      await act(async () => {
        await result.current.handleRenameCampaign('  Modal Name  ');
      });
      expect(promptSpy).not.toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/Old%20Campaign', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: 'Modal Name' }),
      });
      expect(result.current.campaignName).toBe('Modal Name');
      expect(reload).toHaveBeenCalled();
    });

    it('falls back to the native prompt when called with a blank pre-collected name', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('Prompted Name');
      mockLocation();
      const fetchSpy = mockFetch(okResponse);
      const { result } = renderHook(() => useCampaignManagement());
      act(() => {
        result.current.handleCampaignSelect('Old Campaign', []);
      });
      await act(async () => {
        await result.current.handleRenameCampaign('   ');
      });
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/Old%20Campaign', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: 'Prompted Name' }),
      });
    });
  });
});
