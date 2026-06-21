// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TableSVG from './TableSVG.jsx';

const renderTable = (props = {}) =>
    render(
        <svg>
            <TableSVG {...props} />
        </svg>
    );

describe('TableSVG', () => {
    describe('root element', () => {
        it('should render the root <g> element', () => {
            const { container } = renderTable();
            expect(container.querySelector('g')).toBeInTheDocument();
        });

        it('should apply the given id to the root group', () => {
            const { container } = renderTable({ id: 'table-svg-1' });
            expect(container.querySelector('g')).toHaveAttribute('id', 'table-svg-1');
        });

        it('should apply the given className to the root group', () => {
            const { container } = renderTable({ className: 'table-custom' });
            expect(container.querySelector('g')).toHaveClass('table-custom');
        });

        it('should pass through rest props to the root group', () => {
            const { container } = renderTable({ 'data-test': 'table' });
            expect(container.querySelector('g')).toHaveAttribute('data-test', 'table');
        });

        it('should have displayName', () => {
            expect(TableSVG.displayName).toBe('TableSVG');
        });

        it('should render as a forwardRef component', () => {
            const ref = vi.fn();
            renderTable({ ref });
            expect(ref).toHaveBeenCalled();
        });
    });

    describe('tabletop', () => {
        it('should render the table top rect', () => {
            const { container } = renderTable();
            const tabletop = container.querySelector(
                'rect[x="2"][y="4"][width="68"][height="28"]'
            );
            expect(tabletop).toBeInTheDocument();
            expect(tabletop).toHaveAttribute('rx', '3');
            expect(tabletop).toHaveAttribute('ry', '3');
            expect(tabletop).toHaveAttribute('fill', '#A0652D');
            expect(tabletop).toHaveAttribute('stroke', '#6B3E1F');
            expect(tabletop).toHaveAttribute('stroke-width', '0.8');
        });

        it('should render the left side shading rect', () => {
            const { container } = renderTable();
            const shadingRect = container.querySelector(
                'rect[x="2"][y="4"][width="20"][height="28"]'
            );
            expect(shadingRect).toBeInTheDocument();
            expect(shadingRect).toHaveAttribute('fill', '#8B5524');
            expect(shadingRect).toHaveAttribute('opacity', '0.35');
        });

        it('should render the right side highlight rect', () => {
            const { container } = renderTable();
            const highlightRect = container.querySelector(
                'rect[x="50"][y="4"][width="20"][height="28"]'
            );
            expect(highlightRect).toBeInTheDocument();
            expect(highlightRect).toHaveAttribute('fill', '#B87A3A');
            expect(highlightRect).toHaveAttribute('opacity', '0.3');
        });

        it('should render the top edge bevel highlight rect', () => {
            const { container } = renderTable();
            const bevelRect = container.querySelector(
                'rect[x="4"][y="5"][width="64"][height="2"]'
            );
            expect(bevelRect).toBeInTheDocument();
            expect(bevelRect).toHaveAttribute('rx', '1');
            expect(bevelRect).toHaveAttribute('fill', '#C4944A');
            expect(bevelRect).toHaveAttribute('opacity', '0.5');
        });

        it('should render the front edge shadow rect', () => {
            const { container } = renderTable();
            const shadowRect = container.querySelector(
                'rect[x="4"][y="30"][width="64"][height="1.5"]'
            );
            expect(shadowRect).toBeInTheDocument();
            expect(shadowRect).toHaveAttribute('fill', '#6B3E1F');
            expect(shadowRect).toHaveAttribute('opacity', '0.3');
        });

        it('should render the subtle surface highlight rect', () => {
            const { container } = renderTable();
            const surfaceHighlight = container.querySelector(
                'rect[x="30"][y="6"][width="30"][height="24"]'
            );
            expect(surfaceHighlight).toBeInTheDocument();
            expect(surfaceHighlight).toHaveAttribute('fill', '#C4944A');
            expect(surfaceHighlight).toHaveAttribute('opacity', '0.08');
            expect(surfaceHighlight).toHaveAttribute('rx', '2');
        });
    });

    describe('wood grain', () => {
        it('should render wood grain paths', () => {
            const { container } = renderTable();
            const grainPaths = container.querySelectorAll(
                'path[stroke="#7A4E20"][stroke-width="0.4"][opacity="0.5"]'
            );
            expect(grainPaths.length).toBeGreaterThan(0);
        });

        it('should render the first wood grain path', () => {
            const { container } = renderTable();
            const grainPath = container.querySelector(
                'path[d="M 8 10 Q 20 9 36 11 Q 52 13 64 10"]'
            );
            expect(grainPath).toBeInTheDocument();
            expect(grainPath).toHaveAttribute('fill', 'none');
            expect(grainPath).toHaveAttribute('stroke', '#7A4E20');
        });

        it('should render the second wood grain path', () => {
            const { container } = renderTable();
            const grainPath = container.querySelector(
                'path[d="M 6 16 Q 18 15 32 17 Q 48 18 66 15"]'
            );
            expect(grainPath).toBeInTheDocument();
            expect(grainPath).toHaveAttribute('fill', 'none');
        });

        it('should render the third wood grain path', () => {
            const { container } = renderTable();
            const grainPath = container.querySelector(
                'path[d="M 10 22 Q 24 21 40 23 Q 54 24 62 21"]'
            );
            expect(grainPath).toBeInTheDocument();
            expect(grainPath).toHaveAttribute('fill', 'none');
        });

        it('should render the fourth wood grain path', () => {
            const { container } = renderTable();
            const grainPath = container.querySelector(
                'path[d="M 14 27 Q 28 26 38 28 Q 50 29 58 26"]'
            );
            expect(grainPath).toBeInTheDocument();
            expect(grainPath).toHaveAttribute('fill', 'none');
            expect(grainPath).toHaveAttribute('stroke-width', '0.3');
            expect(grainPath).toHaveAttribute('opacity', '0.4');
        });
    });

    describe('legs', () => {
        it('should render the left leg path', () => {
            const { container } = renderTable();
            const leftLeg = container.querySelector(
                'path[d="M 12 32 L 10 36 L 10 36 L 14 36 L 14 32 Z"]'
            );
            expect(leftLeg).toBeInTheDocument();
            expect(leftLeg).toHaveAttribute('fill', '#8B5524');
            expect(leftLeg).toHaveAttribute('stroke', '#6B3E1F');
            expect(leftLeg).toHaveAttribute('stroke-width', '0.6');
        });

        it('should render the left leg shading path', () => {
            const { container } = renderTable();
            const leftLegShading = container.querySelector(
                'path[d="M 12 32 L 11 36 L 11 36 L 14 36 L 14 32 Z"]'
            );
            expect(leftLegShading).toBeInTheDocument();
            expect(leftLegShading).toHaveAttribute('fill', '#7A4E20');
            expect(leftLegShading).toHaveAttribute('opacity', '0.3');
        });

        it('should render the right leg path', () => {
            const { container } = renderTable();
            const rightLeg = container.querySelector(
                'path[d="M 58 32 L 58 36 L 62 36 L 62 36 L 60 32 Z"]'
            );
            expect(rightLeg).toBeInTheDocument();
            expect(rightLeg).toHaveAttribute('fill', '#8B5524');
            expect(rightLeg).toHaveAttribute('stroke', '#6B3E1F');
            expect(rightLeg).toHaveAttribute('stroke-width', '0.6');
        });

        it('should render the right leg shading path', () => {
            const { container } = renderTable();
            const rightLegShading = container.querySelector(
                'path[d="M 60 32 L 61 36 L 61 36 L 62 36 L 60 32 Z"]'
            );
            expect(rightLegShading).toBeInTheDocument();
            expect(rightLegShading).toHaveAttribute('fill', '#B87A3A');
            expect(rightLegShading).toHaveAttribute('opacity', '0.25');
        });

        it('should render the leg decorative bracket rects', () => {
            const { container } = renderTable();
            const bracketRects = container.querySelectorAll(
                'rect[width="4"][height="2"][rx="0.5"]'
            );
            expect(bracketRects.length).toBeGreaterThanOrEqual(2);
            bracketRects.forEach((rect) => {
                expect(rect).toHaveAttribute('fill', '#6B3E1F');
            });
        });
    });

    describe('cross stretcher', () => {
        it('should render the cross stretcher rect', () => {
            const { container } = renderTable();
            const stretcherRect = container.querySelector(
                'rect[x="14"][y="35"][width="44"][height="1.5"]'
            );
            expect(stretcherRect).toBeInTheDocument();
            expect(stretcherRect).toHaveAttribute('rx', '0.5');
            expect(stretcherRect).toHaveAttribute('fill', '#7A4E20');
            expect(stretcherRect).toHaveAttribute('stroke', '#6B3E1F');
            expect(stretcherRect).toHaveAttribute('stroke-width', '0.4');
        });

        it('should render the cross stretcher highlight rect', () => {
            const { container } = renderTable();
            const stretcherHighlight = container.querySelector(
                'rect[x="14"][y="35"][width="44"][height="0.5"]'
            );
            expect(stretcherHighlight).toBeInTheDocument();
            expect(stretcherHighlight).toHaveAttribute('fill', '#8B5524');
            expect(stretcherHighlight).toHaveAttribute('opacity', '0.5');
        });
    });

    describe('element counts', () => {
        it('should render rects', () => {
            const { container } = renderTable();
            const rects = container.querySelectorAll('rect');
            expect(rects.length).toBeGreaterThanOrEqual(10);
        });

        it('should render paths', () => {
            const { container } = renderTable();
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBeGreaterThanOrEqual(8);
        });
    });
});
