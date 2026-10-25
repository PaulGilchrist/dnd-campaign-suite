// @maintained-by-ai
// TOOLBAR lane — Log.jsx toolbar + note-add chrome presence contracts only.
// Not owned here: add-note submit/keyboard/short-circuit dispatch (#885 LogNotes),
// note/roll/etc entry content and container loading/empty states (#876-#887,
// pins at LogEntryRendering.test.jsx), entry routing (#879). The filter bar,
// render window, and "Post as:" author label are owned by LogFilters.test.jsx.
//
// old->new map (2 tests -> 2, both strengthened):
//   "renders heading, textarea, add button, and character select" -> exact heading
//     byte + .log-add-btn (replaces brittle getByRole('button', {name:''})) +
//     full ordered option census ['Anonymous','Frodo','Aragorn'] + default '' (#789)
//   "hides character select when no characters provided" -> hiding + falsy survivors
//     textarea/add-button still present (#842)

import { screen, within } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

describe('Log toolbar', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('renders toolbar heading, note-add controls, and exact ordered author census defaulting to Anonymous', () => {
    setup(Log, []);
    expect(q('.log-toolbar')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Campaign Log' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add a note to the log...')).toBeInTheDocument();
    expect(q('.log-add-btn')).toBeInTheDocument();
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('');
    expect(within(select).getAllByRole('option').map(o => o.textContent))
      .toEqual(['Anonymous', 'Frodo', 'Aragorn']);
  });

  it('hides the author combobox when no characters are provided, keeping textarea and add button', () => {
    setup(Log, [], true, []);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add a note to the log...')).toBeInTheDocument();
    expect(q('.log-add-btn')).toBeInTheDocument();
  });
});
