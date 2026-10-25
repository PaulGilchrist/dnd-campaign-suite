// @maintained-by-ai
// FILTER/WINDOW lane — Log.jsx client-side filter toolbar, render windowing,
// and composer disambiguation ("Post as:" author label). Entry content lanes
// stay in their family files; note dispatch is owned by LogNotes.test.jsx.

import { screen, fireEvent, within } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { q, setup, note, roll, spell, beforeEachSetup } from './log-test-utils.jsx';
import { LOG_WINDOW_SIZE } from './log-utils.js';

import Log from './Log.jsx';

// Unique ids per generated batch (factories reuse fixed ids → duplicate keys).
const many = (n, factory, offset = 0) =>
  Array.from({ length: n }, (_, i) => factory({ id: `${offset}-e${i}`, noteText: `Filler ${i}`, characterName: 'Frodo' }));

const renderedEntries = () => document.querySelectorAll('.log-entries .log-entry');

describe('Log filter toolbar', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('renders search input, type selector, and character selector with accessible names when entries exist', () => {
    setup(Log, [note(), roll(), spell()]);
    expect(q('.log-filters')).toBeInTheDocument();
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    const typeSelect = screen.getByLabelText('Type');
    const charSelect = screen.getByLabelText('Character');
    // Type options are driven by the types actually present (plus All)
    expect(within(typeSelect).getAllByRole('option').map(o => o.value))
      .toEqual(['', 'note', 'roll', 'spell']);
    expect(within(typeSelect).getAllByRole('option').map(o => o.textContent))
      .toEqual(['All types', 'Note', 'Roll', 'Spell']);
    expect(within(charSelect).getAllByRole('option').map(o => o.textContent)[0])
      .toBe('All characters');
  });

  it('hides the filter bar entirely on an empty log', () => {
    setup(Log, []);
    expect(q('.log-filters')).not.toBeInTheDocument();
  });

  it('type facet renders only entries of that type', () => {
    setup(Log, [note({ id: 'n1' }), roll({ id: 'r1' }), note({ id: 'n2' })]);
    expect(renderedEntries()).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'note' } });
    expect(renderedEntries()).toHaveLength(2);
    expect(q('.log-entry.log-roll')).toBeNull();
    expect(document.querySelectorAll('.log-entry.log-note')).toHaveLength(2);
  });

  it('character facet renders only that character\'s entries', () => {
    setup(Log, [note({ id: 'n1', characterName: 'Frodo' }), note({ id: 'n2', characterName: 'Aragorn' })]);
    fireEvent.change(screen.getByLabelText('Character'), { target: { value: 'Aragorn' } });
    const entries = renderedEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].textContent).toContain('Aragorn');
  });

  it('text search is case-insensitive over entry content', () => {
    setup(Log, [note({ id: 'n1', noteText: 'The Quest begins.' }), note({ id: 'n2', noteText: 'Rest at camp.' })]);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'quest' } });
    const entries = renderedEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].textContent).toContain('The Quest begins.');
  });

  it('combines facets with AND semantics and Clear filters restores the full log', () => {
    setup(Log, [
      note({ id: 'n1', characterName: 'Frodo', noteText: 'Found a ring' }),
      note({ id: 'n2', characterName: 'Aragorn', noteText: 'Found a ring' }),
      roll({ id: 'r1', characterName: 'Frodo' }),
    ]);
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'note' } });
    fireEvent.change(screen.getByLabelText('Character'), { target: { value: 'Frodo' } });
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'RING' } });
    expect(renderedEntries()).toHaveLength(1);
    expect(q('.log-entry').textContent).toContain('Found a ring');
    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(renderedEntries()).toHaveLength(3);
    expect(screen.getByLabelText('Type')).toHaveValue('');
    expect(screen.getByLabelText('Character')).toHaveValue('');
    expect(screen.getByLabelText('Search')).toHaveValue('');
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();
  });

  it('shows a friendly empty-match state with no stray entry DOM', () => {
    setup(Log, [note({ id: 'n1' })]);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'no-such-text' } });
    expect(renderedEntries()).toHaveLength(0);
    expect(q('.log-empty').textContent).toContain('No entries match the current filters');
  });
});

describe('Log composer disambiguation', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('labels the author select "Post as:" and keeps it in the note composer, not the filter bar', () => {
    setup(Log, [note({ id: 'n1' })]);
    expect(screen.getByLabelText('Post as:')).toBeInTheDocument();
    // the author select lives inside .log-add-note
    expect(q('.log-add-note #log-note-author')).toBeInTheDocument();
    // and the filter bar contains no select named for authorship
    const filters = q('.log-filters');
    expect(within(filters).queryByLabelText('Post as:')).toBeNull();
    expect(filters.querySelector('#log-note-author')).toBeNull();
  });
});

describe('Log render window', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('caps initial render at LOG_WINDOW_SIZE and Load older extends it to all entries', () => {
    const total = LOG_WINDOW_SIZE + 50;
    setup(Log, many(total, note));
    expect(renderedEntries()).toHaveLength(LOG_WINDOW_SIZE);
    const btn = screen.getByRole('button', { name: /load older/i });
    fireEvent.click(btn);
    expect(renderedEntries()).toHaveLength(total);
    expect(screen.queryByRole('button', { name: /load older/i })).not.toBeInTheDocument();
  });

  it('hides Load older when everything already fits the window', () => {
    setup(Log, many(5, note));
    expect(screen.queryByRole('button', { name: /load older/i })).not.toBeInTheDocument();
  });

  it('applies the cap to the FILTERED list, not the raw log', () => {
    const older = many(LOG_WINDOW_SIZE * 2, roll, 0).map((e, i) => ({ ...e, noteText: undefined, name: `Roll ${i}` }));
    const newer = many(LOG_WINDOW_SIZE, note, 1);
    setup(Log, [...older, ...newer]); // notes are newest → top of the list
    // Unfiltered: capped at window, button present
    expect(renderedEntries()).toHaveLength(LOG_WINDOW_SIZE);
    // Filtering to notes (exactly fits the window) drops the button entirely
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'note' } });
    expect(renderedEntries()).toHaveLength(LOG_WINDOW_SIZE);
    expect(document.querySelectorAll('.log-entry.log-roll')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /load older/i })).not.toBeInTheDocument();
  });

  it('changing a filter resets the window back to the base size', () => {
    const total = LOG_WINDOW_SIZE + 50;
    setup(Log, many(total, note));
    fireEvent.click(screen.getByRole('button', { name: /load older/i }));
    expect(renderedEntries()).toHaveLength(total);
    // All entries match "Filler", but the window must reset on filter change
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Filler' } });
    expect(renderedEntries()).toHaveLength(LOG_WINDOW_SIZE);
    expect(screen.getByRole('button', { name: /load older/i })).toBeInTheDocument();
  });
});
