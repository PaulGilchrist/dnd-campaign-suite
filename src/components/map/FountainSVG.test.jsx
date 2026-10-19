// @maintained-by-ai
// SVG asset lane — static decorative token, zero mocks, golden-once (template #890).
// Old 13 attr-spie tests -> 3: (1) props/ref forwarding contract,
// (2) element census + inert-click static-art guard, (3) golden geometry
// verbatim in DOM order once (path bytes + circle centres; the fountain
// authors both, so both shapes are pinned).
// No authored interactive variants (no handlers/state in FountainSVG.jsx),
// so no state->bytes it.each lane (#877) applies here. Rotation/scale
// belong to PlacedItems; availability lives in Map; ItemsPanel.test.jsx
// mocks this leaf.
// Family map: map/*SVG.test.jsx siblings (Chest #898 rect/line/circle,
// FirePit #900 path-bytes, Altar, Barrel) keep their own per-asset
// golden tests; PlacedItems tests pin only <use href="#fountain"> wiring.
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FountainSVG from './FountainSVG';

describe('FountainSVG', () => {
  it('forwards id, className, rest props, and ref to the root <g>', () => {
    const ref = React.createRef();
    const { container } = render(
      <FountainSVG id="fountain-1" className="custom-fountain" data-test="fountain-test" ref={ref} />
    );
    const g = container.querySelector('g');
    expect(g).toBeInTheDocument();
    expect(g).toHaveAttribute('id', 'fountain-1');
    expect(g).toHaveClass('custom-fountain');
    expect(g).toHaveAttribute('data-test', 'fountain-test');
    expect(ref.current).toBe(g);
  });

  it('renders the authored element census and stays inert when clicked', () => {
    const { container } = render(<FountainSVG />);

    const counts = {
      g: 1, // root only
      path: 7, // basin wall + wall shadow + water highlight + 4 flow arcs
      circle: 13, // shadow + rim + water + 3 pillar + 3 ripples + 4 droplets
      'circle[fill="#555"]': 1, // floor shadow
      'circle[fill="#3498DB"]': 1, // water surface
      'circle[fill="#888"]': 1, // pillar base
      'circle[fill="#999"]': 1, // pillar top
      'circle[fill="#AAA"]': 1, // pillar center highlight
      'circle[fill="#5DADE2"]': 4, // droplets
      'circle[fill="none"]': 4, // rim highlight + 3 ripples
      'circle[stroke="#5DADE2"][fill="none"]': 3, // ripples only
      'path[fill="#888"]': 1, // basin wall
      'path[fill="none"]': 6, // stroke-only arcs
      'path[stroke="#555"]': 1, // basin wall shadow
      'path[stroke="#5DADE2"]': 5, // water highlight + 4 flow arcs
    };
    for (const [selector, count] of Object.entries(counts)) {
      expect(container.querySelectorAll(selector), selector).toHaveLength(count);
    }

    // Static art: clicking changes nothing.
    const before = container.innerHTML;
    fireEvent.click(container.querySelector('g'));
    expect(container.innerHTML).toBe(before);
  });

  it('pins path bytes and circle geometry verbatim in DOM order', () => {
    const { container } = render(<FountainSVG />);

    // All 7 paths, DOM order: basin wall, wall shadow, water highlight,
    // then 4 flow arcs (top-left, top-right, bottom-left, bottom-right).
    expect(Array.from(container.querySelectorAll('path')).map((p) => p.getAttribute('d'))).toEqual([
      'M 3 18 A 15 15 0 1 1 33 18 A 15 15 0 1 1 3 18 Z M 6 18 A 12 12 0 1 0 30 18 A 12 12 0 1 0 6 18 Z',
      'M 6 24 A 12 12 0 0 0 30 24',
      'M 8 15 A 10 10 0 0 1 28 15',
      'M 15 15 Q 12 13 11 16',
      'M 21 15 Q 24 13 25 16',
      'M 15 21 Q 12 23 11 20',
      'M 21 21 Q 24 23 25 20',
    ]);

    // Accent styling rides with the pinned bytes.
    const paths = Array.from(container.querySelectorAll('path'));
    const basinWall = paths[0];
    expect(basinWall).toHaveAttribute('fill', '#888');
    expect(basinWall).toHaveAttribute('stroke', '#666');
    expect(basinWall).toHaveAttribute('stroke-width', '0.6');
    expect(basinWall).toHaveAttribute('fill-rule', 'evenodd'); // cuts the stone ring
    expect(paths.slice(1, 3).map((p) => p.getAttribute('stroke'))).toEqual(['#555', '#5DADE2']);
    expect(paths.slice(1, 3).map((p) => p.getAttribute('stroke-width'))).toEqual(['1.5', '1.8']);
    expect(paths.slice(1, 3).map((p) => p.getAttribute('opacity'))).toEqual(['0.3', '0.35']);
    paths.slice(3).forEach((arc) => {
      expect(arc).toHaveAttribute('fill', 'none');
      expect(arc).toHaveAttribute('stroke', '#5DADE2');
      expect(arc).toHaveAttribute('stroke-width', '0.8');
      expect(arc).toHaveAttribute('stroke-linecap', 'round');
      expect(arc).toHaveAttribute('opacity', '0.5');
    });

    // All 13 circles, DOM order: shadow, rim, water surface, pillar stack,
    // ripples (5 -> 10), droplets (four corners).
    const center = (c) => `${c.getAttribute('cx')},${c.getAttribute('cy')},${c.getAttribute('r')}`;
    expect(Array.from(container.querySelectorAll('circle')).map(center)).toEqual([
      '18,19,16', // floor shadow
      '18,18,14.5', // basin rim highlight
      '18,18,11.5', // water surface
      '18,18,3.5', // pillar base
      '18,18,2.5', // pillar top
      '17.5,17.5,0.8', // pillar center highlight
      '18,18,5', // ripple
      '18,18,7.5', // ripple
      '18,18,10', // ripple
      '10,13,0.7', // droplet
      '26,13,0.7', // droplet
      '10,23,0.7', // droplet
      '26,23,0.7', // droplet
    ]);

    const circles = Array.from(container.querySelectorAll('circle'));
    expect(circles[0]).toHaveAttribute('fill', '#555');
    expect(circles[0]).toHaveAttribute('opacity', '0.12');
    expect(circles[1]).toHaveAttribute('stroke', '#999');
    expect(circles[1]).toHaveAttribute('stroke-width', '0.4');
    expect(circles[1]).toHaveAttribute('opacity', '0.6');
    expect(circles[2]).toHaveAttribute('fill', '#3498DB');
    expect(circles[2]).toHaveAttribute('opacity', '0.45');
    expect(circles[3]).toHaveAttribute('fill', '#888');
    expect(circles[3]).toHaveAttribute('stroke', '#666');
    expect(circles[4]).toHaveAttribute('fill', '#999');
    expect(circles[4]).toHaveAttribute('stroke', '#777');
    expect(circles[5]).toHaveAttribute('fill', '#AAA');
    expect(circles[5]).toHaveAttribute('opacity', '0.4');
    // Ripples widen outward while fading.
    expect(circles.slice(6, 9).map((c) => c.getAttribute('stroke-width'))).toEqual(['0.4', '0.4', '0.3']);
    expect(circles.slice(6, 9).map((c) => c.getAttribute('opacity'))).toEqual(['0.3', '0.25', '0.2']);
    // Droplets share their splash styling (geometry pinned above).
    circles.slice(9).forEach((d) => {
      expect(d).toHaveAttribute('fill', '#5DADE2');
      expect(d).toHaveAttribute('opacity', '0.6');
    });
  });
});
