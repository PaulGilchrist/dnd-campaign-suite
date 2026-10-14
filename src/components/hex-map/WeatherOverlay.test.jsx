import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WeatherOverlay from './WeatherOverlay.jsx';

describe('WeatherOverlay', () => {
    describe('renders nothing for absent or unrecognized weather', () => {
        it.each([
            [null, 'absent weather (null)'],
            [{ condition: 'clear' }, 'clear condition (explicit null config)'],
            [{ condition: 'blizzard' }, 'unrecognized condition'],
        ])('renders nothing for %s', (weather) => {
            const { container } = render(<WeatherOverlay weather={weather} />);
            expect(container.innerHTML).toBe('');
        });
    });

    describe('overlay class per condition', () => {
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
            'adds %s class for the %s condition',
            (condition, expectedClass) => {
                const { container } = render(<WeatherOverlay weather={{ condition }} />);
                expect(container.querySelector('.weather-overlay')).toHaveClass(expectedClass);
            },
        );
    });

    describe('particle effects per condition', () => {
        it.each([
            ['rain drops', 'rain', '.rain-drop'],
            ['snow flakes', 'snow', '.snow-flake'],
            ['wind lines', 'wind', '.wind-line'],
            ['fog patches', 'fog', '.fog-patch'],
            ['cloud shadows', 'cloudy', '.cloud-shadow'],
        ])('renders %s for the %s condition', (particleName, condition, particleSelector) => {
            const { container } = render(<WeatherOverlay weather={{ condition }} />);
            const particles = container.querySelector('.weather-particles');
            expect(particles).toBeInTheDocument();
            expect(particles.querySelectorAll(particleSelector).length).toBeGreaterThan(0);
        });

        it.each(['clear', 'extreme'])(
            'renders no particles for the %s condition',
            (condition) => {
                const { container } = render(<WeatherOverlay weather={{ condition }} />);
                expect(container.querySelector('.weather-particles')).not.toBeInTheDocument();
            },
        );
    });

    describe('lightning effect', () => {
        it('renders lightning flashes for the storm condition', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'storm' }} />);
            expect(container.querySelectorAll('.lightning-flash').length).toBeGreaterThan(0);
        });
    });

    describe('accessibility', () => {
        it('marks particle containers as aria-hidden', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'rain' }} />);
            const particles = container.querySelector('.weather-particles');
            expect(particles).toHaveAttribute('aria-hidden', 'true');
        });

        it('marks the lightning container as aria-hidden', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'storm' }} />);
            expect(container.querySelector('.lightning-flashes')).toHaveAttribute('aria-hidden', 'true');
        });

        it('hides nothing when the condition has no decorative effects', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'extreme' }} />);
            expect(container.querySelector('[aria-hidden]')).toBeNull();
        });
    });
});
