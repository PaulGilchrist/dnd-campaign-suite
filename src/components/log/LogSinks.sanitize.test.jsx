// @maintained-by-ai
// SANITIZE-AT-SINK lane (backlog 2026-10-30-AO log-description-raw-html-sink-audit) —
// the four log sinks that render entry.description via dangerouslySetInnerHTML
// (AbilityUseEntry, SpellEntry, SaveResultEntry, SummonsEntry) must route the
// string through services/ui/sanitize.js BEFORE injection: producers interpolate
// GM-authored strings (custom NPC display names, custom-NPC action text) into
// descriptions, so the sink is the security boundary.
//
// Like popup.test.jsx, sanitize.js is intentionally NOT mocked — jsdom runs the
// real DOMPurify here, so these pins prove the components actually route through
// it (attack vectors go inert) AND that legitimate automation markup
// (bold/italic/links/paragraphs used by existing rows) still renders formatted,
// never double-escaped. NoteEntry's plain-text {noteText} is owned by LogNotes.

import { beforeEach, afterEach, it, describe, expect, vi } from 'vitest';
import {
  spell, saveResult, summons,
  q, setup, beforeEachSetup,
} from './log-test-utils.jsx';

import Log from './Log.jsx';

// ability_use has no shared factory in log-test-utils (leaf lanes inline it).
const abilityUse = (o = {}) => ({
  id: 'au', type: 'ability_use', characterName: 'Frodo', abilityName: 'Rage',
  timestamp: 1700000000000, ...o,
});

// Mirrors the sink selector map: [label, entry factory, description span class].
const SINKS = [
  ['ability_use', abilityUse, '.log-ability-description'],
  ['spell', spell, '.log-spell-description'],
  ['save_result', saveResult, '.log-save-result-description'],
  ['summons', summons, '.log-summons-description'],
];

// Evil payload: script + event-handler img must go inert (tag removed by the
// sanitizer's tag allow-list / attribute strip); the bold leg must survive as
// live formatting, proving no escape-everything over-sanitization.
const EVIL = '<script>alert(1)</script><img src=x onerror=alert(1)>QA IMP evil <b>bold</b>';

describe('log description sinks sanitize entry.description before injection', () => {
  let consoleError;

  beforeEach(() => {
    beforeEachSetup();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it.each(SINKS)('%s: evil description renders inert text, zero live script/img nodes',
    (_label, makeEntry, selector) => {
      setup(Log, [makeEntry({ description: EVIL })]);
      const sink = q(selector);
      expect(sink).toBeInTheDocument();
      // Attack nodes never reach the DOM at all.
      expect(sink.querySelector('script')).toBeNull();
      expect(sink.querySelector('img')).toBeNull();
      expect(sink.innerHTML).not.toMatch(/onerror/i);
      // What remains is plain inert text plus the allowed bold leg.
      expect(sink.textContent).toBe('QA IMP evil bold');
      expect(consoleError).not.toHaveBeenCalled();
    });

  it.each(SINKS)('%s: legitimate automation markup renders formatted, not double-escaped',
    (_label, makeEntry, selector) => {
      setup(Log, [makeEntry({
        description: '<p>Hit a <b>critical</b> <em>target</em> — <a href="https://example.com">details</a></p>',
      })]);
      const sink = q(selector);
      expect(sink.querySelector('p')).toBeInTheDocument();
      expect(sink.querySelector('b')).toHaveTextContent('critical');
      expect(sink.querySelector('em')).toHaveTextContent('target');
      const link = sink.querySelector('a');
      expect(link).toHaveAttribute('href', 'https://example.com');
      // No escaped bytes leaking through as visible text.
      expect(sink.textContent).not.toContain('&lt;');
      expect(sink.textContent).not.toContain('<b>');
    });
});
