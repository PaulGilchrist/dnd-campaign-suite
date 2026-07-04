// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LoreSiteSVG from './LoreSiteSVG.jsx';

describe('LoreSiteSVG', () => {
    describe('props and rendering', () => {
        it('should render the SVG group element with id, className, and spread props', () => {
            const { container } = render(<LoreSiteSVG id="lore-1" className="lore-site-icon" data-testid="lore-svg" />);
            const group = container.querySelector('g');
            expect(group).toBeInTheDocument();
            expect(group.getAttribute('id')).toBe('lore-1');
            expect(group.getAttribute('class')).toBe('lore-site-icon');
            expect(group.getAttribute('data-testid')).toBe('lore-svg');
        });
    });

    describe('structure', () => {
        it('should render all expected SVG element types', () => {
            const { container } = render(<LoreSiteSVG />);
            const group = container.querySelector('g');
            expect(group.querySelector('ellipse')).toBeInTheDocument();
            expect(group.querySelector('rect')).toBeInTheDocument();
            expect(group.querySelector('polygon')).toBeInTheDocument();
            expect(group.querySelector('circle')).toBeInTheDocument();
            expect(group.querySelector('path')).toBeInTheDocument();
        });
    });
});
