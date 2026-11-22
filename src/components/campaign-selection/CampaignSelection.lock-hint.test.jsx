// @maintained-by-ai
/**
 * Quick-create lock disclosure + lock-aware prefill (backlog 2026-11-22 QQ,
 * sharpened by the seed-prefill-lock-aware improve): when GET
 * /api/server-config reports campaignLocked, every open quick-create modal
 * surfaces an inline note (admin-lock-note — the Admin rename/delete note's
 * class) enumerating the allowed campaign names. The note may NEVER be false
 * about its current input: the refusal clause only appears while the field's
 * actual value is outside the allowlist. When the lock refuses the dated
 * default but a free allowlisted name exists, the modal now PREFILLS that
 * name (first free member of the server-reported lockNames order), so a
 * zero-edit Create commits. Faces pinned here:
 *   - locked + free member → prefills qa-arena, note discloses the allowlist
 *     WITHOUT claiming refusal, zero-edit Create routes the prefilled name;
 *   - locked + typed off-allowlist name → the note names it as refused and
 *     live-tracks the input back to honesty;
 *   - locked + NO free member → dated prefill + the honest 'will be refused'
 *     note (unchanged face);
 *   - unlocked (or a failed config fetch, fail-open) → dated prefill, no note.
 * The standard New Campaign modal keeps the prefix-less conditional clause and
 * its EMPTY prefill. Only the explicit zero-edit-create pin creates anything
 * (through the mocked orchestrator — no network).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignSelection from './CampaignSelection.jsx';
import { seededDefaultName } from '../../services/campaign/seededCampaign.js';
import {
  getCharacterFolders,
  getCharacterFiles,
  loadCharacters,
} from '../../services/campaign/campaignService.js';

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
// Keep the real date-stamp/prefill helpers (the modal prefill and the note
// share seededDefaultName); mock only the orchestrator that POSTs to the server.
vi.mock('../../services/campaign/seededCampaign.js', async (importOriginal) => ({
  ...(await importOriginal()),
  createSeededCampaign: vi.fn(),
}));

import { createSeededCampaign } from '../../services/campaign/seededCampaign.js';

// Live harness shape: GET /api/server-config under
// CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter'.
const SET_LOCK = 'test-campaign,qa-arena,qa-starter';
const ALLOWLIST = 'test-campaign, qa-arena, qa-starter';
// Live public/campaigns/ baseline: test-campaign taken → qa-arena is free.
const BASELINE_FOLDERS = ['Frostfall', 'test-campaign', 'Testing G1', 'Testing G2', 'Testing G3'];

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

const LOCKED = { campaignLocked: true, lockedCampaign: SET_LOCK };

async function renderSelection(folders = BASELINE_FOLDERS) {
  getCharacterFolders.mockResolvedValue(folders);
  getCharacterFiles.mockResolvedValue([]);
  loadCharacters.mockResolvedValue([]);
  render(<CampaignSelection isLocalhost />);
  await waitFor(() => {
    expect(screen.queryByText('Loading campaigns...')).not.toBeInTheDocument();
  });
  // Wait for the mount-time config fetch to land before opening any modal.
  await waitFor(() => expect(fetch).toHaveBeenCalled());
}

const nameInput = () => screen.getByLabelText('New campaign name');

function openSeedModal(buttonName) {
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
  return screen.getByRole('dialog');
}

function noteText(dialog) {
  const note = dialog.querySelector('.admin-lock-note');
  return note ? note.textContent.replace(/\s+/g, ' ') : null;
}

// Exact rendered copy for a seeded modal whose current input COMMITS: honest
// allowlist disclosure with NO refusal claim.
const commitableNote = `Campaign is locked. Only these campaign names are allowed: ${ALLOWLIST}.`;

// Exact rendered copy for a seeded modal still on the refused dated default.
const refusedDefaultNote = (prefix) =>
  `Campaign is locked — the prefilled default (${seededDefaultName(prefix)}) ` +
  `will be refused. Only these campaign names are allowed: ${ALLOWLIST}.`;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('locked + free allowlisted name: actionable prefill, truthful note', () => {
  it('New Arena Battle prefills the FIRST FREE member (qa-arena) — the note discloses without claiming refusal', async () => {
    mockServerConfig(LOCKED);
    await renderSelection();

    const dialog = openSeedModal(/New Arena Battle/);
    expect(nameInput()).toHaveValue('qa-arena');
    expect(noteText(dialog)).toBe(commitableNote);
    expect(noteText(dialog)).not.toMatch(/will be refused/);
    // Cancel stays inert (no create traffic) and closes the modal with the note.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(createSeededCampaign).not.toHaveBeenCalled();
  });

  it('New Starter Adventure prefills the same first free member (server order, not preset order)', async () => {
    mockServerConfig(LOCKED);
    await renderSelection();

    const dialog = openSeedModal(/New Starter Adventure/);
    expect(nameInput()).toHaveValue('qa-arena');
    expect(noteText(dialog)).toBe(commitableNote);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(createSeededCampaign).not.toHaveBeenCalled();
  });

  it('zero-edit Create on the prefilled free name routes the orchestrator and enters the campaign', async () => {
    mockServerConfig(LOCKED);
    createSeededCampaign.mockResolvedValue({ name: 'qa-arena', seed: 1, seeded: {} });
    getCharacterFolders.mockResolvedValue(BASELINE_FOLDERS);
    getCharacterFiles.mockResolvedValue([]);
    loadCharacters.mockResolvedValue([]);
    const onCampaignSelect = vi.fn();
    render(<CampaignSelection isLocalhost onCampaignSelect={onCampaignSelect} />);
    await waitFor(() => expect(screen.queryByText('Loading campaigns...')).not.toBeInTheDocument());
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    openSeedModal(/New Arena Battle/);
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(createSeededCampaign).toHaveBeenCalledWith('arena', { name: 'qa-arena' }));
    await waitFor(() => expect(onCampaignSelect).toHaveBeenCalledWith('qa-arena', []));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('the note tracks the CURRENT input: a typed off-allowlist name is named as refused, reverting drops the claim', async () => {
    mockServerConfig(LOCKED);
    await renderSelection();

    const dialog = openSeedModal(/New Arena Battle/);
    fireEvent.change(nameInput(), { target: { value: 'Doom Launch Pad' } });
    expect(noteText(dialog)).toBe(
      'Campaign is locked — the name "Doom Launch Pad" will be refused. ' +
      `Only these campaign names are allowed: ${ALLOWLIST}.`
    );
    fireEvent.change(nameInput(), { target: { value: 'qa-starter' } });
    expect(noteText(dialog)).toBe(commitableNote);
  });
});

describe('locked with NO free allowlisted name: dated prefill + honest refusal note', () => {
  const taken = [...BASELINE_FOLDERS, 'qa-arena', 'qa-starter'];

  it('arena keeps the dated default and names it as refused (current behavior, no silent invalid state)', async () => {
    mockServerConfig(LOCKED);
    await renderSelection(taken);

    const dialog = openSeedModal(/New Arena Battle/);
    expect(nameInput()).toHaveValue(seededDefaultName('Arena'));
    expect(noteText(dialog)).toBe(refusedDefaultNote('Arena'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(createSeededCampaign).not.toHaveBeenCalled();
  });

  it('starter shows the same refusal disclosure for its own dated default', async () => {
    mockServerConfig(LOCKED);
    await renderSelection(taken);

    const dialog = openSeedModal(/New Starter Adventure/);
    expect(nameInput()).toHaveValue(seededDefaultName('Starter'));
    expect(noteText(dialog)).toBe(refusedDefaultNote('Starter'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  });
});

describe('standard New Campaign modal: prefix-less conditional clause, empty prefill', () => {
  it('discloses the allowlist and keeps the generic clause (no dated default exists here)', async () => {
    mockServerConfig(LOCKED);
    await renderSelection();

    fireEvent.click(screen.getByRole('button', { name: 'New Campaign' }));
    const note = document.querySelector('.modal-content .admin-lock-note');
    expect(note).not.toBeNull();
    expect(note.textContent.replace(/\s+/g, ' ')).toBe(
      'Campaign is locked — a name outside the allowlist will be refused. ' +
      `Only these campaign names are allowed: ${ALLOWLIST}.`
    );
    expect(note.textContent).not.toMatch(/prefilled default/);
    expect(screen.getByLabelText('New campaign name')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('unlocked faces: dated prefill unchanged, no lock note anywhere', () => {
  it('neither quick-create modal renders a lock note and both keep the dated default', async () => {
    mockServerConfig({ campaignLocked: false });
    await renderSelection();

    for (const [buttonName, prefix] of [[/New Arena Battle/, 'Arena'], [/New Starter Adventure/, 'Starter']]) {
      const dialog = openSeedModal(buttonName);
      expect(noteText(dialog)).toBeNull();
      expect(screen.queryByText(/Campaign is locked/)).not.toBeInTheDocument();
      // Prefill unchanged on the unlocked face too.
      expect(nameInput()).toHaveValue(seededDefaultName(prefix));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    }
    expect(createSeededCampaign).not.toHaveBeenCalled();
  });

  it('the standard modal renders no lock note', async () => {
    mockServerConfig({ campaignLocked: false });
    await renderSelection();

    fireEvent.click(screen.getByRole('button', { name: 'New Campaign' }));
    expect(document.querySelector('.modal-content .admin-lock-note')).toBeNull();
    expect(screen.queryByText(/Campaign is locked/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('fails open: a failed config fetch renders no lock note and keeps the dated prefill', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await renderSelection();

    const dialog = openSeedModal(/New Arena Battle/);
    expect(noteText(dialog)).toBeNull();
    expect(screen.queryByText(/Campaign is locked/)).not.toBeInTheDocument();
    expect(nameInput()).toHaveValue(seededDefaultName('Arena'));
  });
});
