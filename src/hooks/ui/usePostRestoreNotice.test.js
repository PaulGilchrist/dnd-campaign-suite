// @maintained-by-ai
// Unit-level owner of the usePostRestoreNotice contract (per the coverage split
// declared in App.post-restore.test.jsx): notice parsing/consumption from
// sessionStorage, consumeRestore gating, and one-shot banner drop.
// App-level wiring lives in App.post-restore.test.jsx; the write side lives in
// components/campaign-admin/CampaignAdmin.rollback-upload.test.jsx.
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { usePostRestoreNotice } from './usePostRestoreNotice.js';

const RESTORED_FILE = 'test-campaign-2026-10-10T12-34-56-789.zip';

describe('usePostRestoreNotice', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('consumes the notice on mount: exposes campaign + banner and clears the flag', async () => {
    sessionStorage.setItem('postRestoreNotice', JSON.stringify({ campaign: 'test-campaign', restored: RESTORED_FILE }));

    const { result } = renderHook(() => usePostRestoreNotice(null));

    await waitFor(() => {
      expect(result.current.autoSelectCampaign).toBe('test-campaign');
      expect(result.current.restoredSnapshot).toBe(RESTORED_FILE);
    });
    expect(sessionStorage.getItem('postRestoreNotice')).toBeNull();
  });

  it('exposes nothing and leaves the store untouched when no notice exists', () => {
    const { result } = renderHook(() => usePostRestoreNotice(null));

    expect(result.current.autoSelectCampaign).toBeNull();
    expect(result.current.restoredSnapshot).toBeNull();
    expect(sessionStorage.getItem('postRestoreNotice')).toBeNull();
  });

  it('consumeRestore claims the restored campaign once and ignores other campaigns', async () => {
    sessionStorage.setItem('postRestoreNotice', JSON.stringify({ campaign: 'test-campaign', restored: RESTORED_FILE }));

    const { result } = renderHook(() => usePostRestoreNotice(null));
    await waitFor(() => expect(result.current.autoSelectCampaign).toBe('test-campaign'));

    expect(result.current.consumeRestore('other-campaign')).toBe(false);
    expect(result.current.consumeRestore('test-campaign')).toBe(true);
    expect(result.current.consumeRestore('test-campaign')).toBe(false);
  });

  it('drops the banner once the GM navigates away from the Admin view', async () => {
    sessionStorage.setItem('postRestoreNotice', JSON.stringify({ campaign: 'test-campaign', restored: RESTORED_FILE }));

    const { result, rerender } = renderHook(({ view }) => usePostRestoreNotice(view), { initialProps: { view: null } });
    await waitFor(() => expect(result.current.restoredSnapshot).toBe(RESTORED_FILE));

    // While the restore is still pending (not yet consumed), navigating to a
    // non-Admin view must NOT drop the banner.
    rerender({ view: 'notes' });
    expect(result.current.restoredSnapshot).toBe(RESTORED_FILE);

    rerender({ view: 'campaignRepair' });
    act(() => { result.current.consumeRestore('test-campaign'); });
    expect(result.current.restoredSnapshot).toBe(RESTORED_FILE);

    rerender({ view: 'notes' });
    await waitFor(() => expect(result.current.restoredSnapshot).toBeNull());
  });

  it('ignores a malformed notice without crashing', async () => {
    sessionStorage.setItem('postRestoreNotice', '{not json');

    const { result } = renderHook(() => usePostRestoreNotice(null));

    expect(result.current.autoSelectCampaign).toBeNull();
    expect(result.current.restoredSnapshot).toBeNull();
  });
});
