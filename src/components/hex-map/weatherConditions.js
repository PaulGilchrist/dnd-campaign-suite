// @maintained-by-ai
// Roadmap Item 10 (sensory cues): the hex weather condition table lifted out
// of WeatherOverlay.jsx so the ambience loop can ask the SAME visibility law
// the eye obeys (react-refresh wants component files to export components
// only). clear/unknown conditions carry no overlay — and therefore no sound.

export const OVERLAY_CONFIG = {
  clear: null,
  cloudy: { className: 'weather-cloudy', particles: 'cloud' },
  rain: { className: 'weather-rain', particles: 'rain' },
  storm: { className: 'weather-storm', particles: 'rain' },
  fog: { className: 'weather-fog', particles: 'fog' },
  mist: { className: 'weather-mist', particles: 'fog' },
  snow: { className: 'weather-snow', particles: 'snow' },
  wind: { className: 'weather-wind', particles: 'wind' },
  extreme: { className: 'weather-extreme', particles: null },
};

/** Shared "does this condition paint an overlay" law — the weather ambience
 *  plays exactly what the overlay renders, one source of truth. */
export function hasWeatherOverlay(condition) {
  return !!OVERLAY_CONFIG[condition];
}
