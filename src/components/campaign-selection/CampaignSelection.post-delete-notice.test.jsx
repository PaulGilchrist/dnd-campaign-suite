// @maintained-by-ai
/**
 * Post-delete success notice on the campaign-selection page (backlog
 * CP 2026-11-04): CampaignAdmin's typed-name delete stores a one-shot
 * sessionStorage 'postDeleteNotice' before its full page reload (the old
 * native success alert was retired by bfdd2e7ef, leaving the vanished row as
 * the only signal). OWNED here: the CONSUMER seam — notice renders naming the
 * deleted campaign, the transport is single-use (removed on consumption so a
 * later visit shows nothing), and the toast auto-hides. The producer side is
 * pinned in campaign-admin/CampaignAdmin.delete.test.jsx; the modal's
 * mismatch/cancel chrome stays pinned there too.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CampaignSelection from './CampaignSelection.jsx';

// Harness mirrors CampaignSelection.test.jsx — the component loads folders/
// types through these services and lives-refreshes via the shared SSE client.
vi.mock('../../services/campaign/campaignService.js', () => ({
  getCharacterFolders: vi.fn(),
  getCharacterFiles: vi.fn(async () => []),
  loadCharacters: vi.fn(async () => []),
}));
vi.mock('../../services/campaign/campaignMetaService.js', () => ({
  getCampaignTypes: vi.fn(async () => ({})),
  CAMPAIGN_TYPE_BADGES: {},
}));
vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: vi.fn(() => () => {}),
}));

import { getCharacterFolders } from '../../services/campaign/campaignService.js';

const NOTICE_COPY = 'qa-arena deleted successfully.';

async function renderSelection() {
  getCharacterFolders.mockResolvedValue(['test-campaign', 'Frostfall']);
  const result = render(<CampaignSelection isLocalhost={false} />);
  await waitFor(() => {
    expect(screen.queryByText('Loading campaigns...')).not.toBeInTheDocument();
  });
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('post-delete success notice (sessionStorage postDeleteNotice)', () => {
  it('names the deleted campaign in a status notice when the transport is armed', async () => {
    sessionStorage.setItem('postDeleteNotice', JSON.stringify({ campaign: 'qa-arena' }));
    const { container } = await renderSelection();

    const notice = container.querySelector('.success-message[role="status"]');
    expect(notice).toHaveTextContent(NOTICE_COPY);
    // Transport is consumed: the key never outlives the render it fed.
    expect(sessionStorage.getItem('postDeleteNotice')).toBeNull();
  });

  it('renders no notice on a normal visit (no transport armed)', async () => {
    const { container } = await renderSelection();

    expect(container.querySelector('[role="status"]')).not.toBeInTheDocument();
    expect(screen.queryByText(NOTICE_COPY)).not.toBeInTheDocument();
  });

  it('does not re-appear on a later visit — single storage read across remounts', async () => {
    sessionStorage.setItem('postDeleteNotice', JSON.stringify({ campaign: 'qa-arena' }));
    const first = await renderSelection();
    expect(first.container.querySelector('.success-message[role="status"]')).toBeInTheDocument();
    first.unmount();

    const second = await renderSelection();
    expect(second.container.querySelector('[role="status"]')).not.toBeInTheDocument();
  });

  it('auto-hides after the ephemeral-toast window (display-only timer)', async () => {
    sessionStorage.setItem('postDeleteNotice', JSON.stringify({ campaign: 'qa-arena' }));
    const { container } = await renderSelection();
    expect(container.querySelector('.success-message[role="status"]')).toHaveTextContent(NOTICE_COPY);

    // Real-timer lane: useEphemeralToast(4000) drops the notice at 4 s.
    await waitFor(() => {
      expect(container.querySelector('.success-message[role="status"]')).not.toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('a corrupt notice is swept without rendering or crashing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sessionStorage.setItem('postDeleteNotice', '{not json');
    const { container } = await renderSelection();

    expect(container.querySelector('[role="status"]')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('postDeleteNotice')).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to consume post-delete notice:',
      expect.any(Error)
    );
    errorSpy.mockRestore();
  });
});
