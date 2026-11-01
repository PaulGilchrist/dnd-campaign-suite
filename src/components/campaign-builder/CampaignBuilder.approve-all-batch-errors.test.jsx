// @maintained-by-ai: 2026-11-01
// Regression (backlog 2026-11-01 AU: approve-all mid-loop failures go
// invisible): a batch "Approve all" that 409s on row k used to have its
// honest banner erased by row k+1's runAction opening with setError(null) —
// one GM gesture, then zero DOM trace of "was modified… NOT saved". The batch
// is ONE gesture, so approveAll now defers per-row errors (runAction
// { deferError: true }), keeps attempting every row, and surfaces ALL
// failures as one accumulated banner after the loop. Single-row lanes are
// untouched (see CampaignBuilder.error-persistence.test.jsx). Mirrors that
// file's render/mock setup.
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
// Failing row FIRST: under the old code a later success/failure's
// setError(null) erased the mid-loop banner — this ordering is the regression.
const withBatch = () => ({
  ...emptyGroups(),
  factions: [
    { id: 'bad', name: 'QA AU Batch Bad', draft: true },
    { id: 'good', name: 'QA AU Batch Good', draft: true },
  ],
});
const CONFLICT = 'Faction "QA AU Batch Bad" was modified in another tab ' +
  'or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';
const CONFLICT_2 = 'Faction "QA AU Batch Good" was modified in another tab ' +
  'or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';

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

import { approveDraft } from '../../services/campaign/draftActions.js';
import CampaignBuilder from './CampaignBuilder.jsx';

const renderBuilder = () => render(<CampaignBuilder campaignName="test-campaign" />);

const approveAllButton = () =>
  screen.getByRole('button', { name: /Approve all factions/ });

/** Successful approves drop the row from the fixture (server truth). */
const approveRemovesRow = async (_c, _kind, row) => {
  groupsFixture = {
    ...groupsFixture,
    factions: groupsFixture.factions.filter(f => f.id !== row.id),
  };
};

describe('CampaignBuilder approve-all batch error accumulation', () => {
  beforeEach(() => {
    capturedHandler = null;
    loadCallCount = 0;
    groupsFixture = withBatch();
    approveDraft.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('one failing row in a 2-row batch leaves the banner visible after the loop', async () => {
    const { findByText } = renderBuilder();
    await findByText('QA AU Batch Bad');

    approveDraft.mockImplementation(async (_c, _kind, row) => {
      if (row.id === 'bad') throw new Error(CONFLICT);
      await approveRemovesRow(_c, _kind, row);
    });
    fireEvent.click(approveAllButton());

    // No further user action: the batch itself must render the failure even
    // though the good row's action ran AFTER the 409 (old bug: erased).
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('1 of 2');
    expect(alert.textContent).toContain('was modified in another tab');
    expect(alert.textContent).toContain('QA AU Batch Bad');
    // The batch kept attempting rows and the success still landed.
    expect(approveDraft).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByText('QA AU Batch Good')).toBeNull());
    // The failed row lingers (it really is still a draft server-side).
    expect(screen.getByText('QA AU Batch Bad')).toBeInTheDocument();
  });

  it('multiple failures in one batch are ALL reported in the banner', async () => {
    const { findByText } = renderBuilder();
    await findByText('QA AU Batch Bad');

    approveDraft.mockRejectedValueOnce(new Error(CONFLICT))
      .mockRejectedValueOnce(new Error(CONFLICT_2));
    fireEvent.click(approveAllButton());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('2 of 2');
    expect(alert.textContent).toContain('QA AU Batch Bad');
    expect(alert.textContent).toContain('QA AU Batch Good');
    expect(approveDraft).toHaveBeenCalledTimes(2);
    // Both rows survive (neither saved).
    expect(screen.getByText('QA AU Batch Bad')).toBeInTheDocument();
    expect(screen.getByText('QA AU Batch Good')).toBeInTheDocument();
  });

  it('a clean batch shows no banner, and a later Refresh clears an accumulated one', async () => {
    const { findByText } = renderBuilder();
    await findByText('QA AU Batch Bad');

    approveDraft.mockImplementation(approveRemovesRow);
    fireEvent.click(approveAllButton());
    await waitFor(() => expect(screen.queryByText('QA AU Batch Bad')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();

    // Second batch re-seeded with a failure → banner appears…
    groupsFixture = withBatch();
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    await findByText('QA AU Batch Bad');
    approveDraft.mockImplementation(async (_c, _kind, row) => {
      if (row.id === 'bad') throw new Error(CONFLICT);
      await approveRemovesRow(_c, _kind, row);
    });
    fireEvent.click(approveAllButton());
    await screen.findByRole('alert');

    // …and the next user-initiated Refresh clears it (e1f282a42 contract).
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('an SSE row-sync reload never erases the accumulated batch banner', async () => {
    const { findByText } = renderBuilder();
    await findByText('QA AU Batch Bad');

    approveDraft.mockImplementation(async (_c, _kind, row) => {
      if (row.id === 'bad') throw new Error(CONFLICT);
      await approveRemovesRow(_c, _kind, row);
    });
    fireEvent.click(approveAllButton());
    await screen.findByRole('alert');

    // Another tab touches a different kind — rows sync, banner persists.
    groupsFixture = { ...groupsFixture, settlements: [] };
    capturedHandler({
      key: 'settlements-list-test-campaign',
      data: { action: 'updated', name: 'Elsewhere' },
    });
    await waitFor(() => expect(loadCallCount).toBeGreaterThanOrEqual(4));
    expect(screen.getByRole('alert').textContent).toContain('was modified in another tab');
  });
});
