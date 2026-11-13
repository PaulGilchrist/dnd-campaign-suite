// @maintained-by-ai: 2026-10-31
// Regression (bug-drafts-double-reject-ghost-row): when an approve/reject
// FAILS, runAction must still re-fetch the drafts before surfacing the error
// banner. The race: two GM tabs Reject one draft — the loser's DELETE 404s
// ("Faction not found") because the winner already removed the row
// server-side, and the winner's `<kind>-list` broadcast lands inside the
// loser's busy window so handleSSEEvent skips it. Without reload-on-error the
// deleted row lingered as a stale, fully-actionable ghost. Mirrors
// CampaignBuilder.sse-sync.test.jsx conventions.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let capturedHandler = null;
vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: (_campaignName, handler) => {
    capturedHandler = handler;
    return () => { capturedHandler = null; };
  },
}));

let loadCallCount = 0;
let groupsFixture = {};
const emptyGroups = () => ({
  factions: [], settlements: [], npcs: [], quests: [], encounters: [], sessions: [], maps: [],
});
const withDraft = () => ({
  ...emptyGroups(),
  factions: [{ id: 'f1', name: 'QA AS Draft One', draft: true }],
  settlements: [{ name: 'Mudport', size: 'village', draft: true }],
});

vi.mock('../../services/campaign/draftActions.js', async () => {
  const actual = await vi.importActual('../../services/campaign/draftActions.js');
  return {
    ...actual,
    loadDrafts: vi.fn(async () => {
      loadCallCount += 1;
      return JSON.parse(JSON.stringify(groupsFixture));
    }),
    approveDraft: vi.fn(async () => {}),
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

import { rejectDraft } from '../../services/campaign/draftActions.js';
import CampaignBuilder from './CampaignBuilder.jsx';

const renderBuilder = () => render(<CampaignBuilder campaignName="test-campaign" />);

const factionRejectButton = () => {
  const name = screen.getByText('QA AS Draft One');
  return name.closest('.campaign-builder-row').querySelector('button.ct-btn-danger');
};

// Reject arms the shared DeleteConfirmModal gate first; the DELETE only fires
// when the modal's confirm button is clicked (backlog 2026-11-13 ZC).
const clickReject = () => {
  fireEvent.click(factionRejectButton());
  fireEvent.click(screen.getByText('Yes, Delete Permanently'));
};

describe('CampaignBuilder failed-action list sync', () => {
  beforeEach(() => {
    capturedHandler = null;
    loadCallCount = 0;
    groupsFixture = withDraft();
    rejectDraft.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('failed reject re-fetches and drops the ghost row while still showing the banner', async () => {
    const { findByText, queryByText } = renderBuilder();
    await findByText('QA AS Draft One');
    expect(loadCallCount).toBe(1);

    // Winner tab deleted the row first: server truth no longer carries it,
    // and this tab's DELETE 404s.
    rejectDraft.mockRejectedValue(new Error('Faction not found'));
    clickReject();
    groupsFixture = { ...withDraft(), factions: [] };

    // Banner names the draft with the friendly race-loser copy (backlog
    // 2026-11-13 ZC: the raw server string must never render)…
    await waitFor(() => expect(screen.getByRole('alert').textContent)
      .toContain('QA AS Draft One'));
    expect(screen.getByRole('alert').textContent).toMatch(/list has already refreshed/);
    expect(screen.getByRole('alert').textContent).not.toContain('Faction not found');
    // …and the ghost row is gone via the error-path reload (mount + one
    // re-fetch — the busy-skip in handleSSEEvent means no other load fires).
    await waitFor(() => expect(queryByText('QA AS Draft One')).toBeNull());
    expect(loadCallCount).toBe(2);
    // Unaffected kind still renders, and its buttons are actionable again
    // (busy released after the failed action).
    expect(screen.getByText('Mudport')).toBeInTheDocument();
    const mudportRow = screen.getByText('Mudport').closest('.campaign-builder-row');
    expect(mudportRow.querySelector('button.ct-btn-danger').disabled).toBe(false);
  });

  it('error-path reload keeps a row that still exists server-side', async () => {
    const { findByText } = renderBuilder();
    await findByText('QA AS Draft One');

    rejectDraft.mockRejectedValue(new Error('Network hiccup'));
    clickReject();

    // Fixture unchanged (row is NOT deleted server-side) — the re-fetch must
    // keep rendering it; only the banner reports the failure.
    await waitFor(() => expect(screen.getByRole('alert').textContent)
      .toContain('Network hiccup'));
    expect(screen.getByText('QA AS Draft One')).toBeInTheDocument();
    expect(loadCallCount).toBe(2);
  });

  it('failed reject still leaves SSE sync armed for later broadcasts', async () => {
    const { findByText } = renderBuilder();
    await findByText('QA AS Draft One');

    rejectDraft.mockRejectedValue(new Error('Faction not found'));
    clickReject();
    groupsFixture = { ...withDraft(), factions: [], settlements: [] };
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());

    // Not busy anymore — the next broadcast must trigger a normal re-fetch.
    capturedHandler({
      key: 'settlements-list-test-campaign',
      data: { action: 'deleted', name: 'Mudport' },
    });
    await waitFor(() => expect(screen.queryByText('Mudport')).toBeNull());
    expect(loadCallCount).toBe(3);
  });
});
