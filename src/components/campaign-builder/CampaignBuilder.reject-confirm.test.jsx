// @maintained-by-ai: 2026-11-13
// Improvement (backlog 2026-11-13 ZC: silent one-click draft Reject): Reject on
// a draft card must no longer delete immediately — it arms the shared
// DeleteConfirmModal role="dialog" tier naming the draft and stating the
// drafted row is destroyed. Cancel/dismiss writes NOTHING (zero fetches, row
// stays rendered as a draft, no banner); confirming performs exactly the old
// behavior: rejectDraft DELETE + list resync, still silent on success.
// Mirrors CampaignBuilder.race-loser-copy.test.jsx mocking conventions.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: () => () => {},
}));

let loadCallCount = 0;
let groupsFixture = {};
const emptyGroups = () => ({
  factions: [], settlements: [], npcs: [], quests: [], encounters: [], sessions: [], maps: [],
});
const withDraft = () => ({
  ...emptyGroups(),
  npcs: [{ name: 'QA Confirm NPC', description: 'Harbor informant', draft: true }],
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

const rejectButton = () => {
  const name = screen.getByText('QA Confirm NPC', {
    selector: '.campaign-builder-row-name',
  });
  return name.closest('.campaign-builder-row').querySelector('button.ct-btn-danger');
};

describe('CampaignBuilder draft Reject confirm gate', () => {
  let fetchSpy;
  beforeEach(() => {
    loadCallCount = 0;
    groupsFixture = withDraft();
    rejectDraft.mockReset().mockResolvedValue(undefined);
    // Every write/read in this component flows through draftActions — any
    // fetch attempt at all during a Cancel leg would be a silent write.
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Reject click opens the shared DeleteConfirmModal naming the draft — no delete yet', async () => {
    const { findByText } = renderBuilder();
    await findByText('QA Confirm NPC');

    fireEvent.click(rejectButton());

    // Shared role="dialog" tier (modal-shell chrome, .delete-confirm-btn action).
    const dialog = await screen.findByRole('dialog');
    expect(dialog.closest('.modal-shell-overlay')).toBeTruthy();
    // Names the draft and states the drafted row is destroyed.
    expect(dialog.textContent).toContain('QA Confirm NPC');
    expect(dialog.textContent).toMatch(/drafted row is destroyed/);
    expect(dialog.textContent).toMatch(/cannot be undone/);
    // Maps-manager delete precedent for the confirm label.
    expect(screen.getByText('Yes, Delete Permanently').closest('.delete-confirm-btn'))
      .toBeTruthy();
    // The one-click delete is gone: no lane call, no network write.
    expect(rejectDraft).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    // No error banner, and the row is still rendered behind the dialog.
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Cancel writes nothing: no fetch, row stays draft, modal closes, no banner', async () => {
    const { findByText } = renderBuilder();
    await findByText('QA Confirm NPC');
    const loadsAtArm = loadCallCount;

    fireEvent.click(rejectButton());
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(rejectDraft).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    // The draft survives untouched on the panel — and no re-fetch even fired.
    expect(screen.getByText('QA Confirm NPC', { selector: '.campaign-builder-row-name' }))
      .toBeTruthy();
    expect(loadCallCount).toBe(loadsAtArm);
  });

  it('Confirm performs exactly the old reject: delete lane + resync to empty, still silent', async () => {
    const { findByText } = renderBuilder();
    await findByText('QA Confirm NPC');

    fireEvent.click(rejectButton());
    await screen.findByRole('dialog');
    groupsFixture = { ...groupsFixture, npcs: [] }; // lane success: row gone
    fireEvent.click(screen.getByText('Yes, Delete Permanently'));

    await waitFor(() => expect(rejectDraft).toHaveBeenCalledWith(
      'test-campaign', 'npcs', expect.objectContaining({ name: 'QA Confirm NPC' })
    ));
    // Dialog retires, list resyncs to the empty state, no error banner.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await findByText(/Nothing is drafted right now/);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
