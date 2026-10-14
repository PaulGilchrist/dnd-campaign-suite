import { screen } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { cond, q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

describe('Log', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  describe('ConditionEntry', () => {
    it('applied action renders warning icon, CSS classes, and entry text', () => {
      setup(Log, [cond({ action: 'applied' })]);
      expect(screen.getByText(/Condition Applied/i)).toBeInTheDocument();
      expect(q('.log-condition i.fa-circle-exclamation')).toBeInTheDocument();
      expect(q('.log-entry.log-condition.log-condition-applied')).toBeInTheDocument();
    });

    it('applied action shows condition name, DC, and ability save when present', () => {
      setup(Log, [cond({ action: 'applied', dc: 15, ability: 'wisdom' })]);
      expect(q('.log-condition-name')).toHaveTextContent(/charmed/i);
      expect(screen.getByText(/DC 15/i)).toBeInTheDocument();
      expect(q('.log-condition-ability')).toHaveTextContent(/WISDOM save/i);
    });

    it('applied action hides DC element when dc is falsy', () => {
      setup(Log, [cond({ action: 'applied', dc: 0 })]);
      expect(q('.log-condition-dc')).not.toBeInTheDocument();
    });

    it('applied action hides ability element when ability is falsy', () => {
      setup(Log, [cond({ action: 'applied', ability: '' })]);
      expect(q('.log-condition-ability')).not.toBeInTheDocument();
    });

    it('broken action renders check icon, CSS classes, and entry text', () => {
      setup(Log, [cond({ action: 'broken' })]);
      expect(screen.getByText(/Condition Broken/i)).toBeInTheDocument();
      expect(q('.log-condition i.fa-circle-check')).toBeInTheDocument();
      expect(q('.log-entry.log-condition.log-condition-broken')).toBeInTheDocument();
    });

    it('broken action shows source when sourceName is present', () => {
      setup(Log, [cond({ action: 'broken', sourceName: 'Hero Potion' })]);
      expect(q('.log-condition-source')).toBeInTheDocument();
    });

    it('broken action hides source element when sourceName is empty', () => {
      setup(Log, [cond({ action: 'broken', sourceName: '' })]);
      expect(q('.log-condition-source')).not.toBeInTheDocument();
    });
  });
});
