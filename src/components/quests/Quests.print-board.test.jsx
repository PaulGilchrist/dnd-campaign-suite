// @maintained-by-ai 2026-11-25
// Item 4: the GM Quests planner header earns a labeled Print Quest Board
// verb with the honest disabled face (no player-facing quests — or only
// drafts — names the cause), and the opened sheet carries the player-facing
// fields only: the GM `notes` of the planner rows NEVER reach paper.
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Quests from './Quests.jsx';

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: () => ({
    items: questsFixture,
    loading: false,
    loadItems: vi.fn(),
    saveItems: vi.fn().mockResolvedValue(undefined),
    deleteItem: vi.fn().mockResolvedValue(undefined),
  }),
}));

// The editor's markdown fields ride PreviewToggle (same seam Quests.test.jsx
// stubs); the sheet uses the REAL MarkdownPreview sink.
vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange, placeholder, label }) => (
    <div data-testid={`preview-toggle-${id}`}>
      <label>{label}</label>
      <textarea data-testid={`field-${id}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  ),
}));

let questsFixture = [];

const renderQuests = () => render(<Quests campaignName="test-campaign" isLocalhost />);

describe('Quests — Print Quest Board handout', () => {
  beforeEach(() => {
    cleanup();
    global.fetch = vi.fn(() => Promise.reject(new Error('no fetch from the sheet lane')));
  });
  afterEach(cleanup);

  it('disabled honest face when there is nothing player-facing', () => {
    questsFixture = [];
    renderQuests();
    const btn = screen.getByRole('button', { name: /Print Quest Board/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', 'No player-facing quests to print yet');
  });

  it('drafts-only is still nothing player-facing (the board lane’s filter)', () => {
    questsFixture = [{ id: 'd', name: 'Draft quest', draft: true, status: 'active', notes: 'draft marker' }];
    renderQuests();
    const btn = screen.getByRole('button', { name: /Print Quest Board/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', 'No player-facing quests to print yet');
  });

  it('enabled with a live quest; the sheet prints players’ fields and NEVER the GM notes', () => {
    questsFixture = [{
      id: 'q1',
      name: 'The Lost Artifact',
      status: 'active',
      description: 'Find the ancient artifact in the ruins',
      rewards: '1000 gold pieces',
      notes: 'Located in the old temple — GM EYES ONLY',
    }];
    renderQuests();
    const btn = screen.getByRole('button', { name: /Print Quest Board/ });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    const portal = document.body.querySelector('.handout-preview-portal');
    expect(portal).not.toBeNull();
    expect(portal.textContent).toContain('The Lost Artifact');
    expect(portal.textContent).toContain('1000 gold pieces');
    expect(portal.textContent).not.toContain('GM EYES ONLY');
    expect(portal.textContent).not.toContain('Located in the old temple');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('the preview is a sibling overlay — closing it leaves the planner intact', () => {
    questsFixture = [{ id: 'q1', name: 'The Lost Artifact', status: 'active', notes: '' }];
    renderQuests();
    fireEvent.click(screen.getByRole('button', { name: /Print Quest Board/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));
    expect(document.body.querySelector('.handout-preview-portal')).toBeNull();
    expect(screen.getByRole('button', { name: /Print Quest Board/ })).toBeInTheDocument();
  });
});
