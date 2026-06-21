// @improved-by-ai
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
    describe('root element and props passthrough', () => {
        it('renders the root <g> element', () => {
            const { container } = renderBookshelf();
            expect(container.querySelector('g')).toBeInTheDocument();
        });

        it('applies the given id to the root group', () => {
            const { container } = renderBookshelf({ id: 'bookshelf-svg-1' });
            expect(container.querySelector('g#bookshelf-svg-1')).toBeInTheDocument();
        });

        it('applies the given className to the root group', () => {
            const { container } = renderBookshelf({ className: 'bookshelf-custom' });
            expect(container.querySelector('g')).toHaveClass('bookshelf-custom');
        });

        it('passes through rest props to the root group', () => {
            const { container } = renderBookshelf({ 'data-test': 'bookshelf' });
            expect(container.querySelector('[data-test="bookshelf"]')).toBeInTheDocument();
        });
    });

    describe('component metadata', () => {
        it('has the correct displayName', () => {
            expect(BookshelfSVG.displayName).toBe('BookshelfSVG');
        });

        it('renders as a forwardRef component', () => {
            const ref = vi.fn();
            renderBookshelf({ ref });
            expect(ref).toHaveBeenCalled();
        });
    });

    describe('frame structure', () => {
        it('renders the outer frame rect with correct attributes', () => {
            const { container } = renderBookshelf();
            const outerFrame = container.querySelector(
                'rect[x="2"][y="2"][width="68"][height="16"]'
            );
            expect(outerFrame).toBeInTheDocument();
            expect(outerFrame).toHaveAttribute('fill', '#6B3E1F');
            expect(outerFrame).toHaveAttribute('stroke', '#4A2810');
            expect(outerFrame).toHaveAttribute('stroke-width', '0.8');
            expect(outerFrame).toHaveAttribute('rx', '1');
        });

        it('renders the back panel rect with correct attributes', () => {
            const { container } = renderBookshelf();
            const backPanel = container.querySelector(
                'rect[x="4"][y="4"][width="64"][height="12"]'
            );
            expect(backPanel).toBeInTheDocument();
            expect(backPanel).toHaveAttribute('fill', '#4A2810');
            expect(backPanel).toHaveAttribute('opacity', '0.6');
        });

        it('renders the left frame edge highlight', () => {
            const { container } = renderBookshelf();
            const leftHighlight = container.querySelector(
                'rect[x="2"][y="2"][width="2.5"][height="16"]'
            );
            expect(leftHighlight).toBeInTheDocument();
            expect(leftHighlight).toHaveAttribute('fill', '#7A4E20');
            expect(leftHighlight).toHaveAttribute('opacity', '0.3');
        });

        it('renders the right frame edge highlight', () => {
            const { container } = renderBookshelf();
            const rightHighlight = container.querySelector(
                'rect[x="67.5"][y="2"][width="2.5"][height="16"]'
            );
            expect(rightHighlight).toBeInTheDocument();
            expect(rightHighlight).toHaveAttribute('fill', '#7A4E20');
            expect(rightHighlight).toHaveAttribute('opacity', '0.3');
        });

        it('renders the top frame highlight', () => {
            const { container } = renderBookshelf();
            const topHighlight = container.querySelector(
                'rect[x="2"][y="2"][width="68"][height="1"]'
            );
            expect(topHighlight).toBeInTheDocument();
            expect(topHighlight).toHaveAttribute('fill', '#8B5E3C');
            expect(topHighlight).toHaveAttribute('opacity', '0.5');
        });
    });

    describe('shelves', () => {
        it('renders all three shelf rects with correct fill', () => {
            const { container } = renderBookshelf();
            const shelves = container.querySelectorAll('rect[fill="#8B5E3C"]');
            expect(shelves.length).toBeGreaterThanOrEqual(3);
        });

        it('renders shelf 1 at y=8', () => {
            const { container } = renderBookshelf();
            const shelf1 = container.querySelector('rect[x="4"][y="8"][width="64"][height="1.2"]');
            expect(shelf1).toBeInTheDocument();
            expect(shelf1).toHaveAttribute('fill', '#8B5E3C');
        });

        it('renders shelf 2 at y=12', () => {
            const { container } = renderBookshelf();
            const shelf2 = container.querySelector('rect[x="4"][y="12"][width="64"][height="1.2"]');
            expect(shelf2).toBeInTheDocument();
            expect(shelf2).toHaveAttribute('fill', '#8B5E3C');
        });

        it('renders shelf 3 at y=16', () => {
            const { container } = renderBookshelf();
            const shelf3 = container.querySelector('rect[x="4"][y="16"][width="64"][height="1.2"]');
            expect(shelf3).toBeInTheDocument();
            expect(shelf3).toHaveAttribute('fill', '#8B5E3C');
        });
    });

    describe('books', () => {
        it('renders row 1 books on shelf 1', () => {
            const { container } = renderBookshelf();
            const row1Books = container.querySelectorAll('rect');
            expect(row1Books.length).toBeGreaterThan(0);
        });

        it('renders the leaning book in row 1', () => {
            const { container } = renderBookshelf();
            const leaningBook = container.querySelector(
                'rect[fill="#27AE60"][transform="rotate(6, 34, 6)"]'
            );
            expect(leaningBook).toBeInTheDocument();
            expect(leaningBook).toHaveAttribute('width', '2');
            expect(leaningBook).toHaveAttribute('height', '3');
            expect(leaningBook).toHaveAttribute('rx', '0.2');
        });

        it('renders row 2 books on shelf 2', () => {
            const { container } = renderBookshelf();
            const row2Books = container.querySelectorAll(
                'rect[fill="#8E44AD"][y="9.5"], rect[fill="#8E44AD"][y="10"]'
            );
            expect(row2Books.length).toBeGreaterThan(0);
        });

        it('renders leaning books in row 2', () => {
            const { container } = renderBookshelf();
            const leaning1 = container.querySelector(
                'rect[fill="#2980B9"][transform="rotate(8, 21, 10.5)"]'
            );
            expect(leaning1).toBeInTheDocument();

            const leaning2 = container.querySelector(
                'rect[fill="#27AE60"][transform="rotate(-6, 56, 10.5)"]'
            );
            expect(leaning2).toBeInTheDocument();
        });
    });

    describe('shadows', () => {
        it('renders floor shadow rect with correct attributes', () => {
            const { container } = renderBookshelf();
            const floorShadow = container.querySelector(
                'rect[x="2"][y="19"][width="68"][height="14"]'
            );
            expect(floorShadow).toBeInTheDocument();
            expect(floorShadow).toHaveAttribute('fill', '#333');
            expect(floorShadow).toHaveAttribute('opacity', '0.08');
            expect(floorShadow).toHaveAttribute('rx', '0.5');
        });

        it('renders wall shadow line at y=18', () => {
            const { container } = renderBookshelf();
            const wallShadow = container.querySelector(
                'line[x1="2"][y1="18"][x2="70"][y2="18"]'
            );
            expect(wallShadow).toBeInTheDocument();
            expect(wallShadow).toHaveAttribute('stroke', '#333');
            expect(wallShadow).toHaveAttribute('stroke-width', '0.5');
            expect(wallShadow).toHaveAttribute('opacity', '0.06');
        });
    });

    describe('element counts', () => {
        it('renders at least 36 rect elements', () => {
            const { container } = renderBookshelf();
            const rects = container.querySelectorAll('rect');
            expect(rects.length).toBeGreaterThanOrEqual(36);
        });

        it('renders at least 1 line element', () => {
            const { container } = renderBookshelf();
            const lines = container.querySelectorAll('line');
            expect(lines.length).toBeGreaterThanOrEqual(1);
        });

        it('renders no path elements', () => {
            const { container } = renderBookshelf();
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(0);
        });

        it('renders no ellipse elements', () => {
            const { container } = renderBookshelf();
            const ellipses = container.querySelectorAll('ellipse');
            expect(ellipses.length).toBe(0);
        });
    });
});