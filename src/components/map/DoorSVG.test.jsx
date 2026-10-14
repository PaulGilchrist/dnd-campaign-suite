import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DoorSVG from './DoorSVG.jsx';

describe('DoorSVG', () => {
  describe('root element', () => {
    it('renders a <g> element with id, className, rest props, and ref', () => {
      const ref = React.createRef();
      const { container } = render(
        <DoorSVG id="door-1" className="custom-door" data-test="door-test" ref={ref} />
      );
      const g = container.querySelector('g');
      expect(g).toBeInTheDocument();
      expect(g).toHaveAttribute('id', 'door-1');
      expect(g).toHaveClass('custom-door');
      expect(g).toHaveAttribute('data-test', 'door-test');
      expect(ref.current).toBe(g);
    });
  });

  describe('door body', () => {
    it('renders the main board rect with correct shape and color', () => {
      const { container } = render(<DoorSVG />);
      const body = container.querySelector(
        'rect[x="15"][y="0"][width="6"][height="36"]',
      );
      expect(body).toBeInTheDocument();
      expect(body).toHaveAttribute('fill', '#8B5A2B');
    });
  });

  describe('wood grain lines', () => {
    it('renders 2 grain lines with correct positions and styling', () => {
      const { container } = render(<DoorSVG />);
      const lines = Array.from(container.querySelectorAll('line[stroke="#6B3E1F"]'));
      expect(lines.length).toBe(2);

      expect(lines[0]).toHaveAttribute('x1', '16.5');
      expect(lines[0]).toHaveAttribute('y1', '0');
      expect(lines[0]).toHaveAttribute('x2', '16.5');
      expect(lines[0]).toHaveAttribute('y2', '36');
      expect(lines[0]).toHaveAttribute('stroke-width', '0.3');
      expect(lines[0]).toHaveAttribute('opacity', '0.5');

      expect(lines[1]).toHaveAttribute('x1', '19.5');
      expect(lines[1]).toHaveAttribute('y1', '0');
      expect(lines[1]).toHaveAttribute('x2', '19.5');
      expect(lines[1]).toHaveAttribute('y2', '36');
    });
  });

  describe('highlight edge', () => {
    it('renders the highlight rect with correct attributes', () => {
      const { container } = render(<DoorSVG />);
      const highlight = container.querySelector(
        'rect[x="15"][y="0"][width="0.5"][height="36"]',
      );
      expect(highlight).toBeInTheDocument();
      expect(highlight).toHaveAttribute('fill', '#A0652D');
      expect(highlight).toHaveAttribute('opacity', '0.6');
    });
  });
});

