// @maintained-by-ai
// Lane: quick-create modal dismiss (backlog 2026-11-13 DG). The three
// Create-family modals (New Campaign / New Arena Battle / New Starter
// Adventure) used to answer ONLY their Cancel/Create buttons — Escape and a
// pure backdrop click left them mounted with the quick-create buttons stuck
// disabled. OWNED here: the WAI-ARIA parity now wired through
// hooks/ui/useModalDismiss.js — Escape and a mousedown+click fully on the
// .modal-overlay route to the inert Cancel lane with ZERO create traffic
// (neither createSeededCampaign nor a POST /api/campaigns) and no native
// confirm, the panel→backdrop drag guard holds, mid-seeding dismiss stays
// inert, and the Create happy paths are unaffected. The singleton disable /
// cancel law stays pinned by CampaignSelection.modal-singleton.test.jsx; the
// role=dialog tier by CampaignSelection.seed-modal-a11y.test.jsx.
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
// Keep the real localDateStamp (the modal default uses it); mock only the
// orchestrator that POSTs to the server.
vi.mock('../../services/campaign/seededCampaign.js', async (importOriginal) => ({
  ...(await importOriginal()),
  createSeededCampaign: vi.fn(),
}));

import { getCharacterFolders } from '../../services/campaign/campaignService.js';
import { createSeededCampaign } from '../../services/campaign/seededCampaign.js';

const arenaBtn = () => screen.getByRole('button', { name: /New Arena Battle/ });
const starterBtn = () => screen.getByRole('button', { name: /New Starter Adventure/ });
const newCampaignBtn = () => screen.getByRole('button', { name: /New Campaign/ });
const overlays = () => document.querySelectorAll('.modal-overlay');
const overlay = () => document.querySelector('.modal-overlay');
const nameInput = () => screen.getByPlaceholderText('Enter campaign name');

// Every dismiss face must be fully inert server-side: no seeded orchestrator,
// no raw POST /api/campaigns, and no native confirm prompt.
function expectZeroCreateTraffic(confirmSpy) {
  expect(createSeededCampaign).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(confirmSpy).not.toHaveBeenCalled();
}

async function renderSelection() {
  getCharacterFolders.mockResolvedValue(['Campaign1']);
  const view = render(<CampaignSelection isLocalhost />);
  await waitFor(() => {
    expect(screen.queryByText('Loading campaigns...')).not.toBeInTheDocument();
  });
  return view;
}

// Every dismiss face must close with zero create traffic and re-enable
// every quick-create button.
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Escape dismisses every Create-family modal with zero create traffic', () => {
  let confirmSpy;
  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it.each([
    ['New Arena Battle', arenaBtn],
    ['New Starter Adventure', starterBtn],
    ['New Campaign', newCampaignBtn],
  ])('%s: Escape closes the open modal', async (heading, open) => {
    await renderSelection();
    fireEvent.click(open());
    expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();

    fireEvent.keyDown(nameInput(), { key: 'Escape' });

    expect(overlays()).toHaveLength(0);
    expectZeroCreateTraffic(confirmSpy);
    expect(newCampaignBtn()).toBeEnabled();
    expect(arenaBtn()).toBeEnabled();
    expect(starterBtn()).toBeEnabled();
  });

  it('a re-opened seed modal still Creates end-to-end after an Escape dismiss', async () => {
    createSeededCampaign.mockResolvedValue({ name: 'Arena-reopen' });
    await renderSelection();
    fireEvent.click(arenaBtn());
    fireEvent.keyDown(nameInput(), { key: 'Escape' });
    expect(overlays()).toHaveLength(0);

    fireEvent.click(arenaBtn());
    fireEvent.change(nameInput(), { target: { value: 'qa-arena' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(createSeededCampaign).toHaveBeenCalledTimes(1);
    });
    expect(createSeededCampaign).toHaveBeenCalledWith('arena', { name: 'qa-arena' });
    expect(overlays()).toHaveLength(0);
  });
});

describe('a pure backdrop click dismisses like Escape', () => {
  let confirmSpy;
  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('mousedown + click fully on the .modal-overlay closes the seed modal', async () => {
    await renderSelection();
    fireEvent.click(starterBtn());

    fireEvent.mouseDown(overlay());
    fireEvent.click(overlay());

    expect(overlays()).toHaveLength(0);
    expectZeroCreateTraffic(confirmSpy);
    expect(starterBtn()).toBeEnabled();
  });

  it('closes the standard New Campaign modal the same way', async () => {
    await renderSelection();
    fireEvent.click(newCampaignBtn());

    fireEvent.mouseDown(overlay());
    fireEvent.click(overlay());

    expect(overlays()).toHaveLength(0);
    expectZeroCreateTraffic(confirmSpy);
  });
});

describe('the drag guard and panel clicks never dismiss', () => {
  let confirmSpy;
  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('a drag started inside the panel and released on the backdrop does not dismiss', async () => {
    await renderSelection();
    fireEvent.click(arenaBtn());
    const panel = document.querySelector('.modal-content');

    fireEvent.mouseDown(panel.querySelector('h2'));
    fireEvent.click(overlay());
    expect(overlays()).toHaveLength(1);
    expectZeroCreateTraffic(confirmSpy);

    // The guard resets: the next pure backdrop click still dismisses.
    fireEvent.mouseDown(overlay());
    fireEvent.click(overlay());
    expect(overlays()).toHaveLength(0);
    expectZeroCreateTraffic(confirmSpy);
  });

  it('clicks bubbling from inside the panel keep the modal mounted', async () => {
    await renderSelection();
    fireEvent.click(arenaBtn());
    const panel = document.querySelector('.modal-content');

    fireEvent.click(panel.querySelector('h2'));
    fireEvent.click(panel);
    expect(overlays()).toHaveLength(1);
    expectZeroCreateTraffic(confirmSpy);
  });
});

describe('dismiss stays inert mid-create; Cancel and Create are unaffected', () => {
  it('neither Escape nor backdrop dismisses while a seeded create is in flight', async () => {
    let settleSeed;
    createSeededCampaign.mockReturnValue(new Promise((resolve) => { settleSeed = resolve; }));
    await renderSelection();
    fireEvent.click(arenaBtn());
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    // seeding:true rendered: the action row is disabled.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    });

    fireEvent.keyDown(nameInput(), { key: 'Escape' });
    fireEvent.mouseDown(overlay());
    fireEvent.click(overlay());
    expect(overlays()).toHaveLength(1);

    settleSeed({ name: 'Arena-flight' });
    await waitFor(() => {
      expect(overlays()).toHaveLength(0);
    });
  });

  it('the Cancel button still closes with zero create traffic (law unchanged)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await renderSelection();
    fireEvent.click(starterBtn());

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(overlays()).toHaveLength(0);
    expectZeroCreateTraffic(confirmSpy);
  });

  it('the standard New Campaign Create path still POSTs the typed name', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const reloadSpy = vi.fn();
    vi.stubGlobal('location', { reload: reloadSpy });
    await renderSelection();
    fireEvent.click(newCampaignBtn());
    fireEvent.change(nameInput(), { target: { value: 'Fresh Campaign' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/campaigns',
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(reloadSpy).not.toHaveBeenCalled(); // reload rides the 2 s success delay
  });
});
