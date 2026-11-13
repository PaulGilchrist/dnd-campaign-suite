// @maintained-by-ai: 2026-11-13
// Regression (backlog 2026-11-13 ZC: double-reject race-loser raw copy): two
// GM tabs reject/approve one draft simultaneously — the loser's DELETE 404s
// with the server's verbatim `NPC not found` and the banner resurfaced that
// raw string. runAction's catch must map the drafts-lane not-found 404 family
// (`<Noun> not found` from server/utils/jsonEntityCrud.js and the
// encounters/sessions/maps routes) onto planner-conflict-shaped copy that
// NAMES the draft and STATES the list already refreshed (runAction re-fetches
// before surfacing). Every other failure (500, validation, name law) still
// surfaces its real server copy. Mirrors CampaignBuilder.error-persistence
// .test.jsx conventions.
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
const withDrafts = () => ({
  ...emptyGroups(),
  npcs: [{ name: 'QA Race NPC', draft: true }],
  factions: [{ id: 'f1', name: 'QA Race Faction', draft: true }],
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

import { approveDraft, rejectDraft } from '../../services/campaign/draftActions.js';
import CampaignBuilder from './CampaignBuilder.jsx';

const renderBuilder = () => render(<CampaignBuilder campaignName="test-campaign" />);

const rowButton = (name, selector) =>
  screen.getByText(name).closest('.campaign-builder-row').querySelector(selector);

/** Click `action` on `name` after failing it with `serverCopy`, and return
 * the rendered banner. The winner's delete promotes the re-fetched (empty)
 * list, exactly like the live two-tab rig. */
const raceLoserBanner = async ({ findByText, findByRole }, { name, action, serverCopy }) => {
  await findByText(name);
  const loser = action === 'reject' ? rejectDraft : approveDraft;
  loser.mockRejectedValue(new Error(serverCopy));
  groupsFixture = { ...groupsFixture, npcs: [], factions: [] };
  fireEvent.click(rowButton(name, action === 'reject' ? 'button.ct-btn-danger' : 'button.ct-btn-primary'));
  const alert = await findByRole('alert');
  // Resync contract holds: the list re-fetched after the failure (mount +
  // error-path reload) and the gone row no longer renders.
  expect(loadCallCount).toBe(2);
  expect(screen.queryByText(name)).toBeNull();
  return alert;
};

describe('CampaignBuilder drafts-lane race-loser copy', () => {
  beforeEach(() => {
    loadCallCount = 0;
    groupsFixture = withDrafts();
    approveDraft.mockReset().mockResolvedValue(undefined);
    rejectDraft.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reject race-loser 404 names the draft and states the list refreshed — never raw "NPC not found"', async () => {
    const alert = await raceLoserBanner(await renderBuilder(), {
      name: 'QA Race NPC', action: 'reject', serverCopy: 'NPC not found',
    });
    expect(alert.textContent).toContain('QA Race NPC');
    expect(alert.textContent).toMatch(/in another tab or session/);
    expect(alert.textContent).toMatch(/list has already refreshed/);
    expect(alert.textContent).not.toContain('NPC not found');
  });

  it('approve race-loser 404 gets the same friendly family for other kind nouns', async () => {
    const alert = await raceLoserBanner(await renderBuilder(), {
      name: 'QA Race Faction', action: 'approve', serverCopy: 'Faction not found',
    });
    expect(alert.textContent).toContain('QA Race Faction');
    expect(alert.textContent).toMatch(/list has already refreshed/);
    expect(alert.textContent).not.toContain('Faction not found');
  });

  it('the intentional console.error keeps the raw server error for the audit trail', async () => {
    await raceLoserBanner(await renderBuilder(), {
      name: 'QA Race NPC', action: 'reject', serverCopy: 'NPC not found',
    });
    expect(console.error).toHaveBeenCalledWith(
      '[CampaignBuilder] npcs action failed:',
      expect.objectContaining({ message: 'NPC not found' })
    );
  });

  it('non-not-found failures still surface their real server copy verbatim', async () => {
    const SERVER_ERROR = 'Internal server error';
    const alert = await raceLoserBanner(await renderBuilder(), {
      name: 'QA Race NPC', action: 'reject', serverCopy: SERVER_ERROR,
    });
    expect(alert.textContent).toBe(SERVER_ERROR);
  });

  it('name-law refusals (client-side throw) are NOT remapped', async () => {
    const alert = await raceLoserBanner(await renderBuilder(), {
      name: 'QA Race NPC',
      action: 'approve',
      serverCopy: 'Not approved — name "npc" is a kind word — give the npc a proper, ' +
        'unique in-world name, never its kind word or a placeholder. Reject this draft ' +
        'and regenerate it with the AI designer instead.',
    });
    expect(alert.textContent).toContain('Not approved — name "npc" is a kind word');
  });

  it('a successful reject stays silent (no banner)', async () => {
    const { findByText, queryByRole } = renderBuilder();
    await findByText('QA Race NPC');
    groupsFixture = { ...groupsFixture, npcs: [] };
    fireEvent.click(rowButton('QA Race NPC', 'button.ct-btn-danger'));
    await waitFor(() => expect(rejectDraft).toHaveBeenCalled());
    expect(queryByRole('alert')).toBeNull();
  });
});
