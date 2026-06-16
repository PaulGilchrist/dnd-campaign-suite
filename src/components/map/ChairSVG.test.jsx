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
    it('should render the root <g> element', () => {
        const { container } = renderChair();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderChair({ id: 'chair-svg-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('chair-svg-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderChair({ className: 'chair-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('chair-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(ChairSVG.displayName).toBe('ChairSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderChair({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render the floor shadow rect', () => {
        const { container } = renderChair();
        const shadow = container.querySelector(
            'rect[x="3"][y="3"][width="30"][height="30"][rx="1"]'
        );
        expect(shadow).not.toBeNull();
        expect(shadow.getAttribute('fill')).toBe('#4A2810');
        expect(shadow.getAttribute('opacity')).toBe('0.15');
    });

    it('should render the backrest rect', () => {
        const { container } = renderChair();
        const backrest = container.querySelector(
            'rect[x="7"][y="4"][width="22"][height="7"]'
        );
        expect(backrest).not.toBeNull();
        expect(backrest.getAttribute('fill')).toBe('#5C3317');
        expect(backrest.getAttribute('stroke')).toBe('#4A2810');
        expect(backrest.getAttribute('stroke-width')).toBe('0.6');
    });

    it('should render the gold trim on backrest', () => {
        const { container } = renderChair();
        const goldTrim = container.querySelector(
            'rect[x="7"][y="4"][width="22"][height="1"]'
        );
        expect(goldTrim).not.toBeNull();
        expect(goldTrim.getAttribute('fill')).toBe('#D4AF37');
        expect(goldTrim.getAttribute('opacity')).toBe('0.8');
    });

    it('should render the decorative circles in backrest', () => {
        const { container } = renderChair();
        const outerCircle = container.querySelector(
            'circle[cx="18"][cy="7.5"][r="2.2"]'
        );
        expect(outerCircle).not.toBeNull();
        expect(outerCircle.getAttribute('fill')).toBe('none');
        expect(outerCircle.getAttribute('stroke')).toBe('#D4AF37');

        const innerCircle = container.querySelector(
            'circle[cx="18"][cy="7.5"][r="0.8"]'
        );
        expect(innerCircle).not.toBeNull();
        expect(innerCircle.getAttribute('fill')).toBe('none');
        expect(innerCircle.getAttribute('stroke-width')).toBe('0.4');
    });

    it('should render the seat cushion rect', () => {
        const { container } = renderChair();
        const cushion = container.querySelector(
            'rect[x="7"][y="11"][width="22"][height="14"]'
        );
        expect(cushion).not.toBeNull();
        expect(cushion.getAttribute('fill')).toBe('#8B0000');
        expect(cushion.getAttribute('stroke')).toBe('#6B0000');
    });

    it('should render the cushion center inner area', () => {
        const { container } = renderChair();
        const cushionCenter = container.querySelector(
            'rect[x="9"][y="13"][width="18"][height="10"]'
        );
        expect(cushionCenter).not.toBeNull();
        expect(cushionCenter.getAttribute('fill')).toBe('#A00000');
        expect(cushionCenter.getAttribute('opacity')).toBe('0.25');
    });

    it('should render the cushion highlight', () => {
        const { container } = renderChair();
        const highlight = container.querySelector(
            'rect[x="8"][y="11.5"][width="20"][height="0.6"]'
        );
        expect(highlight).not.toBeNull();
        expect(highlight.getAttribute('fill')).toBe('#C00000');
        expect(highlight.getAttribute('opacity')).toBe('0.3');
    });

    it('should render the left armrest', () => {
        const { container } = renderChair();
        const leftArmrest = container.querySelector(
            'rect[x="4"][y="11"][width="3"][height="14"]'
        );
        expect(leftArmrest).not.toBeNull();
        expect(leftArmrest.getAttribute('fill')).toBe('#5C3317');
        expect(leftArmrest.getAttribute('stroke')).toBe('#4A2810');
    });

    it('should render the gold tip on left armrest', () => {
        const { container } = renderChair();
        const goldTip = container.querySelector(
            'circle[cx="5.5"][cy="24.5"][r="1.2"]'
        );
        expect(goldTip).not.toBeNull();
        expect(goldTip.getAttribute('fill')).toBe('#D4AF37');
        expect(goldTip.getAttribute('stroke')).toBe('#B8860B');
    });

    it('should render the armrest highlight on left armrest', () => {
        const { container } = renderChair();
        const leftHighlight = container.querySelector(
            'rect[x="4"][y="11"][width="0.5"][height="14"]'
        );
        expect(leftHighlight).not.toBeNull();
        expect(leftHighlight.getAttribute('fill')).toBe('#7A4E20');
        expect(leftHighlight.getAttribute('opacity')).toBe('0.4');
    });

    it('should render the right armrest', () => {
        const { container } = renderChair();
        const rightArmrest = container.querySelector(
            'rect[x="29"][y="11"][width="3"][height="14"]'
        );
        expect(rightArmrest).not.toBeNull();
        expect(rightArmrest.getAttribute('fill')).toBe('#5C3317');
        expect(rightArmrest.getAttribute('stroke')).toBe('#4A2810');
    });

    it('should render the gold tip on right armrest', () => {
        const { container } = renderChair();
        const goldTip = container.querySelector(
            'circle[cx="30.5"][cy="24.5"][r="1.2"]'
        );
        expect(goldTip).not.toBeNull();
        expect(goldTip.getAttribute('fill')).toBe('#D4AF37');
        expect(goldTip.getAttribute('stroke')).toBe('#B8860B');
    });

    it('should render the armrest highlight on right armrest', () => {
        const { container } = renderChair();
        const rightHighlight = container.querySelector(
            'rect[x="31.5"][y="11"][width="0.5"][height="14"]'
        );
        expect(rightHighlight).not.toBeNull();
        expect(rightHighlight.getAttribute('fill')).toBe('#7A4E20');
        expect(rightHighlight.getAttribute('opacity')).toBe('0.4');
    });

    it('should render the front frame rect', () => {
        const { container } = renderChair();
        const frontFrame = container.querySelector(
            'rect[x="7"][y="25"][width="22"][height="4"]'
        );
        expect(frontFrame).not.toBeNull();
        expect(frontFrame.getAttribute('fill')).toBe('#5C3317');
        expect(frontFrame.getAttribute('stroke')).toBe('#4A2810');
    });

    it('should render all four legs', () => {
        const { container } = renderChair();
        const legs = container.querySelectorAll(
            'rect[fill="#4A2810"][rx="0.3"]'
        );
        expect(legs.length).toBe(4);
    });

    it('should render the back left leg', () => {
        const { container } = renderChair();
        const leg = container.querySelector(
            'rect[x="5"][y="5"][width="3"][height="3"]'
        );
        expect(leg).not.toBeNull();
        expect(leg.getAttribute('fill')).toBe('#4A2810');
    });

    it('should render the back right leg', () => {
        const { container } = renderChair();
        const leg = container.querySelector(
            'rect[x="28"][y="5"][width="3"][height="3"]'
        );
        expect(leg).not.toBeNull();
        expect(leg.getAttribute('fill')).toBe('#4A2810');
    });

    it('should render the front left leg', () => {
        const { container } = renderChair();
        const leg = container.querySelector(
            'rect[x="5"][y="27"][width="3"][height="3"]'
        );
        expect(leg).not.toBeNull();
        expect(leg.getAttribute('fill')).toBe('#4A2810');
    });

    it('should render the front right leg', () => {
        const { container } = renderChair();
        const leg = container.querySelector(
            'rect[x="28"][y="27"][width="3"][height="3"]'
        );
        expect(leg).not.toBeNull();
        expect(leg.getAttribute('fill')).toBe('#4A2810');
    });

    it('should render total rect count (15 rects)', () => {
        const { container } = renderChair();
        const rects = container.querySelectorAll('rect');
        // 1 shadow + 1 backrest + 1 gold trim + 1 cushion + 1 cushion center + 1 cushion highlight
        // + 1 left armrest + 1 left armrest highlight + 1 right armrest + 1 right armrest highlight
        // + 1 front frame + 4 legs = 15
        expect(rects.length).toBe(15);
    });

    it('should render total circle count (4 circles)', () => {
        const { container } = renderChair();
        const circles = container.querySelectorAll('circle');
        // 2 decorative circles in backrest + 2 gold tips on armrests
        expect(circles.length).toBe(4);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderChair({ 'data-test': 'chair' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('chair');
    });
});
