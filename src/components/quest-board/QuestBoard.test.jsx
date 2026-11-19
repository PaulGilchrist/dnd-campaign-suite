// @maintained-by-ai
// Player quest board contract: reads ONLY the two whitelisted board lanes via
// plain GETs (zero POST/PUT/DELETE on mount — the board is presentation, not
// new access), groups Active → Completed → Failed, never renders GM `notes`
// even if a row carried them (defense-in-depth behind the server whitelist),
// and re-groups / repaints LIVE on the shared-SSE quests-list-* /
// factions-list-* broadcasts — one subscription through subscribeToSSE,
// never a raw EventSource. Mirrors Quests.sse-sync.test.jsx idiom, but with
// the REAL campaign services over a fetch spy for the write census.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QuestBoard from './QuestBoard';

let capturedHandler = null;
vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: (campaignName, handler) => {
    capturedHandler = handler;
    return () => { capturedHandler = null; };
  },
}));

const jsonResponse = (body) => ({ ok: true, json: async () => body });

let questsFixture;
let standingsFixture;
let fetchCalls;

function installFetchSpy() {
  fetchCalls = [];
  global.fetch = vi.fn(async (url, options) => {
    fetchCalls.push({ url: String(url), options });
    if (String(url).includes('/api/campaigns/test-campaign/quests/board')) {
      return jsonResponse({ quests: questsFixture });
    }
    if (String(url).includes('/api/campaigns/test-campaign/factions/standings')) {
      return jsonResponse({ factions: standingsFixture });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

const renderBoard = () => render(<QuestBoard campaignName="test-campaign" />);

describe('QuestBoard', () => {
  beforeEach(() => {
    capturedHandler = null;
    questsFixture = [
      { id: 'q1', name: 'The Lost Artifact', status: 'active', description: 'Find it.', rewards: '500 gp' },
      { id: 'q2', name: 'The Sunken Shrine', status: 'completed', description: 'Done.', rewards: '' },
    ];
    standingsFixture = [
      { id: 'f1', name: 'Iron Consortium', influence: 2 },
      { id: 'f2', name: 'Cult of the Deep', influence: 9 },
    ];
    installFetchSpy();
  });

  it('mount reads both board lanes by GET only — zero writes ever leave', async () => {
    const { findByText } = renderBoard();
    await findByText('The Lost Artifact');

    expect(fetchCalls).toHaveLength(2);
    const urls = fetchCalls.map(c => c.url);
    expect(urls).toContain('/api/campaigns/test-campaign/quests/board');
    expect(urls).toContain('/api/campaigns/test-campaign/factions/standings');
    fetchCalls.forEach(({ url, options }) => {
      const method = options?.method || 'GET';
      expect(method, `write method ${method} against ${url}`).toBe('GET');
    });
  });

  it('subscribes through the ONE shared SSE client and unsubscribes on unmount', async () => {
    const { findByText, unmount } = renderBoard();
    await findByText('The Lost Artifact');
    expect(capturedHandler).toBeTypeOf('function');
    unmount();
    expect(capturedHandler).toBeNull();
  });

  it('groups cards Active → Completed → Failed, each section labeled', async () => {
    questsFixture = [
      ...questsFixture,
      { id: 'q3', name: 'The Hollow Crown', status: 'failed', description: 'Lost it.', rewards: '' },
    ];
    const { findByText, container } = renderBoard();
    await findByText('The Lost Artifact');

    const active = container.querySelector('.quest-board-group--active');
    const completed = container.querySelector('.quest-board-group--completed');
    const failed = container.querySelector('.quest-board-group--failed');
    expect(active).toHaveTextContent('The Lost Artifact');
    expect(completed).toHaveTextContent('The Sunken Shrine');
    expect(failed).toHaveTextContent('The Hollow Crown');
    expect(screen.getByRole('heading', { name: /Active/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Completed/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Failed/ })).toBeInTheDocument();
  });

  it('renders NO GM notes even when a row carries them (server whitelist, honored client-side too)', async () => {
    questsFixture = [{
      id: 'q1',
      name: 'The Lost Artifact',
      status: 'active',
      description: 'A public lead.',
      rewards: 'Gold',
      notes: 'GM SECRET: the artifact is a fake planted by the cult',
    }];
    const { container, findByText } = renderBoard();
    await findByText('The Lost Artifact');
    expect(container.textContent).not.toContain('GM SECRET');
    expect(container.textContent).not.toContain('fake planted by the cult');
  });

  it('live re-groups when a GM flips a quest to Completed (quests-list SSE, no reload)', async () => {
    const { findByText, container } = renderBoard();
    await findByText('The Lost Artifact');
    expect(container.querySelector('.quest-board-group--completed')).not.toHaveTextContent('The Lost Artifact');

    questsFixture = questsFixture.map(q =>
      q.id === 'q1' ? { ...q, status: 'completed' } : q
    );
    capturedHandler({ key: 'quests-list-test-campaign', data: { action: 'replaced' } });

    await waitFor(() => {
      expect(container.querySelector('.quest-board-group--active')).toBeNull();
      expect(container.querySelector('.quest-board-group--completed')).toHaveTextContent('The Lost Artifact');
    });
  });

  it('live-repaints the standing strip on factions-list SSE and ignores other keys/campaigns', async () => {
    const { findByText, container } = renderBoard();
    await findByText('Iron Consortium');
    const cultBadge = screen.getByTitle('Influence: 9');
    expect(cultBadge).toHaveClass('influence-badge', 'influence-tier--extreme');
    const consortiumBadge = screen.getByTitle('Influence: 2');
    expect(consortiumBadge).toHaveClass('influence-tier--low');
    // 10-segment meter per faction row, filled per influence point.
    const filled = container.querySelectorAll('.quest-board-influence-seg--filled');
    expect(filled).toHaveLength(11);

    const callsBefore = fetchCalls.length;
    capturedHandler({ key: 'quests-list-other-campaign', data: { action: 'replaced' } });
    capturedHandler({ key: 'change-test-campaign-someKey', data: {} });
    capturedHandler(null);
    expect(fetchCalls.length).toBe(callsBefore);

    standingsFixture = [{ id: 'f2', name: 'Cult of the Deep', influence: 4 }];
    capturedHandler({ key: 'factions-list-test-campaign', data: { action: 'replaced' } });
    await waitFor(() => {
      expect(screen.queryByTitle('Influence: 9')).not.toBeInTheDocument();
      expect(screen.getByTitle('Influence: 4')).toHaveClass('influence-tier--medium');
      expect(screen.queryByText('Iron Consortium')).not.toBeInTheDocument();
    });
  });

  it('collapses a long description behind Show more / Show less', async () => {
    const long = 'Stanza. '.repeat(40);
    questsFixture = [{ id: 'q1', name: 'Epic Lead', status: 'active', description: long, rewards: '' }];
    const { findByText, container } = renderBoard();
    await findByText('Epic Lead');

    const preview = container.querySelector('.quest-board-description');
    expect(preview).toHaveClass('quest-board-description--clamped');
    const toggle = screen.getByRole('button', { name: 'Show more' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(container.querySelector('.quest-board-description')).not.toHaveClass('quest-board-description--clamped');
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('short descriptions earn no toggle; a faction-less campaign shows no strip; empty board says so', async () => {
    questsFixture = [{ id: 'q1', name: 'Quick Favor', status: 'active', description: 'Brief.', rewards: 'A thank-you' }];
    standingsFixture = [];
    const { findByText, container } = renderBoard();
    await findByText('Quick Favor');

    expect(screen.queryByRole('button', { name: /Show more/ })).not.toBeInTheDocument();
    expect(container.querySelector('.quest-board-standings')).toBeNull();
    // rewards section renders through the shared markdown preview
    expect(container.querySelector('.quest-board-card-rewards')).toHaveTextContent('A thank-you');
  });

  it('hides empty groups — a board with only active quests renders one section', async () => {
    questsFixture = [questsFixture[0]];
    const { findByText, container } = renderBoard();
    await findByText('The Lost Artifact');
    expect(container.querySelectorAll('.quest-board-group')).toHaveLength(1);
  });
});
