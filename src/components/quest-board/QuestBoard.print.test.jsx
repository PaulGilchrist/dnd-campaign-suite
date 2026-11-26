// @maintained-by-ai 2026-11-25
// Item 4: the PLAYER quest board earns the same labeled Print verb — the
// visitor-reachable half of the handout family. Rows arrive field-whitelisted
// from /quests/board, so paper can never carry notes; the disabled honest
// face covers the empty board and the loading window.
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import QuestBoard from './QuestBoard';

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: () => () => {},
}));

const jsonResponse = (body) => ({ ok: true, json: async () => body });

let questsFixture;

function installFetchSpy() {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/quests/board')) return jsonResponse({ quests: questsFixture });
    if (String(url).includes('/factions/standings')) return jsonResponse({ factions: [] });
    throw new Error(`unexpected fetch: ${url}`);
  });
}

const renderBoard = () => render(<QuestBoard campaignName="test-campaign" />);

describe('QuestBoard — Print verb', () => {
  beforeEach(() => {
    cleanup();
    installFetchSpy();
  });
  afterEach(cleanup);

  it('disabled honest face on an empty board', async () => {
    questsFixture = [];
    renderBoard();
    const btn = await screen.findByRole('button', { name: /Print Quest Board/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', 'No quests on the board to print yet');
  });

  it('enabled with rows; the sheet prints the board groups and writes nothing', async () => {
    questsFixture = [
      { id: 'q1', name: 'The Lost Artifact', status: 'active', description: 'Find it.', rewards: '*500 gp*' },
      { id: 'q2', name: 'The Sunken Shrine', status: 'completed', description: 'Done.', rewards: '' },
    ];
    renderBoard();
    const btn = await screen.findByRole('button', { name: /Print Quest Board/ });
    await waitFor(() => expect(btn).toBeEnabled());
    fireEvent.click(btn);
    const portal = document.body.querySelector('.handout-preview-portal');
    expect(portal).not.toBeNull();
    expect(portal.textContent).toContain('The Lost Artifact');
    expect(portal.textContent).toContain('The Sunken Shrine');
    // Whitelisted board rows: notes were never even in this component's state.
    expect(portal.textContent).not.toContain('notes');
    const writes = (global.fetch.mock.calls || []).filter(([, options]) => (options?.method || 'GET') !== 'GET');
    expect(writes).toHaveLength(0);
  });

  it('closing the sheet leaves the board on screen', async () => {
    questsFixture = [{ id: 'q1', name: 'The Lost Artifact', status: 'active', description: '', rewards: '' }];
    renderBoard();
    const btn = await screen.findByRole('button', { name: /Print Quest Board/ });
    fireEvent.click(btn);
    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));
    expect(document.body.querySelector('.handout-preview-portal')).toBeNull();
    expect(screen.getByRole('button', { name: /Print Quest Board/ })).toBeInTheDocument();
  });
});
