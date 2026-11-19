// @maintained-by-ai
// Roadmap Item 10 (sensory cues) — weather ambience lifecycle. startLoop/
// stopLoop are the only seams mocked. Pins: the loop starts when a mounted
// hex map lands overlay-bearing weather (GM roll OR SSE echo — same prop
// seam), is idempotent across condition swaps that stay visible (rain→storm
// never restarts the bed), stops the instant weather clears (the overlay-
// visibility law shared with WeatherOverlay via hasWeatherOverlay), and stops
// on unmount (navigation away / campaign leave). No clock involved anywhere.
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WeatherAmbience from './WeatherAmbience.jsx';
import WeatherOverlay from './WeatherOverlay.jsx';
import { hasWeatherOverlay } from './weatherConditions.js';
import { startLoop, stopLoop } from '../../services/ui/audioCues.js';

vi.mock('../../services/ui/audioCues.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, startLoop: vi.fn(), stopLoop: vi.fn() };
});

beforeEach(() => {
    startLoop.mockClear();
    stopLoop.mockClear();
});

describe('hasWeatherOverlay (shared visibility law)', () => {
    it('clear and unknown/missing conditions paint nothing — and therefore play nothing', () => {
        expect(hasWeatherOverlay('clear')).toBe(false);
        expect(hasWeatherOverlay(undefined)).toBe(false);
        expect(hasWeatherOverlay('tornado-deprecated')).toBe(false);
    });

    it('every overlay-bearing condition is visible', () => {
        for (const condition of ['cloudy', 'rain', 'storm', 'fog', 'mist', 'snow', 'wind', 'extreme']) {
            expect(hasWeatherOverlay(condition), condition).toBe(true);
        }
    });

    it("the law IS the overlay's own render face (cross-check — audio hears what the eye sees)", () => {
        for (const condition of ['cloudy', 'rain', 'storm', 'fog', 'mist', 'snow', 'wind', 'extreme']) {
            const { container } = render(<WeatherOverlay weather={{ condition }} />);
            expect(container.querySelector('.weather-overlay'), condition).not.toBeNull();
        }
        for (const condition of ['clear', 'tornado-deprecated']) {
            const { container } = render(<WeatherOverlay weather={{ condition }} />);
            expect(container.querySelector('.weather-overlay')).toBeNull();
        }
    });
});

describe('WeatherAmbience lifecycle', () => {
    it('starts exactly one loop while active weather is mounted', () => {
        const { unmount } = render(<WeatherAmbience weather={{ condition: 'rain', label: 'Rain' }} />);
        expect(startLoop).toHaveBeenCalledTimes(1);
        expect(startLoop).toHaveBeenCalledWith('weather');
        unmount();
    });

    it('no weather / clear weather: nothing ever starts', () => {
        render(<WeatherAmbience weather={null} />);
        render(<WeatherAmbience weather={{ condition: 'clear' }} />);
        expect(startLoop).not.toHaveBeenCalled();
        expect(stopLoop).not.toHaveBeenCalled();
    });

    it('condition swaps that stay visible never restart the bed', () => {
        const view = render(<WeatherAmbience weather={{ condition: 'rain' }} />);
        view.rerender(<WeatherAmbience weather={{ condition: 'storm' }} />);
        view.rerender(<WeatherAmbience weather={{ condition: 'snow' }} />);
        expect(startLoop).toHaveBeenCalledTimes(1);
        expect(stopLoop).not.toHaveBeenCalled();
    });

    it('stops the instant weather clears', () => {
        const view = render(<WeatherAmbience weather={{ condition: 'storm' }} />);
        view.rerender(<WeatherAmbience weather={{ condition: 'clear' }} />);
        expect(stopLoop).toHaveBeenCalledTimes(1);
        // And a later roll starts it fresh.
        view.rerender(<WeatherAmbience weather={{ condition: 'fog' }} />);
        expect(startLoop).toHaveBeenCalledTimes(2);
    });

    it('unmount (navigation away / campaign leave) stops it', () => {
        const view = render(<WeatherAmbience weather={{ condition: 'wind' }} />);
        view.unmount();
        expect(stopLoop).toHaveBeenCalledTimes(1);
    });

    it('unmount while already clear does not stop a never-started loop', () => {
        const view = render(<WeatherAmbience weather={null} />);
        view.unmount();
        expect(stopLoop).not.toHaveBeenCalled();
    });
});
