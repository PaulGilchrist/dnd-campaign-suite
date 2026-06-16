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
    it('should render the root <g> element', () => {
        const { container } = renderTable();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderTable({ id: 'table-svg-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('table-svg-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderTable({ className: 'table-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('table-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(TableSVG.displayName).toBe('TableSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderTable({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render the table top rect', () => {
        const { container } = renderTable();
        const tabletop = container.querySelector(
            'rect[x="2"][y="4"][width="68"][height="28"]'
        );
        expect(tabletop).not.toBeNull();
        expect(tabletop.getAttribute('rx')).toBe('3');
        expect(tabletop.getAttribute('ry')).toBe('3');
        expect(tabletop.getAttribute('fill')).toBe('#A0652D');
        expect(tabletop.getAttribute('stroke')).toBe('#6B3E1F');
        expect(tabletop.getAttribute('stroke-width')).toBe('0.8');
    });

    it('should render the left side shading rect', () => {
        const { container } = renderTable();
        const shadingRect = container.querySelector(
            'rect[x="2"][y="4"][width="20"][height="28"]'
        );
        expect(shadingRect).not.toBeNull();
        expect(shadingRect.getAttribute('fill')).toBe('#8B5524');
        expect(shadingRect.getAttribute('opacity')).toBe('0.35');
    });

    it('should render the right side highlight rect', () => {
        const { container } = renderTable();
        const highlightRect = container.querySelector(
            'rect[x="50"][y="4"][width="20"][height="28"]'
        );
        expect(highlightRect).not.toBeNull();
        expect(highlightRect.getAttribute('fill')).toBe('#B87A3A');
        expect(highlightRect.getAttribute('opacity')).toBe('0.3');
    });

    it('should render the top edge bevel highlight rect', () => {
        const { container } = renderTable();
        const bevelRect = container.querySelector(
            'rect[x="4"][y="5"][width="64"][height="2"]'
        );
        expect(bevelRect).not.toBeNull();
        expect(bevelRect.getAttribute('rx')).toBe('1');
        expect(bevelRect.getAttribute('fill')).toBe('#C4944A');
        expect(bevelRect.getAttribute('opacity')).toBe('0.5');
    });

    it('should render the front edge shadow rect', () => {
        const { container } = renderTable();
        const shadowRect = container.querySelector(
            'rect[x="4"][y="30"][width="64"][height="1.5"]'
        );
        expect(shadowRect).not.toBeNull();
        expect(shadowRect.getAttribute('fill')).toBe('#6B3E1F');
        expect(shadowRect.getAttribute('opacity')).toBe('0.3');
    });

    it('should render the wood grain paths', () => {
        const { container } = renderTable();
        const grainPaths = container.querySelectorAll(
            'path[stroke="#7A4E20"][stroke-width="0.4"][opacity="0.5"]'
        );
        expect(grainPaths.length).toBe(3);
    });

    it('should render the first wood grain path', () => {
        const { container } = renderTable();
        const grainPath = container.querySelector(
            'path[d="M 8 10 Q 20 9 36 11 Q 52 13 64 10"]'
        );
        expect(grainPath).not.toBeNull();
        expect(grainPath.getAttribute('fill')).toBe('none');
        expect(grainPath.getAttribute('stroke')).toBe('#7A4E20');
    });

    it('should render the second wood grain path', () => {
        const { container } = renderTable();
        const grainPath = container.querySelector(
            'path[d="M 6 16 Q 18 15 32 17 Q 48 18 66 15"]'
        );
        expect(grainPath).not.toBeNull();
        expect(grainPath.getAttribute('fill')).toBe('none');
    });

    it('should render the third wood grain path', () => {
        const { container } = renderTable();
        const grainPath = container.querySelector(
            'path[d="M 10 22 Q 24 21 40 23 Q 54 24 62 21"]'
        );
        expect(grainPath).not.toBeNull();
        expect(grainPath.getAttribute('fill')).toBe('none');
    });

    it('should render the fourth wood grain path', () => {
        const { container } = renderTable();
        const grainPath = container.querySelector(
            'path[d="M 14 27 Q 28 26 38 28 Q 50 29 58 26"]'
        );
        expect(grainPath).not.toBeNull();
        expect(grainPath.getAttribute('fill')).toBe('none');
        expect(grainPath.getAttribute('stroke-width')).toBe('0.3');
        expect(grainPath.getAttribute('opacity')).toBe('0.4');
    });

    it('should render the left leg path', () => {
        const { container } = renderTable();
        const leftLeg = container.querySelector(
            'path[d="M 12 32 L 10 36 L 10 36 L 14 36 L 14 32 Z"]'
        );
        expect(leftLeg).not.toBeNull();
        expect(leftLeg.getAttribute('fill')).toBe('#8B5524');
        expect(leftLeg.getAttribute('stroke')).toBe('#6B3E1F');
        expect(leftLeg.getAttribute('stroke-width')).toBe('0.6');
    });

    it('should render the left leg shading path', () => {
        const { container } = renderTable();
        const leftLegShading = container.querySelector(
            'path[d="M 12 32 L 11 36 L 11 36 L 14 36 L 14 32 Z"]'
        );
        expect(leftLegShading).not.toBeNull();
        expect(leftLegShading.getAttribute('fill')).toBe('#7A4E20');
        expect(leftLegShading.getAttribute('opacity')).toBe('0.3');
    });

    it('should render the right leg path', () => {
        const { container } = renderTable();
        const rightLeg = container.querySelector(
            'path[d="M 58 32 L 58 36 L 62 36 L 62 36 L 60 32 Z"]'
        );
        expect(rightLeg).not.toBeNull();
        expect(rightLeg.getAttribute('fill')).toBe('#8B5524');
        expect(rightLeg.getAttribute('stroke')).toBe('#6B3E1F');
        expect(rightLeg.getAttribute('stroke-width')).toBe('0.6');
    });

    it('should render the right leg shading path', () => {
        const { container } = renderTable();
        const rightLegShading = container.querySelector(
            'path[d="M 60 32 L 61 36 L 61 36 L 62 36 L 60 32 Z"]'
        );
        expect(rightLegShading).not.toBeNull();
        expect(rightLegShading.getAttribute('fill')).toBe('#B87A3A');
        expect(rightLegShading.getAttribute('opacity')).toBe('0.25');
    });

    it('should render the leg decorative bracket rects', () => {
        const { container } = renderTable();
        const bracketRects = container.querySelectorAll(
            'rect[width="4"][height="2"][rx="0.5"]'
        );
        expect(bracketRects.length).toBe(2);
        bracketRects.forEach((rect) => {
            expect(rect.getAttribute('fill')).toBe('#6B3E1F');
        });
    });

    it('should render the cross stretcher rect', () => {
        const { container } = renderTable();
        const stretcherRect = container.querySelector(
            'rect[x="14"][y="35"][width="44"][height="1.5"]'
        );
        expect(stretcherRect).not.toBeNull();
        expect(stretcherRect.getAttribute('rx')).toBe('0.5');
        expect(stretcherRect.getAttribute('fill')).toBe('#7A4E20');
        expect(stretcherRect.getAttribute('stroke')).toBe('#6B3E1F');
        expect(stretcherRect.getAttribute('stroke-width')).toBe('0.4');
    });

    it('should render the cross stretcher highlight rect', () => {
        const { container } = renderTable();
        const stretcherHighlight = container.querySelector(
            'rect[x="14"][y="35"][width="44"][height="0.5"]'
        );
        expect(stretcherHighlight).not.toBeNull();
        expect(stretcherHighlight.getAttribute('fill')).toBe('#8B5524');
        expect(stretcherHighlight.getAttribute('opacity')).toBe('0.5');
    });

    it('should render the subtle surface highlight rect', () => {
        const { container } = renderTable();
        const surfaceHighlight = container.querySelector(
            'rect[x="30"][y="6"][width="30"][height="24"]'
        );
        expect(surfaceHighlight).not.toBeNull();
        expect(surfaceHighlight.getAttribute('fill')).toBe('#C4944A');
        expect(surfaceHighlight.getAttribute('opacity')).toBe('0.08');
        expect(surfaceHighlight.getAttribute('rx')).toBe('2');
    });

    it('should render total rect count (10 rects)', () => {
        const { container } = renderTable();
        const rects = container.querySelectorAll('rect');
        // tabletop, left shading, right highlight, top bevel, front shadow,
        // 2 leg brackets, cross stretcher, cross stretcher highlight, surface highlight = 10
        expect(rects.length).toBe(10);
    });

    it('should render total path count (8 paths)', () => {
        const { container } = renderTable();
        const paths = container.querySelectorAll('path');
        // 4 wood grain lines, 2 legs, 2 leg shading = 8
        expect(paths.length).toBe(8);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderTable({ 'data-test': 'table' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('table');
    });
});
