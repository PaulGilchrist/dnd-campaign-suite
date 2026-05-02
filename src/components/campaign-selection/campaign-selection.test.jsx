import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignSelection from './campaign-selection';

// Mock the campaignService
vi.mock('../../services/campaignService', () => ({
  getCharacterFolders: vi.fn(),
  getCharacterFiles: vi.fn(),
  loadCharacters: vi.fn(),
}));

// Import mocked functions
import { getCharacterFolders, getCharacterFiles, loadCharacters } from '../../services/campaignService';

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
});

// Mock window.location.reload
const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

describe('CampaignSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show loading state initially', async () => {
    getCharacterFolders.mockReturnValue(new Promise((resolve) => {
      setTimeout(() => resolve(['Campaign1']), 100);
    }));

    render(<CampaignSelection />);
    
    expect(screen.getByText('Loading campaigns...')).toBeInTheDocument();
  });

  it('should display campaigns after loading', async () => {
    getCharacterFolders.mockResolvedValue(['Campaign1', 'Campaign2']);

    render(<CampaignSelection />);

    await waitFor(() => {
      expect(screen.getByText('Campaign1')).toBeInTheDocument();
      expect(screen.getByText('Campaign2')).toBeInTheDocument();
   });
    });

  it('should show error message when fetch fails', async () => {
    getCharacterFolders.mockRejectedValue(new Error('Network error'));

    render(<CampaignSelection />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load campaigns/)).toBeInTheDocument();
   });
    });

  it('should show reload button on error', async () => {
    getCharacterFolders.mockRejectedValue(new Error('Network error'));

    render(<CampaignSelection />);

    await waitFor(() => {
      expect(screen.getByText('Reload Page')).toBeInTheDocument();
   });
    });

  it('should call reload when reload button is clicked', async () => {
    getCharacterFolders.mockRejectedValue(new Error('Network error'));

    render(<CampaignSelection />);

    await waitFor(() => {
      const reloadButton = screen.getByText('Reload Page');
      fireEvent.click(reloadButton);
      expect(mockReload).toHaveBeenCalled();
   });
    });

  it('should show no campaigns message when list is empty', async () => {
    getCharacterFolders.mockResolvedValue([]);

    render(<CampaignSelection />);

    await waitFor(() => {
      expect(screen.getByText(/No campaigns found/)).toBeInTheDocument();
   });
    });

  it('should show Add button to create new campaign', async () => {
    getCharacterFolders.mockResolvedValue(['Campaign1']);

    render(<CampaignSelection />);

    await waitFor(() => {
      expect(screen.getByText('Add')).toBeInTheDocument();
   });
    });

  it('should open modal when Add button is clicked', async () => {
    getCharacterFolders.mockResolvedValue(['Campaign1']);

    render(<CampaignSelection />);

    await waitFor(() => {
      const addButton = screen.getByText('Add');
      fireEvent.click(addButton);
      expect(screen.getByText('Create New Campaign')).toBeInTheDocument();
   });
    });

  it('should show campaign selection buttons', async () => {
    getCharacterFolders.mockResolvedValue(['My Campaign']);

    render(<CampaignSelection />);

    await waitFor(() => {
      const campaignButtons = screen.getAllByRole('button', { name: /My Campaign/ });
      expect(campaignButtons.length).toBeGreaterThan(0);
   });
    });

  it('should call onCampaignSelect when a campaign is selected', async () => {
    const mockOnCampaignSelect = vi.fn();
    getCharacterFolders.mockResolvedValue(['Campaign1']);
    getCharacterFiles.mockResolvedValue(['char1.json']);
    loadCharacters.mockResolvedValue([{ name: 'Character1' }]);

    render(<CampaignSelection onCampaignSelect={mockOnCampaignSelect} />);

    await waitFor(() => {
      const campaignButton = screen.getByText('Campaign1');
      fireEvent.click(campaignButton);
    });

    await waitFor(() => {
      expect(mockOnCampaignSelect).toHaveBeenCalledWith('Campaign1', [{ name: 'Character1' }]);
   });
    });

  it('should store campaign in sessionStorage when selected', async () => {
    getCharacterFolders.mockResolvedValue(['Campaign1']);
    getCharacterFiles.mockResolvedValue(['char1.json']);
    loadCharacters.mockResolvedValue([{ name: 'Character1' }]);

    render(<CampaignSelection />);

    await waitFor(() => {
      const campaignButton = screen.getByText('Campaign1');
      fireEvent.click(campaignButton);
    });

    await waitFor(() => {
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('currentCampaign', 'Campaign1');
   });
    });

  it('should open modal and allow entering campaign name', async () => {
    getCharacterFolders.mockResolvedValue([]);

    render(<CampaignSelection />);

    await waitFor(() => {
      const addButton = screen.getByText('Add');
      fireEvent.click(addButton);
      
      const input = screen.getByPlaceholderText('Enter campaign name');
      fireEvent.change(input, { target: { value: 'New Campaign' } });
      
      expect(input.value).toBe('New Campaign');
   });
    });

  it('should show error when creating campaign with empty name', async () => {
    getCharacterFolders.mockResolvedValue([]);

    render(<CampaignSelection />);

    await waitFor(() => {
      const addButton = screen.getByText('Add');
      fireEvent.click(addButton);
      
      const createButton = screen.getByText('Create');
      fireEvent.click(createButton);
      
      expect(screen.getByText('Please enter a campaign name')).toBeInTheDocument();
   });
    });

  it('should close modal when Cancel button is clicked', async () => {
    getCharacterFolders.mockResolvedValue([]);

    render(<CampaignSelection />);

    await waitFor(() => {
      const addButton = screen.getByText('Add');
      fireEvent.click(addButton);
      
      expect(screen.getByText('Create New Campaign')).toBeInTheDocument();
      
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      expect(screen.queryByText('Create New Campaign')).not.toBeInTheDocument();
   });
    });

  it('should show loading state when creating campaign', async () => {
    getCharacterFolders.mockResolvedValue(['Campaign1']);
    
    // Mock fetch for campaign creation
    global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({}),
        });

    render(<CampaignSelection />);

     // Wait for campaigns to load
    await waitFor(() => {
      expect(screen.getByText('Campaign1')).toBeInTheDocument();
       });

     // Now click Add button
      const addButton = screen.getByText('Add');
      fireEvent.click(addButton);
      
      const input = screen.getByPlaceholderText('Enter campaign name');
      fireEvent.change(input, { target: { value: 'New Campaign' } });
      
      const createButton = screen.getByText('Create');
      fireEvent.click(createButton);
      
      expect(screen.getByText('Creating campaign...')).toBeInTheDocument();
    });
  });
