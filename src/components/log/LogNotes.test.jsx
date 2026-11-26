// @maintained-by-ai 2026-10-19
// NOTE lane — canonical home for note content AND the add-note flow (Log.jsx).
// REC #884: absorbed the NoteEntry content census retained in LogEntryRendering.test.jsx
// (its #879 custom-values pin migrated here verbatim-in-face — that lane should drop its
// retained note test at its next re-touch; it keeps only the .log-note routing marker byte).
// Transport (useLog/addEntry) is mocked at its seam, consumers-exact (#875 style):
// we pin the FULL dispatched payload, never objectContaining, and count dispatches
// (short-circuit-0 leak watch, #882). Timestamps: fixed TS, regex-pinned HH:MM:SS
// (#876 family convention). Toolbar combobox presence/census is owned by
// LogToolbar.test.jsx — not re-pinned here.
//
// 2026-11-21 author-authority law: Anonymous dispatch is DEAD — every compose
// payload names a real author (GM default on localhost, first player on a
// visitor tab). Narrative dispatch (GM type select) is owned here too.

import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { q, setup, note, beforeEachSetup, mockAddEntry, mockState } from './log-test-utils.jsx';

import Log from './Log.jsx';

const textarea = () => screen.getByPlaceholderText('Add a note to the log...');
const authorSelect = () => screen.getByLabelText('Post as:');
const typeSelect = () => screen.getByLabelText('As:');

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

  it('renders the active-session badge only when the row carries a session stamp', () => {
    setup(Log, [
      note({ id: 's1', characterName: 'Frodo', session: 'Session 3 — The Long Dark' }),
      note({ id: 's2', characterName: 'Aragorn', session: null }),
    ]);
    const badges = document.querySelectorAll('.log-entry-session');
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe('Session 3 — The Long Dark');
  });

  // ── ADD-NOTE FLOW ──
  it('submits exact payload with trimmed text and selected author, then clears the textarea', async () => {
    setup(Log, []);
    fireEvent.change(textarea(), { target: { value: ' Hello ' } });
    fireEvent.change(authorSelect(), { target: { value: 'Aragorn' } });
    fireEvent.click(q('.log-add-btn'));
    await waitFor(() => {
      expect(mockAddEntry).toHaveBeenCalledTimes(1);
      // settle past the awaited addEntry so the post-submit clear is observed in act
      expect(textarea()).toHaveValue('');
    });
    expect(mockAddEntry).toHaveBeenCalledWith({ type: 'note', characterName: 'Aragorn', noteText: 'Hello' });
  });

  it('GM tab defaults the author to GM and dispatches under that name', async () => {
    setup(Log, [], true, []);
    fireEvent.change(textarea(), { target: { value: 'hi' } });
    fireEvent.click(q('.log-add-btn'));
    await vi.waitFor(() => {
      expect(mockAddEntry).toHaveBeenCalledWith({ type: 'note', characterName: 'GM', noteText: 'hi' });
    });
  });

  it('visitor dispatches under the selected player only (no GM/Anonymous voice exists)', async () => {
    setup(Log, [], true, undefined, false);
    fireEvent.change(textarea(), { target: { value: 'by the fire' } });
    fireEvent.change(authorSelect(), { target: { value: 'Aragorn' } });
    fireEvent.click(q('.log-add-btn'));
    await vi.waitFor(() => {
      expect(mockAddEntry).toHaveBeenCalledWith({ type: 'note', characterName: 'Aragorn', noteText: 'by the fire' });
    });
  });

  it('GM posting as an Initiative-group creature dispatches under that monster name', async () => {
    mockState.combatSummary = { creatures: [{ name: 'Goblin' }] };
    setup(Log, []);
    await vi.waitFor(() => {
      expect(within(authorSelect()).getByRole('option', { name: 'Goblin' })).toBeInTheDocument();
    });
    fireEvent.change(authorSelect(), { target: { value: 'Goblin' } });
    fireEvent.change(textarea(), { target: { value: 'Goblin talks' } });
    fireEvent.click(q('.log-add-btn'));
    await vi.waitFor(() => {
      expect(mockAddEntry).toHaveBeenCalledWith({ type: 'note', characterName: 'Goblin', noteText: 'Goblin talks' });
    });
  });

  it('visitor with zero characters: disabled composer dispatches nothing', () => {
    setup(Log, [], true, [], false);
    fireEvent.change(textarea(), { target: { value: 'hello?' } });
    fireEvent.click(q('.log-add-btn'));
    expect(mockAddEntry).not.toHaveBeenCalled();
  });

  // ── NARRATIVE DISPATCH (GM type select, canonical `description` field) ──
  it('GM narrative face dispatches exact payload with type narrative and description text', async () => {
    setup(Log, []);
    fireEvent.change(typeSelect(), { target: { value: 'narrative' } });
    fireEvent.change(screen.getByPlaceholderText('Add to the story...'), { target: { value: ' The gate groans open. ' } });
    fireEvent.click(q('.log-add-btn'));
    await vi.waitFor(() => {
      expect(mockAddEntry).toHaveBeenCalledTimes(1);
    });
    expect(mockAddEntry).toHaveBeenCalledWith({ type: 'narrative', characterName: 'GM', description: 'The gate groans open.' });
  });

  // ── COMPOSER LANE COPY (placeholder + Post button voice follow composeType) ──
  it('composer copy switches to story-voice on Narrative and back to note-voice on Note', () => {
    setup(Log, []);
    const noteArea = textarea();
    expect(noteArea).toHaveAttribute('placeholder', 'Add a note to the log...');
    let btn = q('.log-add-btn');
    expect(btn).toHaveAttribute('title', 'Post note');
    expect(btn).toHaveAttribute('aria-label', 'Post note');

    fireEvent.change(typeSelect(), { target: { value: 'narrative' } });
    const storyArea = screen.getByPlaceholderText('Add to the story...');
    expect(storyArea).toBeInTheDocument();
    expect(noteArea).toBe(storyArea); // same element, placeholder attribute swapped
    btn = q('.log-add-btn');
    expect(btn).toHaveAttribute('title', 'Post narrative');
    expect(btn).toHaveAttribute('aria-label', 'Post narrative');

    fireEvent.change(typeSelect(), { target: { value: 'note' } });
    expect(textarea()).toHaveAttribute('placeholder', 'Add a note to the log...');
    btn = q('.log-add-btn');
    expect(btn).toHaveAttribute('title', 'Post note');
    expect(btn).toHaveAttribute('aria-label', 'Post note');
  });

  it('As: select tooltip is unchanged across lane faces', () => {
    setup(Log, []);
    const asTooltip = 'Notes are shared tabletop chatter; narrative is GM/storytelling prose';
    expect(typeSelect()).toHaveAttribute('title', asTooltip);
    fireEvent.change(typeSelect(), { target: { value: 'narrative' } });
    expect(typeSelect()).toHaveAttribute('title', asTooltip);
  });

  it('visitor (no As: select) keeps note-voice copy verbatim', () => {
    setup(Log, [], true, undefined, false);
    expect(screen.queryByLabelText('As:')).not.toBeInTheDocument();
    expect(textarea()).toHaveAttribute('placeholder', 'Add a note to the log...');
    const btn = q('.log-add-btn');
    expect(btn).toHaveAttribute('title', 'Post note');
    expect(btn).toHaveAttribute('aria-label', 'Post note');
  });

  // ── SHORT-CIRCUITS ──
  it('short-circuits whitespace input: zero dispatches, textarea preserved', () => {
    setup(Log, []);
    fireEvent.change(textarea(), { target: { value: '   ' } });
    fireEvent.click(q('.log-add-btn'));
    expect(mockAddEntry).not.toHaveBeenCalled();
    expect(textarea()).toHaveValue('   ');
  });

  // ── DISABLE-UNTIL-VALID POST BUTTON (`.ct-*` Save canon) ──
  it('post button is disabled when empty and whitespace-only, enabled with text, disabled again on clear', () => {
    setup(Log, []);
    const btn = q('.log-add-btn');
    expect(btn).toBeDisabled();
    fireEvent.change(textarea(), { target: { value: '   ' } });
    expect(btn).toBeDisabled();
    fireEvent.change(textarea(), { target: { value: 'note' } });
    expect(btn).not.toBeDisabled();
    fireEvent.change(textarea(), { target: { value: '' } });
    expect(btn).toBeDisabled();
  });

  it('clicking the disabled (empty-composer) button fires zero dispatches', () => {
    setup(Log, []);
    fireEvent.click(q('.log-add-btn'));
    expect(mockAddEntry).not.toHaveBeenCalled();
  });

  // ── ACCESSIBLE NAME (icon-only button, `.toolbar-*` title+aria canon) ──
  it('post button carries verbatim accessible name in disabled and enabled states', () => {
    setup(Log, []);
    const btn = q('.log-add-btn');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-label', 'Post note');
    expect(btn).toHaveAttribute('title', 'Post note');
    fireEvent.change(textarea(), { target: { value: 'note' } });
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveAttribute('aria-label', 'Post note');
    expect(btn).toHaveAttribute('title', 'Post note');
  });

  it('plain Enter never submits; Ctrl+Enter submits exact payload as the default GM author', async () => {
    setup(Log, []);
    const box = textarea();
    fireEvent.change(box, { target: { value: 'x' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(mockAddEntry).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
    await vi.waitFor(() => {
      expect(mockAddEntry).toHaveBeenCalledTimes(1);
    });
    expect(mockAddEntry).toHaveBeenCalledWith({ type: 'note', characterName: 'GM', noteText: 'x' });
  });
});
