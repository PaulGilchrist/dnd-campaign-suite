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
            [{ condition: 'clear' }, 'clear (no config)'],
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
        it('should render rain particles for rain condition', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'rain' }} />);
            const particles = container.querySelector('.weather-particles');
            expect(particles).toBeInTheDocument();
            expect(particles.querySelectorAll('.rain-drop').length).toBeGreaterThan(0);
        });

        it('should render rain particles for storm condition', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'storm' }} />);
            const particles = container.querySelector('.weather-particles');
            expect(particles).toBeInTheDocument();
            expect(particles.querySelectorAll('.rain-drop').length).toBeGreaterThan(0);
        });

        it('should render snow particles for snow condition', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'snow' }} />);
            const particles = container.querySelector('.weather-particles');
            expect(particles).toBeInTheDocument();
            expect(particles.querySelectorAll('.snow-flake').length).toBeGreaterThan(0);
        });

        it('should render wind particles for wind condition', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'wind' }} />);
            const particles = container.querySelector('.weather-particles');
            expect(particles).toBeInTheDocument();
            expect(particles.querySelectorAll('.wind-line').length).toBeGreaterThan(0);
        });

        it('should render fog particles for fog condition', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'fog' }} />);
            const particles = container.querySelector('.weather-particles');
            expect(particles).toBeInTheDocument();
            expect(particles.querySelectorAll('.fog-patch').length).toBeGreaterThan(0);
        });

        it('should render fog particles for mist condition', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'mist' }} />);
            const particles = container.querySelector('.weather-particles');
            expect(particles).toBeInTheDocument();
            expect(particles.querySelectorAll('.fog-patch').length).toBeGreaterThan(0);
        });

        it('should render cloud shadows for cloudy condition', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'cloudy' }} />);
            const particles = container.querySelector('.weather-particles');
            expect(particles).toBeInTheDocument();
            expect(particles.querySelectorAll('.cloud-shadow').length).toBeGreaterThan(0);
        });

        it('should not render particles for clear condition', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'clear' }} />);
            expect(container.querySelector('.weather-particles')).not.toBeInTheDocument();
        });

        it('should not render particles for extreme condition', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'extreme' }} />);
            expect(container.querySelector('.weather-particles')).not.toBeInTheDocument();
        });
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

        it('should render lightning flashes with fixed animation delays', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'storm' }} />);
            const flashes = container.querySelectorAll('.lightning-flash');
            expect(flashes.length).toBe(5);
            expect(flashes[0].style.animationDelay).toBe('1.5s');
            expect(flashes[1].style.animationDelay).toBe('5s');
            expect(flashes[2].style.animationDelay).toBe('10s');
            expect(flashes[3].style.animationDelay).toBe('3.5s');
            expect(flashes[4].style.animationDelay).toBe('13s');
        });
    });

    describe('accessibility', () => {
        it('should render particles with aria-hidden="true"', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'rain' }} />);
            const particles = container.querySelectorAll('.weather-particles');
            particles.forEach(p => expect(p.getAttribute('aria-hidden')).toBe('true'));
        });
    });

    describe('particle element styles', () => {
        const randomStylePatterns = {
            '.rain-drop': {
                left: /^\d+(\.\d+)?%$/,
                animationDelay: /^\d+(\.\d+)?s$/,
                animationDuration: /^\d+(\.\d+)?s$/,
                height: /^\d+(\.\d+)?px$/,
                opacity: /^\d+(\.\d+)?$/,
            },
            '.snow-flake': {
                left: /^\d+(\.\d+)?%$/,
                animationDelay: /^\d+(\.\d+)?s$/,
                animationDuration: /^\d+(\.\d+)?s$/,
                width: /^\d+(\.\d+)?px$/,
                height: /^\d+(\.\d+)?px$/,
                opacity: /^\d+(\.\d+)?$/,
                '--drift': /^-?\d+(\.\d+)?px$/,
            },
            '.wind-line': {
                top: /^\d+(\.\d+)?%$/,
                animationDelay: /^\d+(\.\d+)?s$/,
                animationDuration: /^\d+(\.\d+)?s$/,
                width: /^\d+(\.\d+)?px$/,
                opacity: /^\d+(\.\d+)?$/,
            },
            '.fog-patch': {
                top: /^\d+(\.\d+)?%$/,
                left: /^\d+(\.\d+)?%$/,
                animationDelay: /^\d+(\.\d+)?s$/,
                animationDuration: /^\d+(\.\d+)?s$/,
                width: /^\d+(\.\d+)?px$/,
                height: /^\d+(\.\d+)?px$/,
                opacity: /^\d+(\.\d+)?$/,
            },
            '.cloud-shadow': {
                top: /^\d+(\.\d+)?%$/,
                animationDelay: /^\d+(\.\d+)?s$/,
                animationDuration: /^\d+(\.\d+)?s$/,
                width: /^\d+(\.\d+)?px$/,
                opacity: /^\d+(\.\d+)?$/,
            },
        };

        const styleTests = [
            ['rain', '.rain-drop'],
            ['snow', '.snow-flake'],
            ['wind', '.wind-line'],
            ['fog', '.fog-patch'],
            ['cloudy', '.cloud-shadow'],
        ];

        it.each(styleTests)('should render random styles for %s particles (%s)', (condition, selector) => {
            const { container } = render(<WeatherOverlay weather={{ condition }} />);
            const elements = container.querySelectorAll(selector);
            const patterns = randomStylePatterns[selector];
            elements.forEach(el => {
                Object.entries(patterns).forEach(([prop, regex]) => {
                    const value = prop.startsWith('--')
                        ? el.style.getPropertyValue(prop)
                        : el.style[prop];
                    expect(value).toMatch(regex);
                });
            });
        });
    });

    describe('structure and robustness', () => {
        it('should render exactly one weather-overlay div', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'rain' }} />);
            expect(container.querySelectorAll('.weather-overlay').length).toBe(1);
        });

        it('should render correct DOM structure with overlay wrapper and particles', () => {
            const { container } = render(<WeatherOverlay weather={{ condition: 'rain' }} />);
            const overlay = container.querySelector('.weather-overlay');
            expect(overlay).toBeInTheDocument();
            const particles = overlay.querySelector('.weather-particles');
            expect(particles).toBeInTheDocument();
            expect(particles.querySelectorAll('.rain-drop').length).toBeGreaterThan(0);
        });

        it('should handle weather object with extra properties without breaking', () => {
            const { container } = render(
                <WeatherOverlay weather={{ condition: 'rain', intensity: 'heavy', duration: 3600 }} />
            );
            const overlay = container.querySelector('.weather-overlay');
            expect(overlay).toHaveClass('weather-rain');
            expect(overlay.querySelectorAll('.rain-drop').length).toBeGreaterThan(0);
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
