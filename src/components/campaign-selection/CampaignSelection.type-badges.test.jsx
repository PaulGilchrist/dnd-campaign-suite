// @maintained-by-ai
// Type badges on the campaign list (campaign-meta lane): Arena/Starter rows
// are visually distinct BEFORE opening, standard rows stay unbadged. Service
// lane itself is covered by campaigns-meta.test.js + campaignService reads.
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CampaignSelection from './CampaignSelection.jsx';
import { getCharacterFolders } from '../../services/campaign/campaignService.js';
import { getCampaignTypes } from '../../services/campaign/campaignMetaService.js';

vi.mock('../../services/campaign/campaignService.js', () => ({
  getCharacterFolders: vi.fn(),
  getCharacterFiles: vi.fn(async () => []),
  loadCharacters: vi.fn(async () => []),
}));

vi.mock('../../services/campaign/campaignMetaService.js', () => ({
  getCampaignTypes: vi.fn(async () => ({})),
  CAMPAIGN_TYPE_BADGES: {
    arena: { label: 'Arena Battle', icon: 'fa-solid fa-shield-halved', cls: 'arena' },
    starter: { label: 'Starter Adventure', icon: 'fa-solid fa-seedling', cls: 'starter' },
  },
}));

async function renderSelection(types) {
  getCharacterFolders.mockResolvedValue(['qa-arena', 'qa-starter', 'Frostfall']);
  getCampaignTypes.mockResolvedValue(types);
  const result = render(<CampaignSelection isLocalhost={false} />);
  await waitFor(() => {
    expect(screen.queryByText('Loading campaigns...')).not.toBeInTheDocument();
  });
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('campaign list type badges', () => {
  it('badges arena and starter rows and leaves standard rows bare', async () => {
    const { container } = await renderSelection({ 'qa-arena': 'arena', 'qa-starter': 'starter' });

    // Accessible name concatenates the row label + badge without a space.
    expect(screen.getByRole('button', { name: /qa-arena\s*Arena Battle/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /qa-starter\s*Starter Adventure/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Frostfall' })).toBeInTheDocument();

    expect(container.querySelector('.campaign-button--arena .campaign-type-badge--arena')).toHaveTextContent('Arena Battle');
    expect(container.querySelector('.campaign-button--starter .campaign-type-badge--starter')).toHaveTextContent('Starter Adventure');
    expect(container.querySelector('.campaign-button--standard')).not.toBeInTheDocument();
    expect(container.querySelector('.campaign-type-badge--standard')).not.toBeInTheDocument();
  });

  it('renders every row unbadged when the type map is empty (read failure default)', async () => {
    const { container } = await renderSelection({});
    expect(container.querySelectorAll('.campaign-type-badge')).toHaveLength(0);
  });
});
