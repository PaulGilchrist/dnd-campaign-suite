// @maintained-by-ai: 2026-10-14
// Live-sync contract for the NPCs manager: every npcs-list-<campaign> SSE
// event (per server/routes/npcs.js: created/updated/deleted/replaced) must
// re-fetch and re-render the list, events for other keys are ignored, and
// re-fetches are skipped while the edit modal is open so a draft in progress
// is never disturbed — but the missed broadcast is applied on close so a
// reopened editor never re-seeds a stale row. Connects through the ONE shared
// SSE client (subscribeToSSE), never a raw EventSource.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NPCs from './NPCs';

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
let npcsFixture = [{ name: 'Bardima', race: 'Half-Elf' }];

// loadNPCs drives every list assertion here; the save/stub exports only need
// to exist so NPCs.jsx's imports resolve against this module mock.
vi.mock('../../services/npcs/npcsService.js', () => ({
  loadNPCs: vi.fn(async () => {
    loadCallCount += 1;
    return { npcs: npcsFixture };
  }),
  saveNPC: vi.fn(async () => ({ success: true })),
  saveNPCs: vi.fn(async () => ({ success: true })),
  deleteNPC: vi.fn(async () => ({ success: true })),
}));

vi.mock('./NPCListItem.jsx', () => ({
  default: ({ npc, onEdit }) => (
    <li aria-label={`Edit NPC: ${npc.name}`}>
      <span>{npc.name}</span>
      <button onClick={() => onEdit(npc)}>Edit</button>
    </li>
  ),
}));

vi.mock('./NPCFormModal.jsx', () => ({
  default: ({ formData, setFormData, onClose }) => (
    <div data-testid="npc-form-modal">
      <input
        data-testid="npc-name-input"
        value={formData?.name || ''}
        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
      />
      <button onClick={onClose}>Cancel</button>
    </div>
  ),
}));

vi.mock('../../services/npcs/npcCombatService.js', () => ({
  addNPCToInitiative: vi.fn(),
}));

vi.mock('../../services/npcs/npcGenerator.js', () => ({
  generateNPC: vi.fn(async () => ({})),
}));

const renderNPCs = () =>
  render(<NPCs campaignName="test-campaign" onViewInitiative={vi.fn()} />);

describe('NPCs live SSE sync', () => {
  beforeEach(() => {
    mockSubscribe.mockClear();
    capturedHandler = null;
    unsubscribeCalls = 0;
    loadCallCount = 0;
    npcsFixture = [{ name: 'Bardima', race: 'Half-Elf' }];
  });

  it('subscribes through the shared SSE client on mount and unsubscribes on unmount', () => {
    const { unmount } = renderNPCs();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith('test-campaign', expect.any(Function));

    unmount();
    expect(unsubscribeCalls).toBe(1);
    expect(capturedHandler).toBeNull();
  });

  it('re-fetches on npcs-list events for this campaign, surfacing created and deleted NPCs', async () => {
    const { findByText } = renderNPCs();
    await findByText('Bardima');
    expect(loadCallCount).toBe(1);

    npcsFixture = [...npcsFixture, { name: 'QA Sync NPC A', race: 'Human' }];
    capturedHandler({ key: 'npcs-list-test-campaign', data: { action: 'created', name: 'QA Sync NPC A' } });
    await findByText('QA Sync NPC A');
    expect(loadCallCount).toBe(2);

    npcsFixture = [];
    capturedHandler({ key: 'npcs-list-test-campaign', data: { action: 'deleted', name: 'Bardima' } });
    await waitFor(() =>
      expect(screen.queryByLabelText('Edit NPC: Bardima')).not.toBeInTheDocument()
    );
    expect(loadCallCount).toBe(3);
  });

  it('ignores SSE events from other keys/campaigns', () => {
    renderNPCs();
    expect(capturedHandler).toBeTypeOf('function');

    capturedHandler({ key: 'npcs-list-other-campaign', data: { action: 'created' } });
    capturedHandler({ key: 'maps-list-test-campaign', data: { action: 'created' } });
    capturedHandler(null);

    expect(loadCallCount).toBe(1);
  });

  it('skips re-fetches while the edit form is open, then applies the missed event on close', async () => {
    renderNPCs();
    await screen.findByText('Bardima');

    fireEvent.click(screen.getByText('Edit'));
    const nameInput = await screen.findByTestId('npc-name-input');
    fireEvent.change(nameInput, { target: { value: 'Draft Name Mid-Edit' } });

    npcsFixture = [...npcsFixture, { name: 'QA Sync NPC A', race: 'Human' }];
    capturedHandler({ key: 'npcs-list-test-campaign', data: { action: 'created', name: 'QA Sync NPC A' } });

    expect(nameInput.value).toBe('Draft Name Mid-Edit');
    expect(loadCallCount).toBe(1);

    // Closing consumes the skipped broadcast immediately — the list must never
    // stay stale so a reopened editor re-seeds a fresh row (409 recovery).
    // The draft is dirty, so ×/Cancel first NAMES the discard (improve
    // 2026-10-29-V): accept it to exercise the close path.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByText('Cancel'));
    expect(confirmSpy).toHaveBeenCalledWith('Discard changes to "Draft Name Mid-Edit"?');
    confirmSpy.mockRestore();
    await screen.findByLabelText('Edit NPC: QA Sync NPC A');
    expect(loadCallCount).toBe(2);
    expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument();

    // Events arriving with the modal closed keep refreshing live.
    npcsFixture = [...npcsFixture, { name: 'QA Sync NPC B', race: 'Human' }];
    capturedHandler({ key: 'npcs-list-test-campaign', data: { action: 'created', name: 'QA Sync NPC B' } });
    await screen.findByLabelText('Edit NPC: QA Sync NPC B');
    expect(loadCallCount).toBe(3);
  });
});
