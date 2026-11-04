// @maintained-by-ai
// One-modal-at-a-time invariant on the campaign-selection screen (2026-11-03
// QA backlog): the New Campaign + Arena/Starter seed modals each own a
// full-viewport .modal-overlay, and a stacked pair silently intercepts every
// click on the buried one. While any modal is open the sibling quick-create
// buttons render disabled, programmatic activation cannot stack a second
// overlay, and Cancel restores all buttons with zero lingering overlays.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CampaignSelection from './CampaignSelection.jsx';

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
vi.mock('../../services/campaign/seededCampaign.js', () => ({
  createSeededCampaign: vi.fn(),
}));

import { getCharacterFolders } from '../../services/campaign/campaignService.js';

const newCampaignBtn = () => screen.getByRole('button', { name: /New Campaign/ });
const arenaBtn = () => screen.getByRole('button', { name: /New Arena Battle/ });
const starterBtn = () => screen.getByRole('button', { name: /New Starter Adventure/ });
const overlays = (container) => container.querySelectorAll('.modal-overlay');

async function renderSelection() {
  getCharacterFolders.mockResolvedValue(['Campaign1']);
  const view = render(<CampaignSelection isLocalhost />);
  await waitFor(() => {
    expect(screen.queryByText('Loading campaigns...')).not.toBeInTheDocument();
  });
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('quick-create buttons yield to an open modal', () => {
  it('disables the sibling create buttons while a seed modal is open (exactly one overlay)', async () => {
    await renderSelection();

    fireEvent.click(arenaBtn());
    expect(screen.getByRole('heading', { level: 2, name: 'New Arena Battle' })).toBeInTheDocument();
    expect(starterBtn()).toBeDisabled();
    expect(newCampaignBtn()).toBeDisabled();
    // The modal's own controls stay reachable.
    expect(screen.getByPlaceholderText('Enter campaign name')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(overlays(document)).toHaveLength(1);
  });

  it('a disabled sibling click cannot stack a second .modal-overlay', async () => {
    await renderSelection();

    fireEvent.click(arenaBtn());
    fireEvent.click(starterBtn());
    fireEvent.click(newCampaignBtn());

    expect(overlays(document)).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2, name: 'New Arena Battle' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'New Starter Adventure' })).not.toBeInTheDocument();
  });

  it('disables both seed buttons while the standard New Campaign modal is open', async () => {
    await renderSelection();

    fireEvent.click(newCampaignBtn());
    expect(screen.getByRole('heading', { level: 2, name: 'New Campaign' })).toBeInTheDocument();
    expect(arenaBtn()).toBeDisabled();
    expect(starterBtn()).toBeDisabled();
    expect(overlays(document)).toHaveLength(1);
  });

  it('Cancel re-enables every quick-create button and leaves zero overlays', async () => {
    await renderSelection();

    fireEvent.click(starterBtn());
    expect(overlays(document)).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(overlays(document)).toHaveLength(0);
    expect(newCampaignBtn()).toBeEnabled();
    expect(arenaBtn()).toBeEnabled();
    expect(starterBtn()).toBeEnabled();
  });

  it('a seed modal reopens clickably after a previous one was cancelled', async () => {
    await renderSelection();

    fireEvent.click(arenaBtn());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(starterBtn());

    expect(screen.getByRole('heading', { level: 2, name: 'New Starter Adventure' })).toBeInTheDocument();
    expect(overlays(document)).toHaveLength(1);
  });
});
