// @maintained-by-ai: 2026-10-31
// Live-sync contract for the Campaign Builder drafts panel (improve
// drafts-panel-no-live-sync): approve/reject travel through each kind's
// normal save/delete lane, which already broadcasts `<kind>-list-<campaign>`
// (server/routes/{factions,settlements,npcs,quests,encounters,sessions,maps}.js).
// Every such event must re-fetch the drafts so a row another tab approved or
// deleted drops off this panel without clicking Refresh; events on other
// keys/campaigns are ignored, and re-fetches are skipped while this tab has
// an action in flight (runAction reloads when it completes). Mirrors
// Settlements.sse-sync.test.jsx. Connects through the ONE shared SSE client
// (subscribeToSSE via <Subscriber>), never a raw EventSource.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
let groupsFixture = {};
const emptyGroups = () => ({
  factions: [], settlements: [], npcs: [], quests: [], encounters: [], sessions: [], maps: [],
});

let resolveApprove = null;

vi.mock('../../services/campaign/draftActions.js', async () => {
  const actual = await vi.importActual('../../services/campaign/draftActions.js');
  return {
    ...actual,
    loadDrafts: vi.fn(async () => {
      loadCallCount += 1;
      return JSON.parse(JSON.stringify(groupsFixture));
    }),
    approveDraft: vi.fn(),
    rejectDraft: vi.fn(async () => {}),
  };
});

// The embedded designer section probes AI status on mount — off here.
vi.mock('../../services/ai/aiClient.js', () => ({
  getAiStatus: vi.fn(async () => ({ configured: false })),
  loadDesignerConversation: vi.fn(async () => ({ messages: [] })),
  saveDesignerPendingPlan: vi.fn(async () => ({ ok: true })),
  designerChat: vi.fn(), designerPlan: vi.fn(), designerGenerate: vi.fn(),
}));

import { loadDrafts, approveDraft } from '../../services/campaign/draftActions.js';
import CampaignBuilder from './CampaignBuilder.jsx';

const withDraft = () => ({
  ...emptyGroups(),
  settlements: [{ name: 'Mudport', size: 'village', draft: true }],
  factions: [{ id: 'f1', name: 'Cult of the Frostmaw', draft: true }],
});

const renderBuilder = () => render(<CampaignBuilder campaignName="test-campaign" />);

describe('CampaignBuilder drafts SSE sync', () => {
  beforeEach(() => {
    mockSubscribe.mockClear();
    capturedHandler = null;
    unsubscribeCalls = 0;
    loadCallCount = 0;
    groupsFixture = withDraft();
    resolveApprove = null;
    approveDraft.mockReset().mockImplementation(
      () => new Promise(resolve => { resolveApprove = resolve; })
    );
    loadDrafts.mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('subscribes through the shared SSE client on mount and unsubscribes on unmount', async () => {
    const { findByText, unmount } = renderBuilder();
    await findByText('Mudport');
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith('test-campaign', expect.any(Function));

    unmount();
    expect(unsubscribeCalls).toBe(1);
    expect(capturedHandler).toBeNull();
  });

  it('drops a row live when another tab approves it (settlements-list updated broadcast)', async () => {
    const { findByText, queryByText } = renderBuilder();
    await findByText('Mudport');
    expect(loadCallCount).toBe(1);

    // Tab B approves Mudport: flag stripped on disk → no draft row returned,
    // broadcast already emitted by the normal save lane.
    groupsFixture = { ...withDraft(), settlements: [] };
    capturedHandler({
      key: 'settlements-list-test-campaign',
      data: { action: 'updated', name: 'Mudport' },
    });

    await waitFor(() => expect(queryByText('Mudport')).toBeNull());
    expect(loadCallCount).toBe(2);
    // Unaffected kind still renders.
    expect(screen.getByText('Cult of the Frostmaw')).toBeInTheDocument();
  });

  it('drops a row live when another tab rejects it (factions-list deleted broadcast)', async () => {
    const { findByText, queryByText } = renderBuilder();
    await findByText('Cult of the Frostmaw');

    groupsFixture = { ...withDraft(), factions: [] };
    capturedHandler({
      key: 'factions-list-test-campaign',
      data: { action: 'deleted', id: 'f1' },
    });

    await waitFor(() => expect(queryByText('Cult of the Frostmaw')).toBeNull());
    expect(loadCallCount).toBe(2);

    // And a NEW draft appearing elsewhere shows up too (created broadcast).
    groupsFixture = {
      ...withDraft(),
      encounters: [{ name: 'Ferry Ambush', selectedMonsters: [], draft: true }],
    };
    capturedHandler({
      key: 'encounters-list-test-campaign',
      data: { action: 'created', encounter: { name: 'Ferry Ambush' } },
    });
    await findByText('Ferry Ambush');
    expect(loadCallCount).toBe(3);
  });

  it('ignores SSE events from other keys/campaigns', async () => {
    const { findByText } = renderBuilder();
    await findByText('Mudport');

    capturedHandler({ key: 'settlements-list-other-campaign', data: { action: 'updated' } });
    capturedHandler({ key: 'notes-list-test-campaign', data: { action: 'created' } });
    capturedHandler({ key: 'campaigns-changedata', data: {} });
    capturedHandler(null);

    expect(loadCallCount).toBe(1);
  });

  it('skips re-fetches while this tab has an approve in flight, and the action reload covers the miss', async () => {
    const { findByText } = renderBuilder();
    await findByText('Mudport');
    const factionName = screen.getByText('Cult of the Frostmaw');
    const row = factionName.closest('.campaign-builder-row');

    fireEvent.click(row.querySelector('button.ct-btn-primary'));
    await waitFor(() => expect(approveDraft).toHaveBeenCalled());

    // Approve still pending (busy) — a remote broadcast must NOT fire a
    // concurrent reload (it would race the action's own refresh).
    groupsFixture = { ...withDraft(), settlements: [] };
    capturedHandler({
      key: 'settlements-list-test-campaign',
      data: { action: 'updated', name: 'Mudport' },
    });
    expect(loadCallCount).toBe(1);

    // Completing the approve reloads — which also picks up the missed event.
    resolveApprove();
    await waitFor(() => expect(loadCallCount).toBe(2));
    await waitFor(() => expect(screen.queryByText('Mudport')).toBeNull());
  });
});
