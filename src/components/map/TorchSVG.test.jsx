// @improved-by-ai
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
    describe('root element', () => {
        it('should render the root <g> element', () => {
            const { container } = renderTorch();
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toBeInTheDocument();
        });

        it('should apply the given id to the root group', () => {
            const { container } = renderTorch({ id: 'torch-svg-1' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveAttribute('id', 'torch-svg-1');
        });

        it('should apply the given className to the root group', () => {
            const { container } = renderTorch({ className: 'torch-custom' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveClass('torch-custom');
        });

        it('should pass through rest props to the root group', () => {
            const { container } = renderTorch({ 'data-test': 'torch' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveAttribute('data-test', 'torch');
        });

        it('should have displayName set to TorchSVG', () => {
            expect(TorchSVG.displayName).toBe('TorchSVG');
        });

        it('should render as a forwardRef component', () => {
            const ref = vi.fn();
            renderTorch({ ref });
            expect(ref).toHaveBeenCalled();
        });
    });

    describe('wall section', () => {
        it('should render the wall section rect', () => {
            const { container } = renderTorch();
            const wallRect = container.querySelector(
                'rect[x="0"][y="0"][width="3"][height="36"]'
            );
            expect(wallRect).toBeInTheDocument();
            expect(wallRect).toHaveAttribute('fill', '#777');
            expect(wallRect).toHaveAttribute('stroke', '#555');
            expect(wallRect).toHaveAttribute('stroke-width', '0.4');
        });

        it('should render the wall edge shadow rect', () => {
            const { container } = renderTorch();
            const shadowRect = container.querySelector(
                'rect[x="3"][y="0"][width="1"][height="36"]'
            );
            expect(shadowRect).toBeInTheDocument();
            expect(shadowRect).toHaveAttribute('fill', '#333');
            expect(shadowRect).toHaveAttribute('opacity', '0.3');
        });

        it('should render stone texture lines', () => {
            const { container } = renderTorch();
            const stoneLines = container.querySelectorAll(
                'line[stroke="#666"][stroke-width="0.3"]'
            );
            expect(stoneLines.length).toBeGreaterThan(0);
        });

        it('should render individual stone texture lines at y=9, y=18, and y=27', () => {
            const { container } = renderTorch();
            expect(
                container.querySelector('line[x1="0"][y1="9"][x2="3"][y2="9"]')
            ).toBeInTheDocument();
            expect(
                container.querySelector('line[x1="0"][y1="18"][x2="3"][y2="18"]')
            ).toBeInTheDocument();
            expect(
                container.querySelector('line[x1="0"][y1="27"][x2="3"][y2="27"]')
            ).toBeInTheDocument();
        });
    });

    describe('bracket', () => {
        it('should render the bracket arm rect', () => {
            const { container } = renderTorch();
            const bracketRect = container.querySelector(
                'rect[x="3"][y="16"][width="5"][height="2.5"]'
            );
            expect(bracketRect).toBeInTheDocument();
            expect(bracketRect).toHaveAttribute('fill', '#666');
            expect(bracketRect).toHaveAttribute('stroke', '#555');
            expect(bracketRect).toHaveAttribute('stroke-width', '0.5');
            expect(bracketRect).toHaveAttribute('rx', '0.3');
        });

        it('should render the bracket brace line', () => {
            const { container } = renderTorch();
            const braceLine = container.querySelector(
                'line[x1="3"][y1="18.5"][x2="6"][y2="20"]'
            );
            expect(braceLine).toBeInTheDocument();
            expect(braceLine).toHaveAttribute('stroke', '#666');
            expect(braceLine).toHaveAttribute('stroke-width', '1.5');
            expect(braceLine).toHaveAttribute('stroke-linecap', 'round');
        });

        it('should render the bracket highlight rect', () => {
            const { container } = renderTorch();
            const highlightRect = container.querySelector(
                'rect[x="3"][y="16"][width="5"][height="0.5"]'
            );
            expect(highlightRect).toBeInTheDocument();
            expect(highlightRect).toHaveAttribute('fill', '#888');
            expect(highlightRect).toHaveAttribute('opacity', '0.4');
        });

        it('should render the bracket-to-sconce connection circle', () => {
            const { container } = renderTorch();
            const connectionCircle = container.querySelector(
                'circle[cx="8"][cy="18"][r="1"]'
            );
            expect(connectionCircle).toBeInTheDocument();
            expect(connectionCircle).toHaveAttribute('fill', '#555');
        });
    });

    describe('sconce', () => {
        it('should render the sconce outer ring circle', () => {
            const { container } = renderTorch();
            const outerRing = container.querySelector(
                'circle[cx="12"][cy="18"][r="3.5"]'
            );
            expect(outerRing).toBeInTheDocument();
            expect(outerRing).toHaveAttribute('fill', '#666');
            expect(outerRing).toHaveAttribute('stroke', '#555');
            expect(outerRing).toHaveAttribute('stroke-width', '0.6');
        });

        it('should render the sconce rim highlight circle', () => {
            const { container } = renderTorch();
            const rimHighlight = container.querySelector(
                'circle[cx="12"][cy="18"][r="3"]'
            );
            expect(rimHighlight).toBeInTheDocument();
            expect(rimHighlight).toHaveAttribute('fill', 'none');
            expect(rimHighlight).toHaveAttribute('stroke', '#888');
            expect(rimHighlight).toHaveAttribute('stroke-width', '0.3');
            expect(rimHighlight).toHaveAttribute('opacity', '0.5');
        });

        it('should render the sconce interior circle', () => {
            const { container } = renderTorch();
            const interior = container.querySelector(
                'circle[cx="12"][cy="18"][r="2.5"]'
            );
            expect(interior).toBeInTheDocument();
            expect(interior).toHaveAttribute('fill', '#333');
        });

        it('should render the ambient glow circle', () => {
            const { container } = renderTorch();
            const glow = container.querySelector(
                'circle[cx="12"][cy="18"][r="8"]'
            );
            expect(glow).toBeInTheDocument();
            expect(glow).toHaveAttribute('fill', '#E67E22');
            expect(glow).toHaveAttribute('opacity', '0.1');
        });
    });

    describe('flames', () => {
        it('should render the outer flame ellipse', () => {
            const { container } = renderTorch();
            const outerFlame = container.querySelector(
                'ellipse[cx="12"][cy="18"][rx="2"][ry="2.2"]'
            );
            expect(outerFlame).toBeInTheDocument();
            expect(outerFlame).toHaveAttribute('fill', '#E67E22');
        });

        it('should render the middle flame ellipse', () => {
            const { container } = renderTorch();
            const middleFlame = container.querySelector(
                'ellipse[cx="12"][cy="18"][rx="1.3"][ry="1.5"]'
            );
            expect(middleFlame).toBeInTheDocument();
            expect(middleFlame).toHaveAttribute('fill', '#F1C40F');
        });

        it('should render the inner flame ellipse', () => {
            const { container } = renderTorch();
            const innerFlame = container.querySelector(
                'ellipse[cx="12"][cy="18"][rx="0.6"][ry="0.8"]'
            );
            expect(innerFlame).toBeInTheDocument();
            expect(innerFlame).toHaveAttribute('fill', '#FFF9C4');
            expect(innerFlame).toHaveAttribute('opacity', '0.8');
        });
    });

    describe('element counts', () => {
        it('should render rects', () => {
            const { container } = renderTorch();
            const rects = container.querySelectorAll('rect');
            expect(rects.length).toBeGreaterThanOrEqual(4);
        });

        it('should render circles', () => {
            const { container } = renderTorch();
            const circles = container.querySelectorAll('circle');
            expect(circles.length).toBeGreaterThanOrEqual(5);
        });

        it('should render ellipses', () => {
            const { container } = renderTorch();
            const ellipses = container.querySelectorAll('ellipse');
            expect(ellipses.length).toBeGreaterThanOrEqual(3);
        });

        it('should render lines', () => {
            const { container } = renderTorch();
            const lines = container.querySelectorAll('line');
            expect(lines.length).toBeGreaterThanOrEqual(4);
        });
    });
});
