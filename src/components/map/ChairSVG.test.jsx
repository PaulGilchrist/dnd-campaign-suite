// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChairSVG from './ChairSVG.jsx';

const renderChair = (props = {}) =>
    render(
        <svg>
            <ChairSVG {...props} />
        </svg>
    );

describe('ChairSVG', () => {
    describe('root element', () => {
        it('should render the root <g> element', () => {
            const { container } = renderChair();
            expect(container.querySelector('g')).toBeInTheDocument();
        });

        it('should apply the given id to the root group', () => {
            const { container } = renderChair({ id: 'chair-svg-1' });
            expect(container.querySelector('g')).toHaveAttribute('id', 'chair-svg-1');
        });

        it('should apply the given className to the root group', () => {
            const { container } = renderChair({ className: 'chair-custom' });
            expect(container.querySelector('g')).toHaveClass('chair-custom');
        });

        it('should pass through rest props to the root group', () => {
            const { container } = renderChair({ 'data-test': 'chair' });
            expect(container.querySelector('g')).toHaveAttribute('data-test', 'chair');
        });
    });

    describe('component metadata', () => {
        it('should render with displayName', () => {
            expect(ChairSVG.displayName).toBe('ChairSVG');
        });

        it('should render as a forwardRef component', () => {
            const ref = vi.fn();
            renderChair({ ref });
            expect(ref).toHaveBeenCalled();
        });
    });

    describe('floor shadow', () => {
        it('should render the floor shadow rect with correct attributes', () => {
            const { container } = renderChair();
            const shadow = container.querySelector(
                'rect[x="3"][y="3"][width="30"][height="30"][rx="1"]'
            );
            expect(shadow).toBeInTheDocument();
            expect(shadow).toHaveAttribute('fill', '#4A2810');
            expect(shadow).toHaveAttribute('opacity', '0.15');
        });
    });

    describe('backrest', () => {
        it('should render the backrest rect with correct attributes', () => {
            const { container } = renderChair();
            const backrest = container.querySelector(
                'rect[x="7"][y="4"][width="22"][height="7"]'
            );
            expect(backrest).toBeInTheDocument();
            expect(backrest).toHaveAttribute('fill', '#5C3317');
            expect(backrest).toHaveAttribute('stroke', '#4A2810');
            expect(backrest).toHaveAttribute('stroke-width', '0.6');
        });

        it('should render the gold trim on backrest', () => {
            const { container } = renderChair();
            const goldTrim = container.querySelector(
                'rect[x="7"][y="4"][width="22"][height="1"]'
            );
            expect(goldTrim).toBeInTheDocument();
            expect(goldTrim).toHaveAttribute('fill', '#D4AF37');
            expect(goldTrim).toHaveAttribute('opacity', '0.8');
        });

        it('should render the decorative circles in backrest', () => {
            const { container } = renderChair();
            const outerCircle = container.querySelector(
                'circle[cx="18"][cy="7.5"][r="2.2"]'
            );
            expect(outerCircle).toBeInTheDocument();
            expect(outerCircle).toHaveAttribute('fill', 'none');
            expect(outerCircle).toHaveAttribute('stroke', '#D4AF37');

            const innerCircle = container.querySelector(
                'circle[cx="18"][cy="7.5"][r="0.8"]'
            );
            expect(innerCircle).toBeInTheDocument();
            expect(innerCircle).toHaveAttribute('stroke-width', '0.4');
        });
    });

    describe('seat cushion', () => {
        it('should render the seat cushion rect with correct attributes', () => {
            const { container } = renderChair();
            const cushion = container.querySelector(
                'rect[x="7"][y="11"][width="22"][height="14"]'
            );
            expect(cushion).toBeInTheDocument();
            expect(cushion).toHaveAttribute('fill', '#8B0000');
            expect(cushion).toHaveAttribute('stroke', '#6B0000');
        });

        it('should render the cushion center inner area', () => {
            const { container } = renderChair();
            const cushionCenter = container.querySelector(
                'rect[x="9"][y="13"][width="18"][height="10"]'
            );
            expect(cushionCenter).toBeInTheDocument();
            expect(cushionCenter).toHaveAttribute('fill', '#A00000');
            expect(cushionCenter).toHaveAttribute('opacity', '0.25');
        });

        it('should render the cushion highlight', () => {
            const { container } = renderChair();
            const highlight = container.querySelector(
                'rect[x="8"][y="11.5"][width="20"][height="0.6"]'
            );
            expect(highlight).toBeInTheDocument();
            expect(highlight).toHaveAttribute('fill', '#C00000');
            expect(highlight).toHaveAttribute('opacity', '0.3');
        });
    });

    describe('left armrest', () => {
        it('should render the left armrest with correct attributes', () => {
            const { container } = renderChair();
            const leftArmrest = container.querySelector(
                'rect[x="4"][y="11"][width="3"][height="14"]'
            );
            expect(leftArmrest).toBeInTheDocument();
            expect(leftArmrest).toHaveAttribute('fill', '#5C3317');
            expect(leftArmrest).toHaveAttribute('stroke', '#4A2810');
        });

        it('should render the gold tip on left armrest', () => {
            const { container } = renderChair();
            const goldTip = container.querySelector(
                'circle[cx="5.5"][cy="24.5"][r="1.2"]'
            );
            expect(goldTip).toBeInTheDocument();
            expect(goldTip).toHaveAttribute('fill', '#D4AF37');
            expect(goldTip).toHaveAttribute('stroke', '#B8860B');
        });

        it('should render the armrest highlight on left armrest', () => {
            const { container } = renderChair();
            const leftHighlight = container.querySelector(
                'rect[x="4"][y="11"][width="0.5"][height="14"]'
            );
            expect(leftHighlight).toBeInTheDocument();
            expect(leftHighlight).toHaveAttribute('fill', '#7A4E20');
            expect(leftHighlight).toHaveAttribute('opacity', '0.4');
        });
    });

    describe('right armrest', () => {
        it('should render the right armrest with correct attributes', () => {
            const { container } = renderChair();
            const rightArmrest = container.querySelector(
                'rect[x="29"][y="11"][width="3"][height="14"]'
            );
            expect(rightArmrest).toBeInTheDocument();
            expect(rightArmrest).toHaveAttribute('fill', '#5C3317');
            expect(rightArmrest).toHaveAttribute('stroke', '#4A2810');
        });

        it('should render the gold tip on right armrest', () => {
            const { container } = renderChair();
            const goldTip = container.querySelector(
                'circle[cx="30.5"][cy="24.5"][r="1.2"]'
            );
            expect(goldTip).toBeInTheDocument();
            expect(goldTip).toHaveAttribute('fill', '#D4AF37');
            expect(goldTip).toHaveAttribute('stroke', '#B8860B');
        });

        it('should render the armrest highlight on right armrest', () => {
            const { container } = renderChair();
            const rightHighlight = container.querySelector(
                'rect[x="31.5"][y="11"][width="0.5"][height="14"]'
            );
            expect(rightHighlight).toBeInTheDocument();
            expect(rightHighlight).toHaveAttribute('fill', '#7A4E20');
            expect(rightHighlight).toHaveAttribute('opacity', '0.4');
        });
    });

    describe('front frame', () => {
        it('should render the front frame rect with correct attributes', () => {
            const { container } = renderChair();
            const frontFrame = container.querySelector(
                'rect[x="7"][y="25"][width="22"][height="4"]'
            );
            expect(frontFrame).toBeInTheDocument();
            expect(frontFrame).toHaveAttribute('fill', '#5C3317');
            expect(frontFrame).toHaveAttribute('stroke', '#4A2810');
        });
    });

    describe('legs', () => {
        it('should render all four legs', () => {
            const { container } = renderChair();
            const legs = container.querySelectorAll(
                'rect[fill="#4A2810"][rx="0.3"]'
            );
            expect(legs.length).toBeGreaterThanOrEqual(4);
        });

        it('should render the back left leg', () => {
            const { container } = renderChair();
            const leg = container.querySelector(
                'rect[x="5"][y="5"][width="3"][height="3"]'
            );
            expect(leg).toBeInTheDocument();
            expect(leg).toHaveAttribute('fill', '#4A2810');
        });

        it('should render the back right leg', () => {
            const { container } = renderChair();
            const leg = container.querySelector(
                'rect[x="28"][y="5"][width="3"][height="3"]'
            );
            expect(leg).toBeInTheDocument();
            expect(leg).toHaveAttribute('fill', '#4A2810');
        });

        it('should render the front left leg', () => {
            const { container } = renderChair();
            const leg = container.querySelector(
                'rect[x="5"][y="27"][width="3"][height="3"]'
            );
            expect(leg).toBeInTheDocument();
            expect(leg).toHaveAttribute('fill', '#4A2810');
        });

        it('should render the front right leg', () => {
            const { container } = renderChair();
            const leg = container.querySelector(
                'rect[x="28"][y="27"][width="3"][height="3"]'
            );
            expect(leg).toBeInTheDocument();
            expect(leg).toHaveAttribute('fill', '#4A2810');
        });
    });

    describe('element counts', () => {
        it('should render at least 15 rects', () => {
            const { container } = renderChair();
            const rects = container.querySelectorAll('rect');
            // 1 shadow + 1 backrest + 1 gold trim + 1 cushion + 1 cushion center + 1 cushion highlight
            // + 1 left armrest + 1 left armrest highlight + 1 right armrest + 1 right armrest highlight
            // + 1 front frame + 4 legs = 15
            expect(rects.length).toBeGreaterThanOrEqual(15);
        });

        it('should render at least 4 circles', () => {
            const { container } = renderChair();
            const circles = container.querySelectorAll('circle');
            // 2 decorative circles in backrest + 2 gold tips on armrests
            expect(circles.length).toBeGreaterThanOrEqual(4);
        });
    });
});
