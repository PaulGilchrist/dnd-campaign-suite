// @improved-by-ai
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

// --- Per-test fixtures / helpers ---------------------------------------------

// Build a fetch Response-like object without touching the network.
const httpResponse = ({ ok = true, body = {} } = {}) => ({
  ok,
  json: () => Promise.resolve(body),
});

// Stub fetch, returning the mock so tests can assert on calls.
// Always via vi.stubGlobal so afterEach can restore it.
function stubFetch(...responses) {
  const fetchMock = vi.fn();
  responses.forEach((response) => fetchMock.mockResolvedValue(response));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
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
});

describe('CampaignSelection', () => {
  describe('initial load', () => {
    it('shows a loading state and no actions while folders are in flight', async () => {
      // Pending forever for this test — the render cleanup unmounts safely.
      getCharacterFolders.mockReturnValue(new Promise(() => {}));

      render(<CampaignSelection />);

      expect(screen.getByText('Loading campaigns...')).toBeInTheDocument();
      expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    it('shows an error state with a reload option when loading folders fails', async () => {
      getCharacterFolders.mockRejectedValue(new Error('Network error'));

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load campaigns/)).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Reload Page' })).toBeInTheDocument();
    });
  });

  describe('campaign list', () => {
    it('renders one enabled button per campaign', async () => {
      await renderCampaigns({ folders: ['Alpha', 'Beta', 'Gamma'] });

      ['Alpha', 'Beta', 'Gamma'].forEach((name) => {
        expect(campaignButton(name)).toBeEnabled();
      });
    });

    it('shows the page heading and an Add button', async () => {
      await renderCampaigns();

      expect(screen.getByRole('heading', { level: 1, name: 'Select a Campaign' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    });

    it('shows guidance and keeps Add available when no campaigns exist', async () => {
      await renderCampaigns({ folders: [] });

      expect(screen.getByText(/No campaigns found/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
      expect(screen.queryByText('Campaign1')).not.toBeInTheDocument();
    });
  });

  describe('create campaign modal', () => {
    it('opens the create-campaign modal when Add is clicked', async () => {
      await renderCampaigns();

      openCreateModal();

      expect(screen.getByRole('heading', { level: 2, name: 'Create New Campaign' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter campaign name')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('closes the modal and discards the typed name when Cancel is clicked', async () => {
      await renderCampaigns();

      openCreateModal();
      fireEvent.change(nameInput(), { target: { value: 'My Campaign' } });
      expect(nameInput()).toHaveValue('My Campaign');

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('heading', { name: 'Create New Campaign' })).not.toBeInTheDocument();

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
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('campaign creation', () => {
    it('POSTs the entered campaign name to the campaigns endpoint', async () => {
      const fetchSpy = stubFetch(httpResponse());
      await renderCampaigns();

      openCreateModal();
      fireEvent.change(nameInput(), { target: { value: 'Test Campaign' } });
      await act(async () => {
        submitCampaign();
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignName: 'Test Campaign' }),
        })
      );
    });

    it('shows a creating state while the POST is in flight', async () => {
      let resolveFetch;
      vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; })));
      await renderCampaigns();

      openCreateModal();
      fireEvent.change(nameInput(), { target: { value: 'New Campaign' } });
      await act(async () => {
        submitCampaign();
      });

      expect(screen.getByText('Creating campaign...')).toBeInTheDocument();
      expect(screen.queryByText(/successfully/)).not.toBeInTheDocument();

      await act(async () => {
        resolveFetch(httpResponse());
      });
      expect(screen.getByText(/Campaign created successfully/)).toBeInTheDocument();
    });

    it('shows success and reloads the page shortly after creation', async () => {
      const reloadSpy = stubReload();
      stubFetch(httpResponse());
      await renderCampaigns();

      // Capture timers only from this point on, so the component's reload
      // timer is the first long-delay timeout scheduled. The test then
      // fires the captured callback itself instead of waiting in real time.
      const originalSetTimeout = window.setTimeout.bind(window);
      const originalClearTimeout = window.clearTimeout.bind(window);
      const scheduled = [];
      vi.spyOn(window, 'setTimeout').mockImplementation((cb, ms) => {
        const id = originalSetTimeout(cb, ms);
        scheduled.push({ cb, ms, id });
        return id;
      });

      openCreateModal();
      fireEvent.change(nameInput(), { target: { value: 'New Campaign' } });
      await act(async () => {
        submitCampaign();
      });

      await waitFor(() => {
        expect(screen.getByText(/Campaign created successfully/)).toBeInTheDocument();
      });
      expect(screen.getByText(/Reloading.../)).toBeInTheDocument();
      // The success screen replaces the modal — the input is cleared with it.
      expect(screen.queryByPlaceholderText('Enter campaign name')).not.toBeInTheDocument();

      const reloadTimer = scheduled.find(({ ms }) => typeof ms === 'number' && ms >= 1000);
      expect(reloadTimer, 'expected a page reload to be scheduled after success').toBeDefined();
      originalClearTimeout(reloadTimer.id);
      act(() => reloadTimer.cb());
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
    it('loads the campaign characters and notifies the parent on click', async () => {
      const onSelect = vi.fn();
      getCharacterFiles.mockResolvedValue(['char1.json']);
      loadCharacters.mockResolvedValue([{ name: 'Character1' }]);

      await renderCampaigns({ onCampaignSelect: onSelect });
      await act(async () => {
        fireEvent.click(campaignButton('Campaign1'));
      });

      expect(getCharacterFiles).toHaveBeenCalledWith('Campaign1');
      expect(loadCharacters).toHaveBeenCalledWith('Campaign1', ['char1.json']);
      expect(onSelect).toHaveBeenCalledWith('Campaign1', [{ name: 'Character1' }]);
    });

    it('notifies the parent with an empty character list for a character-less campaign', async () => {
      const onSelect = vi.fn();
      getCharacterFiles.mockResolvedValue([]);
      loadCharacters.mockResolvedValue([]);

      await renderCampaigns({ folders: ['EmptyCampaign'], onCampaignSelect: onSelect });
      await act(async () => {
        fireEvent.click(campaignButton('EmptyCampaign'));
      });

      expect(onSelect).toHaveBeenCalledWith('EmptyCampaign', []);
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

    it('auto-selects the campaign named by autoSelectCampaign without a click', async () => {
      const onSelect = vi.fn();
      getCharacterFolders.mockResolvedValue(['Campaign1', 'Campaign2']);
      getCharacterFiles.mockResolvedValue(['char1.json']);
      loadCharacters.mockResolvedValue([{ name: 'Character1' }]);

      render(<CampaignSelection onCampaignSelect={onSelect} autoSelectCampaign="Campaign1" />);

      await waitFor(() => {
        expect(onSelect).toHaveBeenCalledWith('Campaign1', [{ name: 'Character1' }]);
      });
      expect(getCharacterFiles).toHaveBeenCalledWith('Campaign1');
    });

    it('auto-selects only once when re-rendered with the same prop', async () => {
      const onSelect = vi.fn();
      getCharacterFolders.mockResolvedValue(['Campaign1']);
      getCharacterFiles.mockResolvedValue([]);
      loadCharacters.mockResolvedValue([]);

      const { rerender } = render(
        <CampaignSelection onCampaignSelect={onSelect} autoSelectCampaign="Campaign1" />
      );
      await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));

      rerender(<CampaignSelection onCampaignSelect={onSelect} autoSelectCampaign="Campaign1" />);
      await act(async () => {});
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('does not auto-select when autoSelectCampaign is absent', async () => {
      const onSelect = vi.fn();

      await renderCampaigns({ onCampaignSelect: onSelect });

      expect(onSelect).not.toHaveBeenCalled();
      expect(getCharacterFiles).not.toHaveBeenCalled();
    });
  });

  describe('error recovery', () => {
    it('reloads the page when Reload Page is clicked in the error state', async () => {
      const reloadSpy = stubReload();
      getCharacterFolders.mockRejectedValue(new Error('Network error'));

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load campaigns/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Reload Page' }));

      expect(reloadSpy).toHaveBeenCalled();
    });
  });
});
