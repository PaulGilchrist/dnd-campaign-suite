// @maintained-by-ai: 2026-11-05
// Shared "?" placeholder def (mounted in Map.jsx <defs> as #generic-prop) for
// placed-item rows whose `type` has NO sprite art and NO bespoke symbol —
// legacy rows and AI-Dress-invented types (bug-unregistered-placeditem-type-
// invisible-ghost). Sibling map/*SVG.test.jsx lane: static decorative token,
// zero mocks, golden-once. The consumer wiring (ghost dispatch + hit areas)
// is owned by PlacedItems.unknown-type.test.jsx and Map.unknown-item.test.jsx.

import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import GenericPropSVG from './GenericPropSVG.jsx';

describe('GenericPropSVG', () => {
  it('forwards id, className, rest props, and ref to the root <g>', () => {
    const ref = React.createRef();
    const { container } = render(
      <GenericPropSVG id="generic-prop" className="custom-ghost" data-test="ghost" ref={ref} />
    );
    const g = container.querySelector('g');
    expect(g).toBeInTheDocument();
    expect(g).toHaveAttribute('id', 'generic-prop');
    expect(g).toHaveClass('custom-ghost');
    expect(g).toHaveAttribute('data-test', 'ghost');
    expect(ref.current).toBe(g);
  });

  it('renders the authored element census and stays inert when clicked', () => {
    const { container } = render(<GenericPropSVG />);

    const counts = {
      g: 1,
      rect: 1, // dashed placeholder chip
      text: 1, // "?" glyph
      'rect[stroke-dasharray="4 3"]': 1, // the dashed read
      'text[font-size="16"]': 1,
    };
    for (const [selector, count] of Object.entries(counts)) {
      expect(container.querySelectorAll(selector), selector).toHaveLength(count);
    }

    // Static art: clicking changes nothing.
    const before = container.innerHTML;
    fireEvent.click(container.querySelector('g'));
    expect(container.innerHTML).toBe(before);
  });

  it('pins the 2 authored element signatures verbatim in DOM order', () => {
    const { container } = render(<GenericPropSVG />);
    const ATTRS = ['x', 'y', 'width', 'height', 'rx', 'cx', 'cy', 'r', 'd', 'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline'];
    const sig = (el) => ATTRS
      .filter((a) => el.hasAttribute(a))
      .map((a) => `${a}=${el.getAttribute(a)}`)
      .join(' ');

    expect(Array.from(container.querySelectorAll('rect, text')).map(sig)).toEqual([
      // Chip (byte pin).
      'x=3 y=3 width=30 height=30 rx=6 fill=#8A93A6 fill-opacity=0.25 stroke=#C8CFDA stroke-width=1.5 stroke-dasharray=4 3',
      // "?" glyph (byte pin).
      'x=18 y=19 fill=#E2E6EE font-size=16 font-weight=bold text-anchor=middle dominant-baseline=central',
    ]);
  });
});
