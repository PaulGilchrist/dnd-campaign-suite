// @maintained-by-ai
// Live-sync contract for the Factions manager: every factions-list-<campaign>
// SSE event (per server/routes/factions.js broadcast hook: replaced/deleted)
// must re-fetch and re-render the list, events for other keys are ignored,
// and re-fetches are skipped while the edit modal is open so a draft in
// progress is never disturbed — but the missed broadcast is applied on close
// so a reopened editor never re-seeds a stale row. Mirrors
// NPCs.sse-sync.test.jsx. Connects through the ONE shared SSE client
// (subscribeToSSE), never a raw EventSource.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Factions from './Factions';

let capturedHandler = null;
let unsubscribeCalls = 0;
const mockSubscribe = vi.fn((_campaignName, handler) => {
  capturedHandler = handler;
  return () => {
    capturedHandler = null;
    unsubscribeCalls += 1;
  };
});

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: (...args) => mockSubscribe(...args),
}));

let loadCallCount = 0;
let factionsFixture = [{ id: 'f1', name: 'The Iron Consortium', influence: 3 }];

vi.mock('../../services/campaign/factionsService.js', () => ({
  loadFactions: vi.fn(async () => {
    loadCallCount += 1;
    return { factions: factionsFixture };
  }),
  saveFactions: vi.fn(async () => ({ success: true })),
  deleteFaction: vi.fn(async () => ({ success: true })),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange }) => (
    <textarea
      data-testid={`faction-field-${id}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const renderFactions = () =>
  render(<Factions campaignName="test-campaign" onBack={vi.fn()} />);

describe('Factions live SSE sync', () => {
  beforeEach(() => {
    mockSubscribe.mockClear();
    capturedHandler = null;
    unsubscribeCalls = 0;
    loadCallCount = 0;
    factionsFixture = [{ id: 'f1', name: 'The Iron Consortium', influence: 3 }];
  });

  it('subscribes through the shared SSE client on mount and unsubscribes on unmount', () => {
    const { unmount } = renderFactions();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith('test-campaign', expect.any(Function));

    unmount();
    expect(unsubscribeCalls).toBe(1);
    expect(capturedHandler).toBeNull();
  });

  it('re-fetches on factions-list events for this campaign, surfacing created and deleted factions', async () => {
    const { findByText } = renderFactions();
    await findByText('The Iron Consortium');
    expect(loadCallCount).toBe(1);

    factionsFixture = [...factionsFixture, { id: 'f2', name: 'Cult of the Deep', influence: 7 }];
    capturedHandler({ key: 'factions-list-test-campaign', data: { action: 'replaced' } });
    await findByText('Cult of the Deep');
    expect(loadCallCount).toBe(2);

    factionsFixture = [{ id: 'f2', name: 'Cult of the Deep', influence: 7 }];
    capturedHandler({ key: 'factions-list-test-campaign', data: { action: 'deleted', name: 'f1' } });
    await findByText('Cult of the Deep');
    expect(screen.queryByText('The Iron Consortium')).not.toBeInTheDocument();
    expect(loadCallCount).toBe(3);
  });

  it('ignores SSE events from other keys/campaigns', async () => {
    const { findByText } = renderFactions();
    await findByText('The Iron Consortium');

    capturedHandler({ key: 'factions-list-other-campaign', data: { action: 'replaced' } });
    capturedHandler({ key: 'npcs-list-test-campaign', data: { action: 'created' } });
    capturedHandler(null);

    expect(loadCallCount).toBe(1);
  });

  it('skips re-fetches while the edit form is open, then applies the missed event on close', async () => {
    const { findByText } = renderFactions();
    await findByText('The Iron Consortium');

    fireEvent.click(screen.getByRole('button', { name: /New Faction/i }));
    const nameInput = screen.getByPlaceholderText('Faction name');
    fireEvent.change(nameInput, { target: { value: 'Draft Faction' } });

    factionsFixture = [...factionsFixture, { id: 'f2', name: 'Cult of the Deep', influence: 7 }];
    capturedHandler({ key: 'factions-list-test-campaign', data: { action: 'replaced' } });

    expect(nameInput.value).toBe('Draft Faction');
    expect(loadCallCount).toBe(1);

    // Closing consumes the skipped broadcast immediately — the list must never
    // stay stale so a reopened editor re-seeds a fresh row (409 recovery).
    // The draft is dirty, so × now NAMES the discard (improve 2026-10-29-V):
    // accept it to exercise the close path.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(confirmSpy).toHaveBeenCalledWith('Discard changes to "Draft Faction"?');
    confirmSpy.mockRestore();
    await findByText('Cult of the Deep');
    expect(loadCallCount).toBe(2);

    // Events arriving with the modal closed keep refreshing live.
    factionsFixture = [...factionsFixture, { id: 'f3', name: 'Silver Covenant', influence: 2 }];
    capturedHandler({ key: 'factions-list-test-campaign', data: { action: 'replaced' } });
    await findByText('Silver Covenant');
    expect(loadCallCount).toBe(3);
  });
});
