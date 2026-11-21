// @maintained-by-ai
// TOOLBAR lane — Log.jsx toolbar + note-add chrome presence contracts only.
// Not owned here: add-note submit/keyboard/short-circuit dispatch (#885 LogNotes),
// note/roll/etc entry content and container loading/empty states (#876-#887,
// pins at LogEntryRendering.test.jsx), entry routing (#879). The filter bar,
// render window, and "Post as:" author label are owned by LogFilters.test.jsx.
//
// 2026-11-21 author-authority law (owner ruling): no Anonymous in the compose
// lane. GM tab census = ['GM', ...players, ...initiative creatures] defaulting
// to 'GM'; visitor census = players only (no GM select, no Note|Narrative
// type select); a visitor in a character-less campaign gets a disabled
// composer + hint instead of an anonymous voice.
// 2026-11-21 grouping improvement (owner ruling): on the GM tab the census
// renders THREE labeled optgroups — GM / Characters / Initiative — with empty
// groups omitted and Initiative deduped against the roster; a monster spawned
// into initiative appears ONLY under Initiative. A visitor tab stays FLAT:
// zero optgroups, roster options only (TargetSelect.jsx conditional-group
// idiom).

import { screen, within } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { q, setup, beforeEachSetup, mockState } from './log-test-utils.jsx';

import Log from './Log.jsx';

const authorSelect = () => screen.getByLabelText('Post as:');
const typeSelect = () => screen.getByLabelText('As:');
const groupCensus = () =>
  [...authorSelect().querySelectorAll('optgroup')].map(g => [g.label, [...g.querySelectorAll('option')].map(o => o.textContent)]);
const flatOptions = () => within(authorSelect()).getAllByRole('option').map(o => o.textContent);

describe('Log toolbar', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('GM tab: renders heading, note-add controls, and grouped census defaulting to GM', () => {
    setup(Log, []);
    expect(q('.log-toolbar')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Campaign Log' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add a note to the log...')).toBeInTheDocument();
    expect(q('.log-add-btn')).toBeInTheDocument();
    expect(authorSelect()).toHaveValue('GM');
    expect(flatOptions()).toEqual(['GM', 'Frodo', 'Aragorn']);
    expect(groupCensus()).toEqual([
      ['GM', ['GM']],
      ['Characters', ['Frodo', 'Aragorn']]
    ]);
  });

  it('GM tab: initiative creatures join under an Initiative group, deduped against the roster', async () => {
    mockState.combatSummary = { creatures: [{ name: 'Goblin' }, { name: 'Orc' }, { name: 'Frodo' }] };
    setup(Log, []);
    await vi.waitFor(() => {
      expect(groupCensus()).toEqual([
        ['GM', ['GM']],
        ['Characters', ['Frodo', 'Aragorn']],
        ['Initiative', ['Goblin', 'Orc']]
      ]);
    });
    // The roster Frodo is NOT duplicated as a monster-tier option.
    expect(flatOptions()).toEqual(['GM', 'Frodo', 'Aragorn', 'Goblin', 'Orc']);
  });

  it('GM tab: the Note|Narrative type select exists and defaults to Note', () => {
    setup(Log, []);
    expect(typeSelect()).toHaveValue('note');
    expect(within(typeSelect()).getAllByRole('option').map(o => o.textContent))
      .toEqual(['Note', 'Narrative']);
  });

  it('visitor: flat census — zero optgroups, players only, no GM and no type select', () => {
    setup(Log, [], true, undefined, false);
    expect(authorSelect()).toHaveValue('Frodo');
    expect(flatOptions()).toEqual(['Frodo', 'Aragorn']);
    expect(authorSelect().querySelectorAll('optgroup')).toHaveLength(0);
    expect(screen.queryByLabelText('As:')).toBeNull();
  });

  it('visitor with characters but none in initiative: creature lane never runs', () => {
    mockState.combatSummary = { creatures: [{ name: 'Goblin' }] };
    setup(Log, [], true, undefined, false);
    expect(flatOptions()).toEqual(['Frodo', 'Aragorn']);
    expect(authorSelect().querySelectorAll('optgroup')).toHaveLength(0);
  });

  it('GM tab with no characters: only the GM group (no empty Characters optgroup)', () => {
    setup(Log, [], true, []);
    expect(flatOptions()).toEqual(['GM']);
    expect(groupCensus()).toEqual([['GM', ['GM']]]);
  });

  it('visitor with zero characters: no selects, composer disabled with a plain-English hint', () => {
    setup(Log, [], true, [], false);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add a note to the log...')).toBeDisabled();
    expect(q('.log-add-btn')).toBeDisabled();
    expect(q('.log-post-disabled-hint')).toBeInTheDocument();
  });
});
