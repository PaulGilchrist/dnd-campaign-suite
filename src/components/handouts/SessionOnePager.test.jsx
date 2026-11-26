// @maintained-by-ai 2026-11-25
// Item 4 session one-pager contract: the GM screen on paper reads the saved
// row + link expansions — linked encounters annotated with their saved XP,
// linked notes expanded in full (the rumour lane), the auto/custom prep
// checklist with its honest progress line, contingencies with branch labels,
// and the party XP-threshold guide. Mount is READ-only (two GET lanes), and
// the sheet still prints its core without the async extras ever landing.
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

vi.mock('../../services/encounters/encountersService.js', () => ({
  loadEncounters: vi.fn(),
}));
vi.mock('../../services/campaign/notesService.js', () => ({
  loadNotes: vi.fn(),
}));

import { loadEncounters } from '../../services/encounters/encountersService.js';
import { loadNotes } from '../../services/campaign/notesService.js';
import SessionOnePager from './SessionOnePager.jsx';

const session = {
  name: 'Session 7: Smuggler’s Cave',
  date: '2026-11-30',
  status: 'planned',
  summary: 'The party **descends** into the cave.',
  notes: 'Remember the salt-water trap wording',
  links: {
    maps: ['Smuggler Cave'],
    encounters: ['Goblin Ambush'],
    npcs: ['Cap Drill Sergeant'],
    quests: ['The Lost Artifact'],
    settlements: [],
    notes: ['n-1'],
  },
  contingencies: [
    { id: 'c1', ifText: 'They sneak in', thenText: 'the guard dogs react', branch: 'alternate' },
  ],
  checklist: [
    { id: 'a1', label: 'Smuggler Cave set as active map', auto: true, done: true },
    { id: 'u1', label: 'Print the map handout', auto: false, done: false },
  ],
};

const characters = [
  { name: 'FixtureFighter5e', level: 3 },
  { name: 'FixtureLandDruid', level: 3 },
];

describe('SessionOnePager', () => {
  beforeEach(() => {
    loadEncounters.mockResolvedValue([{ name: 'Goblin Ambush', effectiveXP: 400 }]);
    loadNotes.mockResolvedValue([{ id: 'n-1', description: '# Rumours\nDockmaster swears the caves are **haunted**.' }]);
  });
  afterEach(cleanup);

  const renderPager = (props = {}) => render(
    <SessionOnePager session={session} characters={characters} campaignName="test-campaign" {...props} />
  );

  it('prints identity, date and status', () => {
    const { container } = renderPager();
    expect(screen.getByText('Session: Session 7: Smuggler’s Cave')).toBeInTheDocument();
    expect(container.textContent).toContain('30 Nov 2026');
    expect(container.textContent).toContain('Planned');
  });

  it('expands linked resources with the linked encounter’s saved XP', async () => {
    const { container } = renderPager();
    await waitFor(() => expect(loadEncounters).toHaveBeenCalledWith('test-campaign'));
    await waitFor(() => expect(loadNotes).toHaveBeenCalledWith('test-campaign'));
    expect(container.textContent).toContain('Maps');
    expect(container.textContent).toContain('Smuggler Cave');
    expect(container.textContent).toContain('Goblin Ambush (400 XP)');
    expect(container.textContent).toContain('Cap Drill Sergeant');
    expect(container.textContent).toContain('The Lost Artifact');
  });

  it('expands the linked note in full — the rumour lane', async () => {
    const { container } = renderPager();
    await waitFor(() => expect(container.querySelector('.handout-linked-note')).not.toBeNull());
    expect(container.textContent).toContain('Dockmaster swears the caves are haunted.');
    // Sanitized markdown really rendered (the ONE sink): the heading survived.
    expect(container.querySelector('.handout-linked-note h1')).not.toBeNull();
  });

  it('never expands a note that is not linked', async () => {
    loadNotes.mockResolvedValue([
      { id: 'n-1', description: 'Linked rumour text' },
      { id: 'n-2', description: 'Unlinked private scribble' },
    ]);
    const { container } = renderPager();
    await waitFor(() => expect(container.querySelector('.handout-linked-note')).not.toBeNull());
    expect(container.textContent).not.toContain('Unlinked private scribble');
  });

  it('prints contingencies with their branch labels', () => {
    const { container } = renderPager();
    expect(container.textContent).toContain('They sneak in');
    expect(container.textContent).toContain('the guard dogs react');
    expect(container.textContent).toContain('Alternate route');
  });

  it('prints the prep checklist with progress and tick states', () => {
    const { container } = renderPager();
    expect(container.textContent).toContain('1 of 2 ready');
    expect(container.textContent).toContain('Print the map handout');
    expect(container.querySelector('.handout-checklist-done')).not.toBeNull();
    expect(container.textContent).toContain('☐');
  });

  it('prints the party XP budget guide from the party rows', () => {
    const { container } = renderPager();
    expect(container.textContent).toContain('XP Budget Guide');
    expect(container.textContent).toContain('3, 3');
    // ENCOUNTER_CONFIG rows are level-indexed from 0: level 3 → [75,150,225,
    // 400] × 2 PCs = 150 / 300 / 450 / 800.
    expect(container.textContent).toContain('150 XP');
    expect(container.textContent).toContain('800 XP');
  });

  it('GM notes print (this is the GM’s own screen sheet)', () => {
    const { container } = renderPager();
    expect(container.textContent).toContain('Remember the salt-water trap wording');
  });

  it('a bare session prints honest empties, and mount never writes', async () => {
    const { container } = render(
      <SessionOnePager session={{ name: 'Blank', links: {}, checklist: [], contingencies: [] }} characters={[]} campaignName="test-campaign" />
    );
    expect(container.textContent).toContain('Nothing linked to this session yet.');
    const writes = (global.fetch?.mock?.calls || []).filter(([, options]) => (options?.method || 'GET') !== 'GET');
    expect(writes).toHaveLength(0);
  });

  it('missing session renders an honest empty face', () => {
    const { container } = render(<SessionOnePager session={null} />);
    expect(container.textContent).toContain('No session selected to print');
  });
});
