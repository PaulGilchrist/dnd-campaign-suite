// @maintained-by-ai: 2026-11-01
// Regression (backlog 2026-11-01 AT: approve-race banner self-erase): when an
// approve 409s "was modified in another tab … it was NOT saved", runAction
// surfaces the banner AFTER its error-path reload — but the other tab's
// `<kind>-list` SSE broadcast lands ~200ms later in a now-non-busy tab. The
// old reload() began with setError(null), erasing the message unreadable
// (observed live: approve-side banner gone at 2.5s). SSE-triggered reloads
// must keep the banner while rows still live-sync; only user-initiated
// Refresh or a subsequent action clears it. Mirrors
// CampaignBuilder.action-error-reload.test.jsx conventions.
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
const withDrafts = () => ({
  ...emptyGroups(),
  factions: [{ id: 'f1', name: 'QA AT Race Faction', draft: true }],
  settlements: [{ name: 'Mudport', size: 'village', draft: true }],
});
const CONFLICT = 'Faction "QA AT Race Faction" was modified in another tab ' +
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

const factionApproveButton = () => {
  const name = screen.getByText('QA AT Race Faction');
  return name.closest('.campaign-builder-row').querySelector('button.ct-btn-primary');
};

/** Fail the approve and wait for the conflict banner to render. */
const failApproveWithConflict = async ({ findByText, findByRole }) => {
  await findByText('QA AT Race Faction');
  approveDraft.mockRejectedValue(new Error(CONFLICT));
  fireEvent.click(factionApproveButton());
  const alert = await findByRole('alert');
  expect(alert.textContent).toContain('was modified in another tab');
  // mount + error-path reload
  expect(loadCallCount).toBe(2);
  return alert;
};

describe('CampaignBuilder action-error persistence across SSE reloads', () => {
  beforeEach(() => {
    capturedHandler = null;
    loadCallCount = 0;
    groupsFixture = withDrafts();
    approveDraft.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('conflict banner survives the other tab’s SSE-triggered reload while rows keep syncing', async () => {
    const { findByText, findByRole, queryByText } = renderBuilder();
    const alert = await failApproveWithConflict({ findByText, findByRole });

    // The winner tab's save broadcasts settlements-list ~200ms later: this
    // tab (no longer busy) re-fetches — rows live-update behind the banner…
    groupsFixture = { ...withDrafts(), settlements: [] };
    capturedHandler({
      key: 'settlements-list-test-campaign',
      data: { action: 'updated', name: 'Mudport' },
    });
    await waitFor(() => expect(queryByText('Mudport')).toBeNull());
    // …but the "was NOT saved" message is NOT erased by the row-sync reload.
    expect(loadCallCount).toBe(3);
    expect(screen.getByRole('alert')).toBe(alert);
    expect(alert.textContent).toContain('was modified in another tab');
  });

  it('banner stays across repeated SSE row-sync reloads', async () => {
    const { findByText, findByRole } = renderBuilder();
    await failApproveWithConflict({ findByText, findByRole });

    capturedHandler({ key: 'factions-list-test-campaign', data: { action: 'updated', id: 'f1' } });
    await waitFor(() => expect(loadCallCount).toBe(3));
    capturedHandler({ key: 'npcs-list-test-campaign', data: { action: 'created', name: 'Probe' } });
    await waitFor(() => expect(loadCallCount).toBe(4));
    expect(screen.getByRole('alert').textContent).toContain('was modified in another tab');
  });

  it('user-initiated Refresh clears the banner', async () => {
    const { findByText, findByRole } = renderBuilder();
    await failApproveWithConflict({ findByText, findByRole });

    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => expect(loadCallCount).toBe(3));
    expect(screen.queryByRole('alert')).toBeNull();
    // Rows still rendered after the refresh.
    expect(screen.getByText('QA AT Race Faction')).toBeInTheDocument();
  });

  it('a subsequent successful action clears the banner', async () => {
    const { findByText, findByRole, queryByText } = renderBuilder();
    await failApproveWithConflict({ findByText, findByRole });

    // GM retries; the stamp is fresh now — approve succeeds and the row goes.
    approveDraft.mockResolvedValue(undefined);
    groupsFixture = { ...withDrafts(), factions: [] };
    fireEvent.click(screen.getByText('QA AT Race Faction')
      .closest('.campaign-builder-row').querySelector('button.ct-btn-primary'));
    await waitFor(() => expect(queryByText('QA AT Race Faction')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('successful actions show no banner at all', async () => {
    const { findByText } = renderBuilder();
    await findByText('QA AT Race Faction');
    fireEvent.click(factionApproveButton());
    await waitFor(() => expect(approveDraft).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
