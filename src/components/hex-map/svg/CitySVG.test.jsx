import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CitySVG from './CitySVG.jsx';

describe('CitySVG', () => {
    it('should render the SVG group element with id, className, and spread props', () => {
        const { container } = render(<CitySVG id="my-city" className="city-class" data-value="42" />);
        const group = container.querySelector('g');
        expect(group).toBeInTheDocument();
        expect(group.getAttribute('id')).toBe('my-city');
        expect(group.getAttribute('class')).toBe('city-class');
        expect(group.getAttribute('data-value')).toBe('42');
    });
});
