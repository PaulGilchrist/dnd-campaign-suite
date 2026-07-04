// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HazardSVG from './HazardSVG.jsx';

describe('HazardSVG', () => {
    it('should render the SVG group element with id and className', () => {
        const { container } = render(<HazardSVG id="hazard-1" className="hazard-icon" />);
        const group = container.querySelector('g');
        expect(group).toBeInTheDocument();
        expect(group.getAttribute('id')).toBe('hazard-1');
        expect(group.getAttribute('class')).toBe('hazard-icon');
    });

    it('should pass through additional props via spread', () => {
        const { container } = render(<HazardSVG data-testid="hazard-svg" />);
        const group = container.querySelector('g');
        expect(group.getAttribute('data-testid')).toBe('hazard-svg');
    });

    it('should render the hazard icon with all visual elements', () => {
        const { container } = render(<HazardSVG />);
        const group = container.querySelector('g');

        // Warning glow circles
        const glowCircles = [...group.querySelectorAll('circle')].filter(c =>
            c.getAttribute('fill') === '#C62828'
        );
        expect(glowCircles.length).toBe(2);

        // Skull elements
        const cranium = group.querySelector('ellipse[cx="18"][cy="16"]');
        expect(cranium).toBeInTheDocument();
        expect(cranium.getAttribute('fill')).toBe('#E0E0E0');

        const jaw = group.querySelector('path[d="M 11 18 Q 11 25 18 25 Q 25 25 25 18"]');
        expect(jaw).toBeInTheDocument();

        // Teeth
        const teeth = group.querySelectorAll('rect[fill="#FAFAFA"]');
        expect(teeth.length).toBe(7);

        // Eyes
        const eyeGlows = group.querySelectorAll('ellipse[fill="#EF5350"]');
        expect(eyeGlows.length).toBe(2);

        const nose = group.querySelector('polygon[fill="#424242"]');
        expect(nose).toBeInTheDocument();

        // Crossbones
        const bones = group.querySelectorAll('line[stroke="#424242"]');
        expect(bones.length).toBe(2);

        // Bone end knobs
        const knobs = [...group.querySelectorAll('circle')].filter(c =>
            c.getAttribute('fill') === '#424242' && c.getAttribute('r') === '1.8'
        );
        expect(knobs.length).toBe(4);

        // Venom drip
        const venomPath = group.querySelector('path[stroke="#7CB342"]');
        expect(venomPath).toBeInTheDocument();
    });

    it('should render all expected SVG element types', () => {
        const { container } = render(<HazardSVG />);
        const group = container.querySelector('g');
        expect(group.querySelector('circle')).toBeInTheDocument();
        expect(group.querySelector('ellipse')).toBeInTheDocument();
        expect(group.querySelector('rect')).toBeInTheDocument();
        expect(group.querySelector('line')).toBeInTheDocument();
        expect(group.querySelector('polygon')).toBeInTheDocument();
        expect(group.querySelector('path')).toBeInTheDocument();
    });
});
