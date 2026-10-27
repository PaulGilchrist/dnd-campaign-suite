// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import POIContextMenu from './POIContextMenu.jsx';

const BASE_POI = { id: 'poi-1', type: 'city', q: 0, r: 0, label: 'City A', visible: true, linkedMap: null };

// Text labels of clickable menu options in DOM order (excludes the ✕ close
// button and the rename input, which carry their own classes).
function menuOptionLabels(container) {
    return [...container.querySelectorAll('.poi-context-menu .menu-option')].map((el) => el.textContent.trim());
}

describe('POIContextMenu', () => {
    let defaultProps;
    // "Delete" rides a named native confirm (house pattern, mirrors the indoor
    // token-removal lane in PlayerContextMenu.jsx). Accept by default; the
    // cancel-leg test overrides to false.
    let confirmSpy;
    beforeEach(() => {
        confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
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

    afterEach(() => {
        confirmSpy.mockRestore();
    });

    function renderMenu(props = {}) {
        return render(<POIContextMenu {...defaultProps} {...props} />);
    }

    it.each([
        { name: 'no selected POI', selectedPoi: null },
        { name: 'selected POI not found in pois list', pois: [{ id: 'other-poi', q: 1, r: 1 }] },
    ])('renders nothing when %s', ({ selectedPoi, pois }) => {
        const { container } = renderMenu({ selectedPoi, pois });
        expect(container.querySelector('.poi-context-menu')).not.toBeInTheDocument();
    });

    // Full ordered option set per POI state: pinnes which items appear,
    // their labels (incl. road count and formatted linked-map name), and order.
    // 'visible: undefined' pins the `visible !== false` default-to-visible idiom.
    it.each([
        {
            name: 'a visible, unlinked POI with no roads',
            pois: [BASE_POI],
            roads: [],
            options: ['Hide', 'Rename', 'Link to Map...', 'Delete'],
        },
        {
            name: 'a hidden POI',
            pois: [{ ...BASE_POI, visible: false }],
            roads: [],
            options: ['Show', 'Rename', 'Link to Map...', 'Delete'],
        },
        {
            name: 'a POI with visible undefined (treated as visible)',
            pois: [{ ...BASE_POI, visible: undefined }],
            roads: [],
            options: ['Hide', 'Rename', 'Link to Map...', 'Delete'],
        },
        {
            name: 'a linked POI',
            pois: [{ ...BASE_POI, linkedMap: 'dungeon-map.json' }],
            roads: [],
            options: ['Hide', 'Rename', 'Unlink Map (Dungeon Map)', 'Delete'],
        },
        {
            name: 'a POI with one road terminating at it (toPoiId)',
            pois: [BASE_POI],
            roads: [{ fromPoiId: 'poi-2', toPoiId: 'poi-1' }],
            options: ['Hide', 'Rename', 'Link to Map...', 'Delete', 'Remove Roads (1)'],
        },
        {
            name: 'a linked POI with roads in both directions',
            pois: [{ ...BASE_POI, linkedMap: 'map.json' }],
            roads: [
                { fromPoiId: 'poi-1', toPoiId: 'poi-2' },
                { fromPoiId: 'poi-3', toPoiId: 'poi-1' },
            ],
            options: ['Hide', 'Rename', 'Unlink Map (Map)', 'Delete', 'Remove Roads (2)'],
        },
    ])('renders exactly $options for $name', ({ pois, roads, options }) => {
        const { container } = renderMenu({ pois, roads });
        expect(menuOptionLabels(container)).toEqual(options);
    });

    // Every item click: exact payload to the owning callback, exactly once,
    // plus the close contract. Rename stays open inline (no onClose).
    it.each([
        { name: 'Hide', props: {}, item: 'Hide', callback: 'onToggleVisibility', args: ['poi-1'], expectClose: true },
        {
            name: 'Show',
            props: { pois: [{ ...BASE_POI, visible: false }] },
            item: 'Show',
            callback: 'onToggleVisibility',
            args: ['poi-1'],
            expectClose: true,
        },
        { name: 'Rename', props: {}, item: 'Rename', callback: 'setShowRename', args: ['poi-1'], expectClose: false },
        {
            name: 'Unlink Map',
            props: { pois: [{ ...BASE_POI, linkedMap: 'dungeon-map.json' }] },
            item: /Unlink Map/,
            callback: 'onUnlinkMap',
            args: ['poi-1'],
            expectClose: true,
        },
        {
            name: 'Remove Roads',
            props: { roads: [{ fromPoiId: 'poi-1', toPoiId: 'poi-2' }] },
            item: 'Remove Roads (1)',
            callback: 'onRemoveRoads',
            args: ['poi-1'],
            expectClose: true,
        },
        { name: 'Delete', props: {}, item: 'Delete', callback: 'onDelete', args: ['poi-1'], expectClose: true },
        { name: 'close button', props: {}, item: '✕', callback: 'onClose', args: [], expectClose: true },
    ])('clicking $name dispatches once and closes as expected', ({ props, item, callback, args, expectClose }) => {
        renderMenu(props);
        fireEvent.click(screen.getByText(item));
        expect(defaultProps[callback]).toHaveBeenCalledTimes(1);
        expect(defaultProps[callback]).toHaveBeenCalledWith(...args);
        if (expectClose) {
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
        } else {
            expect(defaultProps.onClose).not.toHaveBeenCalled();
        }
    });

    describe('delete confirm (named, native — mirrors indoor token-removal lane)', () => {
        it('asks Delete POI "<label>"? and dispatches onDelete once when accepted', () => {
            renderMenu();
            fireEvent.click(screen.getByText('Delete'));
            expect(confirmSpy).toHaveBeenCalledTimes(1);
            expect(confirmSpy).toHaveBeenCalledWith('Delete POI "City A"?');
            expect(defaultProps.onDelete).toHaveBeenCalledWith('poi-1');
            expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
        });

        it('labels the confirm with the poi id when the poi has no label', () => {
            renderMenu({ pois: [{ ...BASE_POI, label: undefined }] });
            fireEvent.click(screen.getByText('Delete'));
            expect(confirmSpy).toHaveBeenCalledWith('Delete POI "poi-1"?');
            expect(defaultProps.onDelete).toHaveBeenCalledWith('poi-1');
        });

        it('is fully inert on cancel: no delete dispatch, roads untouched upstream, but the menu still closes', () => {
            confirmSpy.mockReturnValue(false);
            renderMenu({ roads: [{ fromPoiId: 'poi-1', toPoiId: 'poi-2' }] });
            fireEvent.click(screen.getByText('Delete'));
            expect(confirmSpy).toHaveBeenCalledTimes(1);
            // No onDelete → usePoiManagement.handleDeletePoi never runs → no
            // setPois/setRoads write → no autosave PUT attributable to the cancel.
            expect(defaultProps.onDelete).not.toHaveBeenCalled();
            expect(defaultProps.onRemoveRoads).not.toHaveBeenCalled();
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
        });
    });

    it('stops pointer and click events from bubbling to the map beneath, without swallowing the menu action', () => {
        const mapClick = vi.fn();
        const mapPointerDown = vi.fn();
        render(
            <svg onClick={mapClick} onPointerDown={mapPointerDown}>
                <POIContextMenu {...defaultProps} />
            </svg>
        );
        fireEvent.pointerDown(screen.getByText('Hide'));
        fireEvent.click(screen.getByText('Hide'));
        expect(mapPointerDown).not.toHaveBeenCalled();
        expect(mapClick).not.toHaveBeenCalled();
        // The click was stopped, not swallowed: the menu action still dispatched once.
        expect(defaultProps.onToggleVisibility).toHaveBeenCalledTimes(1);
    });

    describe('link picker', () => {
        it('opens showing formatted map names between Link and Delete, then links and closes on pick', () => {
            const { container } = renderMenu({ indoorMaps: ['dungeon-map.json'] });
            fireEvent.click(screen.getByText('Link to Map...'));
            expect(menuOptionLabels(container)).toEqual([
                'Hide',
                'Rename',
                'Link to Map...',
                'Dungeon Map',
                'Delete',
            ]);
            fireEvent.click(screen.getByText('Dungeon Map'));
            expect(defaultProps.onLinkMap).toHaveBeenCalledWith('poi-1', 'dungeon-map.json');
            expect(defaultProps.onLinkMap).toHaveBeenCalledTimes(1);
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
        });

        it('shows a hint when there are no indoor maps to link', () => {
            renderMenu({ indoorMaps: [] });
            fireEvent.click(screen.getByText('Link to Map...'));
            expect(screen.getByText('No indoor maps available')).toBeInTheDocument();
            expect(defaultProps.onLinkMap).not.toHaveBeenCalled();
        });

        it('caps the picker at six items', () => {
            const indoorMaps = Array.from({ length: 7 }, (_, i) => `map-0${i + 1}.json`);
            renderMenu({ indoorMaps });
            fireEvent.click(screen.getByText('Link to Map...'));
            expect(screen.getByText('Map 06')).toBeInTheDocument();
            expect(screen.queryByText('Map 07')).not.toBeInTheDocument();
        });

        it('closes the picker and the menu when the close button is clicked with the picker open', () => {
            renderMenu({ indoorMaps: ['dungeon-map.json'] });
            fireEvent.click(screen.getByText('Link to Map...'));
            fireEvent.click(screen.getByText('✕'));
            expect(screen.queryByText('Dungeon Map')).not.toBeInTheDocument();
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
            expect(defaultProps.onLinkMap).not.toHaveBeenCalled();
        });
    });

    describe('rename input', () => {
        it.each([
            { label: 'City A', expected: 'City A' },
            { label: '', expected: '' },
        ])('shows an input pre-filled with %s when showRename matches this POI', ({ label, expected }) => {
            renderMenu({ showRename: 'poi-1', pois: [{ ...BASE_POI, label }] });
            expect(screen.getByRole('textbox')).toHaveValue(expected);
        });

        it('does not show the input when showRename targets another POI', () => {
            renderMenu({ showRename: 'other-poi' });
            expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        });

        it.each(['Enter', 'blur'])('commits the typed name and closes on %s', (trigger) => {
            renderMenu({ showRename: 'poi-1' });
            const input = screen.getByRole('textbox');
            fireEvent.change(input, { target: { value: 'Northern Bastion' } });
            if (trigger === 'Enter') {
                fireEvent.keyDown(input, { key: 'Enter' });
            } else {
                fireEvent.blur(input);
            }
            expect(defaultProps.onRename).toHaveBeenCalledWith('poi-1', 'Northern Bastion');
            expect(defaultProps.onRename).toHaveBeenCalledTimes(1);
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
        });
    });
});
