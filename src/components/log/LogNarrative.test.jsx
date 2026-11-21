// @maintained-by-ai
// NARRATIVE lane — LogNarrativeEntry.jsx content census (real DOMPurify/marked
// like LogSinks.sanitize.test.jsx, so these pins prove the row actually routes
// through the sanitizer, not a stub). Narrative rows are the GM/AI storytelling
// half of the log (owner vision 2026-11-21: prose the recap generator will
// mine), canonical text field `description`, speaker label `name` optional.

import { beforeEach } from 'vitest';
import { q, setup, narrative, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

describe('Log narrative entries', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('routes narrative rows to the prose renderer with author, speaker, time, and feather icon', () => {
    setup(Log, [narrative({ characterName: 'GM', name: 'Mira', description: 'Trouble follows you.', timestamp: 1700000000000 })]);
    expect(q('.log-entry.log-narrative')).toBeInTheDocument();
    expect(q('.log-narrative .log-character').textContent).toBe('GM');
    expect(q('.log-narrative-speaker').textContent).toBe('Mira');
    expect(q('.log-narrative .log-time').textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(q('.log-narrative i.fa-feather-pointed')).toBeInTheDocument();
    // marked wraps prose in a <p> — the trailing newline is the block markup.
    expect(q('.log-narrative-text').textContent.trim()).toBe('Trouble follows you.');
  });

  it('renders markdown prose (bold/italic via marked) through the sanitizer', () => {
    setup(Log, [narrative({ description: 'The **gate** groans *open*.' })]);
    const body = q('.log-narrative-text');
    expect(body.querySelector('strong').textContent).toBe('gate');
    expect(body.querySelector('em').textContent).toBe('open');
  });

  it('strips script payloads — prose is never an XSS lane', () => {
    setup(Log, [narrative({ description: 'Darkness <script>window.__pwn = 1</script> falls.' })]);
    const body = q('.log-narrative-text');
    expect(body.querySelector('script')).toBeNull();
    expect(body.innerHTML).not.toContain('script');
    expect(body.textContent).toContain('Darkness');
  });

  it('omits the speaker label when the producer names none (recap/rumor/event rows)', () => {
    setup(Log, [narrative({ name: undefined })]);
    expect(q('.log-narrative-speaker')).toBeNull();
  });

  it('renders the active-session stamp badge when the row carries one', () => {
    setup(Log, [narrative({ session: 'Session 3 — The Long Dark' })]);
    expect(q('.log-narrative .log-entry-session').textContent).toBe('Session 3 — The Long Dark');
  });
});
