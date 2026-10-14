import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FountainSVG from './FountainSVG';

describe('FountainSVG', () => {
  describe('root element', () => {
    it('renders a <g> element with id, className, rest props, and ref', () => {
      const ref = React.createRef();
      const { container } = render(
        <FountainSVG id="fountain-1" className="custom-fountain" data-test="fountain-test" ref={ref} />
      );
      const g = container.querySelector('g');
      expect(g).toBeInTheDocument();
      expect(g).toHaveAttribute('id', 'fountain-1');
      expect(g).toHaveClass('custom-fountain');
      expect(g).toHaveAttribute('data-test', 'fountain-test');
      expect(ref.current).toBe(g);
    });
  });

  describe('floor shadow', () => {
    it('renders a shadow circle with correct attributes', () => {
      const { container } = render(<FountainSVG />);
      const shadow = container.querySelector('circle[cx="18"][cy="19"][r="16"]');
      expect(shadow).toBeInTheDocument();
      expect(shadow).toHaveAttribute('fill', '#555');
      expect(shadow).toHaveAttribute('opacity', '0.12');
    });
  });

  describe('basin wall', () => {
    it('renders the outer basin wall path with correct attributes', () => {
      const { container } = render(<FountainSVG />);
      const basinPath = container.querySelector(
        'path[d="M 3 18 A 15 15 0 1 1 33 18 A 15 15 0 1 1 3 18 Z M 6 18 A 12 12 0 1 0 30 18 A 12 12 0 1 0 6 18 Z"]',
      );
      expect(basinPath).toBeInTheDocument();
      expect(basinPath).toHaveAttribute('fill', '#888');
      expect(basinPath).toHaveAttribute('stroke', '#666');
      expect(basinPath).toHaveAttribute('stroke-width', '0.6');
      expect(basinPath).toHaveAttribute('fill-rule', 'evenodd');
    });

    it('renders the basin rim highlight circle', () => {
      const { container } = render(<FountainSVG />);
      const rimHighlight = container.querySelector('circle[cx="18"][cy="18"][r="14.5"]');
      expect(rimHighlight).toBeInTheDocument();
      expect(rimHighlight).toHaveAttribute('fill', 'none');
      expect(rimHighlight).toHaveAttribute('stroke', '#999');
      expect(rimHighlight).toHaveAttribute('stroke-width', '0.4');
      expect(rimHighlight).toHaveAttribute('opacity', '0.6');
    });

    it('renders the basin wall shadow path', () => {
      const { container } = render(<FountainSVG />);
      const wallShadow = container.querySelector('path[d="M 6 24 A 12 12 0 0 0 30 24"]');
      expect(wallShadow).toBeInTheDocument();
      expect(wallShadow).toHaveAttribute('fill', 'none');
      expect(wallShadow).toHaveAttribute('stroke', '#555');
      expect(wallShadow).toHaveAttribute('stroke-width', '1.5');
      expect(wallShadow).toHaveAttribute('opacity', '0.3');
      expect(wallShadow).toHaveAttribute('stroke-linecap', 'round');
    });
  });

  describe('water', () => {
    it('renders the water surface circle', () => {
      const { container } = render(<FountainSVG />);
      const waterSurface = container.querySelector('circle[cx="18"][cy="18"][r="11.5"]');
      expect(waterSurface).toBeInTheDocument();
      expect(waterSurface).toHaveAttribute('fill', '#3498DB');
      expect(waterSurface).toHaveAttribute('opacity', '0.45');
    });

    it('renders the water highlight path', () => {
      const { container } = render(<FountainSVG />);
      const waterHighlight = container.querySelector('path[d="M 8 15 A 10 10 0 0 1 28 15"]');
      expect(waterHighlight).toBeInTheDocument();
      expect(waterHighlight).toHaveAttribute('stroke', '#5DADE2');
      expect(waterHighlight).toHaveAttribute('stroke-width', '1.8');
      expect(waterHighlight).toHaveAttribute('opacity', '0.35');
      expect(waterHighlight).toHaveAttribute('stroke-linecap', 'round');
    });
  });

  describe('central pillar', () => {
    it('renders the base pillar circle', () => {
      const { container } = render(<FountainSVG />);
      const circles = container.querySelectorAll('circle');
      const pillarCircle = Array.from(circles).find(
        (c) => c.getAttribute('cx') === '18' && c.getAttribute('cy') === '18' && c.getAttribute('r') === '3.5',
      );
      expect(pillarCircle).toBeInTheDocument();
      expect(pillarCircle).toHaveAttribute('fill', '#888');
      expect(pillarCircle).toHaveAttribute('stroke', '#666');
      expect(pillarCircle).toHaveAttribute('stroke-width', '0.6');
    });

    it('renders the pillar top circle', () => {
      const { container } = render(<FountainSVG />);
      const circles = container.querySelectorAll('circle');
      const topCircle = Array.from(circles).find(
        (c) => c.getAttribute('cx') === '18' && c.getAttribute('cy') === '18' && c.getAttribute('r') === '2.5',
      );
      expect(topCircle).toBeInTheDocument();
      expect(topCircle).toHaveAttribute('fill', '#999');
      expect(topCircle).toHaveAttribute('stroke', '#777');
      expect(topCircle).toHaveAttribute('stroke-width', '0.3');
    });

    it('renders the pillar center highlight circle', () => {
      const { container } = render(<FountainSVG />);
      const circles = container.querySelectorAll('circle');
      const highlightCircle = Array.from(circles).find(
        (c) => c.getAttribute('cx') === '17.5' && c.getAttribute('cy') === '17.5' && c.getAttribute('r') === '0.8',
      );
      expect(highlightCircle).toBeInTheDocument();
      expect(highlightCircle).toHaveAttribute('fill', '#AAA');
      expect(highlightCircle).toHaveAttribute('opacity', '0.4');
    });
  });

  describe('water ripples', () => {
    it('renders 3 ripple circles with correct radii and opacities', () => {
      const { container } = render(<FountainSVG />);
      const ripples = container.querySelectorAll('circle[stroke="#5DADE2"][fill="none"]');
      expect(ripples.length).toBe(3);
      expect(ripples[0]).toHaveAttribute('r', '5');
      expect(ripples[0]).toHaveAttribute('stroke-width', '0.4');
      expect(ripples[0]).toHaveAttribute('opacity', '0.3');
      expect(ripples[1]).toHaveAttribute('r', '7.5');
      expect(ripples[1]).toHaveAttribute('opacity', '0.25');
      expect(ripples[2]).toHaveAttribute('r', '10');
      expect(ripples[2]).toHaveAttribute('opacity', '0.2');
    });
  });

  describe('flowing water arcs', () => {
    it('renders 4 arc paths with correct attributes', () => {
      const { container } = render(<FountainSVG />);
      const arcs = container.querySelectorAll('path[stroke="#5DADE2"][stroke-width="0.8"]');
      expect(arcs.length).toBe(4);
      arcs.forEach((arc) => {
        expect(arc).toHaveAttribute('stroke-linecap', 'round');
        expect(arc).toHaveAttribute('opacity', '0.5');
      });
    });
  });

  describe('water droplets', () => {
    it('renders 4 droplet circles with correct attributes', () => {
      const { container } = render(<FountainSVG />);
      const droplets = container.querySelectorAll('circle[fill="#5DADE2"][r="0.7"]');
      expect(droplets.length).toBe(4);
      droplets.forEach((droplet) => {
        expect(droplet).toHaveAttribute('opacity', '0.6');
      });
    });
  });
});

