// @maintained-by-ai
// SVG asset lane — static decorative token, zero mocks, golden-once.
// Old 8 attr-spie tests -> 3: (1) props/ref forwarding contract,
// (2) element census + inert-click static-art guard, (3) authored-art
// golden: all 7 element signatures pinned verbatim in DOM order
// (2 ellipses + 5 paths; the 5 path bytes are the byte pin).
// No authored interactive variants (no handlers/state/cracked variants
// in BoulderSVG.jsx); rotation lives in PlacedItems' <use href="#boulder">
// transform, pinned by PlacedItems.test.jsx — not duplicated here.
// Item availability pinned by Map.test.jsx; ItemsPanel.test.jsx mocks
// this leaf. Family map: map/*SVG.test.jsx (Altar #890, ArrowSlitWall
// #891, Barrel #892, Bed #893, Bookshelf #894).
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BoulderSVG from './BoulderSVG.jsx';

describe('BoulderSVG', () => {
  it('forwards id, className, rest props, and ref to the root <g>', () => {
    const ref = React.createRef();
    const { container } = render(
      <BoulderSVG id="boulder-1" className="custom-boulder" data-test="boulder-test" ref={ref} />
    );
    const g = container.querySelector('g');
    expect(g).toBeInTheDocument();
    expect(g).toHaveAttribute('id', 'boulder-1');
    expect(g).toHaveClass('custom-boulder');
    expect(g).toHaveAttribute('data-test', 'boulder-test');
    expect(ref.current).toBe(g);
  });

  it('renders the authored element census and stays inert when clicked', () => {
    const { container } = render(<BoulderSVG />);

    const counts = {
      g: 1,
      ellipse: 2, // ground shadow + top highlight
      path: 5, // body, highlight face, shadow face, 2 crack lines
      'path[fill="none"]': 2, // crack lines only
      'path[stroke="#5A5A4E"]': 3, // body outline + both cracks
    };
    for (const [selector, count] of Object.entries(counts)) {
      expect(container.querySelectorAll(selector), selector).toHaveLength(count);
    }

    // Static art: clicking changes nothing.
    const before = container.innerHTML;
    fireEvent.click(container.querySelector('g'));
    expect(container.innerHTML).toBe(before);
  });

  it('pins all 7 authored element signatures verbatim in DOM order', () => {
    const { container } = render(<BoulderSVG />);
    const ATTRS = ['cx', 'cy', 'rx', 'ry', 'd', 'fill', 'stroke', 'stroke-width', 'opacity'];
    const sig = (el) => ATTRS
      .filter((a) => el.hasAttribute(a))
      .map((a) => `${a}=${el.getAttribute(a)}`)
      .join(' ');

    expect(Array.from(container.querySelectorAll('ellipse, path')).map(sig)).toEqual([
      // Ground shadow.
      'cx=18 cy=34 rx=14 ry=3 fill=#000 opacity=0.12',
      // Body silhouette (byte pin).
      'd=M 8 32 Q 4 20 10 10 Q 12 4 18 6 Q 24 4 26 10 Q 32 20 28 32 Z fill=#7A7A6A stroke=#5A5A4E stroke-width=0.8',
      // Highlight face.
      'd=M 10 28 Q 8 20 12 14 Q 14 8 18 8 Q 20 8 22 10 Q 18 14 16 18 Q 14 24 12 28 Z fill=#8B8B7A opacity=0.6',
      // Shadow face.
      'd=M 26 28 Q 28 20 24 14 Q 22 10 20 10 Q 22 14 22 18 Q 22 24 24 28 Z fill=#5A5A4E opacity=0.4',
      // Primary crack.
      'd=M 16 12 Q 14 16 16 20 Q 17 22 16 26 fill=none stroke=#5A5A4E stroke-width=0.5 opacity=0.6',
      // Secondary crack.
      'd=M 20 14 Q 22 18 20 22 fill=none stroke=#5A5A4E stroke-width=0.4 opacity=0.5',
      // Top highlight.
      'cx=16 cy=12 rx=4 ry=2 fill=#9A9A8A opacity=0.3',
    ]);
  });
});
