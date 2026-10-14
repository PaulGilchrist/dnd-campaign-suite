import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import POIContextMenu from './POIContextMenu.jsx';

const BASE_POI = { id: 'poi-1', type: 'city', q: 0, r: 0, label: 'City A', visible: true, linkedMap: null };

describe('POIContextMenu', () => {
    let defaultProps;

    beforeEach(() => {
        defaultProps = {
            selectedPoi: { id: 'poi-1', q: 0, r: 0 },
            pois: [BASE_POI],
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

    function renderMenu(props = {}) {
        return render(<POIContextMenu {...defaultProps} {...props} />);
    }

    describe('rendering', () => {
        it.each([
            { name: 'no selected POI', selectedPoi: null },
            { name: 'selected POI not found in pois list', pois: [{ id: 'other-poi', q: 1, r: 1 }] },
        ])('returns null (no menu) when %s', ({ selectedPoi, pois }) => {
            const { container } = renderMenu({ selectedPoi, pois });
            expect(container.querySelector('.poi-context-menu')).not.toBeInTheDocument();
        });

        it('renders menu options when the selected POI exists', () => {
            renderMenu();
            expect(screen.getByText('Hide')).toBeInTheDocument();
            expect(screen.getByText('Rename')).toBeInTheDocument();
            expect(screen.getByText('Link to Map...')).toBeInTheDocument();
            expect(screen.getByText('Delete')).toBeInTheDocument();
        });

        it('renders the close button', () => {
            renderMenu();
            expect(screen.getByText('✕')).toBeInTheDocument();
        });
    });

    describe('contextual options', () => {
        const optionCases = [
            {
                name: 'no linked map and no roads',
                pois: [BASE_POI],
                roads: [],
                present: ['Hide', 'Rename', 'Link to Map...', 'Delete'],
                absent: [/Unlink Map/, /Remove Roads/],
            },
            {
                name: 'a linked map but no roads',
                pois: [{ ...BASE_POI, linkedMap: 'dungeon-map.json' }],
                roads: [],
                present: ['Hide', 'Rename', 'Unlink Map (Dungeon Map)', 'Delete'],
                absent: ['Link to Map...', /Remove Roads/],
            },
            {
                name: 'roads but no linked map',
                pois: [BASE_POI],
                roads: [{ fromPoiId: 'poi-1', toPoiId: 'poi-2' }],
                present: ['Hide', 'Rename', 'Link to Map...', 'Remove Roads (1)', 'Delete'],
                absent: [/Unlink Map/],
            },
            {
                name: 'both a linked map and roads',
                pois: [{ ...BASE_POI, linkedMap: 'map.json' }],
                roads: [{ fromPoiId: 'poi-1', toPoiId: 'poi-2' }],
                present: ['Hide', 'Rename', 'Unlink Map (Map)', 'Remove Roads (1)', 'Delete'],
                absent: ['Link to Map...'],
            },
        ];

        it.each(optionCases)(
            'renders the correct options for $name',
            ({ pois, roads, present, absent }) => {
                renderMenu({ pois, roads });
                present.forEach((option) => expect(screen.getByText(option)).toBeInTheDocument());
                absent.forEach((option) => expect(screen.queryByText(option)).not.toBeInTheDocument());
            }
        );

        it('counts roads terminating at the POI (toPoiId) as connected', () => {
            renderMenu({ roads: [{ fromPoiId: 'poi-2', toPoiId: 'poi-1' }] });
            expect(screen.getByText('Remove Roads (1)')).toBeInTheDocument();
        });

        it('sums roads from both directions when multiple roads touch the POI', () => {
            renderMenu({
                roads: [
                    { fromPoiId: 'poi-1', toPoiId: 'poi-2' },
                    { fromPoiId: 'poi-3', toPoiId: 'poi-1' },
                ],
            });
            expect(screen.getByText('Remove Roads (2)')).toBeInTheDocument();
        });

        it('shows "Show" for a hidden POI instead of "Hide"', () => {
            renderMenu({ pois: [{ ...BASE_POI, visible: false }] });
            expect(screen.getByText('Show')).toBeInTheDocument();
            expect(screen.queryByText('Hide')).not.toBeInTheDocument();
        });

        it('shows "Hide" when visible is undefined (treated as visible)', () => {
            renderMenu({ pois: [{ ...BASE_POI, visible: undefined }] });
            expect(screen.getByText('Hide')).toBeInTheDocument();
            expect(screen.queryByText('Show')).not.toBeInTheDocument();
        });
    });

    describe('action callbacks', () => {
        it.each([
            { toggleLabel: 'visible', buttonLabel: 'Hide', newVisible: false },
            { toggleLabel: 'hidden', buttonLabel: 'Show', newVisible: true },
        ])('toggles a %s POI via "%s" and closes the menu', ({ buttonLabel }) => {
            const visible = buttonLabel === 'Hide';
            renderMenu({ pois: [{ ...BASE_POI, visible }] });
            fireEvent.click(screen.getByText(buttonLabel));
            expect(defaultProps.onToggleVisibility).toHaveBeenCalledWith('poi-1');
            expect(defaultProps.onClose).toHaveBeenCalled();
        });

        it('opens the rename input via setShowRename when Rename is clicked', () => {
            renderMenu();
            fireEvent.click(screen.getByText('Rename'));
            expect(defaultProps.setShowRename).toHaveBeenCalledWith('poi-1');
        });

        it('deletes the POI and closes the menu on Delete', () => {
            renderMenu();
            fireEvent.click(screen.getByText('Delete'));
            expect(defaultProps.onDelete).toHaveBeenCalledWith('poi-1');
            expect(defaultProps.onClose).toHaveBeenCalled();
        });

        it('unlinks the map and closes the menu on Unlink Map', () => {
            renderMenu({ pois: [{ ...BASE_POI, linkedMap: 'dungeon-map.json' }] });
            fireEvent.click(screen.getByText(/Unlink Map/));
            expect(defaultProps.onUnlinkMap).toHaveBeenCalledWith('poi-1');
            expect(defaultProps.onClose).toHaveBeenCalled();
        });

        it('removes connected roads and closes the menu on Remove Roads', () => {
            renderMenu({ roads: [{ fromPoiId: 'poi-1', toPoiId: 'poi-2' }] });
            fireEvent.click(screen.getByText('Remove Roads (1)'));
            expect(defaultProps.onRemoveRoads).toHaveBeenCalledWith('poi-1');
            expect(defaultProps.onClose).toHaveBeenCalled();
        });

        it('closes the menu when the close button (✕) is clicked', () => {
            renderMenu();
            fireEvent.click(screen.getByText('✕'));
            expect(defaultProps.onClose).toHaveBeenCalled();
        });

        it('prevents pointer and click events from bubbling to the map beneath', () => {
            const mapClick = vi.fn();
            const mapPointerDown = vi.fn();
            render(
                <svg onClick={mapClick} onPointerDown={mapPointerDown}>
                    <POIContextMenu {...defaultProps} />
                </svg>
            );
            fireEvent.pointerDown(screen.getByText('Hide'));
            fireEvent.click(screen.getByText('Hide'));
            // The action should fire
            expect(defaultProps.onToggleVisibility).toHaveBeenCalledWith('poi-1');
            expect(defaultProps.onClose).toHaveBeenCalled();
            // But map handlers should NOT fire
            expect(mapPointerDown).not.toHaveBeenCalled();
            expect(mapClick).not.toHaveBeenCalled();
        });
    });

    describe('link picker', () => {
        it('links the selected map and closes when a map is chosen', () => {
            renderMenu({ indoorMaps: ['dungeon-map.json'], pois: [BASE_POI] });
            fireEvent.click(screen.getByText('Link to Map...'));
            fireEvent.click(screen.getByText('Dungeon Map'));
            expect(defaultProps.onLinkMap).toHaveBeenCalledWith('poi-1', 'dungeon-map.json');
            expect(defaultProps.onClose).toHaveBeenCalled();
        });

        it('shows a hint when there are no indoor maps to link', () => {
            renderMenu({ indoorMaps: [], pois: [BASE_POI] });
            fireEvent.click(screen.getByText('Link to Map...'));
            expect(screen.getByText('No indoor maps available')).toBeInTheDocument();
        });

        it('limits the picker to at most six maps', () => {
            const indoorMaps = Array.from({ length: 8 }, (_, i) => `map-0${i + 1}.json`);
            renderMenu({ indoorMaps, pois: [BASE_POI] });
            fireEvent.click(screen.getByText('Link to Map...'));
            for (let i = 1; i <= 6; i += 1) {
                expect(screen.getByText(`Map 0${i}`)).toBeInTheDocument();
            }
            expect(screen.queryByText('Map 07')).not.toBeInTheDocument();
            expect(screen.queryByText('Map 08')).not.toBeInTheDocument();
        });

        it('closes the link picker and the menu when the close button (✕) is clicked', () => {
            renderMenu({ indoorMaps: ['dungeon-map.json'], pois: [BASE_POI] });
            fireEvent.click(screen.getByText('Link to Map...'));
            expect(screen.getByText('Dungeon Map')).toBeInTheDocument();
            fireEvent.click(screen.getByText('✕'));
            expect(screen.queryByText('Dungeon Map')).not.toBeInTheDocument();
            expect(defaultProps.onClose).toHaveBeenCalled();
        });

        it('handles undefined indoorMaps gracefully', () => {
            const props = { ...defaultProps };
            delete props.indoorMaps;
            render(<POIContextMenu {...props} />);
            fireEvent.click(screen.getByText('Link to Map...'));
            expect(screen.getByText('No indoor maps available')).toBeInTheDocument();
        });
    });

    describe('rename input', () => {
        it('shows an input pre-filled with the POI label when showRename matches', () => {
            renderMenu({ showRename: 'poi-1' });
            expect(screen.getByRole('textbox')).toHaveValue('City A');
        });

        it('does not show the input when showRename targets another POI', () => {
            renderMenu({ showRename: 'other-poi' });
            expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        });

        it('defaults to an empty value when the POI has no label', () => {
            renderMenu({ showRename: 'poi-1', pois: [{ ...BASE_POI, label: '' }] });
            expect(screen.getByRole('textbox')).toHaveValue('');
        });

        it('commits the entered name and closes the menu on Enter', () => {
            renderMenu({ showRename: 'poi-1' });
            const input = screen.getByRole('textbox');
            fireEvent.change(input, { target: { value: 'Northern Bastion' } });
            fireEvent.keyDown(input, { key: 'Enter' });
            expect(defaultProps.onRename).toHaveBeenCalledWith('poi-1', 'Northern Bastion');
            expect(defaultProps.onClose).toHaveBeenCalled();
        });

        it('commits the entered name and closes the menu on blur', () => {
            renderMenu({ showRename: 'poi-1' });
            const input = screen.getByRole('textbox');
            fireEvent.change(input, { target: { value: 'Northern Bastion' } });
            fireEvent.blur(input);
            expect(defaultProps.onRename).toHaveBeenCalledWith('poi-1', 'Northern Bastion');
            expect(defaultProps.onClose).toHaveBeenCalled();
        });
    });

});
