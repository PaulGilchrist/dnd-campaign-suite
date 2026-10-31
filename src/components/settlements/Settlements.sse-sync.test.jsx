// @maintained-by-ai: 2026-10-29
// Live-sync contract for the Settlements manager (improve settlements-
// sessions-no-list-sse): every settlements-list-<campaign> SSE event (per
// server/routes/settlements.js broadcastSettlementsList: created/updated/
// deleted/replaced) must re-fetch and re-render the list, events for other
// keys are ignored, and re-fetches are skipped while the edit modal is open
// so a draft in progress is never disturbed — but the missed broadcast is
// applied on close so a reopened editor never re-seeds a stale row. Mirrors
// Notes.sse-sync.test.jsx / NPCs.sse-sync.test.jsx. Connects through the ONE
// shared SSE client (subscribeToSSE), never a raw EventSource.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Settlements from './Settlements';

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
let settlementsFixture = [{ name: 'Ironhaven', size: 'town', description: 'Fortress town', updatedAt: 1 }];

vi.mock('../../services/campaign/settlementsService.js', () => ({
  loadSettlements: vi.fn(async () => {
    loadCallCount += 1;
    return { settlements: settlementsFixture };
  }),
  saveSettlement: vi.fn(async () => ({ success: true })),
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

const renderSettlements = () =>
  render(<Settlements campaignName="test-campaign" />);

describe('Settlements live SSE sync', () => {
  beforeEach(() => {
    mockSubscribe.mockClear();
    capturedHandler = null;
    unsubscribeCalls = 0;
    loadCallCount = 0;
    settlementsFixture = [{ name: 'Ironhaven', size: 'town', description: 'Fortress town', updatedAt: 1 }];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('subscribes through the shared SSE client on mount and unsubscribes on unmount', () => {
    const { unmount } = renderSettlements();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith('test-campaign', expect.any(Function));

    unmount();
    expect(unsubscribeCalls).toBe(1);
    expect(capturedHandler).toBeNull();
  });

  it('re-fetches on settlements-list events for this campaign, surfacing created and deleted settlements', async () => {
    const { findByText } = renderSettlements();
    await findByText('Ironhaven');
    expect(loadCallCount).toBe(1);

    settlementsFixture = [...settlementsFixture, {
      name: 'Fallcrest', size: 'village', description: 'Riverside village', updatedAt: 2,
    }];
    capturedHandler({ key: 'settlements-list-test-campaign', data: { action: 'created', name: 'Fallcrest' } });
    await findByText('Fallcrest');
    expect(loadCallCount).toBe(2);

    settlementsFixture = settlementsFixture.filter(s => s.name !== 'Ironhaven');
    capturedHandler({ key: 'settlements-list-test-campaign', data: { action: 'deleted', name: 'Ironhaven' } });
    await findByText('Fallcrest');
    expect(screen.queryByText('Ironhaven')).not.toBeInTheDocument();
    expect(loadCallCount).toBe(3);
  });

  it('ignores SSE events from other keys/campaigns', async () => {
    const { findByText } = renderSettlements();
    await findByText('Ironhaven');

    capturedHandler({ key: 'settlements-list-other-campaign', data: { action: 'replaced' } });
    capturedHandler({ key: 'sessions-list-test-campaign', data: { action: 'replaced' } });
    capturedHandler(null);

    expect(loadCallCount).toBe(1);
  });

  it('skips re-fetches while the edit form is open, then applies the missed event on close', async () => {
    const { findByText } = renderSettlements();
    await findByText('Ironhaven');

    fireEvent.click(screen.getByRole('button', { name: 'Edit settlement: Ironhaven' }));
    const notesField = screen.getByTestId('preview-toggle-settlement-notes');
    fireEvent.change(notesField, { target: { value: 'Draft settlement notes' } });

    settlementsFixture = [{ name: 'Ironhaven', size: 'city', description: 'Remotely upgraded', updatedAt: 2 }];
    capturedHandler({ key: 'settlements-list-test-campaign', data: { action: 'updated', name: 'Ironhaven' } });

    // Open editor untouched (draft intact) and NO background re-fetch.
    expect(notesField.value).toBe('Draft settlement notes');
    expect(loadCallCount).toBe(1);

    // Closing consumes the skipped broadcast immediately — the list must never
    // stay stale so a reopened editor re-seeds a fresh row (409 recovery).
    // The draft is dirty, so × now NAMES the discard (improve 2026-10-29-V):
    // accept it to exercise the close path.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(confirmSpy).toHaveBeenCalledWith('Discard changes to "Ironhaven"?');
    confirmSpy.mockRestore();
    await findByText('city');
    expect(loadCallCount).toBe(2);

    // Events arriving with the modal closed keep refreshing live.
    settlementsFixture = [...settlementsFixture, {
      name: 'Fallcrest', size: 'village', description: 'Riverside village', updatedAt: 3,
    }];
    capturedHandler({ key: 'settlements-list-test-campaign', data: { action: 'created', name: 'Fallcrest' } });
    await findByText('Fallcrest');
    expect(loadCallCount).toBe(3);
  });
});
