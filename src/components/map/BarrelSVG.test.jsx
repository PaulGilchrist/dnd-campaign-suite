import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BarrelSVG from './BarrelSVG';

describe('BarrelSVG', () => {
  describe('root group element', () => {
    it('renders a <g> element with id, className, rest props, and ref', () => {
      const ref = React.createRef();
      const { container } = render(
        <BarrelSVG id="barrel-1" className="custom-barrel" data-test="barrel-test" ref={ref} />
      );
      const g = container.querySelector('g');
      expect(g).toBeInTheDocument();
      expect(g).toHaveAttribute('id', 'barrel-1');
      expect(g).toHaveClass('custom-barrel');
      expect(g).toHaveAttribute('data-test', 'barrel-test');
      expect(ref.current).toBe(g);
    });
  });

  describe('barrel body', () => {
    it('renders the body path with correct shape and colors', () => {
      const { container } = render(<BarrelSVG />);
      const bodyPath = container.querySelector(
        'path[d="M 10 4 Q 6 18 10 32 L 26 32 Q 30 18 26 4 Z"]',
      );
      expect(bodyPath).toBeInTheDocument();
      expect(bodyPath).toHaveAttribute('fill', '#A0652D');
      expect(bodyPath).toHaveAttribute('stroke', '#6B3E1F');
      expect(bodyPath).toHaveAttribute('stroke-width', '0.8');
    });

    it('renders the left side shading path', () => {
      const { container } = render(<BarrelSVG />);
      const shadingPath = container.querySelector(
        'path[d="M 10 4 Q 6 18 10 32 L 16 32 Q 12 18 16 4 Z"]',
      );
      expect(shadingPath).toBeInTheDocument();
      expect(shadingPath).toHaveAttribute('fill', '#8B5524');
      expect(shadingPath).toHaveAttribute('opacity', '0.5');
    });

    it('renders the right side highlight path', () => {
      const { container } = render(<BarrelSVG />);
      const highlightPath = container.querySelector(
        'path[d="M 26 4 Q 30 18 26 32 L 22 32 Q 26 18 22 4 Z"]',
      );
      expect(highlightPath).toBeInTheDocument();
      expect(highlightPath).toHaveAttribute('fill', '#B87A3A');
      expect(highlightPath).toHaveAttribute('opacity', '0.4');
    });
  });

  describe('rim and opening', () => {
    it('renders the top rim ellipse with correct attributes', () => {
      const { container } = render(<BarrelSVG />);
      const topRim = container.querySelector(
        'ellipse[cx="18"][cy="4"][rx="8"][ry="2.5"]',
      );
      expect(topRim).toBeInTheDocument();
      expect(topRim).toHaveAttribute('fill', '#8B5524');
      expect(topRim).toHaveAttribute('stroke', '#6B3E1F');
      expect(topRim).toHaveAttribute('stroke-width', '0.6');
    });

    it('renders the bottom rim ellipse with correct attributes', () => {
      const { container } = render(<BarrelSVG />);
      const bottomRim = container.querySelector(
        'ellipse[cx="18"][cy="32"][rx="8"][ry="2.5"]',
      );
      expect(bottomRim).toBeInTheDocument();
      expect(bottomRim).toHaveAttribute('fill', '#8B5524');
      expect(bottomRim).toHaveAttribute('stroke', '#6B3E1F');
      expect(bottomRim).toHaveAttribute('stroke-width', '0.6');
    });

    it('renders the top opening ellipse', () => {
      const { container } = render(<BarrelSVG />);
      const opening = container.querySelector(
        'ellipse[cx="18"][cy="4"][rx="6"][ry="1.8"]',
      );
      expect(opening).toBeInTheDocument();
      expect(opening).toHaveAttribute('fill', '#5C3317');
      expect(opening).toHaveAttribute('stroke', '#4A2810');
      expect(opening).toHaveAttribute('stroke-width', '0.5');
    });
  });

  describe('metal bands', () => {
    it('renders 3 metal band rects with correct positions', () => {
      const { container } = render(<BarrelSVG />);
      const metalBands = Array.from(
        container.querySelectorAll('rect[fill="#555"]'),
      ).filter((r) => r.hasAttribute('rx'));
      expect(metalBands.length).toBe(3);
      expect(metalBands[0]).toHaveAttribute('x', '9.5');
      expect(metalBands[0]).toHaveAttribute('y', '10');
      expect(metalBands[0]).toHaveAttribute('width', '17');
      expect(metalBands[0]).toHaveAttribute('height', '2');
      expect(metalBands[1]).toHaveAttribute('x', '9');
      expect(metalBands[1]).toHaveAttribute('y', '18');
      expect(metalBands[1]).toHaveAttribute('width', '18');
      expect(metalBands[1]).toHaveAttribute('height', '2');
      expect(metalBands[2]).toHaveAttribute('x', '9.5');
      expect(metalBands[2]).toHaveAttribute('y', '26');
      expect(metalBands[2]).toHaveAttribute('width', '17');
      expect(metalBands[2]).toHaveAttribute('height', '2');
    });

    it('renders 3 metal band highlight rects', () => {
      const { container } = render(<BarrelSVG />);
      const highlights = Array.from(
        container.querySelectorAll('rect[fill="#777"]'),
      ).filter((r) => !r.hasAttribute('rx'));
      expect(highlights.length).toBe(3);
      expect(highlights[0]).toHaveAttribute('y', '10');
      expect(highlights[1]).toHaveAttribute('y', '18');
      expect(highlights[2]).toHaveAttribute('y', '26');
    });
  });

  describe('wood grain lines', () => {
    it('renders 3 grain paths with correct attributes', () => {
      const { container } = render(<BarrelSVG />);
      const grainPaths = Array.from(
        container.querySelectorAll('path[stroke="#7A4E20"]'),
      ).filter((p) => p.hasAttribute('fill') && p.getAttribute('fill') === 'none');
      expect(grainPaths.length).toBe(3);
      grainPaths.forEach((path) => {
        expect(path).toHaveAttribute('stroke-width', '0.4');
        expect(path).toHaveAttribute('opacity', '0.6');
      });
    });

    it('renders grain paths at correct x positions', () => {
      const { container } = render(<BarrelSVG />);
      const grainPaths = Array.from(
        container.querySelectorAll('path[stroke="#7A4E20"]'),
      ).filter((p) => p.hasAttribute('fill') && p.getAttribute('fill') === 'none');
      const startPositions = grainPaths.map((p) => p.getAttribute('d').split(' ')[1]);
      expect(startPositions).toContain('14');
      expect(startPositions).toContain('18');
      expect(startPositions).toContain('22');
    });
  });

});

