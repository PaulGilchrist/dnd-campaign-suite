// @maintained-by-ai 2026-11-26
// Campaign roster/selection hook contract: mount census (zero backend calls),
// select/back lifecycle, delete guard+wire+error, rename skip/prompt/pre-
// collected lanes with ordered fetch censuses and reload-after-write proofs.
// This hook fetches directly (not via campaignService), so URL/error-copy for
// /api/campaigns/:campaign DELETE+PUT is owned HERE; character-lane encoding
// lives in src/services/campaign/campaignService.test.js.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useCampaignManagement from './useCampaignManagement.js';

// Every fetch mock resolves; failed-response helpers carry the server copy.
const stubFetch = (response = { ok: true }) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

const errorResponse = (error) => ({
  ok: false,
  json: async () => ({ error }),
});

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

  it('mounts with selection shown, no campaign, localhost mode, and zero backend calls', () => {
    const fetchSpy = stubFetch();
    const { result } = renderHook(() => useCampaignManagement());

    // Full-shape census: nothing is fetched on mount.
    expect(fetchSpy.mock.calls).toEqual([]);
    expect(Object.keys(result.current)).toEqual([
      'showCampaignSelection',
      'isLocalhost',
      'campaignName',
      'handleCampaignSelect',
      'handleRenameCampaign',
      'handleDeleteCampaign',
      'handleBackToCampaigns',
      'setCampaignSelectCallback',
      'setDeleteCampaignCallback',
    ]);
    expect(result.current.showCampaignSelection).toBe(true);
    expect(result.current.campaignName).toBeNull();
    expect(result.current.isLocalhost).toBe(true);
  });

  it('selects a campaign, invokes the registered callback once with both arguments, then backs out preserving the campaign', () => {
    const callback = vi.fn();
    const fetchSpy = stubFetch();
    const { result } = renderHook(() => useCampaignManagement());
    act(() => {
      result.current.setCampaignSelectCallback(callback);
    });

    act(() => {
      result.current.handleCampaignSelect('Test Campaign', [
        { name: 'Character 1' },
      ]);
    });
    expect(result.current.campaignName).toBe('Test Campaign');
    expect(result.current.showCampaignSelection).toBe(false);
    // Full-shape: exactly one callback with (campaign, characters).
    expect(callback.mock.calls).toEqual([
      ['Test Campaign', [{ name: 'Character 1' }]],
    ]);
    // Selection is a pure local transition — no backend traffic.
    expect(fetchSpy.mock.calls).toEqual([]);

    act(() => {
      result.current.handleBackToCampaigns();
    });
    expect(result.current.showCampaignSelection).toBe(true);
    expect(result.current.campaignName).toBe('Test Campaign');
  });

  describe('handleDeleteCampaign', () => {
    it('sends nothing without a selected campaign and nothing when the user cancels', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const fetchSpy = stubFetch();
      const { result } = renderHook(() => useCampaignManagement());

      // No campaign selected: short-circuits before even confirming.
      await act(async () => {
        await result.current.handleDeleteCampaign();
      });
      expect(confirmSpy.mock.calls).toEqual([]);
      expect(fetchSpy.mock.calls).toEqual([]);

      // Campaign selected but confirmation refused: prompts once, deletes nothing.
      act(() => {
        result.current.handleCampaignSelect('TestCampaign', []);
      });
      await act(async () => {
        await result.current.handleDeleteCampaign();
      });
      expect(confirmSpy.mock.calls).toEqual([
        [expect.stringContaining('TestCampaign')],
      ]);
      expect(fetchSpy.mock.calls).toEqual([]);
      expect(result.current.campaignName).toBe('TestCampaign');
    });

    it('sends exactly one encoded DELETE and invokes the delete callback once on success', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const fetchSpy = stubFetch();
      const callback = vi.fn();
      const { result } = renderHook(() => useCampaignManagement());
      act(() => {
        result.current.setDeleteCampaignCallback(callback);
        result.current.handleCampaignSelect('My Campaign!', []);
      });
      await act(async () => {
        await result.current.handleDeleteCampaign();
      });
      // Full-shape census: one call, exact URL + options.
      expect(fetchSpy.mock.calls).toEqual([
        ['/api/campaigns/My%20Campaign!', { method: 'DELETE' }],
      ]);
      expect(callback.mock.calls).toEqual([[]]);
    });

    it('throws with the server error message on failed delete', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      stubFetch(errorResponse('Delete failed'));
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
    // blank names never reach the route. null covers prompt-cancel.
    it.each(['   ', null])(
      'sends nothing when the prompt returns %j',
      async (userInput) => {
        vi.spyOn(window, 'prompt').mockReturnValue(userInput);
        const fetchSpy = stubFetch();
        const { result } = renderHook(() => useCampaignManagement());
        act(() => {
          result.current.handleCampaignSelect('TestCampaign', []);
        });
        await act(async () => {
          await result.current.handleRenameCampaign();
        });
        expect(fetchSpy.mock.calls).toEqual([]);
        expect(result.current.campaignName).toBe('TestCampaign');
      }
    );

    // Both prompt-fallback paths (no argument, blank pre-collected name) must
    // behave identically: ask the user and PUT the trimmed answer.
    it.each([
      ['no pre-collected name', undefined],
      ['a blank pre-collected name', '   '],
    ])(
      'prompts when called with %s, PUTs the trimmed name, and reloads only after the write',
      async (_label, argument) => {
        vi.spyOn(window, 'prompt').mockReturnValue('  New Campaign!  ');
        const reload = mockLocation();
        const fetchSpy = stubFetch();
        const { result } = renderHook(() => useCampaignManagement());
        act(() => {
          result.current.handleCampaignSelect('Old Campaign', []);
        });
        await act(async () => {
          await result.current.handleRenameCampaign(argument);
        });
        // Full-shape census: exactly one PUT, exact URL/options/body.
        expect(fetchSpy.mock.calls).toEqual([
          [
            '/api/campaigns/Old%20Campaign',
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ newName: 'New Campaign!' }),
            },
          ],
        ]);
        expect(result.current.campaignName).toBe('New Campaign!');
        // Reload-after-write proof: reload must follow the fetch, never race it.
        expect(reload.mock.invocationCallOrder[0]).toBeGreaterThan(
          fetchSpy.mock.invocationCallOrder[0]
        );
      }
    );

    it('throws with the server error message on failed rename', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('NewName');
      stubFetch(errorResponse('Rename failed'));
      const reload = mockLocation();
      const { result } = renderHook(() => useCampaignManagement());
      act(() => {
        result.current.handleCampaignSelect('OldCampaign', []);
      });
      await expect(
        act(async () => {
          await result.current.handleRenameCampaign();
        })
      ).rejects.toThrow('Rename failed');
      // A failed write must never reload.
      expect(reload.mock.calls).toEqual([]);
    });

    // Regression (bug-campaign-rename-double-prompt): when a name was already
    // collected in the Admin modal, it must be used directly — never a second
    // native prompt.
    it('uses a pre-collected name without prompting again', async () => {
      const promptSpy = vi.spyOn(window, 'prompt');
      const reload = mockLocation();
      const fetchSpy = stubFetch();
      const { result } = renderHook(() => useCampaignManagement());
      act(() => {
        result.current.handleCampaignSelect('Old Campaign', []);
      });
      await act(async () => {
        await result.current.handleRenameCampaign('  Modal Name  ');
      });
      expect(promptSpy.mock.calls).toEqual([]);
      expect(fetchSpy.mock.calls).toEqual([
        [
          '/api/campaigns/Old%20Campaign',
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newName: 'Modal Name' }),
          },
        ],
      ]);
      expect(result.current.campaignName).toBe('Modal Name');
      expect(reload.mock.invocationCallOrder[0]).toBeGreaterThan(
        fetchSpy.mock.invocationCallOrder[0]
      );
    });
  });
});
