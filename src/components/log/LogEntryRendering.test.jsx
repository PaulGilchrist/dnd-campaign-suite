import { screen } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { note, q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

describe('Log', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  // ── ENTRY RENDERING / REVERSE ORDER ───────────────
  describe('entry rendering', () => {
    it('renders entries in reverse chronological order', () => {
      setup(Log, [note({ id: 'a', noteText: 'First' }), note({ id: 'b', noteText: 'Second' })]);
      const texts = document.querySelectorAll('.log-note-text');
      expect(texts.length).toBe(2);
      expect(texts[0].textContent).toContain('Second');
      expect(texts[1].textContent).toContain('First');
    });

    it('skips entries with unknown types', () => {
      setup(Log, [
        note({ id: 'a', noteText: 'Valid' }),
        { id: '?', type: 'unknown' },
        note({ id: 'b', noteText: 'Also valid' }),
      ]);
      const allEntries = document.querySelectorAll('.log-entry');
      expect(allEntries.length).toBe(2);
      expect(screen.queryByText(/unknown/i)).not.toBeInTheDocument();
    });

    it('renders nothing when log is empty and initialized', () => {
      setup(Log, []);
      expect(document.querySelectorAll('.log-entry').length).toBe(0);
    });

    it('shows loading message when not initialized', () => {
      setup(Log, [note({ noteText: 'hi' })], false);
      expect(screen.getByText(/Loading log/i)).toBeInTheDocument();
    });
  });

  // ── NOTE ENTRY component ───────────────
  describe('NoteEntry', () => {
    it('renders noteText, character name, timestamp, and icon', () => {
      setup(Log, [note({ noteText: 'Hello' })]);
      expect(q('.log-note-text')).toHaveTextContent(/Hello/i);
      expect(q('.log-note .log-character')).toHaveTextContent(/Frodo/i);
      expect(q('.log-note .log-time')).toBeInTheDocument();
      expect(q('.log-note i.fa-comment-dots')).toBeInTheDocument();
      expect(q('.log-entry.log-note')).toBeInTheDocument();
    });

    it('renders custom character name and note text', () => {
      setup(Log, [note({ characterName: 'Gandalf', noteText: 'Light!' })]);
      expect(q('.log-character')).toHaveTextContent(/Gandalf/i);
      expect(q('.log-note-text')).toHaveTextContent(/Light!/i);
    });
  });
});
