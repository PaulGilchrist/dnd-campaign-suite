import { screen } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { hp, q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

describe('Log', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  // ── HpChangeEntry - basic damage ─────────────────────
  describe('HpChangeEntry - basic damage', () => {
    it('renders damage icon, character name, and HP display', () => {
      setup(Log, [hp({ delta: -5, currentHp: 20, maxHp: 25 })]);
      expect(screen.getByText(/Takes Damage/i)).toBeInTheDocument();
      expect(q('.log-hp-damage i.fa-heart-crack')).toBeInTheDocument();
      expect(q('.log-character')).toHaveTextContent('Gimli');
      expect(screen.getByText(/20\/25/i)).toBeInTheDocument();
      expect(q('.log-hp-current')).toBeInTheDocument();
    });

    it('handles large negative delta', () => {
      setup(Log, [hp({ delta: -50, currentHp: 0, maxHp: 100 })]);
      expect(screen.getByText(/Takes Damage/i)).toBeInTheDocument();
      expect(screen.getByText(/0\/100/i)).toBeInTheDocument();
    });
  });

  // ── HpChangeEntry - healing ─────────────────────────
  describe('HpChangeEntry - healing', () => {
    it('renders healing icon and label without source', () => {
      setup(Log, [hp({ delta: 8 })]);
      expect(screen.getByText(/Healed/i)).toBeInTheDocument();
      expect(q('.log-healing i.fa-heart')).toBeInTheDocument();
    });

    it('renders source name in parentheses when set', () => {
      setup(Log, [hp({ delta: 8, sourceName: 'Cleric' })]);
      expect(screen.getByText(/Healed \(Cleric\)/i)).toBeInTheDocument();
    });

    it('renders note text for non-damage entries', () => {
      setup(Log, [hp({ delta: 6, note: '1d8+2' })]);
      expect(screen.getByText(/Healed/i)).toBeInTheDocument();
      expect(q('.log-dice-formula')).toHaveTextContent('1d8+2');
    });

    it('renders maximizeHealingDice indicator for non-damage', () => {
      setup(Log, [hp({ delta: 10, maximizeHealingDice: true })]);
      expect(screen.getByText(/Dice maximized by Supreme Healing/i)).toBeInTheDocument();
    });
  });

  // ── HpChangeEntry - temporary HP ────────────────────
  describe('HpChangeEntry - temporary HP', () => {
    it('renders shield icon and "Temporary Hit Points" label', () => {
      setup(Log, [hp({ delta: 5, isTempHp: true })]);
      expect(screen.getByText(/Temporary Hit Points/i)).toBeInTheDocument();
      expect(q('.log-temp-hp i.fa-shield')).toBeInTheDocument();
    });
  });

  // ── HpChangeEntry - unconscious ─────────────────────
  describe('HpChangeEntry - unconscious', () => {
    it('shows "Knocked Unconscious" prefix with damage', () => {
      setup(Log, [hp({ delta: -10, isUnconscious: true })]);
      expect(screen.getByText(/Knocked Unconscious/i)).toBeInTheDocument();
      expect(screen.getByText(/Takes Damage/i)).toBeInTheDocument();
    });
  });

  // ── HpChangeEntry - NPC thresholds ──────────────────
  describe('HpChangeEntry - NPC thresholds', () => {
    it('dead/bloodied/recovering thresholds show correct labels', () => {
      setup(Log, [hp({ delta: -20, threshold: 'dead' })]);
      expect(screen.getByText(/Defeated/i)).toBeInTheDocument();
      setup(Log, [hp({ delta: -15, threshold: 'bloodied' })]);
      expect(screen.getByText(/Bloodied/i)).toBeInTheDocument();
      setup(Log, [hp({ delta: 10, threshold: 'recovering' })]);
      expect(screen.getByText(/Recovering/i)).toBeInTheDocument();
    });
  });
});
