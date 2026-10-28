// @maintained-by-ai
// GENERIC fallback lane — leaf content for LogGenericEntry.jsx (bug-log-api-ghost-entries).
// Unregistered entry types (server audit rows like enforcement_denied/ai_director,
// or raw API posts) must render an honest row: type label + readable text excerpt,
// never a silently invisible ghost. Routing (type → this component) is pinned by
// LogEntryRendering.test.jsx; this lane owns the leaf bytes (LogNotes.test.jsx style).

import { within } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { q, setup, note, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

describe('Log generic fallback entries', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('renders an unknown type with its label, message excerpt, author-less header, and time', () => {
    setup(Log, [
      { id: 'g1', type: 'gm-note', message: 'RUNQ SSE PROBE NOTE', timestamp: 1700000000000 },
    ]);
    expect(q('.log-entry.log-generic')).toBeInTheDocument();
    expect(q('.log-generic-type').textContent).toBe('Gm-note');
    expect(q('.log-generic-text').textContent).toBe('RUNQ SSE PROBE NOTE');
    expect(q('.log-generic .log-time').textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(q('.log-generic i.fa-circle-info')).toBeInTheDocument();
  });

  it('renders a server audit row (no message field) from its description', () => {
    setup(Log, [
      { id: 'g2', type: 'enforcement_denied', origin: 'server-validator', key: 'targetEffects', reason: 'bad write', description: 'Server rejected write to targetEffects: bad write', timestamp: 1700000000000 },
    ]);
    expect(q('.log-generic-type').textContent).toBe('Enforcement denied');
    expect(q('.log-generic-text').textContent).toBe('Server rejected write to targetEffects: bad write');
  });

  it('falls back to a JSON excerpt (id excluded) for a bare payload with no text field', () => {
    setup(Log, [
      { id: 'g3', type: 'weird', foo: 'bar', timestamp: 1700000000000 },
    ]);
    const text = q('.log-generic-text').textContent;
    expect(text).toContain('"foo":"bar"');
    expect(text).not.toContain('g3');
  });

  it('labels a type-less entry as Unknown and keeps registered types unaffected', () => {
    setup(Log, [
      note({ id: 'n', noteText: 'Composer note' }),
      { message: 'no type at all', timestamp: 1700000000000 },
    ]);
    expect(document.querySelectorAll('.log-entry').length).toBe(2);
    expect(q('.log-entry.log-note')).toBeInTheDocument();
    const generic = q('.log-entry.log-generic');
    expect(within(generic).getByText('Unknown')).toBeInTheDocument();
    expect(within(generic).getByText('no type at all')).toBeInTheDocument();
  });
});
