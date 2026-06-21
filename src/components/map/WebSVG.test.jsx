// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WebSVG from './WebSVG.jsx';

const renderWeb = (props = {}) =>
    render(
        <svg>
            <WebSVG {...props} />
        </svg>
    );

describe('WebSVG', () => {
    describe('root element', () => {
        it('should render the root <g> element', () => {
            const { container } = renderWeb();
            expect(container.querySelector('g')).toBeInTheDocument();
        });

        it('should apply the given id to the root group', () => {
            const { container } = renderWeb({ id: 'web-svg-1' });
            expect(container.querySelector('g')).toHaveAttribute('id', 'web-svg-1');
        });

        it('should apply the given className to the root group', () => {
            const { container } = renderWeb({ className: 'web-custom' });
            expect(container.querySelector('g')).toHaveClass('web-custom');
        });

        it('should pass through rest props to the root group', () => {
            const { container } = renderWeb({ 'data-test': 'web' });
            expect(container.querySelector('g')).toHaveAttribute('data-test', 'web');
        });

        it('should render with displayName', () => {
            expect(WebSVG.displayName).toBe('WebSVG');
        });

        it('should render as a forwardRef component', () => {
            const ref = vi.fn();
            renderWeb({ ref });
            expect(ref).toHaveBeenCalled();
        });
    });

    describe('radial lines', () => {
        it('should render 8 radial lines from center', () => {
            const { container } = renderWeb();
            const radialLines = container.querySelectorAll(
                'line[stroke="#CCC"][stroke-width="0.4"][opacity="0.6"]'
            );
            expect(radialLines.length).toBeGreaterThan(0);
        });

        it('should render the center-to-corner radial line (top-left)', () => {
            const { container } = renderWeb();
            const line = container.querySelector(
                'line[x1="18"][y1="18"][x2="2"][y2="2"]'
            );
            expect(line).toBeInTheDocument();
            expect(line).toHaveAttribute('stroke', '#CCC');
            expect(line).toHaveAttribute('stroke-width', '0.4');
            expect(line).toHaveAttribute('opacity', '0.6');
        });

        it('should render the center-to-top radial line', () => {
            const { container } = renderWeb();
            expect(
                container.querySelector('line[x1="18"][y1="18"][x2="18"][y2="2"]')
            ).toBeInTheDocument();
        });

        it('should render the center-to-top-right radial line', () => {
            const { container } = renderWeb();
            expect(
                container.querySelector('line[x1="18"][y1="18"][x2="34"][y2="2"]')
            ).toBeInTheDocument();
        });

        it('should render the center-to-right radial line', () => {
            const { container } = renderWeb();
            expect(
                container.querySelector('line[x1="18"][y1="18"][x2="34"][y2="18"]')
            ).toBeInTheDocument();
        });

        it('should render the center-to-bottom-right radial line', () => {
            const { container } = renderWeb();
            expect(
                container.querySelector('line[x1="18"][y1="18"][x2="34"][y2="34"]')
            ).toBeInTheDocument();
        });

        it('should render the center-to-bottom radial line', () => {
            const { container } = renderWeb();
            expect(
                container.querySelector('line[x1="18"][y1="18"][x2="18"][y2="34"]')
            ).toBeInTheDocument();
        });

        it('should render the center-to-bottom-left radial line', () => {
            const { container } = renderWeb();
            expect(
                container.querySelector('line[x1="18"][y1="18"][x2="2"][y2="34"]')
            ).toBeInTheDocument();
        });

        it('should render the center-to-left radial line', () => {
            const { container } = renderWeb();
            expect(
                container.querySelector('line[x1="18"][y1="18"][x2="2"][y2="18"]')
            ).toBeInTheDocument();
        });
    });

    describe('web rings', () => {
        it('should render the outermost web ring polygon', () => {
            const { container } = renderWeb();
            const polygon = container.querySelector(
                'polygon[points="8,8 18,5 28,8 31,18 28,28 18,31 8,28 5,18"]'
            );
            expect(polygon).toBeInTheDocument();
            expect(polygon).toHaveAttribute('fill', 'none');
            expect(polygon).toHaveAttribute('stroke', '#CCC');
            expect(polygon).toHaveAttribute('stroke-width', '0.4');
            expect(polygon).toHaveAttribute('opacity', '0.6');
        });

        it('should render the second web ring polygon', () => {
            const { container } = renderWeb();
            const polygon = container.querySelector(
                'polygon[points="11,11 18,9 25,11 27,18 25,25 18,27 11,25 9,18"]'
            );
            expect(polygon).toBeInTheDocument();
            expect(polygon).toHaveAttribute('fill', 'none');
            expect(polygon).toHaveAttribute('stroke', '#CCC');
        });

        it('should render the third web ring polygon', () => {
            const { container } = renderWeb();
            const polygon = container.querySelector(
                'polygon[points="13,13 18,12 23,13 24,18 23,23 18,24 13,23 12,18"]'
            );
            expect(polygon).toBeInTheDocument();
            expect(polygon).toHaveAttribute('fill', 'none');
            expect(polygon).toHaveAttribute('stroke', '#CCC');
        });

        it('should render the innermost web ring polygon', () => {
            const { container } = renderWeb();
            const polygon = container.querySelector(
                'polygon[points="15,15 18,14 21,15 22,18 21,21 18,22 15,21 14,18"]'
            );
            expect(polygon).toBeInTheDocument();
            expect(polygon).toHaveAttribute('fill', 'none');
            expect(polygon).toHaveAttribute('stroke', '#CCC');
        });

        it('should render 4 web ring polygons', () => {
            const { container } = renderWeb();
            expect(container.querySelectorAll('polygon').length).toBeGreaterThanOrEqual(4);
        });
    });

    describe('spider', () => {
        it('should render the spider body ellipse', () => {
            const { container } = renderWeb();
            const body = container.querySelector(
                'ellipse[cx="18"][cy="18"][rx="2"][ry="2.5"]'
            );
            expect(body).toBeInTheDocument();
            expect(body).toHaveAttribute('fill', '#222');
        });

        it('should render the spider head circle', () => {
            const { container } = renderWeb();
            const head = container.querySelector(
                'circle[cx="18"][cy="16"][r="1"]'
            );
            expect(head).toBeInTheDocument();
            expect(head).toHaveAttribute('fill', '#222');
        });

        it('should render 3 spider legs on the left side', () => {
            const { container } = renderWeb();
            const leftLegs = container.querySelectorAll(
                'line[stroke="#222"][stroke-width="0.5"][stroke-linecap="round"]'
            );
            expect(leftLegs.length).toBeGreaterThan(2);
        });

        it('should render the top-left spider leg', () => {
            const { container } = renderWeb();
            const leg = container.querySelector(
                'line[x1="16"][y1="16"][x2="13"][y2="14"]'
            );
            expect(leg).toBeInTheDocument();
            expect(leg).toHaveAttribute('stroke', '#222');
            expect(leg).toHaveAttribute('stroke-width', '0.5');
            expect(leg).toHaveAttribute('stroke-linecap', 'round');
        });

        it('should render the middle-left spider leg', () => {
            const { container } = renderWeb();
            expect(
                container.querySelector('line[x1="16"][y1="17"][x2="13"][y2="17"]')
            ).toBeInTheDocument();
        });

        it('should render the bottom-left spider leg', () => {
            const { container } = renderWeb();
            expect(
                container.querySelector('line[x1="16"][y1="18"][x2="13"][y2="20"]')
            ).toBeInTheDocument();
        });

        it('should render the top-right spider leg', () => {
            const { container } = renderWeb();
            expect(
                container.querySelector('line[x1="20"][y1="16"][x2="23"][y2="14"]')
            ).toBeInTheDocument();
        });

        it('should render the middle-right spider leg', () => {
            const { container } = renderWeb();
            expect(
                container.querySelector('line[x1="20"][y1="17"][x2="23"][y2="17"]')
            ).toBeInTheDocument();
        });

        it('should render the bottom-right spider leg', () => {
            const { container } = renderWeb();
            expect(
                container.querySelector('line[x1="20"][y1="18"][x2="23"][y2="20"]')
            ).toBeInTheDocument();
        });

        it('should render the left spider eye highlight', () => {
            const { container } = renderWeb();
            const eye = container.querySelector(
                'circle[cx="17.5"][cy="15.5"][r="0.3"]'
            );
            expect(eye).toBeInTheDocument();
            expect(eye).toHaveAttribute('fill', '#FFF');
        });

        it('should render the right spider eye highlight', () => {
            const { container } = renderWeb();
            const eye = container.querySelector(
                'circle[cx="18.5"][cy="15.5"][r="0.3"]'
            );
            expect(eye).toBeInTheDocument();
            expect(eye).toHaveAttribute('fill', '#FFF');
        });

        it('should render 2 spider eye highlight circles', () => {
            const { container } = renderWeb();
            const eyeHighlights = container.querySelectorAll('circle[fill="#FFF"]');
            expect(eyeHighlights.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('element counts', () => {
        it('should render total line count (14: 8 radial + 6 spider legs)', () => {
            const { container } = renderWeb();
            expect(container.querySelectorAll('line').length).toBeGreaterThanOrEqual(14);
        });

        it('should render total circle count (3: head + 2 eye highlights)', () => {
            const { container } = renderWeb();
            expect(container.querySelectorAll('circle').length).toBeGreaterThanOrEqual(3);
        });

        it('should render total ellipse count (1: spider body)', () => {
            const { container } = renderWeb();
            expect(container.querySelectorAll('ellipse').length).toBeGreaterThanOrEqual(1);
        });
    });
});
