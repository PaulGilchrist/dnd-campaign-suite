// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CitySVG from './CitySVG.jsx';

describe('CitySVG', () => {
    it('should render the SVG group element', () => {
        const { container } = render(<CitySVG />);
        expect(container.querySelector('g')).toBeInTheDocument();
    });

    it('should render with the provided id attribute', () => {
        const { container } = render(<CitySVG id="city-1" />);
        expect(container.querySelector('g').getAttribute('id')).toBe('city-1');
    });

    it('should render with the provided className', () => {
        const { container } = render(<CitySVG className="city-icon" />);
        expect(container.querySelector('g').getAttribute('class')).toBe('city-icon');
    });

    it('should pass through additional props via spread', () => {
        const { container } = render(<CitySVG data-testid="city-svg" onClick={vi.fn()} />);
        expect(container.querySelector('g').getAttribute('data-testid')).toBe('city-svg');
    });

    it('should render all expected SVG element types', () => {
        const { container } = render(<CitySVG />);
        const group = container.querySelector('g');
        expect(group.querySelector('ellipse')).toBeInTheDocument();
        expect(group.querySelector('rect')).toBeInTheDocument();
        expect(group.querySelector('line')).toBeInTheDocument();
        expect(group.querySelector('polygon')).toBeInTheDocument();
        expect(group.querySelector('path')).toBeInTheDocument();
    });

    it('should render id, className, and spread props together', () => {
        const { container } = render(<CitySVG id="my-city" className="city-class" data-value="42" />);
        const group = container.querySelector('g');
        expect(group.getAttribute('id')).toBe('my-city');
        expect(group.getAttribute('class')).toBe('city-class');
        expect(group.getAttribute('data-value')).toBe('42');
    });
});
