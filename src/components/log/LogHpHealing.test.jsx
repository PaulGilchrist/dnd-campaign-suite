import { screen } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { hp, heal, q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

describe('Log', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  // ── HpChangeEntry - damage breakdown ──────────────────

  describe('HpChangeEntry - damage breakdown', () => {
    it('renders damage breakdown with resistance and immunity badges', () => {
      setup(Log, [hp({
        delta: -10,
        damageBreakdown: [
          { damageType: 'fire', status: 'resistant' },
          { damageType: 'cold', status: 'immune' },
        ],
      })]);
      expect(screen.getByText(/10 HP/i)).toBeInTheDocument();
      expect(screen.getByText(/fire/i)).toBeInTheDocument();
      expect(screen.getByText(/cold/i)).toBeInTheDocument();
      expect(screen.getByText(/Resistance/i)).toBeInTheDocument();
      expect(screen.getByText(/Immune/i)).toBeInTheDocument();
      expect(document.querySelectorAll('.log-damage-breakdown-item').length).toBe(2);
    });
  });

  // ── HealingEntry - resurrection ───────────────────────

  describe('HealingEntry - resurrection', () => {
    it('renders resurrection badge and "Brought Back to Life"', () => {
      setup(Log, [heal({
        resurrection: true,
        amount: 25,
        sourceName: 'Cleric',
      })]);
      expect(screen.getByText(/Brought Back to Life/i)).toBeInTheDocument();
      expect(screen.getByText(/Resurrection/i)).toBeInTheDocument();
      expect(screen.getByText(/Returns to life with 25 HP/i)).toBeInTheDocument();
      expect(q('.log-entry.log-healing.log-resurrection')).toBeInTheDocument();
      expect(q('.log-healing i.fa-dove')).toBeInTheDocument();
    });

    it('renders popupText when present', () => {
      setup(Log, [heal({
        resurrection: true,
        amount: 30,
        popupText: 'You feel the warmth of life returning.',
      })]);
      expect(screen.getByText(/You feel the warmth/i)).toBeInTheDocument();
    });
  });
});
