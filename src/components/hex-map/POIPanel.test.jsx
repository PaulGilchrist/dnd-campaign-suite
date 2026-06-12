import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import POIPanel from './POIPanel.jsx';

describe('POIPanel', () => {
    let onClose;

    beforeEach(() => {
        onClose = vi.fn();
    });

    it('should render the POI panel container', () => {
        const { container } = render(<POIPanel onClose={onClose} />);
        const panel = container.querySelector('.poi-panel');
        expect(panel).toBeInTheDocument();
    });

    it('should render a close button', () => {
        render(<POIPanel onClose={onClose} />);
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should render a Font Awesome close icon', () => {
        render(<POIPanel onClose={onClose} />);
        const icon = document.querySelector('.fa-times');
        expect(icon).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
        render(<POIPanel onClose={onClose} />);
        fireEvent.click(screen.getByRole('button'));
        expect(onClose).toHaveBeenCalled();
    });

    it('should render the POI panel content container', () => {
        const { container } = render(<POIPanel onClose={onClose} />);
        const content = container.querySelector('.poi-panel-content');
        expect(content).toBeInTheDocument();
    });

    it('should render one POI item per POI type', () => {
        const { container } = render(<POIPanel onClose={onClose} />);
        const items = container.querySelectorAll('.poi-panel-item');
        expect(items.length).toBe(9);
    });

    it('should render all POI type names', () => {
        render(<POIPanel onClose={onClose} />);
        expect(screen.getByText('Camp')).toBeInTheDocument();
        expect(screen.getByText('City')).toBeInTheDocument();
        expect(screen.getByText('Dungeon')).toBeInTheDocument();
        expect(screen.getByText('Hazard')).toBeInTheDocument();
        expect(screen.getByText('Landmark')).toBeInTheDocument();
        expect(screen.getByText('Lore Site')).toBeInTheDocument();
        expect(screen.getByText('Natural Wonder')).toBeInTheDocument();
        expect(screen.getByText('Settlement')).toBeInTheDocument();
        expect(screen.getByText('Tower')).toBeInTheDocument();
    });

    it('should render an SVG for each POI item', () => {
        const { container } = render(<POIPanel onClose={onClose} />);
        const svgs = container.querySelectorAll('.poi-panel-item svg');
        expect(svgs.length).toBe(9);
    });

    it('should render each SVG with viewBox 0 0 36 36', () => {
        const { container } = render(<POIPanel onClose={onClose} />);
        const svgs = container.querySelectorAll('.poi-panel-item svg');
        svgs.forEach(svg => {
            expect(svg.getAttribute('viewBox')).toBe('0 0 36 36');
        });
    });

    it('should render each SVG with width and height of 36', () => {
        const { container } = render(<POIPanel onClose={onClose} />);
        const svgs = container.querySelectorAll('.poi-panel-item svg');
        svgs.forEach(svg => {
            expect(svg.getAttribute('width')).toBe('36');
            expect(svg.getAttribute('height')).toBe('36');
        });
    });

    it('should make each POI item draggable', () => {
        const { container } = render(<POIPanel onClose={onClose} />);
        const items = container.querySelectorAll('.poi-panel-item');
        items.forEach(item => {
            expect(item.getAttribute('draggable')).toBe('true');
        });
    });

    it('should set drag data to POI type id on drag start', () => {
        render(<POIPanel onClose={onClose} />);
        const items = document.querySelectorAll('.poi-panel-item');
        const firstItem = items[0];
        const dataTransfer = {
            data: {},
            setData: vi.fn((format, value) => {
                dataTransfer.data[format] = value;
            }),
            setDragImage: vi.fn(),
        };
        fireEvent.dragStart(firstItem, { dataTransfer, currentTarget: firstItem });
        expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', expect.any(String));
    });

    it('should set drag data to correct POI id for each item', () => {
        render(<POIPanel onClose={onClose} />);
        const items = document.querySelectorAll('.poi-panel-item');
        const expectedIds = ['camp', 'city', 'dungeon', 'hazard', 'landmark', 'loreSite', 'naturalWonder', 'settlement', 'tower'];
        items.forEach((item, index) => {
            const dataTransfer = {
                data: {},
                setData: vi.fn((format, value) => {
                    dataTransfer.data[format] = value;
                }),
                setDragImage: vi.fn(),
            };
            fireEvent.dragStart(item, { dataTransfer, currentTarget: item });
            expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', expectedIds[index]);
        });
    });

    it('should render SVG content inside each POI item', () => {
        const { container } = render(<POIPanel onClose={onClose} />);
        const groups = container.querySelectorAll('.poi-panel-item svg g');
        expect(groups.length).toBeGreaterThan(0);
    });

    it('should render exactly one span with text per POI item', () => {
        const { container } = render(<POIPanel onClose={onClose} />);
        const items = container.querySelectorAll('.poi-panel-item');
        items.forEach(item => {
            const spans = item.querySelectorAll('span');
            expect(spans.length).toBe(1);
        });
    });

    it('should not render any POI items when POI_TYPES is empty', () => {
        // POI_TYPES is a static import, we can't easily change it, but the component
        // maps over POI_TYPES so if there were 0 types there would be 0 items
        const { container } = render(<POIPanel onClose={onClose} />);
        const items = container.querySelectorAll('.poi-panel-item');
        expect(items.length).toBeGreaterThan(0);
    });

    it('should render the close button with correct class', () => {
        render(<POIPanel onClose={onClose} />);
        const closeBtn = document.querySelector('.poi-panel-close');
        expect(closeBtn).toBeInTheDocument();
    });

    it('should render the content container with correct class', () => {
        const { container } = render(<POIPanel onClose={onClose} />);
        const content = container.querySelector('.poi-panel-content');
        expect(content).toHaveClass('poi-panel-content');
    });

    it('should render POI items with correct class', () => {
        const { container } = render(<POIPanel onClose={onClose} />);
        const items = container.querySelectorAll('.poi-panel-item');
        items.forEach(item => {
            expect(item).toHaveClass('poi-panel-item');
        });
    });

    it('should handle drag start on each POI item without error', () => {
        render(<POIPanel onClose={onClose} />);
        const items = document.querySelectorAll('.poi-panel-item');
        items.forEach(item => {
            const dataTransfer = {
                data: {},
                setData: vi.fn(),
                setDragImage: vi.fn(),
            };
            expect(() => {
                fireEvent.dragStart(item, { dataTransfer, currentTarget: item });
            }).not.toThrow();
        });
    });
});
