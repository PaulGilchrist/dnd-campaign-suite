// @maintained-by-ai
// Lane: focus restoration after a seeded create attempt (backlog SS
// 2026-11-22). The seeded quick-create modals flip `disabled={seeding}` on
// BOTH footer buttons, so the clicked Create sheds activeElement to BODY
// mid-create and nothing used to refocus it: after a refusal the buttons
// re-enabled with focus stranded at the document root. OWNED here: the
// seeding true→false transition (modal still open) restores focus to the
// name input — and ONLY that edge (no mid-create focus theft while still
// seeding). The Escape window-rescue lane and backdrop/Cancel dismissal
// stay pinned by CampaignSelection.create-modal-dismiss.test.jsx.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
// Keep the real localDateStamp/prefill helpers; mock only the orchestrator
// that POSTs to the server (same seam as the dismiss-lane tests).
vi.mock('../../services/campaign/seededCampaign.js', async (importOriginal) => ({
  ...(await importOriginal()),
  createSeededCampaign: vi.fn(),
}));

import { getCharacterFolders } from '../../services/campaign/campaignService.js';
import { createSeededCampaign } from '../../services/campaign/seededCampaign.js';

const arenaBtn = () => screen.getByRole('button', { name: /New Arena Battle/ });
const nameInput = () => screen.getByPlaceholderText('Enter campaign name');
const createBtn = () => screen.getByRole('button', { name: 'Create' });
const cancelBtn = () => screen.getByRole('button', { name: 'Cancel' });

async function renderSelection() {
  getCharacterFolders.mockResolvedValue(['Campaign1']);
  const view = render(<CampaignSelection isLocalhost />);
  await waitFor(() => {
    expect(screen.queryByText('Loading campaigns...')).not.toBeInTheDocument();
  });
  return view;
}

// The /api/server-config mount fetch is answered inline-unlocked (same stub
// shape as the dismiss-lane tests) so nothing else competes for focus.
function stubConfigAwareFetch() {
  vi.stubGlobal('fetch', (url) =>
    (String(url).includes('/api/server-config')
      ? Promise.resolve({ ok: true, status: 200, json: async () => ({ campaignLocked: false }) })
      : Promise.resolve({ ok: true, status: 200, json: async () => ({}) })));
}

beforeEach(() => {
  vi.clearAllMocks();
  stubConfigAwareFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a refused seeded create restores focus to the name input', () => {
  it('seeding true→false with the modal still open refocuses the input (zero key presses)', async () => {
    // Manual settle (not mockRejectedValue): the refusal must land strictly
    // AFTER the simulated mid-create focus drop to BODY below, or the effect
    // fires first and the blur would undo the restored focus (flaky race).
    let refuseSeed;
    createSeededCampaign.mockReturnValue(
      new Promise((_resolve, reject) => { refuseSeed = reject; })
    );
    await renderSelection();
    fireEvent.click(arenaBtn());
    const input = nameInput();
    input.focus();
    fireEvent.change(input, { target: { value: 'Typed Name' } });
    fireEvent.click(createBtn());

    // Mid-create browser face: creating both buttons disabled sheds
    // activeElement to BODY (jsdom does not auto-drop it on click).
    await waitFor(() => expect(cancelBtn()).toBeDisabled());
    input.blur();
    expect(document.activeElement).toBe(document.body);

    // The seeding pass ends with the modal still open...
    refuseSeed(new Error('Campaign creation is locked to: test-campaign, qa-arena, qa-starter'));
    await waitFor(() => expect(cancelBtn()).toBeEnabled());
    expect(document.activeElement).toBe(input);

    // ...and the refusal face is otherwise unchanged.
    expect(input.value).toBe('Typed Name');
    expect(document.querySelector('.modal-error')).toHaveTextContent(
      'locked to: test-campaign, qa-arena, qa-starter'
    );
    expect(document.querySelectorAll('.modal-overlay')).toHaveLength(1);
  });

  it('focus is NOT stolen mid-create while still seeding', async () => {
    let refuseSeed;
    createSeededCampaign.mockReturnValue(
      new Promise((_resolve, reject) => { refuseSeed = reject; })
    );
    await renderSelection();
    fireEvent.click(arenaBtn());
    const input = nameInput();
    input.focus();
    fireEvent.click(createBtn());

    await waitFor(() => expect(cancelBtn()).toBeDisabled());
    input.blur();

    // Let any effect flush during the stalled create: nothing may grab focus
    // back while seeding is still true.
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    expect(document.activeElement).toBe(document.body);
    expect(cancelBtn()).toBeDisabled();

    // Release the create with a refusal: focus returns to the input.
    refuseSeed(new Error('Campaign creation is locked'));
    await waitFor(() => expect(document.activeElement).toBe(input));
  });
});
