// @maintained-by-ai
// ConditionEntry render contract (#862 polarity oracle): condition log entries render
// exact bytes per entry shape. Producer payload bytes are owned/cited in their lanes
// (logConditionEvent producers: saveResultHandlers.js:44, createRollConditionSaveHandler.js:34,
// createAutoBreakConditionHandler.js:29 — action:'broken'; kept/maintained producers #876; save_result bytes #871).
// Renders through the Log container via the family's shared consumer-retained useLog fake
// (zero-network, deterministic); dispatch/unknown-type legs live in LogEntryRendering.test.jsx.
import { beforeEach, vi } from 'vitest';
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

  // #876: a kept condition (e.g. failed Ray of Enfeeblement repeat save) must render its own honest
  // label — NOT the broken leg. Full producer action enum census lives in LogConditionEntry.jsx.
  describe('kept leg (#876)', () => {
    it('action "kept" renders "Condition Maintained" with kept class — distinguishable from broken/applied', () => {
      setup(Log, [cond({ timestamp: TS, action: 'kept', condition: 'Ray of Enfeeblement debuff', dc: 13, ability: 'wisdom', sourceName: 'Merlin' })]);
      expect(q('.log-entry')).toHaveClass('log-entry', 'log-condition', 'log-condition-kept');
      expect(q('.log-entry')).not.toHaveClass('log-condition-broken');
      expect(q('.log-entry')).not.toHaveClass('log-condition-applied');
      expect(q('.log-icon i')).toHaveClass('fa-link');
      expect(q('.log-icon i')).not.toHaveClass('fa-circle-check');
      expect(q('.log-icon i')).not.toHaveClass('fa-circle-exclamation');
      expect(q('.log-name')).toHaveTextContent('Condition Maintained');
      expect(q('.log-name')).not.toHaveTextContent('Condition Broken');
      expect(q('.log-condition-name')).toHaveTextContent('Ray of Enfeeblement debuff');
      // kept is neither applied-leg (dc/ability) nor silently broken — source tag names the maintainer
      expect(q('.log-condition-dc')).not.toBeInTheDocument();
      expect(q('.log-condition-ability')).not.toBeInTheDocument();
      expect(q('.log-condition-source')).toHaveTextContent('by Merlin');
    });

    it('action "maintained" (applyDamage.js:181) renders the same kept bytes as "kept"', () => {
      setup(Log, [cond({ timestamp: TS, action: 'maintained' })]);
      expect(q('.log-entry')).toHaveClass('log-condition-kept');
      expect(q('.log-icon i')).toHaveClass('fa-link');
      expect(q('.log-name')).toHaveTextContent('Condition Maintained');
    });

    it('action "ended" renders its own honest label, not "Condition Broken"', () => {
      setup(Log, [cond({ timestamp: TS, action: 'ended', sourceName: 'Hurl Through Hell' })]);
      expect(q('.log-entry')).toHaveClass('log-condition-broken');
      expect(q('.log-icon i')).toHaveClass('fa-circle-check');
      expect(q('.log-name')).toHaveTextContent('Condition Ended');
      expect(q('.log-condition-source')).toHaveTextContent('by Hurl Through Hell');
    });

    it.each([
      ['target-effect-applied', 'Effect Applied', 'log-condition-applied', 'fa-circle-exclamation'],
      ['concentration-started', 'Concentration Started', 'log-condition-applied', 'fa-link'],
    ])('action "%s" renders applied-leg bytes "%s"/%s/%s (never the broken label)', (action, label, cls, icon) => {
      setup(Log, [cond({ timestamp: TS, action, condition: 'Bless', dc: 15, ability: 'wisdom' })]);
      expect(q('.log-entry')).toHaveClass(cls);
      expect(q('.log-icon i')).toHaveClass(icon);
      expect(q('.log-name')).toHaveTextContent(label);
      expect(q('.log-condition-dc')).toHaveTextContent('DC 15');
      expect(q('.log-condition-ability')).toHaveTextContent('WISDOM save');
    });

    it('turn_start_behavior renders neutral label/class, distinct from applied and broken', () => {
      setup(Log, [cond({ timestamp: TS, action: 'turn_start_behavior', condition: 'Confused' })]);
      expect(q('.log-entry')).toHaveClass('log-condition-neutral');
      expect(q('.log-icon i')).toHaveClass('fa-circle-question');
      expect(q('.log-name')).toHaveTextContent('Condition Behavior');
    });

    it('unknown action logs console.error and renders the neutral fallback — never a silent "Condition Broken"', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setup(Log, [cond({ timestamp: TS, action: 'quantum-tunneled' })]);
      expect(q('.log-entry')).toHaveClass('log-condition-neutral');
      expect(q('.log-entry')).not.toHaveClass('log-condition-broken');
      expect(q('.log-icon i')).toHaveClass('fa-circle-info');
      expect(q('.log-name')).toHaveTextContent('Condition Update');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('quantum-tunneled'), expect.anything());
      errorSpy.mockRestore();
    });

    it('every rendered label is distinguishable per action (#1348)', () => {
      const labelFor = (action) => {
        const { container } = setup(Log, [cond({ timestamp: TS, action })]);
        return container.querySelector('.log-name').textContent;
      };
      expect(labelFor('applied')).toBe('Condition Applied');
      expect(labelFor('target-effect-applied')).toBe('Effect Applied');
      expect(labelFor('concentration-started')).toBe('Concentration Started');
      expect(labelFor('kept')).toBe('Condition Maintained');
      expect(labelFor('maintained')).toBe('Condition Maintained');
      expect(labelFor('broken')).toBe('Condition Broken');
      expect(labelFor('removed')).toBe('Condition Broken');
      expect(labelFor('ended')).toBe('Condition Ended');
      expect(labelFor('turn_start_behavior')).toBe('Condition Behavior');
    });
  });
});
