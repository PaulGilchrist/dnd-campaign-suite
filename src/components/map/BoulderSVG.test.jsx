import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BoulderSVG from './BoulderSVG.jsx';

describe('BoulderSVG', () => {
  describe('root element', () => {
    it('renders a <g> element with id, className, rest props, and ref', () => {
      const ref = React.createRef();
      const { container } = render(
        <BoulderSVG id="boulder-1" className="custom-boulder" data-testid="my-boulder" ref={ref} />
      );
      const g = container.querySelector('g');
      expect(g).toBeInTheDocument();
      expect(g).toHaveAttribute('id', 'boulder-1');
      expect(g).toHaveClass('custom-boulder');
      expect(g).toHaveAttribute('data-testid', 'my-boulder');
      expect(ref.current).toBe(g);
    });
  });

  describe('shadow ellipse', () => {
    it('renders with correct position, dimensions, fill and opacity', () => {
      const { container } = render(<BoulderSVG />);
      const shadow = container.querySelector(
        'ellipse[cx="18"][cy="34"][rx="14"][ry="3"]',
      );
      expect(shadow).toBeInTheDocument();
      expect(shadow).toHaveAttribute('fill', '#000');
      expect(shadow).toHaveAttribute('opacity', '0.12');
    });
  });

  describe('main body path', () => {
    it('renders with correct path data, fill, stroke and stroke-width', () => {
      const { container } = render(<BoulderSVG />);
      const bodyPath = container.querySelector(
        'path[d="M 8 32 Q 4 20 10 10 Q 12 4 18 6 Q 24 4 26 10 Q 32 20 28 32 Z"]',
      );
      expect(bodyPath).toBeInTheDocument();
      expect(bodyPath).toHaveAttribute('fill', '#7A7A6A');
      expect(bodyPath).toHaveAttribute('stroke', '#5A5A4E');
      expect(bodyPath).toHaveAttribute('stroke-width', '0.8');
    });
  });

  describe('highlight face path', () => {
    it('renders with correct path data, fill and opacity', () => {
      const { container } = render(<BoulderSVG />);
      const highlightPath = container.querySelector(
        'path[d="M 10 28 Q 8 20 12 14 Q 14 8 18 8 Q 20 8 22 10 Q 18 14 16 18 Q 14 24 12 28 Z"]',
      );
      expect(highlightPath).toBeInTheDocument();
      expect(highlightPath).toHaveAttribute('fill', '#8B8B7A');
      expect(highlightPath).toHaveAttribute('opacity', '0.6');
    });
  });

  describe('shadow face path', () => {
    it('renders with correct path data, fill and opacity', () => {
      const { container } = render(<BoulderSVG />);
      const shadowPath = container.querySelector(
        'path[d="M 26 28 Q 28 20 24 14 Q 22 10 20 10 Q 22 14 22 18 Q 22 24 24 28 Z"]',
      );
      expect(shadowPath).toBeInTheDocument();
      expect(shadowPath).toHaveAttribute('fill', '#5A5A4E');
      expect(shadowPath).toHaveAttribute('opacity', '0.4');
    });
  });

  describe('crack lines', () => {
    it('renders the primary crack with correct attributes', () => {
      const { container } = render(<BoulderSVG />);
      const crackPath = container.querySelector(
        'path[d="M 16 12 Q 14 16 16 20 Q 17 22 16 26"]',
      );
      expect(crackPath).toBeInTheDocument();
      expect(crackPath).toHaveAttribute('fill', 'none');
      expect(crackPath).toHaveAttribute('stroke', '#5A5A4E');
      expect(crackPath).toHaveAttribute('stroke-width', '0.5');
      expect(crackPath).toHaveAttribute('opacity', '0.6');
    });

    it('renders the secondary crack with correct attributes', () => {
      const { container } = render(<BoulderSVG />);
      const crackPath = container.querySelector(
        'path[d="M 20 14 Q 22 18 20 22"]',
      );
      expect(crackPath).toBeInTheDocument();
      expect(crackPath).toHaveAttribute('fill', 'none');
      expect(crackPath).toHaveAttribute('stroke', '#5A5A4E');
      expect(crackPath).toHaveAttribute('stroke-width', '0.4');
      expect(crackPath).toHaveAttribute('opacity', '0.5');
    });
  });

  describe('top highlight ellipse', () => {
    it('renders with correct position, dimensions, fill and opacity', () => {
      const { container } = render(<BoulderSVG />);
      const topHighlight = container.querySelector(
        'ellipse[cx="16"][cy="12"][rx="4"][ry="2"]',
      );
      expect(topHighlight).toBeInTheDocument();
      expect(topHighlight).toHaveAttribute('fill', '#9A9A8A');
      expect(topHighlight).toHaveAttribute('opacity', '0.3');
    });
  });
});

