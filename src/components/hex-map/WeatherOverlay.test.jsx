import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WeatherOverlay from './WeatherOverlay.jsx';

describe('WeatherOverlay', () => {
    it('should return null when weather is null', () => {
        const { container } = render(<WeatherOverlay weather={null} />);
        expect(container.innerHTML).toBe('');
    });

    it('should return null when weather is undefined', () => {
        const { container } = render(<WeatherOverlay weather={undefined} />);
        expect(container.innerHTML).toBe('');
    });

    it('should return null when weather.condition is null', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: null }} />);
        expect(container.innerHTML).toBe('');
    });

    it('should return null when weather.condition is undefined', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: undefined }} />);
        expect(container.innerHTML).toBe('');
    });

    it('should return null when weather.condition is not in OVERLAY_CONFIG', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'blizzard' }} />);
        expect(container.innerHTML).toBe('');
    });

    it('should return null for clear condition since OVERLAY_CONFIG.clear is null', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'clear' }} />);
        // clear has className: null, so !config check returns null
        expect(container.innerHTML).toBe('');
    });

    it('should render weather-overlay div with weather-cloudy class for cloudy condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'cloudy' }} />);
        const overlay = container.querySelector('.weather-overlay');
        expect(overlay).toHaveClass('weather-cloudy');
    });

    it('should render weather-overlay div with weather-rain class for rain condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'rain' }} />);
        const overlay = container.querySelector('.weather-overlay');
        expect(overlay).toHaveClass('weather-rain');
    });

    it('should render weather-overlay div with weather-storm class for storm condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'storm' }} />);
        const overlay = container.querySelector('.weather-overlay');
        expect(overlay).toHaveClass('weather-storm');
    });

    it('should render weather-overlay div with weather-fog class for fog condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'fog' }} />);
        const overlay = container.querySelector('.weather-overlay');
        expect(overlay).toHaveClass('weather-fog');
    });

    it('should render weather-overlay div with weather-mist class for mist condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'mist' }} />);
        const overlay = container.querySelector('.weather-overlay');
        expect(overlay).toHaveClass('weather-mist');
    });

    it('should render weather-overlay div with weather-snow class for snow condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'snow' }} />);
        const overlay = container.querySelector('.weather-overlay');
        expect(overlay).toHaveClass('weather-snow');
    });

    it('should render weather-overlay div with weather-wind class for wind condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'wind' }} />);
        const overlay = container.querySelector('.weather-overlay');
        expect(overlay).toHaveClass('weather-wind');
    });

    it('should render weather-overlay div with weather-extreme class for extreme condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'extreme' }} />);
        const overlay = container.querySelector('.weather-overlay');
        expect(overlay).toHaveClass('weather-extreme');
    });

    it('should render RainEffect for rain condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'rain' }} />);
        const particles = container.querySelectorAll('.weather-particles');
        expect(particles.length).toBeGreaterThan(0);
        const rainDrops = container.querySelectorAll('.rain-drop');
        expect(rainDrops.length).toBe(300);
    });

    it('should render RainEffect for storm condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'storm' }} />);
        const rainDrops = container.querySelectorAll('.rain-drop');
        expect(rainDrops.length).toBe(300);
    });

    it('should render SnowEffect for snow condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'snow' }} />);
        const snowflakes = container.querySelectorAll('.snow-flake');
        expect(snowflakes.length).toBe(150);
    });

    it('should render WindEffect for wind condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'wind' }} />);
        const windLines = container.querySelectorAll('.wind-line');
        expect(windLines.length).toBe(60);
    });

    it('should render FogEffect for fog condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'fog' }} />);
        const fogPatches = container.querySelectorAll('.fog-patch');
        expect(fogPatches.length).toBe(12);
    });

    it('should render FogEffect for mist condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'mist' }} />);
        const fogPatches = container.querySelectorAll('.fog-patch');
        expect(fogPatches.length).toBe(12);
    });

    it('should render CloudEffect for cloudy condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'cloudy' }} />);
        const cloudShadows = container.querySelectorAll('.cloud-shadow');
        expect(cloudShadows.length).toBe(5);
    });

    it('should render LightningEffect for storm condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'storm' }} />);
        const lightningFlashes = container.querySelectorAll('.lightning-flash');
        expect(lightningFlashes.length).toBe(5);
    });

    it('should not render LightningEffect for rain condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'rain' }} />);
        const lightningFlashes = container.querySelectorAll('.lightning-flash');
        expect(lightningFlashes.length).toBe(0);
    });

    it('should not render particles for clear condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'clear' }} />);
        const particles = container.querySelectorAll('.weather-particles');
        expect(particles.length).toBe(0);
    });

    it('should not render particles for extreme condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'extreme' }} />);
        const particles = container.querySelectorAll('.weather-particles');
        expect(particles.length).toBe(0);
    });

    it('should render particles with aria-hidden="true"', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'rain' }} />);
        const particles = container.querySelectorAll('.weather-particles');
        particles.forEach(p => expect(p.getAttribute('aria-hidden')).toBe('true'));
    });

    it('should render rain drops with random styles', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'rain' }} />);
        const drops = container.querySelectorAll('.rain-drop');
        drops.forEach(drop => {
            expect(drop.style.left).toMatch(/^\d+(\.\d+)?%$/);
            expect(drop.style.animationDelay).toMatch(/^\d+(\.\d+)?s$/);
            expect(drop.style.animationDuration).toMatch(/^\d+(\.\d+)?s$/);
            expect(drop.style.height).toMatch(/^\d+(\.\d+)?px$/);
            expect(drop.style.opacity).toMatch(/^\d+(\.\d+)?$/);
        });
    });

    it('should render snow flakes with random styles including CSS variable', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'snow' }} />);
        const flakes = container.querySelectorAll('.snow-flake');
        flakes.forEach(flake => {
            expect(flake.style.left).toMatch(/^\d+(\.\d+)?%$/);
            expect(flake.style.animationDelay).toMatch(/^\d+(\.\d+)?s$/);
            expect(flake.style.animationDuration).toMatch(/^\d+(\.\d+)?s$/);
            expect(flake.style.width).toMatch(/^\d+(\.\d+)?px$/);
            expect(flake.style.height).toMatch(/^\d+(\.\d+)?px$/);
            expect(flake.style.opacity).toMatch(/^\d+(\.\d+)?$/);
            expect(flake.style.getPropertyValue('--drift')).toMatch(/^-?\d+(\.\d+)?px$/);
        });
    });

    it('should render wind lines with random styles', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'wind' }} />);
        const lines = container.querySelectorAll('.wind-line');
        lines.forEach(line => {
            expect(line.style.top).toMatch(/^\d+(\.\d+)?%$/);
            expect(line.style.animationDelay).toMatch(/^\d+(\.\d+)?s$/);
            expect(line.style.animationDuration).toMatch(/^\d+(\.\d+)?s$/);
            expect(line.style.width).toMatch(/^\d+(\.\d+)?px$/);
            expect(line.style.opacity).toMatch(/^\d+(\.\d+)?$/);
        });
    });

    it('should render fog patches with random styles', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'fog' }} />);
        const patches = container.querySelectorAll('.fog-patch');
        patches.forEach(patch => {
            expect(patch.style.top).toMatch(/^\d+(\.\d+)?%$/);
            expect(patch.style.left).toMatch(/^\d+(\.\d+)?%$/);
            expect(patch.style.animationDelay).toMatch(/^\d+(\.\d+)?s$/);
            expect(patch.style.animationDuration).toMatch(/^\d+(\.\d+)?s$/);
            expect(patch.style.width).toMatch(/^\d+(\.\d+)?px$/);
            expect(patch.style.height).toMatch(/^\d+(\.\d+)?px$/);
            expect(patch.style.opacity).toMatch(/^\d+(\.\d+)?$/);
        });
    });

    it('should render cloud shadows with random styles', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'cloudy' }} />);
        const shadows = container.querySelectorAll('.cloud-shadow');
        shadows.forEach(shadow => {
            expect(shadow.style.top).toMatch(/^\d+(\.\d+)?%$/);
            expect(shadow.style.animationDelay).toMatch(/^\d+(\.\d+)?s$/);
            expect(shadow.style.animationDuration).toMatch(/^\d+(\.\d+)?s$/);
            expect(shadow.style.width).toMatch(/^\d+(\.\d+)?px$/);
            expect(shadow.style.opacity).toMatch(/^\d+(\.\d+)?$/);
        });
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

    it('should render exactly one weather-overlay div', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'rain' }} />);
        const overlays = container.querySelectorAll('.weather-overlay');
        expect(overlays.length).toBe(1);
    });

    it('should render all particle effects for storm condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'storm' }} />);
        // Storm has rain particles AND lightning
        const rainDrops = container.querySelectorAll('.rain-drop');
        const lightningFlashes = container.querySelectorAll('.lightning-flash');
        expect(rainDrops.length).toBe(300);
        expect(lightningFlashes.length).toBe(5);
    });

    it('should render correct structure with div wrapper and particles', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'rain' }} />);
        const overlay = container.querySelector('.weather-overlay');
        expect(overlay).toBeInTheDocument();
        const particles = overlay.querySelector('.weather-particles');
        expect(particles).toBeInTheDocument();
        const drops = particles.querySelectorAll('.rain-drop');
        expect(drops.length).toBe(300);
    });

    it('should handle weather object with extra properties', () => {
        const { container } = render(
            <WeatherOverlay weather={{ condition: 'rain', intensity: 'heavy', duration: 3600 }} />
        );
        const overlay = container.querySelector('.weather-overlay');
        expect(overlay).toHaveClass('weather-rain');
        const rainDrops = container.querySelectorAll('.rain-drop');
        expect(rainDrops.length).toBe(300);
    });

    it('should not render particles for extreme condition', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'extreme' }} />);
        expect(container.querySelectorAll('.weather-particles').length).toBe(0);
    });

    it('should render extreme condition overlay without particles', () => {
        const { container } = render(<WeatherOverlay weather={{ condition: 'extreme' }} />);
        const overlay = container.querySelector('.weather-overlay');
        expect(overlay).toBeInTheDocument();
        expect(overlay.querySelectorAll('.weather-particles').length).toBe(0);
    });
});
