// @maintained-by-ai
// SVG asset lane — static decorative token, zero mocks, golden-once.
// Old 10 attr-spie tests -> 3: (1) props/ref forwarding contract,
// (2) element census + inert-click static-art guard, (3) authored-art
// golden: all 14 element signatures pinned verbatim in DOM order
// (1 ellipse + 11 circles + 2 paths; the 2 path bytes are the byte pin).
// No authored interactive variants (no handlers/state/season/flowering
// variants in BushSVG.jsx); rotation lives in PlacedItems' <use href="#bush">
// transform, pinned by PlacedItems.test.jsx — not duplicated here.
// Item availability pinned by Map.test.jsx; ItemsPanel.test.jsx mocks
// this leaf. Family map: map/*SVG.test.jsx (Altar #890, ArrowSlitWall
// #891, Barrel #892, Bed #893, Bookshelf #894, Boulder #895).
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BushSVG from './BushSVG.jsx';

describe('BushSVG', () => {
  it('forwards id, className, rest props, and ref to the root <g>', () => {
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

  it('renders the authored element census and stays inert when clicked', () => {
    const { container } = render(<BushSVG />);

    const counts = {
      g: 1,
      ellipse: 1, // ground shadow
      circle: 11, // 3 bottom + 3 middle + 3 top + 2 highlights
      path: 2, // 2 branch detail lines
      'path[fill="none"]': 2, // branch lines only
      'circle[fill="#3D7A4A"]': 3, // bottom layer
      'circle[fill="#4A9A5A"]': 3, // middle layer
      'circle[fill="#5AAB6A"]': 3, // top layer
      'circle[fill="#6ABC7A"]': 2, // highlights
    };
    for (const [selector, count] of Object.entries(counts)) {
      expect(container.querySelectorAll(selector), selector).toHaveLength(count);
    }

    // Static art: clicking changes nothing.
    const before = container.innerHTML;
    fireEvent.click(container.querySelector('g'));
    expect(container.innerHTML).toBe(before);
  });

  it('pins all 14 authored element signatures verbatim in DOM order', () => {
    const { container } = render(<BushSVG />);
    const ATTRS = ['cx', 'cy', 'r', 'rx', 'ry', 'd', 'fill', 'stroke', 'stroke-width', 'opacity'];
    const sig = (el) => ATTRS
      .filter((a) => el.hasAttribute(a))
      .map((a) => `${a}=${el.getAttribute(a)}`)
      .join(' ');

    expect(Array.from(container.querySelectorAll('ellipse, circle, path')).map(sig)).toEqual([
      // Ground shadow.
      'cx=18 cy=33 rx=11 ry=2.5 fill=#000 opacity=0.12',
      // Body — bottom layer (outline on the center circle).
      'cx=18 cy=22 r=12 fill=#3D7A4A stroke=#2D5E37 stroke-width=0.5',
      'cx=10 cy=24 r=8 fill=#3D7A4A',
      'cx=26 cy=24 r=8 fill=#3D7A4A',
      // Body — middle layer.
      'cx=18 cy=20 r=10 fill=#4A9A5A',
      'cx=12 cy=22 r=7 fill=#4A9A5A',
      'cx=24 cy=22 r=7 fill=#4A9A5A',
      // Body — top layer.
      'cx=18 cy=18 r=7 fill=#5AAB6A',
      'cx=14 cy=19 r=5 fill=#5AAB6A',
      'cx=22 cy=19 r=5 fill=#5AAB6A',
      // Highlights.
      'cx=16 cy=16 r=3 fill=#6ABC7A opacity=0.5',
      'cx=20 cy=17 r=2 fill=#6ABC7A opacity=0.4',
      // Branch details (byte pins).
      'd=M 10 20 Q 8 16 9 14 fill=none stroke=#4A9A5A stroke-width=0.8',
      'd=M 26 20 Q 28 16 27 14 fill=none stroke=#4A9A5A stroke-width=0.8',
    ]);
  });
});
