import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import POIContextMenu from './POIContextMenu.jsx';

vi.mock('../../config/outdoorConfig.js', () => ({
    HEX_SIZE: 30,
}));

vi.mock('../../services/maps/hexMapUtils.js', () => ({
    hexToPixel: vi.fn((q, r, size) => ({
        x: size * Math.sqrt(3) * (q + r / 2),
        y: size * 3 / 2 * r,
    })),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
    formatMapName: vi.fn((name) => {
        if (!name) return '';
        return name
            .replace(/\.json$/i, '')
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }),
}));

describe('POIContextMenu', () => {
    let props;

    beforeEach(() => {
        props = {
            selectedPoi: { id: 'poi-1', q: 0, r: 0 },
            pois: [
                { id: 'poi-1', type: 'city', q: 0, r: 0, label: 'City A', visible: true, linkedMap: null },
            ],
            onToggleVisibility: vi.fn(),
            onDelete: vi.fn(),
            onRename: vi.fn(),
            onLinkMap: vi.fn(),
            onUnlinkMap: vi.fn(),
            onRemoveRoads: vi.fn(),
            setShowRename: vi.fn(),
            onClose: vi.fn(),
            indoorMaps: [],
            viewPortBounds: null,
            roads: [],
        };
    });

    it('should return null when no selectedPoi', () => {
        const { container } = render(<POIContextMenu {...props} selectedPoi={null} />);
        expect(container.querySelector('.poi-context-menu')).not.toBeInTheDocument();
    });

    it('should return null when selectedPoi not found in pois array', () => {
        const { container } = render(<POIContextMenu {...props} pois={[]} />);
        expect(container.querySelector('.poi-context-menu')).not.toBeInTheDocument();
    });

    it('should render the menu container when selectedPoi exists', () => {
        const { container } = render(<POIContextMenu {...props} />);
        expect(container.querySelector('.poi-context-menu')).toBeInTheDocument();
    });

    it('should render a background rect', () => {
        const { container } = render(<POIContextMenu {...props} />);
        const rects = container.querySelectorAll('rect');
        expect(rects.length).toBeGreaterThan(0);
    });

    it('should render Hide option when POI is visible', () => {
        render(<POIContextMenu {...props} pois={[{ ...props.pois[0], visible: true }]} />);
        expect(screen.getByText('Hide')).toBeInTheDocument();
    });

    it('should render Show option when POI is hidden', () => {
        render(<POIContextMenu {...props} pois={[{ ...props.pois[0], visible: false }]} />);
        expect(screen.getByText('Show')).toBeInTheDocument();
    });

    it('should render Rename option', () => {
        render(<POIContextMenu {...props} />);
        expect(screen.getByText('Rename')).toBeInTheDocument();
    });

    it('should render Link to Map... when POI has no linked map', () => {
        render(<POIContextMenu {...props} pois={[{ ...props.pois[0], linkedMap: null }]} />);
        expect(screen.getByText('Link to Map...')).toBeInTheDocument();
    });

    it('should render Unlink Map with formatted name when POI has a linked map', () => {
        render(<POIContextMenu {...props} pois={[{ ...props.pois[0], linkedMap: 'dungeon-map.json' }]} />);
        expect(screen.getByText(/Unlink Map/)).toBeInTheDocument();
    });

    it('should render Delete option', () => {
        render(<POIContextMenu {...props} />);
        expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('should not render Remove Roads when no roads connected', () => {
        render(<POIContextMenu {...props} roads={[]} />);
        expect(screen.queryByText(/Remove Roads/)).not.toBeInTheDocument();
    });

    it('should render Remove Roads when roads are connected', () => {
        const roads = [
            { fromPoiId: 'poi-1', toPoiId: 'poi-2' },
            { fromPoiId: 'poi-3', toPoiId: 'poi-1' },
        ];
        render(<POIContextMenu {...props} roads={roads} />);
        expect(screen.getByText('Remove Roads (2)')).toBeInTheDocument();
    });

    it('should not render Remove Roads for unrelated roads', () => {
        const roads = [
            { fromPoiId: 'poi-2', toPoiId: 'poi-3' },
        ];
        render(<POIContextMenu {...props} roads={roads} />);
        expect(screen.queryByText(/Remove Roads/)).not.toBeInTheDocument();
    });

    it('should render close button', () => {
        render(<POIContextMenu {...props} />);
        const closeBtn = document.querySelector('text.menu-close');
        expect(closeBtn).toBeInTheDocument();
    });

    it('should call onToggleVisibility and onClose when Hide is clicked', () => {
        render(<POIContextMenu {...props} pois={[{ ...props.pois[0], visible: true }]} />);
        fireEvent.click(screen.getByText('Hide'));
        expect(props.onToggleVisibility).toHaveBeenCalledWith('poi-1');
        expect(props.onClose).toHaveBeenCalled();
    });

    it('should call onToggleVisibility and onClose when Show is clicked', () => {
        render(<POIContextMenu {...props} pois={[{ ...props.pois[0], visible: false }]} />);
        fireEvent.click(screen.getByText('Show'));
        expect(props.onToggleVisibility).toHaveBeenCalledWith('poi-1');
        expect(props.onClose).toHaveBeenCalled();
    });

    it('should call setShowRename when Rename is clicked', () => {
        render(<POIContextMenu {...props} />);
        fireEvent.click(screen.getByText('Rename'));
        expect(props.setShowRename).toHaveBeenCalledWith('poi-1');
    });

    it('should call onDelete and onClose when Delete is clicked', () => {
        render(<POIContextMenu {...props} />);
        fireEvent.click(screen.getByText('Delete'));
        expect(props.onDelete).toHaveBeenCalledWith('poi-1');
        expect(props.onClose).toHaveBeenCalled();
    });

    it('should call onUnlinkMap and onClose when Unlink Map is clicked', () => {
        render(<POIContextMenu {...props} pois={[{ ...props.pois[0], linkedMap: 'dungeon-map.json' }]} />);
        fireEvent.click(screen.getByText(/Unlink Map/));
        expect(props.onUnlinkMap).toHaveBeenCalledWith('poi-1');
        expect(props.onClose).toHaveBeenCalled();
    });

    it('should call onRemoveRoads and onClose when Remove Roads is clicked', () => {
        const roads = [{ fromPoiId: 'poi-1', toPoiId: 'poi-2' }];
        render(<POIContextMenu {...props} roads={roads} />);
        fireEvent.click(screen.getByText('Remove Roads (1)'));
        expect(props.onRemoveRoads).toHaveBeenCalledWith('poi-1');
        expect(props.onClose).toHaveBeenCalled();
    });

    it('should call onClose when close button is clicked', () => {
        render(<POIContextMenu {...props} />);
        fireEvent.click(document.querySelector('text.menu-close'));
        expect(props.onClose).toHaveBeenCalled();
    });

    it('should stop propagation on click of menu container', () => {
        render(<POIContextMenu {...props} />);
        const menu = document.querySelector('.poi-context-menu');
        const event = new MouseEvent('click', { bubbles: true });
        const stopSpy = vi.spyOn(event, 'stopPropagation');
        menu.dispatchEvent(event);
        expect(stopSpy).toHaveBeenCalled();
    });

    it('should show link picker when Link to Map is clicked', () => {
        const indoorMaps = ['dungeon-map.json', 'cave-map.json'];
        render(<POIContextMenu {...props} indoorMaps={indoorMaps} pois={[{ ...props.pois[0], linkedMap: null }]} />);
        fireEvent.click(screen.getByText('Link to Map...'));
        expect(screen.getByText('Dungeon Map')).toBeInTheDocument();
    });

    it('should show no indoor maps message when picker open and no maps available', () => {
        render(<POIContextMenu {...props} indoorMaps={[]} pois={[{ ...props.pois[0], linkedMap: null }]} />);
        fireEvent.click(screen.getByText('Link to Map...'));
        expect(screen.getByText('No indoor maps available')).toBeInTheDocument();
    });

    it('should call onLinkMap, setShowLinkPicker false, and onClose when a map is selected', () => {
        const indoorMaps = ['dungeon-map.json'];
        render(<POIContextMenu {...props} indoorMaps={indoorMaps} pois={[{ ...props.pois[0], linkedMap: null }]} />);
        fireEvent.click(screen.getByText('Link to Map...'));
        fireEvent.click(screen.getByText('Dungeon Map'));
        expect(props.onLinkMap).toHaveBeenCalledWith('poi-1', 'dungeon-map.json');
        expect(props.onClose).toHaveBeenCalled();
    });

    it('should show rename input when showRename matches selectedPoi.id', () => {
        render(<POIContextMenu {...props} showRename="poi-1" />);
        const input = document.querySelector('.context-menu-input');
        expect(input).toBeInTheDocument();
        expect(input.value).toBe('City A');
    });

    it('should not show rename input when showRename does not match', () => {
        render(<POIContextMenu {...props} showRename="poi-2" />);
        const input = document.querySelector('.context-menu-input');
        expect(input).not.toBeInTheDocument();
    });

    it('should call onRename and onClose when rename input fires Enter key', () => {
        render(<POIContextMenu {...props} showRename="poi-1" />);
        const input = document.querySelector('.context-menu-input');
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(props.onRename).toHaveBeenCalledWith('poi-1', 'City A');
        expect(props.onClose).toHaveBeenCalled();
    });

    it('should call onRename and onClose when rename input blurs', () => {
        render(<POIContextMenu {...props} showRename="poi-1" />);
        const input = document.querySelector('.context-menu-input');
        fireEvent.blur(input);
        expect(props.onRename).toHaveBeenCalledWith('poi-1', 'City A');
        expect(props.onClose).toHaveBeenCalled();
    });

    it('should clamp menu position to viewport bounds when provided', () => {
        const viewPortBounds = { left: 0, top: 0, right: 200, bottom: 200 };
        const { container } = render(<POIContextMenu {...props} viewPortBounds={viewPortBounds} />);
        const rect = container.querySelector('rect[fill="#2a2a2a"]');
        expect(rect).toBeInTheDocument();
    });

    it('should render with correct menu width of 160', () => {
        const { container } = render(<POIContextMenu {...props} />);
        const rect = container.querySelector('rect[fill="#2a2a2a"]');
        expect(rect.getAttribute('width')).toBe('160');
    });

    it('should render 4 menu rows when no linked map and no roads', () => {
        const { container } = render(<POIContextMenu {...props} pois={[{ ...props.pois[0], linkedMap: null }]} roads={[]} />);
        const menuTexts = container.querySelectorAll('text.menu-option');
        expect(menuTexts.length).toBe(4);
    });

    it('should render 4 menu rows when POI has linked map but no roads', () => {
        const { container } = render(<POIContextMenu {...props} pois={[{ ...props.pois[0], linkedMap: 'map.json' }]} roads={[]} />);
        const menuTexts = container.querySelectorAll('text.menu-option');
        expect(menuTexts.length).toBe(4);
    });

    it('should render 5 menu rows when POI has roads but no linked map', () => {
        const roads = [{ fromPoiId: 'poi-1', toPoiId: 'poi-2' }];
        const { container } = render(<POIContextMenu {...props} pois={[{ ...props.pois[0], linkedMap: null }]} roads={roads} />);
        const menuTexts = container.querySelectorAll('text.menu-option');
        expect(menuTexts.length).toBe(5);
    });

    it('should render 5 menu rows when POI has both linked map and roads', () => {
        const roads = [{ fromPoiId: 'poi-1', toPoiId: 'poi-2' }];
        const { container } = render(<POIContextMenu {...props} pois={[{ ...props.pois[0], linkedMap: 'map.json' }]} roads={roads} />);
        const menuTexts = container.querySelectorAll('text.menu-option');
        expect(menuTexts.length).toBe(5);
    });

    it('should limit link picker to 6 maps', () => {
        const indoorMaps = ['map1.json', 'map2.json', 'map3.json', 'map4.json', 'map5.json', 'map6.json', 'map7.json', 'map8.json'];
        render(<POIContextMenu {...props} indoorMaps={indoorMaps} pois={[{ ...props.pois[0], linkedMap: null }]} />);
        fireEvent.click(screen.getByText('Link to Map...'));
        // Should have: Hide, Rename, Link to Map..., 6 map items, Delete = 10 text elements
        // But we check that only 6 maps are shown
        const mapNames = [...document.querySelectorAll('text.menu-option')].map(t => t.textContent);
        const mapCount = mapNames.filter(n => n.startsWith('Map')).length;
        expect(mapCount).toBe(6);
    });

    it('should not crash when roads is undefined', () => {
        const { container } = render(<POIContextMenu {...props} roads={undefined} />);
        expect(container.querySelector('.poi-context-menu')).toBeInTheDocument();
    });

    it('should not crash when indoorMaps is undefined', () => {
        const { container } = render(<POIContextMenu {...props} indoorMaps={undefined} />);
        expect(container.querySelector('.poi-context-menu')).toBeInTheDocument();
    });

    it('should use POI label as input default value', () => {
        render(<POIContextMenu {...props} showRename="poi-1" pois={[{ ...props.pois[0], label: 'Custom Label' }]} />);
        const input = document.querySelector('.context-menu-input');
        expect(input.value).toBe('Custom Label');
    });

    it('should use empty string as input default when POI has no label', () => {
        render(<POIContextMenu {...props} showRename="poi-1" pois={[{ ...props.pois[0], label: '' }]} />);
        const input = document.querySelector('.context-menu-input');
        expect(input.value).toBe('');
    });


    it('should render Unlink Map text in orange color', () => {
        render(<POIContextMenu {...props} pois={[{ ...props.pois[0], linkedMap: 'dungeon-map.json' }]} />);
        const unlinkText = [...document.querySelectorAll('text.menu-option')].find(t => t.textContent.includes('Unlink Map'));
        expect(unlinkText.getAttribute('fill')).toBe('#e8a040');
    });

    it('should render Remove Roads text in orange color', () => {
        const roads = [{ fromPoiId: 'poi-1', toPoiId: 'poi-2' }];
        render(<POIContextMenu {...props} roads={roads} />);
        const removeText = [...document.querySelectorAll('text.menu-option')].find(t => t.textContent.includes('Remove Roads'));
        expect(removeText.getAttribute('fill')).toBe('#e8a040');
    });

    it('should render Hide and Rename text in gray color', () => {
        render(<POIContextMenu {...props} />);
        const hideText = [...document.querySelectorAll('text.menu-option')].find(t => t.textContent === 'Hide');
        const renameText = [...document.querySelectorAll('text.menu-option')].find(t => t.textContent === 'Rename');
        expect(hideText.getAttribute('fill')).toBe('#ccc');
        expect(renameText.getAttribute('fill')).toBe('#ccc');
    });

    it('should render Delete text in gray color', () => {
        render(<POIContextMenu {...props} />);
        const deleteText = [...document.querySelectorAll('text.menu-option')].find(t => t.textContent === 'Delete');
        expect(deleteText.getAttribute('fill')).toBe('#ccc');
    });

    it('should render picker background when link picker is open', () => {
        const indoorMaps = ['dungeon-map.json'];
        render(<POIContextMenu {...props} indoorMaps={indoorMaps} pois={[{ ...props.pois[0], linkedMap: null }]} />);
        fireEvent.click(screen.getByText('Link to Map...'));
        const pickerBg = document.querySelector('rect[fill="#383838"]');
        expect(pickerBg).toBeInTheDocument();
    });

    it('should render close button with gray color', () => {
        render(<POIContextMenu {...props} />);
        const closeBtn = document.querySelector('text.menu-close');
        expect(closeBtn.getAttribute('fill')).toBe('#999');
    });

    it('should render close button with fontSize 10', () => {
        render(<POIContextMenu {...props} />);
        const closeBtn = document.querySelector('text.menu-close');
        expect(closeBtn.getAttribute('font-size')).toBe('10');
    });

    it('should render menu options with fontSize 11', () => {
        render(<POIContextMenu {...props} />);
        const menuOptions = document.querySelectorAll('text.menu-option');
        menuOptions.forEach(opt => {
            expect(opt.getAttribute('font-size')).toBe('11');
        });
    });

    it('should render background rect with dark fill and gray stroke', () => {
        const { container } = render(<POIContextMenu {...props} />);
        const bgRect = container.querySelector('rect[fill="#2a2a2a"]');
        expect(bgRect.getAttribute('stroke')).toBe('#555');
        expect(bgRect.getAttribute('stroke-width')).toBe('1');
    });

    it('should render rect with rx="4" for rounded corners', () => {
        const { container } = render(<POIContextMenu {...props} />);
        const bgRect = container.querySelector('rect[fill="#2a2a2a"]');
        expect(bgRect.getAttribute('rx')).toBe('4');
    });

    it('should render picker background rect with rx="2" for rounded corners', () => {
        const indoorMaps = ['dungeon-map.json'];
        render(<POIContextMenu {...props} indoorMaps={indoorMaps} pois={[{ ...props.pois[0], linkedMap: null }]} />);
        fireEvent.click(screen.getByText('Link to Map...'));
        const pickerBg = document.querySelector('rect[fill="#383838"]');
        expect(pickerBg.getAttribute('rx')).toBe('2');
    });
});
