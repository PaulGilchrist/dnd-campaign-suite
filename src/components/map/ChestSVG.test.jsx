import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ChestSVG from './ChestSVG';

describe('ChestSVG', () => {
  describe('root group element', () => {
    it('renders a <g> element with id, className, rest props, and ref', () => {
      const ref = { current: null };
      const { container } = render(
        <ChestSVG id="chest-1" className="custom-chest" data-test="chest-test" ref={ref} />
      );
      const g = container.querySelector('g');
      expect(g).toBeInTheDocument();
      expect(g).toHaveAttribute('id', 'chest-1');
      expect(g).toHaveClass('custom-chest');
      expect(g).toHaveAttribute('data-test', 'chest-test');
      expect(ref.current).toBe(g);
    });
  });

  describe('floor shadow', () => {
    it('renders the shadow rect with correct attributes', () => {
      const { container } = render(<ChestSVG />);
      const shadow = container.querySelector('rect[fill="#6B3E1F"][opacity="0.25"]');
      expect(shadow).toBeInTheDocument();
      expect(shadow).toHaveAttribute('rx', '1');
      expect(shadow).toHaveAttribute('x', '7');
      expect(shadow).toHaveAttribute('y', '10');
      expect(shadow).toHaveAttribute('width', '24');
      expect(shadow).toHaveAttribute('height', '18');
    });
  });

  describe('lid edge', () => {
    it('renders the lid edge rect with correct attributes', () => {
      const { container } = render(<ChestSVG />);
      const lidEdge = container.querySelector('rect[x="5"][y="8"][width="26"][height="20"]');
      expect(lidEdge).toBeInTheDocument();
      expect(lidEdge).toHaveAttribute('rx', '1');
      expect(lidEdge).toHaveAttribute('fill', '#6B3E1F');
    });
  });

  describe('main chest body', () => {
    it('renders the body rect with correct shape and colors', () => {
      const { container } = render(<ChestSVG />);
      const body = container.querySelector('rect[fill="#A0703C"]');
      expect(body).toBeInTheDocument();
      expect(body).toHaveAttribute('stroke', '#8B5E3C');
      expect(body).toHaveAttribute('stroke-width', '0.6');
      expect(body).toHaveAttribute('rx', '0.8');
      expect(body).toHaveAttribute('x', '6');
      expect(body).toHaveAttribute('y', '9');
      expect(body).toHaveAttribute('width', '24');
      expect(body).toHaveAttribute('height', '18');
    });
  });

  describe('wood grain lines', () => {
    it('renders 4 grain lines with correct attributes', () => {
      const { container } = render(<ChestSVG />);
      const grainLines = container.querySelectorAll('line[stroke="#7A4E20"]');
      expect(grainLines.length).toBe(4);
      grainLines.forEach((line) => {
        expect(line).toHaveAttribute('stroke-width', '0.3');
        expect(line).toHaveAttribute('opacity', '0.25');
      });
    });

    it('renders grain lines at correct x positions', () => {
      const { container } = render(<ChestSVG />);
      const grainLines = Array.from(container.querySelectorAll('line[stroke="#7A4E20"]'));
      const startPositions = grainLines.map((l) => l.getAttribute('x1'));
      expect(startPositions).toContain('8');
      expect(startPositions).toContain('7');
    });
  });

  describe('metal bands', () => {
    it('renders 2 dark band rects with correct positions', () => {
      const { container } = render(<ChestSVG />);
      const darkBands = container.querySelectorAll('rect[fill="#555"]');
      expect(darkBands.length).toBe(2);
      expect(darkBands[0]).toHaveAttribute('x', '6');
      expect(darkBands[0]).toHaveAttribute('y', '11');
      expect(darkBands[0]).toHaveAttribute('width', '24');
      expect(darkBands[0]).toHaveAttribute('height', '1.5');
      expect(darkBands[1]).toHaveAttribute('y', '24');
    });

    it('renders 2 highlight band rects with correct positions', () => {
      const { container } = render(<ChestSVG />);
      const highlights = container.querySelectorAll('rect[fill="#777"]');
      expect(highlights.length).toBe(2);
      expect(highlights[0]).toHaveAttribute('y', '11');
      expect(highlights[0]).toHaveAttribute('height', '0.4');
      expect(highlights[1]).toHaveAttribute('y', '24');
    });
  });

  describe('nail heads', () => {
    it('renders 8 nail head circles with correct attributes', () => {
      const { container } = render(<ChestSVG />);
      const nails = container.querySelectorAll('circle[fill="#888"]');
      expect(nails.length).toBe(8);
      nails.forEach((nail) => {
        expect(nail).toHaveAttribute('r', '0.7');
      });
    });

    it('renders nail heads at correct y positions for top and bottom bands', () => {
      const { container } = render(<ChestSVG />);
      const topNails = container.querySelectorAll('circle[cy="11.8"]');
      const bottomNails = container.querySelectorAll('circle[cy="24.8"]');
      expect(topNails.length).toBe(4);
      expect(bottomNails.length).toBe(4);
    });
  });

  describe('lock and keyhole', () => {
    it('renders the lock circle with correct attributes', () => {
      const { container } = render(<ChestSVG />);
      const lock = container.querySelector('circle[cx="18"][cy="21"]');
      expect(lock).toBeInTheDocument();
      expect(lock).toHaveAttribute('r', '2.5');
      expect(lock).toHaveAttribute('fill', '#D4A017');
      expect(lock).toHaveAttribute('stroke', '#B8860B');
      expect(lock).toHaveAttribute('stroke-width', '0.4');
    });

    it('renders the keyhole rect inside the lock', () => {
      const { container } = render(<ChestSVG />);
      const keyhole = container.querySelector('rect[fill="#333"]');
      expect(keyhole).toBeInTheDocument();
      expect(keyhole).toHaveAttribute('rx', '0.2');
      expect(keyhole).toHaveAttribute('x', '17.5');
      expect(keyhole).toHaveAttribute('y', '21.5');
      expect(keyhole).toHaveAttribute('width', '1');
      expect(keyhole).toHaveAttribute('height', '2.5');
    });
  });

  describe('hinges', () => {
    it('renders 2 hinge rects with correct attributes', () => {
      const { container } = render(<ChestSVG />);
      const hinges = container.querySelectorAll('rect[fill="#666"][stroke="#555"]');
      expect(hinges.length).toBe(2);
      hinges.forEach((hinge) => {
        expect(hinge).toHaveAttribute('height', '1.2');
        expect(hinge).toHaveAttribute('stroke-width', '0.3');
        expect(hinge).toHaveAttribute('rx', '0.3');
      });
    });

    it('renders hinges at correct x positions', () => {
      const { container } = render(<ChestSVG />);
      const hinges = Array.from(container.querySelectorAll('rect[fill="#666"][stroke="#555"]'));
      const xPositions = hinges.map((h) => h.getAttribute('x'));
      expect(xPositions).toContain('8');
      expect(xPositions).toContain('25');
    });
  });

  describe('edge shadows', () => {
    it('renders the right edge shadow rect', () => {
      const { container } = render(<ChestSVG />);
      const rightShadow = container.querySelector('rect[x="28"][y="9"][width="2"][height="18"]');
      expect(rightShadow).toBeInTheDocument();
      expect(rightShadow).toHaveAttribute('fill', '#6B3E1F');
      expect(rightShadow).toHaveAttribute('opacity', '0.15');
    });

    it('renders the bottom edge shadow rect', () => {
      const { container } = render(<ChestSVG />);
      const bottomShadow = container.querySelector('rect[x="6"][y="25"][width="24"][height="2"]');
      expect(bottomShadow).toBeInTheDocument();
      expect(bottomShadow).toHaveAttribute('fill', '#6B3E1F');
      expect(bottomShadow).toHaveAttribute('opacity', '0.15');
    });
  });
});

