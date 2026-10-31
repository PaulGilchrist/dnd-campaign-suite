// @maintained-by-ai
// Live-sync contract for the Quests manager: every quests-list-<campaign> SSE
// event (per server/routes/quests.js broadcast hook: replaced/deleted) must
// re-fetch and re-render the list, events for other keys are ignored, and
// re-fetches are skipped while the edit modal is open so a draft in progress
// is never disturbed — but the missed broadcast is applied on close so a
// reopened editor never re-seeds a stale row. Mirrors NPCs.sse-sync.test.jsx.
// Connects through the ONE shared SSE client (subscribeToSSE), never a raw
// EventSource.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Quests from './Quests';

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
let questsFixture = [{ id: 'q1', name: 'The Lost Artifact', status: 'active', description: '' }];

vi.mock('../../services/campaign/questsService.js', () => ({
  loadQuests: vi.fn(async () => {
    loadCallCount += 1;
    // Mirrors questsService.loadQuests: unwraps to a plain array.
    return questsFixture;
  }),
  saveQuests: vi.fn(async () => ({ success: true })),
  deleteQuest: vi.fn(async () => ({ success: true })),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange }) => (
    <textarea
      data-testid={`quest-field-${id}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('../common/MarkdownPreview.jsx', () => ({
  default: ({ text }) => <span>{text}</span>,
}));

const renderQuests = () =>
  render(<Quests campaignName="test-campaign" isLocalhost />);

describe('Quests live SSE sync', () => {
  beforeEach(() => {
    mockSubscribe.mockClear();
    capturedHandler = null;
    unsubscribeCalls = 0;
    loadCallCount = 0;
    questsFixture = [{ id: 'q1', name: 'The Lost Artifact', status: 'active', description: '' }];
  });

  it('subscribes through the shared SSE client on mount and unsubscribes on unmount', () => {
    const { unmount } = renderQuests();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith('test-campaign', expect.any(Function));

    unmount();
    expect(unsubscribeCalls).toBe(1);
    expect(capturedHandler).toBeNull();
  });

  it('re-fetches on quests-list events for this campaign, surfacing created and deleted quests', async () => {
    const { findByText } = renderQuests();
    await findByText('The Lost Artifact');
    expect(loadCallCount).toBe(1);

    questsFixture = [...questsFixture, { id: 'q2', name: 'The Sunken Shrine', status: 'active', description: '' }];
    capturedHandler({ key: 'quests-list-test-campaign', data: { action: 'replaced' } });
    await findByText('The Sunken Shrine');
    expect(loadCallCount).toBe(2);

    questsFixture = [{ id: 'q2', name: 'The Sunken Shrine', status: 'active', description: '' }];
    capturedHandler({ key: 'quests-list-test-campaign', data: { action: 'deleted', name: 'q1' } });
    await findByText('The Sunken Shrine');
    expect(screen.queryByText('The Lost Artifact')).not.toBeInTheDocument();
    expect(loadCallCount).toBe(3);
  });

  it('ignores SSE events from other keys/campaigns', async () => {
    const { findByText } = renderQuests();
    await findByText('The Lost Artifact');

    capturedHandler({ key: 'quests-list-other-campaign', data: { action: 'replaced' } });
    capturedHandler({ key: 'factions-list-test-campaign', data: { action: 'replaced' } });
    capturedHandler(null);

    expect(loadCallCount).toBe(1);
  });

  it('skips re-fetches while the edit form is open, then applies the missed event on close', async () => {
    const { findByText } = renderQuests();
    await findByText('The Lost Artifact');

    fireEvent.click(screen.getByRole('button', { name: /New Quest/i }));
    const nameInput = screen.getByPlaceholderText('Quest name');
    fireEvent.change(nameInput, { target: { value: 'Draft Quest' } });

    questsFixture = [...questsFixture, { id: 'q2', name: 'The Sunken Shrine', status: 'active', description: '' }];
    capturedHandler({ key: 'quests-list-test-campaign', data: { action: 'replaced' } });

    expect(nameInput.value).toBe('Draft Quest');
    expect(loadCallCount).toBe(1);

    // Closing consumes the skipped broadcast immediately — the list must never
    // stay stale so a reopened editor re-seeds a fresh row (409 recovery).
    // The draft is dirty, so × now NAMES the discard (improve 2026-10-29-V):
    // accept it to exercise the close path.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(confirmSpy).toHaveBeenCalledWith('Discard changes to "Draft Quest"?');
    confirmSpy.mockRestore();
    await findByText('The Sunken Shrine');
    expect(loadCallCount).toBe(2);

    // Events arriving with the modal closed keep refreshing live.
    questsFixture = [...questsFixture, { id: 'q3', name: 'The Hollow Crown', status: 'active', description: '' }];
    capturedHandler({ key: 'quests-list-test-campaign', data: { action: 'replaced' } });
    await findByText('The Hollow Crown');
    expect(loadCallCount).toBe(3);
  });
});
