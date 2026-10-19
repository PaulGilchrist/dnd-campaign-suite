// @maintained-by-ai
// SVG asset lane — static decorative token, zero mocks, golden-once (template #890).
// Old 16 attr-spie tests -> 3: (1) props/ref forwarding contract,
// (2) element census + inert-click static-art guard, (3) golden geometry
// verbatim in DOM order once. ChestSVG authors no <path> elements, so the
// family's "pin path bytes" shape is replaced by rect/line/circle pins.
// No authored interactive variants (no handlers/state in ChestSVG.jsx),
// so no state->bytes it.each lane (#877) applies here.
// Family map: map/*SVG.test.jsx siblings (Barrel #890, Altar #890);
// PlacedItems-fog.test.jsx pins only <use href="#chest"> wiring, not internals.
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ChestSVG from './ChestSVG';

describe('ChestSVG', () => {
  it('forwards id, className, rest props, and ref to the root <g>', () => {
    const ref = React.createRef();
    const { container } = render(
      <ChestSVG id="chest-1" className="custom-chest" data-test="chest-test" ref={ref} />
    );
    const g = container.querySelector('g');
    expect(g).toBeInTheDocument();
    expect(g).toHaveAttribute('id', 'chest-1');
    expect(g).toHaveClass('custom-chest');
    expect(g).toHaveAttribute('data-test', 'chest-test');
    expect(ref.current).toBe(g);
  });

  it('renders the authored element census and stays inert when clicked', () => {
    const { container } = render(<ChestSVG />);

    const counts = {
      g: 1,
      rect: 12, // shadow + lid edge + body + 2 bands + 2 band highlights + keyhole + 2 hinges + 2 edge shadows
      line: 4, // wood grain lines
      circle: 9, // 8 nail heads + lock
      'rect[fill="#6B3E1F"]': 4, // floor shadow, lid edge, right + bottom edge shadows
      'rect[fill="#A0703C"]': 1, // body
      'rect[fill="#555"]': 2, // metal bands
      'rect[fill="#777"]': 2, // band top highlights
      'rect[fill="#333"]': 1, // keyhole
      'rect[fill="#666"]': 2, // hinges
      'line[stroke="#7A4E20"]': 4, // grain lines (stroke-only)
      'circle[fill="#888"]': 8, // nail heads
      'circle[fill="#D4A017"]': 1, // lock
    };
    for (const [selector, count] of Object.entries(counts)) {
      expect(container.querySelectorAll(selector), selector).toHaveLength(count);
    }

    // Static art: clicking changes nothing.
    const before = container.innerHTML;
    fireEvent.click(container.querySelector('g'));
    expect(container.innerHTML).toBe(before);
  });

  it('pins rect, line, and circle geometry verbatim in DOM order', () => {
    const { container } = render(<ChestSVG />);

    // All 12 rects, DOM order: shadow, lid edge, body, band/highlight pairs,
    // keyhole, hinges, right + bottom edge shadows.
    const box = (r) =>
      `${r.getAttribute('x')},${r.getAttribute('y')},${r.getAttribute('width')},${r.getAttribute('height')},${r.getAttribute('fill')}`;
    expect(Array.from(container.querySelectorAll('rect')).map(box)).toEqual([
      '7,10,24,18,#6B3E1F', // floor shadow
      '5,8,26,20,#6B3E1F', // lid edge
      '6,9,24,18,#A0703C', // body
      '6,11,24,1.5,#555', // top band
      '6,11,24,0.4,#777', // top band highlight
      '6,24,24,1.5,#555', // bottom band
      '6,24,24,0.4,#777', // bottom band highlight
      '17.5,21.5,1,2.5,#333', // keyhole
      '8,8,3,1.2,#666', // hinge left
      '25,8,3,1.2,#666', // hinge right
      '28,9,2,18,#6B3E1F', // right edge shadow
      '6,25,24,2,#6B3E1F', // bottom edge shadow
    ]);

    // Silhouette and accent styling rides with the pinned boxes.
    const rects = Array.from(container.querySelectorAll('rect'));
    expect(rects[0]).toHaveAttribute('rx', '1');
    expect(rects[0]).toHaveAttribute('opacity', '0.25');
    expect(rects[1]).toHaveAttribute('rx', '1');
    expect(rects[2]).toHaveAttribute('rx', '0.8');
    expect(rects[2]).toHaveAttribute('stroke', '#8B5E3C');
    expect(rects[2]).toHaveAttribute('stroke-width', '0.6');
    expect(rects[7]).toHaveAttribute('rx', '0.2');
    rects.slice(8, 10).forEach((hinge) => {
      expect(hinge).toHaveAttribute('stroke', '#555');
      expect(hinge).toHaveAttribute('stroke-width', '0.3');
      expect(hinge).toHaveAttribute('rx', '0.3');
    });
    rects.slice(10).forEach((shadow) => {
      expect(shadow).toHaveAttribute('opacity', '0.15');
    });

    // Grain lines, DOM order.
    const grain = (l) =>
      `${l.getAttribute('x1')},${l.getAttribute('y1')},${l.getAttribute('x2')},${l.getAttribute('y2')}`;
    expect(Array.from(container.querySelectorAll('line')).map(grain)).toEqual([
      '8,12,28,12',
      '7,16,29,16',
      '8,20,28,20',
      '7,24,29,24',
    ]);
    Array.from(container.querySelectorAll('line')).forEach((l) => {
      expect(l).toHaveAttribute('stroke-width', '0.3');
      expect(l).toHaveAttribute('opacity', '0.25');
    });

    // Circles, DOM order: 8 nails (top band then bottom band), then lock.
    const center = (c) => `${c.getAttribute('cx')},${c.getAttribute('cy')},${c.getAttribute('r')}`;
    expect(Array.from(container.querySelectorAll('circle')).map(center)).toEqual([
      '8,11.8,0.7',
      '28,11.8,0.7',
      '13,11.8,0.7',
      '23,11.8,0.7',
      '8,24.8,0.7',
      '28,24.8,0.7',
      '13,24.8,0.7',
      '23,24.8,0.7',
      '18,21,2.5', // lock
    ]);
    const lock = container.querySelector('circle[fill="#D4A017"]');
    expect(lock).toHaveAttribute('stroke', '#B8860B');
    expect(lock).toHaveAttribute('stroke-width', '0.4');
  });
});
