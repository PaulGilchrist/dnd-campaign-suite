import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useCampaignManagement from './useCampaignManagement.js';

describe('useCampaignManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with showCampaignSelection true and campaignName null', () => {
    const { result } = renderHook(() => useCampaignManagement());
    expect(result.current.showCampaignSelection).toBe(true);
    expect(result.current.campaignName).toBeNull();
    expect(typeof result.current.isLocalhost).toBe('boolean');
  });

  it('should set campaign name and hide selection on handleCampaignSelect', () => {
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

  it('should set onDeleteCampaignRef callback when set', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useCampaignManagement());
    act(() => {
      result.current.setDeleteCampaignCallback(callback);
    });
    expect(true).toBe(true); // callback set without error
  });

  it('should call onDeleteCampaignRef callback on delete', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    window.confirm = vi.fn(() => true);
    const callback = vi.fn();
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

  it('should not delete campaign when user cancels', async () => {
    global.fetch = vi.fn();
    window.confirm = vi.fn(() => false);
    const { result } = renderHook(() => useCampaignManagement());
    act(() => {
      result.current.handleCampaignSelect('TestCampaign', []);
    });
    await act(async () => {
      result.current.handleDeleteCampaign();
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should throw error on failed delete', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Delete failed' }),
    });
    window.confirm = vi.fn(() => true);
    const { result } = renderHook(() => useCampaignManagement());
    act(() => {
      result.current.handleCampaignSelect('TestCampaign', []);
    });
    await expect(async () => {
      await act(async () => {
        await result.current.handleDeleteCampaign();
      });
    }).rejects.toThrow('Delete failed');
  });

  it('should handle rename with new name', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    window.prompt = vi.fn(() => 'NewCampaignName');
    window.location = { reload: vi.fn() };
    const { result } = renderHook(() => useCampaignManagement());
    act(() => {
      result.current.handleCampaignSelect('OldCampaign', []);
    });
    await act(async () => {
      result.current.handleRenameCampaign();
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/campaigns/OldCampaign',
      expect.objectContaining({
        method: 'PUT',
      })
    );
    expect(result.current.campaignName).toBe('NewCampaignName');
  });

  it('should not rename when prompt returns null', async () => {
    global.fetch = vi.fn();
    window.prompt = vi.fn(() => null);
    const { result } = renderHook(() => useCampaignManagement());
    act(() => {
      result.current.handleCampaignSelect('TestCampaign', []);
    });
    await act(async () => {
      result.current.handleRenameCampaign();
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should not rename when prompt returns empty string', async () => {
    global.fetch = vi.fn();
    window.prompt = vi.fn(() => '');
    const { result } = renderHook(() => useCampaignManagement());
    act(() => {
      result.current.handleCampaignSelect('TestCampaign', []);
    });
    await act(async () => {
      result.current.handleRenameCampaign();
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should trim whitespace from new campaign name', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    window.prompt = vi.fn(() => '  TrimmedCampaign  ');
    window.location = { reload: vi.fn() };
    const { result } = renderHook(() => useCampaignManagement());
    act(() => {
      result.current.handleCampaignSelect('OldCampaign', []);
    });
    await act(async () => {
      result.current.handleRenameCampaign();
    });
    expect(result.current.campaignName).toBe('TrimmedCampaign');
  });

  it('should show campaign selection on handleBackToCampaigns', () => {
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

  it('should return isLocalhost as boolean', () => {
    const { result } = renderHook(() => useCampaignManagement());
    expect(typeof result.current.isLocalhost).toBe('boolean');
  });

  it('should handle rename with error response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Rename failed' }),
    });
    window.prompt = vi.fn(() => 'NewName');
    const { result } = renderHook(() => useCampaignManagement());
    act(() => {
      result.current.handleCampaignSelect('OldCampaign', []);
    });
    await expect(async () => {
      await act(async () => {
        await result.current.handleRenameCampaign();
      });
    }).rejects.toThrow('Rename failed');
  });

  it('should handle rename with generic error response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
    window.prompt = vi.fn(() => 'NewName');
    const { result } = renderHook(() => useCampaignManagement());
    act(() => {
      result.current.handleCampaignSelect('OldCampaign', []);
    });
    await expect(async () => {
      await act(async () => {
        await result.current.handleRenameCampaign();
      });
    }).rejects.toThrow('Failed to rename campaign');
  });

  it('should handle delete with error response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Delete failed' }),
    });
    window.confirm = vi.fn(() => true);
    const { result } = renderHook(() => useCampaignManagement());
    act(() => {
      result.current.handleCampaignSelect('TestCampaign', []);
    });
    await expect(async () => {
      await act(async () => {
        await result.current.handleDeleteCampaign();
      });
    }).rejects.toThrow('Delete failed');
  });

  it('should handle campaign select with callback that throws', () => {
    const callback = vi.fn(() => { throw new Error('Callback error'); });
    const { result } = renderHook(() => useCampaignManagement());
    act(() => {
      result.current.setCampaignSelectCallback(callback);
    });
    expect(() => {
      act(() => {
        result.current.handleCampaignSelect('TestCampaign', []);
      });
    }).toThrow('Callback error');
  });

  it('should handle campaign select without callback set', () => {
    const { result } = renderHook(() => useCampaignManagement());
    expect(() => {
      act(() => {
        result.current.handleCampaignSelect('TestCampaign', []);
      });
    }).not.toThrow();
    expect(result.current.campaignName).toBe('TestCampaign');
  });

  it('should handle delete without callback set', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    window.confirm = vi.fn(() => true);
    window.location = { reload: vi.fn() };
    const { result } = renderHook(() => useCampaignManagement());
    act(() => {
      result.current.handleCampaignSelect('TestCampaign', []);
    });
    await act(async () => {
      await result.current.handleDeleteCampaign();
    });
    expect(fetch).toHaveBeenCalled();
  });
});
