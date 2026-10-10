// Live-sync tests: the NPCs management list must re-fetch when an
// npcs-list SSE event arrives (another GM tab created/deleted an NPC),
// while an open edit form's draft must never be squashed.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NPCs from './NPCs';

let capturedHandler = null;
let unsubscribeCalls = 0;

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: vi.fn((campaignName, handler) => {
    capturedHandler = handler;
    return () => {
      capturedHandler = null;
      unsubscribeCalls += 1;
    };
  }),
}));

let loadCallCount = 0;
let npcsFixture = [{ name: 'Bardima', race: 'Half-Elf' }];

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
  default: vi.fn(({ npc, onEdit }) => (
    <li aria-label={`Edit NPC: ${npc.name}`}>
      <span>{npc.name}</span>
      <button onClick={() => onEdit(npc)}>Edit</button>
    </li>
  )),
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

describe('NPCs live SSE sync', () => {
  beforeEach(() => {
    capturedHandler = null;
    unsubscribeCalls = 0;
    loadCallCount = 0;
    npcsFixture = [{ name: 'Bardima', race: 'Half-Elf' }];
  });

  const renderNPCs = () =>
    render(<NPCs campaignName="test-campaign" onBack={vi.fn()} onViewInitiative={vi.fn()} />);

  it('subscribes via the shared SSE client on mount', async () => {
    const { unmount } = renderNPCs();
    await waitFor(() => expect(screen.getByText('Bardima')).toBeInTheDocument());
    expect(capturedHandler).toBeTypeOf('function');

    unmount();
    expect(unsubscribeCalls).toBe(1);
    expect(capturedHandler).toBeNull();
  });

  it('re-fetches and shows a new NPC when npcs-list event arrives', async () => {
    renderNPCs();
    await waitFor(() => expect(screen.getByText('Bardima')).toBeInTheDocument());
    expect(loadCallCount).toBe(1);

    npcsFixture = [
      { name: 'Bardima', race: 'Half-Elf' },
      { name: 'QA Sync NPC A', race: 'Human' },
    ];
    capturedHandler({ key: 'npcs-list-test-campaign', data: { action: 'created', name: 'QA Sync NPC A' } });

    await waitFor(() =>
      expect(screen.getByLabelText('Edit NPC: QA Sync NPC A')).toBeInTheDocument()
    );
    expect(loadCallCount).toBe(2);
  });

  it('removes a deleted NPC from the list when npcs-list event arrives', async () => {
    renderNPCs();
    await waitFor(() => expect(screen.getByText('Bardima')).toBeInTheDocument());

    npcsFixture = [];
    capturedHandler({ key: 'npcs-list-test-campaign', data: { action: 'deleted', name: 'Bardima' } });

    await waitFor(() =>
      expect(screen.queryByLabelText('Edit NPC: Bardima')).not.toBeInTheDocument()
    );
  });

  it('ignores SSE events from other keys/campaigns', async () => {
    renderNPCs();
    await waitFor(() => expect(screen.getByText('Bardima')).toBeInTheDocument());
    expect(loadCallCount).toBe(1);

    capturedHandler({ key: 'npcs-list-other-campaign', data: { action: 'created' } });
    capturedHandler({ key: 'maps-list-test-campaign', data: { action: 'created' } });

    expect(loadCallCount).toBe(1);
  });

  it('does not squash an open edit form draft when an SSE event arrives', async () => {
    renderNPCs();
    await waitFor(() => expect(screen.getByText('Bardima')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Edit'));
    const nameInput = await screen.findByTestId('npc-name-input');
    fireEvent.change(nameInput, { target: { value: 'Draft Name Mid-Edit' } });
    expect(nameInput.value).toBe('Draft Name Mid-Edit');

    npcsFixture = [
      { name: 'Bardima', race: 'Half-Elf' },
      { name: 'QA Sync NPC A', race: 'Human' },
    ];
    capturedHandler({ key: 'npcs-list-test-campaign', data: { action: 'created', name: 'QA Sync NPC A' } });

    expect(nameInput.value).toBe('Draft Name Mid-Edit');
    const refetchesBeforeClose = loadCallCount;

    fireEvent.click(screen.getByText('Cancel'));
    capturedHandler({ key: 'npcs-list-test-campaign', data: { action: 'created', name: 'QA Sync NPC A' } });

    await waitFor(() =>
      expect(screen.getByLabelText('Edit NPC: QA Sync NPC A')).toBeInTheDocument()
    );
    expect(loadCallCount).toBeGreaterThan(refetchesBeforeClose);
  });
});
