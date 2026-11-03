// @maintained-by-ai
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

function stubFetch(...responses) {
  const fetchMock = vi.fn();
  responses.forEach((response) => fetchMock.mockResolvedValue(response));
  vi.stubGlobal('fetch', fetchMock);
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
  vi.stubGlobal('fetch', fetchMock);
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

    it('shows an inline error with a Retry button when the folder fetch fails, and refetches in place on Retry', async () => {
      const reloadSpy = stubReload();
      getCharacterFolders.mockRejectedValueOnce(new Error('Network error'));

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load campaigns/)).toBeInTheDocument();
      });
      // In-place recovery (2026-11-02 BG): Retry refetches — no page reload,
      // and the healthy "No campaigns found" copy must never masquerade here.
      const retry = screen.getByRole('button', { name: 'Retry' });
      expect(screen.queryByRole('button', { name: 'Reload Page' })).not.toBeInTheDocument();
      expect(screen.queryByText(/No campaigns found/)).not.toBeInTheDocument();

      getCharacterFolders.mockResolvedValue(['Campaign1']);
      fireEvent.click(retry);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Campaign1' })).toBeInTheDocument();
      });
      expect(screen.queryByText(/Failed to load campaigns/)).not.toBeInTheDocument();
      expect(reloadSpy).not.toHaveBeenCalled();
    });

    it('keeps the Retry affordance available when the retry itself fails (no auto-polling)', async () => {
      getCharacterFolders.mockRejectedValue(new Error('Network error'));

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      });
      const attemptsAfterMount = getCharacterFolders.mock.calls.length;

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      await waitFor(() => {
        expect(getCharacterFolders).toHaveBeenCalledTimes(attemptsAfterMount + 1);
      });
      // Still failed: error lane persists, Retry stays clickable, no reload.
      expect(screen.getByText(/Failed to load campaigns/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();

      // Failure never becomes a polling loop — fetches only happen on clicks.
      await new Promise(r => setTimeout(r, 50));
      expect(getCharacterFolders).toHaveBeenCalledTimes(attemptsAfterMount + 1);
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
      // Healthy-but-empty is a FINAL answer, not an error: exactly one fetch,
      // no Retry lane, no retry loop (2026-11-02 BG).
      expect(getCharacterFolders).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
      await new Promise(r => setTimeout(r, 50));
      expect(getCharacterFolders).toHaveBeenCalledTimes(1);
    });
  });

  describe('create campaign modal', () => {
    it('opens from the New Campaign button, discards the typed name on Cancel, and reopens blank', async () => {
      await renderCampaigns();

      openCreateModal();
      expect(screen.getByRole('heading', { level: 2, name: 'New Campaign' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

      fireEvent.change(nameInput(), { target: { value: 'My Campaign' } });
      expect(nameInput()).toHaveValue('My Campaign');

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('heading', { name: 'New Campaign' })).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Enter campaign name')).not.toBeInTheDocument();

      // Re-opening starts from a clean slate.
      openCreateModal();
      expect(nameInput()).toHaveValue('');
    });

    it.each([
      ['empty', ''],
      ['whitespace-only', '   '],
    ])('rejects a %s campaign name without calling the API', async (_label, value) => {
      const fetchSpy = stubFetch(httpResponse());
      await renderCampaigns();

      openCreateModal();
      fireEvent.change(nameInput(), { target: { value } });
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
    it.each([
      ['a campaign with characters', ['char1.json'], [{ name: 'Character1' }]],
      ['a character-less campaign', [], []],
    ])('loads %s and notifies the parent on click', async (_label, files, characters) => {
      const onSelect = vi.fn();
      getCharacterFiles.mockResolvedValue(files);
      loadCharacters.mockResolvedValue(characters);

      await renderCampaigns({ onCampaignSelect: onSelect });
      await act(async () => {
        fireEvent.click(campaignButton('Campaign1'));
      });

      expect(getCharacterFiles).toHaveBeenCalledWith('Campaign1');
      expect(loadCharacters).toHaveBeenCalledWith('Campaign1', files);
      expect(onSelect).toHaveBeenCalledWith('Campaign1', characters);
    });

    it('lets the user pick a different campaign after a successful selection', async () => {
      const onSelect = vi.fn();
      getCharacterFiles.mockResolvedValue([]);
      loadCharacters.mockResolvedValue([]);

      await renderCampaigns({ folders: ['Campaign1', 'Campaign2'], onCampaignSelect: onSelect });
      await act(async () => {
        fireEvent.click(campaignButton('Campaign1'));
      });
      await waitFor(() => {
        expect(onSelect).toHaveBeenCalledWith('Campaign1', []);
      });

      // Buttons are interactive again — a second selection goes through.
      const second = campaignButton('Campaign2');
      expect(second).toBeEnabled();
      await act(async () => {
        fireEvent.click(second);
      });

      expect(getCharacterFiles).toHaveBeenCalledWith('Campaign2');
      expect(onSelect).toHaveBeenLastCalledWith('Campaign2', []);
      expect(onSelect).toHaveBeenCalledTimes(2);
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

    it('does not auto-select or fetch characters when autoSelectCampaign is absent', async () => {
      const onSelect = vi.fn();

      await renderCampaigns({ onCampaignSelect: onSelect });

      expect(onSelect).not.toHaveBeenCalled();
      expect(getCharacterFiles).not.toHaveBeenCalled();
    });
  });
});
