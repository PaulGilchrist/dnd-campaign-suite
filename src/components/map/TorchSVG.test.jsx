import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TorchSVG from './TorchSVG.jsx';

const renderTorch = (props = {}) =>
    render(
        <svg>
            <TorchSVG {...props} />
        </svg>
    );

describe('TorchSVG', () => {
    it('should render the root <g> element', () => {
        const { container } = renderTorch();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderTorch({ id: 'torch-svg-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('torch-svg-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderTorch({ className: 'torch-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('torch-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(TorchSVG.displayName).toBe('TorchSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderTorch({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render the wall section rect', () => {
        const { container } = renderTorch();
        const wallRect = container.querySelector(
            'rect[x="0"][y="0"][width="3"][height="36"]'
        );
        expect(wallRect).not.toBeNull();
        expect(wallRect.getAttribute('fill')).toBe('#777');
        expect(wallRect.getAttribute('stroke')).toBe('#555');
        expect(wallRect.getAttribute('stroke-width')).toBe('0.4');
    });

    it('should render the wall edge shadow rect', () => {
        const { container } = renderTorch();
        const shadowRect = container.querySelector(
            'rect[x="3"][y="0"][width="1"][height="36"]'
        );
        expect(shadowRect).not.toBeNull();
        expect(shadowRect.getAttribute('fill')).toBe('#333');
        expect(shadowRect.getAttribute('opacity')).toBe('0.3');
    });

    it('should render the stone texture lines', () => {
        const { container } = renderTorch();
        const stoneLines = container.querySelectorAll(
            'line[stroke="#666"][stroke-width="0.3"]'
        );
        expect(stoneLines.length).toBe(3);
    });

    it('should render the first stone texture line at y=9', () => {
        const { container } = renderTorch();
        const line = container.querySelector(
            'line[x1="0"][y1="9"][x2="3"][y2="9"]'
        );
        expect(line).not.toBeNull();
    });

    it('should render the second stone texture line at y=18', () => {
        const { container } = renderTorch();
        const line = container.querySelector(
            'line[x1="0"][y1="18"][x2="3"][y2="18"]'
        );
        expect(line).not.toBeNull();
    });

    it('should render the third stone texture line at y=27', () => {
        const { container } = renderTorch();
        const line = container.querySelector(
            'line[x1="0"][y1="27"][x2="3"][y2="27"]'
        );
        expect(line).not.toBeNull();
    });

    it('should render the bracket arm rect', () => {
        const { container } = renderTorch();
        const bracketRect = container.querySelector(
            'rect[x="3"][y="16"][width="5"][height="2.5"]'
        );
        expect(bracketRect).not.toBeNull();
        expect(bracketRect.getAttribute('fill')).toBe('#666');
        expect(bracketRect.getAttribute('stroke')).toBe('#555');
        expect(bracketRect.getAttribute('stroke-width')).toBe('0.5');
        expect(bracketRect.getAttribute('rx')).toBe('0.3');
    });

    it('should render the bracket brace line', () => {
        const { container } = renderTorch();
        const braceLine = container.querySelector(
            'line[x1="3"][y1="18.5"][x2="6"][y2="20"]'
        );
        expect(braceLine).not.toBeNull();
        expect(braceLine.getAttribute('stroke')).toBe('#666');
        expect(braceLine.getAttribute('stroke-width')).toBe('1.5');
        expect(braceLine.getAttribute('stroke-linecap')).toBe('round');
    });

    it('should render the bracket highlight rect', () => {
        const { container } = renderTorch();
        const highlightRect = container.querySelector(
            'rect[x="3"][y="16"][width="5"][height="0.5"]'
        );
        expect(highlightRect).not.toBeNull();
        expect(highlightRect.getAttribute('fill')).toBe('#888');
        expect(highlightRect.getAttribute('opacity')).toBe('0.4');
    });

    it('should render the bracket-to-sconce connection circle', () => {
        const { container } = renderTorch();
        const connectionCircle = container.querySelector(
            'circle[cx="8"][cy="18"][r="1"]'
        );
        expect(connectionCircle).not.toBeNull();
        expect(connectionCircle.getAttribute('fill')).toBe('#555');
    });

    it('should render the sconce outer ring circle', () => {
        const { container } = renderTorch();
        const outerRing = container.querySelector(
            'circle[cx="12"][cy="18"][r="3.5"]'
        );
        expect(outerRing).not.toBeNull();
        expect(outerRing.getAttribute('fill')).toBe('#666');
        expect(outerRing.getAttribute('stroke')).toBe('#555');
        expect(outerRing.getAttribute('stroke-width')).toBe('0.6');
    });

    it('should render the sconce rim highlight circle', () => {
        const { container } = renderTorch();
        const rimHighlight = container.querySelector(
            'circle[cx="12"][cy="18"][r="3"]'
        );
        expect(rimHighlight).not.toBeNull();
        expect(rimHighlight.getAttribute('fill')).toBe('none');
        expect(rimHighlight.getAttribute('stroke')).toBe('#888');
        expect(rimHighlight.getAttribute('stroke-width')).toBe('0.3');
        expect(rimHighlight.getAttribute('opacity')).toBe('0.5');
    });

    it('should render the sconce interior circle', () => {
        const { container } = renderTorch();
        const interior = container.querySelector(
            'circle[cx="12"][cy="18"][r="2.5"]'
        );
        expect(interior).not.toBeNull();
        expect(interior.getAttribute('fill')).toBe('#333');
    });

    it('should render the ambient glow circle', () => {
        const { container } = renderTorch();
        const glow = container.querySelector(
            'circle[cx="12"][cy="18"][r="8"]'
        );
        expect(glow).not.toBeNull();
        expect(glow.getAttribute('fill')).toBe('#E67E22');
        expect(glow.getAttribute('opacity')).toBe('0.1');
    });

    it('should render the outer flame ellipse', () => {
        const { container } = renderTorch();
        const outerFlame = container.querySelector(
            'ellipse[cx="12"][cy="18"][rx="2"][ry="2.2"]'
        );
        expect(outerFlame).not.toBeNull();
        expect(outerFlame.getAttribute('fill')).toBe('#E67E22');
    });

    it('should render the middle flame ellipse', () => {
        const { container } = renderTorch();
        const middleFlame = container.querySelector(
            'ellipse[cx="12"][cy="18"][rx="1.3"][ry="1.5"]'
        );
        expect(middleFlame).not.toBeNull();
        expect(middleFlame.getAttribute('fill')).toBe('#F1C40F');
    });

    it('should render the inner flame ellipse', () => {
        const { container } = renderTorch();
        const innerFlame = container.querySelector(
            'ellipse[cx="12"][cy="18"][rx="0.6"][ry="0.8"]'
        );
        expect(innerFlame).not.toBeNull();
        expect(innerFlame.getAttribute('fill')).toBe('#FFF9C4');
        expect(innerFlame.getAttribute('opacity')).toBe('0.8');
    });

    it('should render total rect count (4 rects)', () => {
        const { container } = renderTorch();
        const rects = container.querySelectorAll('rect');
        expect(rects.length).toBe(4);
    });

    it('should render total circle count (5 circles)', () => {
        const { container } = renderTorch();
        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBe(5);
    });

    it('should render total ellipse count (3 ellipses)', () => {
        const { container } = renderTorch();
        const ellipses = container.querySelectorAll('ellipse');
        expect(ellipses.length).toBe(3);
    });

    it('should render total line count (4 lines)', () => {
        const { container } = renderTorch();
        const lines = container.querySelectorAll('line');
        expect(lines.length).toBe(4);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderTorch({ 'data-test': 'torch' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('torch');
    });
});
