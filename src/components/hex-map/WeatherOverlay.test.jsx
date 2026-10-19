// @maintained-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WeatherOverlay from './WeatherOverlay.jsx';

// Owns the overlay's render contract only: how a weather prop maps to rendered
// bytes. Forwarding/reroll lives in HexMap.additional.test.jsx (#792), the
// extreme_weather travel guard in HexMap.travel.test.jsx (#794), and weather
// math in services/campaign/weatherService.test.js — none re-tested here.
//
// Oracle: OVERLAY_CONFIG in WeatherOverlay.jsx plus each effect component's
// authored literals. Particle counts (rain 300, snow 150, wind 60, fog 12,
// cloud 5) and storm's 5 lightning flashes are copied verbatim as the spec;
// per-particle positions/opacities are Math.random per render and are
// deliberately NOT pinned. CSS animation delays are benign presentation.
// pointer-events: none is authored in HexMap.css:853 (not visible to jsdom).

// Present conditions: exact root className, particle variant + exact count,
// lightning count. Decorative containers (particles, lightning) must be
// aria-hidden; nothing else may be.
const PRESENT_CONTRACT = [
  { condition: 'cloudy', rootClass: 'weather-overlay weather-cloudy', particleClass: 'cloud-shadow', particleCount: 5, lightningCount: 0 },
  { condition: 'rain', rootClass: 'weather-overlay weather-rain', particleClass: 'rain-drop', particleCount: 300, lightningCount: 0 },
  { condition: 'storm', rootClass: 'weather-overlay weather-storm', particleClass: 'rain-drop', particleCount: 300, lightningCount: 5 },
  { condition: 'fog', rootClass: 'weather-overlay weather-fog', particleClass: 'fog-patch', particleCount: 12, lightningCount: 0 },
  { condition: 'mist', rootClass: 'weather-overlay weather-mist', particleClass: 'fog-patch', particleCount: 12, lightningCount: 0 },
  { condition: 'snow', rootClass: 'weather-overlay weather-snow', particleClass: 'snow-flake', particleCount: 150, lightningCount: 0 },
  { condition: 'wind', rootClass: 'weather-overlay weather-wind', particleClass: 'wind-line', particleCount: 60, lightningCount: 0 },
  { condition: 'extreme', rootClass: 'weather-overlay weather-extreme', particleClass: null, particleCount: 0, lightningCount: 0 },
];

describe('WeatherOverlay', () => {
  it.each(PRESENT_CONTRACT)(
    'renders $condition as $rootClass with $particleCount $particleClass particle(s) and $lightningCount lightning',
    ({ condition, rootClass, particleClass, particleCount, lightningCount }) => {
      const { container } = render(<WeatherOverlay weather={{ condition }} />);
      const overlay = container.querySelector('.weather-overlay');
      expect(overlay).not.toBeNull();
      expect(overlay.className).toBe(rootClass);

      const particles = overlay.querySelector('.weather-particles');
      if (particleClass) {
        expect(particles).toBeInTheDocument();
        expect(particles.querySelectorAll(`.${particleClass}`)).toHaveLength(particleCount);
        // No cross-variant particles leaked into this condition.
        for (const other of PRESENT_CONTRACT) {
          if (other.particleClass && other.particleClass !== particleClass) {
            expect(particles.querySelectorAll(`.${other.particleClass}`)).toHaveLength(0);
          }
        }
      } else {
        expect(particles).toBeNull();
      }

      const lightning = overlay.querySelector('.lightning-flashes');
      expect(overlay.querySelectorAll('.lightning-flash')).toHaveLength(lightningCount);
      if (lightningCount) {
        expect(lightning).toBeInTheDocument();
      } else {
        expect(lightning).toBeNull();
      }

      // Only decorative layers are hidden from assistive tech.
      expect(overlay.querySelectorAll('[aria-hidden="true"]')).toHaveLength(
        (particles ? 1 : 0) + (lightning ? 1 : 0)
      );
    }
  );

  it.each([
    { weather: null, label: 'absent weather (null)' },
    { weather: { condition: 'clear' }, label: 'clear (config maps to null overlay)' },
    { weather: { condition: 'blizzard' }, label: 'unrecognized condition' },
  ])('renders nothing for $label', ({ weather }) => {
    const { container } = render(<WeatherOverlay weather={weather} />);
    expect(container.innerHTML).toBe('');
  });
});
