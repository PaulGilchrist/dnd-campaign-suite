import { screen } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { loot, q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

describe('LogLootEntry', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  // ── BASIC RENDERING ──────────────────────
  describe('basic rendering', () => {
    it('renders the coins icon', () => {
      setup(Log, [loot()]);
      expect(q('.log-loot i.fa-coins')).toBeInTheDocument();
    });

    it('renders the title text', () => {
      setup(Log, [loot()]);
      expect(screen.getByText(/Loot & XP Awarded/i)).toBeInTheDocument();
    });
  });

  // ── XP DISPLAY ───────────────────────────
  describe('XP display', () => {
    it('formats XP with locale separator and shows star icon', () => {
      setup(Log, [loot({ xpPerChar: 1500 })]);
      expect(screen.getByText(/1,500 XP per character/i)).toBeInTheDocument();
      expect(q('.log-loot-xp i.fa-star')).toBeInTheDocument();
    });

    it('formats large XP values with proper locale', () => {
      setup(Log, [loot({ xpPerChar: 1000000 })]);
      expect(screen.getByText(/1,000,000 XP per character/i)).toBeInTheDocument();
    });

    it('hides XP section when xpPerChar is falsy or negative', () => {
      setup(Log, [loot({ xpPerChar: 0 })]);
      expect(q('.log-loot-xp')).not.toBeInTheDocument();
      expect(screen.queryByText(/XP per character/i)).not.toBeInTheDocument();

      setup(Log, [loot({ xpPerChar: null })]);
      expect(q('.log-loot-xp')).not.toBeInTheDocument();

      setup(Log, [loot({ xpPerChar: undefined })]);
      expect(q('.log-loot-xp')).not.toBeInTheDocument();

      setup(Log, [loot({ xpPerChar: -100 })]);
      expect(q('.log-loot-xp')).not.toBeInTheDocument();

      setup(Log, [loot({})]);
      expect(q('.log-loot-xp')).not.toBeInTheDocument();
    });
  });

  // ── LOOT ITEMS DISPLAY ───────────────────
  describe('loot items display', () => {
    it('renders each loot item as a list item', () => {
      setup(Log, [loot({ lootItems: ['Ring of Protection', 'Potion of Healing'] })]);
      expect(document.querySelectorAll('.log-loot-item').length).toBe(2);
      expect(screen.getByText('Ring of Protection')).toBeInTheDocument();
      expect(screen.getByText('Potion of Healing')).toBeInTheDocument();
    });

    it('renders a single loot item', () => {
      setup(Log, [loot({ lootItems: ['Gold Sword'] })]);
      expect(document.querySelectorAll('.log-loot-item').length).toBe(1);
      expect(screen.getByText('Gold Sword')).toBeInTheDocument();
    });

    it('hides the items list when lootItems is falsy or empty', () => {
      setup(Log, [loot({ lootItems: [] })]);
      expect(q('.log-loot-items')).not.toBeInTheDocument();

      setup(Log, [loot({ lootItems: null })]);
      expect(q('.log-loot-items')).not.toBeInTheDocument();

      setup(Log, [loot({ lootItems: undefined })]);
      expect(q('.log-loot-items')).not.toBeInTheDocument();

      setup(Log, [loot({})]);
      expect(q('.log-loot-items')).not.toBeInTheDocument();
    });
  });

  // ── COMBINED XP + ITEMS ──────────────────
  describe('combined XP and items', () => {
    it('renders both XP and loot items in the same entry', () => {
      setup(Log, [loot({ xpPerChar: 500, lootItems: ['Gold', 'Scroll'] })]);
      expect(screen.getByText(/500 XP per character/i)).toBeInTheDocument();
      expect(q('.log-loot-xp i.fa-star')).toBeInTheDocument();
      expect(document.querySelectorAll('.log-loot-item').length).toBe(2);
      expect(q('.log-loot-items')).toBeInTheDocument();
    });
  });
});
