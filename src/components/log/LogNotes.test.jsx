// @maintained-by-ai
// NOTE lane — canonical home for note content AND the add-note flow (Log.jsx).
// REC #884: absorbed the NoteEntry content census retained in LogEntryRendering.test.jsx
// (its #879 custom-values pin migrated here verbatim-in-face — that lane should drop its
// retained note test at its next re-touch; it keeps only the .log-note routing marker byte).
// Transport (useLog/addEntry) is mocked at its seam, consumers-exact (#875 style):
// we pin the FULL dispatched payload, never objectContaining, and count dispatches
// (short-circuit-0 leak watch, #882). Timestamps: fixed TS, regex-pinned HH:MM:SS
// (#876 family convention). Toolbar combobox presence/hiding is owned by
// LogToolbar.test.jsx — not re-pinned here.
//
// old->new map (8 add tests -> 4, +1 absorbed content test):
//   "submits trimmed text" + "uses selected character as author" +
//   "clears textarea after submit" → one exact-payload submit (trim + author + clear)
//   "uses Anonymous when no characters" → anonymous dispatch, no combobox
//   "whitespace not submitted" + "preserves textarea when whitespace" → one short-circuit test
//   "ctrl+enter submits" + "plain enter does not" → one keyboard test (plain leg first,
//     then ctrl leg; call-count pin covers both without mock surgery)

import { screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { q, setup, note, beforeEachSetup, mockAddEntry } from './log-test-utils.jsx';

import Log from './Log.jsx';

const textarea = () => screen.getByPlaceholderText('Add a note to the log...');

describe('Log notes', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  // ── NOTE ENTRY CONTENT (canonical home, ex-#879 retained pin) ──
  it('renders note entry with exact author, verbatim text, time, and comment icon', () => {
    setup(Log, [note({ characterName: 'Gandalf', noteText: 'Light!', timestamp: 1700000000000 })]);
    expect(q('.log-entry.log-note')).toBeInTheDocument();
    expect(q('.log-note-text').textContent).toBe('Light!');
    expect(q('.log-note .log-character').textContent).toBe('Gandalf');
    expect(q('.log-note .log-time').textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(q('.log-note i.fa-comment-dots')).toBeInTheDocument();
  });

  // ── ADD-NOTE FLOW ──
  it('submits exact payload with trimmed text and selected author, then clears the textarea', async () => {
    setup(Log, []);
    fireEvent.change(textarea(), { target: { value: ' Hello ' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Aragorn' } });
    fireEvent.click(q('.log-add-btn'));
    await waitFor(() => {
      expect(mockAddEntry).toHaveBeenCalledTimes(1);
      // settle past the awaited addEntry so the post-submit clear is observed in act
      expect(textarea()).toHaveValue('');
    });
    expect(mockAddEntry).toHaveBeenCalledWith({ type: 'note', characterName: 'Aragorn', noteText: 'Hello' });
  });

  it('dispatches as Anonymous when no characters provide a combobox', async () => {
    setup(Log, [], true, []);
    fireEvent.change(textarea(), { target: { value: 'hi' } });
    fireEvent.click(q('.log-add-btn'));
    await vi.waitFor(() => {
      expect(mockAddEntry).toHaveBeenCalledWith({ type: 'note', characterName: 'Anonymous', noteText: 'hi' });
    });
  });

  it('short-circuits whitespace input: zero dispatches, textarea preserved', () => {
    setup(Log, []);
    fireEvent.change(textarea(), { target: { value: '   ' } });
    fireEvent.click(q('.log-add-btn'));
    expect(mockAddEntry).not.toHaveBeenCalled();
    expect(textarea()).toHaveValue('   ');
  });

  it('plain Enter never submits; Ctrl+Enter submits exact payload', async () => {
    setup(Log, []);
    const box = textarea();
    fireEvent.change(box, { target: { value: 'x' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(mockAddEntry).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
    await vi.waitFor(() => {
      expect(mockAddEntry).toHaveBeenCalledTimes(1);
    });
    expect(mockAddEntry).toHaveBeenCalledWith({ type: 'note', characterName: 'Anonymous', noteText: 'x' });
  });
});
