// @maintained-by-ai
// Seeded quick-create lane on campaign selection (arena-starter §2.3/§3.4):
// localhost-only Arena/Starter buttons next to the untouched plain Add, the
// modal pre-fills the dated default name, and Create routes through the
// shared orchestrator straight into the new campaign. LAN clients get none
// of it.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CampaignSelection from './CampaignSelection.jsx';
import { createSeededCampaign } from '../../services/campaign/seededCampaign.js';
import {
  getCharacterFolders,
  getCharacterFiles,
  loadCharacters,
} from '../../services/campaign/campaignService.js';

vi.mock('../../services/campaign/campaignService.js', () => ({
  getCharacterFolders: vi.fn(),
  getCharacterFiles: vi.fn(),
  loadCharacters: vi.fn(),
}));

vi.mock('../../services/campaign/seededCampaign.js', () => ({
  createSeededCampaign: vi.fn(),
}));

async function renderSelection(props = {}) {
  getCharacterFolders.mockResolvedValue(['Campaign1']);
  getCharacterFiles.mockResolvedValue([]);
  loadCharacters.mockResolvedValue([]);
  render(<CampaignSelection {...props} />);
  await waitFor(() => {
    expect(screen.queryByText('Loading campaigns...')).not.toBeInTheDocument();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('seeded quick-create buttons', () => {
  it('hides Arena/Starter from LAN clients', async () => {
    await renderSelection({ isLocalhost: false });
    expect(screen.queryByRole('button', { name: /New Arena Campaign/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New Starter Campaign/ })).not.toBeInTheDocument();
  });

  it('keeps the plain Add button untouched alongside the new entries', async () => {
    await renderSelection({ isLocalhost: true });
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Arena Campaign/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Starter Campaign/ })).toBeInTheDocument();
  });

  it('opens the arena modal with a dated default name and creates via the orchestrator', async () => {
    const onCampaignSelect = vi.fn();
    createSeededCampaign.mockResolvedValue({ name: 'Arena-20261102', seed: 1, seeded: {} });
    await renderSelection({ isLocalhost: true, onCampaignSelect });

    fireEvent.click(screen.getByRole('button', { name: /New Arena Campaign/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'New Arena Campaign' })).toBeInTheDocument();
    const expectedDefault = `Arena-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    expect(screen.getByPlaceholderText('Enter campaign name')).toHaveValue(expectedDefault);

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(createSeededCampaign).toHaveBeenCalledWith('arena', { name: expectedDefault }));
    await waitFor(() => expect(onCampaignSelect).toHaveBeenCalledWith('Arena-20261102', []));
    expect(screen.queryByRole('heading', { level: 2, name: 'New Arena Campaign' })).not.toBeInTheDocument();
  });

  it('routes the starter preset and surfaces the server lock error text', async () => {
    createSeededCampaign.mockRejectedValue(new Error('Campaign creation is locked'));
    await renderSelection({ isLocalhost: true });

    fireEvent.click(screen.getByRole('button', { name: /New Starter Campaign/ }));
    fireEvent.change(screen.getByPlaceholderText('Enter campaign name'), { target: { value: 'qa-starter' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(createSeededCampaign).toHaveBeenCalledWith('starter', { name: 'qa-starter' }));
    await waitFor(() => expect(screen.getByText('Campaign creation is locked')).toBeInTheDocument());
  });
});
