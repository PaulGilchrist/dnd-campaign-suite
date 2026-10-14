import { screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { enc, q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

describe('Log - EncounterEntry rendering', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  describe('started encounter', () => {
    it('renders encounter name, skull icon, monster list, and CSS classes', () => {
      setup(Log, [enc({ action: 'started', monsters: ['Gob x4', 'Troll'] })]);
      expect(screen.getByText(/Encounter Started/i)).toBeInTheDocument();
      expect(q('.log-encounter i.fa-skull')).toBeInTheDocument();
      expect(q('.log-entry.log-encounter.log-encounter-start')).toBeInTheDocument();
      expect(q('.log-encounter-name')).toHaveTextContent(/Orc Ambush/i);
      expect(screen.getByText(/Gob x4/i)).toBeInTheDocument();
      expect(q('.log-encounter-monster')).toBeInTheDocument();
    });

    it('renders timestamp', () => {
      setup(Log, [enc({ action: 'started', timestamp: 1700000000000 })]);
      expect(q('.log-time')).toBeInTheDocument();
    });

    it('renders without monsters when monsters is falsy or empty', () => {
      setup(Log, [enc({ action: 'started', monsters: [] })]);
      expect(screen.getByText(/Encounter Started/i)).toBeInTheDocument();
      expect(q('.log-encounter-monsters')).not.toBeInTheDocument();

      setup(Log, [enc({ action: 'started', monsters: undefined })]);
      expect(q('.log-encounter-monsters')).not.toBeInTheDocument();
    });
  });

  describe('completed encounter', () => {
    it('renders encounter completed text, trophy icon, XP, loot items, and CSS classes', () => {
      setup(Log, [enc({ action: 'completed', xpPerChar: 750, lootItems: ['Sword'] })]);
      expect(screen.getByText(/Encounter Completed/i)).toBeInTheDocument();
      expect(q('.log-encounter i.fa-trophy')).toBeInTheDocument();
      expect(q('.log-entry.log-encounter.log-encounter-end')).toBeInTheDocument();
      expect(screen.getByText(/750 XP per character/i)).toBeInTheDocument();
      expect(q('.log-encounter-xp i.fa-star')).toBeInTheDocument();
      expect(screen.getByText(/Sword/i)).toBeInTheDocument();
      expect(q('.log-encounter-loot-item')).toBeInTheDocument();
    });

    it('hides XP display when xpPerChar is zero or negative', () => {
      setup(Log, [enc({ action: 'completed', xpPerChar: 0 })]);
      expect(screen.queryByText(/XP per character/i)).not.toBeInTheDocument();

      setup(Log, [enc({ action: 'completed', xpPerChar: -100 })]);
      expect(screen.queryByText(/XP per character/i)).not.toBeInTheDocument();
    });

    it('hides loot list when lootItems is falsy or empty', () => {
      setup(Log, [enc({ action: 'completed', lootItems: [] })]);
      expect(q('.log-encounter-loot')).not.toBeInTheDocument();

      setup(Log, [enc({ action: 'completed', lootItems: undefined })]);
      expect(q('.log-encounter-loot')).not.toBeInTheDocument();
    });
  });
});
