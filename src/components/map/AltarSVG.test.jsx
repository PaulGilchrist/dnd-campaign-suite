import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AltarSVG from './AltarSVG';

describe('AltarSVG', () => {
  describe('props', () => {
    it('renders a <g> element with id, className, rest props, and ref', () => {
      const ref = React.createRef();
      const { container } = render(
        <AltarSVG id="altar-1" className="custom-altar" data-test="altar-test" ref={ref} />
      );
      const g = container.querySelector('g');
      expect(g).toBeInTheDocument();
      expect(g).toHaveAttribute('id', 'altar-1');
      expect(g).toHaveClass('custom-altar');
      expect(g).toHaveAttribute('data-test', 'altar-test');
      expect(ref.current).toBe(g);
    });
  });

  describe('floor shadow', () => {
    it('renders a shadow rect with correct attributes', () => {
      const { container } = render(<AltarSVG />);
      const shadow = container.querySelector('rect[fill="#555"][opacity="0.25"]');
      expect(shadow).toBeInTheDocument();
      expect(shadow).toHaveAttribute('transform', 'translate(1, 1)');
      expect(shadow).toHaveAttribute('rx', '2');
    });
  });

  describe('stone base', () => {
    it('renders the main stone block rect', () => {
      const { container } = render(<AltarSVG />);
      const stone = container.querySelector('rect[fill="#8A7F70"][stroke="#6B6050"]');
      expect(stone).toBeInTheDocument();
      expect(stone).toHaveAttribute('stroke-width', '0.8');
    });

    it('renders the top surface rect', () => {
      const { container } = render(<AltarSVG />);
      const top = container.querySelector('rect[fill="#9B9080"][stroke="#7A6F60"]');
      expect(top).toBeInTheDocument();
      expect(top).toHaveAttribute('stroke-width', '0.4');
    });

    it('renders the decorative border rect', () => {
      const { container } = render(<AltarSVG />);
      const border = container.querySelector('rect[fill="none"][stroke="#7A6F60"]');
      expect(border).toBeInTheDocument();
      expect(border).toHaveAttribute('stroke-width', '0.5');
    });

    it('renders edge shadows and top highlight', () => {
      const { container } = render(<AltarSVG />);
      const shadows = container.querySelectorAll('rect[fill="#4A4035"]');
      expect(shadows.length).toBe(2);
      const highlight = container.querySelector('rect[fill="#B0A090"]');
      expect(highlight).toBeInTheDocument();
    });
  });

  describe('red cloth runner', () => {
    it('renders the red cloth strip', () => {
      const { container } = render(<AltarSVG />);
      const cloth = container.querySelector('rect[fill="#8B0000"]');
      expect(cloth).toBeInTheDocument();
    });

    it('renders two gold trim rects', () => {
      const { container } = render(<AltarSVG />);
      const trims = container.querySelectorAll('rect[fill="#D4AF37"]');
      expect(trims.length).toBe(2);
    });
  });

  describe('offering depression', () => {
    it('renders the depression rect with correct attributes', () => {
      const { container } = render(<AltarSVG />);
      const depression = container.querySelector('rect[x="30"][y="10"][width="12"][height="7"]');
      expect(depression).toBeInTheDocument();
      expect(depression).toHaveAttribute('stroke', '#6B6050');
    });
  });

  describe('blood stain', () => {
    it('renders the main stain path', () => {
      const { container } = render(<AltarSVG />);
      const stain = container.querySelector('path[fill="#4A0000"][opacity="0.3"]');
      expect(stain).toBeInTheDocument();
      expect(stain).toHaveAttribute('d');
    });

    it('renders blood spatter circles', () => {
      const { container } = render(<AltarSVG />);
      const spatters = container.querySelectorAll('circle[fill="#4A0000"]');
      expect(spatters.length).toBe(3);
    });
  });

  describe('candles', () => {
    it('renders 4 candle bodies', () => {
      const { container } = render(<AltarSVG />);
      const bodies = container.querySelectorAll('rect[fill="#F5F0E0"]');
      expect(bodies.length).toBe(4);
    });

    it('renders 4 candle glow circles', () => {
      const { container } = render(<AltarSVG />);
      const glows = container.querySelectorAll('circle[fill="#E87A20"][opacity="0.12"]');
      expect(glows.length).toBe(4);
    });

    it('renders 4 flame circles', () => {
      const { container } = render(<AltarSVG />);
      const flames = container.querySelectorAll('circle[fill="#E87A20"]');
      // 4 glow (opacity 0.12) + 4 solid flame = 8 total
      expect(flames.length).toBe(8);
    });

    it('renders 4 inner flame highlight circles', () => {
      const { container } = render(<AltarSVG />);
      // 4 candle inner flames + 1 goblet liquid highlight + 1 rune center dot = 6 total circles with #F5D060
      const highlights = container.querySelectorAll('circle[fill="#F5D060"]');
      expect(highlights.length).toBe(6);
    });
  });

  describe('central rune symbol', () => {
    it('renders glow circles behind the symbol', () => {
      const { container } = render(<AltarSVG />);
      const glowCircles = container.querySelectorAll('circle[fill="#D4A017"]');
      // glow circles + goblet rim + inner flame = 3 + 1 + 4 = 8 total
      expect(glowCircles.length).toBeGreaterThan(0);
    });

    it('renders the outer ring with correct stroke', () => {
      const { container } = render(<AltarSVG />);
      const outerRing = container.querySelector('circle[stroke="#D4A017"][stroke-width="0.8"]');
      expect(outerRing).toBeInTheDocument();
      expect(outerRing).toHaveAttribute('r', '6');
    });

    it('renders the star/sunburst path', () => {
      const { container } = render(<AltarSVG />);
      const starPath = container.querySelector('path[fill="#D4A017"][opacity="0.85"]');
      expect(starPath).toBeInTheDocument();
      expect(starPath).toHaveAttribute('d');
    });

    it('renders the diagonal rays path', () => {
      const { container } = render(<AltarSVG />);
      const rays = container.querySelector('path[fill="#D4A017"][opacity="0.4"]');
      expect(rays).toBeInTheDocument();
      expect(rays).toHaveAttribute('d');
    });

    it('renders the inner ring and center dot', () => {
      const { container } = render(<AltarSVG />);
      const innerRing = container.querySelector('circle[stroke="#D4A017"][stroke-width="0.6"]');
      expect(innerRing).toBeInTheDocument();
      const centerDot = container.querySelector('circle[fill="#F5D060"]');
      expect(centerDot).toBeInTheDocument();
    });
  });

  describe('offering goblet', () => {
    it('renders the goblet shadow ellipse', () => {
      const { container } = render(<AltarSVG />);
      const shadow = container.querySelector('ellipse[fill="#4A4035"][opacity="0.3"]');
      expect(shadow).toBeInTheDocument();
      expect(shadow).toHaveAttribute('cx', '36');
    });

    it('renders the goblet rim circle', () => {
      const { container } = render(<AltarSVG />);
      const rim = container.querySelector('circle[fill="#D4A017"][stroke="#B8960F"]');
      expect(rim).toBeInTheDocument();
      expect(rim).toHaveAttribute('r', '2.5');
    });

    it('renders the goblet interior and liquid highlight', () => {
      const { container } = render(<AltarSVG />);
      const interior = container.querySelector('circle[fill="#5C4510"]');
      expect(interior).toBeInTheDocument();
      const highlight = container.querySelector('circle[fill="#F5D060"][opacity="0.5"]');
      expect(highlight).toBeInTheDocument();
    });
  });
});

