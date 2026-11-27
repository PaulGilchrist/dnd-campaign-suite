// @maintained-by-ai 2026-11-26
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignSelection from './CampaignSelection.jsx';

// Mock the campaign service — the component under test talks to the API
// only through these three functions (plus a direct fetch for creation).
// The meta lane is mocked too so the load-time getCampaignTypes never
// pollutes the fetch spies below (it defaults to an empty type map).
vi.mock('../../services/campaign/campaignService.js', () => ({
  getCharacterFolders: vi.fn(),
  getCharacterFiles: vi.fn(),
  loadCharacters: vi.fn(),
}));
vi.mock('../../services/campaign/campaignMetaService.js', () => ({
  getCampaignTypes: vi.fn(async () => ({})),
  CAMPAIGN_TYPE_BADGES: {},
}));
// The component lives-refreshes via the ONE shared SSE client (app-level
// channel); stub it so these fetch-spying tests never touch EventSource —
// afterEach's unstubAllGlobals removes the inert one setup.js installs.
// The SSE-sync lane itself is owned by CampaignSelection.sse-sync.test.jsx.
vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: vi.fn(() => () => {}),
}));

import { getCharacterFolders, getCharacterFiles, loadCharacters } from '../../services/campaign/campaignService.js';

// --- Fixtures / helpers ------------------------------------------------------

// Build a fetch Response-like object without touching the network.
const httpResponse = ({ ok = true, body = {} } = {}) => ({
  ok,
  json: () => Promise.resolve(body),
});

// Stub fetch with an ordered response queue (server-config answered inertly
// so create-POST spies see only the lane under test).
function stubFetch(...responses) {
  const fetchMock = vi.fn();
  responses.forEach((response) => fetchMock.mockResolvedValue(response));
  // Backlog 2026-11-22 QQ: the picker mirrors CampaignAdmin's mount-time
  // GET /api/server-config; these pins are about the create POST only, so the
  // config lane answers inert-unlocked and never reaches the ordered spy.
  vi.stubGlobal('fetch', (url, ...rest) =>
    (String(url).includes('/api/server-config')
      ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ campaignLocked: false }) })
      : fetchMock(url, ...rest)));
  return fetchMock;
}

// Stub fetch with a pending promise so tests can observe the in-flight UI
// and resolve it explicitly.
function stubPendingFetch() {
  let resolveFetch;
  const fetchMock = vi.fn(
    () =>
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
  );
  // See stubFetch — the config lane never occupies the pending slot.
  vi.stubGlobal('fetch', (url, ...rest) =>
    (String(url).includes('/api/server-config')
      ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ campaignLocked: false }) })
      : fetchMock(url, ...rest)));
  return { fetchMock, resolve: (response) => resolveFetch(response) };
}

// Stub window.location so reloads are observable and never navigate.
function stubReload() {
  const reloadSpy = vi.fn();
  vi.stubGlobal('location', { reload: reloadSpy });
  return reloadSpy;
}

// Render, waiting out the initial folder fetch.
async function renderCampaigns({ folders = ['Campaign1'], ...props } = {}) {
  getCharacterFolders.mockResolvedValue(folders);
  render(<CampaignSelection {...props} />);
  await waitFor(() => {
    expect(screen.queryByText('Loading campaigns...')).not.toBeInTheDocument();
  });
}

const campaignButton = (name) => screen.getByRole('button', { name });

