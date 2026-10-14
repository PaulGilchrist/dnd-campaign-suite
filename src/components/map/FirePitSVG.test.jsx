import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FirePitSVG from './FirePitSVG';

describe('FirePitSVG', () => {
  describe('props', () => {
    it('renders a <g> element with id, className, rest props, and ref', () => {
      const ref = React.createRef();
      const { container } = render(
        <FirePitSVG id="firepit-1" className="custom-firepit" data-test="firepit-test" ref={ref} />
      );
      const g = container.querySelector('g');
      expect(g).toBeInTheDocument();
      expect(g).toHaveAttribute('id', 'firepit-1');
      expect(g).toHaveClass('custom-firepit');
      expect(g).toHaveAttribute('data-test', 'firepit-test');
      expect(ref.current).toBe(g);
    });
  });

  describe('ambient glow', () => {
    it('renders 3 glow circles with correct attributes', () => {
      const { container } = render(<FirePitSVG />);
      const circles = container.querySelectorAll('circle[fill="#E87A20"]');
      const glowCircles = Array.from(circles).filter(
        (c) => {
          const cy = c.getAttribute('cy');
          const r = parseFloat(c.getAttribute('r'));
          return (cy === '10' || cy === '18') && r >= 14;
        },
      );
      expect(glowCircles.length).toBe(3);
      expect(glowCircles[0]).toHaveAttribute('cx', '18');
      expect(glowCircles[0]).toHaveAttribute('r', '17');
      expect(glowCircles[0]).toHaveAttribute('opacity', '0.1');
      expect(glowCircles[1]).toHaveAttribute('r', '14');
      expect(glowCircles[1]).toHaveAttribute('opacity', '0.08');
      expect(glowCircles[2]).toHaveAttribute('cy', '18');
      expect(glowCircles[2]).toHaveAttribute('r', '18');
      expect(glowCircles[2]).toHaveAttribute('opacity', '0.03');
    });
  });

  describe('stone ring', () => {
    it('renders the stone ring circle with correct styling', () => {
      const { container } = render(<FirePitSVG />);
      const stoneRing = container.querySelector(
        'circle[cx="18"][cy="20"][r="9"][fill="#555"][stroke="#333"]',
      );
      expect(stoneRing).toBeInTheDocument();
      expect(stoneRing).toHaveAttribute('stroke-width', '1.5');
    });
  });

  describe('embers', () => {
    it('renders the ember ellipse at the base', () => {
      const { container } = render(<FirePitSVG />);
      const emberEllipse = container.querySelector('ellipse[cx="18"][cy="20"][rx="6"][ry="2"]');
      expect(emberEllipse).toBeInTheDocument();
      expect(emberEllipse).toHaveAttribute('fill', '#2a1510');
    });

    it('renders 4 ember accent circles with correct attributes', () => {
      const { container } = render(<FirePitSVG />);
      const emberCircles = container.querySelectorAll('circle[fill="#8B3A1A"], circle[fill="#A04020"]');
      expect(emberCircles.length).toBe(4);
      emberCircles.forEach((circle) => {
        expect(circle).toHaveAttribute('opacity');
      });
    });
  });

  describe('flames', () => {
    it('renders flame paths with all expected color layers', () => {
      const { container } = render(<FirePitSVG />);
      const paths = container.querySelectorAll('path');
      const fillColors = new Set(Array.from(paths).map((p) => p.getAttribute('fill')));

      expect(fillColors).toContain('#D35400');
      expect(fillColors).toContain('#E87A20');
      expect(fillColors).toContain('#F5D060');
      expect(fillColors).toContain('#FFF8E0');
    });

    it('renders the correct number of flame paths per layer', () => {
      const { container } = render(<FirePitSVG />);
      const paths = container.querySelectorAll('path');
      const outerFlames = Array.from(paths).filter((p) => p.getAttribute('fill') === '#D35400');
      const midFlames = Array.from(paths).filter((p) => p.getAttribute('fill') === '#E87A20');
      const innerFlames = Array.from(paths).filter((p) => p.getAttribute('fill') === '#F5D060');
      const coreFlame = Array.from(paths).filter((p) => p.getAttribute('fill') === '#FFF8E0');

      expect(outerFlames.length).toBe(7);
      expect(midFlames.length).toBe(5);
      expect(innerFlames.length).toBe(3);
      expect(coreFlame.length).toBe(1);
    });
  });

  describe('core', () => {
    it('renders the white-hot core ellipse', () => {
      const { container } = render(<FirePitSVG />);
      const core = container.querySelector('ellipse[cx="18"][cy="9"][fill="#FFFFFF"]');
      expect(core).toBeInTheDocument();
      expect(core).toHaveAttribute('rx', '1.5');
      expect(core).toHaveAttribute('ry', '2');
      expect(core).toHaveAttribute('opacity', '0.6');
    });
  });

  describe('sparks', () => {
    it('renders spark circles with correct colors and opacities', () => {
      const { container } = render(<FirePitSVG />);
      const sparkColors = ['#F5D060', '#E87A20', '#FFF8E0'];
      const sparkCircles = Array.from(
        container.querySelectorAll('circle'),
      ).filter((c) => sparkColors.includes(c.getAttribute('fill')));
      // 10 floating sparks + 3 ember circles (#F5D060, #E87A20, #FFF8E0) = 13
      expect(sparkCircles.length).toBe(13);
      sparkCircles.forEach((circle) => {
        expect(circle).toHaveAttribute('opacity');
      });
    });
  });
});

