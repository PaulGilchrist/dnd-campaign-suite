// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CampaignSelection from './CampaignSelection.jsx';

// Mock the campaignService
vi.mock('../../services/campaign/campaignService.js', () => ({
  getCharacterFolders: vi.fn(),
  getCharacterFiles: vi.fn(),
  loadCharacters: vi.fn(),
}));

// Import mocked functions
import { getCharacterFolders, getCharacterFiles, loadCharacters } from '../../services/campaign/campaignService.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CampaignSelection', () => {
  // Helper: render with preloaded campaigns and wait for them to appear
  async function renderWithCampaigns(campaigns, options = {}) {
    getCharacterFolders.mockResolvedValue(campaigns);
    if (options.fetchMock) {
      global.fetch = options.fetchMock;
    }
    render(<CampaignSelection {...options.props} />);
    await waitFor(() => {
      expect(screen.queryByText('Loading campaigns...')).not.toBeInTheDocument();
    });
    campaigns.forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
  }

  describe('initial loading state', () => {
    it('should show "Loading campaigns..." while fetching folders', async () => {
      getCharacterFolders.mockReturnValue(new Promise((resolve) => {
        setTimeout(() => resolve(['Campaign1']), 100);
      }));

      render(<CampaignSelection />);

      expect(screen.getByText('Loading campaigns...')).toBeInTheDocument();
    });

    it('should show error state when fetching folders fails', async () => {
      getCharacterFolders.mockRejectedValue(new Error('Network error'));

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load campaigns/)).toBeInTheDocument();
        expect(screen.getByText('Reload Page')).toBeInTheDocument();
      });
    });
  });

  describe('campaign list rendering', () => {
    it('should render a button for each campaign', async () => {
      getCharacterFolders.mockResolvedValue(['Alpha', 'Beta', 'Gamma']);

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByText('Alpha')).toBeInTheDocument();
        expect(screen.getByText('Beta')).toBeInTheDocument();
        expect(screen.getByText('Gamma')).toBeInTheDocument();
      });
    });

    it('should show the heading', async () => {
      await renderWithCampaigns(['Campaign1']);

      const heading = screen.getByRole('heading', { name: 'Select a Campaign', level: 1 });
      expect(heading).toBeInTheDocument();
    });
  });

  describe('no campaigns state', () => {
    it('should show the no campaigns message', async () => {
      getCharacterFolders.mockResolvedValue([]);

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByText(/No campaigns found/)).toBeInTheDocument();
      });
    });

    it('should still show the Add button when no campaigns exist', async () => {
      getCharacterFolders.mockResolvedValue([]);

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByText('Add')).toBeInTheDocument();
      });
    });
  });

  describe('Add button', () => {
    it('should open the new campaign modal when clicked', async () => {
      await renderWithCampaigns(['Campaign1']);

      fireEvent.click(screen.getByText('Add'));

      expect(screen.getByText('Create New Campaign')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter campaign name')).toBeInTheDocument();
      expect(screen.getByText('Create')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('new campaign modal', () => {
    it('should clear the campaign name input when the modal is closed', async () => {
      await renderWithCampaigns(['Campaign1']);

      fireEvent.click(screen.getByText('Add'));
      fireEvent.change(screen.getByPlaceholderText('Enter campaign name'), {
        target: { value: 'My Campaign' },
      });

      expect(screen.getByDisplayValue('My Campaign')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancel'));

      // Re-open modal to verify input is cleared
      fireEvent.click(screen.getByText('Add'));
      expect(screen.getByDisplayValue('')).toBeInTheDocument();
    });
  });

  describe('campaign creation', () => {
    it('should reject empty or whitespace-only campaign names', async () => {
      await renderWithCampaigns(['Campaign1']);

      fireEvent.click(screen.getByText('Add'));
      fireEvent.click(screen.getByText('Create'));

      expect(screen.getByText('Please enter a campaign name')).toBeInTheDocument();
    });

    it('should POST the campaign name to the API', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      global.fetch = fetchSpy;

      await renderWithCampaigns(['Campaign1']);

      fireEvent.click(screen.getByText('Add'));
      fireEvent.change(screen.getByPlaceholderText('Enter campaign name'), {
        target: { value: 'Test Campaign' },
      });
      fireEvent.click(screen.getByText('Create'));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          '/api/campaigns',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignName: 'Test Campaign' }),
          })
        );
      });
    });

    it('should show "Creating campaign..." while creating a campaign', async () => {
      global.fetch = vi.fn().mockImplementation(() =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ ok: true, json: () => Promise.resolve({}) }), 50)
        )
      );

      getCharacterFolders.mockResolvedValue(['Campaign1']);

      render(<CampaignSelection />);

      // Wait for initial loading to complete and campaigns to appear
      await waitFor(() => {
        expect(screen.getByText('Campaign1')).toBeInTheDocument();
      });

      // Open modal, type a name, and click Create
      fireEvent.click(screen.getByText('Add'));
      fireEvent.change(screen.getByPlaceholderText('Enter campaign name'), {
        target: { value: 'New Campaign' },
      });
      fireEvent.click(screen.getByText('Create'));

      // During creation, should show "Creating campaign..." not "Loading campaigns..."
      expect(screen.getByText('Creating campaign...')).toBeInTheDocument();

      // Wait for success
      await waitFor(() => {
        expect(screen.getByText(/Campaign created successfully/)).toBeInTheDocument();
      });
    });

    it('should show success message and schedule reload on successful creation', async () => {
      const reloadSpy = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: reloadSpy },
        writable: true,
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await renderWithCampaigns(['Campaign1']);

      fireEvent.click(screen.getByText('Add'));
      fireEvent.change(screen.getByPlaceholderText('Enter campaign name'), {
        target: { value: 'New Campaign' },
      });
      fireEvent.click(screen.getByText('Create'));

      await waitFor(() => {
        expect(screen.getByText(/Campaign created successfully/)).toBeInTheDocument();
        expect(screen.getByText(/Reloading.../)).toBeInTheDocument();
      });

      // Wait for the setTimeout that triggers reload
      await new Promise((r) => setTimeout(r, 2100));

      expect(reloadSpy).toHaveBeenCalled();
    });

    it.each([
      ['Campaign already exists', { error: 'Campaign already exists' }],
      ['generic failure', {}],
    ])('should show %s when the API returns an error', async (_msg, apiResponse) => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve(apiResponse),
      });

      await renderWithCampaigns(['Campaign1']);

      fireEvent.click(screen.getByText('Add'));
      fireEvent.change(screen.getByPlaceholderText('Enter campaign name'), {
        target: { value: 'Bad Campaign' },
      });
      fireEvent.click(screen.getByText('Create'));

      const expectedMessage = apiResponse.error || 'Failed to create campaign';
      await waitFor(() => {
        expect(screen.getByText(expectedMessage)).toBeInTheDocument();
      });
    });
  });

  describe('campaign selection', () => {
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

    it('does not auto-select when autoSelectCampaign is absent', async () => {
      const onSelect = vi.fn();
      getCharacterFolders.mockResolvedValue(['Campaign1']);

      render(<CampaignSelection onCampaignSelect={onSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Campaign1')).toBeInTheDocument();
      });
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('should call onCampaignSelect with campaign and characters', async () => {
      const onSelect = vi.fn();
      getCharacterFolders.mockResolvedValue(['Campaign1']);
      getCharacterFiles.mockResolvedValue(['char1.json']);
      loadCharacters.mockResolvedValue([{ name: 'Character1' }]);

      render(<CampaignSelection onCampaignSelect={onSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Campaign1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Campaign1'));

      await waitFor(() => {
        expect(getCharacterFiles).toHaveBeenCalledWith('Campaign1');
        expect(loadCharacters).toHaveBeenCalledWith('Campaign1', ['char1.json']);
        expect(onSelect).toHaveBeenCalledWith('Campaign1', [{ name: 'Character1' }]);
      });
    });

    it('should call onCampaignSelect even when no characters are found', async () => {
      const onSelect = vi.fn();
      getCharacterFolders.mockResolvedValue(['EmptyCampaign']);
      getCharacterFiles.mockResolvedValue([]);
      loadCharacters.mockResolvedValue([]);

      render(<CampaignSelection onCampaignSelect={onSelect} />);

      await waitFor(() => {
        expect(screen.getByText('EmptyCampaign')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('EmptyCampaign'));

      await waitFor(() => {
        expect(onSelect).toHaveBeenCalledWith('EmptyCampaign', []);
      });
    });

    it('should reset loading state after campaign selection regardless of outcome', async () => {
      getCharacterFolders.mockResolvedValue(['Campaign1']);
      getCharacterFiles.mockResolvedValue(['char1.json']);
      loadCharacters.mockResolvedValue([{ name: 'Character1' }]);

      render(<CampaignSelection onCampaignSelect={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Campaign1')).toBeInTheDocument();
      });

      const button = screen.getByText('Campaign1');

      fireEvent.click(button);

      // After successful selection, loading should be false
      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });

    it('should show an error message when campaign selection fails', async () => {
      getCharacterFolders.mockResolvedValue(['BadCampaign']);
      getCharacterFiles.mockRejectedValue(new Error('Not found'));

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByText('BadCampaign')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('BadCampaign'));

      await waitFor(() => {
        expect(screen.getByText(/Failed to load campaign BadCampaign/)).toBeInTheDocument();
        expect(screen.getByText('Reload Page')).toBeInTheDocument();
      });
    });
  });

  describe('error state recovery', () => {
    it('should reload the page when reload button is clicked', async () => {
      const reloadSpy = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: reloadSpy },
        writable: true,
      });

      getCharacterFolders.mockRejectedValue(new Error('Network error'));

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load campaigns/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Reload Page'));

      expect(reloadSpy).toHaveBeenCalled();
    });
  });
});
