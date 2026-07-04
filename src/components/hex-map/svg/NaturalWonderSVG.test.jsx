import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import NaturalWonderSVG from './NaturalWonderSVG.jsx';

describe('NaturalWonderSVG', () => {
    describe('props and rendering', () => {
        it('should render the SVG group element with id and className', () => {
            const { container } = render(<NaturalWonderSVG id="wonder-1" className="wonder-icon" />);
            const group = container.querySelector('g');
            expect(group).toBeInTheDocument();
            expect(group.getAttribute('id')).toBe('wonder-1');
            expect(group.getAttribute('class')).toBe('wonder-icon');
        });

        it('should pass through additional props via spread', () => {
            const { container } = render(<NaturalWonderSVG data-testid="wonder-svg" />);
            const group = container.querySelector('g');
            expect(group.getAttribute('data-testid')).toBe('wonder-svg');
        });
    });

    describe('structure', () => {
        it('should render all expected SVG element types', () => {
            const { container } = render(<NaturalWonderSVG />);
            const group = container.querySelector('g');
            expect(group.querySelector('circle')).toBeInTheDocument();
            expect(group.querySelector('ellipse')).toBeInTheDocument();
            expect(group.querySelector('polygon')).toBeInTheDocument();
            expect(group.querySelector('line')).toBeInTheDocument();
            expect(group.querySelector('path')).toBeInTheDocument();
        });

        it('should render 5 sparkle path elements', () => {
            const { container } = render(<NaturalWonderSVG />);
            const sparklePaths = [...container.querySelectorAll('path')].filter(p =>
                p.getAttribute('fill') === '#C5E1A5'
            );
            expect(sparklePaths.length).toBe(5);
        });
    });
});
