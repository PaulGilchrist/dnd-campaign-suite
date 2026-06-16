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
    it('should render the root <g> element', () => {
        const { container } = renderSkeleton();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderSkeleton({ id: 'skeleton-svg-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('skeleton-svg-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderSkeleton({ className: 'skeleton-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('skeleton-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(SkeletonSVG.displayName).toBe('SkeletonSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderSkeleton({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render the skull skull ellipse', () => {
        const { container } = renderSkeleton();
        const skull = container.querySelector(
            'ellipse[cx="18"][cy="7"][rx="6.5"][ry="5.5"]'
        );
        expect(skull).not.toBeNull();
        expect(skull.getAttribute('fill')).toBe('#E8DCC8');
        expect(skull.getAttribute('stroke')).toBe('#D5C4A1');
        expect(skull.getAttribute('stroke-width')).toBe('0.6');
    });

    it('should render the skull top highlight path', () => {
        const { container } = renderSkeleton();
        const highlight = container.querySelector(
            'path[d="M 12 5 Q 18 2 24 5"]'
        );
        expect(highlight).not.toBeNull();
        expect(highlight.getAttribute('fill')).toBe('none');
        expect(highlight.getAttribute('stroke')).toBe('#F5F0E8');
        expect(highlight.getAttribute('stroke-width')).toBe('0.5');
        expect(highlight.getAttribute('opacity')).toBe('0.6');
    });

    it('should render the left eye socket ellipse', () => {
        const { container } = renderSkeleton();
        const eye = container.querySelector(
            'ellipse[cx="15.5"][cy="6"][rx="1.5"][ry="1.8"]'
        );
        expect(eye).not.toBeNull();
        expect(eye.getAttribute('fill')).toBe('#333');
    });

    it('should render the right eye socket ellipse', () => {
        const { container } = renderSkeleton();
        const eye = container.querySelector(
            'ellipse[cx="20.5"][cy="6"][rx="1.5"][ry="1.8"]'
        );
        expect(eye).not.toBeNull();
        expect(eye.getAttribute('fill')).toBe('#333');
    });

    it('should render the nose cavity path', () => {
        const { container } = renderSkeleton();
        const nose = container.querySelector(
            'path[d="M 17.5 8.5 L 18 10 L 18.5 8.5 Z"]'
        );
        expect(nose).not.toBeNull();
        expect(nose.getAttribute('fill')).toBe('#333');
    });

    it('should render the left jaw hinge path', () => {
        const { container } = renderSkeleton();
        const jaw = container.querySelector(
            'path[d="M 12 8.5 Q 13 10.5 15 10"]'
        );
        expect(jaw).not.toBeNull();
        expect(jaw.getAttribute('fill')).toBe('none');
        expect(jaw.getAttribute('stroke')).toBe('#C4B898');
        expect(jaw.getAttribute('stroke-width')).toBe('0.4');
    });

    it('should render the right jaw hinge path', () => {
        const { container } = renderSkeleton();
        const jaw = container.querySelector(
            'path[d="M 24 8.5 Q 23 10.5 21 10"]'
        );
        expect(jaw).not.toBeNull();
        expect(jaw.getAttribute('fill')).toBe('none');
        expect(jaw.getAttribute('stroke')).toBe('#C4B898');
        expect(jaw.getAttribute('stroke-width')).toBe('0.4');
    });

    it('should render the ribcage ellipse', () => {
        const { container } = renderSkeleton();
        const ribcage = container.querySelector(
            'ellipse[cx="18"][cy="14"][rx="6"][ry="4"]'
        );
        expect(ribcage).not.toBeNull();
        expect(ribcage.getAttribute('fill')).toBe('#E8DCC8');
        expect(ribcage.getAttribute('stroke')).toBe('#D5C4A1');
        expect(ribcage.getAttribute('stroke-width')).toBe('0.6');
    });

    it('should render the rib lines (3 paths)', () => {
        const { container } = renderSkeleton();
        const ribPaths = container.querySelectorAll(
            'path[stroke="#D5C4A1"][stroke-width="0.4"]'
        );
        expect(ribPaths.length).toBe(3); // 3 rib lines (jaw hinges use #C4B898)
    });

    it('should render the first rib line', () => {
        const { container } = renderSkeleton();
        const rib = container.querySelector(
            'path[d="M 13 12.5 Q 18 10.5 23 12.5"]'
        );
        expect(rib).not.toBeNull();
        expect(rib.getAttribute('fill')).toBe('none');
        expect(rib.getAttribute('stroke')).toBe('#D5C4A1');
    });

    it('should render the second rib line', () => {
        const { container } = renderSkeleton();
        const rib = container.querySelector(
            'path[d="M 13 14 Q 18 12 23 14"]'
        );
        expect(rib).not.toBeNull();
        expect(rib.getAttribute('fill')).toBe('none');
    });

    it('should render the third rib line', () => {
        const { container } = renderSkeleton();
        const rib = container.querySelector(
            'path[d="M 13.5 15.5 Q 18 13.5 22.5 15.5"]'
        );
        expect(rib).not.toBeNull();
        expect(rib.getAttribute('fill')).toBe('none');
    });

    it('should render the sternum line', () => {
        const { container } = renderSkeleton();
        const sternum = container.querySelector(
            'line[x1="18"][y1="11"][x2="18"][y2="17"]'
        );
        expect(sternum).not.toBeNull();
        expect(sternum.getAttribute('stroke')).toBe('#D5C4A1');
        expect(sternum.getAttribute('stroke-width')).toBe('0.4');
    });

    it('should render the left arm lines (2 lines for humerus)', () => {
        const { container } = renderSkeleton();
        const leftArms = container.querySelectorAll(
            'line[x1="12"][y1="12"][x2="5"][y2="7"]'
        );
        expect(leftArms.length).toBe(2);
        expect(leftArms[0].getAttribute('stroke')).toBe('#E8DCC8');
        expect(leftArms[0].getAttribute('stroke-width')).toBe('3');
        expect(leftArms[0].getAttribute('stroke-linecap')).toBe('round');
        expect(leftArms[1].getAttribute('stroke')).toBe('#D5C4A1');
        expect(leftArms[1].getAttribute('stroke-width')).toBe('1.8');
    });

    it('should render the right arm lines (2 lines for humerus)', () => {
        const { container } = renderSkeleton();
        const rightArms = container.querySelectorAll(
            'line[x1="24"][y1="12"][x2="31"][y2="7"]'
        );
        expect(rightArms.length).toBe(2);
        expect(rightArms[0].getAttribute('stroke')).toBe('#E8DCC8');
        expect(rightArms[0].getAttribute('stroke-width')).toBe('3');
    });

    it('should render the shoulder knob circles', () => {
        const { container } = renderSkeleton();
        const shoulders = container.querySelectorAll(
            'circle[r="1.8"]'
        );
        expect(shoulders.length).toBe(2);
        expect(shoulders[0].getAttribute('fill')).toBe('#E8DCC8');
        expect(shoulders[0].getAttribute('stroke')).toBe('#D5C4A1');
    });

    it('should render the hand/wrist knob circles', () => {
        const { container } = renderSkeleton();
        const hands = container.querySelectorAll(
            'circle[r="1.5"][fill="#E8DCC8"]'
        );
        expect(hands.length).toBe(6); // 2 hands + 2 knees + 2 hips
    });

    it('should render the left hand knob', () => {
        const { container } = renderSkeleton();
        const hand = container.querySelector(
            'circle[cx="5"][cy="7"][r="1.5"]'
        );
        expect(hand).not.toBeNull();
        expect(hand.getAttribute('fill')).toBe('#E8DCC8');
    });

    it('should render the right hand knob', () => {
        const { container } = renderSkeleton();
        const hand = container.querySelector(
            'circle[cx="31"][cy="7"][r="1.5"]'
        );
        expect(hand).not.toBeNull();
        expect(hand.getAttribute('fill')).toBe('#E8DCC8');
    });

    it('should render the pelvis path', () => {
        const { container } = renderSkeleton();
        const pelvis = container.querySelector(
            'path[d="M 18 18 C 14 18, 12 19.5, 14 21.5 C 15 23, 17 22.5, 18 21.5 C 19 22.5, 21 23, 22 21.5 C 24 19.5, 22 18, 18 18 Z"]'
        );
        expect(pelvis).not.toBeNull();
        expect(pelvis.getAttribute('fill')).toBe('#E8DCC8');
        expect(pelvis.getAttribute('stroke')).toBe('#D5C4A1');
        expect(pelvis.getAttribute('stroke-width')).toBe('0.5');
    });

    it('should render the left femur lines (2 lines)', () => {
        const { container } = renderSkeleton();
        const leftLegs = container.querySelectorAll(
            'line[x1="15.5"][y1="21"][x2="11"][y2="29"]'
        );
        expect(leftLegs.length).toBe(2);
        expect(leftLegs[0].getAttribute('stroke')).toBe('#E8DCC8');
        expect(leftLegs[0].getAttribute('stroke-width')).toBe('2.8');
        expect(leftLegs[0].getAttribute('stroke-linecap')).toBe('round');
    });

    it('should render the right femur lines (2 lines)', () => {
        const { container } = renderSkeleton();
        const rightLegs = container.querySelectorAll(
            'line[x1="20.5"][y1="21"][x2="25"][y2="29"]'
        );
        expect(rightLegs.length).toBe(2);
        expect(rightLegs[0].getAttribute('stroke')).toBe('#E8DCC8');
        expect(rightLegs[0].getAttribute('stroke-width')).toBe('2.8');
    });

    it('should render the hip knob circles', () => {
        const { container } = renderSkeleton();
        const hips = container.querySelectorAll(
            'circle[cx="15.5"][cy="21"]'
        );
        expect(hips.length).toBe(1);
        expect(hips[0].getAttribute('r')).toBe('1.5');
    });

    it('should render the knee knob circles', () => {
        const { container } = renderSkeleton();
        const knees = container.querySelectorAll(
            'circle[cy="29"][r="1.5"]'
        );
        expect(knees.length).toBe(2);
        expect(knees[0].getAttribute('fill')).toBe('#E8DCC8');
    });

    it('should render total ellipse count (6 ellipses)', () => {
        const { container } = renderSkeleton();
        const ellipses = container.querySelectorAll('ellipse');
        // skull, left eye, right eye, ribcage = 4
        expect(ellipses.length).toBe(4);
    });

    it('should render total circle count (6 circles)', () => {
        const { container } = renderSkeleton();
        const circles = container.querySelectorAll('circle');
        // 2 shoulders + 2 hands + 2 hips + 2 knees = 8
        expect(circles.length).toBe(8);
    });

    it('should render total line count (7 lines)', () => {
        const { container } = renderSkeleton();
        const lines = container.querySelectorAll('line');
        // 2 left arm + 2 right arm + 1 sternum + 2 left leg + 2 right leg = 9
        expect(lines.length).toBe(9);
    });

    it('should render total path count (9 paths)', () => {
        const { container } = renderSkeleton();
        const paths = container.querySelectorAll('path');
        // skull highlight, nose, 2 jaw hinges, 3 ribs, pelvis = 8
        expect(paths.length).toBe(8);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderSkeleton({ 'data-test': 'skeleton' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('skeleton');
    });

    it('should render with no props (default rendering)', () => {
        const { container } = renderSkeleton({});
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
        expect(rootGroup.getAttribute('id')).toBeNull();
    });
});
