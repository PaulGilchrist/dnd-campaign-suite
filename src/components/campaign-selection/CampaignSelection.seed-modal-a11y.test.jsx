// @maintained-by-ai
// Lane: seed-modal a11y tier (backlog 2026-11-04 CP). The Arena/Starter
// quick-create modals ride the shared .modal-* chrome but used to lack the
// role="dialog" tier the newer common/DeleteConfirmModal.jsx exposes, so a
// [role=dialog] locator timed out on the selection page. OWNED here: both
// seed presets render a labelled dialog (role + aria-modal +
// labelledby→visible heading wiring per DeleteConfirmModal.test.jsx), and
// [role=dialog] input reaches the campaign-name field. The singleton
// disable/guard/cancel behaviors stay pinned by
// CampaignSelection.modal-singleton.test.jsx.
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
// Keep the real localDateStamp (the modal default uses it); mock only the
// orchestrator that POSTs to the server.
vi.mock('../../services/campaign/seededCampaign.js', async (importOriginal) => ({
  ...(await importOriginal()),
  createSeededCampaign: vi.fn(),
}));

import { getCharacterFolders } from '../../services/campaign/campaignService.js';

async function renderSelection() {
  getCharacterFolders.mockResolvedValue(['Campaign1']);
  const view = render(<CampaignSelection isLocalhost />);
  await waitFor(() => {
    expect(screen.queryByText('Loading campaigns...')).not.toBeInTheDocument();
  });
  return view;
}

// Asserts the full role=dialog tier for whichever seed modal is open: the
// dialog carries aria-modal + an accessible name via aria-labelledby that
// points at its own visible <h2>, and [role=dialog] input resolves to the
// campaign-name field (the selector the CP backlog could not reach).
function expectLabelledSeedDialog(headingText, defaultNamePrefix) {
  const dialog = screen.getByRole('dialog', { name: headingText });
  expect(dialog).toHaveAttribute('aria-modal', 'true');

  const labelId = dialog.getAttribute('aria-labelledby');
  expect(labelId).toBeTruthy();
  const heading = document.getElementById(labelId);
  expect(heading).toBe(dialog.querySelector('h2'));
  expect(heading).toHaveTextContent(headingText);

  const input = dialog.querySelector('input');
  expect(input).not.toBeNull();
  expect(input.value.startsWith(defaultNamePrefix)).toBe(true);
  fireEvent.change(input, { target: { value: 'typed-name' } });
  expect(input).toHaveValue('typed-name');
  return dialog;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('seed modals ride the role=dialog tier', () => {
  it('New Arena Battle renders a labelled modal whose input resolves via [role=dialog] input', async () => {
    await renderSelection();
    fireEvent.click(screen.getByRole('button', { name: /New Arena Battle/ }));

    const dialog = expectLabelledSeedDialog('New Arena Battle', 'Arena-');
    expect(dialog).toHaveClass('modal-content');
    // Chrome unchanged: still the single shared .modal-overlay tier.
    expect(document.querySelectorAll('.modal-overlay')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('New Starter Adventure renders a labelled modal wired to its own heading id', async () => {
    await renderSelection();
    fireEvent.click(screen.getByRole('button', { name: /New Starter Adventure/ }));

    const dialog = expectLabelledSeedDialog('New Starter Adventure', 'Starter-');
    // Per-preset heading id — the arena lane never shadows it.
    expect(dialog.getAttribute('aria-labelledby')).toBe('seeded-campaign-title-starter');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('each preset labels its dialog with the visible heading text', async () => {
    await renderSelection();

    fireEvent.click(screen.getByRole('button', { name: /New Arena Battle/ }));
    expect(screen.getByRole('dialog', { name: 'New Arena Battle' }))
      .toHaveAttribute('aria-labelledby', 'seeded-campaign-title-arena');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: /New Starter Adventure/ }));
    expect(screen.getByRole('dialog', { name: 'New Starter Adventure' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.querySelectorAll('.modal-overlay')).toHaveLength(0);
  });
});
