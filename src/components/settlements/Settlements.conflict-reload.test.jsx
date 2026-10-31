// @maintained-by-ai: 2026-10-27
// Regression lock for bug-ct-sessions-settlements-409-recovery-loop-and-no-reload-button
// (settlements twin of Sessions.conflict-reload.test.jsx): the 9cee7bfa2
// close-consumes-stale machinery and the ee4f9f177 one-click "Reload list"
// banner button were never ported to the Settlements lane, so a 409 dead-ended
// — closing and reopening in-view re-seeded the STALE row (old updatedAt) and
// the re-applied edit repeated the SAME 409 forever. Now a rejected save marks
// the list stale, closing consumes the refresh, and the conflict banner offers
// the one-click recovery. NOTE: the settlements route publishes no
// `settlements-list-*` SSE broadcast, so there is no skipped-while-editing leg
// here — the rejected save is the staleness signal.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Settlements from './Settlements';

let loadCallCount = 0;
let saveCallCount = 0;
let saveSettlementImpl = async () => ({ success: true });
let settlementsFixture = [{ name: 'Ironhaven', size: 'town', notes: 'old notes', updatedAt: 1 }];

const CONFLICT_MESSAGE =
  'Settlement "Ironhaven" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';

vi.mock('../../services/campaign/settlementsService.js', () => ({
  loadSettlements: vi.fn(async () => {
    loadCallCount += 1;
    return { settlements: settlementsFixture };
  }),
  saveSettlement: vi.fn(async (...args) => {
    saveCallCount += 1;
    return saveSettlementImpl(...args);
  }),
  saveSettlements: vi.fn(async () => ({ success: true })),
  deleteSettlement: vi.fn(async () => ({ success: true })),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange }) => (
    <textarea
      data-testid={`preview-toggle-${id}`}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// Import-satisfying mock — this lane never triggers generation here.
vi.mock('../../services/campaign/settlementGenerator.js', () => ({
  generateSettlement: vi.fn(),
}));

// The list rows + modal markup all live inside Settlements.jsx, so the real
// component is rendered; freshness is judged by loadCallCount + the form's
// seeded notes value (the refetch itself proves the list refreshed).
const renderSettlements = () =>
  render(<Settlements campaignName="test-campaign" />);

const openEditor = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Edit settlement: Ironhaven' }));
};

describe('Settlements 409-recovery: close refreshes the stale list + Reload list banner', () => {
  beforeEach(() => {
    loadCallCount = 0;
    saveCallCount = 0;
    saveSettlementImpl = async () => ({ success: true });
    settlementsFixture = [{ name: 'Ironhaven', size: 'town', notes: 'old notes', updatedAt: 1 }];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });
  afterEach(() => {
    // Console warn/error spies are per-test: restore so flagged-409 (warn)
    // and non-conflict (error) lanes never bleed across boundaries.
    vi.restoreAllMocks();
  });

  it('re-fetches on close after a rejected (409) save, so a reopen re-seeds the FRESH row', async () => {
    saveSettlementImpl = async () => {
      throw Object.assign(new Error(CONFLICT_MESSAGE), { conflict: true });
    };
    const { findByText } = renderSettlements();
    await findByText('Ironhaven');
    expect(loadCallCount).toBe(1);

    await openEditor();
    expect(screen.getByTestId('preview-toggle-settlement-notes').value).toBe('old notes');
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    // Draft + banner preserved, nothing re-fetched while the modal is open.
    const banner = await screen.findByText(/NOT saved/);
    expect(banner).toBeInTheDocument();
    expect(screen.getByTestId('preview-toggle-settlement-notes')).toBeInTheDocument();
    expect(loadCallCount).toBe(1);

    // What the other tab persisted — the close refresh will surface it.
    settlementsFixture = [{ name: 'Ironhaven', size: 'town', notes: 'other-tab notes', updatedAt: 2 }];

    // The prescribed recovery: CLOSE — this re-fetches the list…
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(loadCallCount).toBe(2));
    expect(screen.queryByTestId('preview-toggle-settlement-notes')).toBeNull();

    // …so the REOPEN seeds the fresh row (pre-fix it re-seeded 'old notes'
    // and the next save repeated the same 409 forever). No fetch on reopen.
    await openEditor();
    expect(screen.getByTestId('preview-toggle-settlement-notes').value).toBe('other-tab notes');
    expect(loadCallCount).toBe(2);
  });

  it('conflict banner carries a Reload list action — one click closes + refetches so the reopen seeds the fresh row', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Service errors from a 409 carry { conflict: true } (server conflict body).
    saveSettlementImpl = async () => {
      throw Object.assign(new Error(CONFLICT_MESSAGE), { conflict: true });
    };
    const { findByText } = renderSettlements();
    await findByText('Ironhaven');
    expect(loadCallCount).toBe(1);

    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    // Banner copy is unchanged and now offers the one-click recovery.
    const banner = await screen.findByText(/NOT saved/);
    expect(banner).toHaveTextContent(CONFLICT_MESSAGE);
    const reloadButton = screen.getByRole('button', { name: 'Reload list' });
    // Nothing re-fetched while the editor stays open on the refusal.
    expect(loadCallCount).toBe(1);
    // improve 2026-10-27-J: rejected edit stays amber AND silent here — the
    // service layer owns the single "Concurrent-edit conflict saving …" warn
    // (asserted in settlementsService.test.js); hook/component layers no
    // longer duplicate it.
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    // What the other tab persisted — the refetch below will surface it.
    settlementsFixture = [{ name: 'Ironhaven', size: 'town', notes: 'other-tab notes', updatedAt: 2 }];
    fireEvent.click(reloadButton);

    // ONE click = the full sanctioned recovery: editor closed AND the stale
    // list refresh consumed (the 9cee7bfa2 close path, no extra steps).
    await waitFor(() =>
      expect(screen.queryByTestId('preview-toggle-settlement-notes')).toBeNull()
    );
    await waitFor(() => expect(loadCallCount).toBe(2));

    // Reopen seeds the FRESH row/stamp — re-applying the edit now saves 200.
    saveSettlementImpl = async () => ({ success: true });
    await openEditor();
    expect(screen.getByTestId('preview-toggle-settlement-notes').value).toBe('other-tab notes');
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() =>
      expect(screen.queryByTestId('preview-toggle-settlement-notes')).toBeNull()
    );
    expect(saveCallCount).toBe(2);
  });

  it('non-conflict save errors render the old copy-only banner (no Reload list)', async () => {
    saveSettlementImpl = async () => {
      throw new Error('An error saving settlement');
    };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { findByText } = renderSettlements();
    await findByText('Ironhaven');

    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(await screen.findByText(/An error saving settlement/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reload list' })).not.toBeInTheDocument();
    // Genuine failures still log red; warn channel untouched.
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to save settlement:',
      expect.objectContaining({ message: 'An error saving settlement' })
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does NOT add redundant fetches on a clean close or after a successful save', async () => {
    const { findByText } = renderSettlements();
    await findByText('Ironhaven');
    expect(loadCallCount).toBe(1);

    // Clean close with nothing missed: still just the mount load.
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByTestId('preview-toggle-settlement-notes')).toBeNull()
    );
    expect(loadCallCount).toBe(1);

    // Successful save reloads exactly once (save path) and close adds nothing.
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() =>
      expect(screen.queryByTestId('preview-toggle-settlement-notes')).toBeNull()
    );
    expect(saveCallCount).toBe(1);
    expect(loadCallCount).toBe(2);
  });
});
