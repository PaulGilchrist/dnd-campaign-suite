// @maintained-by-ai
// Regression pin for bug-event-chance-label-ignores-mods: the active Events row
// used to print the raw EVENT_FREQUENCIES table ("12% chance per hex") while
// shouldTriggerEvent rolled freq + terrain + weather mods (Rain +10 ⇒ the live
// per-hex chance was 22%). The row now renders the shared effectiveEventChance
// total with the modifiers attributed, the chip tooltips keep the per-frequency
// BASE, and none/no-route/poisoned-weather fall back to the honest base label.
// Equality: every displayed number is re-derived from the REAL service in the
// same test — display and roll reading different math fails here.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TravelPanel from './TravelPanel.jsx';
import { effectiveEventChance } from '../../services/campaign/randomEventService.js';

const PATH = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 2, r: 0 },
];

// Real rain/weatherService row shapes (encounterMod is the live roll input).
const RAIN = { condition: 'rain', label: 'Rain', icon: 'cloud-rain', moveCostMod: 1.25, budgetMod: 1, encounterMod: 10, description: 'Heavy rain — terrain costs +25%' };
const FOG = { condition: 'fog', label: 'Fog', icon: 'smog', moveCostMod: 1, budgetMod: 1, encounterMod: -10, description: 'Thick fog — encounter chance -10%' };

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

const descText = () => document.querySelector('.travel-frequency-desc').textContent;

describe('TravelPanel effective event chance', () => {
  it('shows the live repro face: plains + Rain + Normal reads the rolled 22%, not the table 12%', () => {
    renderPanel({ weather: RAIN });
    expect(descText()).toBe('22% chance per hex (base 12%, +10 rain)');
  });

  it('attributes the terrain mod as well (swamp + Rain + Normal)', () => {
    renderPanel({ weather: RAIN, terrain: { '0,0': 'swamp' } });
    expect(descText()).toBe('30% chance per hex (base 12%, +8 swamp, +10 rain)');
  });

  it('renders negative weather mods (plains + Fog + Normal → 2%)', () => {
    renderPanel({ weather: FOG });
    expect(descText()).toBe('2% chance per hex (base 12%, -10 fog)');
  });

  it('matches the current hex while travelling mid-route (pathIndex 1 on a forest hex)', () => {
    renderPanel({
      weather: RAIN,
      pathIndex: 1,
      terrain: { '0,0': 'plains', '1,0': 'forest' },
    });
    expect(descText()).toBe('27% chance per hex (base 12%, +5 forest, +10 rain)');
  });

  describe('fallbacks keep the honest base label', () => {
    it('no modifiers at all (unmodded weather row absent)', () => {
      renderPanel();
      expect(descText()).toBe('12% chance per hex');
    });

    it('zero-mod weather (Clear)', () => {
      renderPanel({ weather: { condition: 'clear', label: 'Clear', encounterMod: 0 } });
      expect(descText()).toBe('12% chance per hex');
    });

    it('None frequency is never resurrected by mods', () => {
      renderPanel({ weather: RAIN, eventFrequency: 'none', terrain: { '0,0': 'swamp' } });
      expect(descText()).toBe('0% chance per hex');
    });

    it('no route planned yet — the roll terrain is undetermined', () => {
      renderPanel({ weather: RAIN, path: [], pathIndex: 0, hexesRemaining: 0 });
      expect(descText()).toBe('12% chance per hex');
    });

    it('non-numeric encounterMod poisons the roll, so the panel declines to invent a number', () => {
      renderPanel({ weather: { condition: 'rain', label: 'Rain', encounterMod: 'abc' } });
      expect(descText()).toBe('12% chance per hex');
    });

    it('unknown frequency key falls back to the None label', () => {
      renderPanel({ weather: RAIN, eventFrequency: 'bogus' });
      expect(descText()).toBe('0% chance per hex');
    });
  });

  it('chip tooltips stay per-frequency BASE while the active row shows the effective total', () => {
    renderPanel({ weather: RAIN });
    const chips = [...document.querySelectorAll('.travel-frequency-btn')];
    expect(chips.map((b) => b.getAttribute('title'))).toEqual([
      'None: 0% chance per hex',
      'Sparse: 5% chance per hex',
      'Normal: 12% chance per hex',
      'Frequent: 25% chance per hex',
    ]);
  });

  it('displayed percent equals the roll threshold for every surface combination', () => {
    const terrains = ['plains', 'forest', 'swamp'];
    const weathers = [null, RAIN, FOG];
    const keys = ['sparse', 'normal', 'frequent'];
    for (const terrainType of terrains) {
      for (const weather of weathers) {
        for (const eventFrequency of keys) {
          const { unmount } = renderPanel({
            terrain: { '0,0': terrainType },
            weather,
            eventFrequency,
          });
          const shown = Number(descText().match(/^(-?\d+)%/)[1]);
          const total = effectiveEventChance(terrainType, weather, eventFrequency);
          const rolled = Math.max(0, Math.round(total * 100));
          expect(shown, `${terrainType}/${weather?.label}/${eventFrequency}`).toBe(rolled);
          unmount();
        }
      }
    }
  });

  it('keeps the active frequency label span intact', () => {
    renderPanel({ weather: RAIN, eventFrequency: 'frequent' });
    expect(document.querySelector('.travel-frequency-active')).toHaveTextContent('Frequent');
    expect(screen.getByRole('button', { name: 'Frequent' })).toHaveClass('active');
  });
});
