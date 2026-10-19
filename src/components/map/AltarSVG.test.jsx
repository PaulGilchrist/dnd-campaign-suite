// @maintained-by-ai
// SVG asset lane — static decorative token, zero mocks, golden-once.
// Old 19 attr-spie tests -> 4: (1) props/ref forwarding contract,
// (2) element census + inert-click static-art guard, (3) authored path
// bytes pinned verbatim once, (4) anchor geometry verbatim once.
// Family map: map/*SVG.test.jsx siblings (Chest, Bed, Barrel, Boulder,
// Bush, Chair, Door, FirePit, Fountain, ArrowSlitWall) keep their own
// per-asset golden tests; ItemsPanel.test.jsx mocks this leaf.
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AltarSVG from './AltarSVG';

describe('AltarSVG', () => {
  it('forwards id, className, rest props, and ref to the root <g>', () => {
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

  it('renders the authored element census and stays inert when clicked', () => {
    const { container } = render(<AltarSVG />);

    const counts = {
      g: 7, // root + 4 candles + rune + goblet groups
      rect: 15,
      circle: 23,
      path: 3,
      ellipse: 1, // goblet shadow
      'rect[fill="#555"]': 1, // floor shadow
      'rect[fill="#8B0000"]': 1, // cloth runner
      'rect[fill="#4A4035"]': 2, // bottom/right edge shadows
      'rect[fill="#D4AF37"]': 2, // cloth gold trims
      'rect[fill="#F5F0E0"]': 4, // candle bodies
      'circle[fill="#4A0000"]': 3, // blood spatters
      'circle[fill="#E87A20"]': 8, // 4 flames + 4 glows
      'circle[fill="#F5D060"]': 6, // 4 inner flames + rune dot + goblet glint
      'circle[fill="#D4A017"]': 3, // 2 rune glows + goblet rim
    };
    for (const [selector, count] of Object.entries(counts)) {
      expect(container.querySelectorAll(selector), selector).toHaveLength(count);
    }

    // Static art: clicking changes nothing.
    const before = container.innerHTML;
    fireEvent.click(container.querySelector('g'));
    expect(container.innerHTML).toBe(before);
  });

  it('pins the three authored path bytes verbatim', () => {
    const { container } = render(<AltarSVG />);
    const ds = Array.from(container.querySelectorAll('path')).map((p) => p.getAttribute('d'));
    expect(ds).toEqual([
      'M 33 18 Q 35 15 37 16 Q 39 15 40 18 Q 38 20 36 20 Q 34 20 33 18 Z', // blood stain
      'M 36 12 L 37.5 16.5 L 42 18 L 37.5 19.5 L 36 24 L 34.5 19.5 L 30 18 L 34.5 16.5 Z', // sunburst
      'M 32 14 L 35 16.5 L 32 18 L 35 19.5 L 32 22 L 36.5 19.5 L 40 22 L 37.5 19.5 L 40 18 L 37.5 16.5 L 40 14 L 36.5 16.5 Z', // diagonal rays
    ]);
  });

  it('anchors key geometry positions verbatim', () => {
    const { container } = render(<AltarSVG />);

    const depression = container.querySelector('rect[fill="#7A6F60"]');
    expect(depression).toHaveAttribute('x', '30');
    expect(depression).toHaveAttribute('y', '10');
    expect(depression).toHaveAttribute('width', '12');
    expect(depression).toHaveAttribute('height', '7');
    expect(depression).toHaveAttribute('stroke', '#6B6050');

    // Rune glow centers mark the four candle corners (one per candle).
    const glowCenters = Array.from(container.querySelectorAll('circle[opacity="0.12"]')).map(
      (c) => `${c.getAttribute('cx')},${c.getAttribute('cy')}`
    );
    expect(glowCenters).toEqual(['10,6.5', '62,6.5', '10,24.5', '62,24.5']);

    // Rune rings: outer r=6, inner r=2.5, both stroke-only.
    const rings = container.querySelectorAll('circle[fill="none"]');
    expect(Array.from(rings).map((r) => r.getAttribute('r'))).toEqual(['6', '2.5']);
    expect(Array.from(rings).map((r) => r.getAttribute('stroke-width'))).toEqual(['0.8', '0.6']);

    // Goblet sits over the rune: shadow then rim stacked at cx=36.
    const gobletShadow = container.querySelector('ellipse');
    expect(gobletShadow).toHaveAttribute('cx', '36');
    expect(gobletShadow).toHaveAttribute('cy', '23.5');
    const rim = container.querySelector('circle[stroke="#B8960F"]');
    expect(rim).toHaveAttribute('cx', '36');
    expect(rim).toHaveAttribute('cy', '23');
    expect(rim).toHaveAttribute('r', '2.5');
  });
});
