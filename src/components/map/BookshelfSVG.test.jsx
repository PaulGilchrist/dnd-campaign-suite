// @improved-by-ai
import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BookshelfSVG from './BookshelfSVG';

const BOOK_COLORS = new Set(['#C0392B', '#2980B9', '#27AE60', '#8E44AD', '#E67E22']);

describe('BookshelfSVG', () => {
  describe('root group element', () => {
    it('renders a <g> element with id, className, rest props, and ref', () => {
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
  });

  describe('back panel (wall side = top edge)', () => {
    it('renders a thick wood back panel along the top edge', () => {
      const { container } = render(<BookshelfSVG />);
      const back = container.querySelector('rect[x="2"][y="2"][width="68"][height="7"]');
      expect(back).toBeInTheDocument();
      expect(back).toHaveAttribute('rx', '1');
      expect(back).toHaveAttribute('fill', '#6B3E1F');
      expect(back).toHaveAttribute('stroke', '#4A2810');
      expect(back).toHaveAttribute('stroke-width', '0.8');
    });

    it('renders a dark interior behind the books', () => {
      const { container } = render(<BookshelfSVG />);
      const interior = container.querySelector('rect[x="4.5"][y="9"][width="63"][height="14"]');
      expect(interior).toBeInTheDocument();
      expect(interior).toHaveAttribute('fill', '#4A2810');
      expect(interior).toHaveAttribute('opacity', '0.5');
    });
  });

  describe('shelves', () => {
    it('renders 2 shelf boards inside the frame', () => {
      const { container } = render(<BookshelfSVG />);
      const shelves = container.querySelectorAll('rect[x="4.5"][width="63"][height="1"][fill="#8B5E3C"]:not([opacity])');
      expect(shelves).toHaveLength(2);
      const shelfYs = Array.from(shelves).map((s) => s.getAttribute('y'));
      expect(shelfYs).toContain('13.4');
      expect(shelfYs).toContain('18.4');
    });

    it('renders left and right end panels', () => {
      const { container } = render(<BookshelfSVG />);
      const ends = container.querySelectorAll('rect[y="2"][width="2.5"][height="21"][fill="#6B3E1F"]');
      expect(ends).toHaveLength(2);
      const endXs = Array.from(ends).map((e) => e.getAttribute('x'));
      expect(endXs).toContain('2');
      expect(endXs).toContain('67.5');
    });
  });

  describe('books', () => {
    const uprightBooks = (container) =>
      Array.from(container.querySelectorAll('rect[rx="0.3"]'))
        .filter((r) => BOOK_COLORS.has(r.getAttribute('fill')));

    it('renders 12 upright books in each of 3 rows', () => {
      const { container } = render(<BookshelfSVG />);
      const books = uprightBooks(container);
      const row1 = books.filter((b) => Number(b.getAttribute('y')) >= 9 && Number(b.getAttribute('y')) < 13.5);
      const row2 = books.filter((b) => Number(b.getAttribute('y')) >= 14 && Number(b.getAttribute('y')) < 18.5);
      const row3 = books.filter((b) => Number(b.getAttribute('y')) >= 19 && Number(b.getAttribute('y')) < 23.5);
      expect(row1).toHaveLength(12);
      expect(row2).toHaveLength(12);
      expect(row3).toHaveLength(12);
    });

    it('renders all upright books in front of the back panel, facing the room', () => {
      const { container } = render(<BookshelfSVG />);
      const books = uprightBooks(container);
      expect(books.length).toBe(36);
      const backPanelBottom = 9; // back panel spans y=2..9
      books.forEach((b) => {
        expect(Number(b.getAttribute('y'))).toBeGreaterThanOrEqual(backPanelBottom);
      });
    });

    it('renders 3 leaning books, one per row', () => {
      const { container } = render(<BookshelfSVG />);
      const leaning = container.querySelectorAll('rect[rx="0.2"]');
      expect(leaning).toHaveLength(3);
      expect(leaning[0]).toHaveAttribute('transform', 'rotate(6, 34, 12.8)');
      expect(leaning[1]).toHaveAttribute('transform', 'rotate(8, 25, 16.8)');
      expect(leaning[2]).toHaveAttribute('transform', 'rotate(-6, 53, 22.6)');
    });

    it('renders books in all 5 colors', () => {
      const { container } = render(<BookshelfSVG />);
      const colors = new Set(uprightBooks(container).map((b) => b.getAttribute('fill')));
      BOOK_COLORS.forEach((c) => expect(colors.has(c)).toBe(true));
    });
  });

  describe('open front (room side = bottom edge)', () => {
    it('has no wood band in front of the books', () => {
      const { container } = render(<BookshelfSVG />);
      const woodRects = Array.from(container.querySelectorAll('rect[fill="#6B3E1F"]'));
      woodRects.forEach((r) => {
        const bottom = Number(r.getAttribute('y')) + Number(r.getAttribute('height'));
        expect(bottom).toBeLessThanOrEqual(23.5);
      });
    });

    it('renders only a thin front edge at the open face', () => {
      const { container } = render(<BookshelfSVG />);
      const frontEdge = container.querySelector('rect[x="4.5"][y="23.4"][width="63"][height="1"]');
      expect(frontEdge).toBeInTheDocument();
      expect(frontEdge).toHaveAttribute('fill', '#8B5E3C');
      expect(frontEdge).toHaveAttribute('opacity', '0.6');
    });
  });

  describe('shadow', () => {
    it('renders a floor shadow in front of the open face', () => {
      const { container } = render(<BookshelfSVG />);
      const floorShadow = container.querySelector('rect[x="2"][y="25"][width="68"][height="4"]');
      expect(floorShadow).toBeInTheDocument();
      expect(floorShadow).toHaveAttribute('rx', '0.5');
      expect(floorShadow).toHaveAttribute('fill', '#333');
      expect(floorShadow).toHaveAttribute('opacity', '0.08');
    });
  });
});

// @cleaned-by-ai
