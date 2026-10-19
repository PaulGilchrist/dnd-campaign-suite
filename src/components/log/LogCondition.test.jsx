// @maintained-by-ai
// ConditionEntry render contract (#862 polarity oracle): condition log entries render
// exact bytes per entry shape. Producer payload bytes are owned/cited in their lanes
// (logConditionEvent producers: saveResultHandlers.js:44, createRollConditionSaveHandler.js:34,
// createAutoBreakConditionHandler.js:29 — action:'removed'|'broken'|'kept'; save_result bytes #871).
// Renders through the Log container via the family's shared consumer-retained useLog fake
// (zero-network, deterministic); dispatch/unknown-type legs live in LogEntryRendering.test.jsx.
import { beforeEach } from 'vitest';
import { cond, q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

const TS = 1750000000000; // fixed timestamp — never Date.now() in assertions

describe('Log > ConditionEntry', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('applied entry renders full byte contract: icon, classes, actor, label, condition, DC, ability, time', () => {
    setup(Log, [cond({ timestamp: TS, action: 'applied', condition: 'charmed', dc: 15, ability: 'wisdom', sourceName: 'Aboleth' })]);
    expect(q('.log-entry')).toHaveClass('log-entry', 'log-condition', 'log-condition-applied');
    expect(q('.log-icon i')).toHaveClass('fa-circle-exclamation');
    expect(q('.log-character')).toHaveTextContent('Gollum');
    expect(q('.log-name')).toHaveTextContent('Condition Applied');
    expect(q('.log-condition-name')).toHaveTextContent('charmed');
    expect(q('.log-condition-dc')).toHaveTextContent('DC 15');
    expect(q('.log-condition-ability')).toHaveTextContent('WISDOM save');
    expect(q('.log-time').textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
    // source span is broken-leg-only, even when authored on an applied entry
    expect(q('.log-condition-source')).not.toBeInTheDocument();
  });

  it('broken entry renders check icon, broken label, and "by <source>"; DC/ability legs suppressed', () => {
    setup(Log, [cond({ timestamp: TS, action: 'broken', sourceName: 'Hero Potion', dc: 15, ability: 'wisdom' })]);
    expect(q('.log-entry')).toHaveClass('log-entry', 'log-condition', 'log-condition-broken');
    expect(q('.log-icon i')).toHaveClass('fa-circle-check');
    expect(q('.log-character')).toHaveTextContent('Gollum');
    expect(q('.log-name')).toHaveTextContent('Condition Broken');
    expect(q('.log-condition-name')).toHaveTextContent('charmed');
    expect(q('.log-condition-source')).toHaveTextContent('by Hero Potion');
    expect(q('.log-condition-dc')).not.toBeInTheDocument();
    expect(q('.log-condition-ability')).not.toBeInTheDocument();
  });

  it.each([
    ['applied', { dc: 0 }, '.log-condition-dc', '.log-condition-ability', 'WISDOM save'],
    ['applied', { ability: '' }, '.log-condition-ability', '.log-condition-dc', 'DC 13'],
    ['broken', { sourceName: '' }, '.log-condition-source', '.log-condition-name', 'charmed'],
  ])('%s with falsy field hides %s while sibling renders distinct byte "%s"', (action, override, hiddenSel, siblingSel, siblingText) => {
    setup(Log, [cond({ timestamp: TS, action, ...override })]);
    expect(q(hiddenSel)).not.toBeInTheDocument();
    expect(q(siblingSel)).toHaveTextContent(siblingText);
  });

  it('non-applied producer byte "removed" falls through to the broken leg (producers emit removed, not broken)', () => {
    setup(Log, [cond({ timestamp: TS, action: 'removed', sourceName: 'Long Rest', dc: 0, ability: '' })]);
    expect(q('.log-entry')).toHaveClass('log-condition-broken');
    expect(q('.log-icon i')).toHaveClass('fa-circle-check');
    expect(q('.log-name')).toHaveTextContent('Condition Broken');
    expect(q('.log-condition-source')).toHaveTextContent('by Long Rest');
    expect(q('.log-condition-dc')).not.toBeInTheDocument();
    expect(q('.log-condition-ability')).not.toBeInTheDocument();
  });
});
