// @maintained-by-ai
// SVG asset lane — static decorative token, zero mocks, golden-once, no JS
// timers (purely static art; flicker would be presentation-only here).
// Old 8 attr-spie tests -> 4: (1) props/ref forwarding contract,
// (2) element census + inert-click static-art guard, (3) authored path
// bytes pinned verbatim once, (4) anchor geometry verbatim once.
// Family map: map/*SVG.test.jsx siblings (Altar, Bed, Barrel, Boulder,
// Bush, Chair, Chest, Door, Fountain, ArrowSlitWall) keep their own
// per-asset golden tests; ItemsPanel.test.jsx mocks this leaf.
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FirePitSVG from './FirePitSVG';

describe('FirePitSVG', () => {
  it('forwards id, className, rest props, and ref to the root <g>', () => {
    const ref = React.createRef();
    const { container } = render(
      <FirePitSVG id="firepit-1" className="custom-firepit" data-test="firepit-test" ref={ref} />
    );
    const g = container.querySelector('g');
    expect(g).toBeInTheDocument();
    expect(g).toHaveAttribute('id', 'firepit-1');
    expect(g).toHaveClass('custom-firepit');
    expect(g).toHaveAttribute('data-test', 'firepit-test');
    expect(ref.current).toBe(g);
  });

  it('renders the authored element census and stays inert when clicked', () => {
    const { container } = render(<FirePitSVG />);

    const counts = {
      g: 1, // root only
      path: 16, // 7 outer + 5 mid + 3 inner + 1 core flame
      circle: 18, // 3 glow + 1 stone ring + 4 ember accents + 10 sparks
      ellipse: 2, // ember base + white-hot core
      'circle[fill="#E87A20"]': 7, // 3 ambient glows + 4 orange sparks
      'circle[fill="#8B3A1A"]': 2, // ember accents
      'circle[fill="#A04020"]': 2, // ember accents
      'circle[fill="#F5D060"]': 4, // yellow sparks
      'circle[fill="#FFF8E0"]': 2, // pale sparks
      'circle[fill="#555"]': 1, // stone ring
      'path[fill="#D35400"]': 7, // outer flames
      'path[fill="#E87A20"]': 5, // mid flames
      'path[fill="#F5D060"]': 3, // inner flames
      'path[fill="#FFF8E0"]': 1, // core flame
      'ellipse[fill="#2a1510"]': 1, // ember bed
      'ellipse[fill="#FFFFFF"]': 1, // white-hot core
    };
    for (const [selector, count] of Object.entries(counts)) {
      expect(container.querySelectorAll(selector), selector).toHaveLength(count);
    }

    // Static art: clicking changes nothing.
    const before = container.innerHTML;
    fireEvent.click(container.querySelector('g'));
    expect(container.innerHTML).toBe(before);
  });

  it('pins the sixteen authored flame path bytes verbatim', () => {
    const { container } = render(<FirePitSVG />);
    const ds = Array.from(container.querySelectorAll('path')).map((p) => p.getAttribute('d'));
    expect(ds).toEqual([
      // Outer flames (#D35400)
      'M 18 18 Q 10 13 14 4 Q 15 1 18 1 Q 21 1 22 4 Q 26 13 18 18 Z',
      'M 15 18 Q 8 14 10 6 Q 11 3 13 3 Q 14 4 14 8 Q 15 13 15 18 Z',
      'M 21 18 Q 28 14 26 6 Q 25 3 23 3 Q 22 4 22 8 Q 21 13 21 18 Z',
      'M 12 18 Q 5 15 7 9 Q 8 6 9 6 Q 10 7 10 10 Q 11 14 12 18 Z',
      'M 24 18 Q 31 15 29 9 Q 28 6 27 6 Q 26 7 26 10 Q 25 14 24 18 Z',
      'M 9 18 Q 4 16 6 12 Q 7 10 8 10 Q 8.5 11 8 13 Q 9 15 9 18 Z',
      'M 27 18 Q 32 16 30 12 Q 29 10 28 10 Q 27.5 11 28 13 Q 27 15 27 18 Z',
      // Mid flames (#E87A20)
      'M 18 17 Q 12 12 15 5 Q 16 2.5 18 2.5 Q 20 2.5 21 5 Q 24 12 18 17 Z',
      'M 15.5 17 Q 10 13 12 7 Q 12.5 4.5 14 4.5 Q 15 5.5 15 9 Q 15.5 13 15.5 17 Z',
      'M 20.5 17 Q 26 13 24 7 Q 23.5 4.5 22 4.5 Q 21 5.5 21 9 Q 20.5 13 20.5 17 Z',
      'M 12.5 17 Q 6 14 8 10 Q 9 7 10 7 Q 11 8 10.5 11 Q 11.5 14 12.5 17 Z',
      'M 23.5 17 Q 30 14 28 10 Q 27 7 26 7 Q 25 8 25.5 11 Q 24.5 14 23.5 17 Z',
      // Inner flames (#F5D060)
      'M 18 15 Q 14 11 16 6 Q 16.5 4 18 4 Q 19.5 4 20 6 Q 22 11 18 15 Z',
      'M 16 15 Q 12 12 13 8 Q 13.5 6 14.5 6 Q 15 7 15 10 Q 15.5 12 16 15 Z',
      'M 20 15 Q 24 12 23 8 Q 22.5 6 21.5 6 Q 21 7 21 10 Q 20.5 12 20 15 Z',
      // Core flame (#FFF8E0)
      'M 18 13 Q 15.5 10 16.5 7 Q 17 5.5 18 5.5 Q 19 5.5 19.5 7 Q 20.5 10 18 13 Z',
    ]);
  });

  it('anchors key geometry positions verbatim', () => {
    const { container } = render(<FirePitSVG />);

    // Ambient glows: three big soft circles stacked first in document order.
    const glowShapes = Array.from(container.querySelectorAll('circle[fill="#E87A20"]')).slice(0, 3);
    expect(glowShapes.map((c) => `${c.getAttribute('cx')},${c.getAttribute('cy')},${c.getAttribute('r')}`)).toEqual([
      '18,10,17',
      '18,10,14',
      '18,18,18',
    ]);
    expect(glowShapes.map((c) => c.getAttribute('opacity'))).toEqual(['0.1', '0.08', '0.03']);

    // Stone ring and ember bed share the pit's base centre at 18,20.
    const stoneRing = container.querySelector('circle[fill="#555"]');
    expect(stoneRing).toHaveAttribute('cx', '18');
    expect(stoneRing).toHaveAttribute('cy', '20');
    expect(stoneRing).toHaveAttribute('r', '9');
    expect(stoneRing).toHaveAttribute('stroke', '#333');
    expect(stoneRing).toHaveAttribute('stroke-width', '1.5');

    const emberBed = container.querySelector('ellipse[fill="#2a1510"]');
    expect(emberBed).toHaveAttribute('cx', '18');
    expect(emberBed).toHaveAttribute('cy', '20');
    expect(emberBed).toHaveAttribute('rx', '6');
    expect(emberBed).toHaveAttribute('ry', '2');

    // White-hot core sits above the base, centred in the flame column.
    const core = container.querySelector('ellipse[fill="#FFFFFF"]');
    expect(core).toHaveAttribute('cx', '18');
    expect(core).toHaveAttribute('cy', '9');
    expect(core).toHaveAttribute('rx', '1.5');
    expect(core).toHaveAttribute('ry', '2');
    expect(core).toHaveAttribute('opacity', '0.6');
  });
});
