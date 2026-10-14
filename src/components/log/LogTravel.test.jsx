import { screen } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { travel, q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

describe('Log', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  // ── TRAVEL ENTRY - action types ───────────────
  describe('TravelEntry - action types', () => {
    it.each([
      ['advance', 'Advanced to', 'fa-person-walking'],
      ['advance_with_event', 'Event triggered at', 'fa-bolt'],
      ['arrived', 'Arrived at', 'fa-flag-checkered'],
      ['camp', 'Camped at', 'fa-campground'],
      ['forced_march', 'Forced march at', 'fa-person-running'],
      ['event_accept', 'Accepted event at', 'fa-check'],
      ['event_skip', 'Skipped event at', 'fa-xmark'],
      ['event_reroll', 'Re-rolled event at', 'fa-dice'],
      ['extreme_weather', 'Weather halted travel at', 'fa-triangle-exclamation'],
      ['day_exhausted', 'Budget exhausted at', 'fa-tent'],
      ['cancel', 'Travel cancelled at', 'fa-ban'],
    ])('action %s -> label "%s" with icon .%s', (action, label, icon) => {
      setup(Log, [travel({ action })]);
      expect(screen.getByText(new RegExp(label, 'i'))).toBeInTheDocument();
      expect(q(`.log-travel i.${icon}`)).toBeInTheDocument();
    });

    it('unknown action falls back to advance config', () => {
      setup(Log, [travel({ action: 'bad' })]);
      expect(screen.getByText(/Advanced to/i)).toBeInTheDocument();
    });
  });

  // ── TRAVEL ENTRY - hex coordinates ───────────────
  describe('TravelEntry - hex coordinates', () => {
    it('renders hex coords when present', () => {
      setup(Log, [travel({ hex: { q: 5, r: -3 } })]);
      expect(screen.getByText(/\(5, -3\)/)).toBeInTheDocument();
    });

    it('does not render coords when hex is missing', () => {
      setup(Log, [travel({ hex: null })]);
      expect(screen.queryByText(/\(\d+, -?\d+\)/)).not.toBeInTheDocument();
    });
  });

  // ── TRAVEL ENTRY - terrain ───────────────
  describe('TravelEntry - terrain', () => {
    it('renders terrain with mountain icon when present', () => {
      setup(Log, [travel({ terrain: 'Mountain' })]);
      expect(screen.getByText(/Mountain/i)).toBeInTheDocument();
      expect(q('.log-travel-terrain i.fa-mountain')).toBeInTheDocument();
    });

    it('does not render terrain when missing', () => {
      setup(Log, [travel({ terrain: '' })]);
      expect(q('.log-travel-terrain')).not.toBeInTheDocument();
    });
  });

  // ── TRAVEL ENTRY - weather ───────────────
  describe('TravelEntry - weather', () => {
    it('renders weather with default sun icon when no weatherIcon provided', () => {
      setup(Log, [travel({ weather: 'Sunny' })]);
      expect(screen.getByText(/Sunny/i)).toBeInTheDocument();
      expect(q('.log-travel-weather i.fa-sun')).toBeInTheDocument();
    });

    it('renders weather with custom icon when weatherIcon provided', () => {
      setup(Log, [travel({ weather: 'Storms', weatherIcon: 'cloud-showers-heavy' })]);
      expect(q('.log-travel-weather i.fa-cloud-showers-heavy')).toBeInTheDocument();
    });

    it('does not render weather when missing', () => {
      setup(Log, [travel({ weather: '' })]);
      expect(q('.log-travel-weather')).not.toBeInTheDocument();
    });
  });

  // ── TRAVEL ENTRY - event ───────────────
  describe('TravelEntry - event', () => {
    it('renders event type and title when both present', () => {
      setup(Log, [travel({ eventTitle: 'Ambush!', eventType: 'Enemy' })]);
      expect(screen.getByText(/Ambush!/i)).toBeInTheDocument();
      expect(screen.getByText(/Enemy/i)).toBeInTheDocument();
    });

    it('does not render event section when eventTitle is missing', () => {
      setup(Log, [travel({ eventTitle: '' })]);
      expect(q('.log-travel-event')).not.toBeInTheDocument();
    });
  });

  // ── TRAVEL ENTRY - timestamp ───────────────
  describe('TravelEntry - timestamp', () => {
    it('renders formatted timestamp', () => {
      const ts = new Date('2024-01-15T14:30:45').getTime();
      setup(Log, [travel({ timestamp: ts })]);
      expect(q('.log-time')).toBeInTheDocument();
    });
  });

  // ── TRAVEL ENTRY - minimal entry ───────────────
  describe('TravelEntry - minimal entry', () => {
    it('renders with only action field', () => {
      setup(Log, [travel({})]);
      expect(screen.getByText(/Advanced to/i)).toBeInTheDocument();
      expect(q('.log-travel')).toBeInTheDocument();
    });
  });
});
