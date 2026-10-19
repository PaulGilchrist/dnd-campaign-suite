// @maintained-by-ai
// SVG asset lane — static decorative token, zero mocks, golden-once.
// Old 12 attr-spie tests -> 3: (1) props/ref forwarding contract,
// (2) element census + inert-click static-art guard, (3) authored-art
// golden: all 48 rect signatures pinned verbatim in DOM order (boxes,
// fills, key strokes, 3 leaning-book transforms). No authored path
// elements in BookshelfSVG.jsx, so the rect golden is the byte pin.
// Open-front orientation is implied by the golden: the lowest frame rect
// is the translucent front edge at y=23.4 — no opaque wood band can
// appear in front of the books without breaking the pinned list.
// No authored interactive variants (no handlers/state/orientation props);
// item rotation lives in PlacedItems' <use href="#bookshelf"> transform,
// pinned by PlacedItems.test.jsx — not duplicated here. Item availability
// pinned by Map.test.jsx; ItemsPanel.test.jsx mocks this leaf.
// Family map: map/*SVG.test.jsx (Altar #890, ArrowSlitWall #891,
// Barrel #892, Bed #893).
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BookshelfSVG from './BookshelfSVG';

describe('BookshelfSVG', () => {
  it('forwards id, className, rest props, and ref to the root <g>', () => {
    const ref = React.createRef();
    const { container } = render(
      <BookshelfSVG id="bookshelf-1" className="custom-bookshelf" data-test="bookshelf-test" ref={ref} />
    );
    const g = container.querySelector('g');
    expect(g).toBeInTheDocument();
    expect(g).toHaveAttribute('id', 'bookshelf-1');
    expect(g).toHaveClass('custom-bookshelf');
    expect(g).toHaveAttribute('data-test', 'bookshelf-test');
    expect(ref.current).toBe(g);
  });

  it('renders the authored element census and stays inert when clicked', () => {
    const { container } = render(<BookshelfSVG />);

    const counts = {
      g: 1,
      rect: 48, // 9 frame/interior/shelf/shadow + 39 books
      'rect[rx="0.3"]': 36, // upright books
      'rect[rx="0.2"]': 3, // leaning books
      'rect[transform]': 3, // one leaning book per row
      'rect[fill="#6B3E1F"]': 3, // back panel + 2 end panels
      'rect[fill="#8B5E3C"]': 4, // top bevel + 2 shelf boards + front edge
      'rect[fill="#4A2810"]': 1, // dark interior behind the books
      'rect[fill="#C0392B"]': 8, // book colors (39 total, all 5 present)
      'rect[fill="#2980B9"]': 9,
      'rect[fill="#27AE60"]': 8,
      'rect[fill="#8E44AD"]': 7,
      'rect[fill="#E67E22"]': 7,
      'rect[fill="#333"]': 1, // floor shadow in front of the open face
    };
    for (const [selector, count] of Object.entries(counts)) {
      expect(container.querySelectorAll(selector), selector).toHaveLength(count);
    }

    // Static art: clicking changes nothing.
    const before = container.innerHTML;
    fireEvent.click(container.querySelector('g'));
    expect(container.innerHTML).toBe(before);
  });

  it('pins all 48 authored rect signatures verbatim in DOM order', () => {
    const { container } = render(<BookshelfSVG />);
    const ATTRS = ['x', 'y', 'width', 'height', 'rx', 'fill', 'stroke', 'stroke-width', 'opacity', 'transform'];
    const sig = (r) => ATTRS
      .filter((a) => r.hasAttribute(a))
      .map((a) => `${a}=${r.getAttribute(a)}`)
      .join(' ');

    expect(Array.from(container.querySelectorAll('rect')).map(sig)).toEqual([
      // Frame: back panel (wall side = top), bevel, interior, shelves, ends.
      'x=2 y=2 width=68 height=7 rx=1 fill=#6B3E1F stroke=#4A2810 stroke-width=0.8',
      'x=2 y=2 width=68 height=1 fill=#8B5E3C opacity=0.5',
      'x=4.5 y=9 width=63 height=14 fill=#4A2810 opacity=0.5',
      'x=4.5 y=13.4 width=63 height=1 fill=#8B5E3C',
      'x=4.5 y=18.4 width=63 height=1 fill=#8B5E3C',
      'x=2 y=2 width=2.5 height=21 fill=#6B3E1F stroke=#4A2810 stroke-width=0.6',
      'x=67.5 y=2 width=2.5 height=21 fill=#6B3E1F stroke=#4A2810 stroke-width=0.6',
      // Row 1: books sitting on the first shelf board (all y >= 9.4,
      // fully in front of the back panel that spans y=2..9).
      'x=5.5 y=10 width=4 height=3.4 rx=0.3 fill=#C0392B',
      'x=10.5 y=9.6 width=3 height=3.8 rx=0.3 fill=#2980B9',
      'x=14.5 y=10 width=5 height=3.4 rx=0.3 fill=#27AE60',
      'x=20.5 y=9.6 width=4 height=3.8 rx=0.3 fill=#8E44AD',
      'x=25.5 y=10 width=3 height=3.4 rx=0.3 fill=#E67E22',
      'x=29.5 y=9.6 width=5 height=3.8 rx=0.3 fill=#C0392B',
      'x=33 y=9.8 width=2 height=3 rx=0.2 fill=#27AE60 transform=rotate(6, 34, 12.8)',
      'x=35.5 y=10 width=4 height=3.4 rx=0.3 fill=#2980B9',
      'x=40.5 y=9.6 width=3 height=3.8 rx=0.3 fill=#27AE60',
      'x=44.5 y=10 width=5 height=3.4 rx=0.3 fill=#8E44AD',
      'x=50.5 y=9.4 width=4 height=4 rx=0.3 fill=#E67E22',
      'x=55.5 y=10 width=3 height=3.4 rx=0.3 fill=#C0392B',
      'x=59.5 y=9.6 width=4 height=3.8 rx=0.3 fill=#2980B9',
      // Row 2: books on the middle shelf.
      'x=6 y=14.6 width=5 height=3.8 rx=0.3 fill=#8E44AD',
      'x=12 y=15 width=3 height=3.4 rx=0.3 fill=#E67E22',
      'x=16 y=14.6 width=4 height=3.8 rx=0.3 fill=#C0392B',
      'x=21 y=15 width=5 height=3.4 rx=0.3 fill=#2980B9',
      'x=24 y=14.2 width=2 height=2.8 rx=0.2 fill=#2980B9 transform=rotate(8, 25, 16.8)',
      'x=27 y=14.6 width=4 height=3.8 rx=0.3 fill=#27AE60',
      'x=32 y=15 width=3 height=3.4 rx=0.3 fill=#8E44AD',
      'x=36 y=14.6 width=5 height=3.8 rx=0.3 fill=#E67E22',
      'x=42 y=15 width=4 height=3.4 rx=0.3 fill=#C0392B',
      'x=47 y=14.6 width=3 height=3.8 rx=0.3 fill=#2980B9',
      'x=51 y=14.6 width=5 height=3.8 rx=0.3 fill=#27AE60',
      'x=57 y=15 width=4 height=3.4 rx=0.3 fill=#8E44AD',
      'x=61.5 y=14.6 width=3 height=3.8 rx=0.3 fill=#E67E22',
      // Row 3: books on the bottom shelf facing the open front.
      'x=5.5 y=19.8 width=4 height=3.6 rx=0.3 fill=#27AE60',
      'x=10.5 y=20.2 width=3 height=3.2 rx=0.3 fill=#C0392B',
      'x=14.5 y=19.8 width=5 height=3.6 rx=0.3 fill=#2980B9',
      'x=20.5 y=20.2 width=4 height=3.2 rx=0.3 fill=#E67E22',
      'x=25.5 y=19.8 width=3 height=3.6 rx=0.3 fill=#8E44AD',
      'x=29.5 y=20.2 width=5 height=3.2 rx=0.3 fill=#C0392B',
      'x=35.5 y=19.8 width=4 height=3.6 rx=0.3 fill=#27AE60',
      'x=40.5 y=20.2 width=3 height=3.2 rx=0.3 fill=#2980B9',
      'x=44.5 y=19.8 width=5 height=3.6 rx=0.3 fill=#E67E22',
      'x=50.5 y=19.8 width=4 height=3.6 rx=0.3 fill=#8E44AD',
      'x=52 y=19.6 width=2 height=3 rx=0.2 fill=#2980B9 transform=rotate(-6, 53, 22.6)',
      'x=55.5 y=20.2 width=3 height=3.2 rx=0.3 fill=#C0392B',
      'x=59.5 y=19.8 width=4 height=3.6 rx=0.3 fill=#27AE60',
      // Open face (room side = bottom edge): thin translucent front edge,
      // then the floor shadow — no opaque wood band in front of the books.
      'x=4.5 y=23.4 width=63 height=1 fill=#8B5E3C opacity=0.6',
      'x=2 y=25 width=68 height=4 rx=0.5 fill=#333 opacity=0.08',
    ]);
  });
});
