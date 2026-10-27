// @maintained-by-ai: 2026-10-27
// Conflict-banner contract for the Factions manager: when the server refuses a
// save with a 409 concurrent-edit conflict (body { conflict: true } — the
// service copies it onto the thrown error), the banner keeps its verbatim
// conflict copy and adds a one-click "Reload list" recovery: the editor
// closes and the list refetches through the sanctioned stale-close path
// (fix 9cee7bfa2). Non-conflict failures keep the old copy-only banner.
// Mirrors the mocked service/SSE rig of Factions.sse-sync.test.jsx.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Factions from './Factions';

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: () => () => {},
}));

let loadCallCount = 0;
let saveError = null;
let factionsFixture = [{ id: 'f1', name: 'The Iron Consortium', influence: 3 }];

vi.mock('../../services/campaign/factionsService.js', () => ({
  loadFactions: vi.fn(async () => {
    loadCallCount += 1;
    return { factions: factionsFixture };
  }),
  saveFactions: vi.fn(async () => {
    if (saveError) throw saveError;
    return { success: true };
  }),
  deleteFaction: vi.fn(async () => ({ success: true })),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange }) => (
    <textarea
      data-testid={`faction-field-${id}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const CONFLICT_MESSAGE =
  'Faction "The Iron Consortium" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';

const conflictError = () => Object.assign(new Error(CONFLICT_MESSAGE), { conflict: true });

const renderFactions = () =>
  render(<Factions campaignName="test-campaign" onBack={vi.fn()} />);

const openEditorAndSave = async (findByText) => {
  await findByText('The Iron Consortium');
  fireEvent.click(screen.getByRole('button', { name: 'Edit faction: The Iron Consortium' }));
  expect(loadCallCount).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: /^save/i }));
};

describe('Factions 409 banner — Reload list recovery action', () => {
  beforeEach(() => {
    loadCallCount = 0;
    saveError = null;
    factionsFixture = [{ id: 'f1', name: 'The Iron Consortium', influence: 3 }];
  });

  it('a flagged 409 offers Reload list — one click closes the editor and refetches the fresh row', async () => {
    saveError = conflictError();
    const { findByText } = renderFactions();
    await openEditorAndSave(findByText);

    const banner = await screen.findByText(/NOT saved/);
    expect(banner).toHaveTextContent(CONFLICT_MESSAGE);
    const reloadButton = screen.getByRole('button', { name: 'Reload list' });
    // Nothing re-fetched while the refusal banner is still up.
    expect(loadCallCount).toBe(1);

    // What the other tab already persisted server-side.
    factionsFixture = [{ id: 'f1', name: 'The Iron Consortium', influence: 7 }];
    fireEvent.click(reloadButton);

    // ONE click = the full sanctioned recovery: editor closed AND the stale
    // list refresh consumed (handleCloseModal's 9cee7bfa2 path).
    await waitFor(() =>
      expect(screen.queryByTestId('faction-field-faction-description')).toBeNull()
    );
    await findByText('7');
    expect(loadCallCount).toBe(2);
  });

  it('non-conflict save failures keep the old copy-only banner (no Reload list)', async () => {
    saveError = new Error('Failed to save Factions');
    const { findByText } = renderFactions();
    await openEditorAndSave(findByText);

    await screen.findByText(/Failed to save Factions/);
    expect(screen.queryByRole('button', { name: 'Reload list' })).not.toBeInTheDocument();
  });

  it('the button vanishes once a live duplicate-name banner takes over the copy', async () => {
    // A rival row exists in the loaded list so the live dup guard can fire.
    factionsFixture = [
      { id: 'f1', name: 'The Iron Consortium', influence: 3 },
      { id: 'f2', name: 'Cult of the Deep', influence: 7 },
    ];
    saveError = conflictError();
    const { findByText } = renderFactions();
    await openEditorAndSave(findByText);
    await screen.findByRole('button', { name: 'Reload list' });

    fireEvent.change(screen.getByPlaceholderText('Faction name'), {
      target: { value: 'Cult of the Deep' },
    });

    // The dup copy wins the banner and the stale conflict's action is gone.
    expect(await screen.findByText('A faction with that name already exists')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reload list' })).not.toBeInTheDocument();
  });
});
