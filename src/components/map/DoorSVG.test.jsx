// @maintained-by-ai
// SVG asset lane — static decorative token, zero mocks, golden-once.
// Old 4 attr-spie tests -> 3: (1) props/ref forwarding contract,
// (2) element census + inert-click static-art guard, (3) authored-art
// golden: all 4 child element signatures pinned verbatim in DOM order
// (body rect + 2 grain lines + highlight rect).
// No authored interactive variants (no handlers/state props in
// DoorSVG.jsx); door open/closed panes and rotation live in PlacedItems'
// renderDoor/<use href="#door"> lane, pinned by PlacedItems.test.jsx, and
// the Open/Close menu entry by ItemContextMenu.test.jsx — not duplicated
// here. Icon availability pinned by Map.test.jsx; ItemsPanel.test.jsx
// mocks this leaf. Family map: map/*SVG.test.jsx (Altar #890,
// ArrowSlitWall #891, Barrel #892, Bed #893, Bookshelf #894,
// Boulder #895, Bush #896, Chair #897).
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DoorSVG from './DoorSVG.jsx';

describe('DoorSVG', () => {
  it('forwards id, className, rest props, and ref to the root <g>', () => {
    const ref = React.createRef();
    const { container } = render(
      <DoorSVG id="door-1" className="custom-door" data-test="door-test" ref={ref} />
    );
    const g = container.querySelector('g');
    expect(g).toBeInTheDocument();
    expect(g).toHaveAttribute('id', 'door-1');
    expect(g).toHaveClass('custom-door');
    expect(g).toHaveAttribute('data-test', 'door-test');
    expect(ref.current).toBe(g);
  });

  it('renders the authored element census and stays inert when clicked', () => {
    const { container } = render(<DoorSVG />);

    const counts = {
      g: 1,
      rect: 2, // board body + highlight edge
      line: 2, // wood grain streaks
      'rect[fill="#8B5A2B"]': 1, // board body
      'rect[fill="#A0652D"]': 1, // highlight edge
      'line[stroke="#6B3E1F"]': 2, // grain lines
    };
    for (const [selector, count] of Object.entries(counts)) {
      expect(container.querySelectorAll(selector), selector).toHaveLength(count);
    }

    // Static art: clicking changes nothing.
    const before = container.innerHTML;
    fireEvent.click(container.querySelector('g'));
    expect(container.innerHTML).toBe(before);
  });

  it('pins all 4 authored element signatures verbatim in DOM order', () => {
    const { container } = render(<DoorSVG />);
    const ATTRS = ['x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'fill', 'stroke', 'stroke-width', 'opacity'];
    const sig = (el) => ATTRS
      .filter((a) => el.hasAttribute(a))
      .map((a) => `${a}=${el.getAttribute(a)}`)
      .join(' ');

    expect(Array.from(container.querySelectorAll('rect, line')).map(sig)).toEqual([
      // Board body.
      'x=15 y=0 width=6 height=36 fill=#8B5A2B',
      // Grain lines (subtle darker streaks).
      'x1=16.5 y1=0 x2=16.5 y2=36 stroke=#6B3E1F stroke-width=0.3 opacity=0.5',
      'x1=19.5 y1=0 x2=19.5 y2=36 stroke=#6B3E1F stroke-width=0.3 opacity=0.5',
      // Highlight edge (lighter side for subtle 3D).
      'x=15 y=0 width=0.5 height=36 fill=#A0652D opacity=0.6',
    ]);
  });
});
