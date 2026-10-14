import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BedSVG from './BedSVG';

describe('BedSVG', () => {
  describe('root element', () => {
    it('renders a <g> element with id, className, rest props, and ref', () => {
      const ref = React.createRef();
      const { container } = render(
        <BedSVG id="bed-1" className="custom-bed" data-test="bed-test" ref={ref} />
      );
      const g = container.querySelector('g');
      expect(g).toBeInTheDocument();
      expect(g).toHaveAttribute('id', 'bed-1');
      expect(g).toHaveClass('custom-bed');
      expect(g).toHaveAttribute('data-test', 'bed-test');
      expect(ref.current).toBe(g);
    });
  });

  describe('wooden frame', () => {
    it('renders the outer border rect with correct shape and colors', () => {
      const { container } = render(<BedSVG />);
      const frame = container.querySelector(
        'rect[x="2"][y="4"][width="68"][height="28"]',
      );
      expect(frame).toBeInTheDocument();
      expect(frame).toHaveAttribute('fill', '#A0652D');
      expect(frame).toHaveAttribute('stroke', '#6B3E1F');
      expect(frame).toHaveAttribute('stroke-width', '0.8');
    });

    it('renders left side shading rect', () => {
      const { container } = render(<BedSVG />);
      const leftShading = container.querySelector(
        'rect[x="2"][y="4"][width="10"][fill="#8B5524"]',
      );
      expect(leftShading).toBeInTheDocument();
      expect(leftShading).toHaveAttribute('opacity', '0.35');
    });

    it('renders right side highlight rect', () => {
      const { container } = render(<BedSVG />);
      const rightHighlight = container.querySelector(
        'rect[x="58"][y="4"][width="12"][fill="#B87A3A"]',
      );
      expect(rightHighlight).toBeInTheDocument();
      expect(rightHighlight).toHaveAttribute('opacity', '0.3');
    });

    it('renders top edge bevel highlight', () => {
      const { container } = render(<BedSVG />);
      const bevel = container.querySelector(
        'rect[x="4"][y="5"][width="64"][height="1.5"][fill="#C4944A"]',
      );
      expect(bevel).toBeInTheDocument();
      expect(bevel).toHaveAttribute('opacity', '0.4');
    });

    it('renders front edge subtle shadow', () => {
      const { container } = render(<BedSVG />);
      const shadow = container.querySelector(
        'rect[x="4"][y="30"][width="64"][height="1.5"][fill="#6B3E1F"]',
      );
      expect(shadow).toBeInTheDocument();
      expect(shadow).toHaveAttribute('opacity', '0.3');
    });
  });

  describe('mattress', () => {
    it('renders the mattress rect with correct attributes', () => {
      const { container } = render(<BedSVG />);
      const mattress = container.querySelector(
        'rect[x="6"][y="8"][width="60"][height="20"]',
      );
      expect(mattress).toBeInTheDocument();
      expect(mattress).toHaveAttribute('fill', '#D4A574');
      expect(mattress).toHaveAttribute('stroke', '#B87A3A');
    });
  });

  describe('pillow', () => {
    it('renders the pillow rect on the left end', () => {
      const { container } = render(<BedSVG />);
      const pillow = container.querySelector(
        'rect[x="4"][y="10"][width="14"][height="16"][fill="#F5F0E8"]',
      );
      expect(pillow).toBeInTheDocument();
    });

    it('renders pillow shading and highlight rects', () => {
      const { container } = render(<BedSVG />);
      const shading = container.querySelector(
        'rect[x="4"][y="10"][width="5"][fill="#E0DBD0"]',
      );
      expect(shading).toBeInTheDocument();
      expect(shading).toHaveAttribute('opacity', '0.5');

      const highlight = container.querySelector(
        'rect[x="13"][y="10"][width="5"][fill="#FAF7F2"]',
      );
      expect(highlight).toBeInTheDocument();
      expect(highlight).toHaveAttribute('opacity', '0.4');
    });
  });

  describe('blanket', () => {
    it('renders the blanket rect on the right side', () => {
      const { container } = render(<BedSVG />);
      const blanket = container.querySelector(
        'rect[x="20"][y="6"][width="46"][height="24"][fill="#3B5998"]',
      );
      expect(blanket).toBeInTheDocument();
      expect(blanket).toHaveAttribute('stroke', '#2A4070');
    });

    it('renders blanket fold/edge detail', () => {
      const { container } = render(<BedSVG />);
      const fold = container.querySelector(
        'rect[x="20"][y="28"][width="46"][height="3"][fill="#2A4070"]',
      );
      expect(fold).toBeInTheDocument();
      expect(fold).toHaveAttribute('opacity', '0.6');
    });

    it('renders blanket shading and highlight', () => {
      const { container } = render(<BedSVG />);
      const shading = container.querySelector(
        'rect[x="20"][y="6"][width="12"][fill="#2A4070"]',
      );
      expect(shading).toBeInTheDocument();
      expect(shading).toHaveAttribute('opacity', '0.3');

      const highlight = container.querySelector(
        'rect[x="50"][y="6"][width="16"][fill="#4A6FB5"]',
      );
      expect(highlight).toBeInTheDocument();
      expect(highlight).toHaveAttribute('opacity', '0.3');
    });

    it('renders the blanket fold line path', () => {
      const { container } = render(<BedSVG />);
      const foldLine = container.querySelector('path[d="M 20 18 Q 24 17 28 18"]');
      expect(foldLine).toBeInTheDocument();
      expect(foldLine).toHaveAttribute('fill', 'none');
      expect(foldLine).toHaveAttribute('stroke', '#2A4070');
    });
  });

  describe('wood grain lines', () => {
    it('renders 4 grain paths with correct stroke color', () => {
      const { container } = render(<BedSVG />);
      const grainPaths = Array.from(
        container.querySelectorAll('path[stroke="#7A4E20"]'),
      ).filter((p) => p.getAttribute('fill') === 'none');
      expect(grainPaths.length).toBe(4);
      grainPaths.forEach((path) => {
        expect(path).toHaveAttribute('stroke-width', '0.3');
        expect(path).toHaveAttribute('opacity', '0.4');
      });
    });
  });
});

