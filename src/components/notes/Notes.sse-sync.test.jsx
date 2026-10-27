// @maintained-by-ai
// Live-sync contract for the Notes manager: every notes-list-<campaign> SSE
// event (per server/routes/notes.js broadcast hook: replaced/deleted) must
// re-fetch and re-render the list, events for other keys are ignored, and
// re-fetches are skipped while the edit modal is open so a draft in progress
// is never disturbed — but the missed broadcast is applied on close so a
// reopened editor never re-seeds a stale row. Mirrors NPCs.sse-sync.test.jsx.
// Connects through the ONE shared SSE client (subscribeToSSE), never a raw
// EventSource.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Notes from './Notes';

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
let notesFixture = [{
  id: 'n1',
  description: 'Artifact hint',
  partyLocation: 'Skull Creek Cave',
  isPrivate: false,
  dateCreated: '2026-08-20T19:56:52.162Z',
  dateModified: '2026-08-20T19:57:01.395Z',
}];

vi.mock('../../services/campaign/notesService.js', () => ({
  loadNotes: vi.fn(async () => {
    loadCallCount += 1;
    return { notes: notesFixture };
  }),
  saveNotes: vi.fn(async () => ({ success: true })),
  deleteNote: vi.fn(async () => ({ success: true })),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange }) => (
    <textarea
      data-testid={`note-field-${id}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('../common/MarkdownPreview.jsx', () => ({
  default: ({ text }) => <span>{text}</span>,
}));

const renderNotes = () =>
  render(<Notes campaignName="test-campaign" characters={[]} isLocalhost onBack={vi.fn()} />);

describe('Notes live SSE sync', () => {
  beforeEach(() => {
    mockSubscribe.mockClear();
    capturedHandler = null;
    unsubscribeCalls = 0;
    loadCallCount = 0;
    notesFixture = [{
      id: 'n1',
      description: 'Artifact hint',
      partyLocation: 'Skull Creek Cave',
      isPrivate: false,
      dateCreated: '2026-08-20T19:56:52.162Z',
      dateModified: '2026-08-20T19:57:01.395Z',
    }];
  });

  it('subscribes through the shared SSE client on mount and unsubscribes on unmount', () => {
    const { unmount } = renderNotes();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith('test-campaign', expect.any(Function));

    unmount();
    expect(unsubscribeCalls).toBe(1);
    expect(capturedHandler).toBeNull();
  });

  it('re-fetches on notes-list events for this campaign, surfacing created and deleted notes', async () => {
    const { findByText } = renderNotes();
    await findByText('Skull Creek Cave');
    expect(loadCallCount).toBe(1);

    notesFixture = [...notesFixture, {
      id: 'n2',
      description: 'Fresh clue',
      partyLocation: 'Fallcrest Inn',
      isPrivate: false,
      dateCreated: '2026-10-26T09:00:00.000Z',
      dateModified: '2026-10-26T09:00:00.000Z',
    }];
    capturedHandler({ key: 'notes-list-test-campaign', data: { action: 'replaced' } });
    await findByText('Fallcrest Inn');
    expect(loadCallCount).toBe(2);

    notesFixture = notesFixture.filter(n => n.id !== 'n1');
    capturedHandler({ key: 'notes-list-test-campaign', data: { action: 'deleted', name: 'n1' } });
    await findByText('Fallcrest Inn');
    expect(screen.queryByText('Skull Creek Cave')).not.toBeInTheDocument();
    expect(loadCallCount).toBe(3);
  });

  it('ignores SSE events from other keys/campaigns', async () => {
    const { findByText } = renderNotes();
    await findByText('Skull Creek Cave');

    capturedHandler({ key: 'notes-list-other-campaign', data: { action: 'replaced' } });
    capturedHandler({ key: 'quests-list-test-campaign', data: { action: 'replaced' } });
    capturedHandler(null);

    expect(loadCallCount).toBe(1);
  });

  it('skips re-fetches while the edit form is open, then applies the missed event on close', async () => {
    const { findByText } = renderNotes();
    await findByText('Skull Creek Cave');

    fireEvent.click(screen.getByRole('button', { name: /New Note/i }));
    const descriptionInput = screen.getByTestId('note-field-note-description');
    fireEvent.change(descriptionInput, { target: { value: 'Draft note text' } });

    notesFixture = [...notesFixture, {
      id: 'n2',
      description: 'Fresh clue',
      partyLocation: 'Fallcrest Inn',
      isPrivate: false,
      dateCreated: '2026-10-26T09:00:00.000Z',
      dateModified: '2026-10-26T09:00:00.000Z',
    }];
    capturedHandler({ key: 'notes-list-test-campaign', data: { action: 'replaced' } });

    expect(descriptionInput.value).toBe('Draft note text');
    expect(loadCallCount).toBe(1);

    // Closing consumes the skipped broadcast immediately — the list must never
    // stay stale so a reopened editor re-seeds a fresh row (409 recovery).
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await findByText('Fallcrest Inn');
    expect(loadCallCount).toBe(2);

    // Events arriving with the modal closed keep refreshing live.
    notesFixture = [...notesFixture, {
      id: 'n3',
      description: 'Later clue',
      partyLocation: 'Ravenbarrow Crypt',
      isPrivate: false,
      dateCreated: '2026-10-26T10:00:00.000Z',
      dateModified: '2026-10-26T10:00:00.000Z',
    }];
    capturedHandler({ key: 'notes-list-test-campaign', data: { action: 'replaced' } });
    await findByText('Ravenbarrow Crypt');
    expect(loadCallCount).toBe(3);
  });
});
