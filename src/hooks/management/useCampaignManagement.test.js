// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useCampaignManagement from './useCampaignManagement.js';

describe('useCampaignManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with showCampaignSelection true and campaignName null', () => {
      const { result } = renderHook(() => useCampaignManagement());
      expect(result.current.showCampaignSelection).toBe(true);
      expect(result.current.campaignName).toBeNull();
      expect(typeof result.current.isLocalhost).toBe('boolean');
    });
  });

  describe('handleCampaignSelect', () => {
    it('should set campaign name and hide selection', () => {
      const { result } = renderHook(() => useCampaignManagement());
      act(() => {
        result.current.handleCampaignSelect('MyCampaign', [{ name: 'Character 1' }]);
      });
      expect(result.current.campaignName).toBe('MyCampaign');
      expect(result.current.showCampaignSelection).toBe(false);
    });

    it('should call onCampaignSelectRef callback when set', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useCampaignManagement());
      act(() => {
        result.current.setCampaignSelectCallback(callback);
      });
      act(() => {
        result.current.handleCampaignSelect('TestCampaign', []);
      });
      expect(callback).toHaveBeenCalledWith('TestCampaign', []);
    });
  });

  describe('handleDeleteCampaign', () => {
    it('should not delete when user cancels confirmation', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true });
      const { result } = renderHook(() => useCampaignManagement());
      act(() => {
        result.current.handleCampaignSelect('TestCampaign', []);
      });
      await act(async () => {
        result.current.handleDeleteCampaign();
      });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should call onDeleteCampaignRef callback on successful delete', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      vi.spyOn(window, 'location', 'get').mockReturnValue({ reload: vi.fn() });
      const callback = vi.fn();
      global.fetch = vi.fn().mockResolvedValue({ ok: true });
      const { result } = renderHook(() => useCampaignManagement());
      act(() => {
        result.current.setDeleteCampaignCallback(callback);
        result.current.handleCampaignSelect('TestCampaign', []);
      });
      await act(async () => {
        result.current.handleDeleteCampaign();
      });
      expect(callback).toHaveBeenCalled();
    });

    it('should throw with error message on failed delete', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Delete failed' }),
      });
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

    it('should send DELETE request with encoded campaign name', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      global.fetch = vi.fn().mockResolvedValue({ ok: true });
      const { result } = renderHook(() => useCampaignManagement());
      act(() => {
        result.current.handleCampaignSelect('My Campaign!', []);
      });
      await act(async () => {
        result.current.handleDeleteCampaign();
      });
      expect(fetch).toHaveBeenCalledWith(
        '/api/campaigns/My%20Campaign!',
        { method: 'DELETE' }
      );
    });
  });

  describe('handleRenameCampaign', () => {
    it('should not rename when prompt returns empty or whitespace-only string', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('');
      const { result } = renderHook(() => useCampaignManagement());
      act(() => {
        result.current.handleCampaignSelect('TestCampaign', []);
      });
      await act(async () => {
        result.current.handleRenameCampaign();
      });
      expect(fetch).not.toHaveBeenCalled();
      expect(result.current.campaignName).toBe('TestCampaign');
    });

    it('should trim whitespace from new campaign name', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('  TrimmedCampaign  ');
      vi.spyOn(window, 'location', 'get').mockReturnValue({ reload: vi.fn() });
      global.fetch = vi.fn().mockResolvedValue({ ok: true });
      const { result } = renderHook(() => useCampaignManagement());
      act(() => {
        result.current.handleCampaignSelect('OldCampaign', []);
      });
      await act(async () => {
        result.current.handleRenameCampaign();
      });
      expect(result.current.campaignName).toBe('TrimmedCampaign');
    });

    it('should send PUT request with encoded campaign name and new name in body', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('New Campaign!');
      vi.spyOn(window, 'location', 'get').mockReturnValue({ reload: vi.fn() });
      global.fetch = vi.fn().mockResolvedValue({ ok: true });
      const { result } = renderHook(() => useCampaignManagement());
      act(() => {
        result.current.handleCampaignSelect('Old Campaign', []);
      });
      await act(async () => {
        result.current.handleRenameCampaign();
      });
      expect(fetch).toHaveBeenCalledWith(
        '/api/campaigns/Old%20Campaign',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newName: 'New Campaign!' }),
        })
      );
    });

    it('should throw with error message on failed rename', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('NewName');
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Rename failed' }),
      });
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
  });

  describe('handleBackToCampaigns', () => {
    it('should show campaign selection and preserve campaignName', () => {
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
});
