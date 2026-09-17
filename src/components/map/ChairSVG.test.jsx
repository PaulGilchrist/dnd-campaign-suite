// @improved-by-ai
import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ChairSVG from './ChairSVG.jsx';

describe('ChairSVG', () => {
  describe('root element', () => {
    it('renders a <g> element with id, className, rest props, and ref', () => {
      const ref = React.createRef();
      const { container } = render(
        <ChairSVG id="chair-1" className="chair-svg test-class" data-testid="my-chair" ref={ref} />
      );
      const g = container.querySelector('g');
      expect(g).toBeInTheDocument();
      expect(g).toHaveAttribute('id', 'chair-1');
      expect(g).toHaveAttribute('class', 'chair-svg test-class');
      expect(g).toHaveAttribute('data-testid', 'my-chair');
      expect(ref.current).toBe(g);
    });
  });

  describe('floor shadow', () => {
    it('renders the shadow rect with correct attributes', () => {
      const { container } = render(<ChairSVG />);
      const shadow = container.querySelector('rect[fill="#4A2810"][opacity="0.15"]');
      expect(shadow).toBeInTheDocument();
      expect(shadow).toHaveAttribute('x', '3');
      expect(shadow).toHaveAttribute('y', '3');
      expect(shadow).toHaveAttribute('width', '30');
      expect(shadow).toHaveAttribute('height', '30');
      expect(shadow).toHaveAttribute('rx', '1');
    });
  });

  describe('backrest', () => {
    it('renders the backrest main rect at the back edge', () => {
      const { container } = render(<ChairSVG />);
      const backrest = container.querySelector(
        'rect[fill="#5C3317"][stroke="#4A2810"][stroke-width="0.6"]',
      );
      expect(backrest).toBeInTheDocument();
      expect(backrest).toHaveAttribute('x', '7');
      expect(backrest).toHaveAttribute('y', '3');
      expect(backrest).toHaveAttribute('width', '22');
      expect(backrest).toHaveAttribute('height', '7');
      expect(backrest).toHaveAttribute('rx', '0.8');
    });

    it('renders the gold trim on the back edge', () => {
      const { container } = render(<ChairSVG />);
      const trim = container.querySelector('rect[fill="#D4AF37"][opacity="0.8"]');
      expect(trim).toBeInTheDocument();
      expect(trim).toHaveAttribute('x', '7');
      expect(trim).toHaveAttribute('y', '3');
      expect(trim).toHaveAttribute('width', '22');
      expect(trim).toHaveAttribute('height', '1');
    });

    it('renders decorative circles in the backrest', () => {
      const { container } = render(<ChairSVG />);
      const circles = container.querySelectorAll('circle[stroke="#D4AF37"]');
      expect(circles.length).toBe(2);

      const outer = circles[0];
      expect(outer).toHaveAttribute('cx', '18');
      expect(outer).toHaveAttribute('cy', '6.5');
      expect(outer).toHaveAttribute('fill', 'none');
      expect(outer).toHaveAttribute('stroke-width', '0.5');

      const inner = circles[1];
      expect(inner).toHaveAttribute('r', '0.8');
      expect(inner).toHaveAttribute('stroke-width', '0.4');
      expect(inner).toHaveAttribute('opacity', '0.4');
    });
  });

  describe('seat cushion', () => {
    it('renders the cushion main rect', () => {
      const { container } = render(<ChairSVG />);
      const cushion = container.querySelector('rect[fill="#8B0000"][stroke="#6B0000"]');
      expect(cushion).toBeInTheDocument();
      expect(cushion).toHaveAttribute('x', '7');
      expect(cushion).toHaveAttribute('y', '10');
      expect(cushion).toHaveAttribute('width', '22');
      expect(cushion).toHaveAttribute('height', '25');
      expect(cushion).toHaveAttribute('rx', '1.2');
    });

    it('runs the red cushion to the front edge so the facing direction is obvious', () => {
      const { container } = render(<ChairSVG />);
      const cushion = container.querySelector('rect[fill="#8B0000"][stroke="#6B0000"]');
      const frontY = Number(cushion.getAttribute('y')) + Number(cushion.getAttribute('height'));
      expect(frontY).toBeGreaterThanOrEqual(34);
    });

    it('renders the cushion inner area highlight', () => {
      const { container } = render(<ChairSVG />);
      const inner = container.querySelector('rect[fill="#A00000"][opacity="0.25"]');
      expect(inner).toBeInTheDocument();
      expect(inner).toHaveAttribute('x', '9');
      expect(inner).toHaveAttribute('y', '12');
      expect(inner).toHaveAttribute('width', '18');
      expect(inner).toHaveAttribute('height', '21');
    });

    it('renders the cushion edge highlight next to the backrest', () => {
      const { container } = render(<ChairSVG />);
      const highlight = container.querySelector('rect[fill="#C00000"][opacity="0.3"]');
      expect(highlight).toBeInTheDocument();
      expect(highlight).toHaveAttribute('x', '8');
      expect(highlight).toHaveAttribute('y', '10.5');
      expect(highlight).toHaveAttribute('width', '20');
      expect(highlight).toHaveAttribute('height', '0.6');
    });
  });

  describe('armrests', () => {
    it('renders the left armrest with correct attributes', () => {
      const { container } = render(<ChairSVG />);
      const leftArmrest = container.querySelector(
        'rect[fill="#5C3317"][stroke="#4A2810"][stroke-width="0.4"][x="4"]',
      );
      expect(leftArmrest).toBeInTheDocument();
      expect(leftArmrest).toHaveAttribute('y', '10');
      expect(leftArmrest).toHaveAttribute('width', '3');
      expect(leftArmrest).toHaveAttribute('height', '22');
    });

    it('renders the right armrest with correct attributes', () => {
      const { container } = render(<ChairSVG />);
      const rightArmrest = container.querySelector(
        'rect[fill="#5C3317"][stroke="#4A2810"][stroke-width="0.4"][x="29"]',
      );
      expect(rightArmrest).toBeInTheDocument();
      expect(rightArmrest).toHaveAttribute('y', '10');
      expect(rightArmrest).toHaveAttribute('width', '3');
      expect(rightArmrest).toHaveAttribute('height', '22');
    });

    it('renders the left armrest highlight', () => {
      const { container } = render(<ChairSVG />);
      const highlight = container.querySelector('rect[fill="#7A4E20"][opacity="0.4"]');
      expect(highlight).toBeInTheDocument();
      expect(highlight).toHaveAttribute('x', '4');
    });

    it('renders the right armrest highlight', () => {
      const { container } = render(<ChairSVG />);
      const highlights = Array.from(
        container.querySelectorAll('rect[fill="#7A4E20"][opacity="0.4"]'),
      );
      const rightHighlight = highlights.find((h) => h.getAttribute('x') === '31.5');
      expect(rightHighlight).toBeInTheDocument();
    });

    it('renders gold tips on both armrests at the front ends', () => {
      const { container } = render(<ChairSVG />);
      const tips = container.querySelectorAll('circle[fill="#D4AF37"][stroke="#B8860B"]');
      expect(tips.length).toBe(2);

      expect(tips[0]).toHaveAttribute('cx', '5.5');
      expect(tips[0]).toHaveAttribute('cy', '30');
      expect(tips[0]).toHaveAttribute('r', '1.2');

      expect(tips[1]).toHaveAttribute('cx', '30.5');
      expect(tips[1]).toHaveAttribute('cy', '30');
    });
  });

  describe('front', () => {
    it('has no wood band across the seat width in front of the cushion', () => {
      const { container } = render(<ChairSVG />);
      const wideWoodRects = Array.from(container.querySelectorAll('rect[fill="#5C3317"]'))
        .filter((r) => r.getAttribute('width') === '22');
      expect(wideWoodRects).toHaveLength(1);
      expect(wideWoodRects[0].getAttribute('y')).toBe('3');
    });
  });

  describe('legs', () => {
    it('renders all four legs at the correct corners', () => {
      const { container } = render(<ChairSVG />);
      const legs = container.querySelectorAll('rect[fill="#4A2810"]');
      // 4 legs + 1 shadow = 5 rects with fill="#4A2810"
      expect(legs.length).toBe(5);

      const legPositions = [
        { x: '5', y: '4' },    // back left
        { x: '28', y: '4' },   // back right
        { x: '5', y: '29' },   // front left
        { x: '28', y: '29' },  // front right
      ];

      legPositions.forEach(({ x, y }) => {
        const leg = container.querySelector(`rect[fill="#4A2810"][x="${x}"][y="${y}"]`);
        expect(leg).toBeInTheDocument();
        expect(leg).toHaveAttribute('width', '3');
        expect(leg).toHaveAttribute('height', '3');
        expect(leg).toHaveAttribute('rx', '0.3');
      });
    });
  });
});

// @cleaned-by-ai
