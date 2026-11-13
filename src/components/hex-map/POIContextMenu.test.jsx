// @maintained-by-ai
import { useState } from 'react';
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
    // "Delete" no longer rides a native confirm (backlog 2026-11-01 BA): the
    // menu dispatches onDelete unconditionally — the parent stages the named
    // confirm through the shared requestDelete descriptor seam and renders it
    // in the DeleteConfirmModal role=dialog tier. Spy armed in every test to
    // lock that the menu itself is native-confirm-free.
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

    describe('delete arms the shared dialog tier (no native confirm)', () => {
        it('dispatches onDelete exactly once with the poi id, never a native confirm, and closes the menu', () => {
            renderMenu();
            fireEvent.click(screen.getByText('Delete'));
            expect(confirmSpy).not.toHaveBeenCalled();
            expect(defaultProps.onDelete).toHaveBeenCalledWith('poi-1');
            expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
            // The menu closes at the request — the staged dialog owns the
            // decision: cancel happens upstream (usePoiManagement.cancelDelete
            // never runs the closure → no setPois/setRoads write → the map's
            // autosave PUT lane never fires; see usePoiManagement.test.js).
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
        });

        it('labels are resolved upstream — the menu passes only the id', () => {
            renderMenu({ pois: [{ ...BASE_POI, label: undefined }] });
            fireEvent.click(screen.getByText('Delete'));
            expect(confirmSpy).not.toHaveBeenCalled();
            expect(defaultProps.onDelete).toHaveBeenCalledWith('poi-1');
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

    // Improvement 2026-11-13: options retired the bare-SVG-<text> face (no
    // .click(), no keyboard activation) for focusable <g role="menuitem">
    // wrappers whose Enter/Space keydown fires the SAME closure as a click,
    // exactly once (an SVG <g> never synthesises a click from a keypress).
    describe('keyboard activation', () => {
        function menuitemNames(container) {
            return [...container.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent.trim());
        }

        it('exposes role="menu" on the container and role="menuitem" on every option', () => {
            const { container } = renderMenu({ roads: [{ fromPoiId: 'poi-1', toPoiId: 'poi-2' }] });
            const menu = container.querySelector('.poi-context-menu');
            expect(menu).toHaveAttribute('role', 'menu');
            expect(menuitemNames(container)).toEqual([
                'Hide',
                'Rename',
                'Link to Map...',
                'Delete',
                'Remove Roads (1)',
                '✕',
            ]);
        });

        it('labels the Show / Unlink Map (…) variants as menuitems too', () => {
            const { container } = renderMenu({
                pois: [{ ...BASE_POI, visible: false, linkedMap: 'dungeon-map.json' }],
            });
            expect(menuitemNames(container)).toEqual([
                'Show',
                'Rename',
                'Unlink Map (Dungeon Map)',
                'Delete',
                '✕',
            ]);
        });

        it('every menuitem is keyboard-focusable (.focus() lands document.activeElement on it)', () => {
            renderMenu();
            screen.getAllByRole('menuitem').forEach((el) => {
                el.focus();
                expect(document.activeElement).toBe(el);
            });
        });

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
                item: 'Unlink Map (Dungeon Map)',
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
        ])('Enter on $name fires the same handler exactly once and closes as expected', ({ props, item, callback, args, expectClose }) => {
            renderMenu(props);
            fireEvent.keyDown(screen.getByRole('menuitem', { name: item, exact: true }), { key: 'Enter' });
            expect(defaultProps[callback]).toHaveBeenCalledTimes(1);
            expect(defaultProps[callback]).toHaveBeenCalledWith(...args);
            // The menu is native-confirm-free on every activation face.
            expect(confirmSpy).not.toHaveBeenCalled();
            if (expectClose) {
                expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
            } else {
                expect(defaultProps.onClose).not.toHaveBeenCalled();
            }
        });

        it('Space on Hide activates like Enter (bonus face), exactly once', () => {
            renderMenu();
            fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Hide', exact: true }), { key: ' ' });
            expect(defaultProps.onToggleVisibility).toHaveBeenCalledTimes(1);
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
        });

        it.each(['a', 'Tab'])(
            'non-activating key %s on a menuitem dispatches nothing (menu-local keys stay zero-write)',
            (key) => {
                renderMenu();
                fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Hide', exact: true }), { key });
                Object.values(defaultProps)
                    .filter((v) => typeof v === 'function')
                    .forEach((fn) => expect(fn).not.toHaveBeenCalled());
            }
        );

        it('opens the link picker on Enter on Link to Map... and links exactly once on Enter on a map row', () => {
            const { container } = renderMenu({ indoorMaps: ['dungeon-map.json'] });
            fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Link to Map...', exact: true }), { key: 'Enter' });
            expect(menuitemNames(container)).toEqual(['Hide', 'Rename', 'Link to Map...', 'Dungeon Map', 'Delete', '✕']);
            const row = screen.getByRole('menuitem', { name: 'Dungeon Map', exact: true });
            row.focus();
            expect(document.activeElement).toBe(row);
            fireEvent.keyDown(row, { key: 'Enter' });
            expect(defaultProps.onLinkMap).toHaveBeenCalledWith('poi-1', 'dungeon-map.json');
            expect(defaultProps.onLinkMap).toHaveBeenCalledTimes(1);
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
        });
    });

    // Improvement 2026-11-13 (replaces the adc78327f "Escape inert" law):
    // Escape = dismiss-zero-write, riding the same onClose backdrop path as
    // the svg-root click (modal-family law of 3f41dc16b). The window-level
    // listener must answer regardless of where focus lives — menu root, a
    // menuitem, or the board behind the menu — and it must NEVER activate
    // the focused option.
    describe('Escape dismissal (zero-write)', () => {
        function expectOnlyOnClose() {
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
            ['onToggleVisibility', 'onDelete', 'onRename', 'onLinkMap', 'onUnlinkMap', 'onRemoveRoads', 'setShowRename']
                .forEach((key) => expect(defaultProps[key]).not.toHaveBeenCalled());
            expect(confirmSpy).not.toHaveBeenCalled();
        }

        it.each([
            { name: 'a menuitem', getTarget: () => screen.getByRole('menuitem', { name: 'Hide', exact: true }) },
            { name: 'the menu root', getTarget: (container) => container.querySelector('.poi-context-menu') },
            { name: 'the board behind the menu', getTarget: () => window },
        ])('Escape on $name dismisses via onClose with zero activation', ({ getTarget }) => {
            const { container } = renderMenu();
            fireEvent.keyDown(getTarget(container), { key: 'Escape' });
            expectOnlyOnClose();
        });

        it('unmounts the menu immediately (stateful parent: onClose nulls the selection)', () => {
            function Board() {
                const [selected, setSelected] = useState({ id: 'poi-1', q: 0, r: 0 });
                return (
                    <svg>
                        <POIContextMenu
                            {...defaultProps}
                            selectedPoi={selected}
                            onClose={() => setSelected(null)}
                        />
                    </svg>
                );
            }
            const { container } = render(<Board />);
            expect(container.querySelector('.poi-context-menu')).toBeInTheDocument();
            fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Delete', exact: true }), { key: 'Escape' });
            expect(container.querySelector('.poi-context-menu')).not.toBeInTheDocument();
            // Zero activation on the way out.
            expect(defaultProps.onDelete).not.toHaveBeenCalled();
            expect(defaultProps.onToggleVisibility).not.toHaveBeenCalled();
        });

        it('closes an open link picker and re-opens cleanly after an Escape dismissal', () => {
            const { container, rerender } = renderMenu({ indoorMaps: ['dungeon-map.json'] });
            fireEvent.click(screen.getByText('Link to Map...'));
            expect(screen.getByText('Dungeon Map')).toBeInTheDocument();
            fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Dungeon Map', exact: true }), { key: 'Escape' });
            expect(defaultProps.onLinkMap).not.toHaveBeenCalled();
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
            // Parent re-opens the same POI (selectedPoi toggled null → set):
            // the stale picker must not resurface.
            rerender(<POIContextMenu {...defaultProps} indoorMaps={['dungeon-map.json']} selectedPoi={null} />);
            rerender(<POIContextMenu {...defaultProps} indoorMaps={['dungeon-map.json']} />);
            expect(container.querySelector('.poi-context-menu')).toBeInTheDocument();
            expect(screen.queryByText('Dungeon Map')).not.toBeInTheDocument();
        });

        it('is inert inside the inline rename input — the INPUT owns Escape there', () => {
            // Improvement 2026-11-13 replaced the inert-input law: Escape now
            // cancels via RenameInput's OWN handler (see 'rename input'
            // below). The window listener must not ALSO fire onClose — the
            // input-level Escape wins and the menu layer stays silent. The
            // single onClose comes from the input's own revert-and-close.
            renderMenu({ showRename: 'poi-1' });
            fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
            expect(defaultProps.onRename).not.toHaveBeenCalled();
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
        });

        it('leaves no live listener once the menu is closed (Escape dispatches nothing)', () => {
            const { rerender } = renderMenu();
            fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Hide', exact: true }), { key: 'Escape' });
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
            rerender(<POIContextMenu {...defaultProps} selectedPoi={null} />);
            fireEvent.keyDown(window, { key: 'Escape' });
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
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

        // Improvement 2026-11-13 (backlog "POI inline rename has no cancel
        // face"): Escape = revert-and-close, and a refused blank commit is
        // visibly rolled back instead of closing silently.
        it('Escape reverts-and-closes: onRename never called, onClose once (zero-write cancel)', () => {
            renderMenu({ showRename: 'poi-1' });
            const input = screen.getByRole('textbox');
            fireEvent.change(input, { target: { value: 'Abandoned Keep' } });
            fireEvent.keyDown(input, { key: 'Escape' });
            expect(defaultProps.onRename).not.toHaveBeenCalled();
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
            // Every other mutation callback stays untouched too.
            ['onToggleVisibility', 'onDelete', 'onLinkMap', 'onUnlinkMap', 'onRemoveRoads', 'setShowRename']
                .forEach((key) => expect(defaultProps[key]).not.toHaveBeenCalled());
        });

        it('Escape unmounts the input and keeps the OLD label on the POI (stateful parent)', () => {
            // Mirrors HexMap.jsx wiring: onClose nulls BOTH the menu and the
            // rename arm, so the chip re-renders with the untouched label.
            function Board() {
                const [selected, setSelected] = useState({ id: 'poi-1', q: 0, r: 0 });
                const [renameId, setRenameId] = useState('poi-1');
                const close = () => {
                    setSelected(null);
                    setRenameId(null);
                };
                return (
                    <svg>
                        <text className="poi-label">{BASE_POI.label}</text>
                        <POIContextMenu
                            {...defaultProps}
                            selectedPoi={selected}
                            showRename={renameId}
                            onClose={close}
                        />
                    </svg>
                );
            }
            const { container } = render(<Board />);
            const input = container.querySelector('input.context-menu-input');
            expect(input).toBeInTheDocument();
            fireEvent.change(input, { target: { value: 'Discarded Draft' } });
            fireEvent.keyDown(input, { key: 'Escape' });
            expect(container.querySelector('input.context-menu-input')).not.toBeInTheDocument();
            expect(container.querySelector('.poi-context-menu')).not.toBeInTheDocument();
            expect(container.querySelector('.poi-label').textContent).toBe('City A');
            expect(defaultProps.onRename).not.toHaveBeenCalled();
        });

        it('a blur racing the Escape teardown never commits the cancelled draft', () => {
            // The mocked onClose changes no parent state, so the input stays
            // mounted for the test — a blur landing on it after the cancel
            // must be swallowed by the cancelled-draft guard.
            renderMenu({ showRename: 'poi-1' });
            const input = screen.getByRole('textbox');
            fireEvent.change(input, { target: { value: 'Abandoned Keep' } });
            fireEvent.keyDown(input, { key: 'Escape' });
            fireEvent.blur(input);
            expect(defaultProps.onRename).not.toHaveBeenCalled();
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
        });

        it.each(['Enter', 'blur'])(
            'a refused blank commit on %s visibly restores the old label and keeps the editor open',
            (trigger) => {
                // Stands in for usePoiManagement.handleRenamePoi's law: blank
                // is refused with `false` and nothing is written.
                const onRename = vi.fn(() => false);
                renderMenu({ showRename: 'poi-1', onRename });
                const input = screen.getByRole('textbox');
                fireEvent.change(input, { target: { value: '   ' } });
                if (trigger === 'Enter') {
                    fireEvent.keyDown(input, { key: 'Enter' });
                } else {
                    fireEvent.blur(input);
                }
                expect(onRename).toHaveBeenCalledWith('poi-1', '   ');
                expect(onRename).toHaveBeenCalledTimes(1);
                // Not silent any more: the input shows the OLD text again…
                expect(input).toHaveValue('City A');
                // …and nothing closed — the editor/menu stay armed.
                expect(defaultProps.onClose).not.toHaveBeenCalled();
            }
        );

        it('an accepted commit (onRename returns true) closes the menu as before', () => {
            const onRename = vi.fn(() => true);
            renderMenu({ showRename: 'poi-1', onRename });
            const input = screen.getByRole('textbox');
            fireEvent.change(input, { target: { value: 'Reylin Cross' } });
            fireEvent.keyDown(input, { key: 'Enter' });
            expect(onRename).toHaveBeenCalledWith('poi-1', 'Reylin Cross');
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
        });
    });
});
