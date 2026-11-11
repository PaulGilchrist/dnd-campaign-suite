// @maintained-by-ai
// Regression pin for bug-travel-pace-odds-fields-inert: the Slow/Fast pace chip
// tooltips read "Cautious movement, easy to spot threats and stay hidden" /
// "Rapid travel, harder to notice threats or stay hidden" while the three
// backing fields (encounterMod/perception/stealthAdvantage) had ZERO consumers —
// the live roll and the panel's effective-chance row read terrain + weather +
// frequency only. The tooltips now describe what pace actually changes (per-hex
// time and daily hex budget) and the dead fields are gone from TRAVEL_PACES.
// Locks: byte-exact honest tooltips, no stealth/perception advertising, and an
// odds readout that is pace-independent (so it can never silently drift back to
// agreeing with advertised-but-inert mechanics).
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TravelPanel from './TravelPanel.jsx';
import { TRAVEL_PACES } from '../../services/campaign/travelService.js';

const PATH = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 2, r: 0 },
  { q: 3, r: 0 },
];

const makeProps = (overrides = {}) => ({
  travelPace: 'normal',
  path: PATH,
  pathIndex: 0,
  accruedCost: 1.5,
  dailyBudget: 4,
  dayExhausted: false,
  lastMessage: null,
  hexesRemaining: 3,
  isTravelActive: true,
  pendingEvent: null,
  terrain: { '0,0': 'hills' },
  eventFrequency: 'normal',
  showOwnHexHint: false,
  onChangePace: vi.fn(),
  onAdvance: vi.fn(),
  onCancel: vi.fn(),
  onForceCamp: vi.fn(),
  onForcedMarch: vi.fn(),
  weather: null,
  onReRollWeather: vi.fn(),
  onSetEventFrequency: vi.fn(),
  horseback: false,
  onToggleHorseback: vi.fn(),
  forcedMarchHours: 0,
  exhaustionMultiplier: 100,
  partyHasMaxExhaustion: false,
  ...overrides,
});

const renderPanel = (overrides = {}) => {
  const props = makeProps(overrides);
  const utils = render(<TravelPanel {...props} />);
  return { props, ...utils };
};

const chipTitles = () =>
  [...document.querySelectorAll('.travel-pace-btn')].map((b) => b.getAttribute('title'));

const descText = () => document.querySelector('.travel-frequency-desc').textContent;

describe('TravelPanel pace tooltips are honest (no inert stealth/perception claims)', () => {
  it('pace chips carry the exact time/budget copy, byte-for-byte', () => {
    renderPanel();
    expect(chipTitles()).toEqual([
      'Cautious movement — slowest travel, smallest daily hex budget',
      'Standard adventuring pace',
      'Rapid travel — fastest movement, largest daily hex budget',
    ]);
  });

  it('no pace tooltip advertises spotting, hiding, perception or encounter odds', () => {
    renderPanel();
    for (const title of chipTitles()) {
      expect(title).not.toMatch(/hidden|stealth|spot|percept|notice|threat|encounter|chance/i);
    }
  });

  it('TRAVEL_PACES rows carry no consumer-less modifier fields', () => {
    for (const pace of TRAVEL_PACES) {
      expect(pace).not.toHaveProperty('perception');
      expect(pace).not.toHaveProperty('stealthAdvantage');
      expect(pace).not.toHaveProperty('encounterMod');
    }
  });

  it('the effective-chance row is pace-independent (pace only moves time/budget)', () => {
    // hills + Normal frequency ⇒ the same 14% at every pace: the roll's
    // inputs never include pace, so the display must never imply otherwise.
    const shown = {};
    for (const travelPace of ['slow', 'normal', 'fast']) {
      const { unmount } = renderPanel({ travelPace });
      shown[travelPace] = descText();
      expect(shown[travelPace]).toBe('14% chance per hex (base 12%, +2 hills)');
      unmount();
    }
    expect(shown.slow).toBe(shown.fast);
  });
});
