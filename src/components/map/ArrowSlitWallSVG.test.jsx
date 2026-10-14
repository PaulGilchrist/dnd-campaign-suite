import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ArrowSlitWallSVG from './ArrowSlitWallSVG';

describe('ArrowSlitWallSVG', () => {
  describe('props', () => {
    it('renders a <g> element with id, className, rest props, and ref', () => {
      const ref = React.createRef();
      const { container } = render(
        <ArrowSlitWallSVG id="my-slit" className="custom-class" data-test="slit-test" ref={ref} />
      );
      const g = container.querySelector('g');
      expect(g).toBeInTheDocument();
      expect(g).toHaveAttribute('id', 'my-slit');
      expect(g).toHaveClass('custom-class');
      expect(g).toHaveAttribute('data-test', 'slit-test');
      expect(ref.current).toBe(g);
    });
  });

  describe('SVG structure', () => {
    it('renders a background rect with correct attributes', () => {
      const { container } = render(<ArrowSlitWallSVG />);
      const rect = container.querySelector('rect');
      expect(rect).toBeInTheDocument();
      expect(rect).toHaveAttribute('x', '0');
      expect(rect).toHaveAttribute('y', '0');
      expect(rect).toHaveAttribute('width', '36');
      expect(rect).toHaveAttribute('height', '36');
      expect(rect).toHaveAttribute('fill', '#696969');
      expect(rect).toHaveAttribute('opacity', '0.85');
    });

    it('renders the main arrow slit polygon', () => {
      const { container } = render(<ArrowSlitWallSVG />);
      const mainPolygon = container.querySelector('polygon[points="16,4 20,4 30,36 6,36"]');
      expect(mainPolygon).toBeInTheDocument();
      expect(mainPolygon).toHaveAttribute('fill', '#2a2a2a');
    });

    it('renders the left shading polygon', () => {
      const { container } = render(<ArrowSlitWallSVG />);
      const leftPolygon = container.querySelector('polygon[points="16,4 18,4 17,12 13,36 6,36"]');
      expect(leftPolygon).toBeInTheDocument();
      expect(leftPolygon).toHaveAttribute('fill', '#3a3a3a');
      expect(leftPolygon).toHaveAttribute('opacity', '0.4');
    });

    it('renders the right shading polygon', () => {
      const { container } = render(<ArrowSlitWallSVG />);
      const rightPolygon = container.querySelector('polygon[points="20,4 18,4 19,12 23,36 30,36"]');
      expect(rightPolygon).toBeInTheDocument();
      expect(rightPolygon).toHaveAttribute('fill', '#4a4a4a');
      expect(rightPolygon).toHaveAttribute('opacity', '0.3');
    });

    it('renders a center line divider', () => {
      const { container } = render(<ArrowSlitWallSVG />);
      const line = container.querySelector('line');
      expect(line).toBeInTheDocument();
      expect(line).toHaveAttribute('x1', '18');
      expect(line).toHaveAttribute('y1', '4');
      expect(line).toHaveAttribute('x2', '18');
      expect(line).toHaveAttribute('y2', '36');
      expect(line).toHaveAttribute('stroke', '#4a4a4a');
      expect(line).toHaveAttribute('stroke-width', '1');
    });

  });
});

