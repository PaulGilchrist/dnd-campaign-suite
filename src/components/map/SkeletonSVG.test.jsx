// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SkeletonSVG from './SkeletonSVG.jsx';

const renderSkeleton = (props = {}) =>
    render(
        <svg>
            <SkeletonSVG {...props} />
        </svg>
    );

describe('SkeletonSVG', () => {
    describe('root element', () => {
        it('should render the root <g> element', () => {
            const { container } = renderSkeleton();
            expect(container.querySelector('g')).toBeInTheDocument();
        });

        it('should apply the given id to the root group', () => {
            const { container } = renderSkeleton({ id: 'skeleton-svg-1' });
            expect(container.querySelector('g')).toHaveAttribute('id', 'skeleton-svg-1');
        });

        it('should apply the given className to the root group', () => {
            const { container } = renderSkeleton({ className: 'skeleton-custom' });
            expect(container.querySelector('g')).toHaveClass('skeleton-custom');
        });

        it('should pass through rest props to the root group', () => {
            const { container } = renderSkeleton({ 'data-test': 'skeleton' });
            expect(container.querySelector('g')).toHaveAttribute('data-test', 'skeleton');
        });

        it('should render with no props (default rendering)', () => {
            const { container } = renderSkeleton({});
            expect(container.querySelector('g')).toBeInTheDocument();
            expect(container.querySelector('g')).not.toHaveAttribute('id');
        });
    });

    describe('displayName and forwardRef', () => {
        it('should render with displayName', () => {
            expect(SkeletonSVG.displayName).toBe('SkeletonSVG');
        });

        it('should render as a forwardRef component', () => {
            const ref = vi.fn();
            renderSkeleton({ ref });
            expect(ref).toHaveBeenCalled();
        });
    });

    describe('skull', () => {
        it('should render the skull ellipse', () => {
            const { container } = renderSkeleton();
            const skull = container.querySelector(
                'ellipse[cx="18"][cy="7"][rx="6.5"][ry="5.5"]'
            );
            expect(skull).toBeInTheDocument();
            expect(skull).toHaveAttribute('fill', '#E8DCC8');
            expect(skull).toHaveAttribute('stroke', '#D5C4A1');
            expect(skull).toHaveAttribute('stroke-width', '0.6');
        });

        it('should render the skull top highlight path', () => {
            const { container } = renderSkeleton();
            const highlight = container.querySelector(
                'path[d="M 12 5 Q 18 2 24 5"]'
            );
            expect(highlight).toBeInTheDocument();
            expect(highlight).toHaveAttribute('fill', 'none');
            expect(highlight).toHaveAttribute('stroke', '#F5F0E8');
            expect(highlight).toHaveAttribute('stroke-width', '0.5');
            expect(highlight).toHaveAttribute('opacity', '0.6');
        });

        it('should render the left eye socket ellipse', () => {
            const { container } = renderSkeleton();
            const eye = container.querySelector(
                'ellipse[cx="15.5"][cy="6"][rx="1.5"][ry="1.8"]'
            );
            expect(eye).toBeInTheDocument();
            expect(eye).toHaveAttribute('fill', '#333');
        });

        it('should render the right eye socket ellipse', () => {
            const { container } = renderSkeleton();
            const eye = container.querySelector(
                'ellipse[cx="20.5"][cy="6"][rx="1.5"][ry="1.8"]'
            );
            expect(eye).toBeInTheDocument();
            expect(eye).toHaveAttribute('fill', '#333');
        });

        it('should render the nose cavity path', () => {
            const { container } = renderSkeleton();
            const nose = container.querySelector(
                'path[d="M 17.5 8.5 L 18 10 L 18.5 8.5 Z"]'
            );
            expect(nose).toBeInTheDocument();
            expect(nose).toHaveAttribute('fill', '#333');
        });
    });

    describe('jaw hinges', () => {
        it('should render the left jaw hinge path', () => {
            const { container } = renderSkeleton();
            const jaw = container.querySelector(
                'path[d="M 12 8.5 Q 13 10.5 15 10"]'
            );
            expect(jaw).toBeInTheDocument();
            expect(jaw).toHaveAttribute('fill', 'none');
            expect(jaw).toHaveAttribute('stroke', '#C4B898');
            expect(jaw).toHaveAttribute('stroke-width', '0.4');
        });

        it('should render the right jaw hinge path', () => {
            const { container } = renderSkeleton();
            const jaw = container.querySelector(
                'path[d="M 24 8.5 Q 23 10.5 21 10"]'
            );
            expect(jaw).toBeInTheDocument();
            expect(jaw).toHaveAttribute('fill', 'none');
            expect(jaw).toHaveAttribute('stroke', '#C4B898');
            expect(jaw).toHaveAttribute('stroke-width', '0.4');
        });
    });

    describe('ribcage', () => {
        it('should render the ribcage ellipse', () => {
            const { container } = renderSkeleton();
            const ribcage = container.querySelector(
                'ellipse[cx="18"][cy="14"][rx="6"][ry="4"]'
            );
            expect(ribcage).toBeInTheDocument();
            expect(ribcage).toHaveAttribute('fill', '#E8DCC8');
            expect(ribcage).toHaveAttribute('stroke', '#D5C4A1');
            expect(ribcage).toHaveAttribute('stroke-width', '0.6');
        });

        it('should render the first rib line', () => {
            const { container } = renderSkeleton();
            const rib = container.querySelector(
                'path[d="M 13 12.5 Q 18 10.5 23 12.5"]'
            );
            expect(rib).toBeInTheDocument();
            expect(rib).toHaveAttribute('fill', 'none');
            expect(rib).toHaveAttribute('stroke', '#D5C4A1');
        });

        it('should render the second rib line', () => {
            const { container } = renderSkeleton();
            const rib = container.querySelector(
                'path[d="M 13 14 Q 18 12 23 14"]'
            );
            expect(rib).toBeInTheDocument();
            expect(rib).toHaveAttribute('fill', 'none');
        });

        it('should render the third rib line', () => {
            const { container } = renderSkeleton();
            const rib = container.querySelector(
                'path[d="M 13.5 15.5 Q 18 13.5 22.5 15.5"]'
            );
            expect(rib).toBeInTheDocument();
            expect(rib).toHaveAttribute('fill', 'none');
        });

        it('should render the sternum line', () => {
            const { container } = renderSkeleton();
            const sternum = container.querySelector(
                'line[x1="18"][y1="11"][x2="18"][y2="17"]'
            );
            expect(sternum).toBeInTheDocument();
            expect(sternum).toHaveAttribute('stroke', '#D5C4A1');
            expect(sternum).toHaveAttribute('stroke-width', '0.4');
        });
    });

    describe('arms', () => {
        it('should render the left arm lines (2 lines for humerus)', () => {
            const { container } = renderSkeleton();
            const leftArms = container.querySelectorAll(
                'line[x1="12"][y1="12"][x2="5"][y2="7"]'
            );
            expect(leftArms.length).toBeGreaterThan(1);
            expect(leftArms[0]).toHaveAttribute('stroke', '#E8DCC8');
            expect(leftArms[0]).toHaveAttribute('stroke-width', '3');
            expect(leftArms[0]).toHaveAttribute('stroke-linecap', 'round');
            expect(leftArms[1]).toHaveAttribute('stroke', '#D5C4A1');
            expect(leftArms[1]).toHaveAttribute('stroke-width', '1.8');
        });

        it('should render the right arm lines (2 lines for humerus)', () => {
            const { container } = renderSkeleton();
            const rightArms = container.querySelectorAll(
                'line[x1="24"][y1="12"][x2="31"][y2="7"]'
            );
            expect(rightArms.length).toBeGreaterThan(1);
            expect(rightArms[0]).toHaveAttribute('stroke', '#E8DCC8');
            expect(rightArms[0]).toHaveAttribute('stroke-width', '3');
        });
    });

    describe('knobs and joints', () => {
        it('should render the shoulder knob circles', () => {
            const { container } = renderSkeleton();
            const shoulders = container.querySelectorAll(
                'circle[r="1.8"]'
            );
            expect(shoulders.length).toBeGreaterThan(1);
            expect(shoulders[0]).toHaveAttribute('fill', '#E8DCC8');
            expect(shoulders[0]).toHaveAttribute('stroke', '#D5C4A1');
        });

        it('should render the hand/wrist knob circles', () => {
            const { container } = renderSkeleton();
            const hands = container.querySelectorAll(
                'circle[r="1.5"][fill="#E8DCC8"]'
            );
            expect(hands.length).toBeGreaterThanOrEqual(4);
        });

        it('should render the left hand knob', () => {
            const { container } = renderSkeleton();
            const hand = container.querySelector(
                'circle[cx="5"][cy="7"][r="1.5"]'
            );
            expect(hand).toBeInTheDocument();
            expect(hand).toHaveAttribute('fill', '#E8DCC8');
        });

        it('should render the right hand knob', () => {
            const { container } = renderSkeleton();
            const hand = container.querySelector(
                'circle[cx="31"][cy="7"][r="1.5"]'
            );
            expect(hand).toBeInTheDocument();
            expect(hand).toHaveAttribute('fill', '#E8DCC8');
        });
    });

    describe('pelvis and legs', () => {
        it('should render the pelvis path', () => {
            const { container } = renderSkeleton();
            const pelvis = container.querySelector(
                'path[d="M 18 18 C 14 18, 12 19.5, 14 21.5 C 15 23, 17 22.5, 18 21.5 C 19 22.5, 21 23, 22 21.5 C 24 19.5, 22 18, 18 18 Z"]'
            );
            expect(pelvis).toBeInTheDocument();
            expect(pelvis).toHaveAttribute('fill', '#E8DCC8');
            expect(pelvis).toHaveAttribute('stroke', '#D5C4A1');
            expect(pelvis).toHaveAttribute('stroke-width', '0.5');
        });

        it('should render the left femur lines (2 lines)', () => {
            const { container } = renderSkeleton();
            const leftLegs = container.querySelectorAll(
                'line[x1="15.5"][y1="21"][x2="11"][y2="29"]'
            );
            expect(leftLegs.length).toBeGreaterThan(1);
            expect(leftLegs[0]).toHaveAttribute('stroke', '#E8DCC8');
            expect(leftLegs[0]).toHaveAttribute('stroke-width', '2.8');
            expect(leftLegs[0]).toHaveAttribute('stroke-linecap', 'round');
        });

        it('should render the right femur lines (2 lines)', () => {
            const { container } = renderSkeleton();
            const rightLegs = container.querySelectorAll(
                'line[x1="20.5"][y1="21"][x2="25"][y2="29"]'
            );
            expect(rightLegs.length).toBeGreaterThan(1);
            expect(rightLegs[0]).toHaveAttribute('stroke', '#E8DCC8');
            expect(rightLegs[0]).toHaveAttribute('stroke-width', '2.8');
        });

        it('should render the hip knob circles', () => {
            const { container } = renderSkeleton();
            const hips = container.querySelectorAll(
                'circle[cx="15.5"][cy="21"]'
            );
            expect(hips.length).toBeGreaterThanOrEqual(1);
            expect(hips[0]).toHaveAttribute('r', '1.5');
        });

        it('should render the knee knob circles', () => {
            const { container } = renderSkeleton();
            const knees = container.querySelectorAll(
                'circle[cy="29"][r="1.5"]'
            );
            expect(knees.length).toBeGreaterThan(1);
            expect(knees[0]).toHaveAttribute('fill', '#E8DCC8');
        });
    });

    describe('element counts', () => {
        it('should render ellipses (at least 4)', () => {
            const { container } = renderSkeleton();
            const ellipses = container.querySelectorAll('ellipse');
            expect(ellipses.length).toBeGreaterThanOrEqual(4);
        });

        it('should render circles (at least 6)', () => {
            const { container } = renderSkeleton();
            const circles = container.querySelectorAll('circle');
            expect(circles.length).toBeGreaterThanOrEqual(6);
        });

        it('should render lines (at least 7)', () => {
            const { container } = renderSkeleton();
            const lines = container.querySelectorAll('line');
            expect(lines.length).toBeGreaterThanOrEqual(7);
        });

        it('should render paths (at least 6)', () => {
            const { container } = renderSkeleton();
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBeGreaterThanOrEqual(6);
        });
    });
});
