// @maintained-by-ai
// SVG asset lane — static decorative token, zero mocks, golden-once.
// Old 11 attr-spie tests -> 4: (1) props/ref forwarding contract,
// (2) element census + inert-click static-art guard, (3) authored path
// bytes pinned verbatim once, (4) anchor geometry verbatim once.
// No authored interactive variants (no handlers/state in BarrelSVG.jsx),
// so no state->bytes it.each lane (#877) applies here.
// Family map: map/*SVG.test.jsx siblings (Altar #890, Chest #891);
// PlacedItems tests pin only <use href="#barrel"> wiring, not internals.
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BarrelSVG from './BarrelSVG';

describe('BarrelSVG', () => {
  it('forwards id, className, rest props, and ref to the root <g>', () => {
    const ref = React.createRef();
    const { container } = render(
      <BarrelSVG id="barrel-1" className="custom-barrel" data-test="barrel-test" ref={ref} />
    );
    const g = container.querySelector('g');
    expect(g).toBeInTheDocument();
    expect(g).toHaveAttribute('id', 'barrel-1');
    expect(g).toHaveClass('custom-barrel');
    expect(g).toHaveAttribute('data-test', 'barrel-test');
    expect(ref.current).toBe(g);
  });

  it('renders the authored element census and stays inert when clicked', () => {
    const { container } = render(<BarrelSVG />);

    const counts = {
      g: 1,
      path: 6, // body + left shading + right highlight + 3 grain lines
      ellipse: 3, // top rim, bottom rim, opening
      rect: 6, // 3 metal bands + 3 band highlights
      'path[fill="#A0652D"]': 1, // body
      'path[fill="#8B5524"]': 1, // left shading
      'path[fill="#B87A3A"]': 1, // right highlight
      'path[stroke="#7A4E20"]': 3, // grain lines (stroke-only)
      'rect[fill="#555"]': 3, // metal bands
      'rect[fill="#777"]': 3, // band top highlights
    };
    for (const [selector, count] of Object.entries(counts)) {
      expect(container.querySelectorAll(selector), selector).toHaveLength(count);
    }

    // Static art: clicking changes nothing.
    const before = container.innerHTML;
    fireEvent.click(container.querySelector('g'));
    expect(container.innerHTML).toBe(before);
  });

  it('pins the six authored path bytes verbatim', () => {
    const { container } = render(<BarrelSVG />);
    const paths = Array.from(container.querySelectorAll('path'));
    expect(paths.map((p) => p.getAttribute('d'))).toEqual([
      'M 10 4 Q 6 18 10 32 L 26 32 Q 30 18 26 4 Z', // body
      'M 10 4 Q 6 18 10 32 L 16 32 Q 12 18 16 4 Z', // left shading
      'M 26 4 Q 30 18 26 32 L 22 32 Q 26 18 22 4 Z', // right highlight
      'M 14 8 Q 13 18 14 28', // grain left
      'M 18 7 Q 17 18 18 29', // grain middle
      'M 22 8 Q 23 18 22 28', // grain right
    ]);

    // Silhouette and accent styling rides with the pinned bytes.
    expect(paths[0]).toHaveAttribute('stroke', '#6B3E1F');
    expect(paths[0]).toHaveAttribute('stroke-width', '0.8');
    expect(paths[1]).toHaveAttribute('opacity', '0.5');
    expect(paths[2]).toHaveAttribute('opacity', '0.4');
    paths.slice(3).forEach((grain) => {
      expect(grain).toHaveAttribute('fill', 'none');
      expect(grain).toHaveAttribute('stroke-width', '0.4');
      expect(grain).toHaveAttribute('opacity', '0.6');
    });
  });

  it('anchors rim, opening, and metal-band geometry verbatim', () => {
    const { container } = render(<BarrelSVG />);

    // DOM order: top rim, bottom rim, opening nested inside the top rim.
    const ellipses = Array.from(container.querySelectorAll('ellipse'));
    expect(
      ellipses.map((e) => `${e.getAttribute('cx')},${e.getAttribute('cy')},${e.getAttribute('rx')},${e.getAttribute('ry')}`)
    ).toEqual(['18,4,8,2.5', '18,32,8,2.5', '18,4,6,1.8']);
    expect(
      ellipses.slice(0, 2).map((e) => `${e.getAttribute('fill')},${e.getAttribute('stroke')},${e.getAttribute('stroke-width')}`)
    ).toEqual(['#8B5524,#6B3E1F,0.6', '#8B5524,#6B3E1F,0.6']);
    expect(ellipses[2]).toHaveAttribute('fill', '#5C3317');
    expect(ellipses[2]).toHaveAttribute('stroke', '#4A2810');
    expect(ellipses[2]).toHaveAttribute('stroke-width', '0.5');

    // Each #555 band pairs with a #777 highlight at the same x/y/width.
    const box = (r) => `${r.getAttribute('x')},${r.getAttribute('y')},${r.getAttribute('width')},${r.getAttribute('height')}`;
    expect(Array.from(container.querySelectorAll('rect[fill="#555"]')).map(box)).toEqual([
      '9.5,10,17,2',
      '9,18,18,2',
      '9.5,26,17,2',
    ]);
    expect(Array.from(container.querySelectorAll('rect[fill="#777"]')).map(box)).toEqual([
      '9.5,10,17,0.5',
      '9,18,18,0.5',
      '9.5,26,17,0.5',
    ]);
  });
});
