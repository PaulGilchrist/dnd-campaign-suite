import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BushSVG from './BushSVG.jsx';

describe('BushSVG', () => {
  describe('root group element', () => {
    it('renders a <g> element with id, className, rest props, and ref', () => {
      const ref = React.createRef();
      const { container } = render(
        <BushSVG id="bush-1" className="custom-bush" data-test="bush" ref={ref} />
      );
      const g = container.querySelector('g');
      expect(g).toBeInTheDocument();
      expect(g).toHaveAttribute('id', 'bush-1');
      expect(g).toHaveClass('custom-bush');
      expect(g).toHaveAttribute('data-test', 'bush');
      expect(ref.current).toBe(g);
    });
  });

  describe('shadow ellipse', () => {
    it('renders with correct position, dimensions, fill and opacity', () => {
      const { container } = render(<BushSVG />);
      const shadow = container.querySelector(
        'ellipse[cx="18"][cy="33"][rx="11"][ry="2.5"]',
      );
      expect(shadow).toBeInTheDocument();
      expect(shadow).toHaveAttribute('fill', '#000');
      expect(shadow).toHaveAttribute('opacity', '0.12');
    });
  });

  describe('bottom layer circles', () => {
    it('renders the center bottom circle with correct attributes', () => {
      const { container } = render(<BushSVG />);
      const center = container.querySelector(
        'circle[cx="18"][cy="22"][r="12"]',
      );
      expect(center).toBeInTheDocument();
      expect(center).toHaveAttribute('fill', '#3D7A4A');
      expect(center).toHaveAttribute('stroke', '#2D5E37');
      expect(center).toHaveAttribute('stroke-width', '0.5');
    });

    it('renders the left bottom circle', () => {
      const { container } = render(<BushSVG />);
      const left = container.querySelector('circle[cx="10"][cy="24"][r="8"]');
      expect(left).toBeInTheDocument();
      expect(left).toHaveAttribute('fill', '#3D7A4A');
    });

    it('renders the right bottom circle', () => {
      const { container } = render(<BushSVG />);
      const right = container.querySelector('circle[cx="26"][cy="24"][r="8"]');
      expect(right).toBeInTheDocument();
      expect(right).toHaveAttribute('fill', '#3D7A4A');
    });
  });

  describe('middle layer circles', () => {
    it('renders all three middle layer circles with correct attributes', () => {
      const { container } = render(<BushSVG />);
      const middleLayer = [
        container.querySelector('circle[cx="18"][cy="20"][r="10"]'),
        container.querySelector('circle[cx="12"][cy="22"][r="7"]'),
        container.querySelector('circle[cx="24"][cy="22"][r="7"]'),
      ];
      middleLayer.forEach((circle) => {
        expect(circle).toBeInTheDocument();
        expect(circle).toHaveAttribute('fill', '#4A9A5A');
      });
    });
  });

  describe('top layer circles', () => {
    it('renders all three top layer circles with correct attributes', () => {
      const { container } = render(<BushSVG />);
      const topLayer = [
        container.querySelector('circle[cx="18"][cy="18"][r="7"]'),
        container.querySelector('circle[cx="14"][cy="19"][r="5"]'),
        container.querySelector('circle[cx="22"][cy="19"][r="5"]'),
      ];
      topLayer.forEach((circle) => {
        expect(circle).toBeInTheDocument();
        expect(circle).toHaveAttribute('fill', '#5AAB6A');
      });
    });
  });

  describe('top highlight circles', () => {
    it('renders the primary highlight circle with correct attributes', () => {
      const { container } = render(<BushSVG />);
      const highlight = container.querySelector('circle[cx="16"][cy="16"][r="3"]');
      expect(highlight).toBeInTheDocument();
      expect(highlight).toHaveAttribute('fill', '#6ABC7A');
      expect(highlight).toHaveAttribute('opacity', '0.5');
    });

    it('renders the secondary highlight circle with correct attributes', () => {
      const { container } = render(<BushSVG />);
      const highlight = container.querySelector('circle[cx="20"][cy="17"][r="2"]');
      expect(highlight).toBeInTheDocument();
      expect(highlight).toHaveAttribute('fill', '#6ABC7A');
      expect(highlight).toHaveAttribute('opacity', '0.4');
    });
  });

  describe('branch detail paths', () => {
    it('renders the left branch path with correct attributes', () => {
      const { container } = render(<BushSVG />);
      const leftBranch = container.querySelector(
        'path[d="M 10 20 Q 8 16 9 14"]',
      );
      expect(leftBranch).toBeInTheDocument();
      expect(leftBranch).toHaveAttribute('fill', 'none');
      expect(leftBranch).toHaveAttribute('stroke', '#4A9A5A');
      expect(leftBranch).toHaveAttribute('stroke-width', '0.8');
    });

    it('renders the right branch path with correct attributes', () => {
      const { container } = render(<BushSVG />);
      const rightBranch = container.querySelector(
        'path[d="M 26 20 Q 28 16 27 14"]',
      );
      expect(rightBranch).toBeInTheDocument();
      expect(rightBranch).toHaveAttribute('fill', 'none');
      expect(rightBranch).toHaveAttribute('stroke', '#4A9A5A');
      expect(rightBranch).toHaveAttribute('stroke-width', '0.8');
    });
  });
});

