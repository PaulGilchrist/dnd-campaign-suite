// @maintained-by-ai
// Lane: standard New Campaign modal dialog a11y tier (backlog 2026-11-22 SV).
// The inline quick-create modal rode the shared .modal-* chrome but used to
// lack the role="dialog" tier its seeded siblings gained in
// CampaignSelection.seed-modal-a11y.test.jsx (backlog 2026-11-04 CP) — same
// family, split parity. OWNED here: the standard modal's .modal-content now
// carries the full trio (role + aria-modal + labelledby→visible <h2> wiring,
// mirroring SeededCampaignModal.jsx's titleId pattern), the .modal-overlay
// keeps role="presentation", the exact-name getByRole('dialog') probe
// resolves exactly ONE match on BOTH tiers (parity, not invention), and the
// dismissal lanes (Escape / Cancel / pure backdrop) still close it with zero
// create traffic. The full dismiss-family law stays pinned by
// CampaignSelection.create-modal-dismiss.test.jsx.
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

const newCampaignBtn = () => screen.getByRole('button', { name: 'New Campaign', exact: true });
const arenaBtn = () => screen.getByRole('button', { name: /New Arena Battle/ });
const overlay = () => document.querySelector('.modal-overlay');
const overlays = () => document.querySelectorAll('.modal-overlay');
const nameInput = () => screen.getByPlaceholderText('Enter campaign name');

async function renderSelection() {
  getCharacterFolders.mockResolvedValue(['Campaign1']);
  const view = render(<CampaignSelection isLocalhost />);
  await waitFor(() => {
    expect(screen.queryByText('Loading campaigns...')).not.toBeInTheDocument();
  });
  return view;
}

// Backlog 2026-11-22 QQ: the picker mirrors CampaignAdmin's mount-time
// GET /api/server-config (pre-commit lock disclosure). The zero-create-traffic
// law is about POST /api/campaigns, so the stub answers /api/server-config
// inline-unlocked — the spy below then honestly records only create traffic.
function stubConfigAwareFetch() {
  const spy = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ campaignLocked: false }) });
  vi.stubGlobal('fetch', (url, ...rest) =>
    (String(url).includes('/api/server-config')
      ? Promise.resolve({ ok: true, status: 200, json: async () => ({ campaignLocked: false }) })
      : spy(url, ...rest)));
  return spy;
}

// The full dialog tier for the open standard modal: exactly ONE match for the
// same role+exact-name probe the seeded tier answers (parity proof), aria-modal
// true, and aria-labelledby pointing at the dialog's own visible <h2> — the
// SeededCampaignModal titleId pattern mirrored on the inline modal.
function expectLabelledStandardDialog() {
  const dialogs = screen.getAllByRole('dialog', { name: 'New Campaign', exact: true });
  expect(dialogs).toHaveLength(1);
  const dialog = dialogs[0];
  expect(dialog).toHaveClass('modal-content');
  expect(dialog).toHaveAttribute('aria-modal', 'true');

  const labelId = dialog.getAttribute('aria-labelledby');
  expect(labelId).toBe('new-campaign-title');
  const heading = document.getElementById(labelId);
  expect(heading).toBe(dialog.querySelector('h2'));
  expect(heading).toHaveTextContent('New Campaign');

  // Chrome unchanged: the presentation overlay and the labelled input.
  expect(overlays()).toHaveLength(1);
  expect(overlay()).toHaveAttribute('role', 'presentation');
  const input = dialog.querySelector('input');
  expect(input).toHaveAttribute('aria-label', 'New campaign name');
  return dialog;
}

let fetchSpy;
let confirmSpy;

beforeEach(() => {
  vi.clearAllMocks();
  fetchSpy = stubConfigAwareFetch();
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('standard New Campaign modal rides the seeded tier\'s dialog trio', () => {
  it('open modal carries role + aria-modal + labelledby→its own <h2>', async () => {
    await renderSelection();
    fireEvent.click(newCampaignBtn());

    const dialog = expectLabelledStandardDialog();

    // Typing still reaches the field via the [role=dialog] input selector.
    fireEvent.change(dialog.querySelector('input'), { target: { value: 'typed-name' } });
    expect(nameInput()).toHaveValue('typed-name');
  });

  it('the exact-name dialog probe resolves ONE match on both tiers', async () => {
    await renderSelection();

    fireEvent.click(newCampaignBtn());
    expect(screen.getAllByRole('dialog', { name: 'New Campaign', exact: true })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(overlays()).toHaveLength(0);

    fireEvent.click(arenaBtn());
    expect(screen.getAllByRole('dialog', { name: 'New Arena Battle', exact: true })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(overlays()).toHaveLength(0);
  });

  it('dismiss lanes unchanged: Escape / Cancel / backdrop each close with zero create traffic', async () => {
    // Escape from input focus (pre-attempt).
    await renderSelection();
    fireEvent.click(newCampaignBtn());
    expectLabelledStandardDialog();
    fireEvent.keyDown(nameInput(), { key: 'Escape' });
    expect(overlays()).toHaveLength(0);
    expectZeroCreateTraffic();

    // Cancel button.
    fireEvent.click(newCampaignBtn());
    expectLabelledStandardDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(overlays()).toHaveLength(0);
    expectZeroCreateTraffic();

    // Pure backdrop click (mousedown + click both on the overlay).
    fireEvent.click(newCampaignBtn());
    expectLabelledStandardDialog();
    fireEvent.mouseDown(overlay());
    fireEvent.click(overlay());
    expect(overlays()).toHaveLength(0);
    expectZeroCreateTraffic();
    expect(newCampaignBtn()).toBeEnabled();
  });
});

function expectZeroCreateTraffic() {
  expect(createSeededCampaign).not.toHaveBeenCalled();
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(confirmSpy).not.toHaveBeenCalled();
}