const openCreateModal = () => fireEvent.click(screen.getByRole('button', { name: 'New Campaign' }));
// NOTE: getByRole('textbox', { name }) cannot resolve placeholder-derived
// names in this vitest/jsdom setup, so the placeholder query is used here.
const nameInput = () => screen.getByPlaceholderText('Enter campaign name');
const submitCampaign = () => fireEvent.click(screen.getByRole('button', { name: 'Create' }));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('CampaignSelection', () => {
  describe('loading and error states', () => {
    it('shows only a loading message while campaigns are in flight', async () => {
      // Pending forever for this test — the render cleanup unmounts safely.
      getCharacterFolders.mockReturnValue(new Promise(() => {}));

      render(<CampaignSelection />);

      expect(screen.getByText('Loading campaigns...')).toBeInTheDocument();
      expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    it('refetches in place on Retry: a failed retry keeps the error lane with no polling, the next retry recovers without a reload', async () => {
      const reloadSpy = stubReload();
      getCharacterFolders.mockRejectedValue(new Error('Network error'));

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      });
      expect(screen.getByText(/Failed to load campaigns/)).toBeInTheDocument();
      // In-place recovery (2026-11-02 BG): the error lane offers Retry, never
      // a reload button, and the healthy "No campaigns found" copy must never
      // masquerade here.
      expect(screen.queryByRole('button', { name: 'Reload Page' })).not.toBeInTheDocument();
      expect(screen.queryByText(/No campaigns found/)).not.toBeInTheDocument();

      // A retry that fails again keeps the error and a clickable Retry.
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      await waitFor(() => {
        expect(getCharacterFolders).toHaveBeenCalledTimes(2);
      });
      expect(screen.getByText(/Failed to load campaigns/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();

      // Failure never becomes a polling loop — fetches only happen on clicks.
      await new Promise(r => setTimeout(r, 50));
      expect(getCharacterFolders).toHaveBeenCalledTimes(2);

      // The next Retry recovers in place — no page reload.
      getCharacterFolders.mockResolvedValue(['Campaign1']);
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      await waitFor(() => {
        expect(campaignButton('Campaign1')).toBeInTheDocument();
      });
      expect(screen.queryByText(/Failed to load campaigns/)).not.toBeInTheDocument();
      expect(reloadSpy).not.toHaveBeenCalled();
    });
  });

  describe('campaign list', () => {
    it('renders the heading, a New Campaign button, and one enabled button per campaign', async () => {
      await renderCampaigns({ folders: ['Alpha', 'Beta', 'Gamma'] });

      expect(screen.getByRole('heading', { level: 1, name: 'Select a Campaign' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'New Campaign' })).toBeInTheDocument();
      ['Alpha', 'Beta', 'Gamma'].forEach((name) => {
        expect(campaignButton(name)).toBeEnabled();
      });
    });

    it('shows guidance and keeps New Campaign available when no campaigns exist', async () => {
      await renderCampaigns({ folders: [] });

      expect(screen.getByText(/No campaigns found/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'New Campaign' })).toBeInTheDocument();
      expect(screen.queryByText('Campaign1')).not.toBeInTheDocument();
      // Healthy-but-empty is a FINAL answer, not an error: exactly one fetch
      // and no Retry lane (2026-11-02 BG). (No-polling-on-idle is proven in
      // the error-lane test above; not re-waited here.)
      expect(getCharacterFolders).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    });
  });

  describe('create campaign modal', () => {
    // Open/close mechanics (Escape, backdrop, Cancel) are owned by
    // CampaignSelection.create-modal-dismiss.test.jsx and the dialog a11y
    // trio by CampaignSelection.standard-modal-a11y.test.jsx. This test
    // covers the two lanes unique here: the input's accessible name and the
    // draft-discarded-on-dismiss contract.
    it('gives the name input an explicit accessible name and reopens blank after Cancel discards the draft', async () => {
      await renderCampaigns();

      openCreateModal();
      // Backlog 2026-11-18 LA: explicit accessible name (an aria-label, not
      // the placeholder fallback) on the inline campaign-name input.
      expect(screen.getByRole('textbox', { name: 'New campaign name', exact: true }))
        .toBeInTheDocument();

      fireEvent.change(nameInput(), { target: { value: 'My Campaign' } });
      expect(nameInput()).toHaveValue('My Campaign');

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog', { name: 'New Campaign', exact: true })).not.toBeInTheDocument();

      // Re-opening starts from a clean slate: the dismissed draft is gone.
      openCreateModal();
      expect(nameInput()).toHaveValue('');
    });

    it('rejects a whitespace-only campaign name without calling the API', async () => {
      // Whitespace-only subsumes the empty case: the guard must trim first,
      // so passing here proves both branches.
      const fetchSpy = stubFetch(httpResponse());
      await renderCampaigns();

      openCreateModal();
      fireEvent.change(nameInput(), { target: { value: '   ' } });
      submitCampaign();

      await waitFor(() => {
        expect(screen.getByText('Please enter a campaign name')).toBeInTheDocument();
      });
      expect(screen.queryByText(/successfully/)).not.toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('campaign creation', () => {
    it('POSTs the name, shows creating and success states, then reloads the page', async () => {
      const reloadSpy = stubReload();
      const { fetchMock, resolve } = stubPendingFetch();
      await renderCampaigns();

      // Fake the reload delay only from this point on, so the already-awaited
      // folder fetch stays untouched.
      vi.useFakeTimers();

      openCreateModal();
      fireEvent.change(nameInput(), { target: { value: 'New Campaign' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/campaigns',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignName: 'New Campaign' }),
        })
      );
      expect(screen.getByText('Creating campaign...')).toBeInTheDocument();

      await act(async () => {
        resolve(httpResponse());
      });

      expect(screen.getByText(/Campaign created successfully/)).toBeInTheDocument();
      expect(screen.getByText('Reloading...')).toBeInTheDocument();
      // The success screen replaces the modal — the input is cleared with it.
      expect(screen.queryByPlaceholderText('Enter campaign name')).not.toBeInTheDocument();
      expect(reloadSpy).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(reloadSpy).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['the API error message', { error: 'Campaign already exists' }, 'Campaign already exists'],
      ['a generic failure message', {}, 'Failed to create campaign'],
    ])('shows %s and does not reload when creation fails', async (_label, body, expectedMessage) => {
      const reloadSpy = stubReload();
      stubFetch(httpResponse({ ok: false, body }));
      await renderCampaigns();

      openCreateModal();
      fireEvent.change(nameInput(), { target: { value: 'Bad Campaign' } });
      await act(async () => {
        submitCampaign();
      });

      await waitFor(() => {
        expect(screen.getByText(expectedMessage)).toBeInTheDocument();
      });
      expect(screen.queryByText(/successfully/)).not.toBeInTheDocument();
      expect(reloadSpy).not.toHaveBeenCalled();
    });
  });

  describe('campaign selection', () => {
    it('stays idle until a row is clicked, then loads its characters and notifies the parent — and a second pick goes through', async () => {
      const onSelect = vi.fn();
      getCharacterFiles.mockResolvedValue(['char1.json']);
      loadCharacters.mockResolvedValue([{ name: 'Character1' }]);

      await renderCampaigns({ folders: ['Campaign1', 'Campaign2'], onCampaignSelect: onSelect });

      // Nothing fires unprompted: with no autoSelectCampaign prop there is
      // no auto-selection and no character fetch (character-less campaigns
      // just notify with whatever loadCharacters resolved).
      expect(onSelect).not.toHaveBeenCalled();
      expect(getCharacterFiles).not.toHaveBeenCalled();

      await act(async () => {
        fireEvent.click(campaignButton('Campaign1'));
      });
      expect(getCharacterFiles).toHaveBeenCalledWith('Campaign1');
      expect(loadCharacters).toHaveBeenCalledWith('Campaign1', ['char1.json']);
      expect(onSelect).toHaveBeenCalledWith('Campaign1', [{ name: 'Character1' }]);

      // Buttons are interactive again — a second selection goes through.
      const second = campaignButton('Campaign2');
      expect(second).toBeEnabled();
      await act(async () => {
        fireEvent.click(second);
      });
      expect(getCharacterFiles).toHaveBeenCalledWith('Campaign2');
      expect(onSelect).toHaveBeenCalledTimes(2);
      expect(onSelect).toHaveBeenLastCalledWith('Campaign2', [{ name: 'Character1' }]);
    });

    it('shows an error screen when loading the campaign data fails', async () => {
      const onSelect = vi.fn();
      getCharacterFiles.mockRejectedValue(new Error('Not found'));

      await renderCampaigns({ folders: ['BadCampaign'] });
      await act(async () => {
        fireEvent.click(campaignButton('BadCampaign'));
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to load campaign BadCampaign/)).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Reload Page' })).toBeInTheDocument();
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('auto-selects the campaign named by autoSelectCampaign, and only once across re-renders', async () => {
      const onSelect = vi.fn();
      getCharacterFolders.mockResolvedValue(['Campaign1', 'Campaign2']);
      getCharacterFiles.mockResolvedValue(['char1.json']);
      loadCharacters.mockResolvedValue([{ name: 'Character1' }]);

      const { rerender } = render(
        <CampaignSelection onCampaignSelect={onSelect} autoSelectCampaign="Campaign1" />
      );

      await waitFor(() => {
        expect(onSelect).toHaveBeenCalledWith('Campaign1', [{ name: 'Character1' }]);
      });
      expect(getCharacterFiles).toHaveBeenCalledWith('Campaign1');

      // A re-render with the same prop must not re-trigger the selection.
      rerender(<CampaignSelection onCampaignSelect={onSelect} autoSelectCampaign="Campaign1" />);
      await act(async () => {});
      expect(onSelect).toHaveBeenCalledTimes(1);
    });
  });
});
