// @maintained-by-ai
// Item 4 quest board one-pager contract: PLAYER-FACING FIELDS ONLY — the
// component reads {name, status, description, rewards}, so a raw GM planner
// row's `notes` can never reach paper even when passed directly (the law is
// the whitelist, pinned here); draft rows mirror the /quests/board lane's
// filter and never print; grouping reuses the board's Active→Completed→
// Failed derivation; rewards/description flow through the ONE markdown sink.
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import QuestBoardHandout from './QuestBoardHandout.jsx';

const plannerRows = [
  {
    id: 'q1',
    name: 'The Lost Artifact',
    status: 'active',
    description: 'Find the ancient artifact in the **ruins**',
    rewards: '1000 gold pieces, *magic sword*',
    notes: 'Located in the old temple — GM EYES ONLY marker',
  },
  {
    id: 'q2',
    name: 'The Sunken Shrine',
    status: 'completed',
    description: 'Cleared.',
    rewards: '',
    notes: 'Second GM marker',
  },
  {
    id: 'q3',
    name: 'The Broken Pact',
    status: 'failed',
    description: 'The duke forgot your name.',
    rewards: 'None.',
    notes: 'Third GM marker',
  },
];

describe('QuestBoardHandout', () => {
  afterEach(cleanup);

  it('groups Active → Completed → Failed with labels and counts', () => {
    const { container } = render(<QuestBoardHandout quests={plannerRows} />);
    const headings = [...container.querySelectorAll('.handout-section-title')].map(h => h.textContent);
    expect(headings.map(h => h.replace(/\s*\(\d\)$/, ''))).toEqual(['Active', 'Completed', 'Failed']);
    expect(container.textContent).toContain('(1)');
  });

  it('GM-only notes NEVER reach paper, even from raw planner rows', () => {
    const { container } = render(<QuestBoardHandout quests={plannerRows} />);
    expect(container.textContent).not.toContain('GM EYES ONLY');
    expect(container.textContent).not.toContain('Located in the old temple');
    expect(container.textContent).not.toContain('Second GM marker');
    expect(container.textContent).not.toContain('Third GM marker');
  });

  it('prints player-facing description and rewards through the markdown sink', () => {
    const { container } = render(<QuestBoardHandout quests={plannerRows} />);
    expect(container.querySelector('.handout-quest strong')?.textContent).toBe('ruins');
    expect(container.querySelector('.handout-quest em')?.textContent).toBe('magic sword');
    expect(container.querySelector('.handout-quest-rewards-title')).not.toBeNull();
  });

  it('draft rows never print (same law as the /quests/board lane)', () => {
    const { container } = render(
      <QuestBoardHandout quests={[...plannerRows.slice(0, 1), { id: 'd1', name: 'Work In Progress', draft: true, status: 'active', notes: 'draft marker' }]} />
    );
    expect(container.textContent).not.toContain('Work In Progress');
    expect(container.textContent).not.toContain('draft marker');
  });

  it('empty board prints an honest empty face', () => {
    const none = render(<QuestBoardHandout quests={[]} />);
    expect(none.container.textContent).toContain('No player-facing quests to print');
    cleanup();
    const onlyDrafts = render(<QuestBoardHandout quests={[{ id: 'd', name: 'D', draft: true }]} />);
    expect(onlyDrafts.container.textContent).toContain('No player-facing quests to print');
  });

  it('quest name and status pill print for each row', () => {
    render(<QuestBoardHandout quests={plannerRows} />);
    expect(screen.getByText('The Lost Artifact')).toBeInTheDocument();
    expect(screen.getByText('The Sunken Shrine')).toBeInTheDocument();
    expect(screen.getByText('The Broken Pact')).toBeInTheDocument();
  });
});
