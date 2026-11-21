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

import { screen, within } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { q, setup, beforeEachSetup, mockState } from './log-test-utils.jsx';

import Log from './Log.jsx';

const authorSelect = () => screen.getByLabelText('Post as:');
const typeSelect = () => screen.getByLabelText('As:');

describe('Log toolbar', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('GM tab: renders heading, note-add controls, and exact ordered author census defaulting to GM', () => {
    setup(Log, []);
    expect(q('.log-toolbar')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Campaign Log' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add a note to the log...')).toBeInTheDocument();
    expect(q('.log-add-btn')).toBeInTheDocument();
    expect(authorSelect()).toHaveValue('GM');
    expect(within(authorSelect()).getAllByRole('option').map(o => o.textContent))
      .toEqual(['GM', 'Frodo', 'Aragorn']);
  });

  it('GM tab: initiative-tracker creatures join the census after the roster, deduped', async () => {
    mockState.combatSummary = { creatures: [{ name: 'Goblin' }, { name: 'Orc' }, { name: 'Frodo' }] };
    setup(Log, []);
    await vi.waitFor(() => {
      expect(within(authorSelect()).getAllByRole('option').map(o => o.textContent))
        .toEqual(['GM', 'Frodo', 'Aragorn', 'Goblin', 'Orc']);
    });
  });

  it('GM tab: the Note|Narrative type select exists and defaults to Note', () => {
    setup(Log, []);
    expect(typeSelect()).toHaveValue('note');
    expect(within(typeSelect()).getAllByRole('option').map(o => o.textContent))
      .toEqual(['Note', 'Narrative']);
  });

  it('visitor: census is players only — no GM and no type select', () => {
    setup(Log, [], true, undefined, false);
    expect(authorSelect()).toHaveValue('Frodo');
    expect(within(authorSelect()).getAllByRole('option').map(o => o.textContent))
      .toEqual(['Frodo', 'Aragorn']);
    expect(screen.queryByLabelText('As:')).toBeNull();
  });

  it('visitor with characters but none in initiative: creature lane never runs', () => {
    mockState.combatSummary = { creatures: [{ name: 'Goblin' }] };
    setup(Log, [], true, undefined, false);
    expect(within(authorSelect()).getAllByRole('option').map(o => o.textContent))
      .toEqual(['Frodo', 'Aragorn']);
  });

  it('GM tab with no characters still has the GM voice', () => {
    setup(Log, [], true, []);
    expect(within(authorSelect()).getAllByRole('option').map(o => o.textContent))
      .toEqual(['GM']);
  });

  it('visitor with zero characters: no selects, composer disabled with a plain-English hint', () => {
    setup(Log, [], true, [], false);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add a note to the log...')).toBeDisabled();
    expect(q('.log-add-btn')).toBeDisabled();
    expect(q('.log-post-disabled-hint')).toBeInTheDocument();
  });
});
