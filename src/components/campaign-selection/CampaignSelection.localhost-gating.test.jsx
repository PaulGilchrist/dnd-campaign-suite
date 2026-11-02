// @maintained-by-ai
// Campaign creation is a GM (localhost-only) affordance. App.jsx threads the
// isLocalhost flag computed by useCampaignManagement into CampaignSelection;
// these tests lock both branches: network (LAN) players never see "New
// Campaign" or its create modal, localhost behavior is unchanged.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignSelection from './CampaignSelection.jsx';

vi.mock('../../services/campaign/campaignService.js', () => ({
  getCharacterFolders: vi.fn(),
  getCharacterFiles: vi.fn(),
  loadCharacters: vi.fn(),
}));
// The component lives-refreshes via the ONE shared SSE client (app-level
// channel); stub it so these tests never touch EventSource — afterEach's
// unstubAllGlobals removes the inert one setup.js installs.
vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: vi.fn(() => () => {}),
}));

import { getCharacterFolders } from '../../services/campaign/campaignService.js';

async function renderCampaigns(props = {}) {
  getCharacterFolders.mockResolvedValue(['Campaign1']);
  render(<CampaignSelection {...props} />);
  await waitFor(() => {
    expect(screen.queryByText('Loading campaigns...')).not.toBeInTheDocument();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('CampaignSelection localhost gating', () => {
  it('hides the New Campaign button and the create modal for non-localhost (LAN) clients', async () => {
    await renderCampaigns({ isLocalhost: false });

    // Campaign list still renders for players.
    expect(screen.getByRole('button', { name: 'Campaign1' })).toBeInTheDocument();

    // The GM-only creation affordance is absent from the DOM entirely.
    expect(document.querySelector('.new-campaign-button')).toBeNull();
    expect(screen.queryByRole('button', { name: 'New Campaign' })).not.toBeInTheDocument();
    expect(document.querySelector('.modal-overlay')).toBeNull();
    expect(screen.queryByText('New Campaign')).not.toBeInTheDocument();
  });

  it('renders New Campaign, opens its create modal, and closes it on Cancel for localhost', async () => {
    await renderCampaigns({ isLocalhost: true });

    const addButton = screen.getByRole('button', { name: 'New Campaign' });
    expect(addButton).toBeInTheDocument();
    expect(document.querySelector('.new-campaign-button')).toBe(addButton);

    fireEvent.click(addButton);
    expect(screen.getByRole('heading', { level: 2, name: 'New Campaign' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter campaign name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'New Campaign' })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Enter campaign name')).not.toBeInTheDocument();
  });

  it('defaults to localhost visibility when the prop is omitted (existing callers unchanged)', async () => {
    await renderCampaigns();

    expect(screen.getByRole('button', { name: 'New Campaign' })).toBeInTheDocument();
  });
});
