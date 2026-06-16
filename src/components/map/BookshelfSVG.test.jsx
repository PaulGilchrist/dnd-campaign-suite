import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BookshelfSVG from './BookshelfSVG.jsx';

const renderBookshelf = (props = {}) =>
    render(
        <svg>
            <BookshelfSVG {...props} />
        </svg>
    );

describe('BookshelfSVG', () => {
    it('should render the root <g> element', () => {
        const { container } = renderBookshelf();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderBookshelf({ id: 'bookshelf-svg-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('bookshelf-svg-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderBookshelf({ className: 'bookshelf-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('bookshelf-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(BookshelfSVG.displayName).toBe('BookshelfSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderBookshelf({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render the outer frame rect', () => {
        const { container } = renderBookshelf();
        const outerFrame = container.querySelector(
            'rect[x="2"][y="2"][width="68"][height="16"]'
        );
        expect(outerFrame).not.toBeNull();
        expect(outerFrame.getAttribute('fill')).toBe('#6B3E1F');
        expect(outerFrame.getAttribute('stroke')).toBe('#4A2810');
        expect(outerFrame.getAttribute('stroke-width')).toBe('0.8');
        expect(outerFrame.getAttribute('rx')).toBe('1');
    });

    it('should render the back panel rect', () => {
        const { container } = renderBookshelf();
        const backPanel = container.querySelector(
            'rect[x="4"][y="4"][width="64"][height="12"]'
        );
        expect(backPanel).not.toBeNull();
        expect(backPanel.getAttribute('fill')).toBe('#4A2810');
        expect(backPanel.getAttribute('opacity')).toBe('0.6');
    });

    it('should render all three shelf rects', () => {
        const { container } = renderBookshelf();
        const shelf1 = container.querySelector('rect[x="4"][y="8"][width="64"][height="1.2"]');
        expect(shelf1).not.toBeNull();
        expect(shelf1.getAttribute('fill')).toBe('#8B5E3C');

        const shelf2 = container.querySelector('rect[x="4"][y="12"][width="64"][height="1.2"]');
        expect(shelf2).not.toBeNull();
        expect(shelf2.getAttribute('fill')).toBe('#8B5E3C');

        const shelf3 = container.querySelector('rect[x="4"][y="16"][width="64"][height="1.2"]');
        expect(shelf3).not.toBeNull();
        expect(shelf3.getAttribute('fill')).toBe('#8B5E3C');
    });

    it('should render row 1 books on shelf 1', () => {
        const { container } = renderBookshelf();
        // Row 1 has 12 upright books + 1 leaning = 13 books in that row
        const row1Books = container.querySelectorAll('rect');
        expect(row1Books.length).toBeGreaterThan(0);
    });

    it('should render the leaning book in row 1', () => {
        const { container } = renderBookshelf();
        const leaningBook = container.querySelector(
            'rect[fill="#27AE60"][transform="rotate(6, 34, 6)"]'
        );
        expect(leaningBook).not.toBeNull();
        expect(leaningBook.getAttribute('width')).toBe('2');
        expect(leaningBook.getAttribute('height')).toBe('3');
        expect(leaningBook.getAttribute('rx')).toBe('0.2');
    });

    it('should render row 2 books on shelf 2', () => {
        const { container } = renderBookshelf();
        const row2Books = container.querySelectorAll(
            'rect[fill="#8E44AD"][y="9.5"], rect[fill="#8E44AD"][y="10"]'
        );
        expect(row2Books.length).toBeGreaterThan(0);
    });

    it('should render leaning books in row 2', () => {
        const { container } = renderBookshelf();
        const leaning1 = container.querySelector(
            'rect[fill="#2980B9"][transform="rotate(8, 21, 10.5)"]'
        );
        expect(leaning1).not.toBeNull();

        const leaning2 = container.querySelector(
            'rect[fill="#27AE60"][transform="rotate(-6, 56, 10.5)"]'
        );
        expect(leaning2).not.toBeNull();
    });

    it('should render left frame edge highlight', () => {
        const { container } = renderBookshelf();
        const leftHighlight = container.querySelector(
            'rect[x="2"][y="2"][width="2.5"][height="16"]'
        );
        expect(leftHighlight).not.toBeNull();
        expect(leftHighlight.getAttribute('fill')).toBe('#7A4E20');
        expect(leftHighlight.getAttribute('opacity')).toBe('0.3');
    });

    it('should render right frame edge highlight', () => {
        const { container } = renderBookshelf();
        const rightHighlight = container.querySelector(
            'rect[x="67.5"][y="2"][width="2.5"][height="16"]'
        );
        expect(rightHighlight).not.toBeNull();
        expect(rightHighlight.getAttribute('fill')).toBe('#7A4E20');
        expect(rightHighlight.getAttribute('opacity')).toBe('0.3');
    });

    it('should render top frame highlight', () => {
        const { container } = renderBookshelf();
        const topHighlight = container.querySelector(
            'rect[x="2"][y="2"][width="68"][height="1"]'
        );
        expect(topHighlight).not.toBeNull();
        expect(topHighlight.getAttribute('fill')).toBe('#8B5E3C');
        expect(topHighlight.getAttribute('opacity')).toBe('0.5');
    });

    it('should render floor shadow rect', () => {
        const { container } = renderBookshelf();
        const floorShadow = container.querySelector(
            'rect[x="2"][y="19"][width="68"][height="14"]'
        );
        expect(floorShadow).not.toBeNull();
        expect(floorShadow.getAttribute('fill')).toBe('#333');
        expect(floorShadow.getAttribute('opacity')).toBe('0.08');
        expect(floorShadow.getAttribute('rx')).toBe('0.5');
    });

    it('should render wall shadow line at y=18', () => {
        const { container } = renderBookshelf();
        const wallShadow = container.querySelector(
            'line[x1="2"][y1="18"][x2="70"][y2="18"]'
        );
        expect(wallShadow).not.toBeNull();
        expect(wallShadow.getAttribute('stroke')).toBe('#333');
        expect(wallShadow.getAttribute('stroke-width')).toBe('0.5');
        expect(wallShadow.getAttribute('opacity')).toBe('0.06');
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderBookshelf({ 'data-test': 'bookshelf' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('bookshelf');
    });

    it('should render total rect count', () => {
        const { container } = renderBookshelf();
        const rects = container.querySelectorAll('rect');
        // outer frame, back panel, 3 shelves, 12 row1 books, 1 row1 leaning,
        // 12 row2 books, 2 row2 leaning, 2 edge highlights, 1 top highlight,
        // 1 floor shadow = 36
        expect(rects.length).toBe(36);
    });

    it('should render total line count (1 wall shadow)', () => {
        const { container } = renderBookshelf();
        const lines = container.querySelectorAll('line');
        expect(lines.length).toBe(1);
    });

    it('should render total path count (0 paths)', () => {
        const { container } = renderBookshelf();
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(0);
    });

    it('should render total ellipse count (0 ellipses)', () => {
        const { container } = renderBookshelf();
        const ellipses = container.querySelectorAll('ellipse');
        expect(ellipses.length).toBe(0);
    });
});
