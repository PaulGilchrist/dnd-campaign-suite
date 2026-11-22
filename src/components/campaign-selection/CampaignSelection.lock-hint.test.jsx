// @maintained-by-ai
/**
 * Quick-create PRE-COMMIT lock disclosure (backlog 2026-11-22 QQ): when GET
 * /api/server-config reports campaignLocked, every open quick-create modal
 * surfaces an inline note (admin-lock-note — the Admin rename/delete note's
 * class) enumerating the allowed campaign names, so the dated prefills
 * (Arena-YYYYMMDD / Starter-YYYYMMDD) no longer 403-blind on Create. This
 * mirrors CampaignAdmin.delete-lock.test.jsx (same config-fetch mocking).
 * Locked → the note is present inside the dialog naming the exact allowlist;
 * unlocked (or a failed config fetch, fail-open) → the note renders nowhere.
 * The prefills themselves are unchanged, and Create/Cancel stay inert: no
 * create traffic here (the modal is only opened and cancelled).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignSelection from './CampaignSelection.jsx';
import { seededDefaultName } from '../../services/campaign/seededCampaign.js';
import { getCharacterFolders } from '../../services/campaign/campaignService.js';

vi.mock('../../services/campaign/campaignService.js', () => ({
  getCharacterFolders: vi.fn(),
  getCharacterFiles: vi.fn(),
  loadCharacters: vi.fn(),
}));
vi.mock('../../services/campaign/campaignMetaService.js', () => ({
  getCampaignTypes: vi.fn(async () => ({})),
  CAMPAIGN_TYPE_BADGES: {},
}));
vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: vi.fn(() => () => {}),
}));
// Keep the real date-stamp helpers (the modal prefill and the hint share
// seededDefaultName); mock only the orchestrator that POSTs to the server.
vi.mock('../../services/campaign/seededCampaign.js', async (importOriginal) => ({
  ...(await importOriginal()),
  createSeededCampaign: vi.fn(),
}));

import { createSeededCampaign } from '../../services/campaign/seededCampaign.js';

// Live harness shape: GET /api/server-config under
// CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter'.
const SET_LOCK = 'test-campaign,qa-arena,qa-starter';

function mockServerConfig(config) {
  const fetchMock = vi.fn(async (url) => ({
    ok: true,
    status: 200,
    json: async () => {
      if (String(url).includes('/api/server-config')) return config;
      return {};
    },
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function renderSelection() {
  getCharacterFolders.mockResolvedValue(['Campaign1']);
  const view = render(<CampaignSelection isLocalhost />);
  await waitFor(() => {
    expect(screen.queryByText('Loading campaigns...')).not.toBeInTheDocument();
  });
  return view;
}

// Exact rendered copy for a seeded modal: dated default named, allowlist
// enumerated verbatim.
const seedNote = (prefix) =>
  `Campaign is locked — the prefilled default (${seededDefaultName(prefix)}) ` +
  'will be refused. Only these campaign names are allowed: ' +
  'test-campaign, qa-arena, qa-starter.';

// Waits for the mount-time config fetch to land, then opens one modal and
// asserts the note lives INSIDE its dialog while the prefill is untouched.
async function expectNoteInModal(buttonName, prefix, expected) {
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
  const dialog = screen.getByRole('dialog', { name: prefix === 'Arena' ? 'New Arena Battle' : 'New Starter Adventure' });
  const note = dialog.querySelector('.admin-lock-note');
  expect(note).not.toBeNull();
  expect(note.textContent.replace(/\s+/g, ' ')).toBe(expected);
  expect(screen.getByLabelText('New campaign name')).toHaveValue(seededDefaultName(prefix));
  // Cancel is inert (no create traffic) and closes the modal with the note.
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(createSeededCampaign).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('quick-create modals - pre-commit lock disclosure', () => {
  it('locked: New Arena Battle names the dated default and enumerates the allowlist', async () => {
    mockServerConfig({ campaignLocked: true, lockedCampaign: SET_LOCK });
    await renderSelection();
    await expectNoteInModal(/New Arena Battle/, 'Arena', seedNote('Arena'));
  });

  it('locked: New Starter Adventure shows the same disclosure for its own default', async () => {
    mockServerConfig({ campaignLocked: true, lockedCampaign: SET_LOCK });
    await renderSelection();
    await expectNoteInModal(/New Starter Adventure/, 'Starter', seedNote('Starter'));
  });

  it('locked: the standard New Campaign modal discloses the allowlist with the prefix-less clause', async () => {
    mockServerConfig({ campaignLocked: true, lockedCampaign: SET_LOCK });
    await renderSelection();
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'New Campaign' }));
    const note = document.querySelector('.modal-content .admin-lock-note');
    expect(note).not.toBeNull();
    expect(note.textContent.replace(/\s+/g, ' ')).toBe(
      'Campaign is locked — a name outside the allowlist will be refused. ' +
      'Only these campaign names are allowed: test-campaign, qa-arena, qa-starter.'
    );
    // No dated default exists here, and no prefill was added by the disclosure.
    expect(note.textContent).not.toMatch(/prefilled default/);
    expect(screen.getByLabelText('New campaign name')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetch.mock.calls.filter(([url]) => !String(url).includes('/api/server-config'))).toHaveLength(0);
  });

  it('unlocked: no quick-create modal — standard included — renders a lock note', async () => {
    mockServerConfig({ campaignLocked: false });
    await renderSelection();
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'New Campaign' }));
    expect(document.querySelector('.modal-content .admin-lock-note')).toBeNull();
    expect(screen.queryByText(/Campaign is locked/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('unlocked: neither quick-create modal renders a lock note', async () => {
    mockServerConfig({ campaignLocked: false });
    await renderSelection();
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    for (const [buttonName, prefix] of [[/New Arena Battle/, 'Arena'], [/New Starter Adventure/, 'Starter']]) {
      fireEvent.click(screen.getByRole('button', { name: buttonName }));
      const dialog = screen.getByRole('dialog');
      expect(dialog.querySelector('.admin-lock-note')).toBeNull();
      expect(screen.queryByText(/Campaign is locked/)).not.toBeInTheDocument();
      // Prefill unchanged on the unlocked face too.
      expect(screen.getByLabelText('New campaign name')).toHaveValue(seededDefaultName(prefix));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    }
    expect(createSeededCampaign).not.toHaveBeenCalled();
  });

  it('fails open: a failed config fetch renders no lock note', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await renderSelection();
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /New Arena Battle/ }));
    expect(screen.getByRole('dialog').querySelector('.admin-lock-note')).toBeNull();
    expect(screen.queryByText(/Campaign is locked/)).not.toBeInTheDocument();
  });
});
