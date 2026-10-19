// @maintained-by-ai
// SVG asset lane — static decorative wall token, zero mocks, golden-once (#890 template).
// Old 6 attr-spie tests -> 4: (1) props/ref forwarding contract,
// (2) element census + inert-click static-art guard, (3) authored polygon
// points bytes pinned verbatim once, (4) rect + center-line oracle geometry.
// Family map: map/*SVG.test.jsx siblings (Altar, Chest, Bed, Barrel, Boulder,
// Bush, Chair, Door, FirePit, Fountain) keep their own per-asset golden tests;
// ItemsPanel.test.jsx mocks this leaf.
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ArrowSlitWallSVG from './ArrowSlitWallSVG';

describe('ArrowSlitWallSVG', () => {
  it('forwards id, className, rest props, and ref to the root <g>', () => {
    const ref = React.createRef();
    const { container } = render(
      <ArrowSlitWallSVG id="my-slit" className="custom-class" data-test="slit-test" ref={ref} />
    );
    const g = container.querySelector('g');
    expect(g).toBeInTheDocument();
    expect(g).toHaveAttribute('id', 'my-slit');
    expect(g).toHaveClass('custom-class');
    expect(g).toHaveAttribute('data-test', 'slit-test');
    expect(ref.current).toBe(g);
  });

  it('renders the authored element census and stays inert when clicked', () => {
    const { container } = render(<ArrowSlitWallSVG />);

    const counts = {
      g: 1,
      rect: 1, // stone background plate
      polygon: 3, // main slit + left/right shading
      line: 1, // center divider
      'rect[fill="#696969"]': 1,
      'polygon[fill="#2a2a2a"]': 1, // main slit
      'polygon[fill="#3a3a3a"]': 1, // left shading
      'polygon[fill="#4a4a4a"]': 1, // right shading
      'line[stroke="#4a4a4a"]': 1,
    };
    for (const [selector, count] of Object.entries(counts)) {
      expect(container.querySelectorAll(selector), selector).toHaveLength(count);
    }

    // Static art: clicking changes nothing.
    const before = container.innerHTML;
    fireEvent.click(container.querySelector('g'));
    expect(container.innerHTML).toBe(before);
  });

  it('pins the three authored polygon bytes verbatim', () => {
    const { container } = render(<ArrowSlitWallSVG />);
    const shapes = Array.from(container.querySelectorAll('polygon')).map((p) => [
      p.getAttribute('points'),
      p.getAttribute('fill'),
      p.getAttribute('opacity') ?? '',
    ]);
    expect(shapes).toEqual([
      ['16,4 20,4 30,36 6,36', '#2a2a2a', ''], // main arrow slit
      ['16,4 18,4 17,12 13,36 6,36', '#3a3a3a', '0.4'], // left shading
      ['20,4 18,4 19,12 23,36 30,36', '#4a4a4a', '0.3'], // right shading
    ]);
  });

  it('anchors background plate and center-line geometry verbatim', () => {
    const { container } = render(<ArrowSlitWallSVG />);

    const rect = container.querySelector('rect');
    expect(rect).toHaveAttribute('x', '0');
    expect(rect).toHaveAttribute('y', '0');
    expect(rect).toHaveAttribute('width', '36');
    expect(rect).toHaveAttribute('height', '36');
    expect(rect).toHaveAttribute('opacity', '0.85');

    // Center divider splits the slit top-to-bottom at x=18.
    const line = container.querySelector('line');
    expect(line).toHaveAttribute('x1', '18');
    expect(line).toHaveAttribute('y1', '4');
    expect(line).toHaveAttribute('x2', '18');
    expect(line).toHaveAttribute('y2', '36');
    expect(line).toHaveAttribute('stroke-width', '1');
  });
});
