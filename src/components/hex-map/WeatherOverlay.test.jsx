/* @improved-by-ai */
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WeatherOverlay from './WeatherOverlay.jsx';

describe('WeatherOverlay', () => {
    describe('null/invalid weather handling', () => {
        it.each([
            [null, 'null'],
            [undefined, 'undefined'],
            [{ condition: null }, 'condition null'],
            [{ condition: undefined }, 'condition undefined'],
            [{ condition: 'blizzard' }, 'unknown condition'],
        ])('should return null when weather is %s (%s)', (weather) => {
            const { container } = render(<WeatherOverlay weather={weather} />);
            expect(container.innerHTML).toBe('');
        });
    });

    describe('overlay class names per condition', () => {
        const conditionsWithClasses = [
            ['cloudy', 'weather-cloudy'],
            ['rain', 'weather-rain'],
            ['storm', 'weather-storm'],
            ['fog', 'weather-fog'],
            ['mist', 'weather-mist'],
            ['snow', 'weather-snow'],
            ['wind', 'weather-wind'],
            ['extreme', 'weather-extreme'],
        ];

        it.each(conditionsWithClasses)(
            'should render weather-overlay with %s class for %s condition',
            (condition, expectedClass) => {
                const { container } = render(<WeatherOverlay weather={{ condition }} />);
                const overlay = container.querySelector('.weather-overlay');
                expect(overlay).toHaveClass(expectedClass);
            },
        );
    });

    describe('particle effects per condition', () => {
        it.each([
            ['rain', '.rain-drop'],
            ['snow', '.snow-flake'],
            ['wind', '.wind-line'],
            ['fog', '.fog-patch'],
            ['mist', '.fog-patch'],
            ['cloudy', '.cloud-shadow'],
        ])('should render %s particles for %s condition', (condition, particleSelector) => {
            const { container } = render(<WeatherOverlay weather={{ condition }} />);
            const particles = container.querySelector('.weather-particles');
            expect(particles).toBeInTheDocument();
            expect(particles.querySelectorAll(particleSelector).length).toBeGreaterThan(0);
        });

        it('should render rain particles for storm condition', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'storm' }} />);
            const particles = container.querySelector('.weather-particles');
            expect(particles).toBeInTheDocument();
            expect(particles.querySelectorAll('.rain-drop').length).toBeGreaterThan(0);
        });

        it.each(['clear', 'extreme'])(
            'should not render particles for %s condition',
            (condition) => {
                const { container } = render(<WeatherOverlay weather={{ condition }} />);
                expect(container.querySelector('.weather-particles')).not.toBeInTheDocument();
            },
        );
    });

    describe('lightning effect', () => {
        it('should render lightning flashes for storm condition', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'storm' }} />);
            const flashes = container.querySelectorAll('.lightning-flash');
            expect(flashes.length).toBeGreaterThan(0);
        });

        it('should not render lightning flashes for rain condition', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'rain' }} />);
            const flashes = container.querySelectorAll('.lightning-flash');
            expect(flashes.length).toBe(0);
        });
    });

    describe('accessibility', () => {
        it('should render particles with aria-hidden="true"', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'rain' }} />);
            const particles = container.querySelectorAll('.weather-particles');
            particles.forEach(p => expect(p.getAttribute('aria-hidden')).toBe('true'));
        });
    });

    describe('structure and robustness', () => {
        it('should render exactly one weather-overlay div', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'rain' }} />);
            expect(container.querySelectorAll('.weather-overlay').length).toBe(1);
        });

        it('should render storm with both rain particles and lightning', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'storm' }} />);
            const rainDrops = container.querySelectorAll('.rain-drop');
            const flashes = container.querySelectorAll('.lightning-flash');
            expect(rainDrops.length).toBeGreaterThan(0);
            expect(flashes.length).toBeGreaterThan(0);
        });
    });
});
// @cleaned-by-ai
