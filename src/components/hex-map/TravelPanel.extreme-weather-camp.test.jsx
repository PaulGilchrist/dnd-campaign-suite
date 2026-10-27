// @maintained-by-ai
/*
 * TravelPanel — extreme-weather camp affordance (bug 2026-10-27-G).
 *
 * Live defect: with a blocking-weather map (moveCostMod null) the impossible-
 * travel prompt says "Camp and wait it out", but the ONLY Camp button lived
 * inside the exhausted banner, and dayExhausted is structurally unreachable
 * under extreme weather (every advance rejects in the cost-null branch BEFORE
 * the budget check; the mount flag finds no affordable neighbor to compare) —
 * a full live panel-button enumeration confirmed no Camp affordance existed.
 *
 * Pinned contract:
 * - weather.moveCostMod === null (and not dayExhausted) renders the extreme-
 *   weather camp row verbatim, wiring to the SAME forceCamp seam the
 *   exhausted banner uses (onForceCamp);
 * - when dayExhausted is ALSO true the exhausted banner owns Camp — exactly
 *   one Camp button, no duplicated row;
 * - travel-able weather (or no weather) renders no camp row (advance lane
 *   unchanged).
 *
 * Lane map: the prompt copy is pinned by useTravelManagement.extreme-weather-
 * copy.test.js; the log-row/lastMessage-clear lane by HexMap.extreme-weather.
 * test.jsx; the exhausted banner's own dispatch by TravelPanel.test.jsx.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TravelPanel from './TravelPanel.jsx';

const PATH = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 2, r: 0 },
];

// weatherService.js production "extreme" row (label/icon/mods verbatim).
const EXTREME = {
  condition: 'extreme',
  label: 'Extreme',
  icon: 'triangle-exclamation',
  visibility: 0,
  moveCostMod: null,
  budgetMod: 0,
  encounterMod: 30,
  description: 'Blizzard or sandstorm — travel impossible, forced camp',
};
const RAIN = { label: 'Rain', icon: 'cloud-rain', moveCostMod: 1.25, budgetMod: 1 };

const EXTREME_COPY = 'Extreme weather makes travel impossible — camp and wait it out';

const makeProps = (overrides = {}) => ({
  travelPace: 'normal',
  path: PATH,
  pathIndex: 0,
  accruedCost: 0,
  dailyBudget: 4,
  dayExhausted: false,
  lastMessage: null,
  hexesRemaining: 3,
  isTravelActive: true,
  pendingEvent: null,
  terrain: { '0,0': 'plains' },
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

describe('TravelPanel — extreme-weather camp affordance', () => {
  it('renders the camp row with a live Camp button while weather blocks travel', () => {
    renderPanel({
      weather: EXTREME,
      lastMessage: 'Extreme weather makes travel impossible. Camp and wait it out.',
    });
    const row = document.querySelector('.travel-panel-exhausted');
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent(EXTREME_COPY);
    const camp = screen.getByRole('button', { name: 'Camp' });
    expect(camp).toBeEnabled();
    // Forced March makes no sense against an impossible day — not offered.
    expect(screen.queryByRole('button', { name: 'Forced March' })).not.toBeInTheDocument();
  });

  it('dispatches the camp row button to the same forceCamp seam as the exhausted banner', () => {
    const { props } = renderPanel({ weather: EXTREME });
    fireEvent.click(screen.getByRole('button', { name: 'Camp' }));
    expect(props.onForceCamp).toHaveBeenCalledTimes(1);
    expect(props.onForcedMarch).not.toHaveBeenCalled();
  });

  it('yields to the exhausted banner when both conditions hold (exactly one Camp)', () => {
    renderPanel({ weather: EXTREME, dayExhausted: true });
    expect(screen.getAllByRole('button', { name: 'Camp' })).toHaveLength(1);
    expect(screen.queryByText(EXTREME_COPY)).not.toBeInTheDocument();
    expect(screen.getByText('Travel budget exhausted — camp or forced march?')).toBeInTheDocument();
  });

  it('disappears when the block lifts (re-rolled weather travels again)', () => {
    const { rerender } = renderPanel({ weather: EXTREME });
    expect(screen.getByText(EXTREME_COPY)).toBeInTheDocument();
    rerender(<TravelPanel {...makeProps({ weather: RAIN })} />);
    expect(screen.queryByText(EXTREME_COPY)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Camp' })).not.toBeInTheDocument();
  });

  it('renders no camp row for clear of weather', () => {
    renderPanel({ weather: null });
    expect(document.querySelector('.travel-panel-exhausted')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Camp' })).not.toBeInTheDocument();
  });
});
