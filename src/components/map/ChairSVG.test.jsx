// @maintained-by-ai
// SVG asset lane — static decorative token, zero mocks, golden-once.
// Old 16 attr-spie tests -> 3: (1) props/ref forwarding contract,
// (2) element census + inert-click static-art guard, (3) authored-art
// golden: all 18 element signatures pinned verbatim in DOM order
// (14 rects + 4 circles). The old intent checks — red cushion running to
// the front edge (y+height=35) and no wide wood band in front of the
// cushion — are pinned verbatim by the golden, not re-derived.
// No authored interactive variants (no handlers/state/variants in
// ChairSVG.jsx); rotation lives in PlacedItems' <use href="#chair">
// transform, pinned by PlacedItems.test.jsx — not duplicated here.
// Item availability pinned by Map.test.jsx; ItemsPanel.test.jsx mocks
// this leaf. Family map: map/*SVG.test.jsx (Altar #890, ArrowSlitWall
// #891, Barrel #892, Bed #893, Bookshelf #894, Boulder #895, Bush #896).
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ChairSVG from './ChairSVG.jsx';

describe('ChairSVG', () => {
  it('forwards id, className, rest props, and ref to the root <g>', () => {
    const ref = React.createRef();
    const { container } = render(
      <ChairSVG id="chair-1" className="custom-chair" data-test="chair-test" ref={ref} />
    );
    const g = container.querySelector('g');
    expect(g).toBeInTheDocument();
    expect(g).toHaveAttribute('id', 'chair-1');
    expect(g).toHaveClass('custom-chair');
    expect(g).toHaveAttribute('data-test', 'chair-test');
    expect(ref.current).toBe(g);
  });

  it('renders the authored element census and stays inert when clicked', () => {
    const { container } = render(<ChairSVG />);

    const counts = {
      g: 1,
      rect: 14, // shadow, backrest + trim, cushion + 2 shading, 2 armrests + 2 highlights, 4 legs
      circle: 4, // 2 backrest decorations + 2 armrest tips
      'rect[fill="#4A2810"]': 5, // floor shadow + 4 legs
      'rect[fill="#5C3317"]': 3, // backrest + 2 armrests (no extra wide band in front)
      'rect[fill="#8B0000"]': 1, // seat cushion
      'circle[fill="#D4AF37"]': 2, // gold armrest tips
      'circle[fill="none"]': 2, // backrest decorations only
    };
    for (const [selector, count] of Object.entries(counts)) {
      expect(container.querySelectorAll(selector), selector).toHaveLength(count);
    }

    // Static art: clicking changes nothing.
    const before = container.innerHTML;
    fireEvent.click(container.querySelector('g'));
    expect(container.innerHTML).toBe(before);
  });

  it('pins all 18 authored element signatures verbatim in DOM order', () => {
    const { container } = render(<ChairSVG />);
    const ATTRS = ['x', 'y', 'width', 'height', 'rx', 'cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width', 'opacity'];
    const sig = (el) => ATTRS
      .filter((a) => el.hasAttribute(a))
      .map((a) => `${a}=${el.getAttribute(a)}`)
      .join(' ');

    expect(Array.from(container.querySelectorAll('rect, circle')).map(sig)).toEqual([
      // Floor shadow.
      'x=3 y=3 width=30 height=30 rx=1 fill=#4A2810 opacity=0.15',
      // Backrest (top edge = back of chair).
      'x=7 y=3 width=22 height=7 rx=0.8 fill=#5C3317 stroke=#4A2810 stroke-width=0.6',
      // Gold trim on back edge.
      'x=7 y=3 width=22 height=1 rx=0.3 fill=#D4AF37 opacity=0.8',
      // Backrest decorations.
      'cx=18 cy=6.5 r=2.2 fill=none stroke=#D4AF37 stroke-width=0.5 opacity=0.6',
      'cx=18 cy=6.5 r=0.8 fill=none stroke=#D4AF37 stroke-width=0.4 opacity=0.4',
      // Seat cushion — red runs to front edge (y=10 + height=25 = 35).
      'x=7 y=10 width=22 height=25 rx=1.2 fill=#8B0000 stroke=#6B0000 stroke-width=0.6',
      // Cushion inner area + edge highlight.
      'x=9 y=12 width=18 height=21 rx=0.8 fill=#A00000 opacity=0.25',
      'x=8 y=10.5 width=20 height=0.6 rx=0.3 fill=#C00000 opacity=0.3',
      // Left armrest, gold tip, highlight.
      'x=4 y=10 width=3 height=22 rx=0.5 fill=#5C3317 stroke=#4A2810 stroke-width=0.4',
      'cx=5.5 cy=30 r=1.2 fill=#D4AF37 stroke=#B8860B stroke-width=0.3',
      'x=4 y=10 width=0.5 height=22 fill=#7A4E20 opacity=0.4',
      // Right armrest, gold tip, highlight.
      'x=29 y=10 width=3 height=22 rx=0.5 fill=#5C3317 stroke=#4A2810 stroke-width=0.4',
      'cx=30.5 cy=30 r=1.2 fill=#D4AF37 stroke=#B8860B stroke-width=0.3',
      'x=31.5 y=10 width=0.5 height=22 fill=#7A4E20 opacity=0.4',
      // Legs (four corners).
      'x=5 y=4 width=3 height=3 rx=0.3 fill=#4A2810',
      'x=28 y=4 width=3 height=3 rx=0.3 fill=#4A2810',
      'x=5 y=29 width=3 height=3 rx=0.3 fill=#4A2810',
      'x=28 y=29 width=3 height=3 rx=0.3 fill=#4A2810',
    ]);
  });
});
