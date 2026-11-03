// @maintained-by-ai: 2026-11-02
// Live-refresh contract for the campaign-selection screen (2026-11-02 BE
// backlog): the server publishes app-level `campaigns-list` events on
// campaign create/rename/delete and meta writes
// (server/routes/campaigns-admin.js + campaigns-meta.js), so a tab parked on
// selection gains/drops rows without a manual reload. Connects through the
// ONE shared SSE client's APP-level channel (subscribeToSSE(null, …) —
// empty-campaign key, never a campaign-scoped or raw EventSource) and the
// refresh is non-destructive: it never disturbs an open quick-create modal.
// No fake timers — events, not polls, drive the refresh.
// Mirrors FirstSessionChecklist.sse-sync.test.jsx.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignSelection from './CampaignSelection.jsx';
import { getCharacterFolders } from '../../services/campaign/campaignService.js';
import { getCampaignTypes } from '../../services/campaign/campaignMetaService.js';

let capturedHandler = null;
let capturedCampaignArg;
let unsubscribeCalls = 0;
const mockSubscribe = vi.fn((campaignName, handler) => {
  capturedCampaignArg = campaignName;
  capturedHandler = handler;
  return () => {
    capturedHandler = null;
    unsubscribeCalls += 1;
  };
});

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: (...args) => mockSubscribe(...args),
}));

vi.mock('../../services/campaign/campaignService.js', () => ({
  getCharacterFolders: vi.fn(),
  getCharacterFiles: vi.fn(async () => []),
  loadCharacters: vi.fn(async () => []),
}));

// Keep the real CAMPAIGN_TYPE_BADGES (rendered by the rows), mock only the fetch.
vi.mock('../../services/campaign/campaignMetaService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getCampaignTypes: vi.fn(async () => ({})),
}));

async function renderSelection(folders, types = {}) {
  getCharacterFolders.mockResolvedValue([...folders]);
  getCampaignTypes.mockResolvedValue({ ...types });
  const result = render(<CampaignSelection isLocalhost />);
  await waitFor(() => {
    expect(screen.queryByText('Loading campaigns...')).not.toBeInTheDocument();
  });
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedHandler = null;
  capturedCampaignArg = undefined;
  unsubscribeCalls = 0;
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('CampaignSelection live campaigns-list sync', () => {
  it('subscribes on the app-level shared SSE channel and tears down on unmount', async () => {
    const { unmount } = await renderSelection(['Frostfall']);
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    // App-level channel: the empty (null) campaign key, never campaign-scoped.
    expect(capturedCampaignArg).toBeNull();

    const fetchCountAfterMount = getCharacterFolders.mock.calls.length;
    unmount();
    expect(unsubscribeCalls).toBe(1);
    expect(capturedHandler).toBeNull();
    // Teardown proof: with the handler released, nothing can fetch anymore.
    expect(getCharacterFolders.mock.calls.length).toBe(fetchCountAfterMount);
  });

  it('a created event renders the new row WITH its arena badge — no remount', async () => {
    const { container } = await renderSelection(['Frostfall']);
    expect(screen.queryByText('qa-arena')).not.toBeInTheDocument();

    // Second tab created qa-arena: folders + types now answer differently.
    getCharacterFolders.mockResolvedValue(['Frostfall', 'qa-arena']);
    getCampaignTypes.mockResolvedValue({ 'qa-arena': 'arena' });
    capturedHandler({ key: 'campaigns-list', data: { action: 'created', campaign: 'qa-arena' } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /qa-arena\s*Arena Battle/ })).toBeInTheDocument();
    });
    expect(container.querySelector('.campaign-button--arena .campaign-type-badge--arena')).toHaveTextContent('Arena Battle');
    // Existing rows survive the refresh and the component was NOT remounted
    // (still exactly one shared-channel subscription).
    expect(screen.getByRole('button', { name: 'Frostfall' })).toBeInTheDocument();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });

  it('a deleted event drops the row without a reload', async () => {
    await renderSelection(['Frostfall', 'qa-arena'], { 'qa-arena': 'arena' });
    expect(screen.getByRole('button', { name: /qa-arena\s*Arena Battle/ })).toBeInTheDocument();

    getCharacterFolders.mockResolvedValue(['Frostfall']);
    getCampaignTypes.mockResolvedValue({});
    capturedHandler({ key: 'campaigns-list', data: { action: 'deleted', campaign: 'qa-arena' } });

    await waitFor(() => {
      expect(screen.queryByText('qa-arena')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Frostfall' })).toBeInTheDocument();
  });

  it('ignores other keys and malformed payloads — no refetch, rows unchanged', async () => {
    await renderSelection(['Frostfall']);
    const fetchCount = getCharacterFolders.mock.calls.length;

    capturedHandler({ key: 'change-test-campaign-hp', data: 12 });
    capturedHandler({ key: 'starter-seed-qa-starter', data: { action: 'updated', seed: {} } });
    capturedHandler(null);
    await new Promise(r => setTimeout(r, 20));

    expect(getCharacterFolders.mock.calls.length).toBe(fetchCount);
    expect(screen.getByRole('button', { name: 'Frostfall' })).toBeInTheDocument();
  });

  it('a refresh that fails mid-session keeps the visible rows — no wipe, no error lane', async () => {
    // Service rethrows on outage (2026-11-02 BG): a campaigns-list event that
    // refetches into a dead API must NOT blank the list (old LAN-deselect
    // symptom — the swallowed [] used to land here as an empty success).
    await renderSelection(['Frostfall', 'test-campaign']);
    getCharacterFolders.mockRejectedValue(new Error('Network error'));

    capturedHandler({ key: 'campaigns-list', data: { action: 'deleted', campaign: 'Frostfall' } });
    await new Promise(r => setTimeout(r, 30));

    expect(screen.getByRole('button', { name: 'Frostfall' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'test-campaign' })).toBeInTheDocument();
    expect(screen.queryByText(/Failed to load campaigns/)).not.toBeInTheDocument();
  });

  it('refresh is non-destructive: an open quick-create modal keeps its name draft', async () => {    await renderSelection(['Frostfall']);
    fireEvent.click(screen.getByRole('button', { name: 'New Campaign' }));
    const input = screen.getByPlaceholderText('Enter campaign name');
    fireEvent.change(input, { target: { value: 'Mid-Edit' } });

    getCharacterFolders.mockResolvedValue(['Frostfall', 'qa-arena']);
    capturedHandler({ key: 'campaigns-list', data: { action: 'created', campaign: 'qa-arena' } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'qa-arena' })).toBeInTheDocument();
    });
    expect(document.querySelector('.modal-overlay')).not.toBeNull();
    expect(input.value).toBe('Mid-Edit');
  });
});
