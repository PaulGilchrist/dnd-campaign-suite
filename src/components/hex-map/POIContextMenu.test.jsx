// @improved-by-ai
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

    function renderMenu(overrideProps = {}) {
        return render(<POIContextMenu {...props} {...overrideProps} />);
    }

    describe('rendering', () => {
        it('should return null when no selectedPoi', () => {
            const { container } = renderMenu({ selectedPoi: null });
            expect(container.querySelector('.poi-context-menu')).not.toBeInTheDocument();
        });

        it('should return null when selectedPoi is not found in pois array', () => {
            const { container } = renderMenu({ pois: [] });
            expect(container.querySelector('.poi-context-menu')).not.toBeInTheDocument();
        });

        it('should render the menu container when selectedPoi exists', () => {
            const { container } = renderMenu();
            expect(container.querySelector('.poi-context-menu')).toBeInTheDocument();
        });

        it('should render Hide option when POI is visible', () => {
            renderMenu({ pois: [{ ...props.pois[0], visible: true }] });
            expect(screen.getByText('Hide')).toBeInTheDocument();
        });

        it('should render Show option when POI is hidden', () => {
            renderMenu({ pois: [{ ...props.pois[0], visible: false }] });
            expect(screen.getByText('Show')).toBeInTheDocument();
        });

        it('should render Rename option', () => {
            renderMenu();
            expect(screen.getByText('Rename')).toBeInTheDocument();
        });

        it('should render Delete option', () => {
            renderMenu();
            expect(screen.getByText('Delete')).toBeInTheDocument();
        });

        it('should not render Remove Roads when no roads connected', () => {
            renderMenu({ roads: [] });
            expect(screen.queryByText(/Remove Roads/)).not.toBeInTheDocument();
        });

        it('should not render Remove Roads for unrelated roads', () => {
            renderMenu({ roads: [{ fromPoiId: 'poi-2', toPoiId: 'poi-3' }] });
            expect(screen.queryByText(/Remove Roads/)).not.toBeInTheDocument();
        });

        it('should render close button', () => {
            renderMenu();
            expect(document.querySelector('text.menu-close')).toBeInTheDocument();
        });
    });

    describe('menu options', () => {
        it('should render correct options when POI has no linked map and no roads', () => {
            renderMenu({ pois: [{ ...props.pois[0], linkedMap: null }], roads: [] });
            expect(screen.getByText('Hide')).toBeInTheDocument();
            expect(screen.getByText('Rename')).toBeInTheDocument();
            expect(screen.getByText('Link to Map...')).toBeInTheDocument();
            expect(screen.getByText('Delete')).toBeInTheDocument();
            expect(screen.queryByText(/Remove Roads/)).not.toBeInTheDocument();
        });

        it('should render correct options when POI has a linked map but no roads', () => {
            renderMenu({ pois: [{ ...props.pois[0], linkedMap: 'dungeon-map.json' }], roads: [] });
            expect(screen.getByText('Hide')).toBeInTheDocument();
            expect(screen.getByText('Rename')).toBeInTheDocument();
            expect(screen.getByText(/Unlink Map/)).toBeInTheDocument();
            expect(screen.getByText('Delete')).toBeInTheDocument();
            expect(screen.queryByText(/Remove Roads/)).not.toBeInTheDocument();
        });

        it('should render correct options when POI has roads but no linked map', () => {
            const roads = [{ fromPoiId: 'poi-1', toPoiId: 'poi-2' }];
            renderMenu({ pois: [{ ...props.pois[0], linkedMap: null }], roads });
            expect(screen.getByText('Hide')).toBeInTheDocument();
            expect(screen.getByText('Rename')).toBeInTheDocument();
            expect(screen.getByText('Link to Map...')).toBeInTheDocument();
            expect(screen.getByText('Remove Roads (1)')).toBeInTheDocument();
            expect(screen.getByText('Delete')).toBeInTheDocument();
        });

        it('should render correct options when POI has both linked map and roads', () => {
            const roads = [{ fromPoiId: 'poi-1', toPoiId: 'poi-2' }];
            renderMenu({ pois: [{ ...props.pois[0], linkedMap: 'map.json' }], roads });
            expect(screen.getByText('Hide')).toBeInTheDocument();
            expect(screen.getByText('Rename')).toBeInTheDocument();
            expect(screen.getByText(/Unlink Map/)).toBeInTheDocument();
            expect(screen.getByText('Remove Roads (1)')).toBeInTheDocument();
            expect(screen.getByText('Delete')).toBeInTheDocument();
        });

        it('should render Remove Roads with correct count', () => {
            const roads = [
                { fromPoiId: 'poi-1', toPoiId: 'poi-2' },
                { fromPoiId: 'poi-3', toPoiId: 'poi-1' },
            ];
            renderMenu({ roads });
            expect(screen.getByText('Remove Roads (2)')).toBeInTheDocument();
        });
    });

    describe('action callbacks', () => {
        it('should call onToggleVisibility and onClose when Hide is clicked', () => {
            renderMenu({ pois: [{ ...props.pois[0], visible: true }] });
            fireEvent.click(screen.getByText('Hide'));
            expect(props.onToggleVisibility).toHaveBeenCalledWith('poi-1');
            expect(props.onClose).toHaveBeenCalled();
        });

        it('should call onToggleVisibility and onClose when Show is clicked', () => {
            renderMenu({ pois: [{ ...props.pois[0], visible: false }] });
            fireEvent.click(screen.getByText('Show'));
            expect(props.onToggleVisibility).toHaveBeenCalledWith('poi-1');
            expect(props.onClose).toHaveBeenCalled();
        });

        it('should call setShowRename when Rename is clicked', () => {
            renderMenu();
            fireEvent.click(screen.getByText('Rename'));
            expect(props.setShowRename).toHaveBeenCalledWith('poi-1');
        });

        it('should call onDelete and onClose when Delete is clicked', () => {
            renderMenu();
            fireEvent.click(screen.getByText('Delete'));
            expect(props.onDelete).toHaveBeenCalledWith('poi-1');
            expect(props.onClose).toHaveBeenCalled();
        });

        it('should call onUnlinkMap and onClose when Unlink Map is clicked', () => {
            renderMenu({ pois: [{ ...props.pois[0], linkedMap: 'dungeon-map.json' }] });
            fireEvent.click(screen.getByText(/Unlink Map/));
            expect(props.onUnlinkMap).toHaveBeenCalledWith('poi-1');
            expect(props.onClose).toHaveBeenCalled();
        });

        it('should call onRemoveRoads and onClose when Remove Roads is clicked', () => {
            const roads = [{ fromPoiId: 'poi-1', toPoiId: 'poi-2' }];
            renderMenu({ roads });
            fireEvent.click(screen.getByText('Remove Roads (1)'));
            expect(props.onRemoveRoads).toHaveBeenCalledWith('poi-1');
            expect(props.onClose).toHaveBeenCalled();
        });

        it('should call onClose when close button is clicked', () => {
            renderMenu();
            fireEvent.click(document.querySelector('text.menu-close'));
            expect(props.onClose).toHaveBeenCalled();
        });
    });

    describe('link picker', () => {
        it('should show link picker when Link to Map is clicked', () => {
            const indoorMaps = ['dungeon-map.json', 'cave-map.json'];
            renderMenu({ indoorMaps, pois: [{ ...props.pois[0], linkedMap: null }] });
            fireEvent.click(screen.getByText('Link to Map...'));
            expect(screen.getByText('Dungeon Map')).toBeInTheDocument();
        });

        it('should show no indoor maps message when picker open and no maps available', () => {
            renderMenu({ indoorMaps: [], pois: [{ ...props.pois[0], linkedMap: null }] });
            fireEvent.click(screen.getByText('Link to Map...'));
            expect(screen.getByText('No indoor maps available')).toBeInTheDocument();
        });

        it('should call onLinkMap and onClose when a map is selected', () => {
            const indoorMaps = ['dungeon-map.json'];
            renderMenu({ indoorMaps, pois: [{ ...props.pois[0], linkedMap: null }] });
            fireEvent.click(screen.getByText('Link to Map...'));
            fireEvent.click(screen.getByText('Dungeon Map'));
            expect(props.onLinkMap).toHaveBeenCalledWith('poi-1', 'dungeon-map.json');
            expect(props.onClose).toHaveBeenCalled();
        });

        it('should limit link picker to 6 maps', () => {
            const indoorMaps = ['map1.json', 'map2.json', 'map3.json', 'map4.json', 'map5.json', 'map6.json', 'map7.json', 'map8.json'];
            renderMenu({ indoorMaps, pois: [{ ...props.pois[0], linkedMap: null }] });
            fireEvent.click(screen.getByText('Link to Map...'));
            const mapNames = [...document.querySelectorAll('text.menu-option')].map(t => t.textContent);
            const mapCount = mapNames.filter(n => n.startsWith('Map')).length;
            expect(mapCount).toBe(6);
        });
    });

    describe('rename input', () => {
        it('should show rename input when showRename matches selectedPoi.id', () => {
            renderMenu({ showRename: 'poi-1' });
            const input = document.querySelector('.context-menu-input');
            expect(input).toBeInTheDocument();
            expect(input.value).toBe('City A');
        });

        it('should not show rename input when showRename does not match', () => {
            renderMenu({ showRename: 'poi-2' });
            expect(document.querySelector('.context-menu-input')).not.toBeInTheDocument();
        });

        it('should call onRename and onClose when rename input fires Enter key', () => {
            renderMenu({ showRename: 'poi-1' });
            const input = document.querySelector('.context-menu-input');
            fireEvent.keyDown(input, { key: 'Enter' });
            expect(props.onRename).toHaveBeenCalledWith('poi-1', 'City A');
            expect(props.onClose).toHaveBeenCalled();
        });

        it('should call onRename and onClose when rename input blurs', () => {
            renderMenu({ showRename: 'poi-1' });
            const input = document.querySelector('.context-menu-input');
            fireEvent.blur(input);
            expect(props.onRename).toHaveBeenCalledWith('poi-1', 'City A');
            expect(props.onClose).toHaveBeenCalled();
        });

        it('should use POI label as input default value', () => {
            renderMenu({ showRename: 'poi-1', pois: [{ ...props.pois[0], label: 'Custom Label' }] });
            const input = document.querySelector('.context-menu-input');
            expect(input.value).toBe('Custom Label');
        });

        it('should use empty string as input default when POI has no label', () => {
            renderMenu({ showRename: 'poi-1', pois: [{ ...props.pois[0], label: '' }] });
            const input = document.querySelector('.context-menu-input');
            expect(input.value).toBe('');
        });
    });

    describe('null safety', () => {
        it('should not crash when roads is undefined', () => {
            const { container } = renderMenu({ roads: undefined });
            expect(container.querySelector('.poi-context-menu')).toBeInTheDocument();
        });

        it('should not crash when indoorMaps is undefined', () => {
            const { container } = renderMenu({ indoorMaps: undefined });
            expect(container.querySelector('.poi-context-menu')).toBeInTheDocument();
        });
    });
});
