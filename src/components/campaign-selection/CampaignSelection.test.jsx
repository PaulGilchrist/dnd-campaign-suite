// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignSelection from './CampaignSelection.jsx';

// Mock the campaignService
vi.mock('../../services/campaign/campaignService.js', () => ({
  getCharacterFolders: vi.fn(),
  getCharacterFiles: vi.fn(),
  loadCharacters: vi.fn(),
}));

// Import mocked functions
import { getCharacterFolders, getCharacterFiles, loadCharacters } from '../../services/campaign/campaignService.js';

describe('CampaignSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper: render with preloaded campaigns and wait for them to appear
  async function renderWithCampaigns(campaigns, options = {}) {
    getCharacterFolders.mockResolvedValue(campaigns);
    if (options.fetchMock) {
      global.fetch = options.fetchMock;
    }
    render(<CampaignSelection {...options.props} />);
    await waitFor(() => {
      campaigns.forEach((name) => {
        expect(screen.getByText(name)).toBeInTheDocument();
      });
    });
  }

  describe('initial loading state', () => {
    it('should show loading message when campaigns have not loaded yet', async () => {
      getCharacterFolders.mockReturnValue(new Promise((resolve) => {
        setTimeout(() => resolve(['Campaign1']), 100);
      }));

      render(<CampaignSelection />);

      expect(screen.getByText('Loading campaigns...')).toBeInTheDocument();
    });

    it('should not show campaign list while loading', async () => {
      getCharacterFolders.mockReturnValue(new Promise((resolve) => {
        setTimeout(() => resolve(['Campaign1']), 100);
      }));

      render(<CampaignSelection />);

      expect(screen.queryByText('Campaign1')).not.toBeInTheDocument();
      expect(screen.queryByText('Select a Campaign')).not.toBeInTheDocument();
    });
  });

  describe('campaign list display', () => {
    it('should display all loaded campaigns', async () => {
      getCharacterFolders.mockResolvedValue(['Campaign1', 'Campaign2', 'Campaign3']);

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByText('Campaign1')).toBeInTheDocument();
        expect(screen.getByText('Campaign2')).toBeInTheDocument();
        expect(screen.getByText('Campaign3')).toBeInTheDocument();
      });
    });

    it('should show the page heading when campaigns are loaded', async () => {
      getCharacterFolders.mockResolvedValue(['My Campaign']);

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Select a Campaign' })).toBeInTheDocument();
      });
    });

    it('should render a button for each campaign', async () => {
      getCharacterFolders.mockResolvedValue(['D&D Campaign', 'Pathfinder Group']);

      render(<CampaignSelection />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button', { name: /D&D Campaign|Pathfinder Group/ });
        expect(buttons).toHaveLength(2);
      });
    });

    it('should show no campaigns message when the list is empty', async () => {
      getCharacterFolders.mockResolvedValue([]);

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByText(/No campaigns found/)).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('should show error message when fetching campaigns fails', async () => {
      getCharacterFolders.mockRejectedValue(new Error('Network error'));

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load campaigns/)).toBeInTheDocument();
      });
    });

    it('should show a reload button when an error occurs', async () => {
      getCharacterFolders.mockRejectedValue(new Error('Network error'));

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByText('Reload Page')).toBeInTheDocument();
      });
    });

    it('should show campaign-specific error when selecting a campaign fails', async () => {
      getCharacterFolders.mockResolvedValue(['Bad Campaign']);
      getCharacterFiles.mockRejectedValue(new Error('File not found'));

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByText('Bad Campaign')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Bad Campaign'));
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to load campaign Bad Campaign/)).toBeInTheDocument();
      });
    });
  });

  describe('new campaign modal', () => {
    it('should show the Add button regardless of campaign count', async () => {
      getCharacterFolders.mockResolvedValue(['Campaign1']);

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByText('Add')).toBeInTheDocument();
      });
    });

    it('should open the create campaign modal when Add is clicked', async () => {
      await renderWithCampaigns(['Campaign1']);

      await act(async () => {
        fireEvent.click(screen.getByText('Add'));
      });

      expect(screen.getByText('Create New Campaign')).toBeInTheDocument();
    });

    it('should display an input for entering the campaign name', async () => {
      await renderWithCampaigns(['Campaign1']);

      await act(async () => {
        fireEvent.click(screen.getByText('Add'));
      });

      expect(screen.getByPlaceholderText('Enter campaign name')).toBeInTheDocument();
    });

    it('should show an error when creating a campaign with an empty or whitespace-only name', async () => {
      await renderWithCampaigns(['Campaign1']);

      await act(async () => {
        fireEvent.click(screen.getByText('Add'));
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Create'));
      });

      expect(screen.getByText('Please enter a campaign name')).toBeInTheDocument();
    });

    it('should clear the input when Cancel is clicked', async () => {
      await renderWithCampaigns([]);

      await act(async () => {
        fireEvent.click(screen.getByText('Add'));
      });

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText('Enter campaign name'), {
          target: { value: 'My Campaign' },
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Cancel'));
      });

      expect(screen.queryByText('Create New Campaign')).not.toBeInTheDocument();
    });

    it('should call fetch with the correct endpoint and payload when creating a campaign', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await renderWithCampaigns(['Campaign1'], { fetchMock });

      await act(async () => {
        fireEvent.click(screen.getByText('Add'));
      });

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText('Enter campaign name'), {
          target: { value: 'Test Campaign' },
        });
        fireEvent.click(screen.getByText('Create'));
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignName: 'Test Campaign' }),
        });
      });
    });

    it('should show a success message after creating a campaign', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await renderWithCampaigns(['Campaign1']);

      await act(async () => {
        fireEvent.click(screen.getByText('Add'));
      });

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText('Enter campaign name'), {
          target: { value: 'New Campaign' },
        });
        fireEvent.click(screen.getByText('Create'));
      });

      await waitFor(() => {
        expect(screen.getByText(/Campaign created successfully/)).toBeInTheDocument();
      });
    });

    it('should clear the error and close the modal after successful campaign creation', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await renderWithCampaigns(['Campaign1']);

      await act(async () => {
        fireEvent.click(screen.getByText('Add'));
      });

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText('Enter campaign name'), {
          target: { value: 'New Campaign' },
        });
        fireEvent.click(screen.getByText('Create'));
      });

      await waitFor(() => {
        expect(screen.queryByText('Create New Campaign')).not.toBeInTheDocument();
        expect(screen.queryByText('Please enter a campaign name')).not.toBeInTheDocument();
      });
    });

    it('should show an error when the API returns an error response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Campaign already exists' }),
      });

      await renderWithCampaigns(['Campaign1']);

      await act(async () => {
        fireEvent.click(screen.getByText('Add'));
      });

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText('Enter campaign name'), {
          target: { value: 'Existing Campaign' },
        });
        fireEvent.click(screen.getByText('Create'));
      });

      await waitFor(() => {
        expect(screen.getByText('Campaign already exists')).toBeInTheDocument();
      });
    });

    it('should show a generic error when the API returns an error without a message', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await renderWithCampaigns(['Campaign1']);

      await act(async () => {
        fireEvent.click(screen.getByText('Add'));
      });

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText('Enter campaign name'), {
          target: { value: 'New Campaign' },
        });
        fireEvent.click(screen.getByText('Create'));
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to create campaign')).toBeInTheDocument();
      });
    });

    it('should show a fetch network error when creating a campaign', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      await renderWithCampaigns(['Campaign1']);

      await act(async () => {
        fireEvent.click(screen.getByText('Add'));
      });

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText('Enter campaign name'), {
          target: { value: 'New Campaign' },
        });
        fireEvent.click(screen.getByText('Create'));
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
      });
    });
  });

  describe('campaign selection', () => {
    it('should call onCampaignSelect with the campaign name and characters when a campaign is selected', async () => {
      const mockOnCampaignSelect = vi.fn();
      getCharacterFolders.mockResolvedValue(['Campaign1']);
      getCharacterFiles.mockResolvedValue(['char1.json']);
      loadCharacters.mockResolvedValue([{ name: 'Character1', class: 'Fighter' }]);

      render(<CampaignSelection onCampaignSelect={mockOnCampaignSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Campaign1')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Campaign1'));
      });

      await waitFor(() => {
        expect(mockOnCampaignSelect).toHaveBeenCalledWith('Campaign1', [{ name: 'Character1', class: 'Fighter' }]);
      });
    });

    it('should call getCharacterFiles and loadCharacters when a campaign is selected', async () => {
      getCharacterFolders.mockResolvedValue(['Campaign1']);
      getCharacterFiles.mockResolvedValue(['char1.json', 'char2.json']);
      loadCharacters.mockResolvedValue([{ name: 'Char1' }, { name: 'Char2' }]);

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByText('Campaign1')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Campaign1'));
      });

      await waitFor(() => {
        expect(getCharacterFiles).toHaveBeenCalledWith('Campaign1');
        expect(loadCharacters).toHaveBeenCalledWith('Campaign1', ['char1.json', 'char2.json']);
      });
    });

    it('should show loading overlay while loading characters for a campaign', async () => {
      getCharacterFolders.mockResolvedValue(['Campaign1']);
      getCharacterFiles.mockReturnValue(new Promise((resolve) => {
        setTimeout(() => resolve(['char1.json']), 100);
      }));

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByText('Campaign1')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Campaign1'));
      });

      expect(screen.getByText('Creating campaign...')).toBeInTheDocument();
    });

    it('should clear loading state after campaign selection succeeds', async () => {
      getCharacterFolders.mockResolvedValue(['Campaign1']);
      getCharacterFiles.mockResolvedValue(['char1.json']);
      loadCharacters.mockResolvedValue([{ name: 'Character1' }]);

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByText('Campaign1')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Campaign1'));
      });

      await waitFor(() => {
        expect(screen.queryByText('Creating campaign...')).not.toBeInTheDocument();
        expect(screen.getByText('Campaign1')).toBeInTheDocument();
      });
    });

    it('should clear loading state after campaign selection fails', async () => {
      getCharacterFolders.mockResolvedValue(['Bad Campaign']);
      getCharacterFiles.mockRejectedValue(new Error('File not found'));

      render(<CampaignSelection />);

      await waitFor(() => {
        expect(screen.getByText('Bad Campaign')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Bad Campaign'));
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to load campaign Bad Campaign/)).toBeInTheDocument();
        expect(screen.queryByText('Creating campaign...')).not.toBeInTheDocument();
      });
    });

    it('should call onCampaignSelect with empty characters when no character files exist', async () => {
      const mockOnCampaignSelect = vi.fn();
      getCharacterFolders.mockResolvedValue(['Campaign1']);
      getCharacterFiles.mockResolvedValue([]);
      loadCharacters.mockResolvedValue([]);

      render(<CampaignSelection onCampaignSelect={mockOnCampaignSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Campaign1')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Campaign1'));
      });

      await waitFor(() => {
        expect(mockOnCampaignSelect).toHaveBeenCalledWith('Campaign1', []);
      });
    });

    it('should call onCampaignSelect with multiple characters', async () => {
      const mockOnCampaignSelect = vi.fn();
      getCharacterFolders.mockResolvedValue(['Campaign1']);
      getCharacterFiles.mockResolvedValue(['char1.json', 'char2.json', 'char3.json']);
      loadCharacters.mockResolvedValue([
        { name: 'Character1', class: 'Fighter' },
        { name: 'Character2', class: 'Wizard' },
        { name: 'Character3', class: 'Rogue' },
      ]);

      render(<CampaignSelection onCampaignSelect={mockOnCampaignSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Campaign1')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Campaign1'));
      });

      await waitFor(() => {
        expect(mockOnCampaignSelect).toHaveBeenCalledWith(
          'Campaign1',
          [
            { name: 'Character1', class: 'Fighter' },
            { name: 'Character2', class: 'Wizard' },
            { name: 'Character3', class: 'Rogue' },
          ]
        );
      });
    });
  });
});
