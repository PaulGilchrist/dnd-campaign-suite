// @maintained-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignSelection from './CampaignSelection.jsx';

// Mock the campaign service — the component under test talks to the API
// only through these three functions (plus a direct fetch for creation).
vi.mock('../../services/campaign/campaignService.js', () => ({
  getCharacterFolders: vi.fn(),
  getCharacterFiles: vi.fn(),
  loadCharacters: vi.fn(),
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

const openCreateModal = () => fireEvent.click(screen.getByRole('button', { name: 'Add' }));
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

    it('shows an error screen when loading folders fails and reloads the page when Reload Page is clicked', async () => {
      const reloadSpy = stubReload();
      getCharacterFolders.mockRejectedValue(new Error('Network error'));

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load campaigns/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Reload Page' }));

      expect(reloadSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('campaign list', () => {
    it('renders the heading, an Add button, and one enabled button per campaign', async () => {
      await renderCampaigns({ folders: ['Alpha', 'Beta', 'Gamma'] });

      expect(screen.getByRole('heading', { level: 1, name: 'Select a Campaign' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
      ['Alpha', 'Beta', 'Gamma'].forEach((name) => {
        expect(campaignButton(name)).toBeEnabled();
      });
    });

    it('shows guidance and keeps Add available when no campaigns exist', async () => {
      await renderCampaigns({ folders: [] });

      expect(screen.getByText(/No campaigns found/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
      expect(screen.queryByText('Campaign1')).not.toBeInTheDocument();
    });
  });

  describe('create campaign modal', () => {
    it('opens from Add, discards the typed name on Cancel, and reopens blank', async () => {
      await renderCampaigns();

      openCreateModal();
      expect(screen.getByRole('heading', { level: 2, name: 'Create New Campaign' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

      fireEvent.change(nameInput(), { target: { value: 'My Campaign' } });
      expect(nameInput()).toHaveValue('My Campaign');

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('heading', { name: 'Create New Campaign' })).not.toBeInTheDocument();
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
