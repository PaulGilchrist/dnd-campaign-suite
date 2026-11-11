// @maintained-by-ai
// Backlog 2026-11-11 LZ — quick-create lock denial is INLINE, not a full-page
// dead end. A POST /api/campaigns 403 (CAMPAIGN_LOCK refusing an off-allowlist
// name) must keep the create modal open, PRESERVE the typed name, and render
// the server's plain-English refusal inside the modal — the full-page
// "Campaign locked to … / Reload Page" screen stays reserved for genuine
// load/select failures. Both quick-create lanes are pinned: the standard
// New Campaign modal (direct fetch) and the seeded Arena/Starter modals
// (createSeededCampaign surfaces the server error verbatim).
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignSelection from './CampaignSelection.jsx';
import { createSeededCampaign } from '../../services/campaign/seededCampaign.js';
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
// Keep the real localDateStamp (seed modal default name uses it); mock only
// the orchestrator that POSTs to the server.
vi.mock('../../services/campaign/seededCampaign.js', async (importOriginal) => ({
  ...(await importOriginal()),
  createSeededCampaign: vi.fn(),
}));

// The verbatim shape server/utils/campaignLock.js createCampaignCreateGuard
// returns for an off-allowlist quick-create name under CAMPAIGN_LOCK.
const LOCK_DENIED =
  'Campaign locked to "test-campaign" — a new campaign named "Frostfall II" '
  + 'cannot be created while locked. Only these campaign names are allowed: test-campaign.';

const httpResponse = ({ ok = true, body = {} } = {}) => ({
  ok,
  status: ok ? 200 : 403,
  json: () => Promise.resolve(body),
});

function stubFetch(...responses) {
  const fetchMock = vi.fn();
  responses.forEach((response) => fetchMock.mockResolvedValue(response));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function stubReload() {
  const reloadSpy = vi.fn();
  vi.stubGlobal('location', { reload: reloadSpy });
  return reloadSpy;
}

async function renderCampaigns({ folders = ['test-campaign'], ...props } = {}) {
  getCharacterFolders.mockResolvedValue(folders);
  render(<CampaignSelection {...props} />);
  await waitFor(() => {
    expect(screen.queryByText('Loading campaigns...')).not.toBeInTheDocument();
  });
}

const nameInput = () => screen.getByPlaceholderText('Enter campaign name');

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('standard New Campaign modal — lock denial stays inline', () => {
  it('403 from POST /api/campaigns: modal stays open, name preserved, denial renders inside the modal', async () => {
    const reloadSpy = stubReload();
    stubFetch(httpResponse({
      ok: false,
      body: { error: LOCK_DENIED },
    }));
    await renderCampaigns();

    fireEvent.click(screen.getByRole('button', { name: 'New Campaign' }));
    fireEvent.change(nameInput(), { target: { value: 'Frostfall II' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    });

    // The denial renders as an inline alert INSIDE the open modal…
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(LOCK_DENIED);
    expect(alert.closest('.modal-content')).not.toBeNull();
    // …the modal is still mounted with the typed name preserved…
    expect(screen.getByRole('heading', { level: 2, name: 'New Campaign' })).toBeInTheDocument();
    expect(nameInput()).toHaveValue('Frostfall II');
    // …and the app never dropped to the full-page lock/Reload screen.
    expect(screen.queryByRole('button', { name: 'Reload Page' })).not.toBeInTheDocument();
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(screen.queryByText(/Campaign created successfully/)).not.toBeInTheDocument();
  });

  it('the empty-name validation also renders inline (no full-page swap)', async () => {
    const fetchSpy = stubFetch(httpResponse());
    await renderCampaigns();

    fireEvent.click(screen.getByRole('button', { name: 'New Campaign' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a campaign name');
    expect(screen.getByRole('heading', { level: 2, name: 'New Campaign' })).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a successful create shows no inline error (unchanged success path)', async () => {
    const reloadSpy = stubReload();
    stubFetch(httpResponse());
    await renderCampaigns();

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'New Campaign' }));
    fireEvent.change(nameInput(), { target: { value: 'Allowed Name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await act(async () => {});
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/Campaign created successfully/)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});

describe('seeded Arena/Starter modals — lock denial stays inline', () => {
  // The default dated name is never lock-allowed — the exact QA-rig trip the
  // backlog calls out — so the arena lane is probed with its own default.
  it('arena create rejection renders inside the dialog with the name preserved, no full-page swap', async () => {
    const reloadSpy = stubReload();
    createSeededCampaign.mockRejectedValue(new Error(LOCK_DENIED));
    await renderCampaigns();

    fireEvent.click(screen.getByRole('button', { name: /New Arena Battle/ }));
    const dialog = screen.getByRole('dialog');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(LOCK_DENIED);
    // The denial lives inside the still-open seed dialog; typed name kept.
    expect(dialog.contains(alert)).toBe(true);
    expect(screen.getByRole('heading', { level: 2, name: 'New Arena Battle' })).toBeInTheDocument();
    expect(nameInput().value).toMatch(/^Arena-/);
    expect(screen.queryByRole('button', { name: 'Reload Page' })).not.toBeInTheDocument();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('starter create rejection renders inline too, and a later success closes the modal with no error', async () => {
    createSeededCampaign.mockRejectedValue(new Error(LOCK_DENIED));
    await renderCampaigns();

    fireEvent.click(screen.getByRole('button', { name: /New Starter Adventure/ }));
    fireEvent.change(nameInput(), { target: { value: 'My Starter' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(LOCK_DENIED);
    });
    expect(nameInput()).toHaveValue('My Starter');

    // Retry lane after clearing the denial (createSeededCampaign now succeeds):
    // modal closes, no alert residue, campaign selection proceeds.
    createSeededCampaign.mockResolvedValue({ name: 'My Starter', seed: 1, seeded: {} });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reload Page' })).not.toBeInTheDocument();
  });
});
