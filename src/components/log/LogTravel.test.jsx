// @maintained-by-ai
// TRAVEL ENTRY content lane — owns the rendered bytes of TravelEntry (LogTravelEntry.jsx).
// Render-vs-service split (cite-owner convention):
//   routing travel→TravelEntry .log-travel .... owned by #879 container dispatch (LogEntryRendering.test.jsx) — cut here
//   travel math getHexTravelTime/formatTravelTime  owned by travelService lanes (cited #816/#818 hex-map) — TravelEntry
//                                                    renders NO distance/time bytes, so none are pinned here
//   weather generation / enum roll-up .............. owned by weatherService.test.js — we pin weather text/icon AS AUTHORED
//                                                    on the fixture only (#761/#818 cite pattern)
//   encounter entries ................................ owned by #878 (LogEncounter.test.jsx)
//
// Owned here: action→label+icon config matrix incl. unknown-action fallback to advance;
// exact hex coord bytes (q, r) with 0-coord short-circuit watch (#882); terrain/weather/event
// optional-section presence + omission; weatherIcon default-sun vs custom legs; eventType gates
// on eventTitle only; timestamp bytes by family /\d{2}:\d{2}:\d{2}/ convention (#876 fixed-ts
// fixture). Exact bytes over regex (#829); falsy survivors exact (#842).
// old->new map: 11 per-action its + fallback its + 10 section its → it.each matrix (fallback
// row folded in) + full-entry byte pin + as-authored variant pin + minimal omission pin.

import { beforeEach } from 'vitest';
import { travel, q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

describe('TravelEntry (Log)', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  // Authored matrix: TRAVEL_ACTION_CONFIG action → exact label byte + icon class.
  // Last row is the fallback leg: unknown action renders advance config.
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
    ['not_a_real_action', 'Advanced to', 'fa-person-walking'],
  ])('action %s renders exact label "%s" with icon .%s', (action, label, icon) => {
    setup(Log, [travel({ action })]);
    expect(q('.log-travel-action').textContent).toBe(label);
    expect(q(`.log-travel i.${icon}`)).toBeInTheDocument();
  });

  it('renders every optional section with exact bytes when all authored', () => {
    setup(Log, [travel({
      timestamp: 1700000000000,
      hex: { q: 5, r: -3 },
      terrain: 'Mountain',
      weather: 'Sunny',
      eventTitle: 'Ambush!',
      eventType: 'Enemy',
    })]);
    expect(q('.log-travel-coords').textContent).toBe('(5, -3)');
    expect(q('.log-travel-terrain')).toBeInTheDocument();
    expect(q('.log-travel-terrain')).toHaveTextContent('Mountain');
    expect(q('.log-travel-terrain i.fa-mountain')).toBeInTheDocument();
    expect(q('.log-travel-weather')).toHaveTextContent('Sunny');
    expect(q('.log-travel-weather i.fa-sun')).toBeInTheDocument(); // default icon, no weatherIcon authored
    expect(q('.log-travel-event-type').textContent).toBe('Enemy');
    expect(q('.log-travel-event-title').textContent).toBe('Ambush!');
    expect(q('.log-time').textContent).toMatch(/\d{2}:\d{2}:\d{2}/); // format owned by log-utils
  });

  it('renders as-authored variants: 0-coords, custom weather icon, title-only event, omitted falsy terrain', () => {
    setup(Log, [travel({
      hex: { q: 0, r: -1 }, // 0 q is truthy inside hex object — must render "(0, -1)" (#882 short-circuit watch)
      terrain: '',
      weather: 'Storms',
      weatherIcon: 'cloud-showers-heavy',
      eventTitle: 'Discovery', // eventType omitted → gate is on title only
    })]);
    expect(q('.log-travel-coords').textContent).toBe('(0, -1)');
    expect(q('.log-travel-terrain')).not.toBeInTheDocument();
    expect(q('.log-travel-weather')).toHaveTextContent('Storms');
    expect(q('.log-travel-weather i.fa-cloud-showers-heavy')).toBeInTheDocument();
    expect(q('.log-travel-event-title').textContent).toBe('Discovery');
    expect(q('.log-travel-event-type').textContent).toBe('');
  });

  it('omits every optional section on a minimal entry (null hex, falsy strings)', () => {
    setup(Log, [travel({ hex: null, terrain: '', weather: '', eventTitle: '' })]);
    expect(q('.log-travel')).toBeInTheDocument();
    expect(q('.log-travel-action').textContent).toBe('Advanced to');
    expect(q('.log-travel-coords')).not.toBeInTheDocument();
    expect(q('.log-travel-terrain')).not.toBeInTheDocument();
    expect(q('.log-travel-weather')).not.toBeInTheDocument();
    expect(q('.log-travel-event')).not.toBeInTheDocument();
  });
});
