// @maintained-by-ai
// SVG asset lane — static decorative token, zero mocks, golden-once.
// Old 12 attr-spie tests -> 4: (1) props/ref forwarding contract,
// (2) element census + inert-click static-art guard, (3) authored path
// bytes pinned verbatim once, (4) all 13 rect boxes + key strokes verbatim.
// No authored interactive variants (no handlers/state/orientation props in
// BedSVG.jsx); rotation lives in PlacedItems' <use href="#bed"> transform,
// pinned by PlacedItems.test.jsx — not duplicated here. ItemsPanel.test.jsx
// mocks this leaf. Family map: map/*SVG.test.jsx (Altar #890,
// ArrowSlitWall #891, Barrel #892).
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BedSVG from './BedSVG';

describe('BedSVG', () => {
  it('forwards id, className, rest props, and ref to the root <g>', () => {
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

  it('renders the authored element census and stays inert when clicked', () => {
    const { container } = render(<BedSVG />);

    const counts = {
      g: 1,
      rect: 13, // frame, mattress, pillow + 2 shading, blanket + 3 shading, 4 frame shading/bevel
      path: 5, // blanket fold line + 4 wood grain lines
      'rect[fill="#A0652D"]': 1, // frame
      'rect[fill="#D4A574"]': 1, // mattress
      'rect[fill="#F5F0E8"]': 1, // pillow
      'rect[fill="#3B5998"]': 1, // blanket
      'rect[fill="#2A4070"]': 2, // blanket fold + blanket shading
      'path[stroke="#7A4E20"]': 4, // wood grain lines
      'path[stroke="#2A4070"]': 1, // blanket fold line
    };
    for (const [selector, count] of Object.entries(counts)) {
      expect(container.querySelectorAll(selector), selector).toHaveLength(count);
    }

    // Static art: clicking changes nothing.
    const before = container.innerHTML;
    fireEvent.click(container.querySelector('g'));
    expect(container.innerHTML).toBe(before);
  });

  it('pins the five authored path bytes verbatim', () => {
    const { container } = render(<BedSVG />);
    const paths = Array.from(container.querySelectorAll('path'));
    expect(paths.map((p) => p.getAttribute('d'))).toEqual([
      'M 20 18 Q 24 17 28 18', // blanket fold line
      'M 8 10 Q 14 9 20 10', // grain top-left
      'M 8 26 Q 14 25 20 26', // grain bottom-left
      'M 56 10 Q 62 9 66 10', // grain top-right
      'M 56 26 Q 62 25 66 26', // grain bottom-right
    ]);

    // Accent styling rides with the pinned bytes.
    expect(paths[0]).toHaveAttribute('fill', 'none');
    expect(paths[0]).toHaveAttribute('stroke', '#2A4070');
    expect(paths[0]).toHaveAttribute('stroke-width', '0.5');
    expect(paths[0]).toHaveAttribute('opacity', '0.5');
    paths.slice(1).forEach((grain) => {
      expect(grain).toHaveAttribute('fill', 'none');
      expect(grain).toHaveAttribute('stroke', '#7A4E20');
      expect(grain).toHaveAttribute('stroke-width', '0.3');
      expect(grain).toHaveAttribute('opacity', '0.4');
    });
  });

  it('anchors all thirteen rect boxes and key strokes verbatim', () => {
    const { container } = render(<BedSVG />);
    const box = (r) => `${r.getAttribute('x')},${r.getAttribute('y')},${r.getAttribute('width')},${r.getAttribute('height')}`;

    // DOM order: frame, mattress, pillow, pillow shade/highlight,
    // blanket, blanket fold/shade/highlight, frame shade/highlight/bevels.
    expect(Array.from(container.querySelectorAll('rect')).map(box)).toEqual([
      '2,4,68,28', // frame
      '6,8,60,20', // mattress
      '4,10,14,16', // pillow
      '4,10,5,16', // pillow shading
      '13,10,5,16', // pillow highlight
      '20,6,46,24', // blanket
      '20,28,46,3', // blanket fold
      '20,6,12,24', // blanket shading
      '50,6,16,24', // blanket highlight
      '2,4,10,28', // left frame shading
      '58,4,12,28', // right frame highlight
      '4,5,64,1.5', // top edge bevel
      '4,30,64,1.5', // front edge shadow
    ]);

    // Key outline styling rides with the anchored boxes.
    const rects = Array.from(container.querySelectorAll('rect'));
    const outline = (r) => `${r.getAttribute('fill')},${r.getAttribute('stroke')},${r.getAttribute('stroke-width')}`;
    expect([rects[0], rects[1], rects[2], rects[5]].map(outline)).toEqual([
      '#A0652D,#6B3E1F,0.8', // frame
      '#D4A574,#B87A3A,0.5', // mattress
      '#F5F0E8,#D4CFC4,0.5', // pillow
      '#3B5998,#2A4070,0.5', // blanket
    ]);
  });
});
